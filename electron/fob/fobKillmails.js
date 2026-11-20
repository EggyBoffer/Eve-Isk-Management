
const ESI_ORIGIN = "https://esi.evetech.net";
const REQUEST_TIMEOUT_MS = 15000;
const HASH_PATTERN = /^[a-f0-9]{40}$/i;
const CONFIRMED_FOB_TYPE_IDS = new Set([46363, 46364]);

function parseKillmailUrl(value) {
  if (typeof value !== "string" || value.length > 500) {
    throw new Error("Invalid ESI killmail URL");
  }

  let url;

  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("Invalid ESI killmail URL");
  }

  if (
    url.origin !== ESI_ORIGIN ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error("Only direct EVE ESI killmail URLs are supported");
  }

  const match = /^\/(?:latest\/)?killmails\/([1-9]\d*)\/([a-f0-9]{40})\/?$/i.exec(
    url.pathname
  );

  if (!match || !HASH_PATTERN.test(match[2])) {
    throw new Error("Invalid ESI killmail URL format");
  }

  const killmailId = Number(match[1]);

  if (!Number.isSafeInteger(killmailId)) {
    throw new Error("Invalid killmail ID");
  }

  return {
    killmailId,
    killmailHash: match[2].toLowerCase(),
  };
}

function optionalId(value) {
  return Number.isSafeInteger(value) && value > 0
    ? value
    : null;
}

function classifyKillmail(victimTypeId) {
  return CONFIRMED_FOB_TYPE_IDS.has(victimTypeId)
    ? "confirmed"
    : "excluded";
}

