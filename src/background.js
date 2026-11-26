"use strict";

// NoCookiesPlease background worker.
// Privacy contract: this worker never performs network requests and never
// touches chrome.storage. All state (prompted hosts, cookie-blocked hosts)
// lives in memory or in session-scoped declarativeNetRequest rules, both of
// which are wiped when the browser closes.

const promptedHosts = new Set();
const blockedHosts = new Map(); // host -> session rule id
let nextRuleId = 1;

const dnr =
  typeof chrome !== "undefined" && chrome.declarativeNetRequest
    ? chrome.declarativeNetRequest
    : null;

const ALL_RESOURCE_TYPES = [
  "main_frame", "sub_frame", "stylesheet", "script", "image", "font", "object",
  "xmlhttprequest", "ping", "csp_report", "media", "websocket", "webtransport",
  "webbundle", "other",
];

function dnrSupported() {
  return !!(dnr && dnr.updateSessionRules && dnr.getSessionRules);
}

function blockRule(host, id) {
  return {
    id,
    priority: 1,
    action: {
      type: "modifyHeaders",
      responseHeaders: [
        { header: "set-cookie", operation: "remove" },
        { header: "set-cookie2", operation: "remove" },
      ],
    },
    condition: {
      requestDomains: [host],
      resourceTypes: ALL_RESOURCE_TYPES,
    },
  };
}

async function addBlock(host) {
  if (!dnrSupported()) return { ok: false, supported: false };
  if (blockedHosts.has(host)) return { ok: true, supported: true };
  try {
    const existing = await dnr.getSessionRules();
    for (const r of existing) {
      const d = r.condition && r.condition.requestDomains;
      if (d && d.length) blockedHosts.set(d[0], r.id);
    }
    const id = blockedHosts.get(host) || nextRuleId++;
    await dnr.updateSessionRules({ addRules: [blockRule(host, id)] });
    blockedHosts.set(host, id);
    return { ok: true, supported: true };
  } catch (e) {
    return { ok: false, supported: false, error: String(e && e.message ? e.message : e) };
  }
}

async function removeBlock(host) {
  if (!dnrSupported()) return { ok: false, supported: false };
  try {
    const id = blockedHosts.get(host);
    if (id !== undefined) {
      await dnr.updateSessionRules({ removeRuleIds: [id] });
    }
    blockedHosts.delete(host);
    return { ok: true, supported: true };
  } catch (e) {
    return { ok: false, supported: false, error: String(e && e.message ? e.message : e) };
  }
}

function broadcastToTab(tabId, message) {
  try {
    chrome.tabs.sendMessage(tabId, message, () => {
      void chrome.runtime.lastError;
    });
  } catch (e) {}
}

function hostFromSender(sender, msgHost) {
  if (msgHost) return msgHost;
  try {
    if (sender && sender.tab && sender.tab.url) return new URL(sender.tab.url).hostname;
  } catch (e) {}
  return "";
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg !== "object" || typeof msg.type !== "string") return;
  if (!msg.type.startsWith("ncp:")) return;
  const host = hostFromSender(sender, msg.host);

  switch (msg.type) {
    case "ncp:status":
      sendResponse({
        blocked: blockedHosts.has(host),
        prompted: promptedHosts.has(host),
        supported: dnrSupported(),
      });
      return false;

    case "ncp:shouldPrompt":
      sendResponse({ prompt: !promptedHosts.has(host) && !blockedHosts.has(host) });
      return false;

    case "ncp:markPrompted":
      if (host) promptedHosts.add(host);
      sendResponse({ ok: true });
      return false;

    case "ncp:block":
      addBlock(host).then((res) => {
        if (res.ok && sender && sender.tab) {
          broadcastToTab(sender.tab.id, { type: "ncp:hide-banner" });
        }
        sendResponse(res);
      });
      return true;

    case "ncp:unblock":
      removeBlock(host).then((res) => sendResponse(res));
      return true;

    case "ncp:decision":
      if (host) promptedHosts.add(host);
      if (msg.action === "block") {
        addBlock(host).then((res) => {
          if (res.ok && sender && sender.tab) {
            broadcastToTab(sender.tab.id, { type: "ncp:hide-banner" });
          }
          sendResponse(res);
        });
        return true;
      }
      if (msg.action === "hide" && sender && sender.tab) {
        broadcastToTab(sender.tab.id, { type: "ncp:hide-banner" });
      }
      sendResponse({ ok: true });
      return false;

    default:
      return false;
  }
});

// Rebuild the in-memory blocked map from still-active session rules in case
// the service worker was restarted mid-session.
if (dnrSupported()) {
  dnr.getSessionRules()
    .then((rules) => {
      for (const r of rules) {
        const d = r.condition && r.condition.requestDomains;
        if (d && d.length) {
          blockedHosts.set(d[0], r.id);
          if (r.id >= nextRuleId) nextRuleId = r.id + 1;
        }
      }
    })
    .catch(() => {});
}
