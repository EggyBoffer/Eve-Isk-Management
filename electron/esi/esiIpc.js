import { getCharacterCorporation } from "./esiCorporations.js";
import { createEsiAuthService } from "./esiAuth.js";
import { createFobWalletService } from "../fob/fobWallet.js";
import { createEsiWalletSyncService } from "./esiWalletSync.js";
import { createEsiAutoSyncService } from "./esiAutoSync.js";
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
    listCorporations: esi.listCorporations,
  });

  const autoSync = createEsiAutoSyncService({
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
      return fobWallet.previewCorporation(characterId, division, pageLimit);
    }
  );

  ipcMain.handle(
    "esi:importCorporationJournal",
    async (event, characterId, division = 1, pageLimit = 1) => {
      assertMainSender(event);
      const preview = await fobWallet.previewCorporation(
        characterId, division, pageLimit
      );
      const importResult = importEsiWalletJournal(
        db, "corporation", preview.corporationId,
        preview.division, preview.entries
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

  ipcMain.handle("esi:listWalletJournal", (event, options = {}) => {
    assertMainSender(event);
    return listEsiWalletJournal(db, options);
  });

  ipcMain.handle(
    "esi:syncCorporationJournal",
    async (event, characterId, division = 1, pageLimit = 20) => {
      assertMainSender(event);
      return walletSync.syncCorporation(characterId, division, pageLimit);
    }
  );

  ipcMain.handle(
    "esi:getCorporationWalletSyncState",
    (event, corporationId, division = 1) => {
      assertMainSender(event);
      return walletSync.getCorporationSyncState(corporationId, division);
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

  return { autoSync };
}