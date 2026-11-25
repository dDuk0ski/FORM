// swift-tools-version: 6.0
// Test-only package: compiles ios/Core (no Expo) for macOS so XCTest can exercise the prompt
// building, OCR row grouping and, when this Mac has Apple Intelligence on, the real model.
// The app does not use this file; CocoaPods builds the module from ios/FormAssistant.podspec.
//
//   cd apps/mobile/modules/form-assistant && swift test
import PackageDescription

let package = Package(
  name: "FormAssistantCore",
  platforms: [.macOS("26.0")],
  targets: [
    .target(
      name: "FormAssistantCore",
      path: "ios/Core",
      swiftSettings: [.swiftLanguageMode(.v5)]
    ),
    .testTarget(
      name: "FormAssistantCoreTests",
      dependencies: ["FormAssistantCore"],
      path: "Tests/FormAssistantCoreTests",
      swiftSettings: [.swiftLanguageMode(.v5)]
    ),
  ]
)
