(() => {
  "use strict";

  const DATA_URL = "atlas-data.json";
  const plot = document.getElementById("mds-plot");
  const layer = document.getElementById("atlas-points-layer");

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

  function scaleX(x) {
    return ((x - bounds.xMin) / (bounds.xMax - bounds.xMin)) * 88 + 6;
  }

  function scaleY(y) {
    return (1 - (y - bounds.yMin) / (bounds.yMax - bounds.yMin)) * 88 + 6;
  }

  function makePoint(stimulus) {
    const point = document.createElement("div");
    const category = categoryClass[stimulus.category] || "unknown";
    const modality = stimulus.modality === "music" ? "music" : "taste";
    const c = stimulus.display_coordinates;

    point.className = `atlas-point ${category} ${modality}`;
    point.style.left = `${scaleX(c.valence)}%`;
    point.style.top = `${scaleY(c.arousal)}%`;
    point.dataset.name = stimulus.display_name;
    point.dataset.modality = stimulus.modality;
    point.dataset.category = stimulus.category;
    point.title = `${stimulus.display_name} · ${stimulus.modality} · ${stimulus.category}`;
    return point;
  }

  fetch(DATA_URL)
    .then((response) => {
      if (!response.ok) throw new Error(`Failed to load ${DATA_URL}`);
      return response.json();
    })
    .then((data) => {
      layer.replaceChildren(...data.stimuli.map(makePoint));
      plot.classList.add("atlas-data-loaded");
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
