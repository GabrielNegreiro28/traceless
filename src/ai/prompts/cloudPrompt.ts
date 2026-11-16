import type { Content, LanguageModelMessage } from 'firebase/ai';

/** One prompt version in the shape of a cloud request (Gemini `systemInstruction` + turns). */
export interface CloudPrompt {
  readonly systemInstruction: string;
  /** The few-shot pairs as alternating user/model turns, sent before the report chunk. */
  readonly fewShots: readonly Content[];
}

function textOf(message: LanguageModelMessage): string {
  return message.content.map((part) => (typeof part.value === 'string' ? part.value : '')).join('');
}

function toTurn(message: LanguageModelMessage): Content {
  return {
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ type: 'text', text: textOf(message) }],
  };
}

/**
 * The SAME prompt the on-device model gets (its Prompt API `initialPrompts`), converted for
 * the cloud: the system messages become `systemInstruction`, every user/assistant message a
 * user/model turn in order. One prompt source keeps consented cloud results comparable with
 * on-device ones (docs/design/fase3-product-plan.md §2b).
 */
export function toCloudPrompt(initialPrompts: readonly LanguageModelMessage[]): CloudPrompt {
  const system = initialPrompts.filter((message) => message.role === 'system');
  const turns = initialPrompts.filter((message) => message.role !== 'system');
  return {
    systemInstruction: system.map(textOf).join('\n'),
    fewShots: turns.map(toTurn),
  };
}
