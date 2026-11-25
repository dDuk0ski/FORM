import Foundation

#if canImport(FoundationModels)
import FoundationModels
#endif

// The Foundation Models side of the FORM assistant. Nothing in this file imports Expo, so
// the same code compiles into the app (via the podspec) and into the macOS test package
// (Package.swift next to this module), where XCTest can call the real on-device model.
//
// Inputs and outputs cross the bridge as JSON strings. That keeps the Expo layer thin and
// makes "null, never 0" explicit: an unread value is encoded as JSON null.

public enum AssistantAvailability: String {
  case available
  case deviceNotEligible
  case appleIntelligenceNotEnabled
  case modelNotReady
}

public struct AssistantError: Error, CustomStringConvertible {
  public let code: String
  public let message: String

  public var description: String { "\(code): \(message)" }

  static let unavailable = AssistantError(
    code: "ERR_ASSISTANT_UNAVAILABLE",
    message: "The on-device model is not available on this device."
  )
  static func badInput(_ message: String) -> AssistantError {
    AssistantError(code: "ERR_ASSISTANT_BAD_INPUT", message: message)
  }
  static func generation(_ message: String) -> AssistantError {
    AssistantError(code: "ERR_ASSISTANT_GENERATION", message: message)
  }
}

// MARK: - Inputs

public struct DayMacros: Codable, Equatable {
  public var kcal: Double
  public var protein_g: Double
  public var carb_g: Double
  public var fat_g: Double
}

/// The plain day summary the app sends for `summarizeDay`.
public struct DaySummaryInput: Codable, Equatable {
  public var date: String
  public var targets: DayMacros
  public var consumed: DayMacros
  public var remaining: DayMacros
  public var rationale: String
  /// nil means the app does not know yet.
  public var workout_done: Bool?
  public var readiness_score: Double?
}

// MARK: - Prompts

enum Prompts {
  /// OCR text beyond this is dropped so a long receipt cannot blow the ~4k-token context.
  static let maxOcrCharacters = 6000

  // The on-device model is small: it copies numbers well but adds them up badly, and drifts
  // when given every macro. So the prompt carries only pre-phrased facts (calories, protein,
  // training) and one worked example, and the output is a fixed two-sentence form.
  static let summaryInstructions = """
    You are a friendly coach in a nutrition and strength training app. You write a \
    two-sentence note about the user's day.
    Use the numbers exactly as given. Do not calculate anything. If a target is reached, say \
    so and do not tell the user to eat more of it. No medical advice.
    Example facts: Calories left: 400 kcal. Protein left: 30 g. Workout today: not done yet. \
    Readiness: 80 out of 100, good.
    Example note: You have 400 kcal and 30 g of protein left, so a protein-heavy dinner fits \
    well. Readiness looks good, so it's a fine day for your planned session.
    """

  static let labelInstructions = """
    You read the text of a nutrition facts label that was captured with OCR. The text may be \
    out of order or contain OCR mistakes.
    Fill the form with the values printed on the label. Energy is in kcal; convert kJ to kcal \
    only if no kcal value is printed (1 kcal = 4.184 kJ). Sodium is in mg; if only salt in g is \
    printed, sodium mg = salt g * 400.
    If a value is not printed or cannot be read, leave it null. Never write 0 for a value you \
    cannot see; write 0 only when the label prints 0.
    basis is per100g when the column you read is per 100 g or 100 ml, otherwise perServing.
    servingSizeG is the serving size in grams only if the label states grams.
    confidence is how sure you are that the numbers are right, from 0 to 1.
    """

  static let receiptInstructions = """
    You read the text of a grocery receipt that was captured with OCR. The text may be out of \
    order or contain OCR mistakes.
    List only food and drink items. Skip totals, tax, discounts, deposits, bags, payment lines \
    and non-food products.
    name is a short plain food name a person would search for, for example "Greek yogurt" for \
    "GRK YGRT PLN 500G". quantity and unit describe what was bought. Copy weights exactly as \
    printed: "1.32 LB" is quantity 1.32 and unit "lb", "500G" is quantity 500 and unit "g". \
    A line with no weight is quantity 1 (or the printed count) and unit "each". gramsEstimate is your best estimate of the total grams for the line, or null \
    if you cannot estimate it.
    """

  static func summaryPrompt(_ input: DaySummaryInput) -> String {
    let kcal = Int(input.remaining.kcal.rounded())
    let protein = Int(input.remaining.protein_g.rounded())
    let calories =
      kcal > 0
      ? "Calories left: \(kcal) kcal."
      : kcal == 0 ? "Calories: target reached." : "Calories: target reached, \(-kcal) kcal over."
    let proteinFact = protein > 0 ? "Protein left: \(protein) g." : "Protein: target reached."
    let workout: String
    switch input.workout_done {
    case .some(true): workout = "Workout today: done."
    case .some(false): workout = "Workout today: not done yet."
    case .none: workout = "Workout today: unknown."
    }
    let readiness: String
    if let score = input.readiness_score {
      let value = Int(score.rounded())
      let band = value >= 75 ? "good" : value >= 50 ? "normal" : "low"
      readiness = "Readiness: \(value) out of 100, \(band)."
    } else {
      readiness = "Readiness: unknown."
    }
    return "Facts: \(calories) \(proteinFact) \(workout) \(readiness)\nWrite the note."
  }

