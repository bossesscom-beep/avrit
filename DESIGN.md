# Avrit interface

Avrit makes recurring care easy to see and quick to log. The visual language is
playful, with quiet feedback and predictable controls.

- Cream canvas, ink text, lime brand mark, and a distinct tint for each rhythm.
- Use the 4 / 8 / 12 / 16 / 24 / 32 spacing scale. Main touch controls are at
  least 44 points. Squircle cards use CSS corner shapes where supported and an
  SVG superellipse fallback.
- Done logs today in one tap. A card opens its date controls in one tap.
  Adding a rhythm is always in the center of the bottom navigation.
- Keep guides, interval overrides, removal, and optional Gemini settings behind
  disclosures. Removal has a separate confirmation step.
- Pulling the list applies resistance, release carries momentum with friction,
  and overscroll settles back to the boundary. Reordering previews the exact
  destination; dropping commits that slot rather than flinging to another one.
- A grabbed card lifts; neighboring cards move aside. Near the list edges,
  dragging scrolls the list. Pointer cancellation preserves the saved order.
- Successful logging gives one quiet audio tick, a brief visual spring, and a
  soft native haptic where supported. Reorder feedback is limited to grab,
  crossing a slot, and release. The user can turn off sound in Settings.
- iOS uses native soft impact and selection generators. Android uses the
  platform haptic constants, with an origin-restricted WebView message listener.
  Actual vibration feel must be checked on physical hardware.
- Reduced motion disables decorative transitions, parallax, completion tilt,
  and inertial settling. Dragging remains direct and functional. Keyboard users
  can open cards with Enter/Space and move focused grips with arrow keys.

The reminder engine and source-backed guide content are independent of this
presentation. The native shells bundle the same local web assets; the web app
does not need to be deployed to build a store binary.

## Photo journal and optional assistance

- Keep Done as a one-tap action. Details offer “Log with photo”; choosing a
  picture opens a preview with a date, optional note and explicit Save.
- One entry per day prevents accidental duplicate logs. Repeated Done taps
  preserve existing photos and notes. A backdated entry must not regress the
  current reminder date. Replacing a day's photo requires a second tap.
- Photos are resized to at most 1280 pixels on the longest edge and re-encoded
  without source metadata. History thumbnails use the same shape and spacing
  conventions as reminder cards. Show a clear error when storage fails.
- Gemini is a disclosure in Add and the photo composer. Explain precisely what
  is sent before the sharing button. A successful response is a draft, never
  proof of completion or an automatic interval change. Applying an interval
  from a photo still requires saving the log.
- Secondary connection controls remain in Settings. The current access-code
  connection is a private pilot gate, not public customer onboarding.

## Profile and Avrit discovery

First launch follows five full-screen steps: optional profile, explanation of
Avrit, areas of life, one routine per flashcard, and a grouped review. The
definition is "something in your life that needs care again—after a week, a
month, or a season." Avoid daily streaks or guilt-oriented copy.

- Profile fields: name, optional gender/self-description, a personal intention,
  and up to three local photos. Gender never changes the catalog or timing.
- The 28-item catalog covers personal care, home, wardrobe/belongings, health
  appointments, digital life, and life admin. No routine is selected by default.
  Three initial areas are suggested; the person can choose any combination.
- Each flashcard includes a purpose, editable day interval, optional first-date
  controls, a practical prompt, Add, and Next. Review is reachable at any time.
  Long content scrolls while the primary action stays in view.
- Intervals are planning starting points. Health appointments require the
  person's explicitly entered clinician-agreed timing; there is no suggested
  medical interval. Selected template items keep their explicit interval.
- Starting a rhythm sets `firstDueAt` without setting `lastDone` or fabricating
  a journal entry. A real completion then controls the next date. Entering a
  genuine past completion creates its initial journal entry.
- Review supports removing, editing, and creating personal Avrits. An atomic
  dashboard save writes items, profile and completion marker together. Drafts
  resume after reload. A failed final save keeps the choices available.
- Existing installations bypass onboarding. Settings/Add/dashboard discovery
  reopen setup without replacing existing reminders or history. Already-added
  templates are identified; the existing item always wins.
- Dashboard shows collection, due and upcoming counts; filters include category,
  due, upcoming and all. Reordering is available in the complete collection,
  preventing a filtered index from changing an unrelated item's position.
- Profile photos use the existing resize/re-encode and IndexedDB store. No
  profile, gender or photo is sent to Gemini or another service by onboarding.
  App/browser data deletion removes the local profile and photos. Future store
  releases must review their disclosures for these added optional profile fields.

### AI timing estimates

Each onboarding card and dashboard detail offers "Find a rhythm for me".
When Gemini is connected, an explicit request shares only the routine name,
category and up to 500 characters of context the person enters. It never adds
profile details, gender, photos, other reminders or completion history to that
request. Suggestions contain a day interval, a friendly explanation and a small
practical next step. "Use this timing" applies the estimate; receiving a response
does not alter the schedule. Onboarding adoption still needs the final dashboard
save. Dashboard adoption uses the normal storage rollback path.

Health cards retain clinician-agreed timing. Both the client and server prevent
known health templates from receiving invented AI intervals. Unknown or ambiguous
timing may return no interval. Offline, quota, timeout and invalid-response states
preserve the person's current timing. Without a configured connection, the UI
identifies local starting points honestly and explains that AI is not yet available.

## Icon assets

`css/avrit-icon.svg` is the editable source: a looping lowercase a, a small
violet spark, and a lime background. The iOS AppIcon is a 1024 × 1024 opaque
PNG. Android uses the matching vector mark with adaptive and monochrome layers.
`store-assets/avrit-play-icon.png` is the matching opaque 512 × 512 listing
asset, prepared for the separate store-listing step. Binary upload lanes do
not change listing graphics.
Regenerate the iOS PNG with:

```sh
rsvg-convert -w 1024 -h 1024 -o ios/Avrit/Assets.xcassets/AppIcon.appiconset/AppIcon.png css/avrit-icon.svg
```
