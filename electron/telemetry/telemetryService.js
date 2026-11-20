
import fs from "node:fs";
import path from "node:path";

const TELEMETRY_ENDPOINT =
  "https://iskonomy.r3dit.space/api/v1/events";

const REQUEST_TIMEOUT_MS = 8000;

export function createTelemetryService(userDataPath) {
  const settingsPath = path.join(
    userDataPath,
    "telemetry-settings.json"
  );

  let state = {
    acknowledged: false,
    enabled: false
  };

  let launchRecorded = false;
  let generation = 0;
  let activeController = null;

  function load() {
    try {
      const stored = JSON.parse(
        fs.readFileSync(settingsPath, "utf8")
      );

      state = {
        acknowledged: stored.acknowledged === true,
        enabled:
          stored.acknowledged === true &&
          stored.enabled === true
      };

      if (Object.hasOwn(stored, "installationId")) {
        save(state);
      }
    } catch {
      state = {
        acknowledged: false,
        enabled: false
      };
    }
  }

  function save(nextState) {
    const temporaryPath = `${settingsPath}.tmp`;

    fs.mkdirSync(userDataPath, {
      recursive: true
    });

    try {
      fs.writeFileSync(
        temporaryPath,
        JSON.stringify(nextState, null, 2),
        {
          encoding: "utf8",
          mode: 0o600
        }
      );

      fs.renameSync(temporaryPath, settingsPath);
    } finally {
      try {
        fs.unlinkSync(temporaryPath);
      } catch {}
    }
  }

  function getStatus() {
    return {
      acknowledged: state.acknowledged,
      enabled: state.enabled
    };
  }

  function cancelRequests() {
    generation += 1;

    if (activeController) {
      activeController.abort();
      activeController = null;
    }
  }

  async function sendLaunch(requestGeneration) {
    if (
      !state.enabled ||
      generation !== requestGeneration
    ) {
      return false;
    }

    const controller = new AbortController();
    activeController = controller;

    const timeout = setTimeout(() => {
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(TELEMETRY_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          event: "app_launched"
        }),
        signal: controller.signal,
        redirect: "error",
        cache: "no-store"
      });

      return (
        response.status === 202 &&
        generation === requestGeneration &&
        state.enabled
      );
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);

      if (activeController === controller) {
        activeController = null;
      }
    }
  }

  function recordLaunch() {
    if (
      !state.acknowledged ||
      !state.enabled ||
      launchRecorded
    ) {
      return;
    }

    launchRecorded = true;
    void sendLaunch(generation);
  }

  function setEnabled(enabled) {
    if (typeof enabled !== "boolean") {
      throw new Error("Invalid telemetry preference");
    }

    const nextState = {
      acknowledged: true,
      enabled
    };

    save(nextState);
    cancelRequests();
    state = nextState;

    if (enabled) {
      recordLaunch();
    }

    return getStatus();
  }

  function stop() {
    cancelRequests();
  }

  load();

  return {
    getStatus,
    setEnabled,
    recordLaunch,
    stop
  };
}
