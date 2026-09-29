# Avrit

Avrit is a small upkeep reminder. Log the day you last cut your nails, had a haircut, serviced the air conditioner, had the car battery tested, or renewed insurance. It suggests the next time, and you can replace that gap with your own.

Open `index.html` in a browser. The page uses ordinary script tags, so opening the file directly works. The public copy is [https://bighelpers.in/avrit/](https://bighelpers.in/avrit/).

The suggestion you see with no API key is Avrit's own timing. A Gemini key can be saved from More; it stays in this browser and is not part of the repository. Air-conditioner and battery dates are qualified service checks, not home refrigerant or charging jobs.

```bash
npm test
```

The iOS and Android projects bundle this same page. Store keys stay outside the repository, in `~/.config/avrit/release.env`. `scripts/with-release-env.sh` loads that file for a Fastlane command. `fastlane ios upload_only` uploads an IPA without submitting it. `fastlane android upload_production_draft` uploads an AAB as a production draft. `fastlane android release_production` is a separate lane that can send a release into Google review.
