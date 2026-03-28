export async function saveCrabRun(data) {
  const res = await window.api.saveCrabRun(data);
  return res;
}

export async function getRecentCrabRuns(limit = 25) {
  return await window.api.getRecentCrabRuns(limit);
}

export async function getAllCrabRuns() {
  return await window.api.getAllCrabRuns();
}

export async function getCrabRun(runId) {
  return await window.api.getCrabRun(runId);
}