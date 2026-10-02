# Avrit internal TestFlight · 2 October 2026

## Latest iOS build: 0.1.0 (3)

- Bundle: `in.bighelpers.avrit`; App Store Connect app: `6817162767`;
  team: `PG2MGPAQ76`.
- Application source: `d3dc5b4` on `codex/0-onboarding`.
- Build ID: `2584c0c5-8eb0-44c2-8109-52cf2cc51dc3`.
- Upload accepted at 05:53 IST on 2 October 2026. Fresh API verification at
  05:55 IST: **VALID**, internal **IN_BETA_TESTING**, attached to existing
  **Avrit Internal** group. Its one existing tester remains assigned. No
  tester accounts, roles or permissions changed; the existing group was reused.
- External state: **READY_FOR_BETA_SUBMISSION**. No external beta or public
  App Review submission. App Store version remains **PREPARE_FOR_SUBMISSION**.
- Archive: `ios/build/testflight-3.xcarchive`.
- IPA: `ios/build/testflight-3-export/Avrit.ipa`.
- SHA-256: `c21a6066129132ed32cb73b1fc84fbd50d57c5d17cb35b1cef9cad77c0791b0e`.
- Verified bundle/version/build, iPhone-only device family, distribution code
  signature, team/profile expiry, and every bundled web file against source.
- Includes profile onboarding, 28 Avrit ideas, editable schedule suggestions,
  Settings repairs and native local notification scheduling. TestFlight notes
  cover these flows. **Live Gemini remains disconnected.**
- Validation: 73 JavaScript tests, iOS simulator build and signed archive/export,
  Android debug build/lint and 2 notification integration tests passed. The
  Android alarm-broadcast test dispatches the registered PendingIntent; it does
  not prove exact timed delivery. Physical iPhone installation and background
  notification delivery remain unverified.
- Read-only listing pass: en-GB title is Avrit; category, subtitle, description,
  keywords, support/privacy/marketing URLs and screenshot sets are still empty.
  Those public-release prerequisites were not changed for this internal upload.
- Private provider read-back: `ios/build/testflight-3-delivery.json`;
  listing inventory: `ios/build/listing-audit-3.json` (both ignored).
- Android's uploaded code remains 1. No Google Play changes in this task.

## Previous internal TestFlight setup · 1 October 2026

At the owner's request, added the existing account-holder tester to the new
private `Avrit Internal` group. Existing App Store Connect roles were unchanged.
Apple maintains app-specific tester records; the owner's existing record for a
different app cannot be assigned directly to Avrit. Creating the assignment by
email with Avrit's group produced the correct Avrit-specific tester record.

## Previous iOS build 2

- Version/build: **0.1.0 (2)**; bundle `in.bighelpers.avrit`; team `PG2MGPAQ76`.
- App Store Connect app: `6817162767`.
- Build ID: `fa1797fd-fdb9-4a22-a7d4-528c7fabc46f`.
- Uploaded at approximately 21:40 IST; processing **VALID** and internal state
  **IN_BETA_TESTING** verified at 21:42 IST on 1 October 2026.
- Both builds 1 and 2 are assigned to `Avrit Internal`. Automatic access to all
  future builds is disabled. There is no public invitation link.
- Owner tester's email, group membership and app membership were verified via
  the scoped API. Private evidence is in ignored
  `ios/build/testflight-owner-state.json`. Inbox delivery/acceptance is not
  independently verified.
- App Store version remains **PREPARE_FOR_SUBMISSION**. No App Review or
  external Beta App Review submission; no public release.

Build 2 includes the photo completion journal, history, notes, picker integration
and the protected Gemini client. **Live Gemini remains disconnected.** TestFlight
testing notes describe the photo flows and this limitation.

## Local artifacts and validation

- Archive: `ios/build/Avrit-TestFlight-2.xcarchive`.
- IPA: `ios/build/testflight-2-export/Avrit.ipa`.
- SHA-256: `812d822c2cf86a7f42108fac16b78c9759b0ac511f299d597e55982b2333248a`.
- All bundled web assets matched the source byte for byte. Verified bundle,
  version/build, iPhone-only device family, camera purpose string and code
  signature. Archive/export and upload succeeded; **41 tests passed**.
- Previous build-1 artifacts were preserved. Android's uploaded version code
  remains 1; no Play changes were made during this invitation task.

The first store-build record remains in `STORE_BUILD_HANDOFF.md`; feature and
Gemini activation requirements are in `PHOTO_GEMINI_HANDOFF.md` and
`server/README.md`.
