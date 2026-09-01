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
    this.__events = [];
  }

  attachShadow() {
    this.shadowRoot = {
      getElementById: () => null,
      querySelector: () => null,
    };
    return this.shadowRoot;
  }

  dispatchEvent(event) {
    this.__events.push(event);
    return true;
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
const navigationEvents = [];

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
  CustomEvent: class CustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      Object.assign(this, init);
    }
  },
  Event: class Event {
    constructor(type, init = {}) {
      this.type = type;
      Object.assign(this, init);
    }
  },
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
    history: {
      replaceState: () => {},
      pushState: (_state, _title, target) => {
        const url = new URL(target, location.origin);
        location.href = url.href;
        location.pathname = url.pathname;
        location.search = url.search;
        location.hash = url.hash;
      },
    },
    dispatchEvent: (event) => navigationEvents.push(event),
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
  panel.renderRoute = (...args) => {
    panel.__renderCount = (panel.__renderCount || 0) + 1;
    panel.__lastRenderArgs = args;
  };
  return panel;
};

const never = new Promise(() => {});
const responseFor = ({ type }) => (
  type === "config/label_registry/list" ? never : Promise.resolve([])
);

const fakeButton = ({ dataset = {}, classes = [], id = "", disabled = false } = {}) => ({
  classList: { contains: (name) => classes.includes(name) },
  dataset,
  disabled,
  id,
  matches: (selector) => selector === "button",
});

