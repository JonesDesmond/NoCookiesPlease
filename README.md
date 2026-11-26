# NoCookiesPlease

A browser extension (Chrome, Edge, Firefox, Safari) that automatically **rejects cookie-consent banners** on every website and switches off every optional category — explicitly including **"legitimate interest"** toggles — whenever a site only offers a preferences panel.

**Fully local.** The extension never stores, sends, or shares any data: no `storage` permission, no network requests, no analytics, no remote code. Everything is computed in memory on your PC. Any per-site decision you make (e.g. "block cookies on this site") is kept only in *session-scoped* browser rules that are wiped when the browser closes.

## How it works

A content script runs at `document_start` in **every page and every frame** (many consent banners live inside cross-origin iframes), pierces shadow DOM, and rescans the page for ~25 s:

1. **Reject-all first.** Clicks "Reject all / Decline / Only necessary / …" using known CMP selectors (OneTrust, Cookiebot, CookieYes, Quantcast, Osano, …) plus generic label matching in **English, German, French, Spanish, Italian, Dutch, and Greek** (diacritics-insensitive).
2. **No reject-all? Open preferences.** Clicks "Manage / Settings / Preferences", then switches **off** every optional category (marketing, analytics, personalization, …) and **always off** any toggle labeled "legitimate interest" ("berechtigtes Interesse", "intérêt légitime", "interés legítimo", "interesse legittimo", "gerechtvaardigd belang", "έννομο συμφέρον", …). Strictly-necessary/functional categories stay on. Then clicks "Save / Confirm".
3. **Still nothing?** After ~6 s the top page asks *you* (small in-page card): **Hide banner**, **Hide + block cookies on this site (this session)**, or **Leave banner**. Asked at most once per site per browser session.
4. **Optional hard block.** "Block cookies on this site" adds a *session-only* `declarativeNetRequest` rule that strips `Set-Cookie` response headers for that host. Supported in Chromium; Firefox/Safari support varies, and the toolbar popup tells you when it isn't available. Note: blocking cookies on a site can break logins there.

The toolbar popup shows the status of the current page and offers "Reject cookies on this page now" plus the session-only per-site cookie block.

## Install

### Chrome / Edge

1. Download/clone this repo.
2. Open `chrome://extensions` (Edge: `edge://extensions`).
3. Enable **Developer mode**.
4. **Load unpacked** → select this repo's root folder (the one containing `manifest.json`).

### Firefox

- Temporary: `about:debugging` → **This Firefox** → **Load Temporary Add-on** → select `manifest.json`. Requires Firefox ≥ 121 (MV3 service workers).
- Permanent: submit to AMO (the `browser_specific_settings.gecko.id` is already set), or self-sign with `web-ext sign`.

### Safari (macOS)

Safari runs the same web extension wrapped in a native app via Apple's converter (requires macOS + Xcode):

```bash
mkdir -p safari/staging
cp manifest.json safari/staging/
cp -r src icons safari/staging/
xcrun safari-web-extension-converter safari/staging \
  --project-location safari/NoCookiesPlease.xcodeproj \
  --app-name "NoCookiesPlease" \
  --bundle-id com.jonesdesmond.nocookiesplease
```

Then open `safari/NoCookiesPlease.xcodeproj` in Xcode, set your Apple Developer team under Signing & Capabilities, and run. In Safari's settings, enable the extension. (Safari's `declarativeNetRequest` support is limited, so the cookie-header blocking may be unavailable there; banner rejection/hiding works.)

## Privacy guarantees

- No `storage` permission is requested or used; nothing is written to disk by the extension.
- No network requests are made by the extension at all (enforced by `test/manifest.test.js`).
- Per-site prompts and cookie blocks live only in memory / session rules and disappear when the browser closes.
- All matching (CMP selectors, multi-language labels) is bundled locally in `src/labels.js`.

## Limitations

- Hiding a banner is cosmetic; only the session cookie-block actually prevents `Set-Cookie` headers, and only where the browser supports it.
- Some sites re-render their banner or ignore the reject click; the extension retries for ~25 s.
- Blocking cookies on a site may break sign-in on that site — that's why it's opt-in per site and session-only.

## Development

No dependencies. Run the tests with Node.js:

```bash
npm test
# or directly:
node test/matcher.test.js
node test/manifest.test.js
node test/content.smoke.test.js reject
node test/content.smoke.test.js toggles
node test/content.smoke.test.js prompt
```

Regenerate the icons (pure-stdlib PNG writer):

```bash
python3 tools/gen_icons.py
```

## Layout

```
manifest.json          MV3 manifest (no storage, no remote URLs)
src/labels.js          CMP selectors + label lists (EN/DE/FR/ES/IT/NL/EL), normalized
src/matcher.js         pure matching helpers (reject/save/settings/necessary/optional/legitimate-interest)
src/content.js         banner scanner + auto-clicker + per-site prompt (shadow-DOM aware)
src/background.js      service worker: session-only cookie-block rules, in-memory prompt state
src/popup.*            toolbar popup (page status, reject-now, per-site session block)
icons/                 generated toolbar icons
tools/gen_icons.py     icon generator
test/                  zero-dependency Node tests
```
