// ----------------------------
// Utilities
// ----------------------------
function $(sel) { return document.querySelector(sel); }
function $all(sel) { return Array.from(document.querySelectorAll(sel)); }

function getParam(name) {
    const url = new URL(window.location.href);
    return url.searchParams.get(name);
}

function stripDiacritics(str) {
    return (str || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function normalize(str) {
    return stripDiacritics(String(str || "").toLowerCase())
        .replace(/\s+/g, " ")
        .trim();
}

function floorLabel(f) {
    const map = {
        0: "Ισόγειο",
        1: "1ος",
        2: "2ος",
        3: "3ος",
        4: "4ος",
        "-1": "Υπόγειο"
    };
    return map[f] ?? `${f}`;
}

function orgLabel(org) {
    return org || "—";
}

function toTelLink(phone) {
    const p = String(phone || "").replace(/[^\d+]/g, "");
    return `tel:${p}`;
}

function toMailLink(email) {
    return `mailto:${email}`;
}

async function loadEntries() {
    const res = await fetch("./data/entries.json", { cache: "no-store" });
    if (!res.ok) throw new Error("Αποτυχία φόρτωσης δεδομένων (entries.json).");
    const data = await res.json();
    return Array.isArray(data) ? data : [];
}

function buildSearchIndex(entry) {
    // searchable text for fuzzy-ish search
    const parts = [
        entry.name,
        entry.organization,
        entry.entityType,
        entry.roomRaw,
        (entry.tags || []).join(" "),
        (entry.phones || []).join(" "),
        (entry.emails || []).join(" ")
    ];
    return normalize(parts.join(" "));
}

function matchesQuery(entry, qNorm) {
    if (!qNorm) return true;
    return entry._idx.includes(qNorm);
}

function sortEntries(a, b) {
    const an = Number(a.roomNumber ?? 9999);
    const bn = Number(b.roomNumber ?? 9999);
    if (an !== bn) return an - bn;

    const as = String(a.roomSuffix || "");
    const bs = String(b.roomSuffix || "");
    if (as !== bs) return as.localeCompare(bs, "el");

    return String(a.name || "").localeCompare(String(b.name || ""), "el");
}

function uniqueValues(arr) {
    return Array.from(new Set(arr.filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b), "el"));
}

function escapeHtml(str) {
    return String(str || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function openEntryModal(entry) {
    const overlay = $("#modalOverlay");
    if (!overlay) return;

    const roomText = entry.roomRaw ? `Γραφείο ${entry.roomRaw}` : null;
    const floorText = entry.floor != null ? floorLabel(entry.floor) : null;
    const orgText = entry.organization ? orgLabel(entry.organization) : null;

    const parts = [roomText, floorText, orgText].filter(Boolean);

    const metaBadges = parts.length
        ? parts.map(t => `<span class="meta-badge">${escapeHtml(t)}</span>`).join("")
        : `<span class="meta-badge meta-badge--muted">—</span>`;

    $("#modalMeta").innerHTML = `<div class="meta-badges">${metaBadges}</div>`;
    $("#modalTitle").textContent = entry.name || "Χωρίς τίτλο";


    const phones = (entry.phones || []);
    const emails = (entry.emails || []);
    const tags = (entry.tags || []);

    $("#modalPhones").innerHTML = phones.length
        ? phones.map(p => `<a href="${toTelLink(p)}">📞 ${escapeHtml(p)}</a>`).join("")
        : "—";

    $("#modalEmails").innerHTML = emails.length
        ? emails.map(e => `<a href="${toMailLink(e)}">✉️ ${escapeHtml(e)}</a>`).join("")
        : "—";

    $("#modalTags").innerHTML = tags.length
        ? tags.map(t => `<span class="badge">${escapeHtml(t)}</span>`).join("")
        : `<span class="badge">—</span>`;

    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");

    // focus close button
    const closeBtn = $("#modalClose");
    if (closeBtn) closeBtn.focus();
}

function closeEntryModal() {
    const overlay = $("#modalOverlay");
    if (!overlay) return;
    overlay.classList.remove("open");
    overlay.setAttribute("aria-hidden", "true");
}

async function initFooterStats() {

    const countEl = document.getElementById("entryCount");
    const lastEl = document.getElementById("lastUpdate");
    const verEl = document.getElementById("appVersion");
    const yearEl = document.getElementById("year");

    if (yearEl) yearEl.textContent = new Date().getFullYear();

    if (!countEl && !lastEl) return;

    try {

        const entries = await loadEntries();

        // entries count
        if (countEl) countEl.textContent = entries.length;

        // newest verification date
        if (lastEl) {

            const dates = entries
                .map(e => e.lastVerified)
                .filter(Boolean)
                .sort();

            const newest = dates.length ? dates[dates.length - 1] : null;

            lastEl.textContent = newest || "—";
        }

        // fallback version if empty
        if (verEl && !verEl.textContent.trim()) {
            verEl.textContent = "1.0";
        }

    } catch (err) {

        if (countEl) countEl.textContent = "—";
        if (lastEl) lastEl.textContent = "—";

        console.error("Footer stats error:", err);

    }

}

// ----------------------------
// Rendering
// ----------------------------
function renderEntryCard(entry) {

    const badges = [];

    if (entry.roomRaw) {
        badges.push({
            text: `Γραφείο ${entry.roomRaw}`,
            cls: "meta-badge--room"
        });
    }

    if (entry.floor != null) {
        badges.push({
            text: floorLabel(entry.floor),
            cls: "meta-badge--floor"
        });
    }


    if (entry.organization) {
        badges.push({
            text: orgLabel(entry.organization),
            cls: "meta-badge--org"
        });
    }

    const metaBadges = badges.length
        ? badges.map(b =>
            `<span class="meta-badge ${b.cls}">${escapeHtml(b.text)}</span>`
        ).join("")
        : `<span class="meta-badge meta-badge--muted">—</span>`;

    const phones = (entry.phones || [])
        .map(p => `<a href="${toTelLink(p)}" onclick="event.stopPropagation()">📞 ${escapeHtml(p)}</a>`)
        .join("");

    const emails = (entry.emails || [])
        .map(e => `<a href="${toMailLink(e)}" onclick="event.stopPropagation()">✉️ ${escapeHtml(e)}</a>`)
        .join("");

    return `
    <div class="entry" role="button" tabindex="0" data-entry-id="${escapeHtml(entry.id)}">
      
      <div class="meta meta-badges">
        ${metaBadges}
      </div>

      <h3 class="title">${escapeHtml(entry.name || "Χωρίς τίτλο")}</h3>

      <div class="row">
        ${phones}
        ${emails}
      </div>

    </div>
  `;
}

function renderGroupedByOrg(entries, sortMode) {
    // entries: already filtered list (floor-only), can be any size
    const groups = new Map();
    for (const e of entries) {
        const key = e.organization || "—";
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(e);
    }

    const orgs = Array.from(groups.keys()).sort((a, b) => String(a).localeCompare(String(b), "el"));

    return orgs.map(org => {
        const items = applySorting(groups.get(org), sortMode);

        return `
        <div class="card" style="padding:0; overflow:hidden;">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; padding:12px 14px; background:rgba(0,0,0,.03); border-bottom:1px solid rgba(0,0,0,.06);">
        <div style="font-weight:800; font-size:14px;">${orgLabel(org)}</div>
        <div class="small">${items.length} εγγραφές</div>
        </div>
        <div style="padding:12px;">
        ${items.map(renderEntryCard).join("")}
        </div>
        </div>
        `;
    }).join("");
}

function renderEmpty(msg) {
    return `<div class="card"><h3>Δεν βρέθηκε κάτι</h3><p>${msg}</p></div>`;
}

function debounce(fn, ms = 120) {
    let t = null;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), ms);
    };
}

