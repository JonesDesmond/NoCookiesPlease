"use strict";

// Smoke test for src/content.js using a minimal fake DOM.
// Usage: node test/content.smoke.test.js <reject|toggles|prompt>

const assert = require("assert");

// ---------- tiny fake DOM ----------

function matchCompound(el, part) {
  if (!el || el.nodeType !== 1) return false;
  const re = /(^[a-zA-Z][\w-]*)|#([\w-]+)|\.([\w-]+)|\[([\w-]+)(?:([*^$]?=)["']?([^'"\]]*)["']?)?\]/g;
  let m;
  let matched = false;
  while ((m = re.exec(part)) !== null) {
    matched = true;
    if (m[1]) {
      if (el.tagName !== m[1].toUpperCase()) return false;
    } else if (m[2]) {
      if (el.id !== m[2]) return false;
    } else if (m[3]) {
      if (!(" " + (el.className || "") + " ").includes(" " + m[3] + " ")) return false;
    } else if (m[4]) {
      const v = el.getAttribute(m[4]);
      if (v === null || v === undefined) return false;
      if (m[5] === "=" && v !== m[6]) return false;
      if (m[5] === "*=" && !v.includes(m[6])) return false;
      if (m[5] === "^=" && !v.startsWith(m[6])) return false;
      if (m[5] === "$=" && !v.endsWith(m[6])) return false;
    }
  }
  return matched;
}

function queryAll(root, selector) {
  const out = [];
  const groups = selector.split(",");
  const walk = (node) => {
    for (const c of node.children || []) {
      for (const g of groups) {
        const parts = g.trim().split(/\s+/);
        if (!matchCompound(c, parts[parts.length - 1])) continue;
        let anc = c.parentElement;
        let ok = true;
        for (let i = parts.length - 2; i >= 0; i--) {
          let found = null;
          while (anc) {
            if (matchCompound(anc, parts[i])) {
              found = anc;
              break;
            }
            anc = anc.parentElement;
          }
          if (!found) {
            ok = false;
            break;
          }
          anc = found.parentElement;
        }
        if (ok) {
          out.push(c);
          break;
        }
      }
      walk(c);
    }
  };
  walk(root);
  return out;
}

class ShadowRoot {
  constructor(host) {
    this.host = host;
    this.children = [];
  }
  appendChild(c) {
    c._root = this;
    this.children.push(c);
    return c;
  }
  querySelectorAll(sel) {
    return queryAll(this, sel);
  }
  getElementById(id) {
    const all = queryAll(this, "*");
    return all.find((e) => e.id === id) || null;
  }
}

class El {
  constructor(tag) {
    this.nodeType = 1;
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.parentElement = null;
    this._root = null;
    this.attributes = {};
    this.id = "";
    this.className = "";
    this._text = "";
    this.shadowRoot = null;
    this.checked = false;
    this.clicked = 0;
    this.listeners = {};
    this.onClickCb = null;
    this.labels = null;
    this.value = "";
    const self = this;
    this.style = {
      _props: {},
      setProperty(k, v) {
        self.style._props[k] = v;
      },
    };
  }
  get textContent() {
    return this._text + this.children.map((c) => c.textContent).join("");
  }
  set textContent(v) {
    this._text = String(v);
    this.children = [];
  }
  get innerText() {
    return this.textContent;
  }
  appendChild(c) {
    c.parentElement = this;
    this.children.push(c);
    return c;
  }
  remove() {
    if (this.parentElement) {
      const i = this.parentElement.children.indexOf(this);
      if (i >= 0) this.parentElement.children.splice(i, 1);
      this.parentElement = null;
    }
  }
  setAttribute(n, v) {
    this.attributes[n] = String(v);
    if (n === "id") this.id = String(v);
    if (n === "class") this.className = String(v);
    if (n === "type") this.type = String(v);
  }
  getAttribute(n) {
    return n in this.attributes ? this.attributes[n] : null;
  }
  attachShadow() {
    this.shadowRoot = new ShadowRoot(this);
    return this.shadowRoot;
  }
  getRootNode() {
    if (this._root) return this._root;
    let n = this;
    while (n.parentElement) n = n.parentElement;
    return n;
  }
  querySelectorAll(sel) {
    return queryAll(this, sel);
  }
  getElementById(id) {
    return queryAll(this, "*").find((e) => e.id === id) || null;
  }
  closest(sel) {
    let n = this;
    while (n) {
      if (matchCompound(n, sel)) return n;
      n = n.parentElement;
    }
    return null;
  }
  getBoundingClientRect() {
    return { width: 10, height: 10 };
  }
  addEventListener(type, fn) {
    (this.listeners[type] = this.listeners[type] || []).push(fn);
  }
  dispatchEvent(ev) {
    if (ev && ev.type === "click") this._fireClick();
    return true;
  }
  _fireClick() {
    for (const fn of this.listeners.click || []) {
      try {
        fn({ type: "click" });
      } catch (e) {}
    }
  }
  click() {
    this.clicked++;
    if (this.tagName === "INPUT" && (this.getAttribute("type") || "").toLowerCase() === "checkbox") {
      this.checked = !this.checked;
    }
    const ac = this.getAttribute("aria-checked");
    if (ac !== null) this.setAttribute("aria-checked", ac === "true" ? "false" : "true");
    this._fireClick();
    if (this.onClickCb) this.onClickCb();
  }
}

// ---------- fake browser environment ----------

const sentMessages = [];
let messageListener = null;

const doc = new El("#document");
doc.nodeType = 9;
doc.documentElement = new El("html");
doc.appendChild(doc.documentElement);
doc.body = new El("body");
doc.documentElement.appendChild(doc.body);
doc.addEventListener = () => {};
doc.createElement = (tag) => new El(tag);

