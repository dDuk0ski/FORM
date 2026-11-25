import CoreGraphics
import Foundation
import ImageIO
import Vision

// Vision OCR for label and receipt scans. Runs on every iPhone the app supports; it does not
// need Apple Intelligence. The output is plain text, one visual row per line, which is what
// the parse prompts expect.

public struct RecognizedFragment: Equatable {
  public let text: String
  /// Vision's normalized box: origin bottom-left, values 0...1.
  public let box: CGRect

  public init(text: String, box: CGRect) {
    self.text = text
    self.box = box
  }
}

public enum TextRecognizer {
  /// `imageUri` is a `file://` URI (what expo-image-picker and expo-camera hand back) or a
  /// plain absolute path.
  public static func recognizeText(imageUri: String) throws -> String {
    let url: URL
    if let parsed = URL(string: imageUri), parsed.isFileURL {
      url = parsed
    } else if imageUri.hasPrefix("/") {
      url = URL(fileURLWithPath: imageUri)
    } else {
      throw AssistantError.badInput("Only local file URIs can be scanned.")
    }

    guard
      let source = CGImageSourceCreateWithURL(url as CFURL, nil),
      let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
    else {
      throw AssistantError.badInput("Could not open the image.")
    }

    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true

    let handler = VNImageRequestHandler(
      cgImage: image, orientation: orientation(of: source), options: [:])
    do {
      try handler.perform([request])
    } catch {
      throw AssistantError(code: "ERR_OCR_FAILED", message: error.localizedDescription)
    }

    let fragments = (request.results ?? []).compactMap { observation -> RecognizedFragment? in
      guard let candidate = observation.topCandidates(1).first else { return nil }
      return RecognizedFragment(text: candidate.string, box: observation.boundingBox)
    }
    return joinRows(fragments)
  }

  /// Groups fragments into visual rows (top to bottom), each row left to right. Labels put a
  /// nutrient name and its amount in separate fragments on the same row, so this keeps
  /// "Protein" and "12 g" together.
  public static func joinRows(_ fragments: [RecognizedFragment]) -> String {
    let sorted = fragments
      .filter { !$0.text.trimmingCharacters(in: .whitespaces).isEmpty }
      .sorted { $0.box.midY > $1.box.midY }

    var rows: [[RecognizedFragment]] = []
    for fragment in sorted {
      if let last = rows.last?.last,
        abs(last.box.midY - fragment.box.midY) < min(last.box.height, fragment.box.height) * 0.5
      {
        rows[rows.count - 1].append(fragment)
      } else {
        rows.append([fragment])
      }
    }
    return rows
      .map { $0.sorted { $0.box.minX < $1.box.minX }.map(\.text).joined(separator: " ") }
      .joined(separator: "\n")
  }

  private static func orientation(of source: CGImageSource) -> CGImagePropertyOrientation {
    guard
      let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
      let raw = properties[kCGImagePropertyOrientation] as? UInt32,
      let orientation = CGImagePropertyOrientation(rawValue: raw)
    else { return .up }
    return orientation
  }
}
