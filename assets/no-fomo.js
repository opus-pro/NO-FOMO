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

  if (config.surface === "issue" && "HTMLDialogElement" in window) {
    // Thumbnails open an enlarged copy in a dialog; without JS they link to the source.
    const dialog = document.createElement("dialog");
    dialog.className = "lightbox";
    const image = document.createElement("img");
    const bar = document.createElement("div");
    bar.className = "lightbox-bar";
    const source = document.createElement("a");
    source.target = "_blank";
    source.rel = "noopener noreferrer";
    const close = document.createElement("button");
    close.type = "button";
    const chinese = document.documentElement.lang.startsWith("zh");
    source.textContent = chinese ? "查看原文 ↗" : "Open source ↗";
    close.textContent = chinese ? "关闭" : "Close";
    bar.append(source, close);
    dialog.append(image, bar);
    document.body.append(dialog);
    close.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener("close", () => image.removeAttribute("src"));
    for (const link of document.querySelectorAll(".screenshot-link")) {
      link.addEventListener("click", (event) => {
        const thumbnail = link.querySelector("img");
        if (!thumbnail || event.metaKey || event.ctrlKey || event.shiftKey) return;
        event.preventDefault();
        image.src = thumbnail.currentSrc || thumbnail.src;
        image.alt = thumbnail.alt;
        source.href = link.href;
        dialog.showModal();
      });
    }
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

  if (config.surface === "issue") {
    // The daily video digest, when one was published beside this issue
    // (home/<date>/video.json, .mp4, .jpg). Built with textContent only.
    const issue = document.querySelector(".issue");
    const chinese = document.documentElement.lang.startsWith("zh");
    fetch("../video.json", { credentials: "omit" })
      .then((response) => (response.ok ? response.json() : null))
      .then((facts) => {
        if (!issue || !facts || typeof facts !== "object") return;
        const style = document.createElement("style");
        style.textContent = `
.video-digest{margin:28px 0 8px;display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:24px;align-items:center}
.video-digest video{width:100%;aspect-ratio:16/9;border-radius:14px;background:var(--ink);display:block}
.video-digest .host{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;color:var(--signal)}
.video-digest .who{margin:8px 0 0;font-size:1.05rem;line-height:1.5;color:var(--ink)}
.video-digest .native{margin:6px 0 0;font-style:italic;color:var(--muted);line-height:1.5}
.video-digest .look{margin:12px 0 0;font-size:.8rem;color:var(--muted)}
@media (max-width:760px){.video-digest{grid-template-columns:1fr;gap:14px}}`;
        document.head.append(style);
        const figure = document.createElement("figure");
        figure.className = "video-digest";
        const video = document.createElement("video");
        video.controls = true;
        video.playsInline = true;
        video.preload = "none";
        video.poster = "../video.jpg";
        video.src = "../video.mp4";
        const caption = document.createElement("figcaption");
        const label = document.createElement("span");
        label.className = "host";
        label.textContent = chinese ? "今日视频简报 · 今天的主播" : "Today's video · your host";
        caption.append(label);
        for (const [name, value] of [["who", facts.host], ["native", facts.native]]) {
          if (typeof value !== "string" || !value) continue;
          const line = document.createElement("p");
          line.className = name;
          line.textContent = value;
          caption.append(line);
        }
        const seconds = Number(facts.seconds);
        const look = [
          typeof facts.look === "string" ? facts.look : "",
          Number.isFinite(seconds) && seconds > 0
            ? `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`
            : "",
        ].filter(Boolean);
        if (look.length) {
          const line = document.createElement("p");
          line.className = "look";
          line.textContent = look.join(" · ");
          caption.append(line);
        }
        figure.append(video, caption);
        video.addEventListener("error", () => figure.remove());
        issue.after(figure);
      })
      .catch(() => {});
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
