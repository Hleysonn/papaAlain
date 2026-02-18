(() => {
  const STORAGE_KEY = "liste-cadeaux-fin-carriere:v1";

  const giftsSeed = [
    {
      id: "camera",
      title: "Appareil photo",
      desc: "Pour capturer les moments précieux de mes projets."
    },
    {
      id: "laptop",
      title: "Ordinateur portable",
      desc: "Pour gérer mes projets."
    },
    {
      id: "printer",
      title: "Imprimante multifonction",
      desc: "Pour mes besoins administratifs."
    },
    {
      id: "chainsaw",
      title: "Tronçonneuse à essence",
      desc: "Pour aider à la gestion de mes terres agricoles."
    }
  ];

  /** State shape:
   * { gifts: { [id]: { taken: boolean, by: string, group: boolean, takenAt: number } }, filter: "all|available|taken", q: string }
   */
  const defaultState = {
    gifts: Object.fromEntries(giftsSeed.map(g => [g.id, { taken:false, by:"", group:false, takenAt:0 }])),
    filter: "all",
    q: ""
  };

  const els = {
    list: document.getElementById("giftList"),
    stats: document.getElementById("stats"),
    search: document.getElementById("search"),
    showAll: document.getElementById("showAll"),
    showAvailable: document.getElementById("showAvailable"),
    showTaken: document.getElementById("showTaken"),
    reset: document.getElementById("reset"),
    toast: document.getElementById("toast"),
  };

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return structuredClone(defaultState);
      const parsed = JSON.parse(raw);

      // merge safely with defaults (in case you add new gifts later)
      const merged = structuredClone(defaultState);
      if (parsed && typeof parsed === "object") {
        if (parsed.filter) merged.filter = parsed.filter;
        if (typeof parsed.q === "string") merged.q = parsed.q;

        if (parsed.gifts && typeof parsed.gifts === "object") {
          for (const id of Object.keys(merged.gifts)) {
            if (parsed.gifts[id]) merged.gifts[id] = { ...merged.gifts[id], ...parsed.gifts[id] };
          }
        }
      }
      return merged;
    } catch {
      return structuredClone(defaultState);
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add("show");
    window.clearTimeout(toast._t);
    toast._t = window.setTimeout(() => els.toast.classList.remove("show"), 1200);
  }

  function fmtDate(ts) {
    if (!ts) return "";
    try {
      return new Intl.DateTimeFormat("fr-BE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(ts));
    } catch {
      return new Date(ts).toLocaleString();
    }
  }

  function computeVisibleGifts() {
    const q = state.q.trim().toLowerCase();
    return giftsSeed.filter(g => {
      const s = state.gifts[g.id];
      const matchQ = !q || (g.title + " " + g.desc).toLowerCase().includes(q);
      const matchFilter =
        state.filter === "all" ||
        (state.filter === "available" && !s.taken) ||
        (state.filter === "taken" && s.taken);

      return matchQ && matchFilter;
    });
  }

  function updateStats() {
    const total = giftsSeed.length;
    const taken = giftsSeed.reduce((acc, g) => acc + (state.gifts[g.id].taken ? 1 : 0), 0);
    els.stats.textContent = `${taken}/${total} déjà pris`;
  }

  function render() {
    updateStats();

    const visible = computeVisibleGifts();
    els.list.innerHTML = "";

    if (visible.length === 0) {
      const li = document.createElement("li");
      li.className = "item";
      li.innerHTML = `<div class="note">Aucun résultat. Essaie une autre recherche 👀</div>`;
      els.list.appendChild(li);
      return;
    }

    for (const g of visible) {
      const s = state.gifts[g.id];

      const li = document.createElement("li");
      li.className = "item" + (s.taken ? " purchased" : "");

      li.innerHTML = `
        <div class="row">
          <div class="title">
            <input type="checkbox" ${s.taken ? "checked" : ""} ${s.taken ? "disabled" : ""} aria-label="Statut du cadeau"/>
            <div>
              <div class="name">${escapeHtml(g.title)}</div>
              <div class="desc">${escapeHtml(g.desc)}</div>
            </div>
          </div>

          <div class="meta">
            ${s.taken ? `<span class="tag ok">Pris</span>` : `<span class="tag warn">Disponible</span>`}
            ${s.group ? `<span class="tag">Cadeau groupé</span>` : ``}
          </div>
        </div>

        <div class="reserve">
          <div>
            <label for="by-${g.id}">${s.taken ? "Réservé par" : "Votre nom (pour réserver)"}</label>
            <input id="by-${g.id}" type="text" placeholder="Ex: Marie / Famille Dupont" value="${escapeAttr(s.by)}" ${s.taken ? "disabled" : ""}/>
          </div>

          <label class="group" title="Cochez si vous êtes 3 à 5 personnes">
            <input id="group-${g.id}" type="checkbox" ${s.group ? "checked" : ""} ${s.taken ? "disabled" : ""}/>
            3–5 personnes
          </label>
        </div>

        <div class="actions">
          <button class="btn primary" data-action="reserve" data-id="${g.id}" ${s.taken ? "disabled" : ""}>Réserver</button>
          <button class="btn" data-action="unreserve" data-id="${g.id}" ${s.taken ? "" : "disabled"}>Libérer</button>
        </div>

        ${s.taken ? `<div class="small">Réservé par <strong>${escapeHtml(s.by || "—")}</strong> • ${fmtDate(s.takenAt)}</div>` : ``}
      `;

      // wire inputs + buttons
      li.querySelector(`[data-action="reserve"]`).addEventListener("click", () => reserveGift(g.id));
      li.querySelector(`[data-action="unreserve"]`).addEventListener("click", () => unreserveGift(g.id));

      const byInput = li.querySelector(`#by-${g.id}`);
      const groupInput = li.querySelector(`#group-${g.id}`);

      if (byInput) {
        byInput.addEventListener("input", (e) => {
          state.gifts[g.id].by = e.target.value;
          saveState();
        });
      }

      if (groupInput) {
        groupInput.addEventListener("change", (e) => {
          state.gifts[g.id].group = !!e.target.checked;
          saveState();
          render();
        });
      }

      els.list.appendChild(li);
    }
  }

  function reserveGift(id) {
    const s = state.gifts[id];
    if (s.taken) return;

    const by = (s.by || "").trim();
    if (!by) {
      toast("Ajoute ton nom avant de réserver 🙂");
      return;
    }

    s.taken = true;
    s.takenAt = Date.now();
    saveState();
    render();
    toast("Réservé ✅");
    showConfetti();
  }

  function unreserveGift(id) {
    const s = state.gifts[id];
    if (!s.taken) return;

    // Simple safety: keep name but unlock
    s.taken = false;
    s.takenAt = 0;
    saveState();
    render();
    toast("Libéré 👌");
  }

  function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>\"']/g, (m) => ({
      "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
    }[m]));
  }
  function escapeAttr(str) {
    // for attribute values in HTML strings
    return escapeHtml(str).replace(/`/g, "&#096;");
  }

  // Filters + search
  els.search.addEventListener("input", (e) => {
    state.q = e.target.value;
    saveState();
    render();
  });

  els.showAll.addEventListener("click", () => { state.filter = "all"; saveState(); render(); });
  els.showAvailable.addEventListener("click", () => { state.filter = "available"; saveState(); render(); });
  els.showTaken.addEventListener("click", () => { state.filter = "taken"; saveState(); render(); });

  els.reset.addEventListener("click", () => {
    if (!confirm("Réinitialiser les réservations sur cet appareil ?")) return;
    state = structuredClone(defaultState);
    saveState();
    els.search.value = "";
    render();
    toast("Réinitialisé");
  });

  // Copy buttons
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-copy]");
    if (!btn) return;
    const sel = btn.getAttribute("data-copy");
    const el = document.querySelector(sel);
    if (!el) return;

    const text = el.textContent.trim();
    try {
      await navigator.clipboard.writeText(text);
      toast("Copié ✅");
    } catch {
      // fallback
      const tmp = document.createElement("textarea");
      tmp.value = text;
      document.body.appendChild(tmp);
      tmp.select();
      document.execCommand("copy");
      document.body.removeChild(tmp);
      toast("Copié ✅");
    }
  });

  // init
  let state = loadState();
  els.search.value = state.q || "";
  render();

  // --- Extra UI: confetti, share, print, add-gift modal ---
  function random(min, max) { return Math.random() * (max - min) + min; }

  function showConfetti() {
    const wrap = document.createElement('div');
    wrap.className = 'confetti';
    document.body.appendChild(wrap);
    const colors = ['#3ddc97','#61a0ff','#ffcc66','#ff6b6b','#d7e2ff'];
    const count = 40;
    for (let i=0;i<count;i++) {
      const el = document.createElement('div');
      el.className = 'piece';
      el.style.left = (random(0,100)) + 'vw';
      el.style.top = (random(-10,10)) + 'vh';
      el.style.width = (random(6,12)) + 'px';
      el.style.height = (random(8,16)) + 'px';
      el.style.background = colors[Math.floor(random(0,colors.length))];
      el.style.borderRadius = (Math.random()>0.5? '2px':'50%');
      const delay = random(0,0.5);
      const duration = random(1.2,2.6);
      el.style.animation = `confetti-fall ${duration}s ${delay}s cubic-bezier(.2,.7,.2,1) forwards`;
      el.style.transform = `rotate(${random(0,360)}deg)`;
      wrap.appendChild(el);
    }
    setTimeout(()=>{ wrap.remove(); }, 3200);
  }

  // share / print
  const shareBtn = document.getElementById('shareBtn');
  const printBtn = document.getElementById('printBtn');
  if (shareBtn) shareBtn.addEventListener('click', async () => {
    const title = 'Retraite de M. Alain Nkaka';
    const url = location.href;
    if (navigator.share) {
      try { await navigator.share({ title, text: 'Liste de cadeaux pour M. Alain Nkaka', url }); }
      catch { /* ignore */ }
    } else {
      try { await navigator.clipboard.writeText(url); toast('Lien copié ✅'); }
      catch { toast('Impossible de copier'); }
    }
  });
  if (printBtn) printBtn.addEventListener('click', () => window.print());

  // add gift modal
  const addGiftModal = document.getElementById('addGiftModal');
  const openAddGift = document.getElementById('openAddGift');
  const closeAddGift = document.getElementById('closeAddGift');
  const cancelAddGift = document.getElementById('cancelAddGift');
  const addGiftForm = document.getElementById('addGiftForm');

  let _prevActive = null;
  let _onKeydownModal = null;

  function focusableElements(container) {
    return Array.from(container.querySelectorAll('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'))
      .filter(el => !el.hasAttribute('disabled'));
  }

  function showAddModal(show = true) {
    if (!addGiftModal) return;
    addGiftModal.setAttribute('aria-hidden', show ? 'false' : 'true');
    const panel = addGiftModal.querySelector('.modal-panel');
    if (show) {
      _prevActive = document.activeElement;
      // small delay for CSS, then focus input
      setTimeout(() => {
        const title = document.getElementById('giftTitle');
        if (title) title.focus();
        else if (panel) panel.focus();
      }, 50);

      // close on click outside
      addGiftModal.addEventListener('click', onModalClick);

      // trap focus and close on ESC
      _onKeydownModal = (e) => {
        if (e.key === 'Escape') { showAddModal(false); }
        if (e.key === 'Tab') {
          const focusables = focusableElements(panel || addGiftModal);
          if (focusables.length === 0) return;
          const first = focusables[0];
          const last = focusables[focusables.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      };
      document.addEventListener('keydown', _onKeydownModal);
    } else {
      addGiftModal.removeEventListener('click', onModalClick);
      if (_onKeydownModal) document.removeEventListener('keydown', _onKeydownModal);
      _onKeydownModal = null;
      // restore focus
      if (_prevActive && typeof _prevActive.focus === 'function') _prevActive.focus();
      _prevActive = null;
    }
  }
  function onModalClick(e) {
    if (e.target === addGiftModal) showAddModal(false);
  }

  if (openAddGift) openAddGift.addEventListener('click', () => showAddModal(true));
  if (closeAddGift) closeAddGift.addEventListener('click', () => showAddModal(false));
  if (cancelAddGift) cancelAddGift.addEventListener('click', () => showAddModal(false));

  function slugify(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); }

  if (addGiftForm) {
    addGiftForm.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const titleEl = document.getElementById('giftTitle');
      const descEl = document.getElementById('giftDesc');
      if (!titleEl) return;
      const title = titleEl.value.trim();
      if (!title) return;
      const desc = descEl ? descEl.value.trim() : '';
      const id = slugify(title) || ('gift-' + Date.now());
      // append to giftsSeed and state
      giftsSeed.push({ id, title, desc });
      state.gifts[id] = { taken: false, by: '', group: false, takenAt: 0 };
      saveState();
      showAddModal(false);
      titleEl.value = '';
      if (descEl) descEl.value = '';
      render();
      toast('Cadeau proposé ✅');
    });
  }

})();
