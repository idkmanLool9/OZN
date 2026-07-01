#!/usr/bin/env ruby
# Injecteert de Widget Extension (Live Activity) in het door Capacitor
# gegenereerde Xcode-project. Wordt in de Codemagic-build gedraaid ná
# `npx cap add ios` + `pod install`, omdat de ios/-map elke build opnieuw
# wordt gegenereerd.
#
# Idempotent: als de target al bestaat, doet het script niets.
# Vereist: `gem install xcodeproj`. Verwacht de widget-Swift + Info.plist in
# ios/App/UitvaartWidget/ (daar door de shell-stap heen gekopieerd).

require 'xcodeproj'

PROJECT_PATH = 'ios/App/App.xcodeproj'
WIDGET_NAME  = 'UitvaartWidget'
APP_TARGET   = 'App'
APP_BUNDLE   = 'nl.sok.uitvaartbeheer'
WIDGET_BUNDLE = "#{APP_BUNDLE}.widget"
DEPLOY_TARGET = '16.1'
SOURCES = ['UitvaartWidgetBundle.swift', 'UitvaartLiveActivity.swift', 'UitvaartActivityAttributes.swift']

abort("Xcode-project niet gevonden: #{PROJECT_PATH}") unless File.exist?(PROJECT_PATH)
project = Xcodeproj::Project.open(PROJECT_PATH)

if project.targets.any? { |t| t.name == WIDGET_NAME }
  puts "ℹ︎ Widget-target '#{WIDGET_NAME}' bestaat al — niets te doen."
  exit 0
end

app_target = project.targets.find { |t| t.name == APP_TARGET }
abort("App-target '#{APP_TARGET}' niet gevonden") unless app_target

# App Store eist dat de extensie dezelfde versie heeft als de app. Lees de
# marketing-versie van de app; het buildnummer zetten we via apple-generic
# versioning zodat `agvtool new-version -all` (na injectie) de widget meepakt.
app_marketing = app_target.build_configurations
                          .map { |c| c.build_settings['MARKETING_VERSION'] }
                          .compact.first || '1.0'

# 1) Nieuwe app-extension-target
widget = project.new_target(:app_extension, WIDGET_NAME, :ios, DEPLOY_TARGET)

# 2) Bronbestanden + Info.plist toevoegen (liggen in ios/App/UitvaartWidget/)
group = project.main_group.find_subpath(WIDGET_NAME, true)
group.set_source_tree('SOURCE_ROOT')
SOURCES.each do |fname|
  path = "#{WIDGET_NAME}/#{fname}"
  abort("Bronbestand ontbreekt: ios/App/#{path}") unless File.exist?("ios/App/#{path}")
  ref = group.new_reference(path)
  widget.add_file_references([ref])
end

# 3) Build-instellingen voor de widget
widget.build_configurations.each do |config|
  bs = config.build_settings
  bs['PRODUCT_BUNDLE_IDENTIFIER'] = WIDGET_BUNDLE
  bs['PRODUCT_NAME'] = '$(TARGET_NAME)'
  bs['INFOPLIST_FILE'] = "#{WIDGET_NAME}/Info.plist"
  bs['IPHONEOS_DEPLOYMENT_TARGET'] = DEPLOY_TARGET
  bs['SWIFT_VERSION'] = '5.0'
  bs['TARGETED_DEVICE_FAMILY'] = '1,2'
  bs['CODE_SIGN_STYLE'] = 'Automatic'
  bs['GENERATE_INFOPLIST_FILE'] = 'NO'
  bs['SKIP_INSTALL'] = 'NO'
  # Versie gelijk aan de app; apple-generic zodat agvtool de widget meepakt.
  bs['VERSIONING_SYSTEM'] = 'apple-generic'
  bs['MARKETING_VERSION'] = app_marketing
  bs['CURRENT_PROJECT_VERSION'] = '1'
  bs['CLANG_ENABLE_MODULES'] = 'YES'
  bs['LD_RUNPATH_SEARCH_PATHS'] = '$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks'
end

# 4) Widget als afhankelijkheid + inbedden in de app
app_target.add_dependency(widget)
embed_phase = app_target.build_phases.find do |ph|
  ph.is_a?(Xcodeproj::Project::Object::PBXCopyFilesBuildPhase) &&
    ph.symbol_dst_subfolder_spec == :plug_ins
end
embed_phase ||= begin
  ph = app_target.new_copy_files_build_phase('Embed App Extensions')
  ph.symbol_dst_subfolder_spec = :plug_ins
  ph
end
build_file = embed_phase.add_file_reference(widget.product_reference)
build_file.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }

project.save
puts "✓ Widget-target '#{WIDGET_NAME}' toegevoegd en ingebed in '#{APP_TARGET}'."
