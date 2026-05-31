import { useEffect, useState } from "react";
import adminAPI from "../../../services/adminAPI";

/* ── Stat Card ── */
const StatCard = ({ icon, value, label, sub, color, trend }) => (
  <div className={`admin-stat-card ${color}`}>
    <div className="admin-stat-top">
      <div className={`admin-stat-icon ${color}`}>{icon}</div>
      {trend != null && (
        <span className={`admin-stat-trend ${trend > 0 ? "up" : trend < 0 ? "down" : "neu"}`}>
          {trend > 0 ? "↑" : trend < 0 ? "↓" : "—"} {Math.abs(trend)}
        </span>
      )}
    </div>
    <div className="admin-stat-info">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  </div>
);

/* ── SVG Line / Area Chart ── */
const LineChart = ({ data, color = "#38bdf8", height = 150 }) => {
  if (!data || data.length < 2) return (
    <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 13 }}>
      Chưa có dữ liệu
    </div>
  );
  const W = 500, H = height;
  const pad = { top: 8, right: 8, bottom: 24, left: 38 };
  const iW = W - pad.left - pad.right;
  const iH = H - pad.top - pad.bottom;
  const vals = data.map((d) => d.value ?? 0);
  const maxV = Math.max(...vals) || 1;
  const minV = Math.min(...vals);
  const range = maxV - minV || 1;
  const x = (i) => pad.left + (i / (data.length - 1)) * iW;
  const y = (v) => pad.top + iH - ((v - minV) / range) * iH;
  const pts = data.map((d, i) => [x(i), y(d.value ?? 0)]);
  const smoothPath = pts.reduce((acc, pt, i) => {
    if (i === 0) return `M${pt[0]},${pt[1]}`;
    const prev = pts[i - 1];
    const cpX = (prev[0] + pt[0]) / 2;
    return `${acc} C${cpX},${prev[1]} ${cpX},${pt[1]} ${pt[0]},${pt[1]}`;
  }, "");
  const smoothArea = `${smoothPath} L${pts[pts.length - 1][0]},${pad.top + iH} L${pts[0][0]},${pad.top + iH} Z`;
  const yTicks = [0, 0.5, 1].map((t) => ({
    val: Math.round(minV + t * range),
    y: pad.top + iH - t * iH,
  }));
  const gradId = `lg${color.replace("#", "")}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="admin-chart-svg" style={{ height }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={pad.left} y1={t.y} x2={W - pad.right} y2={t.y} stroke="#f1f5f9" strokeWidth="1" />
          <text x={pad.left - 5} y={t.y + 4} textAnchor="end" fontSize="9" fill="#94a3b8">
            {t.val > 999 ? `${(t.val / 1000).toFixed(1)}k` : t.val}
          </text>
        </g>
      ))}
      <path d={smoothArea} fill={`url(#${gradId})`} />
      <path d={smoothPath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((pt, i) => (
        <g key={i}>
          <circle cx={pt[0]} cy={pt[1]} r="4" fill="#fff" stroke={color} strokeWidth="2.5" />
          <text x={pt[0]} y={pad.top + iH + 16} textAnchor="middle" fontSize="9.5" fill="#94a3b8">
            {data[i]._id ? data[i]._id.slice(5) : data[i].label}
          </text>
        </g>
      ))}
    </svg>
  );
};

