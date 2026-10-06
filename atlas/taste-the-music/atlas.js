(() => {
  "use strict";

  const DATA_URL = "atlas-data.json";
  const plot2d = document.getElementById("mds-plot");
  const plot3d = document.getElementById("mds-plot-3d");
  const layer = document.getElementById("atlas-points-layer");
  const vectorLayer = document.getElementById("atlas-vectors-layer");
  const tooltip = document.getElementById("atlas-tooltip");
  const selectedItem = document.getElementById("atlas-selected-item");
  const plotTitle = document.getElementById("atlas-plot-title");
  const viewBadge = document.getElementById("atlas-view-badge");
  const axisX = document.getElementById("atlas-axis-x");
  const axisY = document.getElementById("atlas-axis-y");
  const vector3dNote = document.getElementById("atlas-vector-3d-note");

  const viewButtons = Array.from(document.querySelectorAll("[data-view]"));
  const modalityButtons = Array.from(document.querySelectorAll("[data-modality]"));
  const categoryButtons = Array.from(document.querySelectorAll("[data-category]"));
  const vectorButtons = Array.from(document.querySelectorAll("[data-vectors]"));
  const legendIcons2d = Array.from(document.querySelectorAll(".legend-icon-2d"));
  const legendShapes3d = Array.from(document.querySelectorAll(".legend-shape-3d"));

  if (!plot2d || !plot3d || !layer || !vectorLayer) return;

  const COLORS = {
    sweet: "#c48a3a",
    bitter: "#8b4f5b",
    sour: "#668c5e",
    salty: "#4f7895"
  };

  const KEY_VECTOR_IDS = new Set([
    "sweet", "bitter", "sour", "salty",
    "enjoyment", "anger", "liking", "bored"
  ]);

  const VIEWS = {
    "valence-arousal": {
      title: "Valence × Arousal",
      x: "valence",
      y: "arousal",
      xLabel: "Valence",
      yLabel: "Arousal",
      endpoint: "valence_arousal",
      bounds: { xMin: -2.05, xMax: 2.05, yMin: -1.75, yMax: 1.75 }
    },
    "modality-valence": {
      title: "Modality × Valence",
      x: "modality",
      y: "valence",
      xLabel: "Modality",
      yLabel: "Valence",
      endpoint: "modality_valence",
      bounds: { xMin: -1.4, xMax: 1.4, yMin: -2.05, yMax: 2.05 }
    },
    "modality-arousal": {
      title: "Modality × Arousal",
      x: "modality",
      y: "arousal",
      xLabel: "Modality",
      yLabel: "Arousal",
      endpoint: "modality_arousal",
      bounds: { xMin: -1.4, xMax: 1.4, yMin: -1.75, yMax: 1.75 }
    }
  };

  const state = {
    view: "valence-arousal",
    modality: "both",
    category: null,
    vectors: "key"
  };

  let stimuli = [];
  let vectors = [];

  function currentView() {
    return VIEWS[state.view] || VIEWS["valence-arousal"];
  }

  function scaleX(x) {
    const b = currentView().bounds;
    return ((x - b.xMin) / (b.xMax - b.xMin)) * 88 + 6;
  }

  function scaleY(y) {
    const b = currentView().bounds;
    return (1 - (y - b.yMin) / (b.yMax - b.yMin)) * 88 + 6;
  }

  function modalityIconMarkup(modality) {
    if (modality === "music") {
      return `
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M14.2 4.2v9.9a3.8 3.8 0 0 0-2.5-.4c-2 .3-3.4 1.6-3.2 3.1.2 1.5 1.9 2.4 3.9 2.1 1.8-.3 3.1-1.4 3.1-2.9V8.1l4-1.1V4.2l-5.3 1.5V4.2Z"></path>
        </svg>
      `;
    }

    return `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path class="tongue-mouth" d="M4.5 9.2C6.7 6.7 9.2 5.5 12 5.5s5.3 1.2 7.5 3.7c-2.2 2.2-4.7 3.3-7.5 3.3s-5.3-1.1-7.5-3.3Z"></path>
        <path d="M8.3 10.8v3c0 3.6 1.6 5.7 3.7 5.7s3.7-2.1 3.7-5.7v-3c-1.1.7-2.3 1-3.7 1s-2.6-.3-3.7-1Z"></path>
        <path class="tongue-line" d="M12 12.4v6.1"></path>
      </svg>
    `;
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

  function coordText(stimulus) {
    if (state.view === "3d") {
      const c = stimulus.display_coordinates;
      return `Modality ${c.modality.toFixed(2)} · Valence ${c.valence.toFixed(2)} · Arousal ${c.arousal.toFixed(2)}`;
    }

    const cfg = currentView();
    const c = stimulus.display_coordinates;
    return `${cfg.xLabel} ${c[cfg.x].toFixed(2)} · ${cfg.yLabel} ${c[cfg.y].toFixed(2)}`;
  }

  function updateSelectedStimulus(stimulus) {
    if (!selectedItem) return;
    selectedItem.innerHTML = `
      <div class="selected-name">${escapeHtml(stimulus.display_name)}</div>
      <div class="selected-meta">
        <span class="selected-tag">${titleCase(stimulus.modality)}</span>
        <span class="selected-tag">${titleCase(stimulus.category)}</span>
      </div>
      <div class="selected-coords">${coordText(stimulus)}</div>
    `;
  }

  function vectorEndpoint3D(vector) {
    const b = vector.beta_source;
    const displayBeta = [b.modality, -b.valence, -b.arousal];
    const norm = Math.hypot(...displayBeta) || 1;
    return displayBeta.map((value) => vector.r2 * value / norm);
  }

  function updateSelectedVector(vector) {
    if (!selectedItem) return;

    if (state.view === "3d") {
      const endpoint = vectorEndpoint3D(vector);
      selectedItem.innerHTML = `
        <div class="selected-name">${escapeHtml(vector.label)}</div>
        <div class="selected-meta">
          <span class="selected-tag">Fitted vector</span>
          <span class="selected-tag">${titleCase(vector.group)}</span>
        </div>
        <div class="selected-coords">R² = ${vector.r2.toFixed(2)} · 3D endpoint (${endpoint[0].toFixed(2)}, ${endpoint[1].toFixed(2)}, ${endpoint[2].toFixed(2)})</div>
        <div class="atlas-vector-note">The arrow points toward higher ratings on this scale.</div>
      `;
      return;
    }

    const cfg = currentView();
    const endpoint = vector.endpoints_display[cfg.endpoint];
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
    if (!tooltip || state.view === "3d") return;
    const plotRect = plot2d.getBoundingClientRect();
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
    const plotRect = plot2d.getBoundingClientRect();
    const pointRect = point.getBoundingClientRect();
    positionTooltipAt(
      pointRect.left - plotRect.left + pointRect.width,
      pointRect.top - plotRect.top + pointRect.height / 2,
      stimulus.display_name,
      `${titleCase(stimulus.modality)} · ${titleCase(stimulus.category)}`
    );
  }

  function positionTooltipForVector(vector) {
    if (state.view === "3d") return;
    const cfg = currentView();
    const endpoint = vector.endpoints_display[cfg.endpoint];
    const plotRect = plot2d.getBoundingClientRect();
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

  function position2DPoints() {
    if (state.view === "3d") return;
    const cfg = currentView();
    const byId = new Map(stimuli.map((s) => [s.id, s]));

    layer.querySelectorAll(".atlas-point").forEach((point) => {
      const stimulus = byId.get(point.dataset.id);
      if (!stimulus) return;
      const c = stimulus.display_coordinates;
      point.style.left = `${scaleX(c[cfg.x])}%`;
      point.style.top = `${scaleY(c[cfg.y])}%`;
    });
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
    vectorLayer.replaceChildren();
    if (state.view === "3d" || state.vectors === "off") return;

    const NS = "http://www.w3.org/2000/svg";
    const cfg = currentView();

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

    const origin = document.createElementNS(NS, "circle");
    origin.setAttribute("cx", String(scaleX(0)));
    origin.setAttribute("cy", String(scaleY(0)));
    origin.setAttribute("r", "0.45");
    origin.setAttribute("class", "atlas-vector-origin");
    vectorLayer.appendChild(origin);

    vectors.filter(vectorShouldShow).forEach((vector) => {
      const endpoint = vector.endpoints_display[cfg.endpoint];
      if (!endpoint) return;

      const x1 = scaleX(0);
      const y1 = scaleY(0);
      const x2 = scaleX(endpoint[0]);
      const y2 = scaleY(endpoint[1]);

      const group = document.createElementNS(NS, "g");
      group.setAttribute("class", `atlas-vector ${vector.group}`);
      group.setAttribute("tabindex", "0");

      const hit = document.createElementNS(NS, "line");
      hit.setAttribute("x1", String(x1));
      hit.setAttribute("y1", String(y1));
      hit.setAttribute("x2", String(x2));
      hit.setAttribute("y2", String(y2));
      hit.setAttribute("class", "atlas-vector-hit");

      const line = document.createElementNS(NS, "line");
      line.setAttribute("x1", String(x1));
      line.setAttribute("y1", String(y1));
      line.setAttribute("x2", String(x2));
      line.setAttribute("y2", String(y2));
      line.setAttribute("class", "atlas-vector-line");
      line.setAttribute("marker-end", "url(#atlas-arrow)");

      const label = document.createElementNS(NS, "text");
      const dx = x2 >= x1 ? 1.3 : -1.3;
      const anchor = x2 >= x1 ? "start" : "end";
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

  function render3D() {
    if (state.view !== "3d") return;

    if (!window.Plotly) {
      plot3d.innerHTML = '<div class="atlas-3d-error">The 3D viewer could not be loaded. The three 2D projections remain available.</div>';
      return;
    }

    const filtered = stimuli.filter((s) => state.modality === "both" || s.modality === state.modality);
    const traces = [];

    ["taste", "music"].forEach((modality) => {
      ["sweet", "bitter", "sour", "salty"].forEach((category) => {
        const items = filtered.filter((s) => s.modality === modality && s.category === category);
        if (!items.length) return;

        traces.push({
          type: "scatter3d",
          mode: "markers",
          name: `${titleCase(modality)} · ${titleCase(category)}`,
          x: items.map((s) => s.display_coordinates.modality),
          y: items.map((s) => s.display_coordinates.valence),
          z: items.map((s) => s.display_coordinates.arousal),
          text: items.map((s) => s.display_name),
          customdata: items.map((s) => [s.id, s.modality, s.category]),
          hovertemplate: "<b>%{text}</b><br>%{customdata[1]} · %{customdata[2]}<extra></extra>",
          marker: {
            size: window.matchMedia("(max-width: 760px)").matches ? 4.5 : 7,
            color: COLORS[category],
            symbol: modality === "taste" ? "circle" : "diamond",
            opacity: !state.category || state.category === category ? 0.95 : 0.13,
            line: { color: "#ffffff", width: 1 }
          },
          showlegend: false
        });
      });
    });

    if (state.vectors !== "off") {
      const vectorColor = (vector) => {
        if (vector.group === "taste") return "#245f55";
        if (vector.group === "evaluation") return "#59636d";
        return "#7a8792";
      };

      vectors.filter(vectorShouldShow).forEach((vector) => {
        const endpoint = vectorEndpoint3D(vector);
        const color = vectorColor(vector);
        const length = Math.hypot(...endpoint) || 1;
        const coneScale = 0.14;

        traces.push({
          type: "scatter3d",
          mode: "lines+text",
          x: [0, endpoint[0]],
          y: [0, endpoint[1]],
          z: [0, endpoint[2]],
          text: ["", vector.label],
          textposition: "top center",
          line: { color, width: vector.group === "evaluation" ? 3 : 2.5, dash: "dash" },
          textfont: { color, size: 10 },
          meta: { kind: "vector", id: vector.id },
          hovertemplate: "<b>%{text}</b><br>Fitted vector<extra></extra>",
          showlegend: false
        });

        traces.push({
          type: "cone",
          x: [endpoint[0]],
          y: [endpoint[1]],
          z: [endpoint[2]],
          u: [endpoint[0] / length * coneScale],
          v: [endpoint[1] / length * coneScale],
          w: [endpoint[2] / length * coneScale],
          anchor: "tip",
          sizemode: "absolute",
          sizeref: 0.11,
          colorscale: [[0, color], [1, color]],
          showscale: false,
          hoverinfo: "skip",
          showlegend: false
        });
      });
    }

    const layout = {
      margin: { l: 0, r: 0, t: 0, b: 0 },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      scene: {
        bgcolor: "#fcfdfc",
        aspectmode: "cube",
        xaxis: { title: "Modality", range: [-1.4, 1.4], zeroline: true, gridcolor: "#e8ecea", showspikes: true, spikecolor: "#c83d3d", spikethickness: 3, spikesides: false },
        yaxis: { title: "Valence", range: [-2.05, 2.05], zeroline: true, gridcolor: "#e8ecea", showspikes: true, spikecolor: "#c83d3d", spikethickness: 3, spikesides: false },
        zaxis: { title: "Arousal", range: [-1.75, 1.75], zeroline: true, gridcolor: "#e8ecea", showspikes: true, spikecolor: "#c83d3d", spikethickness: 3, spikesides: false },
        camera: { eye: { x: 1.35, y: 1.35, z: 1.05 } },
        dragmode: "orbit"
      },
      hoverlabel: {
        bgcolor: "#ffffff",
        bordercolor: "#dfe5e2",
        font: { color: "#18212b", size: 12 }
      }
    };

    const config = {
      responsive: true,
      displaylogo: false,
      scrollZoom: false
    };

    window.Plotly.react(plot3d, traces, layout, config).then(() => {
      if (typeof plot3d.removeAllListeners === "function") {
        plot3d.removeAllListeners("plotly_hover");
        plot3d.removeAllListeners("plotly_unhover");
      }
      plot3d.on("plotly_hover", (event) => {
        const point = event?.points?.[0];
        const meta = point?.data?.meta;

        if (meta?.kind === "vector") {
          const vector = vectors.find((v) => v.id === meta.id);
          if (vector) updateSelectedVector(vector);
          return;
        }

        const id = point?.customdata?.[0];
        const stimulus = stimuli.find((s) => s.id === id);
        if (stimulus) updateSelectedStimulus(stimulus);
      });
      plot3d.on("plotly_unhover", resetSelected);
    });
  }

  function updateViewUI() {
    const is3d = state.view === "3d";

    viewButtons.forEach((button) => {
      const active = button.dataset.view === state.view;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    vectorButtons.forEach((button) => {
      button.disabled = false;
      button.title = "";
    });

    if (vector3dNote) vector3dNote.hidden = !is3d;

    legendIcons2d.forEach((marker) => { marker.hidden = is3d; });
    legendShapes3d.forEach((marker) => { marker.hidden = !is3d; });

    plot2d.hidden = is3d;
    plot3d.hidden = !is3d;

    if (is3d) {
      if (plotTitle) plotTitle.textContent = "Modality × Valence × Arousal";
      if (viewBadge) viewBadge.textContent = "3D";
      render3D();
      return;
    }

    const cfg = currentView();
    if (plotTitle) plotTitle.textContent = cfg.title;
    if (viewBadge) viewBadge.textContent = "2D";
    if (axisX) axisX.textContent = cfg.xLabel;
    if (axisY) axisY.textContent = cfg.yLabel;
    plot2d.setAttribute("aria-label", `${cfg.xLabel} by ${cfg.yLabel} multidimensional scaling plot of 16 taste and music stimuli`);
    position2DPoints();
    applyPointFilters();
    renderVectors();
  }

  function applyFilters() {
    if (state.view === "3d") {
      render3D();
    } else {
      applyPointFilters();
      renderVectors();
    }

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
    const modality = stimulus.modality === "music" ? "music" : "taste";

    point.type = "button";
    point.className = `atlas-point ${stimulus.category} ${modality}`;
    point.innerHTML = modalityIconMarkup(stimulus.modality);
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

  viewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.view = button.dataset.view;
      hideTooltip();
      resetSelected();
      updateViewUI();
    });
  });

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
      if (button.disabled) return;
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
      if (!response.ok) throw new Error(`Failed to load ${DATA_URL}: ${response.status}`);
      return response.json();
    })
    .then((data) => {
      stimuli = data.stimuli;
      vectors = data.vectors;
      layer.replaceChildren(...stimuli.map(makePoint));
      plot2d.classList.add("atlas-data-loaded");
      position2DPoints();
      updateViewUI();
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
