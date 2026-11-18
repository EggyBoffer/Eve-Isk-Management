
import { createEsiAuthService } from "./esiAuth.js";

export function registerEsiIpc({
  ipcMain,
  db,
  shell,
  assertMainSender,
}) {
  const esi = createEsiAuthService({ db, shell });

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
}
