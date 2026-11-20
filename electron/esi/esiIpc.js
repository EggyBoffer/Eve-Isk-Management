import { createEsiMarketAccessService } from "./esiMarketAccess.js";
import { createEsiMarketCorporationDatabase } from "./esiMarketCorporationDatabase.js";
import { createEsiMarketOrdersService } from "./esiMarketOrders.js";
import { createEsiMarketSalesService } from "./esiMarketSales.js";
import { createEsiMarketItemNamesService } from "./esiMarketItemNames.js";
import { createEsiJitaPriceCheckService } from "./esiJitaPriceCheck.js";
import { getCharacterCorporation } from "./esiCorporations.js";
import { createEsiAuthService } from "./esiAuth.js";
import { createFobWalletService } from "../fob/fobWallet.js";
import { createEsiWalletSyncService } from "./esiWalletSync.js";
import { createEsiAutoSyncService } from "./esiAutoSync.js";
import { createEsiKillmailSyncService } from "./esiKillmailSync.js";
import { createFobKillmailService } from "../fob/fobKillmails.js";
import { createFobAnalyticsService } from "../fob/fobAnalytics.js";
import {
  importEsiWalletJournal,
  listEsiWalletJournal,
  getEsiWalletJournalSummary,
} from "./esiDatabase.js";

