Pod::Spec.new do |s|
  s.name           = 'AnastaFocus'
  s.version        = '1.0.0'
  s.summary        = 'Anasta Screen Time and Focus native bridge'
  s.description    = 'Family Controls, Managed Settings, and Device Activity bridge for Anasta Focus.'
  s.license        = { :type => 'Proprietary' }
  s.author         = { 'Anasta' => 'support@anasta.app' }
  s.homepage       = 'https://anasta.app'
  s.platforms      = { :ios => '16.0' }
  s.swift_version  = '5.9'
  s.source         = { :path => '.' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'FamilyControls', 'ManagedSettings', 'DeviceActivity', 'SwiftUI'
  s.source_files = '*.{h,m,swift}'
  s.exclude_files = 'extensions/**/*'
end
