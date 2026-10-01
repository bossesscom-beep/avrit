# Photo journal and Gemini feature handoff · 1 October 2026

Implemented after the first store builds were uploaded. Those existing build-1
artifacts and store states are recorded in `STORE_BUILD_HANDOFF.md`; they do not
contain this feature. In the subsequent owner TestFlight invitation task, iOS
0.1.0 (2) was uploaded with these changes. Android's uploaded build remains 1.

The app now records completion history with one optional photo and note per day.
Done remains one tap. Photos live in IndexedDB; metadata lives with the reminder
in localStorage. Existing last-done dates are retained when history begins.
Backdated photos do not move the active reminder backwards. Photo replacement
and deletion require confirmation. Android opens a system image chooser; iOS
uses WebKit's photo chooser and includes camera/photo purpose strings.

Gemini text drafting and explicit photo sharing are implemented behind a
server-only provider key and authenticated pilot connection. Nothing is sent on
ordinary logging. Results need explicit adoption and saving. The API has payload
limits, structured output validation, persistent daily caps and timeouts.

Live Gemini remains gated on a rotated provider key, a configured HTTPS service,
and verified API-project billing/quota. The pasted key was not used or saved.
See `server/README.md` for the exact configuration and public-rollout gates.

Validation evidence is kept locally under ignored `ios/build/` and Android build
outputs. Browser checks covered selecting a sample image, adding a note, saving,
reloading and explicitly removing the photo. Physical-device camera/haptic feel
and live Gemini responses remain unverified.

- `npm test`: 41 passing tests, including persisted daily quota across restarts.
- iOS Debug simulator build: passed with the bundled photo/AI assets.
- Android `assembleDebug` and `lintDebug`: passed; existing SDK/dependency and
  portrait/WebView advisory warnings remain non-blocking.
- Browser layout screenshot: `ios/build/previews/photo-journal.png`.
- The local preview was returned to its original starter reminders after the
  sample-photo test. Test imagery was removed through the normal UI.
