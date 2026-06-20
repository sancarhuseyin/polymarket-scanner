const state = {
  signals: [],
  intents: [],
  selectedId: "",
  selectedLegIndex: 0,
  selectedCategory: "all",
  search: "",
  timer: undefined,
  loading: false
};

const els = {
  body: document.body,
  scanButton: document.getElementById("scanButton"),
  autoRefresh: document.getElementById("autoRefresh"),
  sportsOnly: document.getElementById("sportsOnly"),
  maxMarkets: document.getElementById("maxMarkets"),
  minLiquidity: document.getElementById("minLiquidity"),
  nearZeroYesMaxBid: document.getElementById("nearZeroYesMaxBid"),
  maxSpread: document.getElementById("maxSpread"),
  correlationEdgeMin: document.getElementById("correlationEdgeMin"),
  searchInput: document.getElementById("searchInput"),
  signalList: document.getElementById("signalList"),
  marketsMetric: document.getElementById("marketsMetric"),
  signalsMetric: document.getElementById("signalsMetric"),
  intentsMetric: document.getElementById("intentsMetric"),
  topEdgeMetric: document.getElementById("topEdgeMetric"),
  edgeTape: document.getElementById("edgeTape"),
  clock: document.getElementById("clock"),
  modePill: document.getElementById("modePill"),
  detailKind: document.getElementById("detailKind"),
  detailTitle: document.getElementById("detailTitle"),
  detailEdge: document.getElementById("detailEdge"),
  detailPrice: document.getElementById("detailPrice"),
  detailDepth: document.getElementById("detailDepth"),
  detailLiquidity: document.getElementById("detailLiquidity"),
  detailReason: document.getElementById("detailReason"),
  detailEndDate: document.getElementById("detailEndDate"),
  detailLink: document.getElementById("detailLink"),
  resolutionFilter: document.getElementById("resolutionFilter"),
  customResolutionDays: document.getElementById("customResolutionDays"),
  detailChartContainer: document.getElementById("detailChartContainer"),
  detailChart: document.getElementById("detailChart"),
  chartSkeleton: document.getElementById("chartSkeleton"),
  chartTargetName: document.getElementById("chartTargetName"),
  priceLadder: document.getElementById("priceLadder"),
  intentPreview: document.getElementById("intentPreview"),
  soundToggle: document.getElementById("soundToggle")
};
const audio = {
  ctx: null,
  enabled: false,
  
  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
  },
  
  playBeep(freq, type, duration, volume) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = type || "sine";
      osc.frequency.setValueAtTime(freq || 440, this.ctx.currentTime);
      
      gain.gain.setValueAtTime(volume || 0.1, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + (duration || 0.1));
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start();
      osc.stop(this.ctx.currentTime + (duration || 0.1));
    } catch (err) {
      console.error("Audio error:", err);
    }
  },
  
  tick() {
    this.playBeep(980, "triangle", 0.04, 0.04);
  },
  
  scanComplete() {
    this.playBeep(880, "sine", 0.15, 0.03);
    setTimeout(() => this.playBeep(1109, "sine", 0.2, 0.03), 80);
  },
  
  alert() {
    this.playBeep(1500, "sine", 0.08, 0.05);
    setTimeout(() => this.playBeep(1800, "sine", 0.08, 0.05), 60);
  }
};

