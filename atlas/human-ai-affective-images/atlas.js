(() => {
  "use strict";

  const DATA_URL = "atlas-data.json";
  const plot = document.getElementById("affect-plot");
  const pointsLayer = document.getElementById("atlas-points-layer");
  const meansLayer = document.getElementById("atlas-means-layer");
  const linesLayer = document.getElementById("atlas-lines-layer");
  const tooltip = document.getElementById("atlas-tooltip");
  const selectedItem = document.getElementById("atlas-selected-item");
  const categorySummary = document.getElementById("atlas-category-summary");
  const plotTitle = document.getElementById("atlas-plot-title");
  const ticksX = document.getElementById("atlas-ticks-x");
  const ticksY = document.getElementById("atlas-ticks-y");

  const viewButtons = Array.from(document.querySelectorAll("[data-view]"));
  const meanButtons = Array.from(document.querySelectorAll("[data-means]"));
  const lineButtons = Array.from(document.querySelectorAll("[data-lines]"));
  const categoryButtons = Array.from(document.querySelectorAll("[data-category]"));

  if (!plot || !pointsLayer || !meansLayer || !linesLayer) return;

  const CATEGORY_NAMES = {
    1: "disgusting",
    2: "fearful",
    3: "inconsistent",
    4: "mirthful"
  };

  const COLORS = {
    disgusting: "#c95757",
    fearful: "#559a5b",
    inconsistent: "#4d73c9",
    mirthful: "#4f5660"
  };

  const state = {
    view: "human",
    means: true,
    lines: true,
    category: null
  };

  let atlasData = null;
  let records = [];

  function titleCase(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function scaleX(value) {
    return 8 + ((value - 1) / 8) * 84;
  }

  function scaleY(value) {
    return 92 - ((value - 1) / 8) * 84;
  }

  function renderTicks() {
    const xFrag = document.createDocumentFragment();
    const yFrag = document.createDocumentFragment();

    for (let value = 1; value <= 9; value += 1) {
      const xt = document.createElement("span");
      xt.className = "atlas-tick";
      xt.textContent = String(value);
      xt.style.left = `${scaleX(value) - 8} / 0.84%`;
      // Set exact percent after mapping the plotting region (8–92) to the tick container (0–100).
      xt.style.left = `${((scaleX(value) - 8) / 84) * 100}%`;
      xFrag.appendChild(xt);

      const yt = document.createElement("span");
      yt.className = "atlas-tick";
      yt.textContent = String(value);
      yt.style.bottom = `${((value - 1) / 8) * 100}%`;
      yFrag.appendChild(yt);
    }

    ticksX.replaceChildren(xFrag);
    ticksY.replaceChildren(yFrag);
  }

  function buildRecords(data) {
    return data.group.map((groupCode, index) => {
      const category = CATEGORY_NAMES[groupCode];
      const human = data.human[index];
      const gpt = data.gpt[index];
      return {
        id: `image-${String(index + 1).padStart(3, "0")}`,
        displayName: `Image ${String(index + 1).padStart(3, "0")}`,
        category,
        human: { valence: human[0], arousal: human[1] },
        gpt: { valence: gpt[0], arousal: gpt[1] },
        delta: { valence: gpt[0] - human[0], arousal: gpt[1] - human[1] }
      };
    });
  }

  function sourcesForView() {
    if (state.view === "human") return ["human"];
    if (state.view === "gpt") return ["gpt"];
    return ["human", "gpt"];
  }

  function pointMatchesCategory(record) {
    return !state.category || record.category === state.category;
  }

  function updateSelected(record, source) {
    if (!selectedItem) return;
    const sourceLabel = source === "human" ? "Human" : "ChatGPT";
    selectedItem.innerHTML = `
      <div class="selected-name">${escapeHtml(record.displayName)}</div>
      <div class="selected-meta">
        <span class="selected-tag">${sourceLabel}</span>
        <span class="selected-tag">${titleCase(record.category)}</span>
      </div>
      <div class="selected-comparison">
        <div><strong>Human</strong> · V ${record.human.valence.toFixed(2)} · A ${record.human.arousal.toFixed(2)}</div>
        <div><strong>ChatGPT</strong> · V ${record.gpt.valence.toFixed(2)} · A ${record.gpt.arousal.toFixed(2)}</div>
        <div><strong>GPT − Human</strong> · ΔV ${formatSigned(record.delta.valence)} · ΔA ${formatSigned(record.delta.arousal)}</div>
      </div>
    `;
  }

  function resetSelected() {
    if (!selectedItem) return;
    selectedItem.innerHTML = '<p class="atlas-muted">Hover over a point to compare Human and ChatGPT ratings for that image.</p>';
  }

  function formatSigned(value) {
    const rounded = value.toFixed(2);
    return value > 0 ? `+${rounded}` : rounded;
  }

  function showTooltip(point, record, source) {
    if (!tooltip) return;

    const rect = plot.getBoundingClientRect();
    const pointRect = point.getBoundingClientRect();
    const c = record[source];
    const sourceLabel = source === "human" ? "Human" : "ChatGPT";

    tooltip.innerHTML = `
      <strong>${escapeHtml(record.displayName)}</strong>
      <span>${sourceLabel} · ${titleCase(record.category)} · V ${c.valence.toFixed(2)} · A ${c.arousal.toFixed(2)}</span>
    `;
    tooltip.hidden = false;

    let left = pointRect.left - rect.left + pointRect.width + 8;
    let top = pointRect.top - rect.top + pointRect.height / 2;

    if (left > rect.width * 0.72) left -= tooltip.offsetWidth + 24;

    tooltip.style.left = `${Math.max(8, left)}px`;
    tooltip.style.top = `${Math.max(24, Math.min(rect.height - 24, top))}px`;
  }

  function hideTooltip() {
    if (tooltip) tooltip.hidden = true;
  }

  function makePoint(record, source) {
    const point = document.createElement("button");
    const coords = record[source];

    point.type = "button";
    point.className = `atlas-point ${source} ${record.category}`;
    point.style.left = `${scaleX(coords.valence)}%`;
    point.style.top = `${scaleY(coords.arousal)}%`;
    point.dataset.id = record.id;
    point.dataset.source = source;
    point.dataset.category = record.category;
    point.setAttribute(
      "aria-label",
      `${record.displayName}, ${source === "human" ? "Human" : "ChatGPT"}, ${titleCase(record.category)}, valence ${coords.valence.toFixed(2)}, arousal ${coords.arousal.toFixed(2)}`
    );

    const categoryMatch = pointMatchesCategory(record);
    point.classList.toggle("is-dimmed", !categoryMatch);
    point.classList.toggle("is-highlighted", Boolean(state.category) && categoryMatch);

    point.addEventListener("mouseenter", () => {
      updateSelected(record, source);
      showTooltip(point, record, source);
    });

    point.addEventListener("mouseleave", () => {
      hideTooltip();
      resetSelected();
    });

    point.addEventListener("focus", () => {
      updateSelected(record, source);
      showTooltip(point, record, source);
    });

    point.addEventListener("blur", () => {
      hideTooltip();
      resetSelected();
    });

    return point;
  }

  function renderPoints() {
    const frag = document.createDocumentFragment();
    const sources = sourcesForView();

    records.forEach((record) => {
      sources.forEach((source) => frag.appendChild(makePoint(record, source)));
    });

    pointsLayer.replaceChildren(frag);
  }

  function renderPairLines() {
    const NS = "http://www.w3.org/2000/svg";
    linesLayer.replaceChildren();

    if (state.view !== "overlay" || !state.lines) return;

    records.forEach((record) => {
      const line = document.createElementNS(NS, "line");
      line.setAttribute("x1", String(scaleX(record.human.valence)));
      line.setAttribute("y1", String(scaleY(record.human.arousal)));
      line.setAttribute("x2", String(scaleX(record.gpt.valence)));
      line.setAttribute("y2", String(scaleY(record.gpt.arousal)));
      line.setAttribute("class", "atlas-pair-line");
      line.style.stroke = COLORS[record.category];

      const categoryMatch = pointMatchesCategory(record);
      line.classList.toggle("is-dimmed", !categoryMatch);
      line.classList.toggle("is-highlighted", Boolean(state.category) && categoryMatch);
      linesLayer.appendChild(line);
    });
  }

  function makeMeanMarker(category, source, coords) {
    const marker = document.createElement("div");
    marker.className = `atlas-mean-marker ${source} ${category}`;
    marker.style.left = `${scaleX(coords[0])}%`;
    marker.style.top = `${scaleY(coords[1])}%`;

    const categoryMatch = !state.category || category === state.category;
    marker.classList.toggle("is-dimmed", !categoryMatch);
    return marker;
  }

  function renderMeans() {
    meansLayer.replaceChildren();
    if (!state.means || !atlasData) return;

    const frag = document.createDocumentFragment();
    const sources = sourcesForView();

    Object.entries(atlasData.category_means).forEach(([category, summary]) => {
      sources.forEach((source) => {
        frag.appendChild(makeMeanMarker(category, source, summary[source]));
      });
    });

    meansLayer.appendChild(frag);
  }

  function updateCategorySummary() {
    if (!categorySummary || !atlasData) return;

    if (!state.category) {
      categorySummary.innerHTML = '<p class="atlas-muted">Select a category to compare its mean position across sources.</p>';
      return;
    }

    const s = atlasData.category_means[state.category];
    categorySummary.innerHTML = `
      <div class="atlas-summary-title">${titleCase(state.category)} <span class="atlas-muted">(n = ${s.n})</span></div>
      <div class="atlas-summary-grid">
        <strong>Human</strong><span>V ${s.human[0].toFixed(2)} · A ${s.human[1].toFixed(2)}</span>
        <strong>ChatGPT</strong><span>V ${s.gpt[0].toFixed(2)} · A ${s.gpt[1].toFixed(2)}</span>
      </div>
      <div class="atlas-delta">GPT − Human: ΔV ${formatSigned(s.difference[0])} · ΔA ${formatSigned(s.difference[1])}</div>
    `;
  }

  function updateControls() {
    viewButtons.forEach((button) => {
      const active = button.dataset.view === state.view;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    meanButtons.forEach((button) => {
      const active = (button.dataset.means === "on") === state.means;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    lineButtons.forEach((button) => {
      const active = (button.dataset.lines === "on") === state.lines;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
      button.disabled = state.view !== "overlay";
    });

    categoryButtons.forEach((button) => {
      const active = button.dataset.category === state.category;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    if (plotTitle) {
      plotTitle.textContent =
        state.view === "human" ? "Humans" :
        state.view === "gpt" ? "ChatGPT" :
        "Human ↔ ChatGPT Overlay";
    }
  }

  function renderAll() {
    updateControls();
    renderPairLines();
    renderPoints();
    renderMeans();
    updateCategorySummary();
    hideTooltip();
    resetSelected();
  }

  viewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.view = button.dataset.view;
      renderAll();
    });
  });

  meanButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.means = button.dataset.means === "on";
      renderAll();
    });
  });

  lineButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (button.disabled) return;
      state.lines = button.dataset.lines === "on";
      renderAll();
    });
  });

  categoryButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const selected = button.dataset.category;
      state.category = state.category === selected ? null : selected;
      renderAll();
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.category) {
      state.category = null;
      renderAll();
    }
  });

  renderTicks();

  fetch(DATA_URL)
    .then((response) => {
      if (!response.ok) throw new Error(`Failed to load ${DATA_URL}: ${response.status}`);
      return response.json();
    })
    .then((data) => {
      atlasData = data;
      records = buildRecords(data);
      renderAll();
      plot.classList.add("atlas-data-loaded");
    })
    .catch((error) => {
      console.error(error);
      const message = document.createElement("div");
      message.className = "atlas-load-error";
      message.textContent = "The affective image ratings could not be loaded.";
      pointsLayer.appendChild(message);
    });

  document.documentElement.classList.add("atlas-ready");
})();
