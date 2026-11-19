const DEFAULT_HISTORY_DAYS = 30;
const MAX_HISTORY_DAYS = 366;
const MATCH_WINDOW_MS = 2000;
const GROSS_REWARD = 100_000_000;
const NET_REWARD = 99_000_000;

function parseDate(value, fieldName) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`Invalid ${fieldName}`);
  }

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    throw new Error(`Invalid ${fieldName}`);
  }

  return date.toISOString();
}

function parseCorporationId(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const id = Number(value);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error("Invalid corporation ID");
  }

  return id;
}

function parseHistoryDays(value) {
  if (value === undefined || value === null) {
    return DEFAULT_HISTORY_DAYS;
  }

  if (
    !Number.isInteger(value) ||
    value < 1 ||
    value > MAX_HISTORY_DAYS
  ) {
    throw new Error("Invalid history period");
  }

  return value;
}

function getDateRange(options = {}) {
  if (
    !options ||
    typeof options !== "object" ||
    Array.isArray(options)
  ) {
    throw new Error("Invalid analytics options");
  }

  const now = new Date();
  const historyDays = parseHistoryDays(options.historyDays);

  const endDate = parseDate(options.endDate, "end date")
    ?? now.toISOString();

  const defaultStart = new Date(
    new Date(endDate).getTime() -
    historyDays * 86400000
  );

  const startDate = parseDate(options.startDate, "start date")
    ?? defaultStart.toISOString();

  if (startDate >= endDate) {
    throw new Error("Start date must be before end date");
  }

  return {
    startDate,
    endDate,
    historyDays,
    corporationId: parseCorporationId(options.corporationId),
  };
}

function recipientId(entry) {
  return Number(entry.secondPartyId) || null;
}

function journalKey(entry) {
  return [
    entry.sourceType,
    entry.ownerId,
    entry.division,
    entry.journalId,
  ].join(":");
}

function findMatches(corporationEntries, characterEntries) {
  const matches = new Map();
  const matchedCharacters = new Set();

  for (const corporation of corporationEntries) {
    const candidates = characterEntries.filter((character) =>
      !matchedCharacters.has(journalKey(character)) &&
      recipientId(character) === recipientId(corporation) &&
      character.journalId === corporation.journalId
    );

    if (candidates.length === 1) {
      const character = candidates[0];
      matches.set(journalKey(corporation), character);
      matchedCharacters.add(journalKey(character));
    }
  }

  const unmatchedCorporations = corporationEntries.filter(
    (entry) => !matches.has(journalKey(entry))
  );

  const unmatchedCharacters = characterEntries.filter(
    (entry) => !matchedCharacters.has(journalKey(entry))
  );

  const corporationCandidates = new Map();
  const characterCandidates = new Map();

  for (const corporation of unmatchedCorporations) {
    const candidates = unmatchedCharacters.filter((character) =>
      recipientId(character) === recipientId(corporation) &&
      Math.abs(
        Date.parse(character.date) -
        Date.parse(corporation.date)
      ) <= MATCH_WINDOW_MS
    );

    corporationCandidates.set(journalKey(corporation), candidates);

    for (const character of candidates) {
      const key = journalKey(character);
      characterCandidates.set(
        key,
        (characterCandidates.get(key) ?? 0) + 1
      );
    }
  }

  for (const corporation of unmatchedCorporations) {
    const candidates =
      corporationCandidates.get(journalKey(corporation)) ?? [];

    if (
      candidates.length === 1 &&
      characterCandidates.get(journalKey(candidates[0])) === 1
    ) {
      const character = candidates[0];
      matches.set(journalKey(corporation), character);
      matchedCharacters.add(journalKey(character));
    }
  }

  return { matches, matchedCharacters };
}

