/* =========================================================================
   WAXWIT — site interactions
   Renders services / work / clients from data, handles nav, filtering,
   lightbox video playback and scroll reveals. Vanilla JS, no dependencies.
   ========================================================================= */
(function () {
  "use strict";

  const DATA = window.WAXWIT_DATA || { categories: [], work: [] };

  /* Accent color per category slug (warm earth-tone brand palette) */
  const ACCENTS = {
    "faces-that-influence": "var(--clay)",
    "fashion-brands": "var(--ochre)",
    "interior-brands": "var(--olive)",
    "food-bakery": "var(--ochre)",
    "hotel-restaurants": "var(--rose)",
    "typography": "var(--clay-2)",
    "promotional": "var(--olive)",
    "logo-animation": "var(--clay-3)",
    "built-for-paws": "var(--blush)",
  };

  /* Editorial content (edit freely) */
  const SERVICES = [
    { t: "Social Media Strategy", d: "A clear, channel-by-channel game plan built around your goals — not guesswork.", tags: ["Strategy", "Channels", "Growth"], accent: "var(--clay)" },
    { t: "Content Planning & Calendars", d: "Always-on content mapped weeks ahead, so nothing's rushed and nothing's random.", tags: ["Calendars", "Planning", "Cadence"], accent: "var(--rose)" },
    { t: "Reel & Video Scripting", d: "Hook-first scripts for reels and short video that earn attention in the first three seconds.", tags: ["Reels", "Scripts", "Hooks"], accent: "var(--ochre)" },
    { t: "Campaign Concept & Ideation", d: "Big ideas with a purpose — campaign concepts that give your brand something to say.", tags: ["Campaigns", "Concepts", "Ideas"], accent: "var(--clay-2)" },
    { t: "Paid Ads Strategy & Management", d: "Performance-led paid social that turns budget into reach, leads and sales.", tags: ["Paid social", "Performance", "ROI"], accent: "var(--olive)" },
    { t: "White Label for Agencies", d: "Senior marketing overflow for agencies — your brand, our thinking, behind the scenes.", tags: ["Agencies", "Overflow", "White-label"], accent: "var(--clay-3)" },
    { t: "Brand Identity & Positioning", d: "Sharp positioning and identity so your brand looks and sounds unmistakably you.", tags: ["Identity", "Positioning", "Brand"], accent: "var(--clay)" },
    { t: "Reporting & Analytics", d: "Clear reporting that ties every post back to what actually moved the needle.", tags: ["Analytics", "Reporting", "Insights"], accent: "var(--rose)" },
  ];

  const CLIENTS = [
    "Street Style Store", "Essilor Luxottica", "Sapna Choudhary", "Plasmapen", "Louise Walsh",
    "Bluweea", "Beatnik", "Snneha Jethwa", "Peppinos", "Rebuzz", "Agashe", "Arterior", "Kokos",
    "Xtraordinary", "Tribbiani Pizzeria", "Hotel Harmony", "Park Inn by Radisson", "Lead Physician",
    "SN Capital", "Nile Technologies", "Care Exchange", "HBX Group", "Ink n Pixel",
  ];

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

  /* ---------- Header scroll state ---------- */
  const header = $("#header");
  const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 12);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---------- Mobile nav ---------- */
  const toggle = $("#navToggle");
  const navLinks = $("#navLinks");
  const closeNav = () => { toggle.classList.remove("open"); navLinks.classList.remove("open"); toggle.setAttribute("aria-expanded", "false"); };
  toggle.addEventListener("click", () => {
    const open = navLinks.classList.toggle("open");
    toggle.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", String(open));
  });
  $$(".nav-link", navLinks).forEach((a) => a.addEventListener("click", closeNav));

  /* ---------- Services ---------- */
  const servicesGrid = $("#servicesGrid");
  SERVICES.forEach((s, i) => {
    const card = el("div", "service-card reveal");
    card.dataset.delay = String(i % 3);
    card.style.setProperty("--accent", s.accent);
    card.innerHTML =
      `<div class="service-num">0${i + 1}</div>
       <h3>${s.t}</h3>
       <p>${s.d}</p>
       <div class="service-tags">${s.tags.map((t) => `<span>${t}</span>`).join("")}</div>`;
    servicesGrid.appendChild(card);
  });

  /* ---------- Ticker ---------- */
  const tickerWords = ["Social Media Strategy", "Campaigns", "Reels", "Carousels", "Paid Ads", "Brand Identity", "Content Planning", "Analytics"];
  const tickerTrack = $("#tickerTrack");
  if (tickerTrack) {
    const build = () => tickerWords.forEach((w) => { const s = el("span"); s.textContent = w; tickerTrack.appendChild(s); });
    build(); build(); // duplicate for seamless loop
  }

  /* ---------- Clients marquees ---------- */
  function fillMarquee(id, list) {
    const track = $("#" + id);
    if (!track) return;
    const items = list.concat(list); // duplicate for seamless loop
    items.forEach((c) => { const chip = el("span", "client-chip"); chip.textContent = c; track.appendChild(chip); });
  }
  const half = Math.ceil(CLIENTS.length / 2);
  fillMarquee("clientsA", CLIENTS.slice(0, half));
  fillMarquee("clientsB", CLIENTS.slice(half));

  /* ---------- Work grid + filters ---------- */
  const workGrid = $("#workGrid");
  const workFilters = $("#workFilters");

  function renderFilters() {
    const cats = DATA.categories || [];
    const mk = (slug, name) => {
      const b = el("button", "filter-chip");
      b.dataset.cat = slug; b.textContent = name;
      if (slug === "all") b.classList.add("active");
      b.addEventListener("click", () => setFilter(slug));
      return b;
    };
    workFilters.appendChild(mk("all", "All work"));
    cats.forEach((c) => workFilters.appendChild(mk(c.slug, c.name)));
  }

  function renderWork() {
    if (!DATA.work || !DATA.work.length) {
      workGrid.appendChild(el("p", "work-empty", "Work is being prepared — check back shortly."));
      return;
    }
    DATA.work.forEach((w, i) => {
      const card = el("article", "work-card reveal" + (w.orientation === "landscape" ? " landscape" : ""));
      card.dataset.cat = w.category;
      card.dataset.delay = String(i % 4);
      card.style.setProperty("--accent", ACCENTS[w.category] || "var(--c-violet)");
      card.innerHTML =
        `<img class="poster" src="${w.poster}" alt="${w.title}" loading="lazy" decoding="async" />
         <span class="play-badge"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span>
         <div class="card-overlay">
           <div class="card-cat">${w.categoryName}</div>
           <div class="card-title">${w.title}</div>
         </div>`;
      card.addEventListener("click", () => openLightbox(w));
      workGrid.appendChild(card);
    });
  }

  function setFilter(slug) {
    $$(".filter-chip", workFilters).forEach((b) => b.classList.toggle("active", b.dataset.cat === slug));
    $$(".work-card", workGrid).forEach((card) => {
      const show = slug === "all" || card.dataset.cat === slug;
      card.style.display = show ? "" : "none";
      if (show) card.classList.add("in"); // ensure filtered-in cards are never left hidden by the reveal
    });
  }

  renderFilters();
  renderWork();

  /* ---------- Lightbox ---------- */
  const lightbox = $("#lightbox");
  const lbInner = $("#lightboxInner");
  const lbVideo = $("#lightboxVideo");
  const lbCaption = $("#lightboxCaption");

  function openLightbox(w) {
    lbInner.classList.toggle("portrait", w.orientation === "portrait");
    lbVideo.src = w.video;
    lbVideo.poster = w.poster;
    lbCaption.textContent = `${w.categoryName} — ${w.title}`;
    lightbox.classList.add("open");
    document.body.style.overflow = "hidden";
    lbVideo.play().catch(() => {});
  }
  function closeLightbox() {
    lightbox.classList.remove("open");
    lbVideo.pause();
    lbVideo.removeAttribute("src");
    lbVideo.load();
    document.body.style.overflow = "";
  }
  $("#lightboxClose").addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", (e) => { if (e.target === lightbox) closeLightbox(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && lightbox.classList.contains("open")) closeLightbox(); });

  /* ---------- Scroll reveal ---------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) { entry.target.classList.add("in"); io.unobserve(entry.target); }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
  $$(".reveal").forEach((e) => io.observe(e));

  /* ---------- Misc ---------- */
  $("#year").textContent = new Date().getFullYear();

  const form = $("#contactForm");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      const btn = $("button[type=submit]", form);
      const original = btn.textContent;
      btn.textContent = "Sending…";
      btn.disabled = true;
      try {
        const res = await fetch(form.action, {
          method: "POST",
          headers: { Accept: "application/json" },
          body: new FormData(form),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
          btn.textContent = "Thanks — we'll be in touch ✦";
          form.reset();
          setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 4000);
        } else {
          throw new Error(data.message || "Submission failed");
        }
      } catch (err) {
        btn.textContent = "Something went wrong — email us instead";
        setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 4500);
      }
    });
  }
})();
