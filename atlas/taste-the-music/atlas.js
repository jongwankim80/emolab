(() => {
  "use strict";

  const DATA_URL = "atlas-data.json";
  const plot = document.getElementById("mds-plot");
  const layer = document.getElementById("atlas-points-layer");
  const tooltip = document.getElementById("atlas-tooltip");
  const selectedItem = document.getElementById("atlas-selected-item");
  const modalityButtons = Array.from(document.querySelectorAll("[data-modality]"));
  const categoryButtons = Array.from(document.querySelectorAll("[data-category]"));

  if (!plot || !layer) return;

  const categoryClass = {
    sweet: "sweet",
    bitter: "bitter",
    sour: "sour",
    salty: "salty"
  };

  const bounds = {
    xMin: -2.05,
    xMax: 2.05,
    yMin: -1.75,
    yMax: 1.75
  };

  const state = {
    modality: "both",
    category: null
  };

  let stimuli = [];

  function scaleX(x) {
    return ((x - bounds.xMin) / (bounds.xMax - bounds.xMin)) * 88 + 6;
  }

  function scaleY(y) {
    return (1 - (y - bounds.yMin) / (bounds.yMax - bounds.yMin)) * 88 + 6;
  }

  function titleCase(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function updateSelected(stimulus) {
    if (!selectedItem) return;
    const c = stimulus.display_coordinates;
    selectedItem.innerHTML = `
      <div class="selected-name">${stimulus.display_name}</div>
      <div class="selected-meta">
        <span class="selected-tag">${titleCase(stimulus.modality)}</span>
        <span class="selected-tag">${titleCase(stimulus.category)}</span>
      </div>
      <div class="selected-coords">Valence ${c.valence.toFixed(2)} · Arousal ${c.arousal.toFixed(2)}</div>
    `;
  }

  function resetSelected() {
    if (!selectedItem) return;
    selectedItem.innerHTML = '<p class="atlas-muted">Hover over a stimulus to see its details here.</p>';
  }

  function positionTooltip(point, stimulus) {
    if (!tooltip) return;
    const plotRect = plot.getBoundingClientRect();
    const pointRect = point.getBoundingClientRect();
    tooltip.innerHTML = `<strong>${stimulus.display_name}</strong><span>${titleCase(stimulus.modality)} · ${titleCase(stimulus.category)}</span>`;
    tooltip.hidden = false;

    let x = pointRect.left - plotRect.left + pointRect.width;
    let y = pointRect.top - plotRect.top + pointRect.height / 2;

    if (x > plotRect.width * 0.72) {
      x = pointRect.left - plotRect.left - tooltip.offsetWidth - 16;
    }

    tooltip.style.left = `${Math.max(8, x)}px`;
    tooltip.style.top = `${Math.max(22, Math.min(plotRect.height - 22, y))}px`;
  }

  function hideTooltip() {
    if (tooltip) tooltip.hidden = true;
  }

  function pointMatchesModality(point) {
    return state.modality === "both" || point.dataset.modality === state.modality;
  }

  function applyFilters() {
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
      updateSelected(stimulus);
      positionTooltip(point, stimulus);
    });

    point.addEventListener("mouseleave", () => {
      hideTooltip();
      resetSelected();
    });

    point.addEventListener("focus", () => {
      updateSelected(stimulus);
      positionTooltip(point, stimulus);
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
