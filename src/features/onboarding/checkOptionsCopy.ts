/** Copy for the screen shown when private on-device AI isn't ready (design plan §2). */

/** Chrome blocks links to chrome:// pages, so the reporter copies this address. */
export const ENABLE_FLAG_URL = 'chrome://flags/#prompt-api-for-gemini-nano-multimodal-input';

export const SAMPLE_CLOUD_NOTE = 'The sample is fictional, so it is safe to analyze in the cloud.';

export const CLOUD_DISABLED_NOTE =
  'Checking in the cloud is temporarily unavailable. The basic private check still works.';

export const CLOUD_CHECKING_NOTE = 'Checking whether the cloud check is available.';

export const OWN_TEXT_ACK_LABEL =
  'I understand that my original text will leave this device for this check.';

/**
 * The Gemini API terms that apply to the free tier this project uses (Firebase AI Logic on
 * the Spark plan defers to them; see "Unpaid Services", verified 2026-11-16).
 */
export const GEMINI_API_TERMS_URL = 'https://ai.google.dev/gemini-api/terms';

/** What the reporter must understand before their own text goes to the cloud. */
export const OWN_TEXT_RISKS: readonly string[] = [
  'Your report, exactly as it is written now, leaves this device.',
  "It goes to Google's Gemini API through Firebase AI Logic, protected by App Check, only to run this check.",
  'Traceless stores nothing: not your text and not the results.',
  'This check uses the free tier of the Gemini API. Under its terms, Google may use your text to improve its products, and human reviewers may read it. Google advises against sending sensitive or personal information.',
  'This agreement covers this one check. If you edit your text, you will be asked again.',
];

export const GEMINI_API_TERMS_LABEL = 'Read the Gemini API terms (opens in a new tab)';
