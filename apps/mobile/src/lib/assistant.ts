import FormAssistant, { type NativeAvailability } from '../../modules/form-assistant';

import type { Macros } from '@/types/api';
import type { NutrientValue } from '@/types/food';

// Typed wrapper over the on-device assistant (modules/form-assistant): Apple's Foundation
// Models for text, Vision for OCR. Screens call this file, never the native module.
//
// Fallback rule: the app must work on phones without Apple Intelligence. Every model call
// resolves to null when the model is unavailable or the call fails, and callers treat null
// as "no assistant": hide the card, or open the manual entry form. Nothing here throws.
//
// OCR (recognizeText) only needs Vision, so it works on every supported iPhone even when
// the model does not. It still resolves to null when the native module is missing.

/** `unsupported`: the native module is not in this build (Expo Go, Jest, web). */
export type AssistantAvailability = NativeAvailability | 'unsupported';

const NATIVE_AVAILABILITIES: readonly NativeAvailability[] = [
  'available',
  'deviceNotEligible',
  'appleIntelligenceNotEnabled',
  'modelNotReady',
];

export function getAvailability(): AssistantAvailability {
  if (!FormAssistant) return 'unsupported';
  try {
    const value = FormAssistant.availability();
    return NATIVE_AVAILABILITIES.includes(value) ? value : 'deviceNotEligible';
  } catch {
    return 'deviceNotEligible';
  }
}

export function isAssistantAvailable(): boolean {
  return getAvailability() === 'available';
}

// ---------------------------------------------------------------------------
// Day summary

export interface DaySummaryInput {
  date: string;
  targets: Macros;
  consumed: Macros;
  remaining: Macros;
  rationale: string;
  /** Null when the app does not know yet. */
  workout_done: boolean | null;
  readiness_score?: number | null;
}

const MAX_SUMMARY_SENTENCES = 3;

/** 2–3 short sentences about the day, or null when the assistant can't help. */
export async function summarizeDay(input: DaySummaryInput): Promise<string | null> {
  if (!FormAssistant || !isAssistantAvailable()) return null;
  try {
    const text = (await FormAssistant.summarizeDay(JSON.stringify(input))).trim();
    if (!text) return null;
    const sentences = text.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) ?? [text];
    return sentences.slice(0, MAX_SUMMARY_SENTENCES).join('').trim();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Nutrition label

export type LabelBasis = 'per_100g' | 'per_serving';

/** What the model read off a label. Every value it could not read is null, never 0. */
export interface NutritionLabel {
  basis: LabelBasis;
  serving_size_g: NutrientValue;
  kcal: NutrientValue;
  protein_g: NutrientValue;
  carb_g: NutrientValue;
  fat_g: NutrientValue;
  fiber_g: NutrientValue;
  sodium_mg: NutrientValue;
  /** 0 to 1, the model's own estimate. Show the confirm form either way. */
  confidence: number;
}

type LabelNutrientKey = Exclude<keyof NutritionLabel, 'basis' | 'confidence'>;

// A value whose nutrient name never appears in the OCR text cannot have been read off the
// label, so it is dropped to null rather than trusted. This catches the model filling a
// gap with a guess (often 0).
const LABEL_KEYWORDS: Record<LabelNutrientKey, RegExp> = {
  serving_size_g: /serving|portion|serv\.?\s*size/i,
  kcal: /calor|kcal|energ|\bkj\b/i,
  protein_g: /protein/i,
  carb_g: /carb/i,
  fat_g: /\bfat\b|fat\s|lipid/i,
  fiber_g: /fib(er|re)/i,
  sodium_mg: /sodium|salt/i,
};

/** Finite and non-negative, or null. Strings like "12" are accepted; anything else is null. */
export function toNutrient(value: unknown): NutrientValue {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null;
}

/** Validates the native JSON. Exported for tests. */
export function sanitizeLabel(raw: unknown, ocrText: string): NutritionLabel | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const read = (key: LabelNutrientKey): NutrientValue =>
    LABEL_KEYWORDS[key].test(ocrText) ? toNutrient(obj[key]) : null;
  const confidence = toNutrient(obj.confidence);
  return {
    basis: obj.basis === 'per_100g' ? 'per_100g' : 'per_serving',
    serving_size_g: read('serving_size_g') || null, // a 0 g serving is never real
    kcal: read('kcal'),
    protein_g: read('protein_g'),
    carb_g: read('carb_g'),
    fat_g: read('fat_g'),
    fiber_g: read('fiber_g'),
    sodium_mg: read('sodium_mg'),
    confidence: confidence === null ? 0 : Math.min(confidence, 1),
  };
}

