"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));

assert.strictEqual(manifest.manifest_version, 3);
assert.ok(manifest.name && manifest.version && manifest.description);

// Privacy: no storage, no analytics/tracking permissions.
assert.ok(Array.isArray(manifest.permissions), "permissions must be an array");
for (const p of manifest.permissions) {
  assert.ok(!["storage", "history", "bookmarks", "tabs", "webNavigation", "webRequest", "webRequestBlocking", "cookies", "browsingData"].includes(p), "forbidden permission: " + p);
}
assert.ok(!manifest.content_security_policy || !/remote/i.test(JSON.stringify(manifest.content_security_policy)), "no remote CSP");

// Content script coverage: every page, every frame, as early as possible.
assert.strictEqual(manifest.content_scripts.length, 1);
const cs = manifest.content_scripts[0];
assert.deepStrictEqual(cs.matches, ["<all_urls>"]);
assert.strictEqual(cs.run_at, "document_start");
assert.strictEqual(cs.all_frames, true);
assert.strictEqual(cs.match_about_blank, true);

// Every referenced file must exist.
const referenced = [...cs.js, manifest.background.service_worker, manifest.action.default_popup, ...Object.values(manifest.icons), ...Object.values(manifest.action.default_icon)];
for (const f of referenced) {
  assert.ok(fs.existsSync(path.join(root, f)), "missing file referenced by manifest: " + f);
}

// No remote resources anywhere in the manifest.
const manifestStr = JSON.stringify(manifest);
assert.ok(!/https?:\/\//.test(manifestStr), "manifest must not reference remote URLs");

// Popup resources exist.
const popupDir = path.join(root, "src");
assert.ok(fs.existsSync(path.join(popupDir, "popup.css")));

// Source files must not perform network calls or use storage.
for (const f of ["src/content.js", "src/background.js", "src/popup.js"]) {
  const raw = fs.readFileSync(path.join(root, f), "utf8");
  const src = raw.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(!/\bfetch\s*\(/.test(src), f + " must not call fetch()");
  assert.ok(!/XMLHttpRequest/.test(src), f + " must not use XHR");
  assert.ok(!/chrome\.storage/.test(src), f + " must not use chrome.storage");
  assert.ok(!/https?:\/\//.test(src), f + " must not contain remote URLs");
}

console.log("manifest.test.js: all assertions passed");
