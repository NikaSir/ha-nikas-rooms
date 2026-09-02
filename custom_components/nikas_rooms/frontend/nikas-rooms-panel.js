const ELEMENT_NAME = "nikas-rooms-v11";
const UI_VERSION = "11.0.13";
const PANEL_ROOT = "/dashboard-rooms-v11";
const ROOT_PATH = "/dashboard-rooms-v11/rooms";
const ZOOM_KEY = "nikas.rooms.zoom.v1";
const RETURN_ROUTE_KEY = "nikas.rooms.return_route.v1";
const SOURCE_ROUTE_KEY = "nikas.specialized.source_route.v1";
const SOURCE_ROUTE_AT_KEY = "nikas.specialized.source_route_at.v1";
const SOURCE_ROUTE_TTL_MS = 30_000;
const REGISTRY_TIMEOUT_MS = 8_000;
const LABEL_REGISTRY_TIMEOUT_MS = 4_000;
const REGISTRY_RETRY_DELAY_MS = 2_000;
const SAFE_DEFAULT_ROUTE = "/dashboard-house-v11/home";
const HOUSE_PANEL_COMPONENT = "nikas-house-overview";
const TAP_MOVE_THRESHOLD_PX = 6;
const TAP_CLICK_GUARD_MS = 700;
const DIRECT_TOUCH_THRESHOLD_PX = 10;
const ACTIVE_LABEL = "v_ekspluatatsii";
const SERVICE_LABEL = "na_obsluzhivanii";
const REPLACEMENT_LABEL = "trebuet_zameny";
const CLIMATE_LABEL = "datchik_klimata_pomeshcheniia";
const EXCLUDED_LABELS = new Set([
  "rezerv",
  "vyvedeno_iz_ekspluatatsii",
]);
const ADMITTED_LABELS = new Set([ACTIVE_LABEL, SERVICE_LABEL, REPLACEMENT_LABEL]);
const BAD_STATES = new Set(["unknown", "unavailable", "none", "null", ""]);
const SUMMARY_CLASSES = ["red", "yellow", "blue", "orange", "grey"];
const OPENING_CLASSES = new Set(["door", "window", "opening", "garage_door"]);
const ACTIVITY_CLASSES = new Set(["motion", "occupancy", "presence"]);
const SAFETY_CLASSES = new Set(["smoke", "gas", "carbon_monoxide", "moisture", "problem"]);

const ROOMS = [
  ["bathroom", "01", "Ванная", "mdi:bathtub-outline", 2],
  ["bedroom", "02", "Спальня", "mdi:bed-outline", 2],
  ["wardrobe", "03", "Гардероб", "mdi:hanger", 2],
  ["sasha", "04", "У Саши", "mdi:account", 2],
  ["ilya", "05", "У Ильи", "mdi:account-outline", 2],
  ["stairs", "06", "Лестница", "mdi:stairs", 2],
  ["corridor", "07", "Коридор", "mdi:door-open", 2],
  ["hall", "08", "Холл", "mdi:sofa-outline", 2],
  ["boiler", "09", "Котельная", "mdi:water-boiler", 1],
  ["kitchen", "10", "Кухня", "mdi:fridge-outline", 1],
  ["dining", "11.1", "Столовая", "mdi:table-chair", 1],
  ["living", "11.2", "Гостиная", "mdi:sofa", 1],
  ["toilet", "12", "Туалет", "mdi:toilet", 1],
  ["vestibule", "13", "Тамбур", "mdi:door-closed-lock", 1],
  ["veranda", "14", "Веранда", "mdi:home-outline", 1],
  ["garage", "15", "Гараж", "mdi:garage", 1],
  ["attic", "16", "Чердак", "mdi:home-roof", 0],
  ["greenhouse", "17", "Теплица", "mdi:greenhouse", 0],
].map(([slug, no, name, icon, floor]) => ({ slug, no, name, icon, floor }));

function norm(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("ru-RU")
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ");
}

function normArea(value) {
  return norm(value).replace(/^\d+(?:[.,]\d+)?\s*(?:[-–—.:)]\s*)?/, "").trim();
}

function labelsOf(item) {
  const labels = item?.labels;
  if (!labels) return [];
  if (Array.isArray(labels)) return labels;
  if (labels instanceof Set) return [...labels];
  if (typeof labels === "object") return Object.keys(labels).filter((key) => labels[key]);
  return [];
}

function hasExcludedLabel(item) {
  return labelsOf(item).some((label) => EXCLUDED_LABELS.has(label));
}

function operational(item) {
  const labels = new Set(labelsOf(item));
  return labels.has(ACTIVE_LABEL) && ![...EXCLUDED_LABELS].some((label) => labels.has(label));
}

function admitted(item) {
  const labels = new Set(labelsOf(item));
  return [...ADMITTED_LABELS].some((label) => labels.has(label))
    && ![...EXCLUDED_LABELS].some((label) => labels.has(label));
}

function maintenanceState(item) {
  const labels = new Set(labelsOf(item));
  if (labels.has(REPLACEMENT_LABEL)) return "replacement";
  if (labels.has(SERVICE_LABEL)) return "service";
  return "active";
}

function domain(entityId) {
  return String(entityId || "").split(".")[0];
}

function stateClass(entity, hass) {
  return entity?.device_class || hass?.states?.[entity?.entity_id]?.attributes?.device_class || "";
}

function titleOfEntity(entity, hass) {
  return entity?.name
    || hass?.states?.[entity?.entity_id]?.attributes?.friendly_name
    || entity?.original_name
    || entity?.entity_id
    || "Сущность";
}

function titleOfDevice(device) {
  return device?.name_by_user || device?.name || device?.model || "Устройство";
}

