import ExpoModulesCore

// Thin Expo bridge over AssistantCore and TextRecognizer. All logic lives in Core/ so it can
// be tested on macOS without Expo (see Package.swift and Tests/ in this module).
public class FormAssistantModule: Module {
  public func definition() -> ModuleDefinition {
    Name("FormAssistant")

    Function("availability") { () -> String in
      AssistantCore.availability().rawValue
    }

    AsyncFunction("summarizeDay") { (inputJson: String) async throws -> String in
      try await bridged { try await AssistantCore.summarizeDay(inputJson: inputJson) }
    }

    AsyncFunction("parseNutritionLabel") { (ocrText: String) async throws -> String in
      try await bridged { try await AssistantCore.parseNutritionLabel(ocrText: ocrText) }
    }

    AsyncFunction("parseReceipt") { (ocrText: String) async throws -> String in
      try await bridged { try await AssistantCore.parseReceipt(ocrText: ocrText) }
    }

    AsyncFunction("recognizeText") { (imageUri: String) async throws -> String in
      try await bridged {
        // Vision is synchronous and can take a second on a big photo; keep it off the JS thread.
        try await Task.detached(priority: .userInitiated) {
          try TextRecognizer.recognizeText(imageUri: imageUri)
        }.value
      }
    }
  }
}

/// Rethrows AssistantError as an Expo exception so JS sees `error.code`.
private func bridged<T>(_ body: () async throws -> T) async throws -> T {
  do {
    return try await body()
  } catch let error as AssistantError {
    throw AssistantException((code: error.code, message: error.message))
  }
}

final class AssistantException: GenericException<(code: String, message: String)>, @unchecked Sendable {
  override var code: String { param.code }
  override var reason: String { param.message }
}
