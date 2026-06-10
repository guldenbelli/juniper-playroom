/* Juniper's Playroom — shared engine */
window.JS = (function () {
  "use strict";

  /* ---------- gesture lockdown ---------- */
  document.addEventListener("touchmove", function (e) { e.preventDefault(); }, { passive: false });
  document.addEventListener("gesturestart", function (e) { e.preventDefault(); });
  document.addEventListener("dblclick", function (e) { e.preventDefault(); });
  document.addEventListener("contextmenu", function (e) { e.preventDefault(); });

  /* ---------- helpers ---------- */
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
  function rand(a, b) { return a + Math.random() * (b - a); }

  /* ---------- audio ---------- */
  var AC = window.AudioContext || window.webkitAudioContext;
  var ctx = null;
  var api = { soundOn: true, pick: pick, rand: rand };

  function ensureAudio() {
    if (!AC) return;
    if (!ctx) ctx = new AC();
    if (ctx.state === "suspended") ctx.resume();
  }
  document.addEventListener("pointerdown", ensureAudio, true);

  api.tone = function (o) {
    if (!api.soundOn || !ctx || ctx.state !== "running") return;
    o = o || {};
    var t = ctx.currentTime + (o.delay || 0);
    var dur = o.dur || 0.3;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = o.type || "sine";
    osc.frequency.setValueAtTime(o.freq || 440, t);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(o.slide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol || 0.15, t + (o.attack || 0.012));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  };

  api.noise = function (o) {
    if (!api.soundOn || !ctx || ctx.state !== "running") return;
    o = o || {};
    var t = ctx.currentTime + (o.delay || 0);
    var dur = o.dur || 0.3;
    var len = Math.max(1, (dur * ctx.sampleRate) | 0);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var f = ctx.createBiquadFilter();
    f.type = o.filter || "bandpass";
    f.Q.value = o.q || 1;
    f.frequency.setValueAtTime(o.from || 400, t);
    f.frequency.exponentialRampToValueAtTime(o.to || (o.from || 400), t + dur);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol || 0.12, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(ctx.destination);
    src.start(t);
    src.stop(t + dur + 0.05);
  };

  api.speak = function (text, opts) {
    if (!api.soundOn) return;
    opts = opts || {};
    try {
      if (!("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.rate = opts.rate || 0.85;
      u.pitch = opts.pitch || 1.4;
      u.volume = opts.volume || 0.9;
      window.speechSynthesis.speak(u);
    } catch (e) { /* speech unavailable — synth sounds still play */ }
  };

  /* ---------- generic particle burst ---------- */
  api.burst = function (x, y, o) {
    o = o || {};
    var stage = o.stage || document.body;
    var chars = o.chars || ["✦", "✧", "•"];
    var colors = o.colors || ["#ffb3c6", "#ffd6a5", "#9bf6ff", "#bdb2ff", "#fdffb6"];
    var n = o.count || 10;
    for (var i = 0; i < n; i++) {
      var el = document.createElement("div");
      el.className = "js-spark";
      el.textContent = pick(chars);
      el.style.color = pick(colors);
      el.style.fontSize = rand(o.sizeMin || 10, o.sizeMax || 26) + "px";
      el.style.left = x + "px";
      el.style.top = y + "px";
      var ang = o.up ? (Math.PI + rand(0, Math.PI)) : rand(0, Math.PI * 2);
      var dist = rand(o.distMin || 30, o.distMax || 100);
      el.style.setProperty("--dx", (Math.cos(ang) * dist).toFixed(0) + "px");
      el.style.setProperty("--dy", (Math.sin(ang) * dist).toFixed(0) + "px");
      el.style.setProperty("--spin", (rand(-140, 140)).toFixed(0) + "deg");
      el.style.setProperty("--bd", (o.dur || 0.8) + "s");
      el.addEventListener("animationend", function (e) { e.target.remove(); });
      stage.appendChild(el);
    }
  };

  /* ---------- parent chips (hold 1 second) ---------- */
  function holdChip(el, cb) {
    var timer = null;
    var holding = false;

    /* capture:true so we intercept before any game listener sees it */
    el.addEventListener("pointerdown", function (e) {
      e.stopPropagation();
      e.preventDefault();
      holding = true;
      el.setPointerCapture(e.pointerId);
      el.classList.add("holding");
      timer = setTimeout(function () {
        if (!holding) return;
        holding = false;
        el.classList.remove("holding");
        cb();
      }, 1000);
    }, { capture: true });

    function cancel(e) {
      if (!holding) return;
      holding = false;
      clearTimeout(timer);
      el.classList.remove("holding");
      try { el.releasePointerCapture(e.pointerId); } catch (ex) {}
    }
    /* cancel only if finger lifted or left the element */
    el.addEventListener("pointerup",     cancel, { capture: true });
    el.addEventListener("pointercancel", cancel, { capture: true });
    el.addEventListener("lostpointercapture", function () {
      holding = false;
      clearTimeout(timer);
      el.classList.remove("holding");
    });
  }

  api.makeChips = function (opts) {
    opts = opts || {};
    if (opts.home !== false) {
      var h = document.createElement("div");
      h.className = "js-chip js-chip-left";
      h.textContent = "🏠";
      document.body.appendChild(h);
      holdChip(h, function () { location.href = "index.html"; });
    }
    if (opts.sound !== false) {
      var s = document.createElement("div");
      s.className = "js-chip js-chip-right";
      s.textContent = "🔊";
      document.body.appendChild(s);
      holdChip(s, function () {
        api.soundOn = !api.soundOn;
        if (!api.soundOn) { try { window.speechSynthesis.cancel(); } catch (e) {} }
        s.textContent = api.soundOn ? "🔊" : "🔇";
      });
    }
  };

  /* ---------- shared styles ---------- */
  var style = document.createElement("style");
  style.textContent =
    ".js-chip{position:absolute;width:58px;height:58px;border-radius:50%;" +
    "background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;" +
    "font-size:26px;opacity:.75;z-index:999;transition:transform .2s, background .2s;" +
    "touch-action:none;-webkit-user-select:none;user-select:none;}" +
    ".js-chip.holding{background:rgba(255,255,255,.45);transform:scale(1.2);opacity:1;}" +
    ".js-chip-left{top:calc(env(safe-area-inset-top,0px) + 12px);left:calc(env(safe-area-inset-left,0px) + 12px);}" +
    ".js-chip-right{top:calc(env(safe-area-inset-top,0px) + 12px);right:calc(env(safe-area-inset-right,0px) + 12px);}" +
    ".js-spark{position:absolute;transform:translate(-50%,-50%);pointer-events:none;line-height:1;" +
    "will-change:transform,opacity;animation:jsburst var(--bd,.8s) cubic-bezier(.1,.8,.4,1) forwards;}" +
    "@keyframes jsburst{0%{transform:translate(-50%,-50%) translate(0,0) scale(.4) rotate(0);opacity:1;}" +
    "100%{transform:translate(-50%,-50%) translate(var(--dx),var(--dy)) scale(1) rotate(var(--spin));opacity:0;}}";
  document.head.appendChild(style);

  return api;
})();
