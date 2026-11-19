
const ESI_BASE = "https://esi.evetech.net/latest";
const REQUEST_TIMEOUT_MS = 15000;
const MAX_PAGES = 20;
const FOB_PAYOUT = 100_000_000;

const candidateTypes = new Set([
  "corporate_reward_payout",
]);

function validateCharacterId(value) {
  const id = Number(value);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error("Invalid character ID");
  }

  return id;
}

function validateCorporationId(value) {
  const id = Number(value);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error("Invalid corporation ID");
  }

  return id;
}

function validateDivision(value) {
  if (
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > 7
  ) {
    throw new Error("Invalid corporation wallet division");
  }

  return value;
}

function validatePage(value) {
  if (
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > MAX_PAGES
  ) {
    throw new Error("Invalid wallet journal page");
  }

  return value;
}

function parsePages(response) {
  const raw = response.headers.get("x-pages");

  if (raw === null) return 1;

  const pages = Number(raw);

  if (!Number.isSafeInteger(pages) || pages < 1) {
    throw new Error("Invalid ESI pagination response");
  }

  return Math.min(pages, MAX_PAGES);
}

function isFobCandidate(entry) {
  return (
    candidateTypes.has(entry.ref_type) &&
    entry.amount === FOB_PAYOUT
  );
}

function normaliseEntry(entry, characterId) {
  if (
    !entry ||
    !Number.isSafeInteger(entry.id) ||
    typeof entry.date !== "string" ||
    !Number.isFinite(Date.parse(entry.date)) ||
    typeof entry.ref_type !== "string" ||
    typeof entry.amount !== "number" ||
    !Number.isFinite(entry.amount)
  ) {
    return null;
  }

  return {
    characterId,
    journalId: entry.id,
    date: entry.date,
    refType: entry.ref_type,
    amount: entry.amount,
    description:
      typeof entry.description === "string"
        ? entry.description.slice(0, 2000)
        : "",
    firstPartyId:
      Number.isSafeInteger(entry.first_party_id)
        ? entry.first_party_id
        : null,
    secondPartyId:
      Number.isSafeInteger(entry.second_party_id)
        ? entry.second_party_id
        : null,
    candidateFob: isFobCandidate(entry),
  };
}

function normaliseCorporationEntry(
  entry,
  corporationId,
  division
) {
  if (
    !entry ||
    !Number.isSafeInteger(entry.id) ||
    typeof entry.date !== "string" ||
    !Number.isFinite(Date.parse(entry.date)) ||
    typeof entry.ref_type !== "string" ||
    typeof entry.amount !== "number" ||
    !Number.isFinite(entry.amount)
  ) {
    return null;
  }

  return {
    corporationId,
    division,
    journalId: entry.id,
    date: entry.date,
    ref_type: entry.ref_type,
    amount: entry.amount,
    description:
      typeof entry.description === "string"
        ? entry.description.slice(0, 2000)
        : "",
    first_party_id:
      Number.isSafeInteger(entry.first_party_id)
        ? entry.first_party_id
        : null,
    second_party_id:
      Number.isSafeInteger(entry.second_party_id)
        ? entry.second_party_id
        : null,
    context_id:
      Number.isSafeInteger(entry.context_id)
        ? entry.context_id
        : null,
    context_id_type:
      typeof entry.context_id_type === "string"
        ? entry.context_id_type
        : null,
    reason:
      typeof entry.reason === "string"
        ? entry.reason.slice(0, 2000)
        : "",
    candidateFob: isFobCandidate(entry),
  };
}

