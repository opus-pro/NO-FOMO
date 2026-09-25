(() => {
  const config = document.currentScript?.dataset;
  if (!config) return;

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const precisePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const hero = document.querySelector(
    config.surface === "archive" ? ".lead" : ".issue",
  );

  if (!reduced && precisePointer && hero) {
    hero.addEventListener("pointermove", (event) => {
      const rect = hero.getBoundingClientRect();
      hero.style.setProperty("--pointer-x", `${event.clientX - rect.left}px`);
      hero.style.setProperty("--pointer-y", `${event.clientY - rect.top}px`);
      hero.dataset.pointer = "active";
    });
    hero.addEventListener("pointerleave", () => {
      delete hero.dataset.pointer;
    });
  }

  if (config.surface === "issue") {
    const progress = document.querySelector(".reading-progress span");
    const updateProgress = () => {
      const distance = document.documentElement.scrollHeight - innerHeight;
      const value =
        distance > 0 ? Math.min(1, Math.max(0, scrollY / distance)) : 0;
      progress?.style.setProperty("--reading-progress", value);
    };
    updateProgress();
    addEventListener("scroll", updateProgress, { passive: true });
    addEventListener("resize", updateProgress, { passive: true });

    if (!reduced && "IntersectionObserver" in window) {
      const sections = [...document.querySelectorAll(".source-section")];
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            entry.target.classList.remove("motion-pending");
            entry.target.classList.add("motion-visible");
            observer.unobserve(entry.target);
          }
        },
        { rootMargin: "0px 0px -10%", threshold: 0.05 },
      );
      for (const section of sections) {
        if (section.getBoundingClientRect().top > innerHeight * 0.82) {
          section.classList.add("motion-pending");
        }
        observer.observe(section);
      }
    }
  }

  const origin = config.counterOrigin;
  const urlFor = (path) =>
    `${origin}/counter/${path === "TOTAL" ? "TOTAL" : encodeURIComponent(path)}.json`;
  const showCount = (output, formatted) => {
    const value = Number(formatted.replace(/[^0-9]/g, ""));
    if (reduced || !Number.isFinite(value) || value <= 0) {
      output.textContent = formatted;
      output.dataset.state = "ready";
      return;
    }
    const started = performance.now();
    const duration = 520;
    const step = (now) => {
      const progress = Math.min(1, (now - started) / duration);
      const eased = 1 - (1 - progress) ** 3;
      output.textContent = Math.round(value * eased).toLocaleString();
      if (progress < 1) requestAnimationFrame(step);
      else {
        output.textContent = formatted;
        output.dataset.state = "ready";
      }
    };
    requestAnimationFrame(step);
  };

  for (const output of document.querySelectorAll("[data-view-count]")) {
    fetch(urlFor(output.dataset.viewCount), {
      credentials: "omit",
      referrerPolicy: "no-referrer",
    })
      .then(async (response) => {
        if (response.status === 404) return { count: "0" };
        if (!response.ok) throw new Error("view count unavailable");
        return response.json();
      })
      .then((payload) => {
        if (
          typeof payload.count !== "string" ||
          !/^[0-9][0-9.,\s]*$/.test(payload.count)
        ) {
          throw new Error("invalid view count");
        }
        showCount(output, payload.count);
      })
      .catch(() => {
        output.dataset.state = "unavailable";
      });
  }

  const tracker = document.createElement("script");
  tracker.src = "https://gc.zgo.at/count.v5.js";
  tracker.async = true;
  tracker.crossOrigin = "anonymous";
  tracker.integrity =
    "sha384-atnOLvQb9t+jTSipvd75X2yginT4PjVbqDdlJAmxMm+wYElFmeR6EmLP5bYeoRVQ";
  tracker.dataset.goatcounter = `${origin}/count`;
  tracker.dataset.goatcounterSettings = JSON.stringify({
    path: config.counterPath,
    title: config.counterTitle,
    referrer: "",
    no_events: true,
  });
  document.head.append(tracker);
})();
