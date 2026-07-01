require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name = 'CapacitorLiveActivitySok'
  s.version = package['version']
  s.summary = package['description']
  s.license = package['license']
  s.homepage = 'https://uitvaartbeheer.pages.dev'
  s.author = 'SOK Antiochië'
  s.source = { :git => 'https://github.com/idkmanLool9/uitvaart.git', :tag => s.version.to_s }
  s.source_files = 'ios/Plugin/**/*.{swift,h,m}'
  # MOET gelijk zijn aan de app-platformversie in de Podfile (iOS 13.0),
  # anders faalt `pod install` met "not compatible / requires iOS x".
  # Alle ActivityKit-code zit achter @available(iOS 16.1), dus 13.0 kan.
  s.ios.deployment_target = '13.0'
  s.dependency 'Capacitor'
  s.swift_version = '5.1'
  # ActivityKit is iOS 16.1+ — zwak gelinkt; alle gebruik zit achter @available.
  s.weak_frameworks = 'ActivityKit'
end
