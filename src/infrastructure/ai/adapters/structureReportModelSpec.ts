import {
  buildStructureInitialPrompts,
  buildStructureUserPrompt,
  STRUCTURE_REPORT_SYSTEM_PROMPT,
} from '../../../ai/prompts/structureReport.v1';
import { buildStructureReportSchema } from '../../../ai/schemas/structureReport';
import type { HybridModelSpec } from '../hybridModel';

/** The hybrid model configuration for structureReport.v1 (fresh objects on every call). */
export function structureReportModelSpec(): HybridModelSpec {
  return {
    task: 'structureReport',
    systemPrompt: STRUCTURE_REPORT_SYSTEM_PROMPT,
    initialPrompts: buildStructureInitialPrompts(),
    responseSchema: buildStructureReportSchema(),
    buildUserPrompt: buildStructureUserPrompt,
  };
}
