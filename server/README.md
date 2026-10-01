# Avrit Gemini service

This is a private-pilot API, separate from the bundled/static app. It is not
deployed by `copy-web.sh` or either Fastlane upload lane. Requires Node 22+.
The app works offline with Gemini disconnected.
Deploy `js/catalog.js` alongside `server/` at the same relative path; the API
uses that shared catalog to validate template IDs and resolve categories.

## Setup

Configure these values in the server's protected environment or secret manager.
Do not paste provider keys into the app, source files, shell command arguments,
screenshots, logs or chat. Rotate any provider key previously shared in chat.

| Environment | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Dedicated Gemini API project credential |
| `AVRIT_ACCESS_CODE` | Random pilot enrollment code, at least 24 characters |
| `AVRIT_SESSION_SECRET` | Random token-signing secret, at least 32 characters |
| `GEMINI_MODEL` | Optional; defaults to `gemini-3.8-flash` |
| `AVRIT_ALLOWED_ORIGINS` | Comma-separated exact origins; defaults to local preview, Android appassets origin and `null` for the iOS file origin |
| `AVRIT_USAGE_FILE` | Persistent daily quota ledger; defaults to ignored `.avrit-data/usage.json` |
| `HOST`, `PORT` | Defaults to `127.0.0.1:8766` |

Run `npm run start:api`. `GET /health` reports availability without exposing
credentials. Missing configuration returns 503 for AI requests. The API never
serves repository files or static web content.

For local text-flow testing, set the public `aiOrigin` in `js/config.js` to
`http://localhost:8766`, open the app at `http://localhost:8765`, then enter the
pilot access code in Settings → Gemini assistance. Leave `aiOrigin` empty until
a service is configured; the UI then explains that assistance is being prepared.
Native builds require a reachable HTTPS service; loopback is only suitable
for browser development. No provider key is entered in the client.

## API and limits

- `POST /api/session` accepts `{code}` and returns a signed, 30-day device token.
  Rotating the signing secret revokes every device token. Changing the enrollment
  code prevents new enrollment but does not revoke existing tokens.
- `POST /api/suggest` requires `Authorization: Bearer <device-token>`.
  A `create` request contains `task` and `text` (maximum 800 characters).
  A `photo` request also contains `mimeType: image/jpeg` and base64 `image`.
  A `schedule` request contains `text` (routine name, at most 80 characters),
  `category`, optional known `templateId`, and `context` (at most 500 characters).
  It returns an estimated interval, friendly `reason`, and a small practical
  suggestion in `note`. Extra profile fields are not forwarded to Gemini.
  Known template categories resolve server-side; health templates return no
  model-generated interval, even if a client supplies a different category.
- Photos are re-encoded by the client to at most 1280 pixels and 900 KB. The API
  validates MIME, base64, JPEG signature and payload size, and accepts no remote
  image URLs. Do not place request bodies in proxy/access/error logs.
- Defaults: 6 requests/minute per device, 20 per device/day, 100 globally/day,
  3 concurrent provider calls, 10 enrollment attempts/minute globally. Failed
  provider calls count toward daily limits. Daily counters are reserved and
  persisted before calling Google, so restarts do not reset the global allowance.
- This implementation runs as **one process** with persistent local storage.
  Replicas or multiple workers require a shared transactional quota store.
  Request counts bound usage, not a guaranteed currency budget.
- Provider calls time out after 25 seconds. JSON schema and runtime validation
  bound returned text and intervals. `store:false` disables stored Interactions
  conversation state; it is not a claim of zero provider retention under all
  Google policies. No prompts, photos or responses are persisted by this server.

## Deployment gate

The feature branch contains a tested client and service, but live Gemini has not
been activated. Before a public rollout:

1. Install a rotated, dedicated provider key in the protected server environment
   and verify that project's API billing/credits and model access. A paid Gemini
   app subscription alone does not verify this API project's quota.
2. Deploy behind HTTPS on the selected Avrit service origin, put only that public
   origin in `js/config.js`, and configure body-size and
   per-IP rate limits at the proxy, and persistent quota storage. Restrict CORS to
   the actual app origins. Never embed enrollment or provider secrets in a build.
3. Use the pilot access code for limited testers. Public onboarding needs the
   portfolio's chosen account/device authentication and abuse controls; the code
   entry UI is not intended as the final public signup flow.
4. Test a real, non-sensitive text and photo request, physical iOS/Android picker
   behavior, offline failures and the installed app's storage lifecycle.
5. Update the published privacy disclosure and store data-safety answers for
   user-selected photos/text sent to Google, then build/upload version code 2 or
   later. The already uploaded build 1 does not contain these features.

The user did not authorize purchases or a live website deployment in this task.
No cloud resources, billing changes, production site files or store submissions
were changed for this feature.

Official references: [API key security](https://ai.google.dev/gemini-api/docs/api-key),
[structured output](https://ai.google.dev/gemini-api/docs/structured-output),
[Interactions REST schema](https://ai.google.dev/api/interactions-api),
[API billing](https://ai.google.dev/gemini-api/docs/billing).

## Tests

`npm test` uses a fake provider and fake IndexedDB. It never invokes paid Gemini.
Coverage includes authentication, CORS, malformed image/output rejection, quota
enforcement, offline photo failure, history migration and explicit draft adoption.
Schedule tests also cover context bounds, omission of profile/photos, health
template protection, friendly structured estimates, unchanged timing until
adoption, failed saves and stale responses after leaving a card. Provider calls
remain simulated in automated tests; a successful test is not live Gemini proof.
