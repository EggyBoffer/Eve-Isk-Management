import { app, BrowserWindow, ipcMain, globalShortcut, shell } from "electron";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import os from "os";
import db from "./database.js";
import { registerEsiIpc } from "./esi/esiIpc.js";
import { initialiseOfficerDatabase } from "./officers/officerDatabase.js";
import { registerOfficerIpc } from "./officers/officerIpc.js";
import { createTelemetryService } from "./telemetry/telemetryService.js";
import {
  saveCrabRun,
  getRecentCrabRuns,
  getCrabRunById,
  getAllCrabRuns,
} from "./crabDatabase.js";

console.log("DB path being used:", db.name);

try {
  db.prepare(`ALTER TABLE abyssals ADD COLUMN tier TEXT`).run();
  console.log("Added 'tier' column to abyssals");
} catch (err) {
  if (!err.message.includes("duplicate column")) {
    console.error("Error adding 'tier':", err.message);
  }
}

try {
  db.prepare(`ALTER TABLE abyssals ADD COLUMN storm_type TEXT`).run();
  console.log("Added 'storm_type' column to abyssals");
} catch (err) {
  if (!err.message.includes("duplicate column")) {
    console.error("Error adding 'storm_type':", err.message);
  }
}

try {
  db.prepare(`ALTER TABLE abyssals ADD COLUMN ship_type TEXT`).run();
  console.log("Added 'ship_type' column to abyssals");
} catch (err) {
  if (!err.message.includes("duplicate column")) {
    console.error("Error adding 'ship_type':", err.message);
  }
}

const settingsPath = path.join(app.getPath("userData"), "settings.json");
const telemetryService = createTelemetryService(app.getPath("userData"));
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const allowedCategories = new Set([
  "abyssals",
  "glorified",
]);

const allowedExternalHosts = new Set([
  "github.com",
  "www.github.com",
  "discord.gg",
]);

const MAX_API_RESPONSE_BYTES = 8 * 1024 * 1024;
const MAX_API_REQUEST_BYTES = 64 * 1024;
const API_TIMEOUT_MS = 15000;

function validateCategory(category) {
  if (typeof category !== "string" || !allowedCategories.has(category)) {
    throw new Error("Invalid database category");
  }
  return category;
}

function validateEntry(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new Error("Invalid entry");
  }
  return entry;
}

const MAX_ISK_VALUE = 1_000_000_000_000_000;
const MAX_RUN_SECONDS = 86400;

function validateRecordFields(value, allowed, name) {
  validateEntry(value);
  const keys = Object.keys(value);
  if (keys.some((key) => !allowed.includes(key))) {
    throw new Error(`Invalid ${name} fields`);
  }
  return value;
}

function validateFiniteAmount(value, name, maximum = MAX_ISK_VALUE) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > maximum) {
    throw new Error(`Invalid ${name}`);
  }
  return value;
}

function validateShortText(value, name, maxLength = 128) {
  if (
    typeof value !== "string" ||
    value.length > maxLength ||
    [...value].some((character) => {
      const code = character.codePointAt(0);
      return code <= 31 || code === 127;
    })
  ) {
    throw new Error(`Invalid ${name}`);
  }

  return value;
}

function validateEntryDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Invalid entry date");
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error("Invalid entry date");
  }
  return value;
}

function validateAbyssalEntry(entry) {
  const allowed = ["date", "room1_isk", "room2_isk", "room3_isk", "time_taken", "fillament_cost", "tier", "storm_type", "ship_type"];
  validateRecordFields(entry, allowed, "Abyssal entry");
  if (entry.date !== undefined) validateEntryDate(entry.date);
  for (const key of ["room1_isk", "room2_isk", "room3_isk", "fillament_cost"]) {
    if (entry[key] !== undefined) validateFiniteAmount(entry[key], key);
  }
  if (entry.time_taken !== undefined) validateFiniteAmount(entry.time_taken, "time_taken", MAX_RUN_SECONDS);
  for (const key of ["tier", "storm_type", "ship_type"]) {
    if (entry[key] !== undefined) validateShortText(entry[key], key);
  }
  return entry;
}

