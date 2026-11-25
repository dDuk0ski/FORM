import CoreGraphics
import CoreText
import Foundation
import ImageIO
import UniformTypeIdentifiers
import XCTest

@testable import FormAssistantCore

// Runs real Vision OCR on a label image drawn in the test, then (if the model is available)
// feeds the OCR text to parseNutritionLabel: the same OCR-then-model path the app uses.
final class TextRecognizerTests: XCTestCase {
  private func renderLabel(_ rows: [(String, String)]) throws -> URL {
    let width = 800, rowHeight = 60, height = rowHeight * (rows.count + 1)
    let ctx = try XCTUnwrap(
      CGContext(
        data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue))
    ctx.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
    ctx.fill(CGRect(x: 0, y: 0, width: width, height: height))
    let font = CTFontCreateWithName("Helvetica" as CFString, 34, nil)
    func draw(_ text: String, x: CGFloat, y: CGFloat) {
      let attributed = NSAttributedString(
        string: text,
        attributes: [
          NSAttributedString.Key(kCTFontAttributeName as String): font,
          NSAttributedString.Key(kCTForegroundColorAttributeName as String): CGColor(
            red: 0, green: 0, blue: 0, alpha: 1),
        ])
      ctx.textPosition = CGPoint(x: x, y: y)
      CTLineDraw(CTLineCreateWithAttributedString(attributed), ctx)
    }
    for (index, row) in rows.enumerated() {
      let y = CGFloat(height - rowHeight * (index + 1))
      // Name on the left, amount far right: separate Vision fragments on one row.
      draw(row.0, x: 30, y: y)
      draw(row.1, x: 600, y: y)
    }
    let image = try XCTUnwrap(ctx.makeImage())
    let url = FileManager.default.temporaryDirectory
      .appendingPathComponent("form-label-\(UUID().uuidString).png")
    let dest = try XCTUnwrap(
      CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil))
    CGImageDestinationAddImage(dest, image, nil)
    XCTAssertTrue(CGImageDestinationFinalize(dest))
    addTeardownBlock { try? FileManager.default.removeItem(at: url) }
    return url
  }

  func testOcrReadsRowsThenModelFillsTheLabel() async throws {
    let url = try renderLabel([
      ("Nutrition Facts", ""),
      ("Serving size", "40g"),
      ("Calories", "150"),
      ("Total Fat", "2.5g"),
      ("Total Carbohydrate", "27g"),
      ("Protein", "5g"),
    ])
    let text = try TextRecognizer.recognizeText(imageUri: url.absoluteString)
    print("[FormAssistant] OCR:\n\(text)")
    XCTAssertTrue(text.contains("Protein 5g"), text)
    XCTAssertTrue(text.contains("Calories 150"), text)

    try XCTSkipUnless(AssistantCore.availability() == .available, "model unavailable")
    let json = try await AssistantCore.parseNutritionLabel(ocrText: text)
    print("[FormAssistant] OCR -> label: \(json)")
    let obj = try XCTUnwrap(
      JSONSerialization.jsonObject(with: Data(json.utf8)) as? [String: Any])
    XCTAssertEqual(obj["protein_g"] as? Double, 5)
    XCTAssertEqual(obj["kcal"] as? Double, 150)
    XCTAssertTrue(obj["sodium_mg"] is NSNull)
  }
}
