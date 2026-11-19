
import { getCharacterCorporation } from "./esiCorporations.js";
import { createEsiAuthService } from "./esiAuth.js";
import { createFobWalletService } from "../fob/fobWallet.js";

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

      return fobWallet.previewCharacter(
        characterId,
        pageLimit
      );
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
}
