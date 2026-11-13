import {
  OUTLET_LABELS,
  buildIdentityScanSchema,
  parseIdentityScanOutput,
} from '../schemas/identityScan';
import * as v1 from './identityScan.v1';
import * as v2 from './identityScan.v2';
import type { PromptModule } from './promptModule';

/** v1: no outlets, so its schema and parsing are exactly what produced the v1 results. */
const V1: PromptModule = {
  version: v1.IDENTITY_SCAN_PROMPT_VERSION,
  buildUserPrompt: v1.buildUserPrompt,
  buildInitialPrompts: v1.buildInitialPrompts,
  buildSchema: (categories) => buildIdentityScanSchema(categories),
  parse: (text, categories) => parseIdentityScanOutput(text, categories),
};

/** v2: both outlets (REPORTED_PERSON, OTHER_PERSON) in the schema and the parser. */
const V2: PromptModule = {
  version: v2.IDENTITY_SCAN_V2_PROMPT_VERSION,
  buildUserPrompt: v2.buildUserPrompt,
  buildInitialPrompts: v2.buildInitialPrompts,
  buildSchema: (categories) => buildIdentityScanSchema(categories, OUTLET_LABELS),
  parse: (text, categories) => parseIdentityScanOutput(text, categories, OUTLET_LABELS),
};

/** Register a new prompt version here (promptVersion -> module); nothing else changes. */
const PROMPT_MODULES: readonly PromptModule[] = [V1, V2];

export function getPromptModule(version: string): PromptModule | undefined {
  return PROMPT_MODULES.find((m) => m.version === version);
}

/** The shipped prompt version until the gate picks another. */
export const DEFAULT_PROMPT_MODULE: PromptModule = V1;
