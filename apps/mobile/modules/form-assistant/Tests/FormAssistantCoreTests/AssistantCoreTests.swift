import CoreGraphics
import Foundation
import XCTest

@testable import FormAssistantCore

// Pure tests run everywhere. The model tests call Apple's on-device model for real and skip
// themselves when this Mac reports it unavailable (no Apple Intelligence, model not ready).
final class AssistantCoreTests: XCTestCase {
  let day = DaySummaryInput(
    date: "2026-10-09",
    targets: DayMacros(kcal: 2680, protein_g: 175, carb_g: 300, fat_g: 85),
    consumed: DayMacros(kcal: 2068, protein_g: 127, carb_g: 242, fat_g: 61),
    remaining: DayMacros(kcal: 612, protein_g: 48, carb_g: 58, fat_g: 24),
    rationale: "Weight trend fell 0.4 kg over 14 days.",
    workout_done: nil,
    readiness_score: 71
  )

  static let labelText = """
    Nutrition Facts
    8 servings per container
    Serving size 2/3 cup (55g)
    Amount per serving
    Calories 230
    Total Fat 8g 10%
    Saturated Fat 1g 5%
    Trans Fat 0g
    Cholesterol 0mg 0%
    Total Carbohydrate 37g 13%
    Total Sugars 12g
    Protein 3g
    """

  static let receiptText = """
    FRESH MART #212
    GRK YGRT PLN 500G      4.99
    BANANAS 1.32 LB @ 0.59  0.78
    CHKN BRST BNLS 1.5LB   8.97
    PAPER TOWELS           5.49
    SUBTOTAL              20.23
    TAX                    0.44
    TOTAL                 20.67
    VISA ****1234
    """

  // MARK: Pure

  func testSummaryPromptPhrasesTheFacts() {
    XCTAssertEqual(
      Prompts.summaryPrompt(day),
      "Facts: Calories left: 612 kcal. Protein left: 48 g. Workout today: unknown. "
        + "Readiness: 71 out of 100, normal.\nWrite the note.")
    var over = day
    over.remaining = DayMacros(kcal: -150.4, protein_g: -3, carb_g: 0, fat_g: 5)
    over.workout_done = true
    over.readiness_score = nil
    XCTAssertEqual(
      Prompts.summaryPrompt(over),
      "Facts: Calories: target reached, 150 kcal over. Protein: target reached. "
        + "Workout today: done. Readiness: unknown.\nWrite the note.")
  }

  func testLabelKeywordGuard() {
    XCTAssertTrue(Prompts.mentions("protein_g", in: Self.labelText))
    XCTAssertTrue(Prompts.mentions("kcal", in: Self.labelText))
    XCTAssertFalse(Prompts.mentions("sodium_mg", in: Self.labelText))
    XCTAssertFalse(Prompts.mentions("fiber_g", in: Self.labelText))
    XCTAssertTrue(Prompts.mentions("sodium_mg", in: "Salt 0.5 g"))
  }

  func testDayInputDecodesTheJsonTheAppSends() throws {
    let json = """
      {"date":"2026-10-09","targets":{"kcal":2680,"protein_g":175,"carb_g":300,"fat_g":85},
       "consumed":{"kcal":2068,"protein_g":127,"carb_g":242,"fat_g":61},
       "remaining":{"kcal":612,"protein_g":48,"carb_g":58,"fat_g":24},
       "rationale":"Weight trend fell 0.4 kg over 14 days.","workout_done":null,"readiness_score":71}
      """
    XCTAssertEqual(try JSONDecoder().decode(DaySummaryInput.self, from: Data(json.utf8)), day)
  }

  func testBadDayInputThrowsBadInput() async {
    do {
      _ = try await AssistantCore.summarizeDay(inputJson: "{}")
      XCTFail("expected a throw")
    } catch let error as AssistantError {
      XCTAssertEqual(error.code, "ERR_ASSISTANT_BAD_INPUT")
    } catch {
      XCTFail("unexpected \(error)")
    }
  }

  func testOcrClipKeepsPromptsInsideTheContext() {
    let long = String(repeating: "A", count: 20_000)
    XCTAssertEqual(Prompts.clip(long).count, Prompts.maxOcrCharacters)
    XCTAssertEqual(Prompts.clip("  hi \n"), "hi")
  }

