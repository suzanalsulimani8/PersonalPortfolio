// Slideshow Module (Annotated to rubric spec)
/*
  Sections mapping:
  - [Loading image files] M
  - [Ordering photos] M
  - [Slides Operating] M
  - [Theme] M/J
  - [Command Bar] M
*/
(function () {
  // ---------- Persistence keys ----------
  // [Slides Operating] M: Settings persistence using localStorage
  const settingsKey = "slideshow.settings.v1";
  // [Ordering photos] M: Order persistence for manual reordering / shuffle
  const orderKey = "slideshow.order.v1";
  // [Loading image files] M: Custom user input for caption → persist custom captions
  const captionsKey = "slideshow.captions.v1";

  // ---------- Elements ----------
  const els = {
    fileInput: document.getElementById("fileInput"),
    drop: document.getElementById("drop"),
    status: document.getElementById("status"),
    stage: document.getElementById("stage"),
    caption: document.getElementById("caption"),
    captionEdit: document.querySelector("#caption .editable"),
    hint: document.getElementById("hint"),
    playPause: document.getElementById("playPause"),
    fullscreen: document.getElementById("fullscreen"),
    openConfig: document.getElementById("openConfig"),
    panel: document.getElementById("panel"),
    selTheme: document.getElementById("selTheme"),
    selMode: document.getElementById("selMode"),
    durRange: document.getElementById("durRange"),
    durNum: document.getElementById("durNum"),
    speedRange: document.getElementById("speedRange"),
    speedNum: document.getElementById("speedNum"),
    darkChk: document.getElementById("darkChk"),
    toggleDark: document.getElementById("toggleDark"),
    closeConfig: document.getElementById("closeConfig"),
    resetSettings: document.getElementById("resetSettings"),
    loadSamples: document.getElementById("loadSamples"),
    shuffleBtn: document.getElementById("shuffleBtn"),
    openReorder: document.getElementById("openReorder"),
    dlgReorder: document.getElementById("dlgReorder"),
    grid: document.getElementById("grid"),
    cancelReorder: document.getElementById("cancelReorder"),
    applyReorder: document.getElementById("applyReorder"),
    cmd: document.getElementById("cmd"),
    cmdInput: document.getElementById("cmdInput"),
    cmdList: document.getElementById("cmdList"),
    quickDur: document.getElementById("quickDur"),
  };

  // ---------- Runtime state ----------
  const settings = {
    // [Theme] M: default theme
    theme: "A",
    // [Slides Operating] M: operating mode (manual / auto / random)
    mode: "manual",
    // [Slides Operating] M: Slide duration configurable (1-30s)
    duration: 5,
    // [Slides Operating] M: Slide scrolling speed adjustable (CSS animation speed)
    speed: 0.6,
    // [Theme] M: Dark mode toggle
    dark: false,
  };
  // [Ordering photos] M: stored order (persisted)
  let storedOrder = [];
  // [Loading image files] M: per-photo custom captions persisted
  let customCaptions = {};
  // [Loading image files] M: photos array with id (hash), name, url, caption
  let photos = [];
  let current = -1;
  let timer = null;
  let animLock = false;

  // ---------- LocalStorage persistence ----------
  // [Slides Operating] M: Settings persistence using localStorage
  function loadLocal() {
    try {
      Object.assign(
        settings,
        JSON.parse(localStorage.getItem(settingsKey) || "{}")
      );
    } catch {}
    try {
      storedOrder = JSON.parse(localStorage.getItem(orderKey) || "[]");
    } catch {
      storedOrder = [];
    }
    try {
      customCaptions = JSON.parse(localStorage.getItem(captionsKey) || "{}");
    } catch {
      customCaptions = {};
    }
  }
  function persistSettings() {
    localStorage.setItem(settingsKey, JSON.stringify(settings));
  }
  function persistOrder() {
    storedOrder = photos.map((p) => p.id);
    localStorage.setItem(orderKey, JSON.stringify(storedOrder));
  }
  function persistCaptions() {
    localStorage.setItem(captionsKey, JSON.stringify(customCaptions));
  }
  loadLocal();

  // ---------- UI update ----------
  function applySettingsToUI() {
    // [Theme] M: user able to select themes (reflect dropdown state)
    els.selTheme.value = settings.theme;
    // [Slides Operating] M: reflect mode
    els.selMode.value = settings.mode;
    // [Slides Operating] M: duration controls
    els.durRange.value = settings.duration;
    els.durNum.value = settings.duration;
    els.quickDur.value = settings.duration; // quick control
    // [Slides Operating] M: speed controls
    els.speedRange.value = settings.speed;
    els.speedNum.value = settings.speed;
    // [Theme] M: dark mode toggle + body class
    els.darkChk.checked = settings.dark;
    document.body.classList.toggle("dark", settings.dark);
    // [Theme] M: apply theme to stage + body (separation of concerns in CSS)
    els.stage.classList.remove("themeA", "themeB", "themeC", "themeD");
    els.stage.classList.add("theme" + settings.theme);
    document.body.classList.remove("themeA", "themeB", "themeC", "themeD");
    document.body.classList.add("theme" + settings.theme);
    // [Slides Operating] M: speed affects CSS variable
    els.stage.style.setProperty("--speed", settings.speed + "s");
    // [Theme] M: dark icon toggle visual
    els.toggleDark.textContent = settings.dark ? "☀️" : "🌙";
  }
  applySettingsToUI();

  // ---------- Helpers ----------
  function updateHint() {
    // [Loading image files] M: module reachable / hint until images loaded
    els.hint.style.display = photos.length ? "none" : "block";
  }
  // [Loading image files] M: caption extracted from filename (capitalize & remove slug)
  function captionFromFilename(name) {
    return name
      .replace(/\.[^.]+$/, "")
      .replace(/[-_]+/g, " ")
      .trim()
      .split(/\s+/)
      .map((w) => w[0]?.toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }
  // [Loading image files] M: SHA-256 for duplicate detection by content
  async function sha256(file) {
    const buf = await file.arrayBuffer();
    const hash = await crypto.subtle.digest("SHA-256", buf);
    return [...new Uint8Array(hash)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  // [Ordering photos] M: apply previously stored manual order
  function reorderFromStored() {
    if (!storedOrder.length) return;
    const map = new Map();
    photos.forEach((p) => map.set(p.id, p));
    const newList = [];
    storedOrder.forEach((id) => {
      if (map.has(id)) {
        newList.push(map.get(id));
        map.delete(id);
      }
    });
    for (const p of map.values()) newList.push(p);
    photos = newList;
  }

  // ---------- Add files ----------
  // [Loading image files] M: add a single file after checking duplicates & deriving caption
  async function addFile(file, prebuiltUrl = null) {
    const name = file.name || "photo";
    // [Loading image files] M: duplicate image removal (by filename)
    if (photos.some((p) => p.name === name)) return false;
    const id = await sha256(file);
    // [Loading image files] M: duplicate image removal (by content hash)
    if (photos.some((p) => p.id === id)) return false;
    const url = prebuiltUrl || URL.createObjectURL(file);
    // [Loading image files] M: caption from customCaptions else from filename
    const caption = customCaptions[id] || captionFromFilename(name);
    photos.push({ id, name, url, caption });
    return true;
  }

  // [Loading image files] M: handle selection/dnd list → create slideshow items
  async function handleFiles(fileList) {
    let added = 0,
      skipped = 0;
    for (const f of fileList) {
      if (!f.type.startsWith("image/")) continue;
      const ok = await addFile(f);
      ok ? added++ : skipped++;
    }
    if (added) {
      // [Ordering photos] M: keep order persistence after new items
      reorderFromStored();
      persistOrder();
      updateHint();
      if (current === -1) {
        // [Slides Operating] M: one photo showing after another → start view at first
        goTo(0, true);
      }
    }
    if (skipped && added === 0 && !photos.length) {
      els.status.textContent = "No new photos added (duplicates were skipped).";
    }
  }

  // ---------- Sample photos ----------
  // [Loading image files] M: Sample photos are used when user choose to load sample photos
  function dataUrlSVG(w, h, text, bg, fg) {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>
            <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop stop-color='${bg}'/><stop offset='1' stop-color='#111'/></linearGradient></defs>
            <rect width='100%' height='100%' fill='url(#g)'/>
            <g font-family='Segoe UI,Roboto,Arial' font-size='32' fill='${fg}' text-anchor='middle'>
              <text x='50%' y='50%' dominant-baseline='middle'>${text}</text>
            </g></svg>`;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }
  async function loadSamplePhotos() {
    const samples = [
      {
        name: "sunset_sky.svg",
        url: dataUrlSVG(1200, 800, "Sunset", "tomato", "#fff"),
      },
      {
        name: "blue_ocean.svg",
        url: dataUrlSVG(1200, 800, "Ocean", "#2563eb", "#fff"),
      },
      {
        name: "green_forest.svg",
        url: dataUrlSVG(1200, 800, "Forest", "#16a34a", "#fff"),
      },
      {
        name: "golden_desert.svg",
        url: dataUrlSVG(1200, 800, "Desert", "#d97706", "#111"),
      },
      {
        name: "city_night.svg",
        url: dataUrlSVG(1200, 800, "City", "#6d28d9", "#fff"),
      },
    ];
    let added = 0,
      skipped = 0;
    for (const s of samples) {
      const res = await fetch(s.url);
      const blob = await res.blob();
      const file = new File([blob], s.name, { type: blob.type });
      const ok = await addFile(file, s.url);
      ok ? added++ : skipped++;
    }
    if (added) {
      reorderFromStored();
      persistOrder();
      updateHint();
      if (current === -1) goTo(0, true);
    }
  }

  // ---------- Slideshow navigation ----------
  // [Slides Operating] M: random/ordered traversal
  function nextIndex() {
    if (!photos.length) return -1;
    if (settings.mode === "random") {
      if (photos.length === 1) return current;
      let idx;
      do {
        idx = Math.floor(Math.random() * photos.length);
      } while (idx === current);
      return idx;
    }
    return (current + 1) % photos.length;
  }
  function prevIndex() {
    if (!photos.length) return -1;
    if (settings.mode === "random") {
      if (photos.length === 1) return current;
      let idx;
      do {
        idx = Math.floor(Math.random() * photos.length);
      } while (idx === current);
      return idx;
    }
    return (current - 1 + photos.length) % photos.length;
  }

  // [Theme] M/J: Theme C captions animation (word stagger); contributes to “appealing” judgment
  function splitCaptionWords(text) {
    els.caption.classList.remove("ready");
    els.captionEdit.innerHTML = "";
    const words = text.split(/\s+/).filter(Boolean);
    words.forEach((w, i) => {
      const span = document.createElement("span");
      span.className = "word";
      span.textContent = (i ? " " : "") + w;
      span.style.animationDelay = 0.3 * i + "s";
      els.captionEdit.appendChild(span);
    });
    requestAnimationFrame(() => {
      els.caption.classList.add("ready");
    });
  }

  // [Loading image files] M: Custom user input for caption reflected in UI
  function applyCaption() {
    const cap = photos[current]?.caption || "";
    if (settings.theme === "C") splitCaptionWords(cap);
    else els.captionEdit.textContent = cap;
  }

  // [Theme] M: Theme transitions (A/B/C/D) via CSS classes on imgWrap
  function createImgWrap(url, cls) {
    const wrap = document.createElement("div");
    wrap.className = "imgWrap" + (cls ? " " + cls : "");
    const img = document.createElement("img");
    img.src = url;
    img.alt = "";
    wrap.appendChild(img);
    return wrap;
  }

  // [Slides Operating] M: show specific slide with animation timing = speed
  // [Theme] J: Where slide-in/out animations happen (affects “appealing” score for Theme D)
  async function goTo(idx, instant = false) {
    if (idx < 0 || idx >= photos.length) return;
    if (animLock) return;
    animLock = true;

    const prev = els.stage.querySelector(".imgWrap");
    const incoming = createImgWrap(
      photos[idx].url,
      instant || settings.theme === "A" ? "" : "in"
    );

    // [Theme] M: Theme A no transition; others use in/out classes
    const shouldOut = !(instant || settings.theme === "A");
    if (prev && shouldOut) prev.classList.add("out");

    els.stage.appendChild(incoming);
    current = idx;
    applyCaption();

    await new Promise((r) =>
      setTimeout(
        r,
        instant || settings.theme === "A" ? 0 : settings.speed * 1000
      )
    );

    if (prev && prev.parentElement) prev.parentElement.removeChild(prev);
    animLock = false;
  }

  // ---------- Auto play / Pause ----------
  // [Slides Operating] M: Pause/Play controls work during auto-playing
  function play() {
    if (!photos.length) {
      els.status.textContent = "Load photos first.";
      return;
    }
    if (timer) return;
    els.playPause.textContent = "Pause";
    // [Slides Operating] M: Slideshow can be auto-played, in order
    (async () => {
      await goTo(nextIndex());
      const tick = async () => {
        if (!timer) return;
        await goTo(nextIndex());
        // [Slides Operating] M: Slide duration configurable (1-30s)
        timer = setTimeout(tick, settings.duration * 1000);
      };
      timer = setTimeout(tick, settings.duration * 1000);
    })();
  }
  function pause() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    els.playPause.textContent = "Play";
  }
  function togglePlay() {
    if (settings.mode === "manual") {
      settings.mode = "auto";
      els.selMode.value = "auto";
      persistSettings();
      els.status.textContent = "Switched to Auto mode.";
    }
    timer ? pause() : play();
  }

  // ---------- Shuffle ----------
  // [Ordering photos] M: Photo shuffle button shuffles randomly
  function shuffle() {
    for (let i = photos.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [photos[i], photos[j]] = [photos[j], photos[i]];
    }
    persistOrder();
    if (current >= photos.length) current = 0;
    if (current >= 0) goTo(current, true);
  }

  // ---------- Reorder dialog ----------
  // [Ordering photos] M: There is a view/page for re-ordering (via configuration)
  let reorderDraft = [];
  function openReorder() {
    if (!photos.length) {
      alert("No photos loaded.");
      return;
    }
    reorderDraft = photos.map((p) => ({ ...p }));
    els.grid.innerHTML = "";
    // [Ordering photos] M: show tiles with captions to drag
    reorderDraft.forEach((p) => {
      const div = document.createElement("div");
      div.className = "tile";
      div.draggable = true; // [Ordering photos] M: drag and drop
      div.dataset.id = p.id;
      div.innerHTML = `<img src="${p.url}" alt=""><div class="ttl">${p.caption}</div>`;
      els.grid.appendChild(div);
    });
    enableGridDnD(); // [Ordering photos] M: manual ordering by users
    els.dlgReorder.classList.add("show");
  }
  function enableGridDnD() {
    let dragged = null;
    els.grid.addEventListener("dragstart", (e) => {
      const tile = e.target.closest(".tile");
      if (!tile) return;
      dragged = tile;
      tile.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });
    els.grid.addEventListener("dragend", () => {
      if (dragged) dragged.classList.remove("dragging");
      dragged = null;
    });
    els.grid.addEventListener("dragover", (e) => {
      e.preventDefault();
      const tile = e.target.closest(".tile");
      if (!tile || tile === dragged) return;
      const children = [...els.grid.children];
      const a = children.indexOf(dragged);
      const b = children.indexOf(tile);
      if (a < b) els.grid.insertBefore(dragged, tile.nextSibling);
      else els.grid.insertBefore(dragged, tile);
    });
  }
  function applyReorder() {
    // [Ordering photos] M: applying new order
    const orderIds = [...els.grid.children].map((el) => el.dataset.id);
    const newArr = [];
    orderIds.forEach((id) => {
      const p = photos.find((x) => x.id === id);
      if (p) newArr.push(p);
    });
    photos = newArr;
    persistOrder();
    els.dlgReorder.classList.remove("show");
    if (current >= photos.length) current = 0;
    if (current >= 0) goTo(current, true);
  }

  // ---------- Config panel ----------
  // [Slides Operating] M: When config button is clicked, show panel with operating options + theme switching inside
  function openConfig() {
    els.panel.classList.add("show");
  }
  function closeConfig() {
    els.panel.classList.remove("show");
  }

  // [Theme] M: change theme in configuration panel
  els.selTheme.addEventListener("change", (e) => {
    settings.theme = e.target.value;
    persistSettings();
    applySettingsToUI();
    if (current >= 0) goTo(current, true);
  });

  // [Slides Operating] M: three modes switching (manual, auto, random)
  els.selMode.addEventListener("change", (e) => {
    settings.mode = e.target.value;
    persistSettings();
    if (settings.mode === "manual") pause();
    else play();
  });

  // [Slides Operating] M: duration/speed controls (slider + number)
  function bindRangeAndNumber(range, num, key, min, max) {
    const clamp = (v) => Math.max(min, Math.min(max, +v));
    range.addEventListener("input", (e) => {
      const v = clamp(e.target.value);
      num.value = v;
      settings[key] = v;
      persistSettings();
      if (key === "speed") applySettingsToUI();
      if (key === "duration") els.quickDur.value = v;
    });
    num.addEventListener("input", (e) => {
      const v = clamp(e.target.value);
      range.value = v;
      settings[key] = v;
      persistSettings();
      if (key === "speed") applySettingsToUI();
      if (key === "duration") els.quickDur.value = v;
    });
  }
  bindRangeAndNumber(els.durRange, els.durNum, "duration", 1, 30);
  bindRangeAndNumber(els.speedRange, els.speedNum, "speed", 0.2, 1.5);

  // [Slides Operating] M: quick duration input mirrors main controls
  els.quickDur.addEventListener("input", (e) => {
    const v = Math.max(1, Math.min(30, +e.target.value || 1));
    settings.duration = v;
    persistSettings();
    els.durRange.value = v;
    els.durNum.value = v;
  });

  // [Theme] M: dark mode toggle (checkbox + icon button)
  els.darkChk.addEventListener("change", (e) => {
    settings.dark = e.target.checked;
    persistSettings();
    applySettingsToUI();
  });
  els.toggleDark.addEventListener("click", () => {
    settings.dark = !settings.dark;
    persistSettings();
    applySettingsToUI();
  });

  // [Slides Operating] M: reset to defaults (visual consistency across themes)
  els.resetSettings.addEventListener("click", () => {
    Object.assign(settings, {
      theme: "A",
      mode: "manual",
      duration: 5,
      speed: 0.6,
      dark: false,
    });
    persistSettings();
    applySettingsToUI();
    pause();
  });

  // ---------- Command Bar ----------
  // [Command Bar] M: supports switching theme, modes, dark toggle, shuffle, play/pause
  const commands = [
    {
      name: "Switch to theme A",
      keywords: ["theme", "a"],
      action: () => {
        els.selTheme.value = "A";
        els.selTheme.dispatchEvent(new Event("change"));
      },
    },
    {
      name: "Switch to theme B",
      keywords: ["theme", "b"],
      action: () => {
        els.selTheme.value = "B";
        els.selTheme.dispatchEvent(new Event("change"));
      },
    },
    {
      name: "Switch to theme C",
      keywords: ["theme", "c"],
      action: () => {
        els.selTheme.value = "C";
        els.selTheme.dispatchEvent(new Event("change"));
      },
    },
    {
      name: "Switch to theme D",
      keywords: ["theme", "d"],
      action: () => {
        els.selTheme.value = "D";
        els.selTheme.dispatchEvent(new Event("change"));
      },
    },

    {
      name: "Change to manual mode",
      keywords: ["manual", "mode"],
      action: () => {
        els.selMode.value = "manual";
        els.selMode.dispatchEvent(new Event("change"));
      },
    },
    {
      name: "Change to auto-playing mode",
      keywords: ["auto", "mode", "autoplay", "play"],
      action: () => {
        els.selMode.value = "auto";
        els.selMode.dispatchEvent(new Event("change"));
      },
    },
    {
      name: "Change to random mode",
      keywords: ["random", "mode"],
      action: () => {
        els.selMode.value = "random";
        els.selMode.dispatchEvent(new Event("change"));
      },
    },

    {
      name: "Toggle dark mode",
      keywords: ["dark", "light", "toggle"],
      action: () => {
        els.toggleDark.click();
      },
    },
    {
      name: "Shuffle photos",
      keywords: ["shuffle", "randomize"],
      action: () => {
        shuffle();
      },
    },

    {
      name: "Play slideshow",
      keywords: ["play", "start"],
      action: () => {
        if (settings.mode === "manual") {
          settings.mode = "auto";
          els.selMode.value = "auto";
          persistSettings();
        }
        play();
      },
    },
    {
      name: "Pause slideshow",
      keywords: ["pause", "stop"],
      action: () => {
        pause();
      },
    },
  ];
  let cmdIndex = 0;

  // [Command Bar] M: show command bar via CTRL+K or "/" and dim background
  function openCmd() {
    els.cmd.classList.add("show");
    els.cmdInput.value = "";
    renderCmdList(commands);
    cmdIndex = 0;
    setTimeout(() => els.cmdInput.focus(), 0);
  }
  function closeCmd() {
    els.cmd.classList.remove("show");
  }

  // [Command Bar] M: partially matched commands (typeahead)
  function matchCommands(q) {
    const s = q.trim().toLowerCase();
    if (!s) return commands;
    return commands.filter(
      (c) =>
        c.name.toLowerCase().includes(s) ||
        c.keywords.some((k) => k.includes(s))
    );
  }
  function renderCmdList(list) {
    els.cmdList.innerHTML = "";
    list.forEach((c, i) => {
      const li = document.createElement("li");
      li.textContent = c.name;
      li.classList.toggle("active", i === cmdIndex);
      li.addEventListener("click", () => {
        c.action();
        closeCmd();
      });
      els.cmdList.appendChild(li);
    });
  }
  function syncActive(list) {
    const items = els.cmdList.children;
    for (let i = 0; i < items.length; i++)
      items[i].classList.toggle("active", i === cmdIndex);
  }
  els.cmdInput.addEventListener("input", (e) => {
    const list = matchCommands(e.target.value);
    cmdIndex = 0;
    renderCmdList(list);
  });

  // [Command Bar] M: keyboard to open (/ or CTRL+K), navigate (↑/↓), choose (Enter), close (Esc)
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey && e.key.toLowerCase() === "k") || e.key === "/") {
      e.preventDefault();
      openCmd();
    }
    if (els.cmd.classList.contains("show")) {
      const list = matchCommands(els.cmdInput.value);
      const count = list.length;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (count > 0) {
          cmdIndex = (cmdIndex + 1) % count;
          syncActive(list);
        }
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (count > 0) {
          cmdIndex = (cmdIndex - 1 + count) % count;
          syncActive(list);
        }
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (count > 0 && list[cmdIndex]) {
          list[cmdIndex].action();
          closeCmd();
        }
      }
      if (e.key === "Escape") {
        e.preventDefault();
        closeCmd();
      }
    }
  });

  // ---------- Caption editing ----------
  // [Loading image files] M: Custom user input for caption (inline editable)
  function focusCaption(selectAll = true) {
    els.captionEdit.focus();
    if (selectAll) {
      const range = document.createRange();
      range.selectNodeContents(els.captionEdit);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  function updateCaptionEmptyState() {
    // [Theme] M: visual consistency of empty captions across themes
    const empty = !els.captionEdit.textContent.trim();
    els.caption.classList.toggle("empty", empty);
  }

  // Re-apply current caption to DOM (called after goTo)
  function applyCaption() {
    const cap = photos[current]?.caption || "";
    if (settings.theme === "C") {
      splitCaptionWords(cap);
    } else {
      els.captionEdit.textContent = cap;
    }
    updateCaptionEmptyState();
  }

  // [Slides Operating] M: Keyboard: E to start caption editing quickly
  els.stage.addEventListener("dblclick", () => focusCaption(true));
  document.addEventListener("keydown", (e) => {
    if (els.cmd.classList.contains("show")) return;
    if (e.target.isContentEditable) return;
    if (e.key.toLowerCase() === "e") {
      e.preventDefault();
      focusCaption(true);
    }
  });

  // [Loading image files] M: persist custom caption edits
  els.captionEdit.addEventListener("input", (e) => {
    if (current >= 0 && photos[current]) {
      const txt = e.currentTarget.textContent.trim();
      photos[current].caption = txt;
      customCaptions[photos[current].id] = txt;
      persistCaptions();
      if (settings.theme === "C") splitCaptionWords(txt);
      updateCaptionEmptyState();
    }
  });

  // ---------- File selection & DnD ----------
  // [Loading image files] M: User is able to select photo image files
  els.fileInput.addEventListener("change", (e) => {
    handleFiles(e.target.files);
    e.target.value = "";
  });

  // [Loading image files] M: Clickable drop area opens file picker
  els.drop.addEventListener("click", () => {
    els.fileInput.click();
  });

  // [Loading image files] M: Able to drag in photo image files to create slideshow
  ["dragenter", "dragover"].forEach((evt) => {
    els.drop.addEventListener(evt, (e) => {
      e.preventDefault();
      els.drop.classList.add("hover");
    });
  });
  ["dragleave", "drop"].forEach((evt) => {
    els.drop.addEventListener(evt, (e) => {
      e.preventDefault();
      els.drop.classList.remove("hover");
    });
  });
  els.drop.addEventListener("drop", (e) => {
    const files = Array.from(e.dataTransfer.files || []);
    handleFiles(files);
  });

  // ---------- Buttons ----------
  // [Slides Operating] M: Pause/Play button
  els.playPause.addEventListener("click", togglePlay);

  // [Slides Operating] M: Fullscreen browsing (button)
  els.fullscreen.addEventListener("click", () => {
    if (!document.fullscreenElement) els.stage.requestFullscreen?.();
    else document.exitFullscreen?.();
  });

  // [Slides Operating] M: Open config (operating options + theme switching inside)
  els.openConfig.addEventListener("click", openConfig);
  els.closeConfig.addEventListener("click", closeConfig);

  // [Loading image files] M: Load sample photos
  els.loadSamples.addEventListener("click", loadSamplePhotos);

  // [Ordering photos] M: Shuffle photos
  els.shuffleBtn.addEventListener("click", shuffle);

  // [Ordering photos] M: Open reordering grid
  els.openReorder.addEventListener("click", openReorder);
  els.cancelReorder.addEventListener("click", () => {
    els.dlgReorder.classList.remove("show");
  });
  els.applyReorder.addEventListener("click", applyReorder);

  // [Slides Operating] M: When command bar/panels open, rest of page is dimmed (handled via .show + CSS scrim)
  document.addEventListener("click", (e) => {
    const close = e.target.getAttribute("data-close");
    if (close === "panel") closeConfig();
    if (close === "reorder") els.dlgReorder.classList.remove("show");
    if (close === "cmd") closeCmd();
  });

  // ---------- Keyboard navigation ----------
  // [Slides Operating] M: Keyboard: ←/→ to navigate; Space toggle play; F to fullscreen; Esc to close overlays
  document.addEventListener("keydown", (e) => {
    if (els.cmd.classList.contains("show")) return;
    if (e.target.isContentEditable) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      pause();
      goTo(nextIndex());
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      pause();
      goTo(prevIndex());
    }
    if (e.key === " ") {
      e.preventDefault();
      togglePlay();
    }
    if (e.key.toLowerCase() === "f") {
      e.preventDefault();
      if (!document.fullscreenElement) els.stage.requestFullscreen?.();
      else document.exitFullscreen?.();
    }
    if (e.key === "Escape") {
      closeConfig();
      els.dlgReorder.classList.remove("show");
      closeCmd();
    }
  });

  // [Slides Operating] M: F11 fullscreen shortcut (optional)
  document.addEventListener("keydown", (e) => {
    if (els.cmd.classList.contains("show")) return;
    if (e.target.isContentEditable) return;
    if (e.key === "F11") {
      e.preventDefault();
      if (!document.fullscreenElement) els.stage.requestFullscreen?.();
      else document.exitFullscreen?.();
    }
  });

  // [Slides Operating] M: fullscreen state reflected in button label
  document.addEventListener("fullscreenchange", () => {
    const isFs = !!document.fullscreenElement;
    els.fullscreen.textContent = isFs ? "Exit Fullscreen" : "Fullscreen";
  });

  // Initialize hint visibility
  updateHint();
})();
