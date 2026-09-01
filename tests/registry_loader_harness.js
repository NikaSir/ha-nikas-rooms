const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const frontendPath = path.join(
  __dirname,
  "..",
  "custom_components",
  "nikas_rooms",
  "frontend",
  "nikas-rooms-panel.js",
);

let PanelClass = null;

class FakeHTMLElement {
  constructor() {
    this.isConnected = true;
    this.shadowRoot = null;
  }

  attachShadow() {
    this.shadowRoot = {
      getElementById: () => null,
      querySelector: () => null,
    };
    return this.shadowRoot;
  }
}

const storage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

const location = {
  href: "http://homeassistant.local/dashboard-rooms-v11/rooms",
  origin: "http://homeassistant.local",
  pathname: "/dashboard-rooms-v11/rooms",
  search: "",
  hash: "",
};

const context = {
  console,
  URL,
  Map,
  Set,
  Promise,
  Date,
  Error,
  Array,
  Math,
  JSON,
  HTMLElement: FakeHTMLElement,
  CustomEvent: class CustomEvent {},
  Event: class Event {},
  localStorage: storage,
  sessionStorage: storage,
  document: { referrer: "" },
  customElements: {
    get: () => undefined,
    define: (_name, constructor) => {
      PanelClass = constructor;
    },
  },
  window: {
    location,
    history: { replaceState: () => {}, pushState: () => {} },
    addEventListener: () => {},
    removeEventListener: () => {},
    setTimeout,
    clearTimeout,
    requestAnimationFrame: (callback) => setTimeout(callback, 0),
    cancelAnimationFrame: clearTimeout,
    visualViewport: null,
  },
};
context.globalThis = context;

vm.runInNewContext(fs.readFileSync(frontendPath, "utf8"), context, {
  filename: frontendPath,
});

assert.ok(PanelClass, "panel web component was not registered");

const makePanel = (hass) => {
  const panel = new PanelClass();
  panel._hass = hass;
  panel.mountShell = () => {};
  panel.syncRefreshState = () => {};
  panel.buildRooms = () => {};
  panel.renderRoute = () => {
    panel.__renderCount = (panel.__renderCount || 0) + 1;
  };
  return panel;
};

const never = new Promise(() => {});
const responseFor = ({ type }) => (
  type === "config/label_registry/list" ? never : Promise.resolve([])
);

const run = async () => {
  const direct = makePanel({ callWS: responseFor });
  await Promise.race([
    direct.loadRegistries(),
    new Promise((_, reject) => setTimeout(
      () => reject(new Error("core registries waited for the optional label registry")),
      250,
    )),
  ]);
  assert.equal(direct.__renderCount, 1);
  assert.equal(Array.isArray(direct._registries.areas), true);
  assert.equal(direct._registries.areas.length, 0);
  assert.equal(Array.isArray(direct._registries.labels), true);
  assert.equal(direct._registries.labels.length, 0);

  const fallback = makePanel({
    connection: { sendMessagePromise: responseFor },
  });
  await Promise.race([
    fallback.loadRegistries(),
    new Promise((_, reject) => setTimeout(
      () => reject(new Error("connection transport fallback did not finish")),
      250,
    )),
  ]);
  assert.equal(fallback.__renderCount, 1);

  console.log("registry loader harness passed");
  process.exit(0);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