function escapeHtml(str) {
    return String(str || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function applySorting(arr, mode) {

    const sorted = [...arr];

    if (mode === "room_asc") {
        sorted.sort(sortEntries);
    }

    else if (mode === "room_desc") {
        sorted.sort(sortEntries).reverse();
    }

    else if (mode === "name_asc") {
        sorted.sort((a, b) =>
            String(a.name || "").localeCompare(String(b.name || ""), "el")
        );
    }

    else if (mode === "name_desc") {
        sorted.sort((a, b) =>
            String(b.name || "").localeCompare(String(a.name || ""), "el")
        );
    }

    else if (mode === "org_asc") {
        sorted.sort((a, b) => {
            const o = String(a.organization || "")
                .localeCompare(String(b.organization || ""), "el");
            if (o !== 0) return o;
            return String(a.name || "")
                .localeCompare(String(b.name || ""), "el");
        });
    }

    return sorted;
}
// ----------------------------
// Pages
// ----------------------------
async function initHome() {
    const entries = await loadEntries();
    entries.forEach(e => (e._idx = buildSearchIndex(e)));

    const qEl = $("#q");
    const listEl = $("#results");
    const scopeEl = $("#scope");
    const floorScopeEl = $("#floorScope");
    const orgScopeEl = $("#orgScope");
    const sortEl = $("#sortBy");
    const clearBtn = $("#clearBtn");
    const statsEl = $("#stats");
    const metaEl = $("#resultMeta");


    // Mobile UI
    const mobileMetaEl = document.getElementById("mobileMeta");
    const mobileFiltersBtn = document.getElementById("mobileFiltersBtn");
    const mobilePanelEl = document.getElementById("mobilePanel");
    const homeAdvancedEl = document.getElementById("homeAdvanced");
    const sepEl = mobilePanelEl?.querySelector("hr.sep");

    const mql = window.matchMedia("(max-width: 760px)");
    let isMobile = mql.matches;

    function setFiltersOpen(open) {
        if (!isMobile) return;

        // always hide Advanced inside mobile panel
        if (homeAdvancedEl) homeAdvancedEl.style.display = "none";
        if (sepEl) sepEl.style.display = "none";

        document.body.classList.toggle("filters-open", !!open);
        mobileFiltersBtn?.setAttribute("aria-expanded", open ? "true" : "false");
        mobilePanelEl?.setAttribute("aria-hidden", open ? "false" : "true");
    }

    // keep state consistent on resize
    mql.addEventListener?.("change", (e) => {
        isMobile = e.matches;
        if (!isMobile) {
            document.body.classList.remove("filters-open");
            mobileFiltersBtn?.setAttribute("aria-expanded", "false");
            mobilePanelEl?.setAttribute("aria-hidden", "false"); // irrelevant on desktop
        } else {
            // default closed on mobile
            setFiltersOpen(false);
        }
    });

    // default state (mobile closed)
    mobilePanelEl?.setAttribute("aria-hidden", isMobile ? "true" : "false");
    mobileFiltersBtn?.setAttribute("aria-expanded", "false");
    if (isMobile) setFiltersOpen(false);

    mobileFiltersBtn?.addEventListener("click", () => {
        const open = !document.body.classList.contains("filters-open");
        setFiltersOpen(open);
        if (open) mobilePanelEl?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    // close on outside tap (mobile)
    document.addEventListener("click", (e) => {
        if (!isMobile) return;
        if (!document.body.classList.contains("filters-open")) return;
        const t = e.target;
        if (!t) return;
        const insidePanel = mobilePanelEl?.contains(t);
        const insideBtn = mobileFiltersBtn?.contains(t);
        if (!insidePanel && !insideBtn) setFiltersOpen(false);
    });

    // close panel when user starts typing / focuses search
    qEl?.addEventListener("focus", () => setFiltersOpen(false));
    qEl?.addEventListener("input", () => setFiltersOpen(false));

    let lastShown = [];

    // counts ανά όροφο
    const floorCounts = {};
    entries.forEach(e => {
        const f = Number(e.floor);
        floorCounts[f] = (floorCounts[f] || 0) + 1;
    });
    $all("[data-floor-count]").forEach(span => {
        const f = Number(span.getAttribute("data-floor-count"));
        span.textContent = String(floorCounts[f] || 0);
    });

    // org dropdown
    const orgs = uniqueValues(entries.map(e => e.organization));
    if (orgScopeEl) {
        orgScopeEl.innerHTML =
            `<option value="">Όλοι οι φορείς</option>` +
            orgs.map(o => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join("");
    }

    if (statsEl) {
        statsEl.textContent = `Σύνολο: ${entries.length} εγγραφές · Όροφοι: 6`;
    }

    function applyQuickFloor(f) {
        scopeEl.value = "floor";
        floorScopeEl.style.display = "";
        floorScopeEl.value = String(f);
        qEl.focus();
        doRender();
    }

    function applyQuickTag(tag) {
        const prev = qEl.value.trim();
        qEl.value = prev ? (prev + " " + tag) : tag;
        qEl.focus();
        doRender();
    }

    function filteredSet() {
        const q = normalize(qEl.value);
        const scope = scopeEl.value;
        const floor = Number(floorScopeEl.value);
        const org = orgScopeEl.value;

        let base = entries;

        if (scope === "floor") base = base.filter(e => Number(e.floor) === floor);
        if (org) base = base.filter(e => e.organization === org);
        if (q) base = base.filter(e => matchesQuery(e, q));

        return base;
    }

    function updateMobileMeta(allCount) {
        if (!mobileMetaEl) return;

        const q = normalize(qEl.value);
        const scope = scopeEl.value;
        const floor = Number(floorScopeEl.value);
        const org = orgScopeEl.value;

        if (!q && scope !== "floor" && !org) {
            mobileMetaEl.textContent = "Γράψε για αναζήτηση…";
            return;
        }
        const where = (scope === "floor") ? floorLabel(floor) : "Όλο το ΔΜΘ";
        const orgText = org ? ` · ${org}` : "";
        mobileMetaEl.textContent = `${allCount} αποτελέσματα · ${where}${orgText}`;
    }

    function renderNow() {
        const qRaw = qEl.value;
        const q = normalize(qRaw);

        const scope = scopeEl.value;
        const floor = Number(floorScopeEl.value);
        const org = orgScopeEl.value;

        const all = applySorting(filteredSet(), sortEl.value);
        const shown = all.slice(0, 60);
        lastShown = shown;

        // meta line
        const scopeText = scope === "floor" ? floorLabel(floor) : "Όλο το ΔΜΘ";
        const orgText = org ? ` · ${org}` : "";

        updateMobileMeta(all.length);

        if (metaEl) {
            metaEl.textContent = q
                ? `${all.length} αποτελέσματα · ${scopeText}${orgText}`
                : `Γράψε κάτι ή χρησιμοποίησε τα chips/όροφο · ${scopeText}${orgText}`;
        }

        // Mobile-first: αν δεν υπάρχει query/φίλτρο, μην γεμίζεις με empty cards
        if (!q && scope !== "floor" && !org) {
            lastShown = [];
            listEl.innerHTML = "";
            return;
        }

        if (all.length === 0) {
            lastShown = [];
            listEl.innerHTML = renderEmpty("Δεν βρέθηκε κάτι. Δοκίμασε άλλη λέξη (π.χ. «γραμματεία», «ανακριτικό», «233»).");
            return;
        }

        listEl.innerHTML = shown.map(renderEntryCard).join("");
    }

    const doRender = debounce(renderNow, 120);

    function autoScrollToResults() {
        const isMobile = window.matchMedia("(max-width: 760px)").matches;
        if (!isMobile) return;

        const results = document.getElementById("results");
        if (!results) return;

        results.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }

    // Click result -> modal
    listEl.addEventListener("click", (e) => {
        const card = e.target.closest(".entry[data-entry-id]");
        if (!card) return;
        const id = card.getAttribute("data-entry-id");
        const entry = entries.find(x => x.id === id);
        if (entry) openEntryModal(entry);
    });

    // Keyboard open on focused card
    listEl.addEventListener("keydown", (e) => {
        const card = e.target.closest(".entry[data-entry-id]");
        if (!card) return;
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        const id = card.getAttribute("data-entry-id");
        const entry = entries.find(x => x.id === id);
        if (entry) openEntryModal(entry);
    });

    let didAutoScroll = false;

    qEl.addEventListener("input", () => {

        const q = qEl.value.trim();

        doRender();

        document.body.classList.toggle("searching", q.length > 0);

        if (q.length > 0 && !didAutoScroll) {
            autoScrollToResults();
            didAutoScroll = true;
        }

        if (q.length === 0) {
            didAutoScroll = false;
        }

    });

    qEl.addEventListener("input", () => {
        document.body.classList.toggle("searching", qEl.value.trim().length > 0);
    });

    // Enter inside input -> open first result (when exists)
    qEl.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        renderNow(); // immediate
        if (lastShown.length > 0) openEntryModal(lastShown[0]);
    });

    orgScopeEl.addEventListener("change", doRender);

    scopeEl.addEventListener("change", () => {
        floorScopeEl.style.display = (scopeEl.value === "floor") ? "" : "none";
        doRender();
    });

    floorScopeEl.addEventListener("change", doRender);
    sortEl.addEventListener("change", doRender);

    // Clear
    clearBtn.addEventListener("click", () => {
        qEl.value = "";
        orgScopeEl.value = "";
        scopeEl.value = "global";
        sortEl.value = "room_asc";
        floorScopeEl.style.display = "none";

        setFiltersOpen(false);
        closeEntryModal?.();

        doRender();
        qEl.focus();
    });

    // floor cards
    $all("[data-floor]").forEach(btn => {
        btn.addEventListener("click", () => {
            const f = btn.getAttribute("data-floor");
            window.location.href = `./orofos.html?f=${encodeURIComponent(f)}`;
        });
    });

    // quick chips
    $all("[data-quick-floor]").forEach(chip => {
        chip.addEventListener("click", (ev) => {
            ev.preventDefault();
            applyQuickFloor(chip.getAttribute("data-quick-floor"));
        });
    });

    $all("[data-quick-tag]").forEach(chip => {
        chip.addEventListener("click", (ev) => {
            ev.preventDefault();
            applyQuickTag(chip.getAttribute("data-quick-tag"));
        });
    });

    // initial
    floorScopeEl.style.display = "none";
    renderNow();
}

function floorAccusative(f) {
    const map = {
        "-1": "Υπόγειο",
        0: "Ισόγειο",
        1: "1ο",
        2: "2ο",
        3: "3ο",
        4: "4ο"
    };
    return map[f] ?? `${f}`;
}

async function initFloor() {
    const floorParam = getParam("f");
    const f = floorParam === null ? 0 : Number(floorParam);
    let label;

    if (Number(f) === -1) {
        label = "Υπόγειο";
    } else if (Number(f) === 0) {
        label = "Ισόγειο";
    } else {
        label = `${floorLabel(f)} όροφος`;
    }

    document.title = `ΔΜΘ - ${label}`;

    const titleLabel =
        (Number(f) === -1 || Number(f) === 0)
            ? `${floorLabel(f)} - ΔΜΘ`
            : `${floorLabel(f)} όροφος - ΔΜΘ`;

    const fl = floorAccusative(f);

    const floorTitleEl = $("#floorTitle");
    if (floorTitleEl) floorTitleEl.textContent = titleLabel;

    const floorSubtitleEl = $("#floorSubtitle");
    if (floorSubtitleEl) floorSubtitleEl.textContent =
        (Number(f) === -1 || Number(f) === 0)
            ? `Αναζήτηση και κατάλογος υπηρεσιών για το ${fl}`
            : `Αναζήτηση και κατάλογος υπηρεσιών για τον ${fl} όροφο`;

    const entriesAll = await loadEntries();
    entriesAll.forEach(e => e._idx = buildSearchIndex(e));

    // Floor subset
    const entries = entriesAll.filter(e => Number(e.floor) === Number(f)).sort(sortEntries);

    // Fill filters
    const orgs = uniqueValues(entries.map(e => e.organization));
    const types = uniqueValues(entries.map(e => e.entityType));

    const orgSel = $("#org");
    const typeSel = $("#type");
    const hasPhoneEl = $("#hasPhone");
    const hasEmailEl = $("#hasEmail");
    orgSel.innerHTML = `<option value="">Όλοι οι φορείς</option>` + orgs.map(o => `<option value="${o}">${o}</option>`).join("");
    typeSel.innerHTML = `<option value="">Όλοι οι τύποι</option>` + types.map(t => `<option value="${t}">${t}</option>`).join("");

    const qEl = $("#q");
    const listEl = $("#results");
    const counterEl = $("#counter");
    const resetBtn = $("#resetFilters");
    const sortEl = $("#sortBy");

    let lastShownFloor = [];

    function doRender() {
        const q = normalize(qEl.value);
        const org = orgSel.value;
        const type = typeSel.value;

        const wantPhone = !!hasPhoneEl?.checked;
        const wantEmail = !!hasEmailEl?.checked;

        let filtered = entries;

        if (org) filtered = filtered.filter(e => e.organization === org);
        if (type) filtered = filtered.filter(e => e.entityType === type);
        if (q) filtered = filtered.filter(e => matchesQuery(e, q));

        if (wantPhone) filtered = filtered.filter(e => (e.phones || []).length > 0);
        if (wantEmail) filtered = filtered.filter(e => (e.emails || []).length > 0);

        filtered = applySorting(filtered, sortEl.value);

        if (counterEl) {
            const total = entries.length;
            const shown = filtered.length;
            counterEl.textContent = `${shown} / ${total} αποτελέσματα`;
        }

        lastShownFloor = filtered;

        if (filtered.length === 0) {
            lastShownFloor = [];
            listEl.innerHTML = renderEmpty("Δεν βρέθηκαν εγγραφές με αυτά τα φίλτρα.");
            if (counterEl) {
                const total = entries.length;
                counterEl.textContent = `0 / ${total} αποτελέσματα`;
            }
            return;
        }

        // Grouping logic:
        // - Αν είσαι σε "Όλοι οι φορείς" => ομαδοποίηση ανά φορέα
        // - Αν έχεις επιλέξει συγκεκριμένο φορέα => απλή λίστα (χωρίς group header)
        const shouldGroupByOrg = !org;

        listEl.innerHTML = shouldGroupByOrg
            ? renderGroupedByOrg(filtered, sortEl.value)
            : filtered.map(renderEntryCard).join("");
    }

    listEl.addEventListener("click", (e) => {
        const card = e.target.closest(".entry[data-entry-id]");
        if (!card) return;
        const id = card.getAttribute("data-entry-id");
        const entry = entries.find(x => x.id === id);
        if (entry) openEntryModal(entry);
    });

    listEl.addEventListener("keydown", (e) => {
        const card = e.target.closest(".entry[data-entry-id]");
        if (!card) return;
        if (e.key !== "Enter" && e.key !== " ") return;

        e.preventDefault();
        const id = card.getAttribute("data-entry-id");
        const entry = entries.find(x => x.id === id);
        if (entry) openEntryModal(entry);
    });

    qEl.addEventListener("input", doRender);
    qEl.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;

        e.preventDefault();
        doRender(); // εδώ είναι OK (δεν είναι debounce)
        if (lastShownFloor.length > 0) openEntryModal(lastShownFloor[0]);
    });
    orgSel.addEventListener("change", doRender);
    typeSel.addEventListener("change", doRender);
    hasPhoneEl?.addEventListener("change", doRender);
    hasEmailEl?.addEventListener("change", doRender);
    sortEl.addEventListener("change", doRender);

    // quick nav floors
    $all("[data-floor-link]").forEach(a => {
        a.addEventListener("click", (ev) => {
            ev.preventDefault();
            const nf = a.getAttribute("data-floor-link");
            window.location.href = `./orofos.html?f=${encodeURIComponent(nf)}`;
        });
    });

    function resetFloorFilters() {
        qEl.value = "";
        orgSel.value = "";
        typeSel.value = "";
        sortEl.value = "room_asc";
        if (hasPhoneEl) hasPhoneEl.checked = false;
        if (hasEmailEl) hasEmailEl.checked = false;
        doRender();
        qEl.focus();
    }

    if (resetBtn) {
        resetBtn.addEventListener("click", resetFloorFilters);
    }

    doRender();
}

function initStaticNav() {
    // highlight current page
    const path = window.location.pathname.split("/").pop() || "index.html";
    $all(".nav a").forEach(a => {
        const href = a.getAttribute("href");
        if (href && href.endsWith(path)) a.classList.add("active");
    });
}

// ----------------------------
// Boot
// ----------------------------
document.addEventListener("DOMContentLoaded", async () => {
    initStaticNav();

    const page = document.body.getAttribute("data-page");
    try {
        if (page === "home") await initHome();
        if (page === "floor") await initFloor();
    } catch (err) {
        const target = $("#results") || $("#entryBox");
        if (target) {
            target.innerHTML = `<div class="card"><h3>Σφάλμα</h3><p>${err.message || err}</p></div>`;
        } else {
            console.error(err);
        }
    }

    await initFooterStats();

    // Modal close bindings
    document.addEventListener("click", (e) => {
        if (e.target && e.target.id === "modalOverlay") closeEntryModal();
    });
    document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;

        // 1) If modal open -> close it
        const overlay = $("#modalOverlay");
        const modalOpen = overlay && overlay.classList.contains("open");
        if (modalOpen) {
            closeEntryModal();
            return;
        }

        // 2) Home: if mobile filters panel open -> close it
        const onHome = document.body.getAttribute("data-page") === "home";
        if (onHome) {
            const isMobile = window.matchMedia("(max-width: 760px)").matches;
            const filtersOpen = document.body.classList.contains("filters-open");

            if (isMobile && filtersOpen) {
                document.body.classList.remove("filters-open");
                document.getElementById("mobileFiltersBtn")?.setAttribute("aria-expanded", "false");
                document.getElementById("mobilePanel")?.setAttribute("aria-hidden", "true");
                return;
            }
        }

        // 3) Otherwise: clear / reset depending on page
        const page = document.body.getAttribute("data-page");

        if (page === "home") {
            // triggers your existing clear logic (closes panel, clears, rerenders, focuses)
            document.getElementById("clearBtn")?.click();
            return;
        }

        if (page === "floor") {
            // triggers your resetFilters button logic
            document.getElementById("resetFilters")?.click();
            return;
        }
    });
    document.addEventListener("click", (e) => {
        if (e.target && e.target.id === "modalClose") closeEntryModal();
    });

});