function validateGlorifiedEntry(entry) {
  validateRecordFields(entry, ["date", "isk_earned", "tier", "storm_type"], "Glorified entry");
  if (entry.date !== undefined) validateEntryDate(entry.date);
  if (entry.isk_earned !== undefined) validateFiniteAmount(entry.isk_earned, "isk_earned");
  for (const key of ["tier", "storm_type"]) {
    if (entry[key] !== undefined) validateShortText(entry[key], key);
  }
  return entry;
}

function validateOverlayLaunch(cost, shipType, tier, stormType) {
  validateFiniteAmount(cost, "filament cost");
  validateShortText(shipType, "ship type");
  validateShortText(tier, "filament tier");
  validateShortText(stormType, "storm type");
}

function validateId(id) {
  const parsed = Number(id);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error("Invalid entry ID");
  }
  return parsed;
}

function validateExternalUrl(value) {
  if (typeof value !== "string" || value.length > 2048) {
    throw new Error("Invalid external URL");
  }

  const url = new URL(value);

  if (
    url.protocol !== "https:" ||
    !allowedExternalHosts.has(url.hostname.toLowerCase()) ||
    url.username ||
    url.password
  ) {
    throw new Error("External URL is not permitted");
  }

  return url.toString();
}

function validateApiRequest(request) {
  if (
    !request ||
    typeof request !== "object" ||
    Array.isArray(request)
  ) {
    throw new Error("Invalid API request");
  }

  const { url: value, method = "GET", body } = request;

  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 4096
  ) {
    throw new Error("Invalid API URL");
  }

  if (method !== "GET" && method !== "POST") {
    throw new Error("API method is not permitted");
  }

  const url = new URL(value);

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hash ||
    url.port ||
    url.hostname !== url.hostname.toLowerCase()
  ) {
    throw new Error("Invalid API destination");
  }

  const hostname = url.hostname;
  const pathname = url.pathname;
  const params = url.searchParams;

  const hasOnlyParams = (allowed) =>
    [...params.keys()].every((key) => allowed.includes(key));

  const isPositiveInteger = (value) =>
    typeof value === "string" &&
    /^[1-9]\d*$/.test(value) &&
    Number.isSafeInteger(Number(value));

  let permitted = false;

  if (
    hostname === "market.fuzzwork.co.uk" &&
    pathname === "/aggregates/" &&
    method === "GET"
  ) {
    const region = params.get("region");
    const types = params.get("types");

    permitted =
      hasOnlyParams(["region", "types"]) &&
      region === "10000002" &&
      typeof types === "string" &&
      types.length <= 3000 &&
      /^[1-9]\d*(,[1-9]\d*)*$/.test(types) &&
      types.split(",").every(isPositiveInteger);
  }

  if (
    hostname === "www.fuzzwork.co.uk" &&
    pathname === "/api/typeid.php" &&
    method === "GET"
  ) {
    const typename = params.get("typename");

    permitted =
      hasOnlyParams(["typename"]) &&
      typeof typename === "string" &&
      typename.length > 0 &&
      typename.length <= 256;
  }

  if (
    hostname === "esi.evetech.net" &&
    pathname === "/latest/markets/10000002/orders/" &&
    method === "GET"
  ) {
    permitted =
      hasOnlyParams(["type_id", "order_type", "page", "datasource"]) &&
      isPositiveInteger(params.get("type_id")) &&
      (!params.has("order_type") ||
        ["all", "buy", "sell"].includes(params.get("order_type"))) &&
      (!params.has("page") ||
        isPositiveInteger(params.get("page"))) &&
      (!params.has("datasource") ||
        params.get("datasource") === "tranquility");
  }

  if (
    hostname === "esi.evetech.net" &&
    pathname === "/latest/universe/ids/" &&
    method === "POST"
  ) {
    permitted =
      hasOnlyParams(["datasource"]) &&
      (!params.has("datasource") ||
        params.get("datasource") === "tranquility");
  }

  if (
    hostname === "api.github.com" &&
    pathname === "/repos/EggyBoffer/Eve-Isk-Management/releases/latest" &&
    method === "GET"
  ) {
    permitted = params.size === 0;
  }

  if (
    hostname === "raw.githubusercontent.com" &&
    pathname === "/EggyBoffer/Eve-Isk-Management/main/latest.json" &&
    method === "GET"
  ) {
    permitted = params.size === 0;
  }

  if (!permitted) {
    console.warn("[API SECURITY] Rejected request:", {
      hostname,
      pathname,
      method,
      query: url.search,
    });

    throw new Error("API endpoint is not permitted");
  }

  if (method === "GET" && body !== undefined) {
    throw new Error("GET requests cannot contain a body");
  }

  let serializedBody;

  if (method === "POST") {
    if (
      !Array.isArray(body) ||
      body.length === 0 ||
      body.length > 1000 ||
      !body.every(
        (item) =>
          typeof item === "string" &&
          item.length > 0 &&
          item.length <= 256
      )
    ) {
      throw new Error("Invalid ESI universe IDs request body");
    }

    serializedBody = JSON.stringify(body);

    if (Buffer.byteLength(serializedBody) > MAX_API_REQUEST_BYTES) {
      throw new Error("API request body exceeds the size limit");
    }
  }

  return {
    url: url.toString(),
    method,
    body: serializedBody,
  };
}