function generateSparkline(seedString, currentPrice) {
  let hash = 0;
  for (let i = 0; i < seedString.length; i++) {
    hash = seedString.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const points = [];
  const count = 12;
  let val = currentPrice !== undefined ? Number(currentPrice) : 0.5;
  if (isNaN(val)) val = 0.5;
  
  for (let i = 0; i < count; i++) {
    const step = ((Math.abs(hash >> i) % 100) - 50) / 1000;
    val = Math.max(0.001, Math.min(0.999, val - step));
    points.unshift(val);
  }
  
  points[count - 1] = currentPrice !== undefined ? Number(currentPrice) : 0.5;
  
  const w = 60;
  const h = 20;
  const minVal = Math.min(...points);
  const maxVal = Math.max(...points);
  const range = maxVal - minVal || 1;
  
  const coords = points.map((p, index) => {
    const x = (index / (count - 1)) * w;
    const y = h - 2 - ((p - minVal) / range) * (h - 4);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  
  return `<path d="M ${coords.join(' L ')}" fill="none" stroke="var(--teal)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />`;
}

const numberFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const compactFormat = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1
});

document.querySelectorAll(".segment").forEach((button) => {
  button.addEventListener("click", () => {
    state.selectedCategory = button.dataset.category || "all";
    document.querySelectorAll(".segment").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    scan();
  });
});

els.scanButton.addEventListener("click", () => scan());
els.searchInput.addEventListener("input", () => {
  state.search = els.searchInput.value.trim().toLowerCase();
  renderSignals();
});
els.autoRefresh.addEventListener("change", () => {
  if (els.autoRefresh.checked) {
    if (!state.timer) {
      state.timer = window.setInterval(() => scan(), 30000);
    }
    scan();
  } else if (state.timer) {
    window.clearInterval(state.timer);
    state.timer = undefined;
  }
});

els.resolutionFilter.addEventListener("change", () => {
  if (els.resolutionFilter.value === "custom") {
    document.getElementById("customResolutionGroup").style.display = "grid";
  } else {
    document.getElementById("customResolutionGroup").style.display = "none";
  }
  renderSignals();
});

els.customResolutionDays.addEventListener("input", () => {
  renderSignals();
});

// Category filter dropdown listener removed

els.soundToggle.addEventListener("change", () => {
  audio.enabled = els.soundToggle.checked;
  if (audio.enabled) {
    audio.ctx = null;
    audio.init();
    audio.tick();
  }
});

// Initialize automatic scanning if checked on load
if (els.autoRefresh.checked) {
  state.timer = window.setInterval(() => scan(), 30000);
}
scan();

async function scan() {
  if (state.loading) {
    return;
  }

  state.loading = true;
  els.body.classList.add("loading");
  els.scanButton.disabled = true;
  els.scanButton.innerHTML = '<span aria-hidden="true">↻</span> Scanning...';
  els.clock.textContent = "Scanning...";

  try {
    const response = await fetch(`/api/scan?${buildQuery()}`);
    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }

    state.signals = payload.report.signals || [];
    state.intents = payload.report.intents || [];
    if (!state.signals.some((signal) => signal.id === state.selectedId)) {
      state.selectedId = state.signals[0]?.id || "";
    }

    // Category dropdown dynamic options removed, category state is now set via category segment tabs.

    updateMetrics(payload);
    renderTape();
    renderSignals();
    renderDetail();

    audio.scanComplete();
    if (state.signals.some((s) => s.edge >= 0.08)) {
      audio.alert();
    }
  } catch (error) {
    els.signalList.innerHTML = `<div class="empty-state">API error: ${escapeHtml(error.message || String(error))}</div>`;
  } finally {
    state.loading = false;
    els.body.classList.remove("loading");
    els.scanButton.disabled = false;
    els.scanButton.innerHTML = '<span aria-hidden="true">↻</span> Scan';
  }
}

function buildQuery() {
  const params = new URLSearchParams({
    sportsOnly: String(els.sportsOnly.checked),
    maxMarkets: els.maxMarkets.value,
    minLiquidity: els.minLiquidity.value,
    nearZeroYesMaxBid: els.nearZeroYesMaxBid.value,
    maxSpread: els.maxSpread.value,
    correlationEdgeMin: els.correlationEdgeMin.value,
    category: state.selectedCategory
  });
  return params.toString();
}

function updateMetrics(payload) {
  const report = payload.report;
  const topSignal = report.signals?.[0];
  els.marketsMetric.textContent = numberFormat.format(report.scannedMarkets || 0);
  els.signalsMetric.textContent = numberFormat.format(report.signals?.length || 0);
  els.intentsMetric.textContent = numberFormat.format(report.intents?.length || 0);
  els.topEdgeMetric.textContent = topSignal ? formatPercent(topSignal.edge) : "0.00%";
  els.clock.textContent = `${formatTime(payload.generatedAt)} · ${payload.durationMs} ms`;
  els.modePill.textContent = payload.mode || "paper-ui";
}

function renderSignals() {
  const signals = filteredSignals();

  if (!signals.length) {
    els.signalList.innerHTML = '<div class="empty-state">No signals</div>';
    renderDetail();
    return;
  }

  els.signalList.innerHTML = signals.map((signal) => rowTemplate(signal)).join("");
  els.signalList.querySelectorAll(".signal-row").forEach((row) => {
    row.addEventListener("click", () => {
      audio.tick();
      state.selectedId = row.dataset.id;
      state.selectedLegIndex = 0;
      renderSignals();
      renderDetail();
    });
  });
}

