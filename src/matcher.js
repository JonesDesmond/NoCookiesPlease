(function (global) {
  "use strict";

  const L =
    (typeof window !== "undefined" && window.NCPLabels) ||
    (typeof module !== "undefined" && module.exports ? require("./labels.js") : null);

  function normalizeText(s) {
    return L.normalize(s);
  }

  function matchesAny(text, patterns) {
    const t = normalizeText(text);
    if (!t) return false;
    for (const p of patterns) {
      if (t.includes(p)) return true;
    }
    return false;
  }

  function isRejectAll(text) {
    return matchesAny(text, L.REJECT_ALL);
  }

  function isSettings(text) {
    return matchesAny(text, L.SETTINGS);
  }

  function isSave(text) {
    return matchesAny(text, L.SAVE);
  }

  function isNecessary(text) {
    return matchesAny(text, L.NECESSARY);
  }

  function isOptionalCategory(text) {
    return matchesAny(text, L.OPTIONAL);
  }

  function isLegitimateInterest(text) {
    return matchesAny(text, L.LEGITIMATE_INTEREST);
  }

  function isBannerText(text) {
    return matchesAny(text, L.BANNER_KEYWORDS);
  }

  // Best-effort "on" detection for switches / checkboxes / toggle buttons.
  function toggleIsOn(el) {
    if (!el) return false;
    try {
      if (el.tagName === "INPUT") {
        const type = (el.type || el.getAttribute("type") || "").toLowerCase();
        if (type === "checkbox" || type === "radio") return !!el.checked;
        return false;
      }
      const ac = el.getAttribute("aria-checked");
      if (ac !== null && ac !== undefined) return ac === "true";
      const ap = el.getAttribute("aria-pressed");
      if (ap !== null && ap !== undefined) return ap === "true";
      const cls = typeof el.className === "string" ? el.className.toLowerCase() : "";
      return /\b(on|active|checked|enabled|selected)\b/.test(cls);
    } catch (e) {
      return false;
    }
  }

  function isButtonishEl(el) {
    if (!el || el.nodeType !== 1) return false;
    const tag = el.tagName;
    if (tag === "BUTTON" || tag === "A") return true;
    if (tag === "INPUT") {
      const t = (el.type || el.getAttribute("type") || "").toLowerCase();
      return t === "submit" || t === "button";
    }
    return el.getAttribute("role") === "button";
  }

  function directText(el) {
    try {
      if (el.childNodes) {
        let t = "";
        for (const n of el.childNodes) {
          if (n.nodeType === 3) t += n.nodeValue + " ";
        }
        return t;
      }
    } catch (e) {}
    return el._text || "";
  }

  // Text surrounding an element (for toggles whose label is a sibling span),
  // excluding button-like siblings so a banner's other buttons don't leak in.
  function contextText(el) {
    const parts = [];
    let node = el.parentElement;
    for (let i = 0; i < 3 && node; i++) {
      parts.push(directText(node));
      try {
        for (const c of node.children || []) {
          if (c === el || isButtonishEl(c)) continue;
          parts.push(c.textContent || "");
        }
      } catch (e) {}
      node = node.parentElement;
    }
    return parts.join(" ").slice(0, 240);
  }

  // Collect every human-readable string that could label an element.
  // includeContext=false (buttons): own text + ARIA/label associations only.
  // includeContext=true (toggles): also surrounding non-button text.
  function elementLabel(el, includeContext) {
    if (!el) return "";
    const parts = [];
    const ga = (name) => {
      try {
        return el.getAttribute(name) || "";
      } catch (e) {
        return "";
      }
    };
    parts.push(ga("aria-label"));
    const labelledby = ga("aria-labelledby");
    if (labelledby) {
      const root = el.getRootNode ? el.getRootNode() : null;
      for (const id of labelledby.split(/\s+/)) {
        try {
          const ref = root && root.getElementById ? root.getElementById(id) : null;
          if (ref) parts.push(ref.textContent || "");
        } catch (e) {}
      }
    }
    try {
      if (el.labels) for (const lab of el.labels) parts.push(lab.textContent || "");
    } catch (e) {}
    try {
      const lab = el.closest && el.closest("label");
      if (lab) parts.push(lab.textContent || "");
    } catch (e) {}
    parts.push(ga("title"), ga("placeholder"), ga("value"));
    try {
      if (el.tagName === "INPUT" && el.value) parts.push(el.value);
    } catch (e) {}
    try {
      parts.push(el.innerText || el.textContent || "");
    } catch (e) {}
    if (includeContext) parts.push(contextText(el));
    return parts.join(" ");
  }

  const api = {
    normalizeText,
    matchesAny,
    isRejectAll,
    isSettings,
    isSave,
    isNecessary,
    isOptionalCategory,
    isLegitimateInterest,
    isBannerText,
    toggleIsOn,
    elementLabel,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.NCPMatcher = api;
})(typeof window !== "undefined" ? window : globalThis);