async function performApiRequest(request) {
  const validated = validateApiRequest(request);
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, API_TIMEOUT_MS);

  try {
    const response = await fetch(validated.url, {
      method: validated.method,
      headers: {
        Accept: "application/json",
        ...(validated.method === "POST"
          ? { "Content-Type": "application/json" }
          : {}),
      },
      body: validated.body,
      redirect: "manual",
      credentials: "omit",
      signal: controller.signal,
    });

    if (response.status >= 300 && response.status < 400) {
      throw new Error("API redirects are not permitted");
    }

    const contentLength = response.headers.get("content-length");

    if (
      contentLength !== null &&
      Number(contentLength) > MAX_API_RESPONSE_BYTES
    ) {
      throw new Error("API response exceeds the size limit");
    }

    const chunks = [];
    let totalBytes = 0;

    if (response.body) {
      for await (const chunk of response.body) {
        totalBytes += chunk.byteLength;

        if (totalBytes > MAX_API_RESPONSE_BYTES) {
          await response.body.cancel().catch(() => {});
          throw new Error("API response exceeds the size limit");
        }

        chunks.push(Buffer.from(chunk));
      }
    }

    const responseText = Buffer.concat(chunks).toString("utf8");
    let data;

    try {
      data = JSON.parse(responseText);
    } catch {
      data = responseText;
    }

    return {
      ok: response.ok,
      status: response.status,
      data,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function loadSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  } catch {
    return {};
  }
}

function saveSettings(settings) {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    throw new Error("Invalid settings");
  }

  fs.writeFileSync(
    settingsPath,
    JSON.stringify({ ...loadSettings(), ...settings }, null, 2)
  );
}

let mainWindow;
let splash;
const overlayWindows = new Set();
const DEFAULT_OVERLAY_HOTKEY = "Control+Shift+F12";
let registeredOverlayHotkey = null;

function validateOverlayHotkey(value) {
  if (typeof value !== "string") {
    throw new Error("Invalid overlay hotkey");
  }

  const parts = value.split("+");
  const key = parts.at(-1);
  const modifiers = parts.slice(0, -1);

  if (!/^F([1-9]|1[0-2])$/.test(key)) {
    throw new Error("The overlay hotkey must use F1-F12");
  }

  if (
    modifiers.length === 0 ||
    new Set(modifiers).size !== modifiers.length ||
    modifiers.some((modifier) => !["Control", "Shift", "Alt"].includes(modifier))
  ) {
    throw new Error("Select at least one valid modifier");
  }

  return value;
}