function getSignalEndDate(signal) {
  let minTime = Infinity;
  for (const leg of signal.legs || []) {
    if (leg.endDate) {
      const time = Date.parse(leg.endDate);
      if (!isNaN(time) && time < minTime) {
        minTime = time;
      }
    }
  }
  return minTime;
}

function filteredSignals() {
  const now = Date.now();
  const resFilter = els.resolutionFilter.value;
  let maxTime = Infinity;

  if (resFilter !== "any") {
    let days = 0;
    if (resFilter === "1w") days = 7;
    else if (resFilter === "2w") days = 14;
    else if (resFilter === "3w") days = 21;
    else if (resFilter === "1m") days = 30;
    else if (resFilter === "3m") days = 90;
    else if (resFilter === "6m") days = 180;
    else if (resFilter === "1y") days = 365;
    else if (resFilter === "custom") {
      days = parseInt(els.customResolutionDays.value, 10) || 7;
    }
    maxTime = now + days * 24 * 60 * 60 * 1000;
  }

  return state.signals.filter((signal) => {
    if (maxTime !== Infinity) {
      const endTime = getSignalEndDate(signal);
      if (endTime > maxTime) {
        return false;
      }
    }

    if (!state.search) {
      return true;
    }
    const leg = signal.legs?.[0] || {};
    const text = `${signal.title || ""} ${leg.question || ""} ${leg.eventTitle || ""}`.toLowerCase();
    return text.includes(state.search);
  });
}

function rowTemplate(signal) {
  const leg = signal.legs?.[0] || {};
  const active = signal.id === state.selectedId ? " active" : "";
  const chip = signal.kind === "neg_risk_sell_basket" ? "basket" : "yes";
  const chipText = signal.kind === "neg_risk_sell_basket" ? "Basket" : "YES";
  const width = Math.max(3, Math.min(100, Number(leg.price || signal.edge || 0) * 100));
  const dateText = leg.endDate ? ` · Resolution: ${formatDate(leg.endDate)}` : "";

  return `
    <button class="signal-row${active}" data-id="${escapeHtml(signal.id)}" type="button">
      <span class="signal-main">
        <span class="kind-chip ${chip}">${chipText}</span>
        <span>
          <span class="signal-title">${escapeHtml(primaryTitle(signal))}</span>
          <span class="signal-sub">${escapeHtml(signal.reason || "")}${escapeHtml(dateText)}</span>
        </span>
      </span>
      <span class="mono-cell price-cell">${formatPrice(leg.price)}</span>
      <span class="trend-cell">
        <svg width="60" height="20" viewBox="0 0 60 20">${generateSparkline(leg.marketId || signal.id, leg.price)}</svg>
      </span>
      <span class="depth-cell">
        <span class="depth-number">${compactFormat.format(leg.availableSize || 0)}</span>
        <span class="mini-ladder"><span style="--width: ${width}%"></span></span>
      </span>
      <span class="mono-cell edge-cell">${formatPercent(signal.edge)}</span>
    </button>
  `;
}

