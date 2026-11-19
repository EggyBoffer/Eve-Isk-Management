
import { getCharacterCorporation } from "./esiCorporations.js";
import { createEsiAuthService } from "./esiAuth.js";
import { createFobWalletService } from "../fob/fobWallet.js";
import { createEsiWalletSyncService } from "./esiWalletSync.js";
import { createEsiAutoSyncService } from "./esiAutoSync.js";
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
}) {
  const esi = createEsiAuthService({ db, shell });

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
    return esi.linkCharacter();
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

  const fobKillmails = createFobKillmailService({ db });

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

  return { autoSync };
}
