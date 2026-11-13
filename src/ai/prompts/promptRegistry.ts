import { buildIdentityScanSchema } from '../schemas/identityScan';
import {
  IDENTITY_SCAN_PROMPT_VERSION,
  buildInitialPrompts,
  buildUserPrompt,
} from './identityScan.v1';
import type { PromptModule } from './promptModule';

const V1: PromptModule = {
  version: IDENTITY_SCAN_PROMPT_VERSION,
  buildUserPrompt,
  buildInitialPrompts,
  buildSchema: buildIdentityScanSchema,
};

/** Register a new prompt version here (promptVersion -> module); nothing else changes. */
const PROMPT_MODULES: readonly PromptModule[] = [V1];

export function getPromptModule(version: string): PromptModule | undefined {
  return PROMPT_MODULES.find((m) => m.version === version);
}

export const DEFAULT_PROMPT_MODULE: PromptModule = V1;