function getOverlayHotkey() {
  try {
    return validateOverlayHotkey(
      loadSettings().overlayCloseHotkey ?? DEFAULT_OVERLAY_HOTKEY
    );
  } catch {
    return DEFAULT_OVERLAY_HOTKEY;
  }
}

function closeAllOverlays() {
  for (const overlay of [...overlayWindows]) {
    if (!overlay.isDestroyed()) {
      overlay.close();
    }
  }
}

function registerOverlayHotkey(hotkey) {
  if (registeredOverlayHotkey === hotkey) {
    return true;
  }

  if (!globalShortcut.register(hotkey, closeAllOverlays)) {
    console.warn("[OVERLAY] Global shortcut unavailable:", hotkey);
    return false;
  }

  const previous = registeredOverlayHotkey;
  registeredOverlayHotkey = hotkey;

  if (previous) {
    globalShortcut.unregister(previous);
  }

  console.log("[OVERLAY] Global shortcut registered:", hotkey);
  return true;
}

function unregisterOverlayHotkey() {
  if (registeredOverlayHotkey) {
    globalShortcut.unregister(registeredOverlayHotkey);
    registeredOverlayHotkey = null;
  }
}

function isWindowSender(event, window) {
  return Boolean(
    window &&
    !window.isDestroyed() &&
    !event.sender.isDestroyed() &&
    event.sender === window.webContents &&
    event.senderFrame === window.webContents.mainFrame
  );
}

function assertMainSender(event) {
  if (!isWindowSender(event, mainWindow)) {
    throw new Error("IPC operation is not permitted from this window");
  }
}

const { autoSync } = registerEsiIpc({
  ipcMain,
  db,
  shell,
  assertMainSender,
  onCharacterLinked: (characterId) =>
    officerSync.runOnce({ characterId }),
});

initialiseOfficerDatabase(db);


const { officerSync } = registerOfficerIpc({
  ipcMain,
  db,
  assertMainSender,
});

function isOverlaySender(event) {
  for (const window of overlayWindows) {
    if (isWindowSender(event, window)) {
      return true;
    }
  }

  return false;
}

function assertAbyssalWriteSender(event, category) {
  if (isWindowSender(event, mainWindow)) {
    return;
  }

  if (category === "abyssals" && isOverlaySender(event)) {
    return;
  }

  throw new Error("IPC operation is not permitted from this window");
}

function notifyEntriesUpdated(table, action, extra = {}) {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("entries-updated", {
        table,
        action,
        ...extra,
      });
    }
  } catch (err) {
    console.error("Failed to notify renderer:", err);
  }
}

function getProdIndexPath() {
  return path.join(app.getAppPath(), "dist", "index.html");
}

function protectWindowNavigation(window, allowedFilePath) {
  const allowedDevOrigin = "http://localhost:5173";
  const allowedFileUrl = pathToFileURL(allowedFilePath).href;

  function isAllowedNavigation(value) {
    try {
      const target = new URL(value);

      if (!app.isPackaged) {
        return (
          target.origin === allowedDevOrigin &&
          (target.pathname === "/" || target.pathname === "/index.html") &&
          !target.username &&
          !target.password
        );
      }

      return (
        target.protocol === "file:" &&
        target.origin === "null" &&
        target.pathname === new URL(allowedFileUrl).pathname &&
        !target.search
      );
    } catch {
      return false;
    }
  }

  window.webContents.on("will-navigate", (event, url) => {
    if (!isAllowedNavigation(url)) {
      event.preventDefault();
      console.warn("[NAVIGATION SECURITY] Blocked:", url);
    }
  });

  window.webContents.on("will-frame-navigate", (event) => {
    if (!event.isMainFrame || !isAllowedNavigation(event.url)) {
      event.preventDefault();
      console.warn("[NAVIGATION SECURITY] Blocked frame:", event.url);
    }
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    console.warn("[NAVIGATION SECURITY] Blocked new window:", url);
    return { action: "deny" };
  });
}

