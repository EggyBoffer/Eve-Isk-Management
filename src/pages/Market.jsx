import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import MarketPriceCheck from "./MarketPriceCheck";
import "../styles/esi/esi.css";

const quantityFormat = new Intl.NumberFormat("en-GB");
const iskFormat = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 2,
});
const dateFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "short",
  timeStyle: "short",
});

const marketHeaderStyle = {
  background: "linear-gradient(105deg, rgba(27, 48, 65, 0.95), rgba(19, 21, 35, 0.95))",
  border: "1px solid rgba(148, 163, 184, 0.16)",
  borderRadius: 14,
  padding: 22,
  marginBottom: 26,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 18,
  flexWrap: "wrap",
};

const headerButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "10px 16px",
  border: "1px solid rgba(148, 163, 184, 0.24)",
  borderRadius: 8,
  color: "#fff",
  fontWeight: 600,
};

const tableCellStyle = {
  padding: "12px",
  textAlign: "left",
  whiteSpace: "nowrap",
  borderBottom: "1px solid #344255",
};

const totalsStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
  gap: 16,
  marginBottom: 32,
};

const MARKET_VIEWS = [
  { id: "orders", label: "Open orders" },
  { id: "sales", label: "Recent sales" },
  { id: "price", label: "Price Check" },
];

function formatIsk(value) {
  return `${iskFormat.format(value)} ISK`;
}

function ownerName(row) {
  if (row.source === "corporation") {
    return row.corporationName || `Corporation ${row.corporationId}`;
  }

  return row.characterName || row.characterId;
}

function ownerKey(row) {
  return `${row.source ?? "personal"}:${row.corporationId ?? row.characterId}`;
}

const OWNER_COLUMN = {
  label: "Owner",
  render: ownerName,
};

const ITEM_COLUMN = {
  label: "Item",
  render: ({ itemName, typeId }) => itemName || `Type ID ${typeId}`,
};

const ORDER_COLUMNS = [
  OWNER_COLUMN,
  ITEM_COLUMN,
  { label: "Side", render: (order) => order.isBuyOrder ? "Buy" : "Sell" },
  {
    label: "Remaining / listed",
    render: (order) =>
      `${quantityFormat.format(order.volumeRemaining)} / ${quantityFormat.format(order.volumeTotal)}`,
  },
  { label: "Unit price", render: (order) => formatIsk(order.price) },
  {
    label: "Remaining value",
    render: (order) => formatIsk(order.price * order.volumeRemaining),
  },
];

const SALE_COLUMNS = [
  { label: "Sold at", render: (sale) => dateFormat.format(new Date(sale.date)) },
  OWNER_COLUMN,
  {
    label: "Wallet",
    render: (sale) => sale.source === "corporation"
      ? `Division ${sale.division}`
      : "Personal",
  },
  ITEM_COLUMN,
  { label: "Quantity", render: (sale) => quantityFormat.format(sale.quantity) },
  { label: "Unit price", render: (sale) => formatIsk(sale.unitPrice) },
  { label: "Gross proceeds", render: (sale) => formatIsk(sale.grossValue) },
];

