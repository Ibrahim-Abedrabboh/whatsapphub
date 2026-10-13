"use client";

interface DataPoint {
  date: string;
  delivered: number;
  read: number;
  sent: number;
  failed: number;
}

interface Props {
  data: DataPoint[];
  height?: number;
}

export default function DeliveryChart({ data, height = 280 }: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="chart-empty">
        <span className="chart-empty__icon">📊</span>
        <p>No delivery data for this period</p>
      </div>
    );
  }

  const maxValue = Math.max(
    ...data.map((d) => Math.max(d.delivered, d.read, d.sent)),
    1
  );

  const width = 800;
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const xStep = data.length > 1 ? chartWidth / (data.length - 1) : chartWidth;

  const toX = (i: number) => padding.left + i * xStep;
  const toY = (v: number) => padding.top + chartHeight - (v / maxValue) * chartHeight;

  const makePath = (key: "delivered" | "read" | "sent") =>
    data
      .map((d, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(d[key])}`)
      .join(" ");

  const lines: { key: "delivered" | "read" | "sent"; color: string; label: string }[] = [
    { key: "sent", color: "#3b82f6", label: "Sent" },
    { key: "delivered", color: "#0d9488", label: "Delivered" },
    { key: "read", color: "#10b981", label: "Read" },
  ];

  // Y-axis ticks
  const yTicks = 5;
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) => Math.round((maxValue / yTicks) * i));

  // X-axis labels (show every nth label to avoid crowding)
  const labelEvery = Math.max(1, Math.ceil(data.length / 8));

  return (
    <div className="chart-container">
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" preserveAspectRatio="xMidYMid meet">
        {/* Grid lines */}
        {yTickValues.map((v, i) => (
          <line
            key={`grid-${i}`}
            x1={padding.left}
            y1={toY(v)}
            x2={width - padding.right}
            y2={toY(v)}
            stroke="var(--border-primary)"
            strokeDasharray="4 4"
            opacity={0.3}
          />
        ))}

        {/* Y-axis labels */}
        {yTickValues.map((v, i) => (
          <text
            key={`ylabel-${i}`}
            x={padding.left - 8}
            y={toY(v) + 4}
            textAnchor="end"
            className="chart-label"
            fill="var(--text-muted)"
            fontSize="11"
          >
            {v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
          </text>
        ))}

        {/* X-axis labels */}
        {data.map((d, i) =>
          i % labelEvery === 0 ? (
            <text
              key={d.date}
              x={toX(i)}
              y={height - 8}
              textAnchor="middle"
              className="chart-label"
              fill="var(--text-muted)"
              fontSize="11"
            >
              {new Date(d.date).toLocaleDateString("en", { month: "short", day: "numeric" })}
            </text>
          ) : null
        )}

        {/* Data lines */}
        {lines.map(({ key, color }) => (
          <path
            key={key}
            d={makePath(key)}
            fill="none"
            stroke={color}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {/* Data points */}
        {lines.map(({ key, color }) =>
          data.map((d, i) => (
            <circle
              key={`${key}-${i}`}
              cx={toX(i)}
              cy={toY(d[key])}
              r={3}
              fill={color}
              opacity={0.8}
            />
          ))
        )}
      </svg>

      {/* Legend */}
      <div className="chart-legend">
        {lines.map(({ key, color, label }) => (
          <div key={key} className="chart-legend__item">
            <span className="chart-legend__dot" style={{ background: color }} />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