const fakeWindow = {
  addEventListener: () => {},
  NCPLabels: require("../src/labels.js"),
  NCPMatcher: require("../src/matcher.js"),
  __ncpPromptDelay: 50,
};
fakeWindow.top = fakeWindow;

global.window = fakeWindow;
global.document = doc;
global.location = { hostname: "example.com" };
global.MutationObserver = class {
  observe() {}
};
global.MouseEvent = class {
  constructor(type) {
    this.type = type;
  }
};
global.chrome = {
  runtime: {
    lastError: null,
    onMessage: {
      addListener(fn) {
        messageListener = fn;
      },
    },
    sendMessage(msg, cb) {
      sentMessages.push(msg);
      if (!cb) return;
      if (msg.type === "ncp:status") cb({ blocked: false, prompted: false, supported: true });
      else if (msg.type === "ncp:shouldPrompt") cb({ prompt: true });
      else cb({ ok: true });
    },
  },
};

// ---------- scenario builders ----------

function el(tag, text, attrs) {
  const e = new El(tag);
  if (text) e._text = text;
  if (attrs) for (const k of Object.keys(attrs)) e.setAttribute(k, attrs[k]);
  return e;
}

function buildRejectBanner() {
  const banner = el("div", "We value your privacy. We use cookies.");
  const accept = el("button", "Accept all");
  const reject = el("button", "Reject all");
  banner.appendChild(accept);
  banner.appendChild(reject);
  doc.body.appendChild(banner);
  return { banner, accept, reject };
}

function buildTogglesBanner() {
  const banner = el("div", "This site uses cookies to improve your experience.");
  const manage = el("button", "Manage preferences");
  banner.appendChild(manage);
  doc.body.appendChild(banner);

  const panel = el("div", "Cookie preferences — choose what you allow.");
  const liLabel = el("label", "Legitimate interest");
  const li = el("input", "", { type: "checkbox", "aria-checked": "true" });
  li.checked = true;
  li.labels = [liLabel];
  const mktLabel = el("label", "Marketing");
  const mkt = el("input", "", { type: "checkbox" });
  mkt.checked = true;
  mkt.labels = [mktLabel];
  const necLabel = el("label", "Strictly necessary cookies");
  const nec = el("input", "", { type: "checkbox" });
  nec.checked = true;
  nec.labels = [necLabel];
  const save = el("button", "Save my choices");
  panel.appendChild(li);
  panel.appendChild(mkt);
  panel.appendChild(nec);
  panel.appendChild(save);
  manage.onClickCb = () => {
    doc.body.appendChild(panel);
  };
  return { banner, manage, panel, li, mkt, nec, save };
}

function buildAcceptOnlyBanner() {
  const banner = el("div", "We use cookies. Accept our privacy policy.");
  const accept = el("button", "Accept all");
  banner.appendChild(accept);
  doc.body.appendChild(banner);
  return { banner, accept };
}

// ---------- run ----------

const scenario = process.argv[2];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  let built;
  if (scenario === "reject") built = buildRejectBanner();
  else if (scenario === "toggles") built = buildTogglesBanner();
  else if (scenario === "prompt") built = buildAcceptOnlyBanner();
  else throw new Error("unknown scenario: " + scenario);

  require("../src/content.js");

  if (scenario === "reject") {
    await sleep(300);
    assert.ok(built.reject.clicked > 0, "reject-all button must be clicked");
    assert.strictEqual(built.accept.clicked, 0, "accept-all must NOT be clicked");
    assert.ok(
      !queryAll(doc, "#ncp-prompt-host").length,
      "no prompt should appear when reject succeeds"
    );
    console.log("scenario reject: OK");
  } else if (scenario === "toggles") {
    await sleep(1500);
    assert.ok(built.manage.clicked > 0, "manage/settings button must be clicked");
    assert.strictEqual(built.li.checked, false, "legitimate interest toggle must be OFF");
    assert.strictEqual(built.mkt.checked, false, "marketing toggle must be OFF");
    assert.strictEqual(built.nec.checked, true, "strictly necessary toggle must stay ON");
    assert.ok(built.save.clicked > 0, "save button must be clicked");
    console.log("scenario toggles: OK");
  } else if (scenario === "prompt") {
    await sleep(600);
    assert.strictEqual(built.accept.clicked, 0, "accept-all must NOT be clicked");
    const hosts = queryAll(doc, "#ncp-prompt-host");
    assert.strictEqual(hosts.length, 1, "prompt host must be added to the page");
    assert.ok(
      sentMessages.some((m) => m.type === "ncp:shouldPrompt"),
      "shouldPrompt must be sent to background"
    );
    const blockBtns = queryAll(hosts[0].shadowRoot, "button").filter((b) =>
      b.textContent.includes("block cookies")
    );
    assert.strictEqual(blockBtns.length, 1, "prompt must offer a block option");
    blockBtns[0].click();
    await sleep(50);
    const decision = sentMessages.find((m) => m.type === "ncp:decision");
    assert.ok(decision, "decision message must be sent");
    assert.strictEqual(decision.action, "block");
    assert.strictEqual(decision.host, "example.com");
    assert.strictEqual(
      built.banner.style._props.display,
      "none",
      "banner must be hidden after choosing hide+block"
    );
    console.log("scenario prompt: OK");
  }

  if (messageListener) {
    let statusRes = null;
    messageListener({ type: "ncp:frame-status" }, {}, (r) => {
      statusRes = r;
    });
    assert.ok(statusRes && statusRes.host === "example.com", "frame-status must respond");
  }

  process.exit(0);
}

main().catch((e) => {
  console.error("scenario " + scenario + " FAILED:", e);
  process.exit(1);
});
