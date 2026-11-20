import { createOfficerSyncService } from "./officerSync.js";
import { listOfficerKills, getOfficerSummary, updateOfficerLoot } from "./officerDatabase.js";

export function registerOfficerIpc({ ipcMain, db, assertMainSender }) {
  if (!ipcMain || typeof ipcMain.handle !== "function" || !db || typeof assertMainSender !== "function") {
    throw new Error("Invalid Officer IPC configuration");
  }

  const officerSync = createOfficerSyncService({ db });

  ipcMain.handle("officer:sync", async (event, options = {}) => {
    assertMainSender(event);
    return officerSync.runOnce(options);
  });

  ipcMain.handle("officer:getSyncStatus", (event) => {
    assertMainSender(event);
    return officerSync.getStatus();
  });

  ipcMain.handle("officer:listKills", (event, options = {}) => {
    assertMainSender(event);
    return listOfficerKills(db, options);
  });

  ipcMain.handle("officer:getSummary", (event) => {
    assertMainSender(event);
    return getOfficerSummary(db);
  });

  ipcMain.handle("officer:updateLoot", (event, id, payload) => {
    assertMainSender(event);
    return updateOfficerLoot(db, id, payload);
  });

  return { officerSync };
}