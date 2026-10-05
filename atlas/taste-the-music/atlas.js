(() => {
  "use strict";

  const DATA_URL = "atlas-data.json";
  const plot = document.getElementById("mds-plot");
  const layer = document.getElementById("atlas-points-layer");
  const vectorLayer = document.getElementById("atlas-vectors-layer");
  const tooltip = document.getElementById("atlas-tooltip");
  const selectedItem = document.getElementById("atlas-selected-item");
  const modalityButtons = Array.from(document.querySelectorAll("[data-modality]"));
  const categoryButtons = Array.from(document.querySelectorAll("[data-category]"));
  const vectorButtons = Array.from(document.querySelectorAll("[data-vectors]"));

  if (!plot || !layer || !vectorLayer) return;

  const categoryClass = {
    sweet: "sweet",
    bitter: "bitter",
    sour: "sour",
    salty: "salty"
  };

  // A deliberately compact subset for the default display.
  // These are published vector-fitting results, not a new statistical selection.
  const KEY_VECTOR_IDS = new Set([
    "sweet", "bitter", "sour", "salty",
    "enjoyment", "anger", "liking", "bored"
  ]);

  const bounds = {
    xMin: -2.05,
    xMax: 2.05,
    yMin: -1.75,
    yMax: 1.75
  };

  const state = {
    modality: "both",
    category: null,
    vectors: "key"
  };

  let stimuli = [];
  let vectors = [];

  function scaleX(x) {
    return ((x - bounds.xMin) / (bounds.xMax - bounds.xMin)) * 88 + 6;
  }

  function scaleY(y) {
    return (1 - (y - bounds.yMin) / (bounds.yMax - bounds.yMin)) * 88 + 6;
  }

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

  function updateSelectedStimulus(stimulus) {
    if (!selectedItem) return;
    const c = stimulus.display_coordinates;
    selectedItem.innerHTML = `
      <div class="selected-name">${escapeHtml(stimulus.display_name)}</div>
      <div class="selected-meta">
        <span class="selected-tag">${titleCase(stimulus.modality)}</span>
        <span class="selected-tag">${titleCase(stimulus.category)}</span>
      </div>
      <div class="selected-coords">Valence ${c.valence.toFixed(2)} · Arousal ${c.arousal.toFixed(2)}</div>
    `;
  }

  function updateSelectedVector(vector) {
    if (!selectedItem) return;
    const endpoint = vector.endpoints_display.valence_arousal;
    selectedItem.innerHTML = `
      <div class="selected-name">${escapeHtml(vector.label)}</div>
      <div class="selected-meta">
        <span class="selected-tag">Fitted vector</span>
        <span class="selected-tag">${titleCase(vector.group)}</span>
      </div>
      <div class="selected-coords">R² = ${vector.r2.toFixed(2)} · endpoint (${endpoint[0].toFixed(2)}, ${endpoint[1].toFixed(2)})</div>
      <div class="atlas-vector-note">The arrow points toward higher ratings on this scale.</div>
    `;
  }

  function resetSelected() {
    if (!selectedItem) return;
    selectedItem.innerHTML = '<p class="atlas-muted">Hover over a stimulus or vector to see its details here.</p>';
  }

  function positionTooltipAt(x, y, title, meta) {
    if (!tooltip) return;
    const plotRect = plot.getBoundingClientRect();
    tooltip.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(meta)}</span>`;
    tooltip.hidden = false;

    let left = x;
    let top = y;

    if (left > plotRect.width * 0.72) {
      left -= tooltip.offsetWidth + 20;
    } else {
      left += 10;
    }

    tooltip.style.left = `${Math.max(8, left)}px`;
    tooltip.style.top = `${Math.max(22, Math.min(plotRect.height - 22, top))}px`;
  }

  function positionTooltipForPoint(point, stimulus) {
    const plotRect = plot.getBoundingClientRect();
    const pointRect = point.getBoundingClientRect();
    positionTooltipAt(
      pointRect.left - plotRect.left + pointRect.width,
      pointRect.top - plotRect.top + pointRect.height / 2,
      stimulus.display_name,
      `${titleCase(stimulus.modality)} · ${titleCase(stimulus.category)}`
    );
  }

  function positionTooltipForVector(vector) {
    const endpoint = vector.endpoints_display.valence_arousal;
    const plotRect = plot.getBoundingClientRect();
    const x = (scaleX(endpoint[0]) / 100) * plotRect.width;
    const y = (scaleY(endpoint[1]) / 100) * plotRect.height;
    positionTooltipAt(
      x,
      y,
      vector.label,
      `Fitted vector · R² ${vector.r2.toFixed(2)}`
    );
  }

  function hideTooltip() {
    if (tooltip) tooltip.hidden = true;
  }

  function pointMatchesModality(point) {
    return state.modality === "both" || point.dataset.modality === state.modality;
  }

  function applyPointFilters() {
    const points = Array.from(layer.querySelectorAll(".atlas-point"));

    points.forEach((point) => {
      const modalityMatch = pointMatchesModality(point);
      const categoryMatch = !state.category || point.dataset.category === state.category;

      point.classList.toggle("is-hidden", !modalityMatch);
      point.classList.toggle("is-dimmed", modalityMatch && !categoryMatch);
      point.classList.toggle("is-highlighted", modalityMatch && Boolean(state.category) && categoryMatch);
    });

    modalityButtons.forEach((button) => {
      const active = button.dataset.modality === state.modality;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    categoryButtons.forEach((button) => {
      const active = button.dataset.category === state.category;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function vectorShouldShow(vector) {
    if (state.vectors === "off") return false;
    if (state.vectors === "all") return true;
    return KEY_VECTOR_IDS.has(vector.id);
  }

  function renderVectors() {
    const NS = "http://www.w3.org/2000/svg";
    vectorLayer.replaceChildren();

    const defs = document.createElementNS(NS, "defs");
    const marker = document.createElementNS(NS, "marker");
    marker.setAttribute("id", "atlas-arrow");
    marker.setAttribute("markerWidth", "7");
    marker.setAttribute("markerHeight", "7");
    marker.setAttribute("refX", "5.8");
    marker.setAttribute("refY", "3.5");
    marker.setAttribute("orient", "auto");
    marker.setAttribute("markerUnits", "strokeWidth");

    const arrow = document.createElementNS(NS, "path");
    arrow.setAttribute("d", "M 0 0 L 7 3.5 L 0 7 z");
    arrow.setAttribute("class", "atlas-vector-arrowhead");
    marker.appendChild(arrow);
    defs.appendChild(marker);
    vectorLayer.appendChild(defs);

    if (state.vectors === "off") return;

    const origin = document.createElementNS(NS, "circle");
    origin.setAttribute("cx", "50");
    origin.setAttribute("cy", "50");
    origin.setAttribute("r", "0.45");
    origin.setAttribute("class", "atlas-vector-origin");
    vectorLayer.appendChild(origin);

    vectors.filter(vectorShouldShow).forEach((vector) => {
      const endpoint = vector.endpoints_display.valence_arousal;
      const x2 = scaleX(endpoint[0]);
      const y2 = scaleY(endpoint[1]);

      const group = document.createElementNS(NS, "g");
      group.setAttribute("class", `atlas-vector ${vector.group}`);
      group.setAttribute("tabindex", "0");

      const hit = document.createElementNS(NS, "line");
      hit.setAttribute("x1", "50");
      hit.setAttribute("y1", "50");
      hit.setAttribute("x2", String(x2));
      hit.setAttribute("y2", String(y2));
      hit.setAttribute("class", "atlas-vector-hit");

      const line = document.createElementNS(NS, "line");
      line.setAttribute("x1", "50");
      line.setAttribute("y1", "50");
      line.setAttribute("x2", String(x2));
      line.setAttribute("y2", String(y2));
      line.setAttribute("class", "atlas-vector-line");
      line.setAttribute("marker-end", "url(#atlas-arrow)");

      const label = document.createElementNS(NS, "text");
      const dx = x2 >= 50 ? 1.3 : -1.3;
      const anchor = x2 >= 50 ? "start" : "end";
      label.setAttribute("x", String(x2 + dx));
      label.setAttribute("y", String(y2 - 0.8));
      label.setAttribute("text-anchor", anchor);
      label.setAttribute("class", "atlas-vector-label");
      label.textContent = vector.label;

      group.append(hit, line, label);
      group.addEventListener("mouseenter", () => {
        updateSelectedVector(vector);
        positionTooltipForVector(vector);
      });
      group.addEventListener("mouseleave", () => {
        hideTooltip();
        resetSelected();
      });
      group.addEventListener("focus", () => {
        updateSelectedVector(vector);
        positionTooltipForVector(vector);
      });
      group.addEventListener("blur", () => {
        hideTooltip();
        resetSelected();
      });

      vectorLayer.appendChild(group);
    });
  }

  function applyFilters() {
    applyPointFilters();
    renderVectors();

    vectorButtons.forEach((button) => {
      const active = button.dataset.vectors === state.vectors;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    hideTooltip();
    resetSelected();
  }

  function makePoint(stimulus) {
    const point = document.createElement("button");
    const category = categoryClass[stimulus.category] || "unknown";
    const modality = stimulus.modality === "music" ? "music" : "taste";
    const c = stimulus.display_coordinates;

    point.type = "button";
    point.className = `atlas-point ${category} ${modality}`;
    point.style.left = `${scaleX(c.valence)}%`;
    point.style.top = `${scaleY(c.arousal)}%`;
    point.dataset.id = stimulus.id;
    point.dataset.name = stimulus.display_name;
    point.dataset.modality = stimulus.modality;
    point.dataset.category = stimulus.category;
    point.setAttribute("aria-label", `${stimulus.display_name}, ${titleCase(stimulus.modality)}, ${titleCase(stimulus.category)}`);

    point.addEventListener("mouseenter", () => {
      updateSelectedStimulus(stimulus);
      positionTooltipForPoint(point, stimulus);
    });

    point.addEventListener("mouseleave", () => {
      hideTooltip();
      resetSelected();
    });

    point.addEventListener("focus", () => {
      updateSelectedStimulus(stimulus);
      positionTooltipForPoint(point, stimulus);
    });

    point.addEventListener("blur", () => {
      hideTooltip();
      resetSelected();
    });

    return point;
  }

  modalityButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.modality = button.dataset.modality;
      applyFilters();
    });
  });

  categoryButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const chosen = button.dataset.category;
      state.category = state.category === chosen ? null : chosen;
      applyFilters();
    });
  });

  vectorButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.vectors = button.dataset.vectors;
      applyFilters();
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.category) {
      state.category = null;
      applyFilters();
    }
  });

  fetch(DATA_URL)
    .then((response) => {
      if (!response.ok) throw new Error(`Failed to load ${DATA_URL}`);
      return response.json();
    })
    .then((data) => {
      stimuli = data.stimuli;
      vectors = data.vectors;
      layer.replaceChildren(...stimuli.map(makePoint));
      plot.classList.add("atlas-data-loaded");
      applyFilters();
    })
    .catch((error) => {
      console.error(error);
      const message = document.createElement("div");
      message.className = "atlas-load-error";
      message.textContent = "The published MDS coordinates could not be loaded.";
      layer.appendChild(message);
    });

  document.documentElement.classList.add("atlas-ready");
})();