/** Reads a nutrition label from OCR text. Null means: show the manual form. */
export async function parseNutritionLabel(ocrText: string): Promise<NutritionLabel | null> {
  if (!FormAssistant || !isAssistantAvailable() || !ocrText.trim()) return null;
  try {
    return sanitizeLabel(JSON.parse(await FormAssistant.parseNutritionLabel(ocrText)), ocrText);
  } catch {
    return null;
  }
}

/**
 * The same label scaled to per 100 g, which is how `food_nutrients` stores amounts. Null
 * when a per-serving label has no serving size in grams (the user must enter it). Unknown
 * values stay null.
 */
export function labelPer100g(label: NutritionLabel): NutritionLabel | null {
  if (label.basis === 'per_100g') return label;
  const serving = label.serving_size_g;
  if (!serving) return null;
  const scale = (v: NutrientValue): NutrientValue =>
    v === null ? null : Math.round((v * 100 * 10) / serving) / 10;
  return {
    ...label,
    basis: 'per_100g',
    kcal: scale(label.kcal),
    protein_g: scale(label.protein_g),
    carb_g: scale(label.carb_g),
    fat_g: scale(label.fat_g),
    fiber_g: scale(label.fiber_g),
    sodium_mg: scale(label.sodium_mg),
  };
}

// ---------------------------------------------------------------------------
// Receipt

export interface ReceiptLine {
  name: string;
  quantity: number;
  /** As printed or inferred: "each", "g", "kg", "lb", "pack"… Display only. */
  unit: string;
  /** Total grams for the line; null when nobody can tell. Grams are the internal unit. */
  grams_estimate: number | null;
}

const GRAMS_PER_UNIT: Record<string, number> = {
  g: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  oz: 28.3495,
  lb: 453.592,
  lbs: 453.592,
};

/** Validates the native JSON. A mass unit wins over the model's gram guess. Exported for tests. */
export function sanitizeReceipt(raw: unknown): ReceiptLine[] | null {
  if (!Array.isArray(raw)) return null;
  const lines: ReceiptLine[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const obj = entry as Record<string, unknown>;
    const name = typeof obj.name === 'string' ? obj.name.trim() : '';
    if (!name) continue;
    const quantity = toNutrient(obj.quantity) || 1;
    const unit =
      typeof obj.unit === 'string' && obj.unit.trim() ? obj.unit.trim().toLowerCase() : 'each';
    const perUnit = GRAMS_PER_UNIT[unit];
    const grams =
      perUnit !== undefined ? quantity * perUnit : toNutrient(obj.grams_estimate) || null;
    lines.push({
      name,
      quantity,
      unit,
      grams_estimate: grams === null ? null : Math.round(grams),
    });
  }
  return lines;
}

/** Food lines from receipt OCR text. Null means: let the user add items by hand. */
export async function parseReceipt(ocrText: string): Promise<ReceiptLine[] | null> {
  if (!FormAssistant || !isAssistantAvailable() || !ocrText.trim()) return null;
  try {
    return sanitizeReceipt(JSON.parse(await FormAssistant.parseReceipt(ocrText)));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// OCR

/** Vision OCR on a local image URI. Does not need Apple Intelligence. */
export async function recognizeText(imageUri: string): Promise<string | null> {
  if (!FormAssistant) return null;
  try {
    const text = (await FormAssistant.recognizeText(imageUri)).trim();
    return text || null;
  } catch {
    return null;
  }
}
