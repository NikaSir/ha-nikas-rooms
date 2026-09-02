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
  assigned: [],
  assign(pathname) {
    this.assigned.push(pathname);
  },
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

const frontendSource = fs.readFileSync(frontendPath, "utf8");
vm.runInNewContext(frontendSource, context, {
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
    if (args[1]) panel._activeRoute = args[1];
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
  navigationPanel._rooms = [{ slug: "bathroom", name: "Ванная" }];
  navigationPanel._houseRoute = "/dashboard-house-v12/home";
  navigationPanel._activeRoute = { kind: "room", slug: "bathroom" };
  assert.equal(navigationPanel.houseRoute(), "/dashboard-house-v12/home");
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
  const roomMarkup = navigationPanel.roomCard({
    slug: "bathroom",
    name: "Ванная",
    no: "01",
    icon: "mdi:bathtub",
  });
  assert.match(roomMarkup, /<a class="room-card/);
  assert.match(roomMarkup, /href="\/dashboard-rooms-v11\/room-bathroom"/);
  const detailMarkup = navigationPanel.roomMarkup({
    area: { name: "Ванная" },
    slug: "bathroom",
    entities: [],
    devices: [],
  });
  assert.match(detailMarkup, /href="\/dashboard-rooms-v11\/room-bathroom\/diagnostics"/);
  assert.match(frontendSource, /<a class="title-return"/);
  assert.match(frontendSource, /<a data-base="home" href=/);
  assert.doesNotMatch(frontendSource, /navigation-proxy/);

  const entityButton = fakeButton({ dataset: { entity: "sensor.bathroom_temperature" } });
  assert.equal(
    navigationPanel.actionButton({ composedPath: () => [entityButton, navigationPanel.shadowRoot] }),
    entityButton,
  );
  const pointerEvent = (type, extra = {}) => ({
    cancelable: true,
    clientX: 20,
    clientY: 30,
    composedPath: () => [entityButton, navigationPanel.shadowRoot],
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
  assert.equal(navigationPanel.__events.length, 1);
  assert.equal(navigationPanel.__events[0].detail.entityId, "sensor.bathroom_temperature");
  navigationPanel.controlClick(pointerEvent("click"));
  assert.equal(
    navigationPanel.__events.length,
    1,
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
  assert.equal(navigationPanel.__events.length, 1, "finger movement must not activate a control");

  const directTouchPanel = makePanel({});
  const directEntityButton = fakeButton({ dataset: { entity: "sensor.kitchen_temperature" } });
  const directTouch = (x, y) => ({ identifier: 11, clientX: x, clientY: y });
  directTouchPanel.directTouchStart({
    currentTarget: directEntityButton,
    touches: [directTouch(40, 50)],
  });
  let directPrevented = false;
  directTouchPanel.directTouchEnd({
    cancelable: true,
    changedTouches: { 0: directTouch(42, 52), length: 1 },
    currentTarget: directEntityButton,
    preventDefault: () => { directPrevented = true; },
    touches: [],
  });
  assert.equal(directTouchPanel.__events.length, 1);
  assert.equal(directTouchPanel.__events[0].detail.entityId, "sensor.kitchen_temperature");
  assert.equal(directPrevented, true);
  directTouchPanel.directControlClick({
    currentTarget: directEntityButton,
    preventDefault: () => {},
    stopPropagation: () => {},
  });
  assert.equal(
    directTouchPanel.__events.length,
    1,
    "the synthetic click after direct touchend must be deduplicated",
  );

  const diagnosticsMarkupPanel = makePanel({
    states: {
      "sensor.attic_temperature": {
        state: "21.4",
        attributes: { device_class: "temperature", unit_of_measurement: "°C" },
      },
    },
  });
  const diagnosticsMarkup = diagnosticsMarkupPanel.diagnosticsMarkup({
    area: { name: "Чердак" },
    diagnosticDevices: [{ id: "device-1", name: "Датчик чердака", labels: ["v_ekspluatatsii"] }],
    diagnosticEntities: [{
      entity_id: "sensor.attic_temperature",
      device_id: "device-1",
      name: "Температура",
      labels: ["v_ekspluatatsii"],
    }],
    diagnosticStandalone: [],
    labelMap: new Map([["v_ekspluatatsii", "В эксплуатации"]]),
  });
  assert.match(diagnosticsMarkup, /Датчик чердака/);
  assert.match(diagnosticsMarkup, /21[,.]4 °C/);

  console.log("registry loader and mobile activation harness passed");
  process.exit(0);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
