"use strict";

const assert = require("assert");
const L = require("../src/labels.js");
const M = require("../src/matcher.js");

// --- normalization ---
assert.strictEqual(M.normalizeText("Intérêt légitime!"), "interet legitime");
assert.strictEqual(M.normalizeText("Έννομο συμφέρον"), "εννομο συμφερον");
assert.strictEqual(M.normalizeText("  Cookie-Einstellungen  "), "cookie einstellungen");
assert.strictEqual(M.normalizeText(""), "");
assert.strictEqual(M.normalizeText(null), "");

// --- reject-all buttons in all 7 languages ---
const rejectLabels = [
  "Reject all", "Decline all cookies", "Only necessary cookies", "Refuse",
  "Alle ablehnen", "Nur notwendige Cookies",
  "Tout refuser", "Uniquement les nécessaires", "Je refuse",
  "Rechazar todo", "Solo cookies necesarias",
  "Rifiuta tutti", "Solo necessari",
  "Alles weigeren", "Alleen strikt noodzakelijk",
  "Απόρριψη όλων", "Μόνο τα απαραίτητα",
];
for (const label of rejectLabels) {
  assert.ok(M.isRejectAll(label), "should be reject-all: " + label);
}

// --- must NOT be treated as reject-all ---
const nonReject = ["Accept all", "Allow all cookies", "Agree", "OK", "Save preferences", "Manage options", "Learn more", "Preferences"];
for (const label of nonReject) {
  assert.ok(!M.isRejectAll(label), "should NOT be reject-all: " + label);
}

// --- legitimate interest in all 7 languages ---
const liLabels = [
  "Legitimate interest",
  "Berechtigtes Interesse",
  "Intérêt légitime",
  "Interés legítimo",
  "Interesse legittimo",
  "Gerechtvaardigd belang",
  "Έννομο συμφέρον",
];
for (const label of liLabels) {
  assert.ok(M.isLegitimateInterest(label), "should be LI: " + label);
}
assert.ok(!M.isLegitimateInterest("Necessary cookies"));
assert.ok(!M.isLegitimateInterest("Marketing"));

// --- necessary vs optional categories ---
assert.ok(M.isNecessary("Strictly necessary"));
assert.ok(M.isNecessary("Nur erforderliche Cookies"));
assert.ok(M.isNecessary("Cookies nécessaires"));
assert.ok(M.isNecessary("Solo necesarias"));
assert.ok(M.isNecessary("Necessari"));
assert.ok(M.isNecessary("Noodzakelijke cookies"));
assert.ok(M.isNecessary("Απαραίτητα cookies"));

assert.ok(M.isOptionalCategory("Marketing"));
assert.ok(M.isOptionalCategory("Analytics & statistics"));
assert.ok(M.isOptionalCategory("Publicité"));
assert.ok(M.isOptionalCategory("Personalización"));
assert.ok(M.isOptionalCategory("Statistiche"));
assert.ok(M.isOptionalCategory("Personalisatie"));
assert.ok(M.isOptionalCategory("Διαφήμιση"));

assert.ok(!M.isNecessary("Marketing"));
assert.ok(!M.isOptionalCategory("Strictly necessary"));

// --- save / settings ---
assert.ok(M.isSave("Save my choices"));
assert.ok(M.isSave("Speichern"));
assert.ok(M.isSave("Enregistrer mes choix"));
assert.ok(M.isSave("Guardar"));
assert.ok(M.isSave("Salva"));
assert.ok(M.isSave("Opslaan"));
assert.ok(M.isSave("Αποθήκευση"));
assert.ok(!M.isSave("Accept all"));

assert.ok(M.isSettings("Manage preferences"));
assert.ok(M.isSettings("Einstellungen"));
assert.ok(M.isSettings("Gérer les cookies"));
assert.ok(M.isSettings("Configurar"));
assert.ok(M.isSettings("Gestisci"));
assert.ok(M.isSettings("Beheren"));
assert.ok(M.isSettings("Ρυθμίσεις"));

// --- banner keywords ---
assert.ok(M.isBannerText("We use cookies to improve your experience"));
assert.ok(M.isBannerText("Wir verwenden Cookies"));
assert.ok(M.isBannerText("Nous utilisons des cookies"));
assert.ok(M.isBannerText("Χρησιμοποιούμε cookies"));
assert.ok(!M.isBannerText("Latest news today"));

// --- toggle state heuristics ---
assert.strictEqual(M.toggleIsOn({ tagName: "INPUT", type: "checkbox", checked: true }), true);
assert.strictEqual(M.toggleIsOn({ tagName: "INPUT", type: "checkbox", checked: false }), false);
const sw = { tagName: "DIV", getAttribute: (n) => (n === "aria-checked" ? "true" : null), className: "" };
assert.strictEqual(M.toggleIsOn(sw), true);
const swOff = { tagName: "DIV", getAttribute: (n) => (n === "aria-checked" ? "false" : null), className: "" };
assert.strictEqual(M.toggleIsOn(swOff), false);
const pressed = { tagName: "BUTTON", getAttribute: (n) => (n === "aria-pressed" ? "true" : null), className: "" };
assert.strictEqual(M.toggleIsOn(pressed), true);
const clsOn = { tagName: "DIV", getAttribute: () => null, className: "toggle switch-on" };
assert.strictEqual(M.toggleIsOn(clsOn), true);
assert.strictEqual(M.toggleIsOn(null), false);

// --- elementLabel ---
const fakeBtn = {
  getAttribute: (n) => (n === "aria-label" ? "Reject all cookies" : null),
  textContent: "Reject all cookies",
};
assert.ok(M.isRejectAll(M.elementLabel(fakeBtn)));

// --- label table sanity: every pattern list is non-empty and normalized ---
for (const key of ["REJECT_ALL", "SETTINGS", "SAVE", "NECESSARY", "OPTIONAL", "LEGITIMATE_INTEREST", "BANNER_KEYWORDS", "SPECIFIC_REJECT"]) {
  assert.ok(Array.isArray(L[key]) && L[key].length > 0, key + " must be a non-empty array");
  for (const p of L[key]) {
    if (key === "SPECIFIC_REJECT") continue; // CSS selectors are not normalized text
    assert.strictEqual(p, L.normalize(p), key + " pattern not normalized: " + p);
  }
}

console.log("matcher.test.js: all assertions passed");
