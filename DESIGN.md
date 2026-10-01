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

## Icon

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
