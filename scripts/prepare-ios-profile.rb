require 'spaceship'
require 'openssl'
require 'base64'
require 'open3'
require 'fileutils'

# Uses the existing team certificate. Never generates or exports a private key.
bundle_id = ENV.fetch('IOS_BUNDLE_ID')
team_id = ENV.fetch('APPLE_TEAM_ID')
abort 'Unexpected signing target' unless bundle_id == 'in.bighelpers.avrit' && team_id == 'PG2MGPAQ76'
Spaceship::ConnectAPI.token = Spaceship::ConnectAPI::Token.create(
  key_id: ENV.fetch('ASC_KEY_ID'), issuer_id: ENV.fetch('ASC_ISSUER_ID'),
  filepath: ENV.fetch('ASC_KEY_PATH'), in_house: false
)
app = Spaceship::ConnectAPI::App.get(app_id: ENV.fetch('ASC_APP_ID'))
abort 'App record mismatch' unless app.bundle_id == bundle_id
bundle = Spaceship::ConnectAPI::BundleId.find(bundle_id)
abort 'Bundle team mismatch' unless bundle && bundle.seed_id == team_id
identities, status = Open3.capture2('security', 'find-identity', '-v', '-p', 'codesigning')
abort 'Unable to read signing identities' unless status.success?
certificate = Spaceship::ConnectAPI::Certificate.all(filter: {certificateType: 'DISTRIBUTION'}).find do |cert|
  public_cert = OpenSSL::X509::Certificate.new(Base64.decode64(cert.certificate_content))
  fingerprint = OpenSSL::Digest::SHA1.hexdigest(public_cert.to_der).upcase
  public_cert.subject.to_a.any? { |k,v,_| k == 'OU' && v == team_id } && cert.valid? && identities.include?(fingerprint)
end
abort 'No matching existing distribution identity' unless certificate
puts "Verified Apple app #{app.name}, bundle #{bundle.identifier}, team #{bundle.seed_id}, certificate #{certificate.display_name}."
profiles = Spaceship::ConnectAPI::Profile.all(filter: {profileType: 'IOS_APP_STORE'}, includes: 'bundleId,certificates')
profile = profiles.find do |p|
  p.bundle_id&.identifier == bundle_id && p.valid? && p.certificates.any? { |c| c.id == certificate.id }
end
profile ||= Spaceship::ConnectAPI::Profile.create(
  name: 'Avrit App Store', profile_type: 'IOS_APP_STORE', bundle_id_id: bundle.id,
  certificate_ids: [certificate.id]
)
directory = File.expand_path('~/Library/Developer/Xcode/UserData/Provisioning Profiles')
FileUtils.mkdir_p(directory)
File.binwrite(File.join(directory, "#{profile.uuid}.mobileprovision"), Base64.decode64(profile.profile_content))
FileUtils.mkdir_p(File.expand_path('../ios/build', __dir__))
File.write(File.expand_path('../ios/build/profile-name.txt', __dir__), profile.name)
puts "Installed profile #{profile.name} (#{profile.uuid}), expires #{profile.expiration_date}."
