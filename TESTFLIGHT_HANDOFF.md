# Avrit internal TestFlight · 1 October 2026

At the owner's request, added the existing account-holder tester to the new
private `Avrit Internal` group. Existing App Store Connect roles were unchanged.
Apple maintains app-specific tester records; the owner's existing record for a
different app cannot be assigned directly to Avrit. Creating the assignment by
email with Avrit's group produced the correct Avrit-specific tester record.

## Latest iOS build

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