/* ── SVG Donut Chart ── */
const DonutChart = ({ segments, size = 120 }) => {
  if (!segments || segments.length === 0) return null;
  const total = segments.reduce((s, d) => s + d.value, 0) || 1;
  const r = 42, cx = 60, cy = 60, sw = 14;
  const circ = 2 * Math.PI * r;
  let cumAngle = -Math.PI / 2;
  const arcs = segments.map((seg) => {
    const frac = seg.value / total;
    const startAngle = cumAngle;
    cumAngle += frac * 2 * Math.PI;
    return { ...seg, dashOffset: circ * (1 - frac), rotDeg: (startAngle * 180) / Math.PI + 90 };
  });
  return (
    <div className="admin-donut-wrapper">
      <svg viewBox="0 0 120 120" style={{ width: size, height: size, flexShrink: 0 }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={sw} />
        {arcs.map((arc, i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={arc.color} strokeWidth={sw}
            strokeDasharray={circ} strokeDashoffset={arc.dashOffset}
            transform={`rotate(${arc.rotDeg} ${cx} ${cy})`}
            strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.8s ease" }}
          />
        ))}
        <text x={cx} y={cy - 5} textAnchor="middle" fontSize="14" fontWeight="700" fill="#0f172a">{total.toLocaleString("vi-VN")}</text>
        <text x={cx} y={cy + 11} textAnchor="middle" fontSize="8.5" fill="#94a3b8">Tổng</text>
      </svg>
      <div className="admin-donut-list">
        {segments.map((seg, i) => (
          <div key={i} className="admin-donut-item">
            <div className="admin-donut-dot" style={{ background: seg.color }} />
            <span className="admin-donut-label">{seg.label}</span>
            <span className="admin-donut-value">
              {seg.value.toLocaleString("vi-VN")}
              <span style={{ fontWeight: 400, color: "#94a3b8", fontSize: 10 }}> ({Math.round((seg.value / total) * 100)}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ── SVG Bar Chart ── */
const BarChart = ({ data, color = "#818cf8", height = 140 }) => {
  if (!data || data.length === 0) return (
    <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 13 }}>Chưa có dữ liệu</div>
  );
  const W = 500, H = height;
  const pad = { top: 8, right: 8, bottom: 28, left: 38 };
  const iW = W - pad.left - pad.right;
  const iH = H - pad.top - pad.bottom;
  const vals = data.map((d) => d.value ?? d.count ?? 0);
  const maxV = Math.max(...vals) || 1;
  const barW = Math.max(8, (iW / data.length) * 0.55);
  const barGap = iW / data.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="admin-chart-svg" style={{ height }}>
      {[0, 0.5, 1].map((t, i) => (
        <g key={i}>
          <line x1={pad.left} y1={pad.top + iH - t * iH} x2={W - pad.right} y2={pad.top + iH - t * iH} stroke="#f1f5f9" strokeWidth="1" />
          <text x={pad.left - 5} y={pad.top + iH - t * iH + 4} textAnchor="end" fontSize="9" fill="#94a3b8">{Math.round(maxV * t)}</text>
        </g>
      ))}
      <line x1={pad.left} y1={pad.top + iH} x2={W - pad.right} y2={pad.top + iH} stroke="#e2e8f0" strokeWidth="1" />
      {data.map((d, i) => {
        const v = d.value ?? d.count ?? 0;
        const bH = Math.max(3, (v / maxV) * iH);
        const bX = pad.left + i * barGap + (barGap - barW) / 2;
        const bY = pad.top + iH - bH;
        return (
          <g key={i}>
            <rect x={bX} y={bY} width={barW} height={bH} rx="4" fill={color} opacity="0.85" />
            <text x={bX + barW / 2} y={pad.top + iH + 17} textAnchor="middle" fontSize="9.5" fill="#94a3b8">
              {d._id ? d._id.slice(5) : d.label ?? i + 1}
            </text>
            {v > 0 && (
              <text x={bX + barW / 2} y={bY - 4} textAnchor="middle" fontSize="9" fontWeight="600" fill={color}>{v}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
};

/* ── Progress List ── */
const ProgressList = ({ items }) => (
  <div className="admin-progress-list">
    {items.map((item, i) => (
      <div key={i} className="admin-progress-row">
        <div className="admin-progress-meta">
          <span className="admin-progress-meta-label">{item.label}</span>
          <span className="admin-progress-meta-value">{item.value.toLocaleString("vi-VN")}</span>
        </div>
        <div className="admin-progress-track">
          <div className="admin-progress-bar" style={{ width: `${item.pct}%`, background: item.color }} />
        </div>
      </div>
    ))}
  </div>
);

/* ── Main Dashboard ── */
const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminAPI.getStats().then((res) => {
      if (res.data.success) setStats(res.data.stats);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="admin-loading"><div className="admin-spinner" />Đang tải dữ liệu...</div>;
  if (!stats) return (
    <div className="admin-empty">
      <div className="admin-empty-icon">⚠️</div>
      <div className="admin-empty-text">Không thể tải dữ liệu</div>
    </div>
  );

  const fmt = (n) => (n ?? 0).toLocaleString("vi-VN");

  const growthData = (stats.userGrowth || []).map((d) => ({ ...d, value: d.count ?? 0 }));
  const premiumData = (stats.premiumGrowth || []).map((d) => ({ ...d, value: d.count ?? 0 }));

  const planSegments = [
    { label: "Premium", value: stats.premiumUsers ?? 0, color: "#f59e0b" },
    { label: "Free", value: stats.freeUsers ?? 0, color: "#38bdf8" },
  ];

  const maxContent = Math.max(
    stats.totalRecipes ?? 0, stats.totalPosts ?? 0,
    stats.totalMealPlans ?? 0, stats.totalConsultations ?? 0, 1
  );
  const contentItems = [
    { label: "Công thức", value: stats.totalRecipes ?? 0, pct: ((stats.totalRecipes ?? 0) / maxContent) * 100, color: "#818cf8" },
    { label: "Bài đăng", value: stats.totalPosts ?? 0, pct: ((stats.totalPosts ?? 0) / maxContent) * 100, color: "#f472b6" },
    { label: "Kế hoạch bữa ăn", value: stats.totalMealPlans ?? 0, pct: ((stats.totalMealPlans ?? 0) / maxContent) * 100, color: "#34d399" },
    { label: "Tư vấn", value: stats.totalConsultations ?? 0, pct: ((stats.totalConsultations ?? 0) / maxContent) * 100, color: "#fb923c" },
  ];

  return (
    <div>
      {/* Header */}
      <div className="admin-page-header">
        <div>
          <h2 className="admin-page-title">Tổng quan hệ thống</h2>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
            Cập nhật lúc {new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
      </div>

      {/* Stat Cards — bỏ doanh thu, đơn hàng, món ăn — 4 cột cân đối */}
      <div className="admin-stats-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <StatCard icon="👥" value={fmt(stats.totalUsers)} label="Tổng người dùng"
          sub={stats.newUsersThisWeek > 0 ? `+${fmt(stats.newUsersThisWeek)} tuần này` : null}
          color="blue" trend={stats.newUsersThisWeek} />
        <StatCard icon="⭐" value={fmt(stats.premiumUsers)} label="Premium" sub={`${fmt(stats.freeUsers)} Free`} color="yellow" />
        <StatCard icon="📖" value={fmt(stats.totalRecipes)} label="Công thức" color="purple" />
        <StatCard icon="💬" value={fmt(stats.totalPosts)} label="Bài đăng" color="pink" />
        <StatCard icon="👨‍⚕️" value={fmt(stats.totalDoctors)} label="Bác sĩ" color="red" />
        <StatCard icon="📅" value={fmt(stats.totalMealPlans)} label="Kế hoạch ăn" color="cyan" />
        <StatCard icon="🩺" value={fmt(stats.totalConsultations)} label="Tư vấn" color="indigo" />
      </div>

      {/* Row 1: Line chart + Donut */}
      <div className="admin-charts-row cols-13" style={{ marginBottom: 18 }}>
        <div className="admin-chart-card">
          <div className="admin-chart-header">
            <div>
              <div className="admin-chart-title">Người dùng mới theo tháng</div>
              <div className="admin-chart-subtitle">6 tháng gần nhất</div>
            </div>
            <div className="admin-chart-legend">
              <div className="admin-chart-legend-item">
                <div className="admin-chart-legend-dot" style={{ background: "#38bdf8" }} />
                Người dùng mới
              </div>
            </div>
          </div>
          <LineChart
            data={growthData.length >= 2 ? growthData : [
              { _id: "Tháng 1", value: 0 }, { _id: "Tháng 2", value: 0 },
            ]}
            color="#38bdf8" height={155}
          />
        </div>

        <div className="admin-chart-card">
          <div className="admin-chart-header">
            <div>
              <div className="admin-chart-title">Phân loại người dùng</div>
              <div className="admin-chart-subtitle">Free vs Premium</div>
            </div>
          </div>
          <DonutChart segments={planSegments} size={110} />
        </div>
      </div>

      {/* Row 2: Bar chart + Progress */}
      <div className="admin-charts-row cols-2">
        <div className="admin-chart-card">
          <div className="admin-chart-header">
            <div>
              <div className="admin-chart-title">Đăng ký gói Premium theo tháng</div>
              <div className="admin-chart-subtitle">Gói trả phí — 6 tháng (không tính dùng thử)</div>
            </div>
            <div className="admin-chart-legend">
              <div className="admin-chart-legend-item">
                <div className="admin-chart-legend-dot" style={{ background: "#f59e0b" }} />
                Gói Premium
              </div>
            </div>
          </div>
          <BarChart
            data={premiumData.length > 0 ? premiumData : [
              { _id: "T1", value: 0 }, { _id: "T2", value: 0 },
              { _id: "T3", value: 0 }, { _id: "T4", value: 0 },
            ]}
            color="#f59e0b" height={145}
          />
        </div>

        <div className="admin-chart-card">
          <div className="admin-chart-header">
            <div>
              <div className="admin-chart-title">Thống kê nội dung</div>
              <div className="admin-chart-subtitle">Tỷ lệ phân bổ nội dung</div>
            </div>
          </div>
          <div style={{ marginTop: 8 }}>
            <ProgressList items={contentItems} />
          </div>
          <div className="admin-divider" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px" }}>
            {[
              ["👨‍⚕️ Bác sĩ", stats.totalDoctors ?? 0, "#f87171"],
              ["📅 Kế hoạch", stats.totalMealPlans ?? 0, "#34d399"],
            ].map(([label, val, color]) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>{label}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>{val.toLocaleString("vi-VN")}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
