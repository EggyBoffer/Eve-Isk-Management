const ESI_BASE_URL = "https://esi.evetech.net/v1";
const REQUEST_TIMEOUT_MS = 15000;
const WALLET_DIVISIONS = [1, 2, 3, 4, 5, 6, 7];

export function createEsiMarketSalesService({
  listCharacters,
  getAccessToken,
  listCorporations = () => [],
  getCorporationAccessToken,
  fetchTransactions = fetch,
}) {
  let pendingRequest = null;

  async function loadTransactions(path, accessToken) {
    const response = await fetchTransactions(`${ESI_BASE_URL}${path}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      redirect: "error",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      const error = new Error(
        `EVE wallet transactions request failed (${response.status}).`
      );
      error.status = response.status;
      throw error;
    }

    const transactions = await response.json();

    if (!Array.isArray(transactions)) {
      throw new Error("EVE returned an invalid wallet transactions response.");
    }

    return transactions;
  }

  function collectSales(transactions, owner) {
    const sales = new Map();

    for (const transaction of transactions) {
      if (transaction?.is_buy !== false) continue;
      if (owner.source === "personal" && transaction.is_personal !== true) continue;

      const {
        transaction_id: transactionId,
        journal_ref_id: journalRefId,
        type_id: typeId,
        location_id: locationId,
        date,
        quantity,
        unit_price: unitPrice,
      } = transaction;

      if (
        !Number.isSafeInteger(transactionId) || transactionId <= 0 ||
        !Number.isSafeInteger(typeId) || typeId <= 0 ||
        !Number.isSafeInteger(quantity) || quantity <= 0 ||
        !Number.isFinite(unitPrice) || unitPrice < 0 ||
        typeof date !== "string" || !Number.isFinite(Date.parse(date))
      ) {
        throw new Error("EVE returned an invalid market sale.");
      }

      sales.set(transactionId, {
        ...owner,
        transactionId,
        journalRefId,
        typeId,
        locationId,
        date,
        quantity,
        unitPrice,
        grossValue: quantity * unitPrice,
      });
    }

    return [...sales.values()];
  }

  async function loadCharacterSales(character) {
    const { characterId, name } = character;

    if (!Number.isSafeInteger(characterId) || characterId <= 0) {
      throw new Error("Invalid wallet character ID.");
    }

    const accessToken = await getAccessToken(characterId);
    const transactions = await loadTransactions(
      `/characters/${characterId}/wallet/transactions/`,
      accessToken
    );

    return collectSales(transactions, {
      source: "personal",
      characterId,
      characterName: name,
    });
  }

  async function loadCorporationSales(authorisations) {
    const { corporationId, corporationName } = authorisations[0];
    const credentials = [];
    const failures = [];
    const sales = new Map();
    const loadedDivisions = new Set();

    for (const { characterId } of authorisations) {
      try {
        credentials.push(await getCorporationAccessToken(characterId));
      } catch (error) {
        failures.push(error?.message || "Unable to refresh corporation wallet access.");
      }
    }

    if (credentials.length === 0) {
      throw new Error(failures[0] || "Corporation wallet access is unavailable.");
    }

    let deniedDivisions = 0;

    for (const division of WALLET_DIVISIONS) {
      const path = `/corporations/${corporationId}/wallets/${division}/transactions/`;
      let divisionError;
      let denied = false;

      for (const accessToken of credentials) {
        try {
          const transactions = await loadTransactions(path, accessToken);
          const divisionSales = collectSales(transactions, {
            source: "corporation",
            corporationId,
            corporationName,
            division,
          });

          for (const sale of divisionSales) {
            sales.set(sale.transactionId, sale);
          }

          loadedDivisions.add(division);
          break;
        } catch (error) {
          if (error?.status === 403) {
            denied = true;
          } else {
            divisionError = error;
          }
        }
      }

      if (!loadedDivisions.has(division)) {
        if (divisionError) {
          failures.push(`Division ${division}: ${divisionError.message}`);
        } else if (denied) {
          deniedDivisions += 1;
        }
      }
    }

    if (loadedDivisions.size === 0) {
      throw new Error(failures[0] || "EVE denied access to all corporation wallet divisions.");
    }

    return {
      sales: [...sales.values()],
      warning: [
        deniedDivisions > 0
          ? `EVE denied access to ${deniedDivisions} of ${WALLET_DIVISIONS.length} wallet divisions.`
          : "",
        ...failures,
      ].filter(Boolean).join(" "),
    };
  }

  async function loadRecentSales() {
    const characters = listCharacters();
    const corporations = new Map();

    if (typeof getCorporationAccessToken === "function") {
      for (const authorisation of listCorporations()) {
        const { corporationId } = authorisation;

        if (!Number.isSafeInteger(corporationId) || corporationId <= 0) continue;

        if (!corporations.has(corporationId)) {
          corporations.set(corporationId, []);
        }

        corporations.get(corporationId).push(authorisation);
      }
    }

    const sales = [];
    const errors = [];
    const warnings = [];

    for (const character of characters) {
      try {
        sales.push(...await loadCharacterSales(character));
      } catch (error) {
        errors.push({
          source: "personal",
          characterId: character.characterId,
          characterName: character.name,
          message: error?.message || "Unable to fetch recent personal sales.",
        });
      }
    }

    for (const [corporationId, authorisations] of corporations) {
      const { corporationName, characterId } = authorisations[0];
      const ownerName = corporationName || `Corporation ${corporationId}`;

      try {
        const result = await loadCorporationSales(authorisations);
        sales.push(...result.sales);

        if (result.warning) {
          warnings.push({
            source: "corporation",
            corporationId,
            corporationName: ownerName,
            message: result.warning,
          });
        }
      } catch (error) {
        errors.push({
          source: "corporation",
          corporationId,
          corporationName: ownerName,
          characterId,
          characterName: ownerName,
          message: error?.message || "Unable to fetch recent corporation sales.",
        });
      }
    }

    sales.sort((left, right) => Date.parse(right.date) - Date.parse(left.date));

    return {
      linkedCharacterCount: characters.length + corporations.size,
      personalSourceCount: characters.length,
      corporationSourceCount: corporations.size,
      sales,
      errors,
      warnings,
      grossSalesValue: sales.reduce((total, sale) => total + sale.grossValue, 0),
      fetchedAt: new Date().toISOString(),
    };
  }

  function listRecentSales() {
    if (!pendingRequest) {
      pendingRequest = loadRecentSales().finally(() => {
        pendingRequest = null;
      });
    }

    return pendingRequest;
  }

  return { listRecentSales };
}