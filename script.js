
(() => {
  "use strict";

  const LIMIT = 600;

  const els = {
    textInput: document.getElementById("textInput"),
    formatSelect: document.getElementById("formatSelect"),
    includeSpaces: document.getElementById("includeSpaces"),
    escapeBrackets: document.getElementById("escapeBrackets"),
    stops: document.getElementById("stops"),
    addStopBtn: document.getElementById("addStopBtn"),
    reverseBtn: document.getElementById("reverseBtn"),
    rainbowBtn: document.getElementById("rainbowBtn"),
    output: document.getElementById("output"),
    preview: document.getElementById("preview"),
    copyBtn: document.getElementById("copyBtn"),
    clearBtn: document.getElementById("clearBtn"),
    limitBadge: document.getElementById("limitBadge"),
    charCount: document.getElementById("charCount"),
    coloredCount: document.getElementById("coloredCount"),
    bbCount: document.getElementById("bbCount"),
    maxAdd: document.getElementById("maxAdd"),
    toast: document.getElementById("toast"),
  };

  let toastTimer = null;
  function showToast(msg){
    if (!els.toast) return;
    els.toast.textContent = msg;
    els.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove("show"), 900);
  }

  function setupFormatDropdown(){
    const select = els.formatSelect;
    if (!select) return;

    const host = select.closest(".pill.select");
    if (!host) return;

    // Avoid double init
    if (host.querySelector(".format-btn")) return;

    host.classList.add("dropdown");
    // Keep the real <select> for accessibility, but hide it visually
    select.classList.add("sr-only");
    select.setAttribute("aria-hidden", "true");
    select.tabIndex = -1;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "format-btn";
    btn.setAttribute("aria-haspopup", "listbox");
    btn.setAttribute("aria-expanded", "false");

    const menu = document.createElement("div");
    menu.className = "format-menu";
    menu.setAttribute("role", "listbox");
    menu.setAttribute("aria-label", "Output format");
    menu.setAttribute("aria-hidden", "true");

    const optionBtns = [];
    [...select.options].forEach((opt) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "format-opt";
      b.setAttribute("role", "option");
      b.dataset.value = opt.value;
      b.textContent = opt.textContent;
      optionBtns.push(b);
      menu.appendChild(b);
    });

    function isOpen(){ return host.classList.contains("open"); }

    function syncFromSelect(){
      btn.textContent = select.options[select.selectedIndex]?.textContent || "Format";
      optionBtns.forEach((b) => {
        const sel = b.dataset.value === select.value;
        b.setAttribute("aria-selected", sel ? "true" : "false");
        // Prevent focusing hidden options when the menu is closed
        b.tabIndex = isOpen() ? (sel ? 0 : -1) : -1;
      });
    }

    function openMenu(){
      host.classList.add("open");
      btn.setAttribute("aria-expanded", "true");
      menu.setAttribute("aria-hidden", "false");
      syncFromSelect();
      (optionBtns.find(b => b.dataset.value === select.value) || optionBtns[0])?.focus();
    }

    function closeMenu({ focusButton = true } = {}){
      host.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
      menu.setAttribute("aria-hidden", "true");
      // When closed, ensure options aren't tabbable
      optionBtns.forEach(b => b.tabIndex = -1);

      if (focusButton){
        btn.focus({ preventScroll: true });
      } else if (menu.contains(document.activeElement)) {
        // Avoid leaving focus on hidden menu options
        document.activeElement.blur();
      }
    }

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (isOpen()) closeMenu({ focusButton: false });
      else openMenu();
    });

    // Make the entire pill clickable (label/empty space/chevron area),
    // not just the button text.
    host.addEventListener("click", (e) => {
      if (e.target.closest(".format-menu")) return;
      if (e.target.closest(".format-btn")) return; // button handles itself
      if (isOpen()) closeMenu({ focusButton: false });
      else openMenu();
    });

    btn.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " "){
        e.preventDefault();
        openMenu();
      }
    });

    menu.addEventListener("click", (e) => {
      e.stopPropagation();
      const b = e.target.closest(".format-opt");
      if (!b) return;
      const val = b.dataset.value;
      if (val){
        select.value = val;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
      closeMenu();
    });

    menu.addEventListener("keydown", (e) => {
      const current = document.activeElement;
      const idx = optionBtns.indexOf(current);
      if (e.key === "Escape"){
        e.preventDefault();
        closeMenu();
      } else if (e.key === "ArrowDown"){
        e.preventDefault();
        optionBtns[Math.min(optionBtns.length - 1, Math.max(0, idx) + 1)]?.focus();
      } else if (e.key === "ArrowUp"){
        e.preventDefault();
        optionBtns[Math.max(0, Math.max(0, idx) - 1)]?.focus();
      } else if (e.key === "Home"){
        e.preventDefault();
        optionBtns[0]?.focus();
      } else if (e.key === "End"){
        e.preventDefault();
        optionBtns[optionBtns.length - 1]?.focus();
      } else if (e.key === "Enter" || e.key === " "){
        e.preventDefault();
        if (current && current.classList.contains("format-opt")) current.click();
      }
    });

    // Close when clicking outside
    document.addEventListener("pointerdown", (e) => {
      if (!isOpen()) return;
      if (!host.contains(e.target)) closeMenu({ focusButton: false });
    });

    // Keep in sync if assistive tech changes the real <select>
    select.addEventListener("change", syncFromSelect);

    syncFromSelect();
    host.appendChild(btn);
    host.appendChild(menu);
  }

  function setupStopDragAndDrop(){
    let state = null;

    function listItems(){
      return [...els.stops.querySelectorAll(".stop:not(.dragging):not(.placeholder)")];
    }

    function getAfterElement(y){
      let closest = { offset: Number.NEGATIVE_INFINITY, element: null };
      for (const el of listItems()){
        const box = el.getBoundingClientRect();
        const offset = y - (box.top + box.height / 2);
        if (offset < 0 && offset > closest.offset){
          closest = { offset, element: el };
        }
      }
      return closest.element;
    }

    function cleanup(commit){
      if (!state) return;

      const { item, placeholder } = state;

      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);

      if (commit){
        els.stops.insertBefore(item, placeholder);
      }
      placeholder.remove();

      item.classList.remove("dragging");
      item.style.position = "";
      item.style.left = "";
      item.style.top = "";
      item.style.width = "";
      item.style.zIndex = "";
      item.style.pointerEvents = "";

      document.body.classList.remove("dragging");

      state = null;
      renumberStops();
      update();
    }

    function onMove(e){
      if (!state || e.pointerId !== state.pointerId) return;
      state.item.style.top = (e.clientY - state.offsetY) + "px";

      const after = getAfterElement(e.clientY);
      if (!after) els.stops.appendChild(state.placeholder);
      else els.stops.insertBefore(state.placeholder, after);
    }

    function onUp(e){
      if (!state || e.pointerId !== state.pointerId) return;
      cleanup(true);
    }

    els.stops.addEventListener("pointerdown", (e) => {
      const handle = e.target.closest(".drag-handle");
      if (!handle) return;

      const item = handle.closest(".stop");
      if (!item) return;

      // Primary button only (left click / touch)
      if (e.button !== undefined && e.button !== 0) return;

      // Don't start another drag while one is active
      if (state) return;

      e.preventDefault();

      const rect = item.getBoundingClientRect();
      const placeholder = document.createElement("div");
      placeholder.className = "stop placeholder";
      placeholder.style.height = rect.height + "px";
      placeholder.setAttribute("aria-hidden", "true");

      // Put placeholder right where the item was
      els.stops.insertBefore(placeholder, item.nextSibling);

      item.classList.add("dragging");
      document.body.classList.add("dragging");

      item.style.position = "fixed";
      item.style.left = rect.left + "px";
      item.style.top = rect.top + "px";
      item.style.width = rect.width + "px";
      item.style.zIndex = "9999";
      item.style.pointerEvents = "none";

      state = {
        pointerId: e.pointerId,
        item,
        placeholder,
        offsetY: e.clientY - rect.top,
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    });
  }

  function clamp01(x){ return Math.max(0, Math.min(1, x)); }

  function normalizeHex(input){
    let s = (input || "").trim();
    if (!s) return null;
    if (s[0] !== "#") s = "#" + s;
    if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s)) return null;
    if (s.length === 4){
      s = "#" + [...s.slice(1)].map(ch => ch + ch).join("");
    }
    return s.toUpperCase();
  }

  function hexToRgb(hex){
    const h = normalizeHex(hex);
    if (!h) return null;
    const r = parseInt(h.slice(1,3), 16);
    const g = parseInt(h.slice(3,5), 16);
    const b = parseInt(h.slice(5,7), 16);
    return { r, g, b };
  }

  function rgbToHex(c){
    return "#" + [c.r, c.g, c.b].map(x => x.toString(16).padStart(2,"0")).join("").toUpperCase();
  }