function calculateWalletIncome(entries, corporationId) {
  const corporations = entries.filter(
    (entry) =>
      entry.sourceType === "corporation" &&
      entry.amount === GROSS_REWARD
  );

  const characters = entries.filter(
    (entry) =>
      entry.sourceType === "character" &&
      entry.amount === NET_REWARD
  );

  const { matches, matchedCharacters } = findMatches(
    corporations,
    characters
  );

  const events = [];
  const recipients = new Set();
  const earningCharacters = new Set();

  let netPersonalIncome = 0;
  let estimatedTax = 0;
  let estimatedGrossIncome = 0;
  let matchedPayouts = 0;
  let unmatchedPersonalPayouts = 0;
  let corporationOnlyPayouts = 0;

  for (const corporation of corporations) {
    if (
      corporationId !== null &&
      corporation.ownerId !== corporationId
    ) {
      continue;
    }

    const character = matches.get(journalKey(corporation));
    const recipient = recipientId(corporation);

    if (recipient !== null) {
      recipients.add(recipient);
    }

    if (character) {
      matchedPayouts++;
      earningCharacters.add(character.ownerId);
      netPersonalIncome += character.amount;
      estimatedTax += GROSS_REWARD - character.amount;
    } else {
      corporationOnlyPayouts++;
    }

    events.push({
      date: corporation.date,
      gross: corporation.amount,
      net: character?.amount ?? null,
      estimatedTax: character
        ? corporation.amount - character.amount
        : null,
      recipientId: recipient,
      corporationId: corporation.ownerId,
      source: character ? "matched" : "corporation",
      grossEstimated: false,
    });
  }

  if (corporationId === null) {
    for (const character of characters) {
      if (matchedCharacters.has(journalKey(character))) {
        continue;
      }

      unmatchedPersonalPayouts++;
      earningCharacters.add(character.ownerId);
      recipients.add(character.ownerId);

      netPersonalIncome += character.amount;
      estimatedTax += GROSS_REWARD - character.amount;
      estimatedGrossIncome += GROSS_REWARD;

      events.push({
        date: character.date,
        gross: GROSS_REWARD,
        net: character.amount,
        estimatedTax: GROSS_REWARD - character.amount,
        recipientId: character.ownerId,
        corporationId: null,
        source: "character",
        grossEstimated: true,
      });
    }
  }

  events.sort((a, b) => a.date.localeCompare(b.date));

  const totalGrossIncome = events.reduce(
    (sum, event) => sum + event.gross,
    0
  );

  return {
    events,
    totalGrossIncome,
    netPersonalIncome,
    estimatedTax,
    estimatedGrossIncome,
    payoutCount: events.length,
    uniqueRecipients: recipients.size,
    earningCharacters: earningCharacters.size,
    matchedPayouts,
    unmatchedPersonalPayouts,
    corporationOnlyPayouts,
    firstPayout: events[0]?.date ?? null,
    lastPayout: events.at(-1)?.date ?? null,
  };
}

