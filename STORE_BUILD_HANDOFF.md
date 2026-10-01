# Avrit 0.1.0 (1) store build handoff

Verified 1 October 2026. Repository: `bighelpers/avrit`.
Branch: `release/avrit-mvp`. Application source commit: `c20f656`.

## Apple

- Bundle: `in.bighelpers.avrit`; App Store Connect app: `6817162767`.
- Version/build: **0.1.0 (1)**, iPhone-only, team **PG2MGPAQ76**.
- Signed IPA: `ios/build/export/Avrit.ipa`.
- IPA SHA-256: `e2875f99e7d3a61409c7b94ccff45fc3beb234dd19784174a9005daf257cfeb2`.
- Uploaded successfully through `ios upload_only` at approximately 08:29 IST.
- App Store Connect API verified processing **VALID** at 08:31 IST.
- Build ID: `edff8aea-4d4e-441f-b1fd-e1e0ec2ee85e`.
- TestFlight groups returned an empty list. No existing internal group was
  available for attachment, and no new group was created.
- App version remains **PREPARE_FOR_SUBMISSION**. App Review was not submitted.
- The browser session remained signed out. Upload and processing were verified
  through the explicitly supplied scoped API, including a fresh app/bundle/team
  and existing distribution certificate match.

The first upload attempt failed validation because XcodeGen's target defaults
overrode the project-level iPhone setting. `TARGETED_DEVICE_FAMILY` now also
lives at target level in `ios/project.yml`; the project was regenerated, rebuilt,
and the successful IPA was verified to contain `UIDeviceFamily = [1]`.
Build number 1 was retained.

## Google Play

- Package: `in.bighelpers.avrit`; version **0.1.0**, version code **1**.
- Signed AAB: `android/app/build/outputs/bundle/release/app-release.aab`.
- AAB SHA-256: `e53f4bcdb8dc1d7f911fd6be449838a752feadb32de14a1425336c69f3bbca15`.
- Uploaded successfully through `android upload_production_draft`.
- Verified through the API and Play Console: production track, **draft**, code
  **1**, inactive. No completed production release or review submission.
- A dedicated Avrit upload keystore was created outside the repository. Signing
  fields and both artifact paths are in the existing protected release env.
- The prepared Play listing icon is `store-assets/avrit-play-icon.png`. Store
  listing graphics, descriptions, screenshots, pricing, and countries were not
  changed by the upload.

## Design and validation

- New looping-a icon, colorful squircle cards, and redesigned home, detail,
  add, and settings screens.
- One-tap Done; fixed bottom navigation; secondary settings in disclosures.
- Rubber-band pull, momentum/friction, spring settling, exact-slot drag/drop
  with neighbor movement and edge scrolling, keyboard reordering, and
  cancellation that preserves order.
- Soft completion audio, native iOS/Android haptic bridges, visual completion
  feedback, translucent navigation, subtle parallax, and reduced-motion support.
- **25 tests passed**, including all original 17 plus interaction regressions.
- iOS simulator build, signed device archive/export, Android debug/release
  builds, and Android release lint passed. Lint has non-blocking platform,
  dependency-version, orientation, and WebView warnings.
- IPA code signature and AAB JAR signature verified. Both binaries were checked
  against the current shared web files byte for byte.
- Browser checks covered logging, detail/date access, adding a reminder,
  drag/reorder persistence, pull/release, list scrolling, settings, and small
  phone layout. No browser console errors were observed.
- Native haptics compile and receive the intended messages; their physical feel
  still needs a real-device check.
- Reminder engine, guide source content, and gesture physics module unchanged.
- Live website not deployed. No Cloudflare, PHP, or RTI Wiki actions performed.

Local preview: `http://localhost:8765/` while the preview server is running.
Screenshots and provider evidence: `ios/build/previews/` and
`ios/build/testflight-state.json`. Build output directories are ignored by Git.
