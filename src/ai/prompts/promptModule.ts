import type { LanguageModelMessage, ObjectSchemaRequest } from 'firebase/ai';
import type { RawText } from '../../domain/text/brandedText';
import type { ModelFindingCategory } from '../schemas/identityScan';

/** Everything that differs between identity-scan prompt versions (v1, v2, ...). */
export interface PromptModule {
  readonly version: string;
  readonly buildUserPrompt: (chunk: RawText) => RawText;
  readonly buildInitialPrompts: (
    categories: readonly ModelFindingCategory[],
  ) => LanguageModelMessage[];
  readonly buildSchema: (categories: readonly ModelFindingCategory[]) => ObjectSchemaRequest;
}