export function createFobAnalyticsService({ db }) {
  if (!db || typeof db.prepare !== "function") {
    throw new Error("A valid database connection is required");
  }

  const walletEntries = db.prepare(`
    SELECT
      source_type AS sourceType,
      owner_id AS ownerId,
      division,
      journal_id AS journalId,
      date,
      ref_type AS refType,
      amount,
      description,
      first_party_id AS firstPartyId,
      second_party_id AS secondPartyId
    FROM esi_wallet_journal
    WHERE candidate_fob = 1
      AND date >= @startDate
      AND date < @endDate
    ORDER BY date ASC, journal_id ASC
  `);

  const killmailSummary = db.prepare(`
    SELECT
      COUNT(*) AS completedFobs,
      MIN(killmail_time) AS firstCompletion,
      MAX(killmail_time) AS lastCompletion
    FROM fob_killmails
    WHERE classification = 'confirmed'
      AND killmail_time >= @startDate
      AND killmail_time < @endDate
  `);

  const completionHistory = db.prepare(`
    SELECT
      SUBSTR(killmail_time, 1, 10) AS day,
      COUNT(*) AS completions
    FROM fob_killmails
    WHERE classification = 'confirmed'
      AND killmail_time >= @startDate
      AND killmail_time < @endDate
    GROUP BY SUBSTR(killmail_time, 1, 10)
    ORDER BY day ASC
  `);

  const factionSummary = db.prepare(`
    SELECT
      CASE victim_type_id
        WHEN 46363 THEN 'Guristas'
        WHEN 46364 THEN 'Blood Raiders'
        ELSE 'Other'
      END AS faction,
      COUNT(*) AS completions
    FROM fob_killmails
    WHERE classification = 'confirmed'
      AND killmail_time >= @startDate
      AND killmail_time < @endDate
    GROUP BY faction
    ORDER BY completions DESC
  `);

  const recentCompletions = db.prepare(`
    SELECT
      killmail_id AS killmailId,
      killmail_hash AS killmailHash,
      killmail_time AS completedAt,
      solar_system_id AS solarSystemId,
      solar_system_name AS solarSystemName,
      final_blow_character_id AS finalBlowCharacterId,
      final_blow_corporation_id AS finalBlowCorporationId,
      final_blow_ship_type_id AS finalBlowShipTypeId,
      final_blow_npc_type_id AS finalBlowNpcTypeId,
      final_blow_name AS finalBlowName,
      victim_type_id AS victimTypeId,
      CASE victim_type_id
        WHEN 46363 THEN 'Guristas'
        WHEN 46364 THEN 'Blood Raiders'
        ELSE 'Other'
      END AS faction
    FROM fob_killmails
    WHERE classification = 'confirmed'
      AND killmail_time >= @startDate
      AND killmail_time < @endDate
    ORDER BY killmail_time DESC
    LIMIT 100
  `);

  function getWalletData(range) {
    const entries = walletEntries.all(range);

    return calculateWalletIncome(
      entries,
      range.corporationId
    );
  }

  function getSummary(options = {}) {
    const range = getDateRange(options);
    const wallet = getWalletData(range);
    const killmails = killmailSummary.get(range);

    const totalIncome = wallet.totalGrossIncome;
    const completedFobs = Number(killmails.completedFobs) || 0;

    return {
      period: {
        startDate: range.startDate,
        endDate: range.endDate,
      },
      corporationId: range.corporationId,
      income: {
        total: totalIncome,
        gross: totalIncome,
        netPersonal: wallet.netPersonalIncome,
        estimatedTax: wallet.estimatedTax,
        estimatedGross: wallet.estimatedGrossIncome,
        payoutCount: wallet.payoutCount,
        uniqueRecipients: wallet.uniqueRecipients,
        earningCharacters: wallet.earningCharacters,
        matchedPayouts: wallet.matchedPayouts,
        unmatchedPersonalPayouts:
          wallet.unmatchedPersonalPayouts,
        corporationOnlyPayouts:
          wallet.corporationOnlyPayouts,
        firstPayout: wallet.firstPayout,
        lastPayout: wallet.lastPayout,
        source: "esi_wallet_journal",
        classification: "candidate",
        taxClassification: "estimated",
        netCoverage: "linked_character_wallets_only",
      },
      completions: {
        total: completedFobs,
        firstCompletion: killmails.firstCompletion,
        lastCompletion: killmails.lastCompletion,
        source: "fob_killmails",
        classification: "confirmed",
      },
      averages: {
        iskPerFob: completedFobs > 0
          ? totalIncome / completedFobs
          : null,
        provisional: true,
        reason: range.corporationId !== null
          ? "Killmails are not corporation-attributed; the completion count may include other corporations."
          : "Historical killmail coverage may be incomplete.",
      },
    };
  }

  function getHistory(options = {}) {
    const range = getDateRange(options);
    const wallet = getWalletData(range);
    const completionRows = completionHistory.all(range);

    const days = new Map();

    function ensureDay(day) {
      if (!days.has(day)) {
        days.set(day, {
          date: day,
          income: 0,
          grossIncome: 0,
          netPersonalIncome: 0,
          estimatedTax: 0,
          payoutCount: 0,
          completions: 0,
        });
      }

      return days.get(day);
    }

    for (const event of wallet.events) {
      const day = ensureDay(event.date.slice(0, 10));

      day.income += event.gross;
      day.grossIncome += event.gross;
      day.netPersonalIncome += event.net ?? 0;
      day.estimatedTax += event.estimatedTax ?? 0;
      day.payoutCount++;
    }

    for (const row of completionRows) {
      const day = ensureDay(row.day);
      day.completions = Number(row.completions) || 0;
    }

    return {
      period: {
        startDate: range.startDate,
        endDate: range.endDate,
      },
      corporationId: range.corporationId,
      data: [...days.values()].sort(
        (a, b) => a.date.localeCompare(b.date)
      ),
    };
  }

  function getCompletions(options = {}) {
    const range = getDateRange(options);

    return {
      period: {
        startDate: range.startDate,
        endDate: range.endDate,
      },
      corporationId: range.corporationId,
      corporationFilterApplied: false,
      factions: factionSummary.all(range),
      recent: recentCompletions.all(range),
    };
  }

  function getDashboard(options = {}) {
    return {
      summary: getSummary(options),
      history: getHistory(options),
      completions: getCompletions(options),
    };
  }

  return {
    getSummary,
    getHistory,
    getCompletions,
    getDashboard,
  };
}