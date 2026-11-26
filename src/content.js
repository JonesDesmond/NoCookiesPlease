(function () {
  "use strict";

  if (window.__ncpContentLoaded) return;
  window.__ncpContentLoaded = true;

  const L = window.NCPLabels;
  const M = window.NCPMatcher;

  const IS_TOP = window.top === window;
  const HOST = location.hostname;
  const PROMPT_HOST_ID = "ncp-prompt-host";

  const BTN_SEL = "button, [role='button'], a, input[type='submit'], input[type='button']";
  const TOGGLE_SEL = "input[type='checkbox'], input[type='radio'], [role='switch'], [role='checkbox'], [aria-pressed], [aria-checked]";

  const SCAN_TICK_MS = 400;
  const SCAN_WINDOW_MS = 25000;
  const SETTINGS_RETRY_MS = 2500;
  const PROMPT_DELAY_MS =
    typeof window !== "undefined" && typeof window.__ncpPromptDelay === "number"
      ? window.__ncpPromptDelay
      : 6000;

  const state = {
    handled: false,
    rejected: false,
    bannerFound: false,
    promptVisible: false,
    promptAllowed: null,
    hideMode: false,
    lastSettingsClick: 0,
    startedAt: 0,
  };

  // ---------- shadow-DOM-aware traversal ----------

  function isNcpNode(el) {
    let node = el;
    while (node) {
      if (node.nodeType === 1 && node.id === PROMPT_HOST_ID) return true;
      const root = node.getRootNode ? node.getRootNode() : null;
      node = root && root.host ? root.host : null;
    }
    return false;
  }

  function deepQueryAll(selector, root) {
    const out = [];
    let budget = 20000;
    const stack = [root || document];
    while (stack.length && budget > 0) {
      const node = stack.pop();
      let els;
      try {
        els = node.querySelectorAll(selector);
      } catch (e) {
        continue;
      }
      for (const el of els) {
        budget--;
        if (isNcpNode(el)) continue;
        out.push(el);
      }
      let all;
      try {
        all = node.querySelectorAll("*");
      } catch (e) {
        continue;
      }
      for (const el of all) {
        budget--;
        if (budget <= 0) break;
        if (el.shadowRoot && !isNcpNode(el)) stack.push(el.shadowRoot);
      }
    }
    return out;
  }

  function visible(el) {
    try {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    } catch (e) {
      return false;
    }
  }

  function clickEl(el) {
    try {
      el.click();
    } catch (e) {}
    try {
      el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    } catch (e) {}
    return true;
  }

  // ---------- banner discovery ----------

  function isButtonish(el) {
    if (!el || el.nodeType !== 1) return false;
    const tag = el.tagName;
    if (tag === "BUTTON" || tag === "A") return true;
    if (tag === "INPUT") {
      const t = (el.getAttribute("type") || "").toLowerCase();
      return t === "submit" || t === "button";
    }
    if (el.getAttribute("role") === "button") return true;
    const cls = typeof el.className === "string" ? el.className : "";
    return /(^|\s|[_-])(btn|button)/i.test(cls);
  }

  // Walk up from each button to the nearest small ancestor whose text mentions
  // cookies/consent/privacy — that ancestor is treated as a banner container.
  function findBanners() {
    const found = new Set();
    const btns = deepQueryAll(BTN_SEL);
    for (const b of btns) {
      if (!isButtonish(b)) continue;
      let node = b;
      for (let i = 0; i < 10 && node; i++) {
        const root = node.getRootNode ? node.getRootNode() : null;
        node = node.parentElement || (root && root.host) || null;
        if (!node || node.nodeType !== 1 || isNcpNode(node)) continue;
        const txt = M.normalizeText(node.textContent || "");
        if (txt.length > 3000) continue;
        if (M.isBannerText(txt)) {
          found.add(node);
          break;
        }
      }
    }
    return Array.from(found);
  }

  // ---------- actions ----------

  function tryReject() {
    for (const sel of L.SPECIFIC_REJECT) {
      let els;
      try {
        els = deepQueryAll(sel);
      } catch (e) {
        continue;
      }
      for (const el of els) {
        if (visible(el)) {
          clickEl(el);
          state.rejected = true;
          state.handled = true;
          return true;
        }
      }
    }
    for (const banner of findBanners()) {
      for (const b of deepQueryAll(BTN_SEL, banner)) {
        if (!isButtonish(b)) continue;
        const label = M.elementLabel(b, false);
        if (M.isRejectAll(label) && visible(b)) {
          clickEl(b);
          state.rejected = true;
          state.handled = true;
          return true;
        }
      }
    }
    return false;
  }

  function tryOpenSettings() {
    const now = Date.now();
    if (now - state.lastSettingsClick < SETTINGS_RETRY_MS) return false;
    for (const banner of findBanners()) {
      for (const b of deepQueryAll(BTN_SEL, banner)) {
        if (!isButtonish(b)) continue;
        if (M.isSettings(M.elementLabel(b, false)) && visible(b)) {
          state.lastSettingsClick = now;
          clickEl(b);
          return true;
        }
      }
    }
    return false;
  }

  function handleToggles() {
    let changed = false;
    for (const banner of findBanners()) {
      for (const t of deepQueryAll(TOGGLE_SEL, banner)) {
        const label = M.elementLabel(t, true);
        if (M.isLegitimateInterest(label)) {
          if (M.toggleIsOn(t)) {
            clickEl(t);
            changed = true;
          }
          continue;
        }
        if (M.isNecessary(label)) continue;
        if (M.isOptionalCategory(label)) {
          if (M.toggleIsOn(t)) {
            clickEl(t);
            changed = true;
          }
        }
      }
    }
    return changed;
  }

  function trySave() {
    for (const banner of findBanners()) {
      for (const b of deepQueryAll(BTN_SEL, banner)) {
        if (!isButtonish(b)) continue;
        if (M.isSave(M.elementLabel(b, false)) && visible(b)) {
          clickEl(b);
          state.rejected = true;
          state.handled = true;
          return true;
        }
      }
    }
    return false;
  }

  const hiddenBanners = new WeakSet();
  function hideBanners() {
    for (const banner of findBanners()) {
      if (hiddenBanners.has(banner)) continue;
      try {
        banner.style.setProperty("display", "none", "important");
        hiddenBanners.add(banner);
      } catch (e) {}
    }
  }

  // ---------- per-site prompt (top frame only) ----------

  function sendMsg(msg) {
    try {
      chrome.runtime.sendMessage(msg, () => {
        void chrome.runtime.lastError;
      });
    } catch (e) {}
  }

  function askShouldPrompt() {
    if (state.promptAllowed !== null) return;
    try {
      chrome.runtime.sendMessage({ type: "ncp:shouldPrompt", host: HOST }, (res) => {
        void chrome.runtime.lastError;
        state.promptAllowed = !!(res && res.prompt);
        if (state.promptAllowed) {
          sendMsg({ type: "ncp:markPrompted", host: HOST });
          showPrompt();
        }
      });
    } catch (e) {
      state.promptAllowed = false;
    }
  }

  function showPrompt() {
    if (state.promptVisible || !document.documentElement) return;
    state.promptVisible = true;

    const hostEl = document.createElement("div");
    hostEl.id = PROMPT_HOST_ID;
    document.documentElement.appendChild(hostEl);
    const root = hostEl.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = [
      ".ncp-card{position:fixed;right:12px;bottom:12px;z-index:2147483647;max-width:320px;",
      "background:#1e1f24;color:#f1f1f1;font:13px/1.45 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;",
      "border:1px solid #3a3d46;border-radius:10px;padding:12px 14px;box-shadow:0 8px 28px rgba(0,0,0,.45);}",
      ".ncp-card h1{font-size:13px;margin:0 0 6px;font-weight:600;}",
      ".ncp-card p{margin:0 0 10px;color:#c9cbd1;}",
      ".ncp-card .ncp-row{display:flex;flex-wrap:wrap;gap:6px;}",
      ".ncp-card button{cursor:pointer;border:1px solid #4a4e59;background:#2b2d34;color:#f1f1f1;",
      "border-radius:6px;padding:6px 10px;font-size:12px;}",
      ".ncp-card button:hover{background:#383b44;}",
      ".ncp-card button.ncp-primary{background:#7a2e2e;border-color:#9c3a3a;}",
      ".ncp-card button.ncp-primary:hover{background:#8f3636;}",
      ".ncp-card .ncp-note{margin:8px 0 0;font-size:11px;color:#8b8e96;}",
    ].join("");
    root.appendChild(style);

    const card = document.createElement("div");
    card.className = "ncp-card";

    const h = document.createElement("h1");
    h.textContent = "NoCookiesPlease";
    card.appendChild(h);

    const p = document.createElement("p");
    p.textContent =
      "No \u201creject all\u201d option was found on " + HOST +
      ". What should happen? (applies until the browser closes; nothing is stored)";
    card.appendChild(p);

    const row = document.createElement("div");
    row.className = "ncp-row";

    const mkBtn = (label, primary, action) => {
      const b = document.createElement("button");
      b.textContent = label;
      if (primary) b.className = "ncp-primary";
      b.addEventListener("click", () => {
        sendMsg({ type: "ncp:decision", host: HOST, action });
        if (action !== "leave") {
          state.hideMode = true;
          hideBanners();
        }
        state.promptVisible = false;
        try {
          hostEl.remove();
        } catch (e) {}
      });
      return b;
    };

    row.appendChild(mkBtn("Hide banner", false, "hide"));
    row.appendChild(mkBtn("Hide + block cookies (this session)", true, "block"));
    row.appendChild(mkBtn("Leave banner", false, "leave"));
    card.appendChild(row);

    const note = document.createElement("div");
    note.className = "ncp-note";
    note.textContent = "Fully local — no data is stored or sent anywhere.";
    card.appendChild(note);

    root.appendChild(card);
  }

  // ---------- scan loop ----------

  function runScan() {
    if (state.hideMode) {
      hideBanners();
      return;
    }
    const banners = findBanners();
    state.bannerFound = banners.length > 0;

    if (state.handled) {
      if (banners.length > 0) tryReject();
      return;
    }

    if (tryReject()) return;

    handleToggles();
    if (trySave()) return;
    tryOpenSettings();

    if (banners.length > 0 && IS_TOP && Date.now() - state.startedAt > PROMPT_DELAY_MS) {
      askShouldPrompt();
    }
  }

  // ---------- messaging ----------

  try {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (!msg || typeof msg !== "object") return;
      if (msg.type === "ncp:hide-banner") {
        state.hideMode = true;
        hideBanners();
      } else if (msg.type === "ncp:force-run") {
        state.handled = false;
        runScan();
        sendResponse({ ok: true });
      } else if (msg.type === "ncp:frame-status") {
        sendResponse({
          host: HOST,
          isTop: IS_TOP,
          handled: state.handled,
          rejected: state.rejected,
          bannerFound: state.bannerFound,
          promptVisible: state.promptVisible,
          hideMode: state.hideMode,
        });
      }
    });
  } catch (e) {}

  // ---------- init ----------

  function init() {
    state.startedAt = Date.now();
    try {
      chrome.runtime.sendMessage({ type: "ncp:status", host: HOST }, (res) => {
        void chrome.runtime.lastError;
        if (res && res.blocked) {
          state.hideMode = true;
        }
      });
    } catch (e) {}

    const start = Date.now();
    const tick = () => {
      try {
        runScan();
      } catch (e) {}
      if (Date.now() - start < SCAN_WINDOW_MS) setTimeout(tick, SCAN_TICK_MS);
    };
    tick();

    try {
      const obs = new MutationObserver(() => {
        if (state.hideMode) hideBanners();
      });
      obs.observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) {}

    window.addEventListener("load", () => setTimeout(() => {
      try {
        runScan();
      } catch (e) {}
    }, 300));
  }

  if (document.documentElement) init();
  else document.addEventListener("DOMContentLoaded", init);
})();