function rgbToHsv(c){
  const R = c.r / 255;
  const G = c.g / 255;
  const B = c.b / 255;

  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const d = max - min;

  let h = 0;
  if (d === 0) h = 0;
  else if (max === R) h = 60 * (((G - B) / d) % 6);
  else if (max === G) h = 60 * (((B - R) / d) + 2);
  else h = 60 * (((R - G) / d) + 4);

  if (h < 0) h += 360;

  const s = max === 0 ? 0 : d / max;
  const v = max;

  return { h, s, v };
}

function hsvToRgb(h, s, v){
  h = ((h % 360) + 360) % 360;
  s = clamp01(s);
  v = clamp01(v);

  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;

  let r1 = 0, g1 = 0, b1 = 0;
  if (h < 60){ r1 = c; g1 = x; b1 = 0; }
  else if (h < 120){ r1 = x; g1 = c; b1 = 0; }
  else if (h < 180){ r1 = 0; g1 = c; b1 = x; }
  else if (h < 240){ r1 = 0; g1 = x; b1 = c; }
  else if (h < 300){ r1 = x; g1 = 0; b1 = c; }
  else { r1 = c; g1 = 0; b1 = x; }

  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

const colorPicker = (() => {
  const pop = document.createElement("div");
  pop.className = "cp-pop";
  pop.id = "colorPopover";
  pop.setAttribute("role", "dialog");
  pop.setAttribute("aria-label", "Color picker");
  pop.setAttribute("aria-hidden", "true");

  pop.innerHTML = `
    <div class="cp-top">
      <div class="cp-title">Pick a color</div>
      <button type="button" class="cp-done">Done</button>
    </div>

    <div class="cp-sv" tabindex="0" aria-label="Saturation and brightness">
      <div class="cp-white"></div>
      <div class="cp-black"></div>
      <div class="cp-cursor" aria-hidden="true"></div>
    </div>

    <div class="cp-row">
      <input class="cp-hue" type="range" min="0" max="360" value="210" aria-label="Hue"/>
    </div>

    <div class="cp-row">
      <div class="cp-mini" aria-hidden="true"></div>
      <input class="cp-hex" type="text" spellcheck="false" aria-label="Hex color"/>
    </div>
  `;

  document.body.appendChild(pop);

  const sv = pop.querySelector(".cp-sv");
  const cursor = pop.querySelector(".cp-cursor");
  const hue = pop.querySelector(".cp-hue");
  const hex = pop.querySelector(".cp-hex");
  const mini = pop.querySelector(".cp-mini");
  const done = pop.querySelector(".cp-done");

  let active = null; // { swatchBtn, hexInput }
  let hsv = { h: 210, s: 0.55, v: 1 };

  function isOpen(){ return pop.classList.contains("open"); }

  function clampIntoViewport(x, y, w, h, pad = 12){
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    x = Math.max(pad, Math.min(vw - w - pad, x));
    y = Math.max(pad, Math.min(vh - h - pad, y));
    return { x, y };
  }

  function position(anchorEl){
    const a = anchorEl.getBoundingClientRect();
    const w = pop.offsetWidth;
    const h = pop.offsetHeight;

    // Prefer below; if not enough space, flip above
    let x = a.left;
    let y = a.bottom + 10;
    if (y + h + 12 > window.innerHeight){
      y = a.top - h - 10;
    }

    const p = clampIntoViewport(x, y, w, h);
    pop.style.left = p.x + "px";
    pop.style.top = p.y + "px";
  }

  function writeToActive(hexOut){
    if (!active) return;
    active.hexInput.value = hexOut;
    active.hexInput.dataset.lastValid = hexOut;
    active.hexInput.classList.remove("invalid");
    active.swatchBtn.style.setProperty("--swatch", hexOut);
    update();
  }

  function syncUi({ updateHexField = true } = {}){
    pop.style.setProperty("--cp-h", hsv.h.toFixed(2));

    const rect = sv.getBoundingClientRect();
    const x = hsv.s * rect.width;
    const y = (1 - hsv.v) * rect.height;
    cursor.style.left = x + "px";
    cursor.style.top = y + "px";

    const hexOut = rgbToHex(hsvToRgb(hsv.h, hsv.s, hsv.v));
    pop.style.setProperty("--cp-hex", hexOut);
    mini.style.background = hexOut;

    if (updateHexField){
      hex.value = hexOut;
      hex.classList.remove("invalid");
    }

    writeToActive(hexOut);
  }

  function setFromHex(h){
    const rgb = hexToRgb(h);
    if (!rgb) return;

    const t = rgbToHsv(rgb);
    hsv = { h: t.h, s: t.s, v: t.v };
    hue.value = String(Math.round(hsv.h));

    // Wait a frame so the SV rect is accurate after positioning
    requestAnimationFrame(() => syncUi({ updateHexField: true }));
  }

  function open(anchorEl, hexInput){
    active = { swatchBtn: anchorEl, hexInput };

    const initial =
      normalizeHex(hexInput.value) ||
      normalizeHex(hexInput.dataset.lastValid) ||
      "#85B9FF";

    pop.classList.add("open");
    pop.setAttribute("aria-hidden", "false");

    requestAnimationFrame(() => {
      position(anchorEl);
      setFromHex(initial);
      sv.focus({ preventScroll: true });
    });
  }

  function close(){
    pop.classList.remove("open");
    pop.setAttribute("aria-hidden", "true");
    active = null;
  }

  function setSVFromEvent(e){
    const r = sv.getBoundingClientRect();
    hsv.s = clamp01((e.clientX - r.left) / r.width);
    hsv.v = clamp01(1 - (e.clientY - r.top) / r.height);
    syncUi({ updateHexField: true });
  }

  // SV square drag
  sv.addEventListener("pointerdown", (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();

    sv.setPointerCapture(e.pointerId);
    setSVFromEvent(e);

    const onMove = (ev) => {
      if (ev.pointerId !== e.pointerId) return;
      setSVFromEvent(ev);
    };
    const onUp = (ev) => {
      if (ev.pointerId !== e.pointerId) return;
      try{ sv.releasePointerCapture(e.pointerId); } catch {}
      sv.removeEventListener("pointermove", onMove);
      sv.removeEventListener("pointerup", onUp);
      sv.removeEventListener("pointercancel", onUp);
    };

    sv.addEventListener("pointermove", onMove);
    sv.addEventListener("pointerup", onUp);
    sv.addEventListener("pointercancel", onUp);
  });

  // Keyboard on SV square
  sv.addEventListener("keydown", (e) => {
    const step = e.shiftKey ? 0.05 : 0.015;
    if (e.key === "ArrowLeft"){ e.preventDefault(); hsv.s = clamp01(hsv.s - step); syncUi(); }
    else if (e.key === "ArrowRight"){ e.preventDefault(); hsv.s = clamp01(hsv.s + step); syncUi(); }
    else if (e.key === "ArrowUp"){ e.preventDefault(); hsv.v = clamp01(hsv.v + step); syncUi(); }
    else if (e.key === "ArrowDown"){ e.preventDefault(); hsv.v = clamp01(hsv.v - step); syncUi(); }
  });

  // Hue slider
  hue.addEventListener("input", () => {
    hsv.h = +hue.value;
    syncUi({ updateHexField: true });
  });

  // Manual hex typing inside picker
  hex.addEventListener("input", () => {
    const h = normalizeHex(hex.value);
    if (!h){
      hex.classList.add("invalid");
      return;
    }
    hex.classList.remove("invalid");
    setFromHex(h);
  });

  done.addEventListener("click", close);

  // Close on click outside / escape
  document.addEventListener("pointerdown", (e) => {
    if (!isOpen()) return;
    if (pop.contains(e.target)) return;
    if (active && (e.target === active.swatchBtn || active.swatchBtn.contains(e.target))) return;
    close();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen()){
      e.preventDefault();
      close();
    }
  });

  // If layout changes while open, reposition
  window.addEventListener("resize", () => {
    if (isOpen() && active) position(active.swatchBtn);
  });
  window.addEventListener("scroll", () => {
    if (isOpen()) close();
  }, true);

  return { open, close };
})();

  function lerp(a,b,t){ return a + (b - a) * t; }
  function lerpRgb(c1, c2, t){
    return {
      r: Math.round(lerp(c1.r, c2.r, t)),
      g: Math.round(lerp(c1.g, c2.g, t)),
      b: Math.round(lerp(c1.b, c2.b, t)),
    };
  }

  // Rainbow helpers
  function hslToRgb(h, s, l){
    h = ((h % 360) + 360) % 360;
    s = clamp01(s / 100);
    l = clamp01(l / 100);

    const c = (1 - Math.abs(2*l - 1)) * s;
    const hh = h / 60;
    const x = c * (1 - Math.abs((hh % 2) - 1));

    let r1 = 0, g1 = 0, b1 = 0;
    if (hh >= 0 && hh < 1){ r1 = c; g1 = x; b1 = 0; }
    else if (hh >= 1 && hh < 2){ r1 = x; g1 = c; b1 = 0; }
    else if (hh >= 2 && hh < 3){ r1 = 0; g1 = c; b1 = x; }
    else if (hh >= 3 && hh < 4){ r1 = 0; g1 = x; b1 = c; }
    else if (hh >= 4 && hh < 5){ r1 = x; g1 = 0; b1 = c; }
    else { r1 = c; g1 = 0; b1 = x; }

    const m = l - c / 2;
    return {
      r: Math.round((r1 + m) * 255),
      g: Math.round((g1 + m) * 255),
      b: Math.round((b1 + m) * 255),
    };
  }

  function makeRainbowHexStops(count){
    const H0 = 0;
    const H1 = 300;
    const S = 100;
    const L = 55;

    const n = Math.max(2, Math.floor(count || 0));
    const out = [];
    for (let i = 0; i < n; i++){
      const t = n === 1 ? 0 : i / (n - 1);
      const h = lerp(H0, H1, t);
      out.push(rgbToHex(hslToRgb(h, S, L)));
    }
    return out;
  }

  function countGradientTargets(text, includeSpaces){
    const chars = [...(text || "")];
    let n = 0;
    for (let i = 0; i < chars.length; i++){
      if (includeSpaces || !/\s/.test(chars[i])) n++;
    }
    return n;
  }

  function replaceStops(hexes){
    els.stops.innerHTML = "";
    (hexes || []).forEach(h => addStop(h));
    update();
  }

  function rainbowFy(){
    const text = els.textInput.value || "";
    const includeSpaces = els.includeSpaces.checked;
    const N = countGradientTargets(text, includeSpaces);

    const MAX_STOPS = 24;
    const stopCount = N > 0 ? Math.min(MAX_STOPS, Math.max(2, N)) : 7;
    replaceStops(makeRainbowHexStops(stopCount));
  }

  function escapeForBBCodeChar(ch){
    if (ch === "[") return "&#91;";
    if (ch === "]") return "&#93;";
    return ch;
  }

  function getStops(){
    const nodes = [...els.stops.querySelectorAll(".stop:not(.placeholder)")];
    const stops = nodes.map(n => {
      const hexEl = n.querySelector('input[type="text"].hex');
      const typed = normalizeHex(hexEl.value);
      const fallback = normalizeHex(hexEl.dataset.lastValid || "");
      return typed || fallback;
    }).filter(Boolean);
    return stops;
  }

  function addStop(hex){
    const safe = normalizeHex(hex) || "#85B9FF";
    const idx = els.stops.children.length + 1;

    const div = document.createElement("div");
    div.className = "stop";
    div.innerHTML = `
      <button class="btn icon drag-handle" type="button" title="Drag to reorder" aria-label="Drag to reorder">⠿</button>
      <span class="name">Stop ${idx}</span>
      <button class="swatch-btn" type="button" title="Pick color" aria-label="Pick color" style="--swatch:${safe}"></button>
      <input type="text" class="hex" value="${safe}" spellcheck="false" aria-label="Hex color"/>
      <span class="spacer"></span>
      <button class="btn icon" type="button" title="Move up" aria-label="Move up">↑</button>
      <button class="btn icon" type="button" title="Move down" aria-label="Move down">↓</button>
      <button class="btn icon" type="button" title="Remove" aria-label="Remove">✕</button>
    `;

    const swatch = div.querySelector('.swatch-btn');
    const hexIn = div.querySelector('input[type="text"].hex');
    const upBtn = div.querySelector('button[aria-label="Move up"]');
    const downBtn = div.querySelector('button[aria-label="Move down"]');
    const rmBtn = div.querySelector('button[aria-label="Remove"]');

    hexIn.dataset.lastValid = safe;
    setSwatch(safe);

    function setSwatch(hex){
      swatch.style.setProperty("--swatch", hex);
      swatch.setAttribute("aria-label", `Pick color ${hex}`);
    }
    function syncFromHex(){
      const h = normalizeHex(hexIn.value);
      if (h){
        setSwatch(h);
        hexIn.value = h;
        hexIn.dataset.lastValid = h;
        hexIn.classList.remove("invalid");
      } else {
        hexIn.classList.add("invalid");
      }
      update();
    }

    hexIn.addEventListener("input", syncFromHex);
    swatch.addEventListener("click", () => colorPicker.open(swatch, hexIn));

    upBtn.addEventListener("click", () => {
      const prev = div.previousElementSibling;
      if (prev) els.stops.insertBefore(div, prev);
      renumberStops();
      update();
    });

    downBtn.addEventListener("click", () => {
      const next = div.nextElementSibling;
      if (next) els.stops.insertBefore(next, div);
      renumberStops();
      update();
    });

    rmBtn.addEventListener("click", () => {
      div.remove();
      renumberStops();
      update();
    });

    els.stops.appendChild(div);
    renumberStops();
  }

  function renumberStops(){
    [...els.stops.querySelectorAll(".stop .name")].forEach((el, i) => {
      el.textContent = `Stop ${i+1}`;
    });
  }

  function reverseStops(){
    const items = [...els.stops.children];
    items.reverse().forEach(n => els.stops.appendChild(n));
    renumberStops();
  }

  function buildGradient(text, stopHexes, includeSpaces, escapeBrackets, format){
    const chars = [...text];
    if (chars.length === 0) return { bbcode: "", coloredN: 0 };

    const stops = stopHexes.map(hexToRgb).filter(Boolean);
    if (stops.length < 2){
      return { bbcode: "Add at least 2 valid colors.", coloredN: 0 };
    }

    const targets = [];
    for (let i = 0; i < chars.length; i++){
      if (includeSpaces || !/\s/.test(chars[i])) targets.push(i);
    }
    if (targets.length === 0){
      const raw = escapeBrackets ? chars.map(escapeForBBCodeChar).join("") : text;
      return { bbcode: raw, coloredN: 0 };
    }

    const N = targets.length;
    const parts = chars.slice();

    for (let k = 0; k < N; k++){
      const idx = targets[k];
      const globalT = N === 1 ? 0 : k / (N - 1);

      const segFloat = globalT * (stops.length - 1);
      const seg = Math.min(stops.length - 2, Math.max(0, Math.floor(segFloat)));
      const localT = segFloat - seg;

      const c = lerpRgb(stops[seg], stops[seg+1], clamp01(localT));
      const rawCh = parts[idx];
      const ch = escapeBrackets ? escapeForBBCodeChar(rawCh) : rawCh;

      if (format === "rgb"){
        parts[idx] = `[COLOR=rgb(${c.r}, ${c.g}, ${c.b})]${ch}[/COLOR]`;
      } else {
        parts[idx] = `[COLOR=${rgbToHex(c)}]${ch}[/COLOR]`;
      }
    }

    // Escape brackets in uncolored chars too (like spaces)
    if (escapeBrackets){
      for (let i = 0; i < parts.length; i++){
        if (typeof parts[i] === "string" && !parts[i].startsWith("[COLOR=")){
          parts[i] = parts[i].replaceAll("[", "&#91;").replaceAll("]", "&#93;");
        }
      }
    }

    return { bbcode: parts.join(""), coloredN: N };
  }

  function renderPreview(text, stopHexes, includeSpaces){
    const chars = [...text];
    els.preview.innerHTML = "";

    if (!chars.length){
      els.preview.innerHTML = `<span style="color: rgba(255,255,255,.55)">Preview will appear here…</span>`;
      return;
    }

    const stops = stopHexes.map(hexToRgb).filter(Boolean);
    if (stops.length < 2){
      els.preview.innerHTML = `<span style="color: rgba(255,255,255,.65)">Add at least 2 valid colors.</span>`;
      return;
    }

    const targets = [];
    for (let i = 0; i < chars.length; i++){
      if (includeSpaces || !/\s/.test(chars[i])) targets.push(i);
    }
    const N = targets.length;

    const idxToK = new Map();
    targets.forEach((idx, k) => idxToK.set(idx, k));

    for (let i = 0; i < chars.length; i++){
      const span = document.createElement("span");
      span.className = "ch";
      span.textContent = chars[i];

      const k = idxToK.get(i);
      if (k !== undefined && N > 0){
        const globalT = N === 1 ? 0 : k / (N - 1);
        const segFloat = globalT * (stops.length - 1);
        const seg = Math.min(stops.length - 2, Math.max(0, Math.floor(segFloat)));
        const localT = segFloat - seg;
        const c = lerpRgb(stops[seg], stops[seg+1], clamp01(localT));
        span.style.color = `rgb(${c.r}, ${c.g}, ${c.b})`;
      } else {
        span.style.color = "rgba(255,255,255,.85)";
      }

      els.preview.appendChild(span);
    }
  }

  function estimateCanAdd(baseText, stopHexes, includeSpaces, escapeBrackets, format, baseOutLen){
    // Upper bound is small because LIMIT is small. Keep this fast and predictable.
    if (baseOutLen > LIMIT) return 0;

    const MAX_TRY = 120; // plenty (hex max is ~25 chars before 600)
    let lo = 0, hi = MAX_TRY;

    while (lo < hi){
      const mid = Math.ceil((lo + hi) / 2);
      const t = baseText + "a".repeat(mid);
      const { bbcode } = buildGradient(t, stopHexes, includeSpaces, escapeBrackets, format);
      const L = (bbcode || "").length;
      if (L <= LIMIT) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  function update(){
    const text = els.textInput.value || "";
    const stopHexes = getStops();
    const includeSpaces = els.includeSpaces.checked;
    const escapeBrackets = els.escapeBrackets.checked;
    const format = els.formatSelect.value;

    els.charCount.textContent = `Chars: ${[...text].length}`;

    const { bbcode, coloredN } = buildGradient(text, stopHexes, includeSpaces, escapeBrackets, format);
    const out = bbcode || "";

    els.output.textContent = out;
    els.coloredCount.textContent = `Colored: ${coloredN}`;
    els.bbCount.textContent = `BBCode len: ${out.length}`;
    els.limitBadge.textContent = `Output: ${out.length} / ${LIMIT}`;
    els.limitBadge.className = "badge " + (out.length > LIMIT ? "warn" : "ok");

    renderPreview(text, stopHexes, includeSpaces);

    const canAdd = estimateCanAdd(text, stopHexes, includeSpaces, escapeBrackets, format, out.length);
    els.maxAdd.textContent = `Can add: ${canAdd}`;

    // Disable copy when there's nothing meaningful to copy
    els.copyBtn.disabled = out.length === 0;
    els.copyBtn.style.opacity = out.length === 0 ? "0.55" : "1";
  }

  async function copyOutput(){
    const text = els.output.textContent || "";
    if (!text) return;

    try{
      await navigator.clipboard.writeText(text);
      const old = els.copyBtn.textContent;
      els.copyBtn.textContent = "Copied ✓";
      showToast("Copied BBCode");
      setTimeout(() => { els.copyBtn.textContent = old; }, 900);
    } catch (e){
      const range = document.createRange();
      range.selectNodeContents(els.output);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      alert("Clipboard permission blocked. Output selected — press Ctrl+C / Cmd+C to copy.");
    }
  }

  function clearAll(){
    els.textInput.value = "";
    update();
    els.textInput.focus();
  }

    // Enhance UI
  setupFormatDropdown();
  setupStopDragAndDrop();

// Events
  els.textInput.addEventListener("input", update);
  els.formatSelect.addEventListener("change", update);
  els.includeSpaces.addEventListener("change", update);
  els.escapeBrackets.addEventListener("change", update);
  els.copyBtn.addEventListener("click", copyOutput);
  els.clearBtn.addEventListener("click", clearAll);
  els.addStopBtn.addEventListener("click", () => { addStop("#FFFFFF"); update(); });
  els.reverseBtn.addEventListener("click", () => { reverseStops(); update(); });
  if (els.rainbowBtn) els.rainbowBtn.addEventListener("click", rainbowFy);

  // Init with 3 stops for "more than 2 colors"
  addStop("#85B9FF");
  addStop("#B59CFF");
  addStop("#D064FF");
  update();
})();
