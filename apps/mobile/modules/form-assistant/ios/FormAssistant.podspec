Pod::Spec.new do |s|
  s.name           = 'FormAssistant'
  s.version        = '0.1.0'
  s.summary        = 'On-device assistant for FORM: Apple Foundation Models plus Vision OCR'
  s.description    = 'Wraps SystemLanguageModel (iOS 26+) and VNRecognizeTextRequest for the FORM app.'
  s.license        = 'UNLICENSED'
  s.author         = 'FORM'
  s.homepage       = 'https://github.com/dDuk0ski/FORM'
  # The app still runs on older iOS; Foundation Models calls are behind #available(iOS 26).
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'Vision', 'ImageIO'
  s.weak_frameworks = 'FoundationModels'

  s.source_files = '*.swift', 'Core/*.swift'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