export function registerEsiIpc({
  ipcMain,
  db,
  shell,
  assertMainSender,
  onCharacterLinked,
}) {
  const corporationMarketDatabase = createEsiMarketCorporationDatabase(db);
  const esi = createEsiAuthService({ db, shell, corporationMarketDatabase });

  const marketAccess = createEsiMarketAccessService({
    db,
    corporationDatabase: corporationMarketDatabase,
  });
  const marketOrders = createEsiMarketOrdersService({
    listMarketAuthorisations: esi.listMarketAuthorisations,
    listCorporationMarketAuthorisations: corporationMarketDatabase.listAuthorisations,
    getMarketAccessToken: marketAccess.getMarketAccessToken,
  });

  const marketSales = createEsiMarketSalesService({
    listCharacters: esi.listCharacters,
    getAccessToken: esi.getAccessToken,
    listCorporations: esi.listCorporations,
    getCorporationAccessToken: esi.getCorporationAccessToken,
  });

  const marketItemNames = createEsiMarketItemNamesService();
  const jitaPriceCheck = createEsiJitaPriceCheckService();

  const fobWallet = createFobWalletService({
    getAccessToken: esi.getAccessToken,
    getCorporationAccessToken: esi.getCorporationAccessToken,
    listCorporations: esi.listCorporations,
  });

  const walletSync = createEsiWalletSyncService({
    db,
    fobWallet,
    listCharacters: esi.listCharacters,
    listCorporations: esi.listCorporations,
  });

  const autoSync = createEsiAutoSyncService({
    listCharacters: esi.listCharacters,
    syncCharacter: walletSync.syncCharacter,
    listCorporations: esi.listCorporations,
    syncCorporation: walletSync.syncCorporation,
  });

  const fobKillmails = createFobKillmailService({ db });

  const killmailSync = createEsiKillmailSyncService({
    db,
    getKillmailAccessToken: esi.getKillmailAccessToken,
    importKillmail: fobKillmails.importKillmail,
  });

  ipcMain.handle(
    "esi:getCharacterCorporation",
    async (event, characterId) => {
      assertMainSender(event);
      return getCharacterCorporation(characterId);
    }
  );

  ipcMain.handle("esi:listCharacters", (event) => {
    assertMainSender(event);
    return esi.listCharacters();
  });

  ipcMain.handle("esi:linkCharacter", async (event) => {
    assertMainSender(event);

    const character = await esi.linkCharacter();

    void (async () => {
      try {
        await walletSync.syncCharacter(character.characterId);

        if (typeof onCharacterLinked === "function") {
          const result = await onCharacterLinked(character.characterId);

          if (result && !result.success && !result.skipped) {
            console.error("[OFFICER SYNC] Post-link scan reported errors:", result.errors);
          }
        }
      } catch (error) {
        console.error("[ESI] Initial character wallet sync failed:", error);
      }
    })();

    return character;
  });

  ipcMain.handle("esi:cancelLinking", (event) => {
    assertMainSender(event);
    return esi.cancelLinking();
  });

  ipcMain.handle(
    "esi:refreshCharacter",
    async (event, characterId) => {
      assertMainSender(event);
      return esi.refreshCharacter(characterId);
    }
  );

  ipcMain.handle(
    "esi:unlinkCharacter",
    (event, characterId) => {
      assertMainSender(event);
      return esi.unlinkCharacter(characterId);
    }
  );

  ipcMain.handle("esi:listCorporations", (event) => {
    assertMainSender(event);
    return esi.listCorporations();
  });

  ipcMain.handle("esi:linkCorporation", async (event) => {
    assertMainSender(event);
    return esi.linkCorporation();
  });

  ipcMain.handle(
    "esi:refreshCorporation",
    async (event, characterId) => {
      assertMainSender(event);
      return esi.refreshCorporation(characterId);
    }
  );

  ipcMain.handle(
    "esi:unlinkCorporation",
    (event, characterId) => {
      assertMainSender(event);
      return esi.unlinkCorporation(characterId);
    }
  );

  ipcMain.handle("esi:listMarketAuthorisations", (event) => {
    assertMainSender(event);
    return esi.listMarketAuthorisations();
  });

  ipcMain.handle("esi:listCorporationMarketAuthorisations", (event) => {
    assertMainSender(event);
    return corporationMarketDatabase.listAuthorisations();
  });

  ipcMain.handle("esi:linkMarket", (event) => {
    assertMainSender(event);
    return esi.linkMarket();
  });

  ipcMain.handle("esi:linkCorporationMarket", (event) => {
    assertMainSender(event);
    return esi.linkCorporationMarket();
  });

  ipcMain.handle("esi:unlinkMarket", (event, characterId) => {
    assertMainSender(event);
    const unlinked = esi.unlinkMarket(characterId);
    marketAccess.clearMarketAccessToken(Number(characterId));
    return unlinked;
  });

  ipcMain.handle("esi:unlinkCorporationMarket", (event, characterId) => {
    assertMainSender(event);

    if (!Number.isSafeInteger(characterId) || characterId <= 0) {
      throw new Error("Invalid EVE character ID");
    }

    const unlinked = corporationMarketDatabase.unlinkAuthorisation(characterId);
    marketAccess.clearMarketAccessToken(characterId, true);
    return unlinked;
  });

  ipcMain.handle("esi:listMarketOrders", async (event) => {
    assertMainSender(event);

    const result = await marketOrders.listOpenOrders();
    return {
      ...result,
      orders: await marketItemNames.addItemNames(result.orders),
    };
  });

  ipcMain.handle("esi:listMarketSales", async (event) => {
    assertMainSender(event);

    const result = await marketSales.listRecentSales();
    return {
      ...result,
      sales: await marketItemNames.addItemNames(result.sales),
    };
  });

  ipcMain.handle("esi:quoteJitaItems", (event, typeIds) => {
    assertMainSender(event);
    return jitaPriceCheck.quoteTypes(typeIds);
  });

  ipcMain.handle(
    "esi:listKillmailAuthorisations",
    (event, sourceType = null) => {
      assertMainSender(event);
      return esi.listKillmailAuthorisations(sourceType);
    }
  );

  ipcMain.handle(
    "esi:linkKillmail",
    async (event, sourceType) => {
      assertMainSender(event);

      const linked = await esi.linkKillmail(sourceType);

      esi.setKillmailSyncEnabled(
        sourceType,
        linked.characterId,
        true
      );

      try {
        const syncResult = await killmailSync.syncSource(
          sourceType,
          linked.characterId
        );

        return {
          ...linked,
          syncEnabled: true,
          initialSync: {
            success: true,
            ...syncResult,
          },
        };
      } catch (error) {
        return {
          ...linked,
          syncEnabled: true,
          initialSync: {
            success: false,
            error: error instanceof Error
              ? error.message
              : String(error),
          },
        };
      }
    }
  );

  ipcMain.handle(
    "esi:refreshKillmail",
    async (event, sourceType, characterId) => {
      assertMainSender(event);
      return esi.refreshKillmail(sourceType, characterId);
    }
  );

  ipcMain.handle(
    "esi:unlinkKillmail",
    (event, sourceType, characterId) => {
      assertMainSender(event);
      return esi.unlinkKillmail(sourceType, characterId);
    }
  );

  ipcMain.handle(
    "esi:setKillmailSyncEnabled",
    async (event, sourceType, characterId, enabled) => {
      assertMainSender(event);

      const result = esi.setKillmailSyncEnabled(
        sourceType,
        characterId,
        enabled
      );

      if (enabled === true) {
        try {
          await killmailSync.syncSource(sourceType, characterId);
        } catch (error) {
          console.warn(
            "Killmail sync after enabling collection failed:",
            error
          );
        }
      }

      return result;
    }
  );

  ipcMain.handle(
    "esi:syncKillmail",
    async (event, sourceType, characterId) => {
      assertMainSender(event);
      return killmailSync.syncSource(sourceType, characterId);
    }
  );

  ipcMain.handle(
    "esi:runKillmailAutoSync",
    async (event) => {
      assertMainSender(event);
      return killmailSync.runOnce();
    }
  );

  ipcMain.handle(
    "fob:previewWallet",
    async (event, characterId, pageLimit = 1) => {
      assertMainSender(event);
      return fobWallet.previewCharacter(characterId, pageLimit);
    }
  );

  ipcMain.handle(
    "esi:previewCorporationJournal",
    async (event, characterId, division = 1, pageLimit = 1) => {
      assertMainSender(event);
      return fobWallet.previewCorporation(
        characterId,
        division,
        pageLimit
      );
    }
  );

  ipcMain.handle(
    "esi:importCorporationJournal",
    async (event, characterId, division = 1, pageLimit = 1) => {
      assertMainSender(event);

      const preview = await fobWallet.previewCorporation(
        characterId,
        division,
        pageLimit
      );

      const importResult = importEsiWalletJournal(
        db,
        "corporation",
        preview.corporationId,
        preview.division,
        preview.entries
      );

      return {
        corporationId: preview.corporationId,
        corporationName: preview.corporationName,
        authorisingCharacterId: preview.authorisingCharacterId,
        division: preview.division,
        fetchedAt: preview.fetchedAt,
        pagesFetched: preview.pagesFetched,
        fetchedEntries: preview.totalEntries,
        candidateCount: preview.candidateCount,
        candidateIncome: preview.candidateIncome,
        ...importResult,
      };
    }
  );

  ipcMain.handle("esi:getWalletJournalSummary", (event) => {
    assertMainSender(event);
    return getEsiWalletJournalSummary(db);
  });

  ipcMain.handle(
    "esi:listWalletJournal",
    (event, options = {}) => {
      assertMainSender(event);
      return listEsiWalletJournal(db, options);
    }
  );

  ipcMain.handle(
    "esi:syncCharacterJournal",
    async (event, characterId, pageLimit = 20) => {
      assertMainSender(event);
      return walletSync.syncCharacter(characterId, pageLimit);
    }
  );

  ipcMain.handle(
    "esi:getCharacterWalletSyncState",
    (event, characterId) => {
      assertMainSender(event);
      return walletSync.getCharacterSyncState(characterId);
    }
  );

  ipcMain.handle(
    "esi:syncCorporationJournal",
    async (event, characterId, division = 1, pageLimit = 20) => {
      assertMainSender(event);
      return walletSync.syncCorporation(
        characterId,
        division,
        pageLimit
      );
    }
  );

  ipcMain.handle(
    "esi:getCorporationWalletSyncState",
    (event, corporationId, division = 1) => {
      assertMainSender(event);
      return walletSync.getCorporationSyncState(
        corporationId,
        division
      );
    }
  );

  ipcMain.handle("esi:getAutoSyncStatus", (event) => {
    assertMainSender(event);
    return autoSync.getStatus();
  });

  ipcMain.handle("esi:runAutoSync", async (event) => {
    assertMainSender(event);
    return autoSync.runOnce();
  });

  ipcMain.handle(
    "fob:importKillmail",
    async (event, url) => {
      assertMainSender(event);
      return fobKillmails.importKillmail(url);
    }
  );

  ipcMain.handle(
    "fob:listKillmails",
    (event, limit = 100) => {
      assertMainSender(event);
      return fobKillmails.listKillmails(limit);
    }
  );

  ipcMain.handle("fob:getKillmailSummary", (event) => {
    assertMainSender(event);
    return fobKillmails.getSummary();
  });

  const fobAnalytics = createFobAnalyticsService({ db });

  ipcMain.handle(
    "fob:getAnalyticsSummary",
    (event, options = {}) => {
      assertMainSender(event);
      return fobAnalytics.getSummary(options);
    }
  );

  ipcMain.handle(
    "fob:getAnalyticsHistory",
    (event, options = {}) => {
      assertMainSender(event);
      return fobAnalytics.getHistory(options);
    }
  );

  ipcMain.handle(
    "fob:getAnalyticsCompletions",
    (event, options = {}) => {
      assertMainSender(event);
      return fobAnalytics.getCompletions(options);
    }
  );

  ipcMain.handle(
    "fob:getAnalyticsDashboard",
    (event, options = {}) => {
      assertMainSender(event);
      return fobAnalytics.getDashboard(options);
    }
  );

  return { autoSync, killmailSync };
}