  func testJoinRowsGroupsFragmentsOnTheSameLine() {
    // Vision boxes: origin bottom-left. "Protein" and "3g" share a row; "Calories 230" is above.
    let fragments = [
      RecognizedFragment(text: "3g", box: CGRect(x: 0.7, y: 0.40, width: 0.1, height: 0.04)),
      RecognizedFragment(text: "Protein", box: CGRect(x: 0.1, y: 0.41, width: 0.3, height: 0.04)),
      RecognizedFragment(text: "Calories 230", box: CGRect(x: 0.1, y: 0.60, width: 0.5, height: 0.05)),
      RecognizedFragment(text: "  ", box: CGRect(x: 0.1, y: 0.2, width: 0.1, height: 0.04)),
    ]
    XCTAssertEqual(TextRecognizer.joinRows(fragments), "Calories 230\nProtein 3g")
  }

  func testRecognizeTextRejectsRemoteUris() {
    XCTAssertThrowsError(try TextRecognizer.recognizeText(imageUri: "https://example.com/a.jpg"))
    XCTAssertThrowsError(try TextRecognizer.recognizeText(imageUri: "file:///does/not/exist.jpg"))
  }

  func testAvailabilityIsOneOfTheFourStates() {
    let value = AssistantCore.availability().rawValue
    XCTAssertTrue(
      ["available", "deviceNotEligible", "appleIntelligenceNotEnabled", "modelNotReady"]
        .contains(value))
    print("[FormAssistant] availability on this machine: \(value)")
  }

  // MARK: Real model (skips without Apple Intelligence)

  private func requireModel() throws {
    let state = AssistantCore.availability()
    try XCTSkipUnless(state == .available, "On-device model unavailable here: \(state.rawValue)")
  }

  func testModelSummarizesDay() async throws {
    try requireModel()
    let json = String(decoding: try JSONEncoder().encode(day), as: UTF8.self)
    let text = try await AssistantCore.summarizeDay(inputJson: json)
    print("[FormAssistant] summary: \(text)")
    XCTAssertFalse(text.isEmpty)
    XCTAssertLessThan(text.count, 400)
    XCTAssertTrue(text.contains("48"), "protein left should be quoted: \(text)")
  }

  func testModelParsesLabelWithNullsForMissingValues() async throws {
    try requireModel()
    let json = try await AssistantCore.parseNutritionLabel(ocrText: Self.labelText)
    print("[FormAssistant] label: \(json)")
    let obj = try XCTUnwrap(
      JSONSerialization.jsonObject(with: Data(json.utf8)) as? [String: Any])
    XCTAssertEqual(obj["basis"] as? String, "per_serving")
    XCTAssertEqual(obj["kcal"] as? Double, 230)
    XCTAssertEqual(obj["protein_g"] as? Double, 3)
    XCTAssertEqual(obj["fat_g"] as? Double, 8)
    XCTAssertEqual(obj["carb_g"] as? Double, 37)
    XCTAssertEqual(obj["serving_size_g"] as? Double, 55)
    // Fiber and sodium are not on this label: null, never 0.
    XCTAssertTrue(obj["fiber_g"] is NSNull)
    XCTAssertTrue(obj["sodium_mg"] is NSNull)
    for key in ["kcal", "protein_g", "carb_g", "fat_g", "fiber_g", "sodium_mg", "serving_size_g"] {
      XCTAssertTrue(obj.keys.contains(key), "missing \(key)")
    }
  }

  func testModelParsesReceiptFoodLinesOnly() async throws {
    try requireModel()
    let json = try await AssistantCore.parseReceipt(ocrText: Self.receiptText)
    print("[FormAssistant] receipt: \(json)")
    let items = try XCTUnwrap(
      JSONSerialization.jsonObject(with: Data(json.utf8)) as? [[String: Any]])
    let names = items.compactMap { ($0["name"] as? String)?.lowercased() }
    XCTAssertTrue(names.contains { $0.contains("yogurt") }, "\(names)")
    XCTAssertTrue(names.contains { $0.contains("banana") }, "\(names)")
    XCTAssertFalse(names.contains { $0.contains("total") || $0.contains("tax") }, "\(names)")
    for item in items {
      XCTAssertNotNil(item["quantity"] as? Double)
      XCTAssertNotNil(item["unit"] as? String)
      XCTAssertTrue(item.keys.contains("grams_estimate"))
    }
  }
}
