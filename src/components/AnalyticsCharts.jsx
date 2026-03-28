import React from "react";

export function ChartCard({ title, subtitle, children }) {
  return (
    <section className="analyticsChart-card">
      <div className="analyticsChart-head">
        <h3>{title}</h3>
        {subtitle ? <div className="analyticsChart-subtitle">{subtitle}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function BarChart({ data, valueKey, labelKey, valueFormatter, height = 280, compact = false }) {
  if (!Array.isArray(data) || data.length === 0) {
    return <EmptyChart label="No graph data yet." />;
  }

  const chartWidth = 1000;
  const chartHeight = height;
  const padTop = 28;
  const padRight = 28;
  const padBottom = 64;
  const padLeft = compact ? 54 : 72;
  const innerWidth = chartWidth - padLeft - padRight;
  const innerHeight = chartHeight - padTop - padBottom;
  const maxValue = Math.max(...data.map((item) => Number(item[valueKey]) || 0), 1);
  const stepX = innerWidth / data.length;
  const barWidth = Math.max(22, Math.min(72, stepX * 0.62));
  const ticks = 4;

  return (
    <div className="analyticsChart-shell">
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="analyticsChart-svg" role="img">
        <line x1={padLeft} y1={padTop} x2={padLeft} y2={padTop + innerHeight} className="analyticsChart-axis" />
        <line
          x1={padLeft}
          y1={padTop + innerHeight}
          x2={padLeft + innerWidth}
          y2={padTop + innerHeight}
          className="analyticsChart-axis"
        />

        {Array.from({ length: ticks + 1 }).map((_, index) => {
          const ratio = index / ticks;
          const y = padTop + innerHeight - ratio * innerHeight;
          const tickValue = maxValue * ratio;
          return (
            <g key={index}>
              <line x1={padLeft} y1={y} x2={padLeft + innerWidth} y2={y} className="analyticsChart-grid" />
              <text x={padLeft - 10} y={y + 4} textAnchor="end" className="analyticsChart-tickText">
                {valueFormatter(tickValue)}
              </text>
            </g>
          );
        })}

        {data.map((item, index) => {
          const value = Number(item[valueKey]) || 0;
          const ratio = value / maxValue;
          const barHeight = Math.max(value > 0 ? 6 : 0, ratio * innerHeight);
          const x = padLeft + stepX * index + (stepX - barWidth) / 2;
          const y = padTop + innerHeight - barHeight;
          const label = item[labelKey] ?? "";
          const displayValue = valueFormatter(value);
          return (
            <g key={`${label}_${index}`}>
              <title>{`${label}: ${displayValue}`}</title>
              <rect x={x} y={y} width={barWidth} height={barHeight} rx="10" ry="10" className="analyticsChart-bar" />
              <text x={x + barWidth / 2} y={padTop + innerHeight + 18} textAnchor="middle" className="analyticsChart-labelText">
                {shortLabel(label, 14)}
              </text>
              <text x={x + barWidth / 2} y={y - 8} textAnchor="middle" className="analyticsChart-valueText">
                {displayValue}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function LineChart({ data, valueKey, labelKey, valueFormatter, height = 280 }) {
  if (!Array.isArray(data) || data.length === 0) {
    return <EmptyChart label="No graph data yet." />;
  }

  const chartWidth = 1000;
  const chartHeight = height;
  const padTop = 28;
  const padRight = 28;
  const padBottom = 64;
  const padLeft = 72;
  const innerWidth = chartWidth - padLeft - padRight;
  const innerHeight = chartHeight - padTop - padBottom;
  const maxValue = Math.max(...data.map((item) => Number(item[valueKey]) || 0), 1);
  const stepX = data.length > 1 ? innerWidth / (data.length - 1) : innerWidth / 2;
  const ticks = 4;

  const points = data.map((item, index) => {
    const value = Number(item[valueKey]) || 0;
    const x = padLeft + (data.length > 1 ? stepX * index : innerWidth / 2);
    const y = padTop + innerHeight - (value / maxValue) * innerHeight;
    return { x, y, value, label: item[labelKey] ?? "" };
  });

  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`)
    .join(" ");

  return (
    <div className="analyticsChart-shell">
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="analyticsChart-svg" role="img">
        <line x1={padLeft} y1={padTop} x2={padLeft} y2={padTop + innerHeight} className="analyticsChart-axis" />
        <line
          x1={padLeft}
          y1={padTop + innerHeight}
          x2={padLeft + innerWidth}
          y2={padTop + innerHeight}
          className="analyticsChart-axis"
        />

        {Array.from({ length: ticks + 1 }).map((_, index) => {
          const ratio = index / ticks;
          const y = padTop + innerHeight - ratio * innerHeight;
          const tickValue = maxValue * ratio;
          return (
            <g key={index}>
              <line x1={padLeft} y1={y} x2={padLeft + innerWidth} y2={y} className="analyticsChart-grid" />
              <text x={padLeft - 10} y={y + 4} textAnchor="end" className="analyticsChart-tickText">
                {valueFormatter(tickValue)}
              </text>
            </g>
          );
        })}

        <path d={path} fill="none" className="analyticsChart-line" />

        {points.map((point, index) => (
          <g key={`${point.label}_${index}`}>
            <title>{`${point.label}: ${valueFormatter(point.value)}`}</title>
            <circle cx={point.x} cy={point.y} r="5.5" className="analyticsChart-point" />
            <text x={point.x} y={padTop + innerHeight + 18} textAnchor="middle" className="analyticsChart-labelText">
              {shortLabel(point.label, 12)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function EmptyChart({ label }) {
  return <div className="analyticsChart-empty">{label}</div>;
}

function shortLabel(label, maxLen) {
  const text = String(label ?? "");
  if (text.length <= maxLen) return text;
  return `${text.slice(0, Math.max(0, maxLen - 1))}…`;
}