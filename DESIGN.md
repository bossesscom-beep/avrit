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

## Icon

`css/avrit-icon.svg` is the editable source: a looping lowercase a, a small
violet spark, and a lime background. The iOS AppIcon is a 1024 × 1024 opaque
PNG. Android uses the matching vector mark with adaptive and monochrome layers.
Regenerate the iOS PNG with:

```sh
rsvg-convert -w 1024 -h 1024 -o ios/Avrit/Assets.xcassets/AppIcon.appiconset/AppIcon.png css/avrit-icon.svg
```