export function createFobWalletService({
  getAccessToken,
  getCorporationAccessToken,
  listCorporations,
}) {
  if (typeof getAccessToken !== "function") {
    throw new Error("Secure ESI access token provider is required");
  }

  async function requestPage(characterId, page, token) {
    const url = new URL(
      `${ESI_BASE}/characters/${characterId}/wallet/journal/`
    );

    url.searchParams.set("page", String(page));

    return fetch(url, {
      method: "GET",
      redirect: "error",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  }

  async function fetchPage(characterId, page, accessToken = null) {
    const id = validateCharacterId(characterId);
    const pageNumber = validatePage(page);

    let token = accessToken || await getAccessToken(id);

    let response = await requestPage(id, pageNumber, token);

    if (response.status === 401) {
      token = await getAccessToken(id, {
        forceRefresh: true,
      });

      response = await requestPage(id, pageNumber, token);
    }

    if (!response.ok) {
      throw new Error(
        `Wallet journal request failed (${response.status})`
      );
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error("Unexpected wallet journal response");
    }

    return {
      entries: data
        .map((entry) => normaliseEntry(entry, id))
        .filter(Boolean),
      pages: parsePages(response),
      token,
    };
  }

  async function previewCharacter(characterId, pageLimit = 1) {
    const id = validateCharacterId(characterId);

    if (
      !Number.isSafeInteger(pageLimit) ||
      pageLimit < 1 ||
      pageLimit > MAX_PAGES
    ) {
      throw new Error("Invalid wallet preview page limit");
    }

    const firstPage = await fetchPage(id, 1);
    const entries = [...firstPage.entries];
    const seen = new Set(
      entries.map((entry) => entry.journalId)
    );

    const totalPages = Math.min(
      firstPage.pages,
      pageLimit
    );

    let token = firstPage.token;

    for (let page = 2; page <= totalPages; page++) {
      const result = await fetchPage(id, page, token);
      token = result.token;

      for (const entry of result.entries) {
        if (seen.has(entry.journalId)) continue;

        seen.add(entry.journalId);
        entries.push(entry);
      }
    }

    entries.sort(
      (a, b) => Date.parse(b.date) - Date.parse(a.date)
    );

    const candidates = entries.filter(
      (entry) => entry.candidateFob
    );

    return {
      characterId: id,
      fetchedAt: new Date().toISOString(),
      pagesFetched: totalPages,
      totalEntries: entries.length,
      candidateCount: candidates.length,
      candidateIncome: candidates.reduce(
        (total, entry) => total + entry.amount,
        0
      ),
      referenceTypes: [
        ...new Set(entries.map((entry) => entry.refType)),
      ].sort(),
      candidates,
      entries,
    };
  }

  async function requestCorporationPage(
    corporationId,
    division,
    page,
    token
  ) {
    const url = new URL(
      `${ESI_BASE}/corporations/${corporationId}/wallets/${division}/journal/`
    );

    url.searchParams.set("page", String(page));

    return fetch(url, {
      method: "GET",
      redirect: "error",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  }

  async function fetchCorporationPage(
    characterId,
    corporationId,
    division,
    page,
    accessToken = null
  ) {
    if (typeof getCorporationAccessToken !== "function") {
      throw new Error(
        "Corporation ESI access token provider is unavailable"
      );
    }

    const authorisingCharacterId = validateCharacterId(
      characterId
    );

    const corpId = validateCorporationId(corporationId);
    const walletDivision = validateDivision(division);
    const pageNumber = validatePage(page);

    let token =
      accessToken ||
      await getCorporationAccessToken(authorisingCharacterId);

    let response = await requestCorporationPage(
      corpId,
      walletDivision,
      pageNumber,
      token
    );

    if (response.status === 401) {
      token = await getCorporationAccessToken(
        authorisingCharacterId,
        { forceRefresh: true }
      );

      response = await requestCorporationPage(
        corpId,
        walletDivision,
        pageNumber,
        token
      );
    }

    if (!response.ok) {
      throw new Error(
        `Corporation wallet journal request failed for division ${walletDivision} (${response.status})`
      );
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error(
        "Unexpected corporation wallet journal response"
      );
    }

    return {
      entries: data
        .map((entry) =>
          normaliseCorporationEntry(
            entry,
            corpId,
            walletDivision
          )
        )
        .filter(Boolean),
      pages: parsePages(response),
      token,
    };
  }

  async function previewCorporation(
    characterId,
    division = 1,
    pageLimit = 1
  ) {
    if (
      typeof listCorporations !== "function" ||
      typeof getCorporationAccessToken !== "function"
    ) {
      throw new Error(
        "Corporation wallet integration is unavailable"
      );
    }

    const authorisingCharacterId = validateCharacterId(
      characterId
    );

    const walletDivision = validateDivision(division);

    if (
      !Number.isSafeInteger(pageLimit) ||
      pageLimit < 1 ||
      pageLimit > MAX_PAGES
    ) {
      throw new Error(
        "Invalid corporation wallet preview page limit"
      );
    }

    const authorisation = listCorporations().find(
      (item) =>
        Number(item.characterId) === authorisingCharacterId
    );

    if (!authorisation) {
      throw new Error(
        "No corporation wallet authorisation found for this character"
      );
    }

    if (authorisation.status !== "valid") {
      throw new Error(
        "Corporation wallet authorisation requires attention"
      );
    }

    const corporationId = validateCorporationId(
      authorisation.corporationId
    );

    const firstPage = await fetchCorporationPage(
      authorisingCharacterId,
      corporationId,
      walletDivision,
      1
    );

    const entries = [...firstPage.entries];

    const seen = new Set(
      entries.map((entry) => entry.journalId)
    );

    const totalPages = Math.min(
      firstPage.pages,
      pageLimit
    );

    let token = firstPage.token;

    for (let page = 2; page <= totalPages; page++) {
      const result = await fetchCorporationPage(
        authorisingCharacterId,
        corporationId,
        walletDivision,
        page,
        token
      );

      token = result.token;

      for (const entry of result.entries) {
        if (seen.has(entry.journalId)) {
          continue;
        }

        seen.add(entry.journalId);
        entries.push(entry);
      }
    }

    entries.sort(
      (a, b) => Date.parse(b.date) - Date.parse(a.date)
    );

    const candidates = entries.filter(
      (entry) => entry.candidateFob
    );

    return {
      corporationId,
      corporationName: authorisation.corporationName,
      authorisingCharacterId,
      division: walletDivision,
      fetchedAt: new Date().toISOString(),
      pagesFetched: totalPages,
      totalEntries: entries.length,
      candidateCount: candidates.length,
      candidateIncome: candidates.reduce(
        (total, entry) => total + entry.amount,
        0
      ),
      referenceTypes: [
        ...new Set(
          entries.map((entry) => entry.ref_type)
        ),
      ].sort(),
      candidates,
      entries,
    };
  }

  return {
    fetchPage,
    previewCharacter,
    fetchCorporationPage,
    previewCorporation,
  };
}
