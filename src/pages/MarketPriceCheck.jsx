import { useState } from "react";
import { parseCargo } from "../lib/cargoParser";
import { resolveTypeIds } from "../lib/marketClient";

const iskFormat = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 2,
});

const quantityFormat = new Intl.NumberFormat("en-GB");

const cellStyle = {
  padding: "12px",
  textAlign: "left",
  whiteSpace: "nowrap",
  borderBottom: "1px solid #344255",
};

const inputStyle = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  padding: 12,
  border: "1px solid #40516a",
  borderRadius: 8,
  background: "#151e2b",
  color: "#eef3fa",
  font: "inherit",
  resize: "vertical",
};

function formatPrice(value) {
  return value === null ? "—" : `${iskFormat.format(value)} ISK`;
}

function calculateSide(rows, field) {
  let total = 0;
  let priced = 0;

  for (const row of rows) {
    const price = row[field];

    if (price !== null) {
      priced += 1;
      total += price * row.qty;
    }
  }

  return { total: priced > 0 ? total : null, priced };
}

function priceStatus(row) {
  if (row.error) return row.error;
  if (row.bestBuy === null && row.bestSell === null) return "No Jita 4-4 orders";
  if (row.bestBuy === null) return "No buy orders";
  if (row.bestSell === null) return "No sell orders";
  return "";
}

export default function MarketPriceCheck() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const available = typeof window.api?.esiQuoteJitaItems === "function";

  async function checkPrices(event) {
    event.preventDefault();
    if (!available || busy) return;

    setResult(null);
    setError("");

    const { items, unknownLines } = parseCargo(input);

    if (items.length === 0) {
      setError("Paste at least one item name or a list copied from EVE.");
      return;
    }

    setBusy(true);

    try {
      const resolvedItems = await resolveTypeIds(items);
      const typeIds = resolvedItems.map(({ typeId }) => typeId).filter(Number.isSafeInteger);
      const quotes = typeIds.length ? await window.api.esiQuoteJitaItems(typeIds) : [];
      const quotesByType = new Map(quotes.map((quote) => [quote.typeId, quote]));

      const rows = resolvedItems.map((item) => {
        const quote = quotesByType.get(item.typeId);

        return {
          ...item,
          bestBuy: quote?.bestBuy ?? null,
          bestSell: quote?.bestSell ?? null,
          error: item.typeId === null
            ? "Item name could not be resolved"
            : quote?.error ?? "",
        };
      });

      setResult({ rows, unknownLines });
    } catch (err) {
      setError(err?.message || "Unable to check Jita prices.");
    } finally {
      setBusy(false);
    }
  }

  const buy = result ? calculateSide(result.rows, "bestBuy") : null;
  const sell = result ? calculateSide(result.rows, "bestSell") : null;

  return (
    <section aria-labelledby="market-price-check-heading" aria-busy={busy}>
      <h2 id="market-price-check-heading">Jita 4-4 Price Check</h2>

      <form onSubmit={checkPrices}>
        <label htmlFor="market-price-check-items">Paste your item list</label>
        <textarea
          id="market-price-check-items"
          rows={8}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          disabled={busy}
          placeholder={"Tritanium\t1000\nPyerite\t500"}
          style={inputStyle}
        />
        <button
          className="esi-primary"
          type="submit"
          disabled={!available || busy || !input.trim()}
          style={{ marginTop: 12 }}
        >
          {busy ? "Checking prices…" : "Check Jita prices"}
        </button>
      </form>

      {!available && (
        <p className="esi-alert" role="status">Price Check is unavailable in this build.</p>
      )}

      {error && <p className="esi-alert esi-error" role="alert">{error}</p>}

      {result && (
        <div style={{ marginTop: 24 }}>
          <section className="esi-overview" aria-label="Jita price estimates">
            <div className="esi-stat">
              <span>Estimated value at buy prices</span>
              <strong>{formatPrice(buy.total)}</strong>
              <small>{buy.priced} of {result.rows.length} items priced</small>
            </div>
            <div className="esi-stat">
              <span>Estimated cost at sell prices</span>
              <strong>{formatPrice(sell.total)}</strong>
              <small>{sell.priced} of {result.rows.length} items priced</small>
            </div>
          </section>

          <p>Estimates use the best unit price × quantity, before fees and taxes.</p>

          {result.unknownLines.length > 0 && (
            <details>
              <summary>{result.unknownLines.length} lines could not be read</summary>
              <ul>
                {result.unknownLines.map((line, index) => (
                  <li key={`${index}:${line}`}>{line}</li>
                ))}
              </ul>
            </details>
          )}

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th scope="col" style={cellStyle}>Item</th>
                  <th scope="col" style={cellStyle}>Quantity</th>
                  <th scope="col" style={cellStyle}>Best buy per unit</th>
                  <th scope="col" style={cellStyle}>Best sell per unit</th>
                  <th scope="col" style={cellStyle}>Status</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={row.name}>
                    <td style={cellStyle}>{row.name}</td>
                    <td style={cellStyle}>{quantityFormat.format(row.qty)}</td>
                    <td style={cellStyle}>{formatPrice(row.bestBuy)}</td>
                    <td style={cellStyle}>{formatPrice(row.bestSell)}</td>
                    <td style={cellStyle}>{priceStatus(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}