async function requestEsi(path) {
  const response = await fetch(`${ESI_ORIGIN}${path}`, {
    method: "GET",
    redirect: "error",
    headers: {
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`ESI request failed (${response.status})`);
  }

  return response.json();
}

async function resolveName(path) {
  try {
    const data = await requestEsi(path);

    return typeof data?.name === "string" && data.name.trim()
      ? data.name.trim()
      : null;
  } catch {
    return null;
  }
}

async function getKillmailDetails(data) {
  const attackers = Array.isArray(data.attackers)
    ? data.attackers
    : [];

  const finalBlow = attackers.find(
    (attacker) => attacker?.final_blow === true
  );

  const finalBlowCharacterId = optionalId(
    finalBlow?.character_id
  );

  const finalBlowCorporationId = optionalId(
    finalBlow?.corporation_id
  );

  const finalBlowShipTypeId = optionalId(
    finalBlow?.ship_type_id
  );

  const finalBlowNpcTypeId = finalBlowCharacterId === null
    ? optionalId(finalBlow?.ship_type_id)
      ?? optionalId(finalBlow?.weapon_type_id)
    : null;

  const [solarSystemName, finalBlowName] = await Promise.all([
    resolveName(
      `/latest/universe/systems/${data.solar_system_id}/`
    ),
    finalBlowCharacterId !== null
      ? resolveName(
          `/latest/characters/${finalBlowCharacterId}/`
        )
      : finalBlowNpcTypeId !== null
        ? resolveName(
            `/latest/universe/types/${finalBlowNpcTypeId}/`
          )
        : Promise.resolve(null),
  ]);

  return {
    solarSystemName,
    finalBlowCharacterId,
    finalBlowCorporationId,
    finalBlowShipTypeId,
    finalBlowNpcTypeId,
    finalBlowName,
  };
}

export function initialiseFobKillmailDatabase(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS fob_killmails (
      killmail_id INTEGER PRIMARY KEY,
      killmail_hash TEXT NOT NULL,
      killmail_time TEXT NOT NULL,
      solar_system_id INTEGER NOT NULL,
      victim_type_id INTEGER NOT NULL,
      victim_corporation_id INTEGER,
      victim_alliance_id INTEGER,
      classification TEXT NOT NULL DEFAULT 'unverified'
        CHECK (classification IN ('unverified', 'confirmed', 'excluded')),
      imported_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_fob_killmails_time
    ON fob_killmails(killmail_time);
  `);

  const columns = new Set(
    db.prepare("PRAGMA table_info(fob_killmails)")
      .all()
      .map((column) => column.name)
  );

  const additionalColumns = [
    ["solar_system_name", "TEXT"],
    ["final_blow_character_id", "INTEGER"],
    ["final_blow_corporation_id", "INTEGER"],
    ["final_blow_ship_type_id", "INTEGER"],
    ["final_blow_npc_type_id", "INTEGER"],
    ["final_blow_name", "TEXT"],
  ];

  for (const [name, type] of additionalColumns) {
    if (!columns.has(name)) {
      db.exec(
        `ALTER TABLE fob_killmails ADD COLUMN ${name} ${type}`
      );
    }
  }
}

export function createFobKillmailService({ db }) {
  initialiseFobKillmailDatabase(db);

  db.prepare(`
    UPDATE fob_killmails
    SET classification = CASE
      WHEN victim_type_id IN (46363, 46364)
        THEN 'confirmed'
      ELSE 'excluded'
    END
    WHERE classification != CASE
      WHEN victim_type_id IN (46363, 46364)
        THEN 'confirmed'
      ELSE 'excluded'
    END
  `).run();

  const insert = db.prepare(`
    INSERT OR IGNORE INTO fob_killmails (
      killmail_id,
      killmail_hash,
      killmail_time,
      solar_system_id,
      victim_type_id,
      victim_corporation_id,
      victim_alliance_id,
      classification,
      imported_at,
      solar_system_name,
      final_blow_character_id,
      final_blow_corporation_id,
      final_blow_ship_type_id,
      final_blow_npc_type_id,
      final_blow_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const updateDetails = db.prepare(`
    UPDATE fob_killmails
    SET
      solar_system_name = ?,
      final_blow_character_id = ?,
      final_blow_corporation_id = ?,
      final_blow_ship_type_id = ?,
      final_blow_npc_type_id = ?,
      final_blow_name = ?,
      classification = CASE
        WHEN victim_type_id IN (46363, 46364)
          THEN 'confirmed'
        ELSE 'excluded'
      END
    WHERE killmail_id = ?
  `);

  const get = db.prepare(`
    SELECT *
    FROM fob_killmails
    WHERE killmail_id = ?
  `);

  const list = db.prepare(`
    SELECT *
    FROM fob_killmails
    ORDER BY killmail_time DESC
    LIMIT ?
  `);

  const summary = db.prepare(`
    SELECT
      COUNT(*) AS totalImported,
      COALESCE(SUM(
        CASE WHEN classification = 'confirmed' THEN 1 ELSE 0 END
      ), 0) AS confirmed,
      COALESCE(SUM(
        CASE WHEN classification = 'unverified' THEN 1 ELSE 0 END
      ), 0) AS unverified,
      COALESCE(SUM(
        CASE WHEN classification = 'excluded' THEN 1 ELSE 0 END
      ), 0) AS excluded
    FROM fob_killmails
  `);

  async function importKillmail(value) {
    const { killmailId, killmailHash } = parseKillmailUrl(value);

    const existing = get.get(killmailId);

    if (
      existing &&
      existing.killmail_hash !== killmailHash
    ) {
      throw new Error(
        "Killmail ID already imported with a different hash"
      );
    }

    const needsDetails = !existing ||
      !existing.solar_system_name ||
      (
        !existing.final_blow_character_id &&
        !existing.final_blow_npc_type_id &&
        !existing.final_blow_name
      );

    if (existing && !needsDetails) {
      return {
        imported: false,
        duplicate: true,
        killmail: existing,
      };
    }

    const data = await requestEsi(
      `/latest/killmails/${killmailId}/${killmailHash}/`
    );

    const victim = data?.victim;

    if (
      data?.killmail_id !== killmailId ||
      typeof data.killmail_time !== "string" ||
      !Number.isFinite(Date.parse(data.killmail_time)) ||
      !Number.isSafeInteger(data.solar_system_id) ||
      data.solar_system_id <= 0 ||
      !Number.isSafeInteger(victim?.ship_type_id) ||
      victim.ship_type_id <= 0
    ) {
      throw new Error("Unexpected ESI killmail response");
    }

    const details = await getKillmailDetails(data);

    if (existing) {
      updateDetails.run(
        details.solarSystemName,
        details.finalBlowCharacterId,
        details.finalBlowCorporationId,
        details.finalBlowShipTypeId,
        details.finalBlowNpcTypeId,
        details.finalBlowName,
        killmailId
      );

      return {
        imported: false,
        duplicate: true,
        refreshed: true,
        killmail: get.get(killmailId),
      };
    }

    const result = insert.run(
      killmailId,
      killmailHash,
      data.killmail_time,
      data.solar_system_id,
      victim.ship_type_id,
      optionalId(victim.corporation_id),
      optionalId(victim.alliance_id),
      classifyKillmail(victim.ship_type_id),
      new Date().toISOString(),
      details.solarSystemName,
      details.finalBlowCharacterId,
      details.finalBlowCorporationId,
      details.finalBlowShipTypeId,
      details.finalBlowNpcTypeId,
      details.finalBlowName
    );

    return {
      imported: result.changes === 1,
      duplicate: result.changes === 0,
      killmail: get.get(killmailId),
    };
  }

  function listKillmails(options = 50) {
    const limit = options === undefined || options === null
      ? 50
      : typeof options === "object" && !Array.isArray(options)
        ? options.limit ?? 50
        : options;

    if (
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 500
    ) {
      throw new Error("Invalid killmail list limit");
    }

    return list.all(limit);
  }

  return {
    importKillmail,
    listKillmails,
    getSummary: () => summary.get(),
  };
}
