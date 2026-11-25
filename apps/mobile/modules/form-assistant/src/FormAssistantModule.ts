import { NativeModule, requireOptionalNativeModule } from 'expo';

/** What `SystemLanguageModel.default.availability` reports, mapped to strings. */
export type NativeAvailability =
  'available' | 'deviceNotEligible' | 'appleIntelligenceNotEnabled' | 'modelNotReady';

// The raw bridge. JSON goes across as strings; src/lib/assistant.ts parses and validates it.
// Call through that wrapper, not this module directly.
declare class FormAssistantNativeModule extends NativeModule {
  availability(): NativeAvailability;
  /** `inputJson` is a JSON-encoded day summary. Resolves to 2–3 sentences. */
  summarizeDay(inputJson: string): Promise<string>;
  /** Resolves to a JSON object; unread values are null. */
  parseNutritionLabel(ocrText: string): Promise<string>;
  /** Resolves to a JSON array of receipt lines. */
  parseReceipt(ocrText: string): Promise<string>;
  /** Vision OCR on a local file:// image. One visual row per line. */
  recognizeText(imageUri: string): Promise<string>;
}

// Optional: Expo Go, Jest and builds without the module get null instead of a crash.
export default requireOptionalNativeModule<FormAssistantNativeModule>('FormAssistant');
