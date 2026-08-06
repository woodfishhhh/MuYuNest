const state = {
  data: null,
  metric: "pageviews",
};

const numberFormatter = new Intl.NumberFormat("zh-CN");

function formatDuration(seconds) {
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes} 分 ${remainder} 秒`;
}

function setStatus(message, error = false) {
  const element = document.querySelector("#status");
  element.textContent = message;
  element.style.color = error ? "#e03131" : "";
}

function renderKpis(totals) {
  const values = [
    ["浏览量", numberFormatter.format(totals.pageviews)],
    ["访客", numberFormatter.format(totals.visitors)],
    ["会话", numberFormatter.format(totals.sessions)],
    ["跳出率", `${totals.bounceRate}%`],
    ["平均访问", formatDuration(totals.avgSessionSeconds)],
    ["30 分钟活跃", numberFormatter.format(totals.activeVisitors30m)],
  ];
  document.querySelector("#kpis").innerHTML = values
    .map(
      ([label, value]) =>
        `<article class="kpi"><span class="kpi-label">${label}</span><strong class="kpi-value">${value}</strong></article>`,
    )
    .join("");
}

function escapeHtml(value) {
  const element = document.createElement("span");
  element.textContent = value;
  return element.innerHTML;
}

function renderRankList(selector, rows, fallback = "暂无数据") {
  const target = document.querySelector(selector);
  if (!rows.length) {
    target.innerHTML = `<div class="empty">${fallback}</div>`;
    return;
  }
  target.innerHTML = rows
    .map(
      (row) => `<div class="rank-row">
        <span class="rank-label" title="${escapeHtml(row.label)}">${escapeHtml(row.label)}</span>
        <span class="rank-value">${numberFormatter.format(row.value)}</span>
      </div>`,
    )
    .join("");
}

function renderVitals(rows) {
  const target = document.querySelector("#web-vitals");
  if (!rows.length) {
    target.innerHTML = '<div class="empty">收集到真实访问后显示</div>';
    return;
  }
  target.innerHTML = rows
    .map((row) => {
      const value = row.name === "CLS" ? row.average.toFixed(3) : `${Math.round(row.average)} ms`;
      return `<div class="vital">
        <strong>${row.name}</strong>
        <span class="vital-value">${value}</span>
        <span class="vital-meta">${row.samples} 个样本 · ${row.good || 0} 个良好</span>
      </div>`;
    })
    .join("");
}

function renderChart() {
  if (!state.data) return;
  const canvas = document.querySelector("#trend-chart");
  const bounds = canvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(Math.round(bounds.width * ratio), 1);
  canvas.height = Math.max(Math.round(bounds.height * ratio), 1);
  const context = canvas.getContext("2d");
  context.scale(ratio, ratio);

  const width = bounds.width;
  const height = bounds.height;
  const padding = { top: 18, right: 12, bottom: 30, left: 42 };
  const plotWidth = Math.max(width - padding.left - padding.right, 1);
  const plotHeight = Math.max(height - padding.top - padding.bottom, 1);
  const values = state.data.timeSeries.map((row) => Number(row[state.metric] || 0));
  const maximum = Math.max(...values, 1);
  const styles = getComputedStyle(document.documentElement);
  const gridColor = styles.getPropertyValue("--line").trim();
  const accentColor = styles.getPropertyValue("--accent").trim();
  const mutedColor = styles.getPropertyValue("--muted").trim();

  context.clearRect(0, 0, width, height);
  context.font = "11px system-ui";
  context.fillStyle = mutedColor;
  context.strokeStyle = gridColor;
  context.lineWidth = 1;

  for (let index = 0; index <= 4; index += 1) {
    const y = padding.top + (plotHeight * index) / 4;
    context.beginPath();
    context.moveTo(padding.left, y);
    context.lineTo(width - padding.right, y);
    context.stroke();
    const label = Math.round(maximum * (1 - index / 4));
    context.fillText(numberFormatter.format(label), 2, y + 4);
  }

  const points = values.map((value, index) => ({
    x: padding.left + (plotWidth * index) / Math.max(values.length - 1, 1),
    y: padding.top + plotHeight - (plotHeight * value) / maximum,
  }));
  const gradient = context.createLinearGradient(0, padding.top, 0, height - padding.bottom);
  gradient.addColorStop(0, `${accentColor}55`);
  gradient.addColorStop(1, `${accentColor}00`);

  if (points.length) {
    context.beginPath();
    context.moveTo(points[0].x, height - padding.bottom);
    for (const point of points) context.lineTo(point.x, point.y);
    context.lineTo(points[points.length - 1].x, height - padding.bottom);
    context.closePath();
    context.fillStyle = gradient;
    context.fill();

    context.beginPath();
    points.forEach((point, index) => {
      if (index === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    });
    context.strokeStyle = accentColor;
    context.lineWidth = 2;
    context.lineJoin = "round";
    context.stroke();
  }

  const labelIndexes = [...new Set([0, Math.floor((values.length - 1) / 2), values.length - 1])];
  context.fillStyle = mutedColor;
  context.textAlign = "center";
  for (const index of labelIndexes) {
    const row = state.data.timeSeries[index];
    if (!row) continue;
    const label = row.label.slice(5).replace("-", "/");
    const x = padding.left + (plotWidth * index) / Math.max(values.length - 1, 1);
    context.fillText(label, x, height - 7);
  }
  context.textAlign = "start";
}

function render(data) {
  renderKpis(data.totals);
  renderRankList("#top-pages", data.topPages);
  renderRankList("#referrers", data.referrers, "暂无外部来源");
  renderRankList("#devices", data.devices);
  renderRankList("#browsers", data.browsers);
  renderRankList("#operating-systems", data.operatingSystems);
  renderRankList("#custom-events", data.customEvents, "暂无交互事件");
  renderVitals(data.webVitals);
  document.querySelector("#generated-at").textContent = `更新于 ${new Date(data.generatedAt).toLocaleString("zh-CN")}`;
  renderChart();
}

async function loadData() {
  const days = document.querySelector("#range-select").value;
  const button = document.querySelector("#refresh-button");
  button.disabled = true;
  setStatus("正在读取数据...");
  try {
    const response = await fetch(`/api/analytics/summary?days=${days}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.data = await response.json();
    render(state.data);
    setStatus(`统计范围：近 ${days} 天`);
  } catch (error) {
    setStatus(`读取失败：${error.message}`, true);
  } finally {
    button.disabled = false;
  }
}

document.querySelector("#range-select").addEventListener("change", loadData);
document.querySelector("#refresh-button").addEventListener("click", loadData);
document.querySelectorAll("[data-chart-metric]").forEach((button) => {
  button.addEventListener("click", () => {
    state.metric = button.dataset.chartMetric;
    document.querySelectorAll("[data-chart-metric]").forEach((item) => item.classList.toggle("active", item === button));
    renderChart();
  });
});
window.addEventListener("resize", renderChart);

loadData();