  // The model rejects text it can't identify as English ("unsupported language"), which
  // all-caps receipt abbreviations trigger. An English sentence around the OCR text fixes it.
  static func labelPrompt(_ text: String) -> String {
    "Here is the OCR text of a nutrition facts label from a food package. Fill the form.\n\n"
      + "Label text:\n\(text)"
  }

  static func receiptPrompt(_ text: String) -> String {
    "Here is the OCR text of a grocery store receipt. List the food items on it.\n\n"
      + "Receipt text:\n\(text)"
  }

  /// Nutrients whose name never appears in the OCR text cannot have been read, so a value
  /// for them is a guess (usually 0) and is dropped to null.
  static let labelKeywords: [String: [String]] = [
    "serving_size_g": ["serving", "portion"],
    "kcal": ["calor", "kcal", "energ", "kj"],
    "protein_g": ["protein"],
    "carb_g": ["carb"],
    "fat_g": ["fat", "lipid"],
    "fiber_g": ["fiber", "fibre"],
    "sodium_mg": ["sodium", "salt"],
  ]

  static func mentions(_ key: String, in text: String) -> Bool {
    let lower = text.lowercased()
    return (labelKeywords[key] ?? []).contains { lower.contains($0) }
  }

  static func clip(_ ocrText: String) -> String {
    let trimmed = ocrText.trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.count > maxOcrCharacters ? String(trimmed.prefix(maxOcrCharacters)) : trimmed
  }
}

// MARK: - Guided generation schemas

#if canImport(FoundationModels)
@available(iOS 26.0, macOS 26.0, *)
@Generable(description: "A two-sentence note about the user's day")
struct GeneratedDayNote {
  @Guide(
    description:
      "One short sentence about what is left to eat today, with protein grams and calories exactly as given"
  )
  var food: String
  @Guide(description: "One short sentence about training today, using the workout and readiness facts")
  var training: String
}

@available(iOS 26.0, macOS 26.0, *)
@Generable
enum GeneratedLabelBasis {
  case per100g
  case perServing
}

@available(iOS 26.0, macOS 26.0, *)
@Generable(description: "Nutrition facts read from a label")
struct GeneratedLabel {
  @Guide(description: "Whether the values are per 100 g or per serving")
  var basis: GeneratedLabelBasis
  @Guide(description: "Serving size in grams, null if not stated in grams")
  var servingSizeG: Double?
  @Guide(description: "Energy in kcal, null if not printed")
  var kcal: Double?
  @Guide(description: "Protein in grams, null if not printed")
  var proteinG: Double?
  @Guide(description: "Total carbohydrate in grams, null if not printed")
  var carbG: Double?
  @Guide(description: "Total fat in grams, null if not printed")
  var fatG: Double?
  @Guide(description: "Dietary fiber in grams, null if not printed")
  var fiberG: Double?
  @Guide(description: "Sodium in milligrams, null if not printed")
  var sodiumMg: Double?
  @Guide(description: "Confidence from 0 to 1 that the values are read correctly")
  var confidence: Double
}

@available(iOS 26.0, macOS 26.0, *)
@Generable(description: "One food line on a grocery receipt")
struct GeneratedReceiptItem {
  @Guide(description: "Short plain food name")
  var name: String
  @Guide(description: "How many units were bought")
  var quantity: Double
  @Guide(description: "Unit such as each, g, kg, lb, oz, ml, l, pack")
  var unit: String
  @Guide(description: "Estimated total grams for the line, null if unknown")
  var gramsEstimate: Double?
}

@available(iOS 26.0, macOS 26.0, *)
@Generable(description: "Food items on a grocery receipt")
struct GeneratedReceipt {
  @Guide(description: "Food and drink items only", .maximumCount(40))
  var items: [GeneratedReceiptItem]
}
#endif

// MARK: - Entry points

