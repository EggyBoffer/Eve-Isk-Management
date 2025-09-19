// src/lib/bootTasks.js
import { loadRuns as loadDEDRuns, updateRun as updateDEDRun } from "../lib/dedStorer";
import { priceItemsJita } from "../lib/marketClient";

/**
 * Reprice all DED runs using Jita sell.min
 * @param {{onProgress?: (info:{current:number,total:number,label:string})=>void}} opts
 */
export async function repriceAllDEDRuns(opts = {}) {
  const onProgress = opts.onProgress || (() => {});
  const runs = loadDEDRuns();

  const total = runs.length;
  if (!total) {
    onProgress({ current: 0, total: 0, label: "No DED runs to reprice" });
    return { updated: 0, failed: 0 };
  }

  let updated = 0;
  let failed = 0;

  // Sequential keeps it simple and gentle on the API; change to small batches if you like.
  for (let i = 0; i < runs.length; i++) {
    const r = runs[i];
    onProgress({
      current: i,
      total,
      label: `Repricing DED run ${i + 1} / ${total}…`,
    });
    try {
      const { items, iskTotal } = await priceItemsJita(r.items || []);
      updateDEDRun(r.id, {
        items,
        iskTotal,
        repricedAt: new Date().toISOString(),
      });
      updated++;
    } catch (e) {
      console.warn("Failed to reprice run", r?.id, e);
      failed++;
    }
  }

  onProgress({ current: total, total, label: "DED repricing complete" });
  return { updated, failed };
}

/**
 * Run all boot tasks (expandable later).
 * Reads user setting `autoRepriceDEDOnLaunch` (default true).
 */
export async function runBootTasks({ onProgress } = {}) {
  const settings = JSON.parse(localStorage.getItem("settings") || "{}");
  const autoReprice = settings.autoRepriceDEDOnLaunch ?? true;

  if (autoReprice) {
    return await repriceAllDEDRuns({ onProgress });
  }
  return { updated: 0, failed: 0, skipped: true };
}
