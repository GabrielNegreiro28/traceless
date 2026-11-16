/**
 * Central inference policy (PLANO §3.3, CLAUDE.md rule 4): the ONLY place that decides
 * where each AI task may run and which class of data it may see.
 *
 * Mode strings mirror the runtime values of `InferenceMode` in `firebase/ai` (checked by
 * a type-level parity test), so the infrastructure model factory maps them 1:1 without
 * this layer importing the Firebase SDK.
 */

export const INFERENCE_MODES = {
  PREFER_ON_DEVICE: 'prefer_on_device',
  ONLY_ON_DEVICE: 'only_on_device',
  ONLY_IN_CLOUD: 'only_in_cloud',
  PREFER_IN_CLOUD: 'prefer_in_cloud',
} as const;

export type InferenceModeName = (typeof INFERENCE_MODES)[keyof typeof INFERENCE_MODES];

/**
 * Privacy class of the text a task receives (matches the branded text types):
 * RAW = what the reporter typed; CONSENTED_RAW = raw text the reporter explicitly agreed
 * to send to the cloud; SANITIZED = text the reporter reviewed and approved.
 */
export type DataClass = 'RAW' | 'CONSENTED_RAW' | 'SANITIZED';

export type AiTool = 'googleSearch';

export const AI_TASKS = [
  'identityScan',
  'styleNeutralize',
  'structureReport',
  'adviseRights',
  'triageCase',
  'draftReply',
  'caseChat',
  'identityScanConsented',
] as const;

export type AiTask = (typeof AI_TASKS)[number];

/**
 * Modes a data class may use. RAW text never leaves the device, so its only allowed mode
 * is ONLY_ON_DEVICE (PREFER_ON_DEVICE would silently fall back to the cloud).
 * CONSENTED_RAW exists only for the explicit cloud path the reporter agreed to, so it is
 * pinned to ONLY_IN_CLOUD (no hybrid mode whose routing the consent screen didn't describe).
 */
export type AllowedModes<D extends DataClass> = D extends 'RAW'
  ? typeof INFERENCE_MODES.ONLY_ON_DEVICE
  : D extends 'CONSENTED_RAW'
    ? typeof INFERENCE_MODES.ONLY_IN_CLOUD
    : InferenceModeName;

/** One routing rule. Distributes over DataClass so `mode` is checked against `dataClass`. */
export type PolicyRow<D extends DataClass = DataClass> = D extends DataClass
  ? {
      readonly dataClass: D;
      readonly mode: AllowedModes<D>;
      readonly tools: readonly AiTool[];
      readonly multiTurn: boolean;
      /** Short English explanation; rendered in the README routing table. */
      readonly rationale: string;
    }
  : never;

export const INFERENCE_POLICY = {
  identityScan: {
    dataClass: 'RAW',
    mode: 'only_on_device',
    tools: [],
    multiTurn: false,
    rationale:
      'Raw report text is the most dangerous data; a silent cloud fallback would be a privacy failure.',
  },
  styleNeutralize: {
    dataClass: 'RAW',
    mode: 'only_on_device',
    tools: [],
    multiTurn: false,
    rationale: 'Rewriting the writing style still reads the raw report, so it stays on the device.',
  },
  structureReport: {
    dataClass: 'SANITIZED',
    mode: 'prefer_on_device',
    tools: [],
    multiTurn: false,
    rationale: 'Approved text is safe to share; on-device is free and fast, the cloud is a backup.',
  },
  adviseRights: {
    dataClass: 'SANITIZED',
    mode: 'only_in_cloud',
    tools: ['googleSearch'],
    multiTurn: false,
    rationale: 'Grounding legal guidance with Google Search is only available in the cloud.',
  },
  triageCase: {
    dataClass: 'SANITIZED',
    mode: 'only_in_cloud',
    tools: [],
    multiTurn: false,
    rationale: 'Handler-side triage needs long context over approved text only.',
  },
  draftReply: {
    dataClass: 'SANITIZED',
    mode: 'only_in_cloud',
    tools: [],
    multiTurn: false,
    rationale: 'Handler-side reply drafting needs long context over approved text only.',
  },
  caseChat: {
    dataClass: 'SANITIZED',
    mode: 'only_in_cloud',
    tools: [],
    multiTurn: true,
    rationale: 'Multi-turn chat is not supported by the on-device model.',
  },
  identityScanConsented: {
    dataClass: 'CONSENTED_RAW',
    mode: 'only_in_cloud',
    tools: [],
    multiTurn: false,
    rationale: 'Only with explicit consent for one scan, when this device cannot run on-device AI.',
  },
} as const satisfies Readonly<Record<AiTask, PolicyRow>>;

export type InferencePolicy = typeof INFERENCE_POLICY;

/**
 * The tasks whose rows read data of class `D`. Adapters type their task by this, so a cloud
 * factory for consented text can only ever be configured with a CONSENTED_RAW task.
 */
export type TaskOfDataClass<D extends DataClass> = {
  [K in AiTask]: InferencePolicy[K]['dataClass'] extends D ? K : never;
}[AiTask];

/**
 * The cloud model for every request that may run in the cloud (design plan §3: a Gemini 3.x
 * model, never 2.5). Pinned here rather than read from Remote Config, so a remote switch can
 * never change which model receives consented raw text.
 */
export const CLOUD_MODEL_NAME = 'gemini-3.5-flash-lite';

/** The routing rule for a task. */
export function policyFor<T extends AiTask>(task: T): InferencePolicy[T] {
  return INFERENCE_POLICY[task];
}