function renderDetail() {
  const signal = state.signals.find((item) => item.id === state.selectedId);
  const intent = state.intents.find((item) => item.signalId === state.selectedId);

  if (!signal) {
    els.detailKind.textContent = "Detail";
    els.detailTitle.textContent = "No signal selected";
    els.detailEdge.textContent = "-";
    els.detailPrice.textContent = "-";
    els.detailDepth.textContent = "-";
    els.detailLiquidity.textContent = "-";
    els.detailEndDate.textContent = "-";
    els.detailReason.textContent = "Select a signal to view reasoning.";
    els.priceLadder.innerHTML = "";
    els.intentPreview.textContent = "None yet";
    els.detailLink.style.display = "none";
    els.detailChartContainer.style.display = "none";
    els.detailChart.src = "";
    els.chartTargetName.textContent = "";
    return;
  }

  const legIndex = state.selectedLegIndex || 0;
  const leg = signal.legs?.[legIndex] || signal.legs?.[0] || {};
  els.detailKind.textContent = signal.kind === "neg_risk_sell_basket" ? "Negative-risk basket" : "Near-zero YES";
  els.detailTitle.textContent = primaryTitle(signal);
  els.detailEdge.textContent = formatPercent(signal.edge);
  els.detailPrice.textContent = formatPrice(leg.price);
  els.detailDepth.textContent = `${numberFormat.format(leg.availableSize || 0)} shares`;
  els.detailLiquidity.textContent = `$${compactFormat.format(leg.liquidity || 0)}`;
  els.detailEndDate.textContent = formatDate(leg.endDate);
  els.detailReason.textContent = signal.reason || "";
  els.priceLadder.innerHTML = ladderTemplate(signal);
  els.intentPreview.textContent = intent
    ? `${intent.side} ${numberFormat.format(intent.size)} @ ${formatPrice(intent.price)} · risk $${numberFormat.format(intent.maxSettlementRiskUsd)}`
    : "Paper intent not generated";

  if (leg.slug) {
    els.detailLink.href = `https://polymarket.com/market/${leg.slug}`;
    els.detailLink.style.display = "inline-flex";
  } else if (leg.eventSlug) {
    els.detailLink.href = `https://polymarket.com/event/${leg.eventSlug}`;
    els.detailLink.style.display = "inline-flex";
  } else {
    els.detailLink.style.display = "none";
  }

  if (leg.slug) {
    els.chartSkeleton.style.display = "block";
    els.detailChart.src = `https://embed.polymarket.com/market?market=${leg.slug}&theme=dark`;
    els.detailChartContainer.style.display = "block";
    els.chartTargetName.textContent = leg.groupItemTitle || leg.outcome || "YES";
  } else {
    els.chartSkeleton.style.display = "none";
    els.detailChartContainer.style.display = "none";
    els.detailChart.src = "";
    els.chartTargetName.textContent = "";
  }

  // Bind click listeners on the newly rendered ladder rows to allow selecting different legs
  els.priceLadder.querySelectorAll(".ladder-row").forEach((row) => {
    row.addEventListener("click", () => {
      audio.tick();
      state.selectedLegIndex = parseInt(row.dataset.index, 10) || 0;
      renderDetail();
    });
  });
}

// Bind iframe onload to hide the chart skeleton loader
els.detailChart.onload = () => {
  els.chartSkeleton.style.display = "none";
};

function ladderTemplate(signal) {
  const legs = signal.legs || [];
  if (!legs.length) {
    return "";
  }
  return legs
    .map((leg, index) => {
      const active = index === (state.selectedLegIndex || 0) ? " active" : "";
      const width = Math.max(3, Math.min(100, Number(leg.price || 0) * 100));
      const color = index % 3 === 0 ? "var(--green)" : index % 3 === 1 ? "var(--amber)" : "var(--red)";
      const legName = leg.groupItemTitle || leg.outcome || "YES";
      return `
        <button class="ladder-row${active}" data-index="${index}" type="button">
          <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(legName)}</span>
          <span class="mono-cell" style="text-align: right;">${formatPrice(leg.price)}</span>
          <span class="ladder-track"><span class="ladder-fill" style="--width:${width}%;--color:${color}"></span></span>
          <span class="mono-cell" style="text-align: right;">${compactFormat.format(leg.availableSize || 0)}</span>
        </button>
      `;
    })
    .join("");
}

function renderTape() {
  const signals = state.signals.slice(0, 48);
  if (!signals.length) {
    els.edgeTape.innerHTML = "";
    return;
  }

  els.edgeTape.innerHTML = signals
    .map((signal, index) => {
      const height = Math.max(12, Math.min(58, Number(signal.edge || 0) * 1600));
      const color = signal.kind === "neg_risk_sell_basket"
        ? "var(--violet)"
        : index % 2 === 0
          ? "var(--green)"
          : "var(--teal)";
      return `<span style="--height:${height}px;--color:${color}"></span>`;
    })
    .join("");
}

function primaryTitle(signal) {
  return signal.title || "Signal";
}

function formatPrice(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "-";
  }
  return number.toFixed(number < 0.01 ? 4 : 3);
}

function formatPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "-";
  }
  return `${(number * 100).toFixed(number < 0.01 ? 2 : 1)}%`;
}

function formatTime(value) {
  if (!value) {
    return "Idle";
  }
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(value));
}

function formatDate(value) {
  if (!value) {
    return "Not specified";
  }
  try {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
