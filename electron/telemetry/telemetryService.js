import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const TELEMETRY_ENDPOINT =
  "https://iskonomy.r3dit.space/api/v1/events";

const REQUEST_TIMEOUT_MS = 8000;

function isValidUUID(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

export function createTelemetryService(userDataPath) {
  const settingsPath = path.join(
    userDataPath,
    "telemetry-settings.json"
  );

  let state = {
    acknowledged: false,
    enabled: false,
    installationId: null
  };

  let launchRecorded = false;
  let generation = 0;
  let activeController = null;
  let pendingRequest = Promise.resolve();

  function load() {
    try {
      const stored = JSON.parse(
        fs.readFileSync(settingsPath, "utf8")
      );

      state = {
        acknowledged: stored.acknowledged === true,
        enabled:
          stored.acknowledged === true &&
          stored.enabled === true,
        installationId: isValidUUID(stored.installationId)
          ? stored.installationId
          : null
      };
    } catch {
      state = {
        acknowledged: false,
        enabled: false,
        installationId: null
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
      } catch {
        // Temporary file was already renamed or never created.
      }
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

    pendingRequest = Promise.resolve();
  }

  async function sendEvent(event, installationId, requestGeneration) {
    if (
      !state.enabled ||
      generation !== requestGeneration ||
      state.installationId !== installationId
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
          event,
          installationId
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

    if (!state.installationId) {
      const nextState = {
        ...state,
        installationId: randomUUID()
      };

      save(nextState);
      state = nextState;
    }

    launchRecorded = true;

    const installationId = state.installationId;
    const requestGeneration = generation;

    pendingRequest = pendingRequest
      .catch(() => false)
      .then(async () => {
        const registered = await sendEvent(
          "installation_registered",
          installationId,
          requestGeneration
        );

        if (!registered) {
          return false;
        }

        return sendEvent(
          "app_launched",
          installationId,
          requestGeneration
        );
      });
  }

  function setEnabled(enabled) {
    if (typeof enabled !== "boolean") {
      throw new Error("Invalid telemetry preference");
    }

    const nextState = {
      ...state,
      acknowledged: true,
      enabled
    };

    if (enabled && !nextState.installationId) {
      nextState.installationId = randomUUID();
    }

    save(nextState);

    cancelRequests();
    state = nextState;

    if (enabled) {
      recordLaunch();
    }

    return getStatus();
  }

  function resetInstallationId() {
    const nextState = {
      ...state,
      installationId: state.enabled
        ? randomUUID()
        : null
    };

    save(nextState);

    cancelRequests();
    state = nextState;
    launchRecorded = false;

    if (state.enabled) {
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
    resetInstallationId,
    stop
  };
}