public enum AssistantCore {
  public static func availability() -> AssistantAvailability {
    #if canImport(FoundationModels)
    if #available(iOS 26.0, macOS 26.0, *) {
      switch SystemLanguageModel.default.availability {
      case .available:
        return .available
      case .unavailable(let reason):
        switch reason {
        case .deviceNotEligible: return .deviceNotEligible
        case .appleIntelligenceNotEnabled: return .appleIntelligenceNotEnabled
        case .modelNotReady: return .modelNotReady
        @unknown default: return .modelNotReady
        }
      }
    }
    #endif
    // Older iOS, or an SDK without Foundation Models: the model can never run here.
    return .deviceNotEligible
  }

  /// `inputJson` is a `DaySummaryInput`. Returns 2–3 sentences of plain text.
  public static func summarizeDay(inputJson: String) async throws -> String {
    let input: DaySummaryInput
    do {
      input = try JSONDecoder().decode(DaySummaryInput.self, from: Data(inputJson.utf8))
    } catch {
      throw AssistantError.badInput("Day summary input is not valid: \(error)")
    }
    #if canImport(FoundationModels)
    if #available(iOS 26.0, macOS 26.0, *) {
      try requireAvailable()
      let session = LanguageModelSession(instructions: Prompts.summaryInstructions)
      let response = try await run {
        try await session.respond(
          to: Prompts.summaryPrompt(input),
          generating: GeneratedDayNote.self,
          options: GenerationOptions(temperature: 0.3)
        )
      }
      let note = response.content
      return [note.food, note.training]
        .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
        .filter { !$0.isEmpty }
        .joined(separator: " ")
    }
    #endif
    throw AssistantError.unavailable
  }

  /// Returns a JSON object with snake_case keys; unread values are JSON null.
  public static func parseNutritionLabel(ocrText: String) async throws -> String {
    let text = Prompts.clip(ocrText)
    guard !text.isEmpty else { throw AssistantError.badInput("OCR text is empty.") }
    #if canImport(FoundationModels)
    if #available(iOS 26.0, macOS 26.0, *) {
      try requireAvailable()
      let session = LanguageModelSession(instructions: Prompts.labelInstructions)
      let response = try await run {
        try await session.respond(
          to: Prompts.labelPrompt(text),
          generating: GeneratedLabel.self,
          options: GenerationOptions(temperature: 0)
        )
      }
      let label = response.content
      let values: [String: Double?] = [
        // A 0 g serving is never real.
        "serving_size_g": label.servingSizeG == 0 ? nil : label.servingSizeG,
        "kcal": label.kcal,
        "protein_g": label.proteinG,
        "carb_g": label.carbG,
        "fat_g": label.fatG,
        "fiber_g": label.fiberG,
        "sodium_mg": label.sodiumMg,
      ]
      var object: [String: Any] = [
        "basis": label.basis == .per100g ? "per_100g" : "per_serving",
        "confidence": min(max(label.confidence, 0), 1),
      ]
      for (key, value) in values {
        object[key] = Prompts.mentions(key, in: text) ? json(value) : NSNull()
      }
      return try encode(object)
    }
    #endif
    throw AssistantError.unavailable
  }

  /// Returns a JSON array of `{ name, quantity, unit, grams_estimate }`.
  public static func parseReceipt(ocrText: String) async throws -> String {
    let text = Prompts.clip(ocrText)
    guard !text.isEmpty else { throw AssistantError.badInput("OCR text is empty.") }
    #if canImport(FoundationModels)
    if #available(iOS 26.0, macOS 26.0, *) {
      try requireAvailable()
      let session = LanguageModelSession(instructions: Prompts.receiptInstructions)
      let response = try await run {
        try await session.respond(
          to: Prompts.receiptPrompt(text),
          generating: GeneratedReceipt.self,
          options: GenerationOptions(temperature: 0)
        )
      }
      let items: [[String: Any]] = response.content.items.map { item in
        [
          "name": item.name,
          "quantity": item.quantity,
          "unit": item.unit,
          "grams_estimate": json(item.gramsEstimate),
        ]
      }
      return try encode(items)
    }
    #endif
    throw AssistantError.unavailable
  }

  // MARK: Helpers

  private static func json(_ value: Double?) -> Any {
    guard let value, value.isFinite else { return NSNull() }
    return value
  }

  private static func encode(_ value: Any) throws -> String {
    let data = try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys])
    return String(decoding: data, as: UTF8.self)
  }

  #if canImport(FoundationModels)
  @available(iOS 26.0, macOS 26.0, *)
  private static func requireAvailable() throws {
    if case .available = SystemLanguageModel.default.availability { return }
    throw AssistantError.unavailable
  }

  /// Turns Foundation Models errors into codes the TypeScript side can branch on.
  @available(iOS 26.0, macOS 26.0, *)
  private static func run<T>(_ body: () async throws -> T) async throws -> T {
    do {
      return try await body()
    } catch let error as LanguageModelSession.GenerationError {
      switch error {
      case .exceededContextWindowSize:
        throw AssistantError(code: "ERR_ASSISTANT_TOO_LONG", message: "Input is too long.")
      case .guardrailViolation, .refusal:
        throw AssistantError(code: "ERR_ASSISTANT_REFUSED", message: "The model declined.")
      case .unsupportedLanguageOrLocale:
        throw AssistantError(
          code: "ERR_ASSISTANT_LANGUAGE", message: "The text is in a language the model can't read.")
      case .assetsUnavailable:
        throw AssistantError.unavailable
      default:
        throw AssistantError.generation(error.localizedDescription)
      }
    }
  }
  #endif
}
