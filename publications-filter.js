(() => {
  const initPublicationFilters = () => {
    const tools = document.querySelector(".publication-tools");
    if (!tools) return;

    const cards = Array.from(document.querySelectorAll(".pub-card:not(.compact)"));
    const sections = Array.from(document.querySelectorAll(".pub-year"));
    const search = document.getElementById("publication-search");
    const year = document.getElementById("publication-year");
    const reset = document.getElementById("publication-reset");
    const count = document.getElementById("publication-count");
    const noResults = document.getElementById("publication-no-results");
    const categoryButtons = Array.from(document.querySelectorAll("[data-pub-category]"));
    const copyButtons = Array.from(document.querySelectorAll(".pub-copy-btn"));

    let activeCategory = "all";

    const normalize = (value) => (value || "").toLocaleLowerCase().trim();

    const applyFilters = () => {
      const query = normalize(search ? search.value : "");
      const activeYear = year ? year.value : "all";
      let visibleCount = 0;

      cards.forEach((card) => {
        const matchesCategory =
          activeCategory === "all" || card.dataset.category === activeCategory;
        const matchesYear =
          activeYear === "all" || card.dataset.year === activeYear;
        const matchesSearch =
          query === "" || normalize(card.textContent).includes(query);
        const visible = matchesCategory && matchesYear && matchesSearch;

        card.hidden = !visible;
        if (visible) visibleCount += 1;
      });

      sections.forEach((section) => {
        const hasVisibleCard = Array.from(
          section.querySelectorAll(".pub-card:not(.compact)")
        ).some((card) => !card.hidden);
        section.hidden = !hasVisibleCard;
      });

      if (count) {
        count.textContent =
          visibleCount === cards.length
            ? `Showing ${visibleCount} publications`
            : `Showing ${visibleCount} of ${cards.length} publications`;
      }
      if (noResults) noResults.hidden = visibleCount !== 0;
    };

    categoryButtons.forEach((button) => {
      button.addEventListener("click", () => {
        activeCategory = button.dataset.pubCategory || "all";
        categoryButtons.forEach((item) => {
          item.setAttribute(
            "aria-pressed",
            item === button ? "true" : "false"
          );
        });
        applyFilters();
      });
    });

    if (search) search.addEventListener("input", applyFilters);
    if (year) year.addEventListener("change", applyFilters);

    const copyText = async (button) => {
      const text = button.dataset.copyText || "";
      const item = button.closest(".pub-citation-actions");
      const status = item ? item.querySelector(".pub-copy-status") : null;
      const original = button.textContent;

      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
        } else {
          const textarea = document.createElement("textarea");
          textarea.value = text;
          textarea.setAttribute("readonly", "");
          textarea.style.position = "fixed";
          textarea.style.opacity = "0";
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand("copy");
          textarea.remove();
        }
        button.textContent = "Copied";
        if (status) {
          status.textContent =
            button.dataset.copyKind === "bibtex"
              ? "BibTeX copied to clipboard."
              : "Citation copied to clipboard.";
        }
      } catch (error) {
        if (status) status.textContent = "Copy failed. Please try again.";
      }

      window.setTimeout(() => {
        button.textContent = original;
        if (status) status.textContent = "";
      }, 1800);
    };

    copyButtons.forEach((button) => {
      button.addEventListener("click", () => copyText(button));
    });

    if (reset) {
      reset.addEventListener("click", () => {
        activeCategory = "all";
        if (search) search.value = "";
        if (year) year.value = "all";
        categoryButtons.forEach((button) => {
          button.setAttribute(
            "aria-pressed",
            button.dataset.pubCategory === "all" ? "true" : "false"
          );
        });
        applyFilters();
        if (search) search.focus();
      });
    }

    applyFilters();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPublicationFilters);
  } else {
    initPublicationFilters();
  }
})();
