"use strict";

/* global chrome */

const siteEl = document.getElementById("site");
const statusEl = document.getElementById("status");
const noteEl = document.getElementById("note");
const rejectBtn = document.getElementById("rejectNow");
const blockBtn = document.getElementById("toggleBlock");

let currentTab = null;
let currentHost = "";

function sendToBackground(msg) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(msg, (res) => {
        void chrome.runtime.lastError;
        resolve(res || {});
      });
    } catch (e) {
      resolve({});
    }
  });
}

function queryTopFrame(tabId) {
  return new Promise((resolve) => {
    try {
      chrome.tabs.sendMessage(tabId, { type: "ncp:frame-status" }, { frameId: 0 }, (res) => {
        void chrome.runtime.lastError;
        resolve(res || null);
      });
    } catch (e) {
      resolve(null);
    }
  });
}

async function refresh() {
  if (!currentTab || !currentHost) return;
  const bg = await sendToBackground({ type: "ncp:status", host: currentHost });
  const frame = await queryTopFrame(currentTab.id);

  if (!frame) {
    statusEl.textContent = "Not active on this page (browser-internal page?).";
  } else {
    const parts = [];
    if (frame.rejected) parts.push("cookie banner auto-rejected");
    else if (frame.handled) parts.push("banner handled");
    else if (frame.bannerFound) parts.push("banner detected, no reject-all found");
    else parts.push("no cookie banner detected");
    if (frame.promptVisible) parts.push("asking you on the page");
    if (bg.blocked) parts.push("cookies blocked for this site (session)");
    statusEl.textContent = parts.join(" · ");
  }

  if (bg.blocked) {
    blockBtn.textContent = "Unblock cookies on this site";
    blockBtn.classList.add("blocking");
  } else {
    blockBtn.textContent = "Block cookies on this site (until browser closes)";
    blockBtn.classList.remove("blocking");
  }

  if (bg.supported === false) {
    noteEl.textContent = "This browser cannot strip cookie headers; only banner rejection/hiding is available.";
  } else {
    noteEl.textContent = "";
  }
}

async function init() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tabs && tabs[0];
  } catch (e) {
    currentTab = null;
  }
  if (!currentTab || !currentTab.url) {
    siteEl.textContent = "(unknown page)";
    statusEl.textContent = "Cannot inspect this tab.";
    return;
  }
  try {
    currentHost = new URL(currentTab.url).hostname;
  } catch (e) {
    currentHost = "";
  }
  siteEl.textContent = currentHost || currentTab.url;
  await refresh();
}

rejectBtn.addEventListener("click", async () => {
  if (!currentTab) return;
  try {
    chrome.tabs.sendMessage(currentTab.id, { type: "ncp:force-run" }, () => {
      void chrome.runtime.lastError;
    });
  } catch (e) {}
  statusEl.textContent = "Re-scanning page…";
  setTimeout(refresh, 900);
});

blockBtn.addEventListener("click", async () => {
  if (!currentHost) return;
  const bg = await sendToBackground({ type: "ncp:status", host: currentHost });
  const res = bg.blocked
    ? await sendToBackground({ type: "ncp:unblock", host: currentHost })
    : await sendToBackground({ type: "ncp:block", host: currentHost });
  if (res && res.ok === false) {
    noteEl.textContent = "Cookie-header blocking failed here: " + (res.error || "not supported in this browser") + ". Banner hiding still works.";
  }
  await refresh();
});

init();
