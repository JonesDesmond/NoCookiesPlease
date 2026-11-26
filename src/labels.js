(function (global) {
  "use strict";

  function normalize(s) {
    if (!s) return "";
    return String(s)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  }

  // Raw, human-readable label lists. They are normalized (lowercased,
  // diacritics stripped, punctuation removed) at load time, so e.g.
  // "Intérêt légitime" is matched as "interet legitime".
  // Languages: English, German, French, Spanish, Italian, Dutch, Greek.
  const RAW = {
    // Buttons that reject every optional cookie outright.
    REJECT_ALL: [
      // EN
      "reject all", "reject optional", "reject non-essential", "reject nonessential",
      "refuse all", "refuse cookies", "decline all", "decline optional", "decline cookies",
      "deny all", "deny optional", "only necessary", "necessary only", "only essential",
      "essential only", "only required", "accept only necessary", "accept only essential",
      "allow only necessary", "allow only essential", "do not accept", "disagree", "no thanks",
      "reject", "refuse", "decline", "deny",
      // DE
      "alle ablehnen", "ablehnen", "verweigern", "alle verweigern", "nur notwendige",
      "nur erforderliche", "nur essenzielle", "nur funktionale", "nur technisch notwendige",
      // FR
      "tout refuser", "refuser tout", "tout rejeter", "rejeter tout", "je refuse", "refuser",
      "uniquement les nécessaires", "uniquement nécessaires", "uniquement les cookies nécessaires",
      "refuser les cookies optionnels", "refuser tous les cookies",
      // ES
      "rechazar todo", "rechazar todas", "rechazar", "denegar todo", "denegar todas",
      "solo necesarias", "solo esenciales", "solo cookies necesarias", "rechazar cookies opcionales",
      // IT
      "rifiuta tutti", "rifiuta tutto", "rifiuta", "solo necessari", "solo essenziali",
      "rifiuta i cookie non necessari", "rifiuta tutti i cookie non necessari",
      // NL
      "alles weigeren", "weigeren", "alle cookies weigeren", "alleen strikt noodzakelijk",
      "alleen noodzakelijke", "alleen essentiële", "alleen functionele",
      // EL
      "απόρριψη όλων", "απόρριψη", "απόρριψη όλων των cookies", "μόνο τα απαραίτητα",
      "μόνο τα αναγκαία", "άρνηση όλων",
    ],

    // Buttons that open the preferences / categories panel.
    SETTINGS: [
      // EN
      "manage options", "manage preferences", "cookie settings", "manage settings", "preferences",
      "customize", "customise", "manage", "options", "personalize", "choose cookies", "select",
      // DE
      "einstellungen", "verwalten", "optionen", "anpassen", "einstellungen verwalten", "auswählen",
      // FR
      "gérer", "paramètres", "parametres", "options", "personnaliser", "choisir", "gérer les cookies",
      // ES
      "configurar", "ajustes", "opciones", "personalizar", "elegir", "gestionar", "elegir cookies",
      // IT
      "gestisci", "impostazioni", "opzioni", "personalizza", "scegli", "gestisci cookie",
      // NL
      "beheren", "instellingen", "opties", "aanpassen", "kiezen", "cookies beheren",
      // EL
      "διαχείριση", "ρυθμίσεις", "επιλογές", "προσαρμογή", "επιλογή", "διαχείριση cookies",
    ],

    // Buttons that persist the current selection (after toggles were switched off).
    SAVE: [
      // EN
      "save", "save preferences", "save my choices", "save choices", "save settings",
      "confirm", "confirm my choices", "confirm choices", "apply", "accept selection", "use selection",
      // DE
      "speichern", "auswahl speichern", "bestätigen", "anwenden", "übernehmen", "auswahl bestätigen",
      // FR
      "enregistrer", "confirmer", "valider", "appliquer", "enregistrer mes choix",
      // ES
      "guardar", "confirmar", "aplicar", "guardar cambios", "aceptar selección",
      // IT
      "salva", "conferma", "applica", "salva preferenze", "conferma scelte",
      // NL
      "opslaan", "bevestigen", "toepassen", "mijn keuzes opslaan", "selectie accepteren",
      // EL
      "αποθήκευση", "επιβεβαίωση", "εφαρμογή", "αποθήκευση επιλογών",
    ],

    // Categories that must stay ON (strictly necessary / functional / security).
    NECESSARY: [
      // EN
      "necessary", "essential", "required", "strictly", "functional", "security", "core cookies",
      // DE
      "notwendig", "erforderlich", "essentiell", "funktional", "sicherheit", "strikt",
      // FR
      "nécessaire", "indispensable", "essentiel", "fonctionnel", "strictement", "sécurité",
      // ES
      "necesaria", "esencial", "estrictamente", "obligatoria", "seguridad", "funcional",
      // IT
      "necessario", "necessari", "essenziale", "essenziali", "strettamente", "obbligatorio",
      "obbligatori", "sicurezza", "funzionale", "funzionali",
      // NL
      "noodzakelijk", "noodzakelijke", "essentieel", "essentiële", "strikt", "verplicht",
      "verplichte", "beveiliging", "functioneel", "functionele",
      // EL
      "απαραίτητο", "απαραίτητα", "αναγκαίο", "αναγκαία", "βασικό", "βασικά", "υποχρεωτικό",
      "υποχρεωτικά", "αυστηρά", "ασφάλεια", "λειτουργικό", "λειτουργικά",
    ],

    // Optional categories that get switched OFF.
    OPTIONAL: [
      // EN
      "marketing", "advertising", "ads", "analytics", "statistics", "statistical", "performance",
      "personalization", "personalisation", "preferences", "social media", "tracking", "profiling",
      "third party", "third-party",
      // DE
      "werbung", "analyse", "statistik", "personalisierung", "social media", "tracking", "drittanbieter",
      // FR
      "marketing", "publicité", "publicite", "analyse", "statistiques", "personnalisation",
      "médias sociaux", "medias sociaux", "suivi", "tiers",
      // ES
      "marketing", "publicidad", "analítica", "analitica", "estadísticas", "estadisticas",
      "personalización", "personalizacion", "redes sociales", "seguimiento",
      // IT
      "marketing", "pubblicità", "pubblicita", "analitici", "statistiche", "personalizzazione",
      "social media", "monitoraggio",
      // NL
      "marketing", "advertenties", "analyse", "statistieken", "personalisatie", "social media", "tracking",
      // EL
      "μάρκετινγκ", "διαφήμιση", "διαφημιση", "αναλυτικά", "αναλυτικα", "στατιστικά", "στατιστικα",
      "εξατομίκευση", "κοινωνικά δίκτυα", "παρακολούθηση",
    ],

    // "Legitimate interest" toggles — always switched OFF.
    LEGITIMATE_INTEREST: [
      "legitimate interest", // EN
      "berechtigtes interesse", // DE
      "intérêt légitime", // FR
      "interés legítimo", // ES
      "interesse legittimo", // IT
      "gerechtvaardigd belang", // NL
      "έννομο συμφέρον", // EL
    ],

    // Words that identify a cookie/consent banner container.
    BANNER_KEYWORDS: [
      "cookie", "consent", "privacy", "gdpr", "ccpa", "data protection",
      "einwilligung", "datenschutz", "privatsphäre",
      "consentement", "confidentialité", "protection des données", "rgpd",
      "consentimiento", "privacidad",
      "consenso", "riservatezza",
      "toestemming", "privacybeleid", "avg",
      "συγκατάθεση", "απόρρητο",
    ],

    // Known CMP-specific "reject all" selectors, tried before generic matching.
    SPECIFIC_REJECT: [
      "#onetrust-reject-all-handler",
      ".onetrust-reject-all-handler",
      "#onetrust-pc-btn-handler", // OneTrust "Reject All" in preferences
      "#CybotCookiebotDialogBodyButtonDecline",
      ".cky-btn-reject",
      "#qc-cmp2-container button[class*='reject']",
      ".qc-cmp2-button-reject",
      "#truste-consent-content .truste-button2", // TrustArc reject-ish
      ".osano-cm-denyAll",
      "#didomiHost .didomi-components-button--deny" ,
    ],
  };

  const NCPLabels = { normalize };
  for (const key of Object.keys(RAW)) {
    NCPLabels[key] = RAW[key].map(normalize).filter(Boolean);
  }

  if (typeof module !== "undefined" && module.exports) module.exports = NCPLabels;
  else global.NCPLabels = NCPLabels;
})(typeof window !== "undefined" ? window : globalThis);
