
const ESI_BASE = "https://esi.evetech.net/latest";
const REQUEST_TIMEOUT_MS = 15000;

const OFFICER_GROUPS = new Map([
  [553, "Battleship"],
  [559, "Battleship"],
  [564, "Battleship"],
  [1174, "Battleship"],
  [569, "Battleship"],
  [574, "Battleship"],
  [4795, "Cruiser"],
  [4797, "Cruiser"],
  [4799, "Cruiser"],
  [4801, "Cruiser"],
  [4803, "Cruiser"],
  [4796, "Frigate"],
  [4798, "Frigate"],
  [4800, "Frigate"],
  [4802, "Frigate"],
  [4804, "Frigate"],
]);

const typeCache = new Map();

export function parseBountyReason(reason) {
  if (typeof reason !== "string" || !reason.trim()) {
    return [];
  }

  const quantities = new Map();

  for (const part of reason.split(",")) {
    const match = part.trim().match(/^(\d+)\s*:\s*(\d+)$/);

    if (!match) {
      continue;
    }

    const typeId = Number(match[1]);
    const quantity = Number(match[2]);

    if (
      !Number.isSafeInteger(typeId) ||
      typeId <= 0 ||
      !Number.isSafeInteger(quantity) ||
      quantity <= 0
    ) {
      continue;
    }

    quantities.set(
      typeId,
      (quantities.get(typeId) ?? 0) + quantity
    );
  }

  return Array.from(quantities, ([typeId, quantity]) => ({
    typeId,
    quantity,
  }));
}

export async function resolveNpcType(typeId) {
  if (!Number.isSafeInteger(typeId) || typeId <= 0) {
    throw new Error("Invalid NPC type ID");
  }

  if (typeCache.has(typeId)) {
    return typeCache.get(typeId);
  }

  const response = await fetch(
    `${ESI_BASE}/universe/types/${typeId}/`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      redirect: "error",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Unable to resolve NPC ${typeId}: ESI ${response.status}`
    );
  }

  const data = await response.json();

  if (
    !data ||
    typeof data.name !== "string" ||
    !Number.isSafeInteger(data.group_id)
  ) {
    throw new Error(`Invalid NPC type data for ${typeId}`);
  }

  const npc = {
    typeId,
    name: data.name,
    groupId: data.group_id,
    officerClass: OFFICER_GROUPS.get(data.group_id) ?? null,
  };

  typeCache.set(typeId, npc);

  return npc;
}

export async function detectOfficersFromJournal(entry) {
  if (!entry || entry.refType !== "bounty_prizes") {
    return [];
  }

  const npcs = parseBountyReason(entry.reason);
  const officers = [];

  for (const npc of npcs) {
    const resolved = await resolveNpcType(npc.typeId);

    if (!resolved.officerClass) {
      continue;
    }

    officers.push({
      typeId: npc.typeId,
      name: resolved.name,
      groupId: resolved.groupId,
      officerClass: resolved.officerClass,
      quantity: npc.quantity,
      journalId: entry.journalId ?? null,
      characterId: entry.ownerId ?? entry.characterId ?? null,
      date: entry.date ?? null,
      walletAmount: entry.amount ?? null,
      description: entry.description ?? "",
    });
  }

  return officers;
}

export function isOfficerGroup(groupId) {
  return OFFICER_GROUPS.has(groupId);
}

export function clearOfficerTypeCache() {
  typeCache.clear();
}
