
const DEFAULT_HISTORY_DAYS = 30;
const MAX_HISTORY_DAYS = 366;

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

export function createFobAnalyticsService({ db }) {
  if (!db || typeof db.prepare !== "function") {
    throw new Error("A valid database connection is required");
  }

  const walletSummary = db.prepare(`
    SELECT
      COUNT(*) AS payoutCount,
      COALESCE(SUM(amount), 0) AS totalIncome,
      COUNT(DISTINCT second_party_id) AS uniqueRecipients,
      MIN(date) AS firstPayout,
      MAX(date) AS lastPayout
    FROM esi_wallet_journal
    WHERE source_type = 'corporation'
      AND candidate_fob = 1
      AND date >= @startDate
      AND date < @endDate
      AND (
        @corporationId IS NULL
        OR owner_id = @corporationId
      )
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

  const incomeHistory = db.prepare(`
    SELECT
      SUBSTR(date, 1, 10) AS day,
      COUNT(*) AS payoutCount,
      COALESCE(SUM(amount), 0) AS income
    FROM esi_wallet_journal
    WHERE source_type = 'corporation'
      AND candidate_fob = 1
      AND date >= @startDate
      AND date < @endDate
      AND (
        @corporationId IS NULL
        OR owner_id = @corporationId
      )
    GROUP BY SUBSTR(date, 1, 10)
    ORDER BY day ASC
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

  function getSummary(options = {}) {
    const range = getDateRange(options);

    const wallet = walletSummary.get(range);
    const killmails = killmailSummary.get(range);

    const totalIncome = Number(wallet.totalIncome) || 0;
    const completedFobs = Number(killmails.completedFobs) || 0;
    const payoutCount = Number(wallet.payoutCount) || 0;

    return {
      period: {
        startDate: range.startDate,
        endDate: range.endDate,
      },
      corporationId: range.corporationId,
      income: {
        total: totalIncome,
        payoutCount,
        uniqueRecipients: Number(wallet.uniqueRecipients) || 0,
        firstPayout: wallet.firstPayout,
        lastPayout: wallet.lastPayout,
        source: "esi_wallet_journal",
        classification: "candidate",
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

    const incomeRows = incomeHistory.all(range);
    const completionRows = completionHistory.all(range);

    const days = new Map();

    function ensureDay(day) {
      if (!days.has(day)) {
        days.set(day, {
          date: day,
          income: 0,
          payoutCount: 0,
          completions: 0,
        });
      }

      return days.get(day);
    }

    for (const row of incomeRows) {
      const day = ensureDay(row.day);
      day.income = Number(row.income) || 0;
      day.payoutCount = Number(row.payoutCount) || 0;
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
