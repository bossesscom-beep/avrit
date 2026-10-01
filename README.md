# Avrit

Avrit is a small upkeep reminder. Log the day you last cut your nails, had a haircut, serviced the air conditioner, had the car battery tested, or renewed insurance. It suggests the next time, and you can replace that gap with your own.

Open `index.html` in a browser. The page uses ordinary script tags, so opening the file directly works. The public copy is [https://bighelpers.in/avrit/](https://bighelpers.in/avrit/).

Avrit's own timing works offline. Completion history supports one photo and a note per day; photos are resized and stored in IndexedDB on the device. Adding an older entry preserves the most recent completion date. Device/browser data deletion removes local history and photos; there is no cloud photo sync.

Optional Gemini assistance can draft a reminder from plain language or help describe a photo. Each request requires an explicit sharing action, and suggestions remain drafts until accepted. Provider credentials are server-only. See [server/README.md](server/README.md) for the authenticated API and deployment gates. Air-conditioner and battery dates remain qualified service checks, not home refrigerant or charging jobs.

```bash
npm test
```

The iOS and Android projects bundle this same page. Store keys stay outside the repository, in `~/.config/avrit/release.env`. `scripts/with-release-env.sh` loads that file for a Fastlane command. `fastlane ios upload_only` uploads an IPA without submitting it. `fastlane android upload_production_draft` uploads an AAB as a production draft. `fastlane android release_production` is a separate lane that can send a release into Google review.

The interface and feedback conventions are in [DESIGN.md](DESIGN.md). Install
test dependencies with `npm ci`, then run `npm test` for engine, gesture, guide,
and interaction regression tests.

## Signed builds

Android release signing reads `ANDROID_KEYSTORE_PATH`,
`ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and `ANDROID_KEY_PASSWORD`
from the protected release environment. An Avrit-specific keystore is required;
missing signing configuration must not fall back to the debug key.

```sh
scripts/with-release-env.sh env JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home android/gradlew -p android :app:bundleRelease :app:lintRelease
```

For iOS, `scripts/prepare-ios-profile.rb` runs with the Fastlane Ruby environment
and the release environment loaded. It verifies the app, bundle, team, and an
existing local distribution identity before obtaining the matching profile. It
does not create certificates or export private keys. Archive with manual signing
using the installed profile, then export with `ios/ExportOptions.plist`:

```sh
xcodebuild -project ios/Avrit.xcodeproj -scheme Avrit -configuration Release -destination 'generic/platform=iOS' -archivePath ios/build/Avrit.xcarchive CODE_SIGN_STYLE=Manual CODE_SIGN_IDENTITY='Apple Distribution' PROVISIONING_PROFILE_SPECIFIER='Avrit App Store' DEVELOPMENT_TEAM=PG2MGPAQ76 archive
xcodebuild -exportArchive -archivePath ios/build/Avrit.xcarchive -exportPath ios/build/export -exportOptionsPlist ios/ExportOptions.plist
```

Set `IPA_PATH` or `AAB_PATH` for the existing upload lane. The first store builds
remain version 0.1.0, build/version code 1. Uploading is separate from App Review
or a completed Play production release.
