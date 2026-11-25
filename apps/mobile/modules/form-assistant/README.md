# form-assistant

Local Expo module for FORM's on-device assistant. It wraps Apple's Foundation Models (iOS 26+,
Apple Intelligence) for text and Vision for OCR. Nothing leaves the phone and there is no API
key.

Call it through `src/lib/assistant.ts`, not directly. The wrapper validates what comes back
and handles the fallback.

## API

| Native (`FormAssistant`)                                                                                  | Wrapper (`@/lib/assistant`)                                                      | Needs Apple Intelligence |
| --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------ |
| `availability()` → `available` \| `deviceNotEligible` \| `appleIntelligenceNotEnabled` \| `modelNotReady` | `getAvailability()` adds `unsupported` (module not in this build: Expo Go, Jest) | —                        |
| `summarizeDay(json)` → 2 sentences                                                                        | `summarizeDay(input)` → `string \| null`                                         | yes                      |
| `parseNutritionLabel(ocrText)` → JSON                                                                     | `parseNutritionLabel(ocrText)` → `NutritionLabel \| null`                        | yes                      |
| `parseReceipt(ocrText)` → JSON                                                                            | `parseReceipt(ocrText)` → `ReceiptLine[] \| null`                                | yes                      |
| `recognizeText(fileUri)` → text, one row per line                                                         | `recognizeText(fileUri)` → `string \| null`                                      | no (Vision only)         |

JSON crosses the bridge as strings, so an unread value is an explicit `null`.

- **Label**: `basis` (`per_100g` / `per_serving`), `serving_size_g`, `kcal`, `protein_g`,
  `carb_g`, `fat_g`, `fiber_g`, `sodium_mg`, `confidence` (0–1). A value is null when it isn't
  printed. As a backstop, any nutrient whose name doesn't appear in the OCR text is forced to
  null (the model likes to fill gaps with 0). `labelPer100g()` rescales to per 100 g for
  `food_nutrients`.
- **Receipt**: `[{ name, quantity, unit, grams_estimate }]`, food lines only. For mass units
  (g, kg, oz, lb) the wrapper replaces the model's gram guess with the exact conversion.
  Grams stay the only internal unit; `unit` is for display.

**Fallback**: every model call in the wrapper resolves to `null` instead of throwing when the
model is unavailable or a call fails (refusal, guardrail, too long, unsupported language).
`null` means "no assistant": hide the card, or open the manual form.

## Layout

```
ios/FormAssistantModule.swift   Expo bridge (thin)
ios/Core/AssistantCore.swift    prompts, @Generable schemas, availability, error mapping
ios/Core/TextRecognizer.swift   VNRecognizeTextRequest + row grouping
Package.swift, Tests/           macOS test package for ios/Core (not used by the app)
```

`ios/Core` imports nothing from Expo, so the same files build into the app via the podspec
and into a SwiftPM package for XCTest.

## Tests

```bash
# Swift: prompt building, OCR row grouping, and the real model when this Mac has
# Apple Intelligence on (those tests skip otherwise). macOS 26+.
cd apps/mobile/modules/form-assistant && swift test

# TypeScript wrapper (native module mocked)
cd apps/mobile && npm test
```

## Manual test on an iPhone 15 Pro or newer

Needs a dev build (`eas build --profile development` or `npx expo run:ios --device`), iOS 26+,
Apple Intelligence on in Settings, and the model downloaded.

1. Open Today. A "Your day so far" card shows two sentences under the targets card, quoting the
   calories and protein left.
2. Turn Apple Intelligence off in Settings, reopen the app: the card is gone and nothing else
   changes.
3. On an older phone (or iOS < 26) the app runs normally with no card.

Label and receipt scans have no screen yet; they're wired up in a later PR.
