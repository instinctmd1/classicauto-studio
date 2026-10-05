// ECharts helpers. Colours are read from the CSS tokens so light and dark both work.
// Tooltips are plain class-based markup (no inline style attributes: the CSP forbids them).
import { esc, lakh, num, reducedMotion } from "./util.js";

const FONT = '"Manrope", system-ui, sans-serif';
const registry = new Set();

export function disposeCharts() { registry.forEach((c) => c.dispose()); registry.clear(); }

export function tk() {
  const cs = getComputedStyle(document.documentElement);
  const g = (n) => cs.getPropertyValue(n).trim();
  return {
    text: g("--text"), muted: g("--muted"), faint: g("--faint"), card: g("--card"), card2: g("--card-2"), card3: g("--card-3"),
    line: g("--line"), lineStrong: g("--line-strong"), grid: g("--c-grid"), axis: g("--c-axis"),
    red: g("--red"), redText: g("--red-text"), navy: g("--navy-bright"), pos: g("--pos"), neg: g("--neg"), warn: g("--warn"),
    inv: g("--c-invested"), pns: g("--c-pns"), low: g("--c-low"), mid: g("--c-mid"), lux: g("--c-lux"),
  };
}

export const bandHex = (t, b) => ({ low: t.low, middle: t.mid, luxury: t.lux, unknown: t.faint }[b] || t.muted);