function createMainWindow() {
  const preloadPath = path.join(__dirname, "preload.js");

  const windowIcon = app.isPackaged
    ? path.join(process.resourcesPath, "iskonomy.ico")
    : path.join(process.cwd(), "public", "iskonomy.ico");

  mainWindow = new BrowserWindow({
    width: 1300,
    height: 900,
    show: false,
    icon: windowIcon,
    title: "ISKonomy",
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  protectWindowNavigation(mainWindow, getProdIndexPath());

  const isDev = !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    const indexPath = getProdIndexPath();

    if (!fs.existsSync(indexPath)) {
      console.error("UI file missing in packaged build:", indexPath);
    }

    mainWindow.loadFile(indexPath);
  }

  mainWindow.webContents.on("did-fail-load", (_e, code, desc) => {
    try {
      splash?.webContents?.send(
        "boot:progress",
        `Failed to load UI (${code}): ${desc}`
      );
    } catch (err) {
      console.warn("[SPLASH] Failed to send load error:", err.message);
    }
  });

  mainWindow.webContents.on("did-finish-load", () => {
    splash?.webContents?.send("boot:progress", "Starting ISKONOMY!...");
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
    closeAllOverlays();

    if (splash && !splash.isDestroyed()) {
      splash.close();
    }

    splash = null;
  });
}

function createSplash() {
  const windowIcon = app.isPackaged
    ? path.join(process.resourcesPath, "iskonomy.ico")
    : path.join(process.cwd(), "public", "iskonomy.ico");

  splash = new BrowserWindow({
    width: 320,
    height: 320,
    transparent: false,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    icon: windowIcon,
    center: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "splashPreload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });

  protectWindowNavigation(
    splash,
    path.join(__dirname, "splash.html")
  );

  const logoPath = path.join(
    process.resourcesPath,
    "splash-assets",
    "iskonomy.png"
  );

  splash.loadFile(path.join(__dirname, "splash.html"));

  splash.webContents.once("did-finish-load", () => {
    if (!splash || splash.isDestroyed()) return;

    splash.webContents.send("splash:version", app.getVersion());
    splash.webContents.send("logo-path", pathToFileURL(logoPath).href);
    splash.show();
  });

  splash.on("closed", () => {
    splash = null;
  });
}

ipcMain.on("boot:progress", (event, msg) => {
  if (!isWindowSender(event, mainWindow)) return;
  if (splash && !splash.isDestroyed()) {
    splash.webContents.send(
      "boot:progress",
      String(msg || "").slice(0, 500)
    );
  }
});

ipcMain.on("boot:done", (event) => {
  if (!isWindowSender(event, mainWindow)) return;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
  }

  if (splash && !splash.isDestroyed()) {
    splash.close();
  }
});

function createOverlay() {
  const savedSettings = loadSettings();

  const overlayWin = new BrowserWindow({
    width: 275,
    height: 80,
    x: savedSettings.x,
    y: savedSettings.y,
    title: "Overlay",
    alwaysOnTop: true,
    frame: false,
    backgroundColor: "#121217",
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, "overlayPreload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  protectWindowNavigation(overlayWin, getProdIndexPath());

  overlayWindows.add(overlayWin);

  overlayWin.setAlwaysOnTop(true, "screen-saver");

  const overlayReadyHandler = (event) => {
    if (
      overlayWin.isDestroyed() ||
      !isWindowSender(event, overlayWin)
    ) {
      return;
    }

    ipcMain.removeListener("overlay-ready", overlayReadyHandler);

    setTimeout(() => {
      if (overlayWin.isDestroyed()) {
        return;
      }

      overlayWin.webContents.send("set-filament-settings", {
        fillament_cost: filamentCost,
        ship_type: activeShipType,
        tier: activeTier,
        storm_type: activeStormType,
      });
    }, 0);
  };

  ipcMain.on("overlay-ready", overlayReadyHandler);

  if (!app.isPackaged) {
    overlayWin.loadURL("http://localhost:5173/#/overlay");
  } else {
    const indexPath = getProdIndexPath();

    if (!fs.existsSync(indexPath)) {
      console.error("UI file missing for overlay in packaged build:", indexPath);
    }

    overlayWin.loadFile(indexPath, { hash: "/overlay" });
  }

  if (!registeredOverlayHotkey) {
    registerOverlayHotkey(getOverlayHotkey());
  }

  overlayWin.on("close", () => {
    saveSettings(overlayWin.getBounds());
  });

  overlayWin.on("closed", () => {
    overlayWindows.delete(overlayWin);
    ipcMain.removeListener("overlay-ready", overlayReadyHandler);

    if (overlayWindows.size === 0) {
      unregisterOverlayHotkey();
    }
  });
}

let filamentCost = 0;
let activeShipType = "";
let activeTier = "";
let activeStormType = "";

ipcMain.on(
  "open-overlay-with-cost",
  (event, cost, shipType, tier, stormType) => {
    if (!isWindowSender(event, mainWindow)) return;

    try {
      validateOverlayLaunch(cost, shipType, tier, stormType);
    } catch (err) {
      console.warn("[OVERLAY] Invalid launch parameters:", err.message);
      return;
    }

    filamentCost = cost;
    activeShipType = shipType;
    activeTier = tier;
    activeStormType = stormType;

    createOverlay();
  }
);

ipcMain.handle("api:request", async (event, request) => {
  try {
    assertMainSender(event);

    return await performApiRequest(request);
  } catch (err) {
    console.error("api:request failed:", err.message);

    return {
      ok: false,
      status: 0,
      error: err.message,
    };
  }
});

ipcMain.handle("telemetry:get-status", (event) => {
  assertMainSender(event);

  return telemetryService.getStatus();
});

ipcMain.handle("telemetry:set-enabled", (event, enabled) => {
  assertMainSender(event);

  if (typeof enabled !== "boolean") {
    throw new Error("Invalid telemetry preference");
  }

  return telemetryService.setEnabled(enabled);
});

ipcMain.handle("telemetry:reset-installation-id", (event) => {
  assertMainSender(event);

  return telemetryService.resetInstallationId();
});

ipcMain.handle("get-app-settings", (event) => {
  assertMainSender(event);
  return { overlayCloseHotkey: getOverlayHotkey() };
});

ipcMain.handle("save-app-settings", (event, newSettings) => {
  try {
    assertMainSender(event);

    if (
      !newSettings ||
      typeof newSettings !== "object" ||
      Array.isArray(newSettings)
    ) {
      throw new Error("Invalid settings");
    }

    const keys = Object.keys(newSettings);
    if (keys.length !== 1 || keys[0] !== "overlayCloseHotkey") {
      throw new Error("Only the overlay close hotkey may be changed");
    }

    const changingHotkey = Object.hasOwn(newSettings, "overlayCloseHotkey");
    const previousHotkey = registeredOverlayHotkey;

    if (changingHotkey) {
      validateOverlayHotkey(newSettings.overlayCloseHotkey);

      if (
        overlayWindows.size > 0 &&
        !registerOverlayHotkey(newSettings.overlayCloseHotkey)
      ) {
        throw new Error("Hotkey unavailable. Another application may be using it.");
      }
    }

    try {
      saveSettings(newSettings);
    } catch (err) {
      if (changingHotkey && overlayWindows.size > 0) {
        if (previousHotkey) {
          registerOverlayHotkey(previousHotkey);
        } else {
          unregisterOverlayHotkey();
        }
      }

      throw err;
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("add-entry", (event, category, entry) => {
  try {
    assertAbyssalWriteSender(event, category);
    validateCategory(category);
    if (category === "abyssals") {
      validateAbyssalEntry(entry);
    } else {
      validateGlorifiedEntry(entry);
    }

    const { date = new Date().toISOString().slice(0, 10) } = entry;

    if (category === "abyssals") {
      const {
        room1_isk = 0,
        room2_isk = 0,
        room3_isk = 0,
        time_taken = 0,
        fillament_cost = 0,
        tier = "",
        storm_type = "",
        ship_type = "",
      } = entry;

      const stmt = db.prepare(`
        INSERT INTO abyssals (
          date,
          room1_isk,
          room2_isk,
          room3_isk,
          time_taken,
          fillament_cost,
          tier,
          storm_type,
          ship_type
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const info = stmt.run(
        date,
        room1_isk,
        room2_isk,
        room3_isk,
        time_taken,
        fillament_cost,
        tier,
        storm_type,
        ship_type
      );

      notifyEntriesUpdated("abyssals", "add", {
        id: info.lastInsertRowid,
      });
    } else if (category === "glorified") {
      const {
        isk_earned = 0,
        tier = "",
        storm_type = "",
      } = entry;

      const stmt = db.prepare(`
        INSERT INTO glorified (date, isk_earned, tier, storm_type)
        VALUES (?, ?, ?, ?)
      `);

      const info = stmt.run(date, isk_earned, tier, storm_type);

      notifyEntriesUpdated("glorified", "add", {
        id: info.lastInsertRowid,
      });
    }

    return { success: true };
  } catch (err) {
    console.error("add-entry failed:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("update-entry", (event, category, id, entry) => {
  try {
    assertMainSender(event);
    validateCategory(category);
    const validId = validateId(id);
    if (category !== "abyssals") {
      throw new Error("Updating this category is not supported");
    }
    validateAbyssalEntry(entry);

    if (category === "abyssals") {
      const {
        room1_isk = 0,
        room2_isk = 0,
        room3_isk = 0,
        time_taken = 0,
        fillament_cost = 0,
        tier = "",
        storm_type = "",
        ship_type = "",
      } = entry;

      db.prepare(`
        UPDATE abyssals
        SET
          room1_isk = ?,
          room2_isk = ?,
          room3_isk = ?,
          time_taken = ?,
          fillament_cost = ?,
          tier = ?,
          storm_type = ?,
          ship_type = ?
        WHERE id = ?
      `).run(
        room1_isk,
        room2_isk,
        room3_isk,
        time_taken,
        fillament_cost,
        tier,
        storm_type,
        ship_type,
        validId
      );

      notifyEntriesUpdated("abyssals", "update", { id: validId });
    }

    return { success: true };
  } catch (err) {
    console.error("update-entry failed:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("delete-entry", (event, category, id) => {
  try {
    assertMainSender(event);
    validateCategory(category);
    const validId = validateId(id);

    db.prepare(`DELETE FROM ${category} WHERE id = ?`).run(validId);

    notifyEntriesUpdated(category, "delete", {
      id: validId,
    });

    return { success: true };
  } catch (err) {
    console.error("delete-entry failed:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("getEntries", (event, category) => {
  try {
    assertMainSender(event);
    validateCategory(category);

    const stmt = db.prepare(
      `SELECT * FROM ${category} ORDER BY date DESC`
    );

    return stmt.all();
  } catch (err) {
    console.error("getEntries failed:", err);
    return [];
  }
});

ipcMain.handle("add-glorified", (event, drop) => {
  try {
    assertMainSender(event);
    validateGlorifiedEntry(drop);

    const {
      date = new Date().toISOString().slice(0, 10),
      isk_earned = 0,
      tier = "",
      storm_type = "",
    } = drop;

    const stmt = db.prepare(`
      INSERT INTO glorified (date, isk_earned, tier, storm_type)
      VALUES (?, ?, ?, ?)
    `);

    const info = stmt.run(date, isk_earned, tier, storm_type);

    notifyEntriesUpdated("glorified", "add", {
      id: info.lastInsertRowid,
    });

    return { success: true };
  } catch (err) {
    console.error("add-glorified failed:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("delete-glorified", (event, id) => {
  try {
    assertMainSender(event);
    const validId = validateId(id);

    db.prepare(`DELETE FROM glorified WHERE id = ?`).run(validId);

    notifyEntriesUpdated("glorified", "delete", {
      id: validId,
    });

    return { success: true };
  } catch (err) {
    console.error("delete-glorified failed:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("get-glorified", (event) => {
  try {
    assertMainSender(event);
    return db.prepare(
      `SELECT * FROM glorified ORDER BY date DESC`
    ).all();
  } catch (err) {
    console.error("get-glorified failed:", err);
    return [];
  }
});

ipcMain.handle("crab:saveRun", (event, payload) => {
  try {
    assertMainSender(event);
    const runId = saveCrabRun(payload);

    return {
      success: true,
      runId,
      run: getCrabRunById(runId),
    };
  } catch (err) {
    console.error("crab:saveRun failed:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("crab:getRecentRuns", (event, limit = 25) => {
  try {
    assertMainSender(event);
    return getRecentCrabRuns(limit);
  } catch (err) {
    console.error("crab:getRecentRuns failed:", err);
    return [];
  }
});

ipcMain.handle("crab:getAllRuns", (event) => {
  try {
    assertMainSender(event);
    return getAllCrabRuns();
  } catch (err) {
    console.error("crab:getAllRuns failed:", err);
    return [];
  }
});

ipcMain.handle("crab:getRun", (event, runId) => {
  try {
    assertMainSender(event);
    return getCrabRunById(runId);
  } catch (err) {
    console.error("crab:getRun failed:", err);
    return null;
  }
});

ipcMain.handle("openExternal", async (event, url) => {
  try {
    assertMainSender(event);
    const validatedUrl = validateExternalUrl(url);
    await shell.openExternal(validatedUrl);
    return { success: true };
  } catch (err) {
    console.error("openExternal rejected:", err.message);
    return { success: false, error: err.message };
  }
});

function _getLocalIp() {
  const ifaces = os.networkInterfaces();

  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }

  return "127.0.0.1";
}

const OFFICER_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;

let officerSyncTimer = null;

async function runStartupSync() {
  try {
    await autoSync.runOnce();
  } catch (error) {
    console.error("[ESI AUTO SYNC] Startup failed:", error);
  }

  try {
    const result = await officerSync.runOnce();

    console.log("[OFFICER AUTO SYNC] Startup scan:", {
      scanned: result.scanned,
      detected: result.detected,
      errors: result.errors.length,
    });
  } catch (error) {
    console.error("[OFFICER AUTO SYNC] Startup failed:", error);
  }
}

app.whenReady().then(() => {
  createSplash();
  createMainWindow();
  telemetryService.recordLaunch();

  autoSync.start({ runImmediately: false });
  console.log("[ESI AUTO SYNC] Automatic synchronisation enabled");

  void runStartupSync();

  officerSyncTimer = setInterval(() => {
    officerSync.runOnce().catch((error) => {
      console.error("[OFFICER AUTO SYNC] Scheduled scan failed:", error);
    });
  }, OFFICER_SYNC_INTERVAL_MS);

  officerSyncTimer.unref?.();

  console.log("[OFFICER AUTO SYNC] Six-hour schedule enabled");

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  telemetryService.stop();
  autoSync.stop();

  if (officerSyncTimer !== null) {
    clearInterval(officerSyncTimer);
    officerSyncTimer = null;
  }

  unregisterOverlayHotkey();
});