function HeaderButton({ children, disabled, onClick, primary = false }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        ...headerButtonStyle,
        background: primary ? "#2563eb" : "#1e293b",
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

function MarketStat({ label, value }) {
  return (
    <div className="esi-stat" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
      <span>{label}</span>
      <strong
        style={{
          gridColumn: 1,
          fontSize: "clamp(20px, 2.4vw, 29px)",
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </strong>
    </div>
  );
}

function MarketTable({ rows, columns, idField }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {columns.map(({ label }) => (
              <th key={label} scope="col" style={tableCellStyle}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${ownerKey(row)}:${row.division ?? ""}:${row[idField]}`}>
              {columns.map(({ label, render }) => (
                <td key={label} style={tableCellStyle}>{render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OpenOrders({ snapshot, loading }) {
  const [orderSide, setOrderSide] = useState("all");
  const { orders, buyOrderCount, sellOrderCount, projectedGrossSellIncome } = snapshot;
  const visibleOrders = orders.filter((order) =>
    orderSide === "all" || order.isBuyOrder === (orderSide === "buy")
  );

  return (
    <>
      <section style={totalsStyle} aria-label="Market order totals">
        <MarketStat label="Projected gross sell income" value={formatIsk(projectedGrossSellIncome)} />
        <MarketStat label="Open sell orders" value={quantityFormat.format(sellOrderCount)} />
        <MarketStat label="Open buy orders" value={quantityFormat.format(buyOrderCount)} />
      </section>

      <section aria-labelledby="market-orders-heading" aria-busy={loading}>
        <div className="esi-section-heading">
          <h2 id="market-orders-heading">Open orders</h2>

          <label>
            Show{" "}
            <select
              className="esi-secondary"
              value={orderSide}
              onChange={(event) => setOrderSide(event.target.value)}
            >
              <option value="all">All orders</option>
              <option value="sell">Sell orders</option>
              <option value="buy">Buy orders</option>
            </select>
          </label>
        </div>

        {visibleOrders.length === 0 ? (
          <div className="esi-empty">
            {orders.length === 0
              ? "No open orders were returned."
              : "No open orders match this filter."}
          </div>
        ) : (
          <MarketTable rows={visibleOrders} columns={ORDER_COLUMNS} idField="orderId" />
        )}
      </section>
    </>
  );
}

function RecentSales({ snapshot, loading }) {
  const { sales, grossSalesValue } = snapshot;

  return (
    <>
      <section style={totalsStyle} aria-label="Recent sales totals">
        <MarketStat label="Gross sales proceeds" value={formatIsk(grossSalesValue)} />
        <MarketStat label="Sale transactions" value={quantityFormat.format(sales.length)} />
      </section>

      <section aria-labelledby="market-sales-heading" aria-busy={loading}>
        <div className="esi-section-heading">
          <h2 id="market-sales-heading">Recent sales</h2>
        </div>

        {sales.length === 0 ? (
          <div className="esi-empty">
            No sales were returned by the linked personal or corporation wallets.
          </div>
        ) : (
          <MarketTable rows={sales} columns={SALE_COLUMNS} idField="transactionId" />
        )}
      </section>
    </>
  );
}

function SourceMessages({ entries }) {
  return (
    <ul>
      {entries.map((entry) => (
        <li key={ownerKey(entry)}>
          {ownerName(entry)} — {entry.message}
        </li>
      ))}
    </ul>
  );
}

function MarketDataView({ view, requestNumber, available, method, onLoadingChange }) {
  const [snapshot, setSnapshot] = useState(null);
  const [finishedRequest, setFinishedRequest] = useState(null);
  const [error, setError] = useState("");

  const showingSales = view === "sales";
  const label = showingSales ? "sales" : "orders";
  const loading = available && finishedRequest !== requestNumber;

  useEffect(() => {
    if (!available) {
      onLoadingChange(false);
      return;
    }

    let current = true;
    onLoadingChange(true);

    async function load() {
      try {
        const result = await window.api[method]();

        if (current) {
          setSnapshot(result);
          setError("");
        }
      } catch (err) {
        if (current) {
          setError(err?.message || `Unable to load Market ${label}.`);
        }
      } finally {
        if (current) {
          setFinishedRequest(requestNumber);
          onLoadingChange(false);
        }
      }
    }

    void load();

    return () => {
      current = false;
    };
  }, [available, method, label, requestNumber, onLoadingChange]);

  const sourceErrors = snapshot?.errors ?? [];
  const sourceWarnings = snapshot?.warnings ?? [];
  const hasResults = snapshot && snapshot.linkedCharacterCount > sourceErrors.length;

  return (
    <>
      {!available && (
        <div className="esi-alert esi-error" role="alert">
          Market {label} are unavailable in this build.
        </div>
      )}

      {!loading && error && (
        <div className="esi-alert esi-error" role="alert">
          {error}
          {snapshot && ` Showing the last loaded ${label}.`}
        </div>
      )}

      {loading && !snapshot && (
        <div className="esi-alert" role="status">
          Loading Market {label}…
        </div>
      )}

      {snapshot?.linkedCharacterCount === 0 && (
        <section className="esi-empty">
          <h2>{showingSales ? "No wallets linked" : "No Market access linked"}</h2>
          {showingSales ? (
            <Link to="/esi-connections" className="esi-secondary">
              Open ESI Connections
            </Link>
          ) : (
            <p>Use Link Personal or Link Corp to load your orders.</p>
          )}
        </section>
      )}

      {sourceErrors.length > 0 && (
        <div className="esi-alert esi-error" role="alert">
          {hasResults
            ? `Totals only include sources whose ${label} loaded.`
            : `Could not load ${label} for any linked source.`}
          <SourceMessages entries={sourceErrors} />
        </div>
      )}

      {sourceWarnings.length > 0 && (
        <div className="esi-alert" role="status">
          Some corporation wallet data could not be loaded.
          <SourceMessages entries={sourceWarnings} />
        </div>
      )}

      {hasResults && (
        showingSales
          ? <RecentSales snapshot={snapshot} loading={loading} />
          : <OpenOrders snapshot={snapshot} loading={loading} />
      )}
    </>
  );
}

export default function Market() {
  const [view, setView] = useState("orders");
  const [requestNumber, setRequestNumber] = useState(0);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [linkNotice, setLinkNotice] = useState("");
  const [priceOpened, setPriceOpened] = useState(false);

  const showingSales = view === "sales";
  const showingPrice = view === "price";
  const method = showingSales ? "esiListMarketSales" : "esiListMarketOrders";
  const available = typeof window.api?.[method] === "function";
  const canLinkPersonal = typeof window.api?.esiLinkMarket === "function";
  const canLinkCorp = typeof window.api?.esiLinkCorporationMarket === "function";
  const canCancel = typeof window.api?.esiCancelLinking === "function";

  function selectView(nextView) {
    if (nextView === view) return;

    if (nextView === "price") {
      setPriceOpened(true);
    } else {
      setLoading(true);
    }

    setLinkNotice("");
    setView(nextView);
  }

  function refresh() {
    setLoading(true);
    setRequestNumber((previous) => previous + 1);
  }

  async function linkMarket(corporation) {
    if (linking) return;

    const linkMethod = corporation ? "esiLinkCorporationMarket" : "esiLinkMarket";
    if (typeof window.api?.[linkMethod] !== "function") return;

    const label = corporation ? "Corporation Market" : "Personal Market";
    setLinkError("");
    setLinkNotice("");
    setLinking(label);

    try {
      const result = await window.api[linkMethod]();
      const name = corporation ? result.corporationName : result.characterName;

      setLinkNotice(name ? `${label} linked for ${name}.` : `${label} linked.`);
      setView("orders");
      refresh();
    } catch (err) {
      setLinkError(err?.message || `Unable to link ${label}.`);
    } finally {
      setLinking("");
      setCancelling(false);
    }
  }

  async function cancelLink() {
    if (!linking || cancelling || !canCancel) return;

    setCancelling(true);

    try {
      await window.api.esiCancelLinking();
    } catch (err) {
      setLinkError(err?.message || "Unable to cancel EVE authorisation.");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "86px 28px 70px",
        color: "#f8fafc",
        background: "linear-gradient(145deg, #080f1d, #111c32)",
      }}
    >
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <header style={marketHeaderStyle}>
          <div>
            <h1
              style={{
                fontSize: 36,
                fontWeight: 800,
                letterSpacing: 1,
                color: "#38bdf8",
                margin: "0 0 10px",
              }}
            >
              Market
            </h1>

            <p style={{ margin: 0, color: "#cbd5e1" }}>
              {showingPrice
                ? "Check the Jita 4-4 value of a pasted item list."
                : showingSales
                  ? "Recent sales from linked personal and corporation wallets."
                  : "Open personal and corporation market orders."}
            </p>
          </div>

          {!showingPrice && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {!showingSales && (
                <>
                  <HeaderButton disabled={!canLinkPersonal || Boolean(linking)} onClick={() => linkMarket(false)}>
                    Link Personal
                  </HeaderButton>
                  <HeaderButton disabled={!canLinkCorp || Boolean(linking)} onClick={() => linkMarket(true)}>
                    Link Corp
                  </HeaderButton>
                </>
              )}

              <HeaderButton primary disabled={!available || loading || Boolean(linking)} onClick={refresh}>
                <RefreshCw size={17} />
                {available && loading
                  ? "Refreshing…"
                  : showingSales ? "Refresh Sales" : "Refresh Orders"}
              </HeaderButton>
            </div>
          )}
        </header>

        <nav
          aria-label="Market views"
          style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}
        >
          {MARKET_VIEWS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={view === id ? "esi-primary" : "esi-secondary"}
              aria-pressed={view === id}
              onClick={() => selectView(id)}
            >
              {label}
            </button>
          ))}
        </nav>

        {linking && (
          <div className="esi-alert" role="status">
            Complete {linking} authorisation in your browser.
            {canCancel && (
              <button
                type="button"
                className="esi-secondary"
                disabled={cancelling}
                onClick={cancelLink}
                style={{ marginInlineStart: 12 }}
              >
                {cancelling ? "Cancelling…" : "Cancel linking"}
              </button>
            )}
          </div>
        )}

        {linkError && <div className="esi-alert esi-error" role="alert">{linkError}</div>}
        {linkNotice && <div className="esi-alert" role="status">{linkNotice}</div>}

        {!showingPrice && (
          <MarketDataView
            key={view}
            view={view}
            requestNumber={requestNumber}
            available={available}
            method={method}
            onLoadingChange={setLoading}
          />
        )}

        {priceOpened && (
          <div hidden={!showingPrice}>
            <MarketPriceCheck />
          </div>
        )}
      </div>
    </div>
  );
}