const run = async () => {
  const requestedTypes = [];
  const frontendRegistries = makePanel({
    areas: { kitchen: { area_id: "kitchen", name: "Кухня" } },
    devices: {},
    entities: {},
    callWS: ({ type }) => {
      requestedTypes.push(type);
      return type === "config/label_registry/list" ? never : Promise.resolve([]);
    },
  });
  await Promise.race([
    frontendRegistries.loadRegistries(),
    new Promise((_, reject) => setTimeout(
      () => reject(new Error("preloaded Home Assistant registries were not used immediately")),
      250,
    )),
  ]);
  assert.equal(frontendRegistries.__renderCount, 1);
  assert.equal(frontendRegistries._registries.areas.length, 1);
  assert.deepEqual(
    requestedTypes.filter((type) => type !== "config/label_registry/list"),
    [],
  );

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

  const navigationPanel = makePanel({
    panels: {
      "dashboard-house-v11": {
        component_name: "custom",
        config: { _panel_custom: { name: "some-other-panel" } },
        url_path: "dashboard-house-v11",
      },
      "dashboard-house-v12": {
        component_name: "custom",
        config: {
          _panel_custom: { name: "nikas-house-overview" },
          default_path: "/dashboard-house-v12/home",
        },
        url_path: "dashboard-house-v12",
      },
    },
  });
  const visited = [];
  navigationPanel.navigate = (route) => visited.push(route);
  const homeButton = fakeButton({ dataset: { base: "home" } });
  const roomButton = fakeButton({ dataset: { room: "bathroom" } });
  assert.equal(navigationPanel.activateControl(homeButton), true);
  assert.equal(visited.at(-1), "/dashboard-house-v12/home");
  assert.equal(navigationPanel.activateControl(roomButton), true);
  assert.equal(visited.at(-1), "/dashboard-rooms-v11/room-bathroom");
  navigationPanel._rooms = [{ slug: "bathroom", name: "Ванная" }];
  navigationPanel._houseRoute = "/dashboard-house-v12/home";
  navigationPanel._activeRoute = { kind: "room", slug: "bathroom" };
  const diagnosticsButton = fakeButton({ id: "diagnostics" });
  assert.equal(navigationPanel.activateControl(diagnosticsButton), true);
  assert.equal(visited.at(-1), "/dashboard-rooms-v11/room-bathroom/diagnostics");
  assert.equal(
    navigationPanel.headerModel({ kind: "overview" }).backPath,
    "/dashboard-house-v12/home",
  );
  assert.equal(
    navigationPanel.headerModel({ kind: "room", slug: "bathroom" }).backPath,
    "/dashboard-rooms-v11/rooms",
  );
  assert.equal(
    navigationPanel.headerModel({ kind: "diagnostics", slug: "bathroom" }).backPath,
    "/dashboard-rooms-v11/room-bathroom",
  );
  assert.equal(
    navigationPanel.actionButton({ composedPath: () => [roomButton, navigationPanel.shadowRoot] }),
    roomButton,
  );

  const tapVisited = [];
  navigationPanel.navigate = (route) => tapVisited.push(route);
  const pointerEvent = (type, extra = {}) => ({
    cancelable: true,
    clientX: 20,
    clientY: 30,
    composedPath: () => [roomButton, navigationPanel.shadowRoot],
    pointerId: 7,
    pointerType: "touch",
    preventDefault: () => {},
    stopImmediatePropagation: () => {},
    stopPropagation: () => {},
    type,
    ...extra,
  });
  navigationPanel.tapPointerDown(pointerEvent("pointerdown"));
  navigationPanel.tapPointerUp(pointerEvent("pointerup"));
  assert.deepEqual(tapVisited, ["/dashboard-rooms-v11/room-bathroom"]);
  navigationPanel.controlClick(pointerEvent("click"));
  assert.deepEqual(
    tapVisited,
    ["/dashboard-rooms-v11/room-bathroom"],
    "the synthetic click after a touch activation must be deduplicated",
  );

  navigationPanel._manualActivationTarget = null;
  navigationPanel._manualActivationUntil = 0;
  navigationPanel.tapPointerDown(pointerEvent("pointerdown", { pointerId: 8 }));
  navigationPanel.tapPointerMove(pointerEvent("pointermove", {
    clientX: 30,
    pointerId: 8,
  }));
  navigationPanel.tapPointerUp(pointerEvent("pointerup", {
    clientX: 30,
    pointerId: 8,
  }));
  assert.deepEqual(
    tapVisited,
    ["/dashboard-rooms-v11/room-bathroom"],
    "finger movement must not activate a room card",
  );

  const directTouchVisited = [];
  const directTouchPanel = makePanel({});
  directTouchPanel.navigate = (route) => directTouchVisited.push(route);
  const directRoomButton = fakeButton({ dataset: { room: "kitchen" } });
  const directTouch = (x, y) => ({ identifier: 11, clientX: x, clientY: y });
  directTouchPanel.directTouchStart({
    currentTarget: directRoomButton,
    touches: [directTouch(40, 50)],
  });
  let directPrevented = false;
  directTouchPanel.directTouchEnd({
    cancelable: true,
    changedTouches: { 0: directTouch(42, 52), length: 1 },
    currentTarget: directRoomButton,
    preventDefault: () => { directPrevented = true; },
    touches: [],
  });
  assert.deepEqual(directTouchVisited, ["/dashboard-rooms-v11/room-kitchen"]);
  assert.equal(directPrevented, true);
  directTouchPanel.directControlClick({
    currentTarget: directRoomButton,
    preventDefault: () => {},
    stopPropagation: () => {},
  });
  assert.deepEqual(
    directTouchVisited,
    ["/dashboard-rooms-v11/room-kitchen"],
    "the synthetic click after direct touchend must be deduplicated",
  );

  const seamlessNavigationPanel = makePanel({});
  seamlessNavigationPanel.navigate("/dashboard-rooms-v11/room-attic");
  assert.equal(location.pathname, "/dashboard-rooms-v11/room-attic");
  assert.equal(seamlessNavigationPanel.__renderCount, 1);
  assert.equal(seamlessNavigationPanel.__lastRenderArgs[0], true);
  assert.equal(seamlessNavigationPanel.__lastRenderArgs[1].kind, "room");
  assert.equal(seamlessNavigationPanel.__lastRenderArgs[1].slug, "attic");
  assert.equal(navigationEvents.length, 0);
  seamlessNavigationPanel.navigate("/dashboard-actions/home");
  assert.equal(location.pathname, "/dashboard-actions/home");
  assert.equal(navigationEvents.at(-1).type, "location-changed");

  console.log("registry loader and mobile activation harness passed");
  process.exit(0);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
