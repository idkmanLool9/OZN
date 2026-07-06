require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name = 'CapacitorDocumentScannerSok'
  s.version = package['version']
  s.summary = package['description']
  s.license = package['license']
  s.homepage = 'https://uitvaartbeheer.pages.dev'
  s.author = 'SOK Antiochië'
  s.source = { :git => 'https://github.com/idkmanLool9/uitvaart.git', :tag => s.version.to_s }
  s.source_files = 'ios/Plugin/**/*.{swift,h,m}'
  s.ios.deployment_target = '13.0'
  s.dependency 'Capacitor'
  s.swift_version = '5.1'
  s.frameworks = 'VisionKit'
end
