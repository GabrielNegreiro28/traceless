// @ts-check
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Architecture boundaries (CLAUDE.md rule 1, PLANO §1.9).
 * Each pattern matches the import specifier, so relative paths such as
 * `../../infrastructure/x` are caught by path segment.
 *
 * @param {string} segment folder name directly under src/
 */
const layer = (segment) => `(^|/)${segment}(/|$)`;

const FORBID_REACT = {
  regex: '^react(-dom)?(/|$)',
  message: 'This layer must stay framework-free: no React here.',
};
const FORBID_FIREBASE = {
  regex: '^(firebase|@firebase)(/|$)',
  message: 'Firebase is only allowed in src/infrastructure (adapters).',
};
const FORBID_INFRASTRUCTURE = {
  regex: layer('infrastructure'),
  message: 'Depend on a port (src/application/ports); adapters are wired in src/app.',
};

/**
 * Privacy-by-types (CLAUDE.md rule 3): SanitizedText may only be created by the
 * approveReport use case, so only that file may import the internal factory.
 */
const FORBID_SANITIZED_FACTORY = {
  regex: '(^|/)brandedText(\\.[cm]?[jt]sx?)?$',
  importNames: ['unsafeCreateSanitizedText'],
  message: 'Only src/application/usecases/approveReport.ts may create SanitizedText.',
};

/**
 * Features approve only through `useServices().approveReport` (the composition root binds the
 * clock and records the privacy ledger); they may import the use case's types, never its value.
 */
const FORBID_APPROVE_USE_CASE = {
  regex: '(^|/)usecases/approveReport$',
  importNames: ['approveReport'],
  allowTypeImports: true,
  message: 'Features call approveReport via useServices(), never the use case directly.',
};

const brandAssertion = (/** @type {string} */ kind) => ({
  selector: `${kind}[typeAnnotation.type='TSTypeReference'][typeAnnotation.typeName.name=/^(SanitizedText|ConsentedRawText)$/]`,
  message:
    'SanitizedText/ConsentedRawText may only be created by approveReport()/the consent use case — never by a type assertion.',
});
const FORBID_BRAND_ASSERTIONS = ['TSAsExpression', 'TSTypeAssertion'].map(brandAssertion);

/**
 * Environment access (DECISIONS 2026-11-12): only src/app/env.ts reads
 * `import.meta.env`, variable by variable, so a debug token cannot leak via
 * an accidental whole-object read elsewhere.
 */
const FORBID_ENV_ACCESS = {
  selector:
    "MemberExpression[object.type='MetaProperty'][object.meta.name='import'][object.property.name='meta'][property.name='env']",
  message: 'Read import.meta.env only in src/app/env.ts (use readEnv() / isDev).',
};
const BRAND_FACTORY_FILE = 'src/domain/text/brandedText.ts';
const ENV_READER_FILES = [
  'src/app/env.ts',
  // Shared logger needs the build mode but must not depend on src/app; it reads only DEV/MODE.
  'src/shared/logger.ts',
  // Dev-only route table: the literal `import.meta.env.DEV` lets the bundler drop the eval page.
  'src/app/devRoutes.tsx',
];
const restrictSyntax = (/** @type {object[]} */ ...selectors) => ({
  'no-restricted-syntax': ['error', ...selectors],
});

const restrict = (/** @type {object[]} */ ...patterns) => ({
  '@typescript-eslint/no-restricted-imports': ['error', { patterns }],
});

// domain: pure business logic; no frameworks, no outer layers.
const DOMAIN = [
  FORBID_REACT,
  FORBID_FIREBASE,
  {
    regex: layer('(application|infrastructure|features|app|ui|ai)'),
    message: 'src/domain is pure: it may import only src/domain and src/shared.',
  },
];
// application: use cases orchestrate domain + ports; never UI or concrete adapters.
const APPLICATION = [
  FORBID_REACT,
  FORBID_FIREBASE,
  {
    regex: layer('(infrastructure|features|app|ui)'),
    message: 'Use cases depend on ports, never on UI or concrete adapters.',
  },
];
// application tests: may additionally use the deterministic fakes (never real adapters).
const APPLICATION_TESTS = [
  FORBID_REACT,
  FORBID_FIREBASE,
  {
    regex: `${layer('(features|app|ui)')}|(^|/)infrastructure(/(?!fakes/)|$)`,
    message: 'Use-case tests may import only src/infrastructure/fakes, never real adapters.',
  },
];
// features/ui: presentation only; services arrive via useServices().
const PRESENTATION = [FORBID_FIREBASE, FORBID_INFRASTRUCTURE];
// ai: prompts, schemas and policy; Firebase *types* from firebase/ai only (Schema types).
const AI = [
  FORBID_INFRASTRUCTURE,
  {
    regex: '^(@firebase(/|$)|firebase($|/(?!ai$)))',
    message: 'src/ai holds AI knowledge only; Firebase initialization lives in src/infrastructure.',
  },
  {
    regex: '^firebase/ai$',
    allowTypeImports: true,
    message: 'src/ai may import types from firebase/ai, never runtime values.',
  },
];

export default defineConfig([
  globalIgnores(['dist', 'coverage', 'node_modules', '.firebase']),

  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommendedTypeChecked,
      reactHooks.configs.flat['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // Raw report text must never reach the console; use src/shared/logger.ts.
      'no-console': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      ...restrict(FORBID_SANITIZED_FACTORY),
    },
  },

  { files: ['src/domain/**/*.{ts,tsx}'], rules: restrict(...DOMAIN, FORBID_SANITIZED_FACTORY) },
  {
    files: ['src/application/**/*.{ts,tsx}'],
    rules: restrict(...APPLICATION, FORBID_SANITIZED_FACTORY),
  },
  {
    files: ['src/application/**/*.test.{ts,tsx}'],
    rules: restrict(...APPLICATION_TESTS, FORBID_SANITIZED_FACTORY),
  },
  {
    files: ['src/features/**/*.{ts,tsx}', 'src/ui/**/*.{ts,tsx}'],
    rules: restrict(...PRESENTATION, FORBID_SANITIZED_FACTORY, FORBID_APPROVE_USE_CASE),
  },
  { files: ['src/ai/**/*.{ts,tsx}'], rules: restrict(...AI, FORBID_SANITIZED_FACTORY) },
  // The single place allowed to create SanitizedText (keeps the application rules).
  { files: ['src/application/usecases/approveReport.ts'], rules: restrict(...APPLICATION) },

  // no-restricted-syntax: a later block replaces the whole selector list, so each
  // block below states the complete set for the files it matches.
  // Everywhere: no import.meta.env outside the env reader files.
  {
    files: ['**/*.{ts,tsx}'],
    ignores: [...ENV_READER_FILES, '*.config.{js,ts}'],
    rules: restrictSyntax(FORBID_ENV_ACCESS),
  },
  // src (except the brand factory and env readers): no brand assertions + no env access.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: [BRAND_FACTORY_FILE, ...ENV_READER_FILES],
    rules: restrictSyntax(...FORBID_BRAND_ASSERTIONS, FORBID_ENV_ACCESS),
  },
  // Env readers may touch import.meta.env but still cannot assert brands.
  { files: ENV_READER_FILES, rules: restrictSyntax(...FORBID_BRAND_ASSERTIONS) },

  // The logger is the only module that may write to the console.
  { files: ['src/shared/logger.ts'], rules: { 'no-console': 'off' } },

  // Node-side config files.
  {
    files: ['*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['scripts/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.{js,mjs}'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },

  // Must stay last: turns off stylistic rules that Prettier owns.
  prettier,
]);