export function alpha(color, a) {
  const m = /^#([0-9a-f]{6})$/i.exec(color);
  if (!m) return color;
  const n = parseInt(m[1], 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

export function mountChart(node, build, label) {
  if (!window.echarts) { node.textContent = "Charts could not load."; return null; }
  const chart = window.echarts.init(node, null, { renderer: "canvas" });
  let narrow = node.clientWidth < 520;
  const apply = () => {
    const opt = build(tk(), narrow);
    opt.animation = !reducedMotion();
    opt.animationDuration = 900; opt.animationEasing = "cubicOut"; opt.animationDelay = (i) => i * 22;
    opt.textStyle = { fontFamily: FONT, ...(opt.textStyle || {}) };
    chart.setOption(opt, true);
  };
  apply();
  const ro = new ResizeObserver(() => { chart.resize(); const n = node.clientWidth < 520; if (n !== narrow) { narrow = n; apply(); } });
  ro.observe(node);
  if (label) { node.setAttribute("role", "img"); node.setAttribute("aria-label", label); }
  registry.add({ dispose() { ro.disconnect(); chart.dispose(); } });
  return chart;
}

// ------------------------------------------------------------------ building blocks
export const catAxis = (t, data, extra = {}) => ({
  type: "category", data, boundaryGap: true,
  axisLine: { lineStyle: { color: t.lineStrong } }, axisTick: { show: false },
  axisLabel: { color: t.axis, fontFamily: FONT, fontSize: 11, margin: 10, hideOverlap: true }, ...extra,
});
export const valAxis = (t, formatter, extra = {}) => ({
  type: "value", axisLine: { show: false }, axisTick: { show: false },
  splitLine: { lineStyle: { color: t.grid } },
  axisLabel: { color: t.axis, fontFamily: FONT, fontSize: 11, formatter }, ...extra,
});
export const moneyAxisFmt = (v) => (v === 0 ? "0" : lakh(v).replace("₹", "₹"));
export const gridBox = (extra = {}) => ({ left: 8, right: 12, top: 28, bottom: 6, containLabel: true, ...extra });

export function tooltip(t, formatter, trigger = "axis", pointer = "shadow") {
  return {
    trigger, confine: true, transitionDuration: 0.12,
    backgroundColor: t.card2, borderColor: t.lineStrong, borderWidth: 1, padding: [10, 12],
    textStyle: { color: t.text, fontFamily: FONT, fontSize: 12 },
    extraCssText: "border-radius:10px;box-shadow:0 12px 32px rgba(2,6,18,.45);",
    axisPointer: trigger === "axis" ? { type: pointer, shadowStyle: { color: t.grid }, lineStyle: { color: t.lineStrong } } : undefined,
    formatter,
  };
}
export function tipHtml(title, rows) {
  const dot = (c) => `<svg class="tip-dot" width="10" height="10" viewBox="0 0 10 10"><rect width="10" height="10" rx="3" fill="${c}"/></svg>`;
  return `<div class="tip">${title ? `<b class="tip-t">${esc(title)}</b>` : ""}${rows.map((r) => `<div class="tip-r">${r.color ? dot(r.color) : ""}<span class="tip-l">${esc(r.label)}</span><span class="tip-v">${esc(r.value)}</span></div>`).join("")}</div>`;
}

export const legendBox = (t, extra = {}) => ({ top: 0, right: 0, itemWidth: 10, itemHeight: 10, itemGap: 16, icon: "roundRect", textStyle: { color: t.muted, fontFamily: FONT, fontSize: 12 }, ...extra });

/** Donut with a centre label. data: [{name, value, color}] */
export function donutOption(t, data, { centerTop = "", centerBottom = "", fmt = num, radius = ["62%", "84%"] } = {}) {
  return {
    tooltip: tooltip(t, (p) => tipHtml(null, [{ color: p.color, label: p.name, value: `${fmt(p.value)} (${p.percent}%)` }]), "item"),
    series: [{
      type: "pie", radius, center: ["50%", "50%"], avoidLabelOverlap: true, padAngle: 2, minAngle: 4,
      itemStyle: { borderRadius: 6, borderColor: t.card, borderWidth: 2 },
      label: { show: false }, labelLine: { show: false },
      emphasis: { scale: true, scaleSize: 4 },
      data: data.map((d) => ({ name: d.name, value: d.value, itemStyle: { color: d.color } })),
    }],
    graphic: centerTop || centerBottom ? [{
      type: "group", left: "center", top: "middle",
      children: [
        { type: "text", left: "center", top: -22, style: { text: centerTop, fill: t.text, font: `400 34px "Bebas Neue", Impact, sans-serif`, textAlign: "center" } },
        { type: "text", left: "center", top: 14, style: { text: centerBottom, fill: t.muted, font: `700 11px ${FONT}`, textAlign: "center" } },
      ],
    }] : undefined,
  };
}

/** Gross profit (bars) and net profit (line) by month on the main axis, with turnover as a faint dashed reference on its
 *  own hidden axis (the tooltip gives its value). Legend swatches carry the same colours as the marks. The last net point
 *  is labelled above the marker. On a phone the legend gets its own rows and the x labels thin out around the selected month. */
export function profitByMonthOption(t, months, labels, sel, monthName, narrow = false) {
  const gp = (m) => (m.car_gp || 0) + (m.pns_gp || 0);
  return {
    grid: gridBox({ top: narrow ? 58 : 34, right: 16 }),
    legend: legendBox(t, narrow ? { left: 0, right: "auto", itemGap: 12, width: "100%" } : { left: 0, right: "auto" }),
    tooltip: tooltip(t, (ps) => {
      const m = months[ps[0].dataIndex];
      return tipHtml(monthName(m.month), [
        { color: t.lux, label: "Gross profit", value: lakh(gp(m)) }, { color: t.navy, label: "Net profit", value: lakh(m.net_profit) },
        { label: "Turnover", value: lakh(m.turnover) }, { label: "Overheads", value: lakh(m.overheads) }, { label: "Cars sold", value: num(m.units) }]);
    }),
    xAxis: catAxis(t, labels, { axisLabel: { color: t.axis, fontFamily: FONT, fontSize: 11, margin: 10, hideOverlap: false, interval: (i) => (narrow ? (sel - i) % 2 === 0 : true) } }),
    yAxis: [valAxis(t, moneyAxisFmt), { type: "value", show: false }],
    series: [
      { name: "Gross profit", type: "bar", barMaxWidth: 26, itemStyle: { color: t.lux }, data: months.map((m, i) => ({ value: gp(m), itemStyle: i === sel ? { color: t.lux, borderRadius: [6, 6, 0, 0] } : { color: alpha(t.lux, 0.38), borderColor: t.lux, borderWidth: 1, borderRadius: [6, 6, 0, 0] } })) },
      { name: "Net profit", type: "line", smooth: 0.25, symbolSize: 8, z: 5, color: t.navy, lineStyle: { width: 3, color: t.navy }, itemStyle: { color: t.navy, borderColor: t.card, borderWidth: 2 },
        endLabel: { show: true, formatter: (p) => lakh(p.value), color: t.text, fontWeight: 800, fontSize: 12, distance: 14, position: "top" },
        data: months.map((m) => ({ value: m.net_profit, itemStyle: { color: m.net_profit < 0 ? t.neg : t.navy, borderColor: t.card, borderWidth: 2 } })) },
      { name: "Turnover (dashed)", type: "line", yAxisIndex: 1, symbol: "none", z: 1, color: alpha(t.pns, 0.8), lineStyle: { width: 1.5, type: "dashed", color: alpha(t.pns, 0.55) }, itemStyle: { color: t.pns }, data: months.map((m) => m.turnover) },
    ],
  };
}