function goodState(state) {
  return !BAD_STATES.has(norm(state));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeReturnRoute(value) {
  if (!value) return null;
  let candidate = String(value).trim();
  const tokens = {
    house: SAFE_DEFAULT_ROUTE,
    home: SAFE_DEFAULT_ROUTE,
    actions: "/dashboard-actions/home",
    infrastructure: "/dashboard-infrastructure/overview",
  };
  candidate = tokens[candidate.toLowerCase()] || candidate;
  try {
    candidate = decodeURIComponent(candidate);
  } catch (_error) {
    // Keep an already-decoded route unchanged.
  }
  try {
    const url = new URL(candidate, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    if (url.pathname === "/dashboard-house-v11" || url.pathname.startsWith("/dashboard-house-v11/")) {
      return "/dashboard-house-v11/home";
    }
    if (url.pathname === "/dashboard-house-v12" || url.pathname.startsWith("/dashboard-house-v12/")) {
      return "/dashboard-house-v12/home";
    }
    if (url.pathname === "/dashboard-actions" || url.pathname.startsWith("/dashboard-actions/")) {
      return "/dashboard-actions/home";
    }
    if (url.pathname === "/dashboard-infrastructure" || url.pathname.startsWith("/dashboard-infrastructure/")) {
      return "/dashboard-infrastructure/overview";
    }
    return null;
  } catch (_error) {
    return null;
  }
}

function isHouseRoute(value) {
  return value === "/dashboard-house-v11/home" || value === "/dashboard-house-v12/home";
}

function detectedHouseRoute(hass) {
  const panels = hass?.panels;
  if (!panels || typeof panels !== "object") return null;
  const routes = [];
  for (const panel of Object.values(panels)) {
    if (panel?.component_name !== "custom") continue;
    if (panel?.config?._panel_custom?.name !== HOUSE_PANEL_COMPONENT) continue;
    const configured = safeReturnRoute(panel?.config?.default_path);
    if (isHouseRoute(configured)) {
      routes.push(configured);
      continue;
    }
    const registered = safeReturnRoute(`/${String(panel?.url_path || "")}/home`);
    if (isHouseRoute(registered)) routes.push(registered);
  }
  return routes.includes("/dashboard-house-v12/home")
    ? "/dashboard-house-v12/home"
    : routes[0] || null;
}

function resolveReturnRoute(panel) {
  const current = new URL(window.location.href);
  const explicit = ["return_to", "from"]
    .map((key) => safeReturnRoute(current.searchParams.get(key)))
    .find(Boolean) || null;
  let handedOff = null;
  let saved = null;
  try {
    const route = sessionStorage.getItem(SOURCE_ROUTE_KEY);
    const timestampRaw = sessionStorage.getItem(SOURCE_ROUTE_AT_KEY);
    sessionStorage.removeItem(SOURCE_ROUTE_KEY);
    sessionStorage.removeItem(SOURCE_ROUTE_AT_KEY);
    const timestamp = Number(timestampRaw);
    const age = Date.now() - timestamp;
    if (
      route !== null
      && timestampRaw !== null
      && Number.isFinite(timestamp)
      && age >= 0
      && age <= SOURCE_ROUTE_TTL_MS
    ) {
      handedOff = safeReturnRoute(route);
    }
    saved = safeReturnRoute(sessionStorage.getItem(RETURN_ROUTE_KEY));
  } catch (_error) {
    handedOff = null;
    saved = null;
  }
  let referrer = null;
  try {
    referrer = safeReturnRoute(document.referrer);
  } catch (_error) {
    referrer = null;
  }
  const configured = safeReturnRoute(
    panel?._panel?.config?.parent_route || panel?.panel?.config?.parent_route,
  );
  const route = explicit || handedOff || saved || referrer || configured || SAFE_DEFAULT_ROUTE;
  try {
    sessionStorage.setItem(RETURN_ROUTE_KEY, route);
  } catch (_error) {
    // A hardened browser may disable storage; the captured in-memory route remains valid.
  }
  return route;
}

class NikasRoomsV11 extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._panel = null;
    this._registries = null;
    this._rooms = [];
    this._loading = false;
    this._registryLoadId = 0;
    this._registryRetryTimer = null;
    this._registryRetryAttempts = 0;
    this._registryFailed = false;
    this._mounted = false;
    this._routeKey = "";
    this._activeRoute = null;
    this._diagnosticFilter = "*";
    this._stateFrame = null;
    this._viewsBuilt = false;
    this._zoom = this.loadZoom();
    this._gesture = null;
    this._lastTwoTap = 0;
    this._suppressClicksUntil = 0;
    this._toastTimer = null;
    this._returnRoute = null;
    this._houseRoute = SAFE_DEFAULT_ROUTE;
    this._touchPointers = new Set();
    this._tapSession = null;
    this._manualActivationTarget = null;
    this._manualActivationUntil = 0;
    this._boundControls = new WeakSet();
    this._directTouchSessions = new WeakMap();
    this._navigationProxy = null;
    this._onLocation = () => {
      if (this.isRoomsPath()) this.renderRoute();
    };
    this._onResize = () => this.applyTransform();
  }

  set panel(value) {
    this._panel = value;
  }

  set hass(value) {
    const previous = this._hass;
    this._hass = value;
    this.syncHouseRoute();
    const snapshot = this.hassRegistrySnapshot();
    const registriesChanged = !previous
      || previous.areas !== value?.areas
      || previous.devices !== value?.devices
      || previous.entities !== value?.entities;
    if (snapshot && (!this._registries || registriesChanged)) {
      this.applyRegistrySnapshot(snapshot, Boolean(this._registries));
      return;
    }
    if (!this._registries) {
      if (!this._loading && !this._registryFailed) this.loadRegistries();
      return;
    }
    this.scheduleStatePatch();
  }

  connectedCallback() {
    this.mountShell();
    if (window.location.pathname === PANEL_ROOT) {
      window.history.replaceState(null, "", ROOT_PATH);
    }
    window.addEventListener("location-changed", this._onLocation);
    window.addEventListener("popstate", this._onLocation);
    window.addEventListener("resize", this._onResize, { passive: true });
    window.visualViewport?.addEventListener?.("resize", this._onResize, { passive: true });
    if (this._registries) this.renderRoute(true, this._activeRoute || this.route());
    else this.loadRegistries();
  }

  disconnectedCallback() {
    window.removeEventListener("location-changed", this._onLocation);
    window.removeEventListener("popstate", this._onLocation);
    window.removeEventListener("resize", this._onResize);
    window.visualViewport?.removeEventListener?.("resize", this._onResize);
    if (this._stateFrame !== null) window.cancelAnimationFrame(this._stateFrame);
    window.clearTimeout(this._toastTimer);
    window.clearTimeout(this._registryRetryTimer);
    this._registryRetryTimer = null;
    this._registryLoadId += 1;
    this._loading = false;
  }

  mountShell() {
    if (this._mounted) return;
    this._mounted = true;
    this._returnRoute = resolveReturnRoute(this);
    this.syncHouseRoute();
    this.shadowRoot.innerHTML = `
      <style>${this.styles()}</style>
      <div class="app">
        <header class="header">
          <button class="shell-button menu" type="button" aria-label="Меню Home Assistant">
            <ha-icon icon="mdi:menu"></ha-icon>
          </button>
          <button class="title-return" type="button" data-path="${this._houseRoute || SAFE_DEFAULT_ROUTE}" aria-label="Вернуться">
            <strong>Помещения</strong><small>UI v${UI_VERSION}</small>
          </button>
          <button class="shell-button refresh" type="button" aria-label="Обновить">
            <ha-icon icon="mdi:refresh"></ha-icon>
          </button>
        </header>
        <main class="viewport" id="viewport">
          <section class="canvas" id="canvas">
            <div class="loading">Загрузка помещений…</div>
          </section>
        </main>
        <nav class="tabs" aria-label="Основные панели NikaS">
          <button type="button" data-path="${this.houseRoute()}" aria-label="Дом"><ha-icon icon="mdi:home-outline"></ha-icon><small>Дом</small></button>
          <button type="button" data-route-kind="overview" aria-label="Помещения"><ha-icon icon="mdi:floor-plan"></ha-icon><small>Помещения</small></button>
          <button type="button" data-path="/dashboard-actions/home" aria-label="Действия"><ha-icon icon="mdi:lightning-bolt-outline"></ha-icon><small>Действия</small></button>
          <button type="button" data-path="/dashboard-infrastructure/overview" aria-label="Инфраструктура"><ha-icon icon="mdi:server-network"></ha-icon><small>Инфра</small></button>
        </nav>
        <a class="navigation-proxy" id="navigation-proxy" href="${ROOT_PATH}" tabindex="-1" aria-hidden="true"></a>
        <div class="zoom-toast" aria-live="polite">Масштаб 100%</div>
      </div>`;

    this._viewport = this.shadowRoot.getElementById("viewport");
    this._canvas = this.shadowRoot.getElementById("canvas");
    this._toast = this.shadowRoot.querySelector(".zoom-toast");
    this._navigationProxy = this.shadowRoot.getElementById("navigation-proxy");
    this.bindControlButtons(this.shadowRoot);
    this.shadowRoot.addEventListener("click", (event) => this.controlClick(event));
    this.shadowRoot.addEventListener("pointerdown", (event) => this.tapPointerDown(event), { passive: true });
    this.shadowRoot.addEventListener("pointermove", (event) => this.tapPointerMove(event), { passive: true });
    this.shadowRoot.addEventListener("pointerup", (event) => this.tapPointerUp(event), { passive: false });
    this.shadowRoot.addEventListener("pointercancel", (event) => this.tapPointerCancel(event), { passive: true });
    this._viewport.addEventListener("touchstart", (event) => this.touchStart(event), { passive: false });
    this._viewport.addEventListener("touchmove", (event) => this.touchMove(event), { passive: false });
    this._viewport.addEventListener("touchend", (event) => this.touchEnd(event), { passive: false });
    this._viewport.addEventListener("touchcancel", (event) => this.touchEnd(event), { passive: false });
    this.updateHeader();
    this.updateTabs();
    this.applyTransform();
  }

  syncHouseRoute() {
    const route = detectedHouseRoute(this._hass);
    if (!route) return;
    this._houseRoute = route;
    if (!this._returnRoute || isHouseRoute(this._returnRoute)) this._returnRoute = route;
    if (this._mounted) {
      this.updateHeader();
      const homeButton = this.shadowRoot?.querySelector('.tabs button[aria-label="Дом"]');
      if (homeButton) homeButton.dataset.path = route;
    }
  }

  houseRoute() {
    this.syncHouseRoute();
    return this._houseRoute || SAFE_DEFAULT_ROUTE;
  }

  actionButton(event) {
    const path = typeof event?.composedPath === "function" ? event.composedPath() : [];
    for (const node of path) {
      if (node === this.shadowRoot) break;
      if (typeof node?.matches === "function" && node.matches("button")) {
        return node.disabled ? null : node;
      }
    }
    const button = event?.target?.closest?.("button") || null;
    return button && !button.disabled ? button : null;
  }

  bindControlButtons(root) {
    for (const button of root?.querySelectorAll?.("button") || []) {
      if (this._boundControls.has(button)) continue;
      this._boundControls.add(button);
      button.addEventListener("click", (event) => this.directControlClick(event));
      button.addEventListener("touchstart", (event) => this.directTouchStart(event), { passive: true });
      button.addEventListener("touchmove", (event) => this.directTouchMove(event), { passive: true });
      button.addEventListener("touchend", (event) => this.directTouchEnd(event), { passive: false });
      button.addEventListener("touchcancel", (event) => this.directTouchCancel(event), { passive: true });
    }
  }

  directControlClick(event) {
    const button = event.currentTarget;
    event.stopPropagation();
    if (button === this._manualActivationTarget && Date.now() < this._manualActivationUntil) {
      event.preventDefault();
      return;
    }
    if (Date.now() < this._suppressClicksUntil) return;
    if (this.activateControl(button)) event.preventDefault();
  }

  directTouchStart(event) {
    const button = event.currentTarget;
    if (event.touches?.length !== 1) {
      this._directTouchSessions.delete(button);
      return;
    }
    const touch = event.touches[0];
    this._directTouchSessions.set(button, {
      identifier: touch.identifier,
      startX: Number(touch.clientX) || 0,
      startY: Number(touch.clientY) || 0,
      cancelled: false,
    });
  }

  directTouchMove(event) {
    const button = event.currentTarget;
    const session = this._directTouchSessions.get(button);
    if (!session || event.touches?.length !== 1) return;
    const touch = event.touches[0];
    if (touch.identifier !== session.identifier) {
      session.cancelled = true;
      return;
    }
    const distance = Math.hypot(
      (Number(touch.clientX) || 0) - session.startX,
      (Number(touch.clientY) || 0) - session.startY,
    );
    if (distance >= DIRECT_TOUCH_THRESHOLD_PX) session.cancelled = true;
  }

  directTouchEnd(event) {
    const button = event.currentTarget;
    const session = this._directTouchSessions.get(button);
    this._directTouchSessions.delete(button);
    if (!session || session.cancelled || event.touches?.length) return;
    if (button === this._manualActivationTarget && Date.now() < this._manualActivationUntil) return;
    const changedTouches = event.changedTouches || [];
    let touch = null;
    for (let index = 0; index < changedTouches.length; index += 1) {
      const item = changedTouches[index] || changedTouches.item?.(index);
      if (item?.identifier === session.identifier) {
        touch = item;
        break;
      }
    }
    if (!touch || Date.now() < this._suppressClicksUntil) return;
    const distance = Math.hypot(
      (Number(touch.clientX) || 0) - session.startX,
      (Number(touch.clientY) || 0) - session.startY,
    );
    if (distance >= DIRECT_TOUCH_THRESHOLD_PX || !this.activateControl(button)) return;
    this._manualActivationTarget = button;
    this._manualActivationUntil = Date.now() + TAP_CLICK_GUARD_MS;
    if (event.cancelable) event.preventDefault();
  }

  directTouchCancel(event) {
    this._directTouchSessions.delete(event.currentTarget);
  }

  activateControl(button) {
    if (!button || button.disabled) return false;
    if (button.classList?.contains("menu")) {
      this.dispatchEvent(new CustomEvent("hass-toggle-menu", { bubbles: true, composed: true }));
      return true;
    }
    if (button.classList?.contains("refresh") || button.dataset?.registryRetry !== undefined) {
      this.loadRegistries(true);
      return true;
    }
    if (button.dataset?.routeKind) {
      this.renderRoute(false, {
        kind: button.dataset.routeKind,
        slug: button.dataset.routeSlug || undefined,
      });
      return true;
    }
    if (button.dataset?.entity) {
      this.dispatchEvent(new CustomEvent("hass-more-info", {
        bubbles: true,
        composed: true,
        detail: { entityId: button.dataset.entity },
      }));
      return true;
    }
    if (button.dataset?.filter !== undefined) {
      this.applyDiagnosticFilter(button.dataset.filter || "*");
      return true;
    }
    if (button.dataset?.path) {
      this.navigate(button.dataset.path);
      return true;
    }
    return false;
  }

  controlClick(event) {
    const button = this.actionButton(event);
    if (!button) return;
    if (button === this._manualActivationTarget && Date.now() < this._manualActivationUntil) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      return;
    }
    if (Date.now() < this._suppressClicksUntil) return;
    if (this.activateControl(button)) event.preventDefault();
  }

  tapPointerDown(event) {
    if (event.pointerType !== "touch") return;
    this._touchPointers.add(event.pointerId);
    if (this._touchPointers.size > 1) {
      if (this._tapSession) this._tapSession.cancelled = true;
      return;
    }
    const button = this.actionButton(event);
    this._tapSession = button ? {
      pointerId: event.pointerId,
      button,
      startX: Number(event.clientX) || 0,
      startY: Number(event.clientY) || 0,
      cancelled: false,
    } : null;
  }

  tapPointerMove(event) {
    const session = this._tapSession;
    if (event.pointerType !== "touch" || !session || session.pointerId !== event.pointerId) return;
    const distance = Math.hypot(
      (Number(event.clientX) || 0) - session.startX,
      (Number(event.clientY) || 0) - session.startY,
    );
    if (distance >= TAP_MOVE_THRESHOLD_PX) session.cancelled = true;
  }

  tapPointerUp(event) {
    if (event.pointerType !== "touch") return;
    const session = this._tapSession;
    const isCandidate = session
      && session.pointerId === event.pointerId
      && !session.cancelled
      && this._touchPointers.size === 1
      && !this._gesture?.moved
      && this._gesture?.kind !== "pinch"
      && !(session.button === this._manualActivationTarget
        && Date.now() < this._manualActivationUntil)
      && Date.now() >= this._suppressClicksUntil;
    this._touchPointers.delete(event.pointerId);
    this._tapSession = null;
    if (!isCandidate || !this.activateControl(session.button)) return;
    this._manualActivationTarget = session.button;
    this._manualActivationUntil = Date.now() + TAP_CLICK_GUARD_MS;
    if (event.cancelable) event.preventDefault();
  }

  tapPointerCancel(event) {
    if (event.pointerType !== "touch") return;
    this._touchPointers.delete(event.pointerId);
    if (this._tapSession?.pointerId === event.pointerId) this._tapSession = null;
  }

  registryTransport() {
    if (typeof this._hass?.callWS === "function") {
      return (message) => this._hass.callWS(message);
    }
    if (typeof this._hass?.connection?.sendMessagePromise === "function") {
      return (message) => this._hass.connection.sendMessagePromise(message);
    }
    return null;
  }

  registryValues(value) {
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") return Object.values(value);
    return null;
  }

  hassRegistrySnapshot() {
    const areas = this.registryValues(this._hass?.areas);
    const devices = this.registryValues(this._hass?.devices);
    const entities = this.registryValues(this._hass?.entities);
    if (!areas || !devices || !entities) return null;
    return { areas, devices, entities, labels: [] };
  }

  applyRegistrySnapshot(snapshot, force = false) {
    this.mountShell();
    const loadId = ++this._registryLoadId;
    this._loading = false;
    this._registryFailed = false;
    this._registryRetryAttempts = 0;
    window.clearTimeout(this._registryRetryTimer);
    this._registryRetryTimer = null;
    this._registries = snapshot;
    this.buildRooms();
    if (force) this._viewsBuilt = false;
    this.renderRoute(true, this._activeRoute || this.route());
    this.syncRefreshState();
    this.loadOptionalLabels(loadId);
  }

  async registryRequest(type, timeoutMs = REGISTRY_TIMEOUT_MS) {
    const transport = this.registryTransport();
    if (!transport) throw new Error("Home Assistant WebSocket is not ready");

    let timeoutId = null;
    try {
      return await Promise.race([
        transport({ type }),
        new Promise((_, reject) => {
          timeoutId = window.setTimeout(
            () => reject(new Error(`Registry request timed out: ${type}`)),
            timeoutMs,
          );
        }),
      ]);
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  renderRegistryMessage(title, detail = "", retry = false) {
    const canvas = this.shadowRoot?.getElementById("canvas");
    if (!canvas) return;
    this._viewsBuilt = false;
    canvas.innerHTML = `
      <div class="loading registry-message">
        <strong>${escapeHtml(title)}</strong>
        ${detail ? `<small>${escapeHtml(detail)}</small>` : ""}
        ${retry ? '<button type="button" data-registry-retry>Повторить</button>' : ""}
      </div>`;
  }

  scheduleRegistryRetry() {
    if (this._registries || this._registryRetryTimer !== null || this._registryRetryAttempts >= 1) return;
    this._registryRetryAttempts += 1;
    this._registryRetryTimer = window.setTimeout(() => {
      this._registryRetryTimer = null;
      if (!this._registries && !this._loading && this.isConnected !== false) {
        this._registryFailed = false;
        this.loadRegistries();
      }
    }, REGISTRY_RETRY_DELAY_MS);
  }

  async loadOptionalLabels(loadId) {
    try {
      const labels = await this.registryRequest(
        "config/label_registry/list",
        LABEL_REGISTRY_TIMEOUT_MS,
      );
      if (loadId !== this._registryLoadId || !this._registries || !Array.isArray(labels)) return;
      this._registries.labels = labels;
      const labelMap = new Map(
        labels.map((label) => [label.label_id, label.name || label.label_id]),
      );
      for (const room of this._rooms) room.labelMap = labelMap;
      const activeRoute = this._activeRoute || this.route();
      if (activeRoute.kind === "diagnostics") this.renderRoute(true, activeRoute);
    } catch (error) {
      console.info("[NikaS Rooms v11] optional label registry unavailable", error);
    }
  }

  async loadRegistries(force = false) {
    this.mountShell();
    const snapshot = this.hassRegistrySnapshot();
    if (snapshot) {
      this.applyRegistrySnapshot(snapshot, force);
      return;
    }
    if (this._loading) return;
    if (force) {
      this._registryFailed = false;
      this._registryRetryAttempts = 0;
      window.clearTimeout(this._registryRetryTimer);
      this._registryRetryTimer = null;
    }
    if (!this.registryTransport()) {
      if (!this._registries) {
        this.renderRegistryMessage(
          "Ожидание соединения с Home Assistant…",
          "Панель повторит загрузку автоматически.",
          true,
        );
      }
      this.scheduleRegistryRetry();
      return;
    }

    const loadId = ++this._registryLoadId;
    this._loading = true;
    this._registryFailed = false;
    this.syncRefreshState();
    if (!this._registries) this.renderRegistryMessage("Загрузка помещений…");
    try {
      const [areas, devices, entities] = await Promise.all([
        this.registryRequest("config/area_registry/list"),
        this.registryRequest("config/device_registry/list"),
        this.registryRequest("config/entity_registry/list"),
      ]);
      if (loadId !== this._registryLoadId) return;
      if (![areas, devices, entities].every(Array.isArray)) {
        throw new Error("Home Assistant returned an invalid registry response");
      }
      this._registries = { areas, devices, entities, labels: [] };
      this.buildRooms();
      if (force) this._viewsBuilt = false;
      this.renderRoute(true, this._activeRoute || this.route());
      this._registryRetryAttempts = 0;
      this.loadOptionalLabels(loadId);
    } catch (error) {
      if (loadId !== this._registryLoadId) return;
      console.warn("[NikaS Rooms v11] registry load failed", error);
      this._registryFailed = true;
      if (!this._registries) {
        this.renderRegistryMessage(
          "Не удалось прочитать реестры Home Assistant",
          "Проверьте соединение и повторите загрузку.",
          true,
        );
      }
      this.scheduleRegistryRetry();
    } finally {
      if (loadId === this._registryLoadId) {
        this._loading = false;
        this.syncRefreshState();
      }
    }
  }

  buildRooms() {
    const { areas, devices, entities, labels } = this._registries;
    const deviceMap = new Map(devices.map((device) => [device.id, device]));
    const labelMap = new Map(labels.map((label) => [label.label_id, label.name || label.label_id]));

    this._rooms = ROOMS.map((definition) => {
      const area = areas.find((item) =>
        norm(item.name) === norm(definition.name)
        || normArea(item.name) === norm(definition.name)
        || norm(item.area_id) === norm(definition.name));

      if (!area) {
        return {
          ...definition,
          area: null,
          devices: [],
          entities: [],
          summaryEntities: [],
          standalone: [],
          diagnosticDevices: [],
          diagnosticEntities: [],
          diagnosticStandalone: [],
          labelMap,
        };
      }

      const areaDevices = devices.filter((device) =>
        device.area_id === area.area_id && !device.disabled_by);
      const areaDeviceIds = new Set(areaDevices.map((device) => device.id));
      const areaEntities = entities.filter((entity) => {
        if (entity.disabled_by || entity.hidden_by || entity.hidden) return false;
        const effectiveArea = entity.area_id || deviceMap.get(entity.device_id)?.area_id || null;
        return effectiveArea === area.area_id
          && (!entity.device_id || areaDeviceIds.has(entity.device_id));
      });

      const roomDevices = areaDevices.filter((device) => admitted(device));
      const deviceIds = new Set(roomDevices.map((device) => device.id));
      const operationalDeviceIds = new Set(
        areaDevices.filter((device) => operational(device)).map((device) => device.id),
      );

      const roomEntities = areaEntities.filter((entity) => {
        if (hasExcludedLabel(entity)) return false;
        if (entity.device_id) {
          return deviceIds.has(entity.device_id);
        }
        return admitted(entity);
      });
      const summaryEntities = areaEntities.filter((entity) => {
        if (hasExcludedLabel(entity)) return false;
        return entity.device_id
          ? operationalDeviceIds.has(entity.device_id)
          : operational(entity);
      });

      return {
        ...definition,
        area,
        devices: roomDevices,
        entities: roomEntities,
        summaryEntities,
        standalone: roomEntities.filter((entity) => !entity.device_id),
        diagnosticDevices: areaDevices,
        diagnosticEntities: areaEntities,
        diagnosticStandalone: areaEntities.filter((entity) => !entity.device_id),
        labelMap,
      };
    });
  }

  isRoomsPath() {
    return window.location.pathname === PANEL_ROOT
      || window.location.pathname.startsWith(`${PANEL_ROOT}/`);
  }

  route(pathname = window.location.pathname) {
    const cleanPath = String(pathname || "").split(/[?#]/, 1)[0];
    const parts = cleanPath.split("/").filter(Boolean);
    if (parts[0] !== "dashboard-rooms-v11") return { kind: "overview" };
    if (parts[1]?.startsWith("room-")) {
      const slug = parts[1].slice(5);
      return { kind: parts[2] === "diagnostics" ? "diagnostics" : "room", slug };
    }
    return { kind: "overview" };
  }

  routeKey(route) {
    return `${route.kind}:${route.slug || ""}`;
  }

  navigate(path) {
    if (!path || !path.startsWith("/")) return;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (current === path) return;
    const anchor = this._navigationProxy || this.shadowRoot?.getElementById("navigation-proxy");
    if (!anchor) {
      window.location.assign(path);
      return;
    }
    anchor.href = path;
    anchor.click();
  }

  room(slug) {
    return this._rooms.find((room) => room.slug === slug) || null;
  }

  entityState(entity) {
    return this._hass?.states?.[entity.entity_id] || null;
  }

  summary(room) {
    if (!room?.area) return { text: "Нет данных", tone: "grey" };
    const entities = room.summaryEntities.filter((entity) => {
      const entityDomain = domain(entity.entity_id);
      const deviceClass = stateClass(entity, this._hass);
      return ["binary_sensor", "light", "switch", "climate", "cover"].includes(entityDomain)
        || OPENING_CLASSES.has(deviceClass)
        || ACTIVITY_CLASSES.has(deviceClass)
        || SAFETY_CLASSES.has(deviceClass);
    });

    if (!entities.length) return { text: "Нет рабочих устройств", tone: "grey" };

    let alarm = 0;
    let open = 0;
    let activity = 0;
    let unavailable = 0;
    for (const entity of entities) {
      const stateObject = this.entityState(entity);
      const state = stateObject?.state;
      const entityDomain = domain(entity.entity_id);
      const deviceClass = stateClass(entity, this._hass);
      if (!goodState(state)) {
        unavailable += 1;
        continue;
      }
      if (state === "on" && SAFETY_CLASSES.has(deviceClass)) alarm += 1;
      if (state === "on" && OPENING_CLASSES.has(deviceClass)) open += 1;
      if (state === "on" && ACTIVITY_CLASSES.has(deviceClass)) activity += 1;
      if (["light", "switch"].includes(entityDomain) && state === "on") activity += 1;
      if (
        entityDomain === "climate"
        && ["heating", "cooling"].includes(stateObject?.attributes?.hvac_action)
      ) activity += 1;
    }

    if (alarm) return { text: "Тревога", tone: "red" };
    if (unavailable) return { text: "Требует внимания", tone: "orange" };
    if (open) return { text: `Открыто ${open}`, tone: "yellow" };
    if (activity) return { text: `Активность ${activity}`, tone: "blue" };
    return { text: "Спокойно", tone: "blue" };
  }

  formatEntity(entity) {
    const stateObject = this.entityState(entity);
    if (!stateObject || !goodState(stateObject.state)) return "Нет данных";
    const state = stateObject.state;
    const unit = stateObject.attributes?.unit_of_measurement || "";
    const deviceClass = stateClass(entity, this._hass);

    if (domain(entity.entity_id) === "binary_sensor") {
      if (OPENING_CLASSES.has(deviceClass)) return state === "on" ? "Открыто" : "Закрыто";
      if (ACTIVITY_CLASSES.has(deviceClass)) return state === "on" ? "Обнаружено" : "Не обнаружено";
      if (SAFETY_CLASSES.has(deviceClass)) return state === "on" ? "Тревога" : "Норма";
    }
    if (["light", "switch"].includes(domain(entity.entity_id))) {
      return state === "on" ? "Включено" : state === "off" ? "Выключено" : state;
    }
    if (typeof this._hass?.formatEntityState === "function") {
      try {
        return this._hass.formatEntityState(stateObject);
      } catch (_error) {
        // Fall back to deterministic state and unit formatting.
      }
    }
    return `${state}${unit ? ` ${unit}` : ""}`;
  }

  isClimateEntity(entity) {
    return ["temperature", "humidity"].includes(stateClass(entity, this._hass));
  }

  isPrimaryClimateEntity(room, entity) {
    if (labelsOf(entity).includes(CLIMATE_LABEL)) return true;
    if (!entity.device_id) return false;
    const device = room.devices.find((item) => item.id === entity.device_id);
    return labelsOf(device).includes(CLIMATE_LABEL);
  }

  primaryClimateEntities(room) {
    return room.entities.filter((entity) =>
      this.isClimateEntity(entity) && this.isPrimaryClimateEntity(room, entity));
  }

  extraClimateGroups(room, primaryEntities) {
    const primaryIds = new Set(primaryEntities.map((entity) => entity.entity_id));
    const groups = new Map();
    for (const entity of room.entities) {
      if (!this.isClimateEntity(entity) || primaryIds.has(entity.entity_id)) continue;
      const key = entity.device_id ? `device:${entity.device_id}` : `entity:${entity.entity_id}`;
      if (!groups.has(key)) {
        const device = entity.device_id
          ? room.devices.find((item) => item.id === entity.device_id)
          : null;
        groups.set(key, {
          title: device ? titleOfDevice(device) : titleOfEntity(entity, this._hass),
          entities: [],
        });
      }
      groups.get(key).entities.push(entity);
    }
    return [...groups.values()];
  }

  entityDisplayName(entity) {
    const deviceClass = stateClass(entity, this._hass);
    const names = {
      temperature: "Температура",
      humidity: "Влажность",
      illuminance: "Освещённость",
      motion: "Движение",
      occupancy: "Присутствие",
      presence: "Присутствие",
      door: "Дверь",
      window: "Окно",
      opening: "Открытие",
      garage_door: "Ворота",
      smoke: "Дым",
      gas: "Газ",
      carbon_monoxide: "Угарный газ",
      moisture: "Протечка",
      problem: "Неисправность",
    };
    return names[deviceClass] || titleOfEntity(entity, this._hass);
  }

  entityIcon(entity) {
    const deviceClass = stateClass(entity, this._hass);
    const icons = {
      temperature: "mdi:thermometer",
      humidity: "mdi:water-percent",
      illuminance: "mdi:brightness-6",
      motion: "mdi:motion-sensor",
      occupancy: "mdi:home-account",
      presence: "mdi:account-check-outline",
      door: "mdi:door",
      window: "mdi:window-closed-variant",
      opening: "mdi:door-open",
      garage_door: "mdi:garage",
      smoke: "mdi:smoke-detector-outline",
      gas: "mdi:gas-cylinder",
      carbon_monoxide: "mdi:molecule-co",
      moisture: "mdi:water-alert-outline",
      problem: "mdi:alert-circle-outline",
    };
    const entityDomain = domain(entity.entity_id);
    const domainIcons = {
      camera: "mdi:cctv",
      light: "mdi:lightbulb-outline",
      switch: "mdi:power-socket-eu",
      climate: "mdi:thermostat",
      cover: "mdi:window-shutter",
      media_player: "mdi:speaker",
      fan: "mdi:fan",
    };
    if (domainIcons[entityDomain]) return domainIcons[entityDomain];
    return icons[deviceClass] || "mdi:information-outline";
  }

  renderRoute(force = false, targetRoute = null) {
    if (!targetRoute && !this.isRoomsPath()) return;
    this.mountShell();
    const route = targetRoute || this.route();
    this._activeRoute = route;
    const key = this.routeKey(route);
    this.updateHeader(route);
    this.updateTabs(route);

    if (!this._registries) {
      return;
    }
    if (force || !this._viewsBuilt) this.buildRouteViews();

    this._routeKey = key;
    this._diagnosticFilter = "*";
    let activePanel = null;
    for (const panel of this._canvas.querySelectorAll("[data-route-panel]")) {
      const active = panel.dataset.routePanel === key;
      panel.hidden = !active;
      panel.classList.toggle("active", active);
      if (active) activePanel = panel;
    }
    if (!activePanel) {
      this.renderRoute(false, { kind: "overview" });
      return;
    }
    this._canvas.className = `canvas ${route.kind}`;
    this.resetViewportForRoute();
    this.scheduleStatePatch();
  }

  buildRouteViews() {
    const panels = [
      `<section class="route-panel" data-route-panel="overview:">${this.overviewMarkup()}</section>`,
    ];
    for (const room of this._rooms) {
      panels.push(
        `<section class="route-panel" data-route-panel="room:${room.slug}" hidden>${this.roomMarkup(room)}</section>`,
        `<section class="route-panel" data-route-panel="diagnostics:${room.slug}" hidden>${this.diagnosticsMarkup(room)}</section>`,
      );
    }
    this._canvas.innerHTML = panels.join("");
    this._viewsBuilt = true;
    this.bindControlButtons(this._canvas);
  }

  overviewMarkup() {
    const group = (floor, label, icon) => `
      <section class="floor">
        <h2><ha-icon icon="${icon}"></ha-icon>${label}</h2>
        <div class="room-grid">
          ${this._rooms.filter((room) => room.floor === floor).map((room) => this.roomCard(room)).join("")}
        </div>
      </section>`;
    return `<div class="overview">
      ${group(2, "2 этаж", "mdi:home-floor-2")}
      ${group(1, "1 этаж", "mdi:home-floor-1")}
      ${group(0, "Технические помещения", "mdi:tools")}
    </div>`;
  }

  roomCard(room) {
    const summary = this.summary(room);
    return `
      <button class="room-card tone-${summary.tone}" type="button"
              data-route-kind="room" data-route-slug="${room.slug}" data-summary-room="${room.slug}">
        <ha-icon icon="${room.icon}"></ha-icon>
        <span>
          <b>${escapeHtml(room.name)} [${room.no}]</b>
          <small data-summary-text>${escapeHtml(summary.text)}</small>
        </span>
      </button>`;
  }

  entityMaintenance(room, entity) {
    const direct = maintenanceState(entity);
    if (direct !== "active" || !entity.device_id) return direct;
    const device = room.devices.find((item) => item.id === entity.device_id);
    return maintenanceState(device);
  }

  maintenanceLabel(state) {
    if (state === "replacement") return "Требует замены";
    if (state === "service") return "На обслуживании";
    return "";
  }

  section(title, icon, entities, room) {
    if (!entities.length) return "";
    return `
      <section class="section">
        <h2><ha-icon icon="${icon}"></ha-icon>${title}</h2>
        <div class="entity-grid">
          ${entities.map((entity) => {
            const maintenance = this.entityMaintenance(room, entity);
            const label = this.maintenanceLabel(maintenance);
            return `
              <button class="entity status-${maintenance}" type="button" data-entity="${entity.entity_id}">
                <ha-icon icon="${this.entityIcon(entity)}"></ha-icon>
                <span class="entity-copy">
                  <span>${escapeHtml(this.entityDisplayName(entity))}</span>
                  ${label ? `<small>${escapeHtml(label)}</small>` : ""}
                </span>
                <b data-value="${entity.entity_id}">${escapeHtml(this.formatEntity(entity))}</b>
              </button>`;
          }).join("")}
        </div>
      </section>`;
  }

  extraClimate(room, primaryEntities) {
    return this.extraClimateGroups(room, primaryEntities)
      .map((group) => `
        <div class="sensor-card">
          <b>${escapeHtml(group.title)}</b>
          ${group.entities.map((entity) => {
            const maintenance = this.entityMaintenance(room, entity);
            const label = this.maintenanceLabel(maintenance);
            return `
              <button class="status-${maintenance}" type="button" data-entity="${entity.entity_id}">
                <ha-icon icon="${this.entityIcon(entity)}"></ha-icon>
                <span>${escapeHtml(this.entityDisplayName(entity))}${label ? ` · ${escapeHtml(label)}` : ""}</span>
                <strong data-value="${entity.entity_id}">${escapeHtml(this.formatEntity(entity))}</strong>
              </button>`;
          }).join("")}
        </div>`)
      .join("");
  }

  roomMarkup(room) {
    if (!room?.area) return '<div class="loading">Помещение не найдено в реестре Home Assistant</div>';
    const primaryClimate = this.primaryClimateEntities(room);
    const primaryClimateIds = new Set(primaryClimate.map((entity) => entity.entity_id));
    const extraClimateIds = new Set(
      this.extraClimateGroups(room, primaryClimate)
        .flatMap((group) => group.entities)
        .map((entity) => entity.entity_id),
    );
    const activity = room.entities.filter((entity) => {
      const deviceClass = stateClass(entity, this._hass);
      return ACTIVITY_CLASSES.has(deviceClass) || deviceClass === "illuminance";
    });
    const security = room.entities.filter((entity) => {
      const deviceClass = stateClass(entity, this._hass);
      return OPENING_CLASSES.has(deviceClass) || SAFETY_CLASSES.has(deviceClass);
    });
    const lighting = room.entities.filter((entity) => domain(entity.entity_id) === "light");
    const cameras = room.entities.filter((entity) => domain(entity.entity_id) === "camera");
    const equipmentDomains = new Set([
      "switch", "climate", "cover", "media_player", "fan", "vacuum", "lock", "water_heater",
    ]);
    const equipment = room.entities.filter((entity) =>
      equipmentDomains.has(domain(entity.entity_id))
      && !primaryClimateIds.has(entity.entity_id)
      && !extraClimateIds.has(entity.entity_id));
    const extraClimate = this.extraClimate(room, primaryClimate);

    return `
      <div class="room-view">
        ${this.section("Климат", "mdi:thermometer", primaryClimate, room)}
        ${extraClimate ? `
          <section class="section">
            <h2><ha-icon icon="mdi:thermometer-lines"></ha-icon>Дополнительные климатические датчики</h2>
            <div class="sensor-grid">${extraClimate}</div>
          </section>` : ""}
        ${this.section("Освещение", "mdi:lightbulb-group-outline", lighting, room)}
        ${this.section("Активность", "mdi:motion-sensor", activity, room)}
        ${this.section("Безопасность", "mdi:shield-home", security, room)}
        ${this.section("Оборудование / Медиа", "mdi:devices", equipment, room)}
        ${this.section("Камеры", "mdi:cctv", cameras, room)}
        <button class="diagnostics" type="button"
                data-route-kind="diagnostics" data-route-slug="${room.slug}">Диагностика</button>
      </div>`;
  }

  diagnosticItems(room) {
    const deviceItems = room.diagnosticDevices.map((device) => {
      const entities = room.diagnosticEntities.filter((entity) => entity.device_id === device.id);
      const labels = new Set(labelsOf(device));
      for (const entity of entities) for (const label of labelsOf(entity)) labels.add(label);
      return {
        key: `device:${device.id}`,
        title: titleOfDevice(device),
        labels,
        entities,
      };
    });
    const standaloneItems = room.diagnosticStandalone.map((entity) => ({
      key: `entity:${entity.entity_id}`,
      title: titleOfEntity(entity, this._hass),
      labels: new Set(labelsOf(entity)),
      entities: [entity],
    }));
    return [...deviceItems, ...standaloneItems].sort((left, right) => left.title.localeCompare(right.title, "ru"));
  }

  diagnosticsMarkup(room) {
    if (!room?.area) return '<div class="loading">Помещение не найдено</div>';
    const items = this.diagnosticItems(room);
    const labels = new Map();
    for (const item of items) {
      for (const label of item.labels) labels.set(label, room.labelMap.get(label) || label);
    }
    const choices = [["*", "Все"], ...[...labels.entries()].sort((a, b) => a[1].localeCompare(b[1], "ru"))];

    return `
      <div class="diagnostic-view">
        <section class="diagnostic-card">
          <h2>Оборудование</h2>
          <p>${escapeHtml(room.area.name)} · ${items.length} поз.</p>
          <div class="filters" aria-label="Фильтр по ярлыкам">
            ${choices.map(([id, name]) => `
              <button type="button" class="${id === "*" ? "active" : ""}" data-filter="${escapeHtml(id)}">
                ${escapeHtml(name)}
              </button>`).join("")}
          </div>
          <div class="devices">
            ${items.map((item) => `
              <article class="device" data-diagnostic-item data-labels="${escapeHtml([...item.labels].join(" "))}">
                <h3>${escapeHtml(item.title)}</h3>
                <div class="chips">
                  ${[...item.labels].map((label) => `<span>${escapeHtml(room.labelMap.get(label) || label)}</span>`).join("")}
                </div>
                ${item.entities.map((entity) => `
                  <button type="button" data-entity="${entity.entity_id}">
                    <span>${escapeHtml(titleOfEntity(entity, this._hass))}</span>
                    <b data-value="${entity.entity_id}">${escapeHtml(this.formatEntity(entity))}</b>
                  </button>`).join("")}
              </article>`).join("") || '<div class="loading">Нет оборудования</div>'}
          </div>
          <div class="diagnostic-empty" data-diagnostic-empty hidden>Нет оборудования для выбранного ярлыка.</div>
        </section>
      </div>`;
  }

  bindView() {
    // Controls are handled by persistent ShadowRoot delegation installed with the shell.
  }

  applyDiagnosticFilter(filter) {
    this._diagnosticFilter = filter;
    const key = this.routeKey(this._activeRoute || this.route());
    const activePanel = this._canvas?.querySelector(`[data-route-panel="${key}"]`);
    if (!activePanel) return;
    let visible = 0;
    for (const button of activePanel.querySelectorAll("[data-filter]")) {
      button.classList.toggle("active", button.dataset.filter === filter);
    }
    for (const item of activePanel.querySelectorAll("[data-diagnostic-item]")) {
      const labels = new Set(String(item.dataset.labels || "").split(/\s+/).filter(Boolean));
      const show = filter === "*" || labels.has(filter);
      item.hidden = !show;
      if (show) visible += 1;
    }
    const empty = activePanel.querySelector("[data-diagnostic-empty]");
    if (empty) empty.hidden = visible !== 0;
  }

  scheduleStatePatch() {
    if (this._stateFrame !== null) return;
    this._stateFrame = window.requestAnimationFrame(() => {
      this._stateFrame = null;
      this.patchStates();
    });
  }

  patchStates() {
    if (!this._registries || !this.isConnected) return;
    const allEntities = this._rooms.flatMap((room) => [
      ...room.entities,
      ...room.diagnosticEntities,
    ]);
    const byId = new Map(allEntities.map((entity) => [entity.entity_id, entity]));

    for (const node of this.shadowRoot.querySelectorAll("[data-value]")) {
      const entity = byId.get(node.dataset.value);
      if (!entity) continue;
      const value = this.formatEntity(entity);
      if (node.textContent !== value) node.textContent = value;
    }

    for (const card of this.shadowRoot.querySelectorAll("[data-summary-room]")) {
      const room = this.room(card.dataset.summaryRoom);
      const summary = this.summary(room);
      const text = card.querySelector("[data-summary-text]");
      if (text && text.textContent !== summary.text) text.textContent = summary.text;
      for (const tone of SUMMARY_CLASSES) {
        card.classList.toggle(`tone-${tone}`, tone === summary.tone);
      }
    }
  }

  headerModel(route = this._activeRoute || this.route()) {
    const room = route.slug ? this.room(route.slug) : null;
    if (route.kind === "overview") {
      return {
        title: "Помещения",
        subtitle: `UI v${UI_VERSION}`,
        backPath: this._houseRoute || SAFE_DEFAULT_ROUTE,
      };
    }
    if (route.kind === "diagnostics") {
      return {
        title: room?.name || "Помещение",
        subtitle: `UI v${UI_VERSION}`,
        backPath: room ? `/dashboard-rooms-v11/room-${room.slug}` : ROOT_PATH,
      };
    }
    return {
      title: room?.name || "Помещение",
      subtitle: `UI v${UI_VERSION}`,
      backPath: ROOT_PATH,
    };
  }

  updateHeader(route = this._activeRoute || this.route()) {
    const title = this.shadowRoot?.querySelector(".title-return");
    const strong = title?.querySelector("strong");
    const secondary = title?.querySelector("small");
    if (!title || !strong || !secondary) return;
    const model = this.headerModel(route);
    if (strong.textContent !== model.title) strong.textContent = model.title;
    if (secondary.textContent !== model.subtitle) secondary.textContent = model.subtitle;
    if (route.kind === "overview") {
      title.dataset.path = model.backPath || SAFE_DEFAULT_ROUTE;
      delete title.dataset.routeKind;
      delete title.dataset.routeSlug;
    } else {
      delete title.dataset.path;
      title.dataset.routeKind = route.kind === "diagnostics" ? "room" : "overview";
      if (route.kind === "diagnostics" && route.slug) title.dataset.routeSlug = route.slug;
      else delete title.dataset.routeSlug;
    }
    const destination = model.backPath === ROOT_PATH
      ? "к обзору помещений"
      : route.kind === "diagnostics"
        ? `к помещению ${model.title}`
        : "в панель Дом";
    const label = `${model.title} — вернуться ${destination}`;
    if (title.getAttribute("aria-label") !== label) title.setAttribute("aria-label", label);
  }

  updateTabs(route = this._activeRoute || this.route()) {
    const roomsButton = this.shadowRoot?.querySelector('.tabs button[data-route-kind="overview"]');
    if (!roomsButton) return;
    roomsButton.classList.add("active");
    roomsButton.setAttribute("aria-current", "page");
    roomsButton.disabled = route.kind === "overview";
  }

  syncRefreshState() {
    const refresh = this.shadowRoot?.querySelector(".refresh");
    if (!refresh) return;
    if (refresh.disabled !== this._loading) refresh.disabled = this._loading;
    const busy = this._loading ? "true" : "false";
    if (refresh.getAttribute("aria-busy") !== busy) refresh.setAttribute("aria-busy", busy);
  }

  resetViewportForRoute() {
    this._zoom.x = 0;
    this._zoom.y = 0;
    this._viewport?.scrollTo({ left: 0, top: 0 });
    this.applyTransform();
    this.saveZoom();
  }

  loadZoom() {
    try {
      const parsed = JSON.parse(localStorage.getItem(ZOOM_KEY) || "{}");
      const scale = this.clamp(Number(parsed.scale) || 1, 0.75, 2);
      if (scale >= 0.97 && scale <= 1.03) return { scale: 1, x: 0, y: 0 };
      return { scale, x: Number(parsed.x) || 0, y: Number(parsed.y) || 0 };
    } catch (_error) {
      return { scale: 1, x: 0, y: 0 };
    }
  }

  touchStart(event) {
    const touches = event.touches;
    if (touches.length === 2) {
      event.preventDefault();
      this._suppressClicksUntil = Date.now() + 500;
      if (this._zoom.scale <= 1.03) {
        this._zoom.x = 0;
        this._zoom.y = -this._viewport.scrollTop;
        this._viewport.scrollTo({ left: 0, top: 0 });
      }
      const center = this.touchCenter(touches);
      this._gesture = {
        kind: "pinch",
        distance: this.touchDistance(touches),
        scale: this._zoom.scale,
        worldX: (center.x - this._zoom.x) / this._zoom.scale,
        worldY: (center.y - this._zoom.y) / this._zoom.scale,
        moved: false,
        started: performance.now(),
      };
    } else if (touches.length === 1 && this._zoom.scale > 1.03 && this.canPan()) {
      this._gesture = {
        kind: "pan",
        startX: touches[0].clientX,
        startY: touches[0].clientY,
        x: this._zoom.x,
        y: this._zoom.y,
        moved: false,
      };
    } else {
      this._gesture = null;
    }
  }

  touchMove(event) {
    if (!this._gesture) return;
    if (event.touches.length === 2 && this._gesture.kind === "pinch") {
      event.preventDefault();
      const center = this.touchCenter(event.touches);
      const ratio = this.touchDistance(event.touches) / Math.max(this._gesture.distance, 1);
      this._zoom.scale = this.clamp(this._gesture.scale * ratio, 0.75, 2);
      this._zoom.x = center.x - this._gesture.worldX * this._zoom.scale;
      this._zoom.y = center.y - this._gesture.worldY * this._zoom.scale;
      this._gesture.moved = Math.abs(ratio - 1) > 0.02;
      this.applyTransform();
    } else if (event.touches.length === 1 && this._gesture.kind === "pan") {
      event.preventDefault();
      const dx = event.touches[0].clientX - this._gesture.startX;
      const dy = event.touches[0].clientY - this._gesture.startY;
      this._zoom.x = this._gesture.x + dx;
      this._zoom.y = this._gesture.y + dy;
      this._gesture.moved = Math.abs(dx) + Math.abs(dy) > 6;
      this.applyTransform();
    }
  }

  touchEnd(event) {
    if (event.touches.length > 0) return;
    const gesture = this._gesture;
    if (!gesture) return;
    if (gesture.kind === "pinch") {
      const now = performance.now();
      if (!gesture.moved && now - gesture.started < 280) {
        if (now - this._lastTwoTap < 380) {
          this.resetZoom();
          this._lastTwoTap = 0;
        } else {
          this._lastTwoTap = now;
        }
      } else if (this._zoom.scale >= 0.97 && this._zoom.scale <= 1.03) {
        this._lastTwoTap = 0;
        this.resetZoom();
      } else {
        this._lastTwoTap = 0;
        this.saveZoom();
      }
      this._suppressClicksUntil = Date.now() + 500;
    } else {
      this.saveZoom();
      if (gesture.moved) this._suppressClicksUntil = Date.now() + 350;
    }
    this._gesture = null;
  }

  resetZoom() {
    this._zoom = { scale: 1, x: 0, y: 0 };
    this._viewport?.scrollTo({ left: 0, top: 0, behavior: "smooth" });
    this.applyTransform();
    this.saveZoom();
    this._toast?.classList.add("show");
    window.clearTimeout(this._toastTimer);
    this._toastTimer = window.setTimeout(() => this._toast?.classList.remove("show"), 1100);
  }

  saveZoom() {
    try {
      localStorage.setItem(ZOOM_KEY, JSON.stringify(this._zoom));
    } catch (_error) {
      // Local persistence is optional; the active transform remains valid.
    }
  }

  applyTransform() {
    if (!this._viewport || !this._canvas) return;
    const scale = this._zoom.scale;
    const viewportWidth = Math.max(1, this._viewport.clientWidth);
    const viewportHeight = Math.max(1, this._viewport.clientHeight);
    const contentWidth = Math.max(1, this._canvas.offsetWidth);
    const contentHeight = Math.max(1, this._canvas.scrollHeight);
    const scaledWidth = contentWidth * scale;
    const scaledHeight = contentHeight * scale;

    if (Math.abs(scale - 1) < 0.001) {
      this._zoom = { scale: 1, x: 0, y: 0 };
    } else {
      this._zoom.x = scaledWidth <= viewportWidth
        ? (viewportWidth - scaledWidth) / 2
        : Math.min(0, Math.max(viewportWidth - scaledWidth, this._zoom.x));
      this._zoom.y = scaledHeight <= viewportHeight
        ? 0
        : Math.min(0, Math.max(viewportHeight - scaledHeight, this._zoom.y));
    }
    const enlarged = this._zoom.scale > 1.03;
    this._viewport.classList.toggle("zoomed", enlarged);
    this._canvas.style.transform = `translate3d(${this._zoom.x}px,${this._zoom.y}px,0) scale(${this._zoom.scale})`;
  }

  canPan() {
    if (!this._viewport || !this._canvas || this._zoom.scale <= 1.03) return false;
    return this._canvas.offsetWidth * this._zoom.scale > this._viewport.clientWidth + 1
      || this._canvas.scrollHeight * this._zoom.scale > this._viewport.clientHeight + 1;
  }

  touchCenter(touches) {
    const rect = this._viewport.getBoundingClientRect();
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2 - rect.left,
      y: (touches[0].clientY + touches[1].clientY) / 2 - rect.top,
    };
  }

  touchDistance(touches) {
    return Math.hypot(
      touches[1].clientX - touches[0].clientX,
      touches[1].clientY - touches[0].clientY,
    );
  }

  clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  styles() {
    return `
      :host{
        position:fixed;inset:0;z-index:1;display:block;min-width:0;min-height:0;
        overflow:hidden;overscroll-behavior:none;color:var(--primary-text-color,#111);
        background:var(--primary-background-color,#f7f7f7);
        font-family:var(--paper-font-body1_-_font-family,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif)
      }
      *{box-sizing:border-box}
      button{
        appearance:none;-webkit-appearance:none;font:inherit;touch-action:manipulation;
        -webkit-tap-highlight-color:transparent
      }
      .app{
        position:absolute;inset:0;display:grid;min-width:0;min-height:0;overflow:hidden;
        grid-template-rows:calc(62px + env(safe-area-inset-top,0px)) minmax(0,1fr)
          calc(70px + env(safe-area-inset-bottom,0px));
        background:var(--primary-background-color,#f7f7f7);overscroll-behavior:none
      }
      .navigation-proxy{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);pointer-events:none}
      .header{
        position:relative;z-index:20;min-width:0;padding:env(safe-area-inset-top,0px)
          max(12px,env(safe-area-inset-right,0px)) 0 max(12px,env(safe-area-inset-left,0px));
        display:grid;grid-template-columns:52px minmax(0,1fr) 52px;align-items:center;
        background:color-mix(in srgb,var(--primary-background-color,#f7f7f7) 97%,transparent);
        border-bottom:1px solid color-mix(in srgb,var(--divider-color,#dfe3e8) 70%,transparent);
        backdrop-filter:blur(18px) saturate(130%);-webkit-backdrop-filter:blur(18px) saturate(130%)
      }
      .shell-button{
        width:44px;height:44px;padding:0;border:1px solid color-mix(in srgb,var(--divider-color,#dfe3e8) 72%,transparent);
        border-radius:16px;background:var(--card-background-color,#fff);box-shadow:0 7px 20px rgba(23,45,76,.08);
        display:grid;place-items:center;color:var(--primary-text-color,#17191c);cursor:pointer
      }
      .shell-button.refresh{justify-self:end;color:var(--primary-color,#03a9d9)}
      .shell-button ha-icon{--mdc-icon-size:25px}
      .shell-button:disabled{opacity:.52;cursor:wait}
      .title-return{
        justify-self:center;min-width:min(290px,100%);max-width:100%;min-height:44px;padding:5px 14px;
        border:1px solid color-mix(in srgb,var(--primary-color,#03a9d9) 24%,var(--divider-color,#dfe3e8));
        border-radius:16px;background:color-mix(in srgb,var(--primary-color,#03a9d9) 5%,var(--card-background-color,#fff));
        box-shadow:0 5px 16px rgba(23,45,76,.06);color:inherit;display:grid;place-content:center;text-align:center;
        cursor:pointer;line-height:1.08
      }
      .title-return strong{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:23px;font-weight:800}
      .title-return small{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;font-weight:560;color:var(--secondary-text-color,#68737d)}
      .title-return:active{
        transform:scale(.985);border-color:color-mix(in srgb,var(--primary-color,#03a9d9) 42%,var(--divider-color,#dfe3e8));
        background:color-mix(in srgb,var(--primary-color,#03a9d9) 13%,var(--card-background-color,#fff));
        box-shadow:0 2px 7px rgba(23,45,76,.05)
      }
      .title-return:focus-visible,.shell-button:focus-visible,.tabs button:focus-visible{
        outline:2px solid var(--primary-color,#03a9d9);outline-offset:2px
      }
      .viewport{
        position:relative;z-index:1;min-width:0;min-height:0;overflow-y:auto;overflow-x:hidden;
        overscroll-behavior:none;touch-action:pan-y;background:var(--primary-background-color,#f7f7f7);
        -webkit-overflow-scrolling:touch;overflow-anchor:none
      }
      .viewport.zoomed{overflow:hidden;touch-action:none}
      .canvas{min-height:100%;padding:10px 8px 18px;transform-origin:0 0}
      .tabs{
        position:relative;z-index:20;min-width:0;min-height:0;padding:6px max(6px,env(safe-area-inset-right,0px))
          calc(6px + env(safe-area-inset-bottom,0px)) max(6px,env(safe-area-inset-left,0px));
        display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:2px;background:var(--card-background-color,#fff);
        border-top:1px solid var(--divider-color,#dfe3e8);box-shadow:0 -5px 22px rgba(23,45,76,.08)
      }
      .tabs button{
        min-width:0;min-height:52px;padding:5px 3px;border:0;border-radius:16px;background:transparent;
        color:var(--secondary-text-color,#68737d);display:flex;flex-direction:column;align-items:center;justify-content:center;
        gap:3px;font-weight:700;cursor:pointer
      }
      .tabs button ha-icon{--mdc-icon-size:28px}
      .tabs button small{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:700}
      .tabs button.active{color:var(--primary-color,#03a9d9);background:color-mix(in srgb,var(--primary-color,#03a9d9) 11%,transparent)}
      .tabs button:disabled{opacity:1;cursor:default}
      .zoom-toast{
        position:absolute;z-index:40;left:50%;top:calc(68px + env(safe-area-inset-top,0px));
        transform:translate(-50%,-12px);opacity:0;padding:8px 13px;border-radius:999px;
        background:rgba(30,34,38,.9);color:#fff;font-size:12px;transition:.2s;pointer-events:none
      }
      .zoom-toast.show{opacity:1;transform:translate(-50%,0)}
      .loading{padding:24px;text-align:center;color:var(--secondary-text-color,#666);font-size:14px}
      .route-panel[hidden]{display:none!important}
      .registry-message{display:grid;justify-items:center;gap:8px}
      .registry-message strong{color:var(--primary-text-color,#222);font-size:16px}
      .registry-message small{max-width:320px;font-size:13px;line-height:1.35}
      .registry-message button{
        min-height:40px;margin-top:4px;padding:8px 16px;border:1px solid var(--primary-color,#2196f3);
        border-radius:13px;background:transparent;color:var(--primary-color,#2196f3);
        font:inherit;font-weight:750
      }
      .overview{min-height:100%;display:flex;flex-direction:column;justify-content:space-between;gap:6px}
      .floor h2{
        height:22px;margin:0 0 4px;display:flex;align-items:center;gap:7px;
        font-size:16px;font-weight:650
      }
      .floor h2 ha-icon{--mdc-icon-size:20px}
      .room-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px 7px}
      .room-card{
        min-height:46px;border:1px solid var(--divider-color,#ddd);border-radius:14px;
        background:var(--card-background-color,#fff);padding:5px 9px;
        display:grid;grid-template-columns:32px minmax(0,1fr);gap:5px;align-items:center;
        text-align:left;color:inherit
      }
      .room-card:focus-visible,.entity:focus-visible,.sensor-card button:focus-visible,
      .device button:focus-visible,.diagnostics:focus-visible,.filters button:focus-visible{
        outline:2px solid var(--primary-color,#2196f3);outline-offset:2px
      }
      .room-card>ha-icon{--mdc-icon-size:25px;color:var(--primary-color,#2196f3)}
      .room-card b,.room-card small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .room-card b{font-size:14px}
      .room-card small{font-size:12px;margin-top:1px}
      .tone-red>ha-icon{color:var(--error-color,#db4437)}.tone-yellow>ha-icon{color:#f2c400}
      .tone-orange>ha-icon{color:var(--warning-color,#fb8c00)}.tone-blue>ha-icon{color:var(--primary-color,#2196f3)}
      .tone-grey>ha-icon{color:var(--disabled-text-color,#999)}
      .section{margin:0 0 13px}
      .section h2{display:flex;align-items:center;gap:8px;margin:0 0 7px;font-size:19px}
      .section h2 ha-icon{--mdc-icon-size:23px}
      .entity-grid,.sensor-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
      .entity,.sensor-card{
        min-height:52px;border:1px solid var(--divider-color,#ddd);border-radius:14px;
        background:var(--card-background-color,#fff);color:inherit;padding:9px 10px
      }
      .entity{display:grid;grid-template-columns:24px minmax(0,1fr) auto;align-items:center;gap:7px;text-align:left}
      .entity>ha-icon,.sensor-card button>ha-icon{--mdc-icon-size:21px;color:var(--primary-color,#2196f3)}
      .entity span,.sensor-card button span,.device button span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .entity span,.sensor-card button span,.device button span{font-size:13px}
      .entity-copy{min-width:0;display:grid;gap:1px}
      .entity-copy>span{display:block;min-width:0}
      .entity-copy>small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:650}
      .entity.status-service{border-color:color-mix(in srgb,var(--warning-color,#f6a623) 40%,var(--divider-color,#ddd))}
      .entity.status-service .entity-copy>small{color:var(--warning-color,#f6a623)}
      .entity.status-replacement{border-color:color-mix(in srgb,var(--error-color,#db4437) 40%,var(--divider-color,#ddd))}
      .entity.status-replacement .entity-copy>small{color:var(--error-color,#db4437)}
      .entity b,.sensor-card strong,.device button b{white-space:nowrap;font-size:12px;color:var(--secondary-text-color,#666)}
      .sensor-card>b{display:block;margin-bottom:5px;font-size:14px}
      .sensor-card button,.device button{
        width:100%;border:0;border-top:1px solid var(--divider-color,#ddd);background:transparent;
        color:inherit;padding:7px 0;display:grid;grid-template-columns:24px minmax(0,1fr) auto;
        gap:7px;align-items:center;text-align:left
      }
      .sensor-card button.status-service span{color:var(--warning-color,#f6a623)}
      .sensor-card button.status-replacement span{color:var(--error-color,#db4437)}
      .device button{grid-template-columns:minmax(0,1fr) auto}
      .diagnostics{
        width:100%;min-height:52px;border:1px solid var(--divider-color,#ddd);border-radius:16px;
        background:var(--card-background-color,#fff);font-size:17px;font-weight:800;color:inherit;
        display:grid;place-items:center
      }
      .diagnostic-card{
        background:var(--card-background-color,#fff);border:1px solid var(--divider-color,#ddd);
        border-radius:18px;padding:13px
      }
      .diagnostic-card h2{margin:0;font-size:20px}
      .diagnostic-card p{margin:3px 0 10px;color:var(--secondary-text-color,#666);font-size:13px}
      .filters{display:flex;gap:7px;overflow-x:auto;padding:1px 0 10px;scrollbar-width:none}
      .filters::-webkit-scrollbar{display:none}
      .filters button{
        flex:0 0 auto;min-height:34px;padding:6px 10px;border:1px solid var(--divider-color,#ddd);
        border-radius:999px;background:transparent;color:inherit;font-size:12px;font-weight:700
      }
      .filters button.active{background:var(--primary-color,#2196f3);border-color:var(--primary-color,#2196f3);color:#fff}
      .devices{display:grid;gap:9px}
      .device{
        background:var(--secondary-background-color,#eee);border:1px solid var(--divider-color,#ddd);
        border-radius:14px;padding:10px
      }
      .device[hidden]{display:none}
      .device h3{margin:0 0 7px;font-size:16px}
      .chips{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:5px}
      .chips span{
        padding:3px 6px;border-radius:999px;background:var(--card-background-color,#fff);
        font-size:12px;color:var(--secondary-text-color,#666)
      }
      .diagnostic-empty{padding:12px 2px;color:var(--secondary-text-color,#666);font-size:13px}
      @media(max-height:780px){
        .canvas{padding-top:7px}.room-card{min-height:43px}.room-card b{font-size:13px}
        .floor h2{height:20px;margin-bottom:2px}.overview{gap:3px}
      }
      @media(max-width:390px){
        .header{grid-template-columns:48px minmax(0,1fr) 48px;padding-inline:max(8px,env(safe-area-inset-left,0px))}
        .title-return{min-width:0;width:100%;padding-inline:8px}
        .title-return strong{font-size:21px}.title-return small{font-size:13px}
        .canvas{padding-inline:7px}.entity,.sensor-card{padding-inline:8px}
      }
      @media(min-width:850px){.canvas{width:min(900px,100%);margin:0 auto}}
    `;
  }
}

if (!customElements.get(ELEMENT_NAME)) customElements.define(ELEMENT_NAME, NikasRoomsV11);
