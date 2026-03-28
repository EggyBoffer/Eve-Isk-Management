export function parseCrabBounties(text) {
  if (!text || typeof text !== "string") return [];

  const lines = text.split(/\r?\n/);
  const results = [];

  for (const line of lines) {
    if (!line.includes("Bounty Prizes")) continue;
    if (line.includes("Corporation Tax")) continue;

    const parts = line.split("\t");
    if (parts.length < 3) continue;

    const timestamp = parts[0].trim();
    const amountRaw = parts[2].trim();

    const amount = parseAmount(amountRaw);
    if (!amount) continue;

    const description = parts[4] || "";
    const character = extractCharacter(description);
    const system = extractSystem(description);

    results.push({
      entry_time: timestamp,
      character_name: character,
      system_name: system,
      amount
    });
  }

  return results;
}

function parseAmount(str) {
  if (!str) return 0;
  const clean = str.replace(/,/g, "").replace("ISK", "").trim();
  const num = Number(clean);
  return isNaN(num) ? 0 : num;
}

function extractCharacter(desc) {
  const match = desc.match(/\] (.*?) got bounty prizes/);
  return match ? match[1] : "";
}

function extractSystem(desc) {
  const match = desc.match(/in (.*)$/);
  return match ? match[1] : "";
}

export function sumCrabBounties(entries) {
  return entries.reduce((sum, e) => sum + (e.amount || 0), 0);
}