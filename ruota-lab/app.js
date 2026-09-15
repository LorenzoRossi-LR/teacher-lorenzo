/* Ruota Lab — trainer completo per La Ruota della Fortuna (italiano) */
(function () {
  "use strict";

  /* ══════════════════════════════════════════════════════════
     Costanti di gioco
     ══════════════════════════════════════════════════════════ */

  var CONS = "BCDFGHJKLMNPQRSTVWXYZ".split("");
  var VOW = "AEIOU".split("");
  var FREQ = { N: 6.9, L: 6.5, R: 6.4, T: 5.6, S: 5.0, C: 4.5, D: 3.7, P: 3.1,
    M: 2.5, V: 2.1, G: 1.6, H: 1.5, F: 1.2, Z: 0.9, B: 0.9, Q: 0.5,
    J: .05, K: .05, W: .05, X: .05, Y: .05 };
  var VOWEL_COST = 200;

  var WHEEL = [
    { v: 500 }, { v: 900 }, { v: "BANCAROTTA" }, { v: 700 }, { v: 600 }, { v: 1000 },
    { v: "PASSA" }, { v: 800 }, { v: 1500 }, { v: 400 }, { v: 300 }, { v: "BANCAROTTA" },
    { v: 2000 }, { v: 600 }, { v: "JOLLY" }, { v: 700 }, { v: 900 }, { v: 500 },
    { v: 1200 }, { v: "PASSA" }, { v: 800 }, { v: 3000 }, { v: 400 }, { v: 1000 }
  ];

  var THEMED = [
    { cat: "animali", nome: "Il regno degli animali" },
    { cat: "cucina", nome: "La locanda di Samira" },
    { cat: "musica", nome: "Manche musicale" },
    { cat: "luoghi", nome: "Giro d'Italia" },
    { cat: "film", nome: "Ciak si gira" },
    { cat: "modi-di-dire", nome: "Chiacchiere da bar" }
  ];

  function buildManches() {
    var th = shuffle(THEMED).slice(0, 2);
    return [
      { type: "wheel", nome: "Manche classica" },
      { type: "wheel", nome: th[0].nome, cat: th[0].cat },
      { type: "buzz", kind: "cruci", nome: "CruciRuota", n: 4 },
      { type: "wheel", nome: th[1].nome, cat: th[1].cat },
      { type: "buzz", kind: "triplete", nome: "Triplete", n: 3 },
      { type: "wheel", nome: "Ultimo round", fixed: true }
    ];
  }

  var MISTAKE_LABEL = {
    giro_avido: "Giro avido (avevi abbastanza per risolvere)",
    bancarotta_evitabile: "Bancarotta su montepremi alto",
    vocale_tardiva: "Vocale comprata tardi o mai",
    lettera_a_vuoto: "Consonante chiamata a vuoto",
    ordine_lettere: "Lettera rara prima delle frequenti",
    soluzione_errata: "Soluzione sbagliata",
    tempo_scaduto: "Tempo scaduto",
    rubasecondi_spreco: "Lettera a vuoto nel Rubasecondi",
    lettera_ripetuta: "Lettera gi\u00e0 chiamata (ripetuta)",
    griglia_debole: "Apertura debole sulla griglia",
    finale_incompleto: "Finale non completato"
  };

  var FALLBACK = [
    "CHI DORME NON PIGLIA PESCI", "IL POSTINO SUONA SEMPRE DUE VOLTE",
    "UNA TAZZINA DI CAFFÈ", "SPAGHETTI ALLA CARBONARA", "LA TORRE DI PISA",
    "PRENDERE DUE PICCIONI CON UNA FAVA", "SISTEMA SOLARE", "ORSO BRUNO MARSICANO",
    "NEL BLU DIPINTO DI BLU", "FARE LA SPESA AL MERCATO", "LEONARDO DA VINCI",
    "AVERE LE MANI BUCATE"
  ].map(function (t) { return { t: t, cat: "fallback", label: "Frase" }; });

  /* ══════════════════════════════════════════════════════════
     Utilità
     ══════════════════════════════════════════════════════════ */

  var ACC = { "À": "A", "Á": "A", "Â": "A", "È": "E", "É": "E", "Ê": "E", "Ì": "I", "Í": "I",
    "Ò": "O", "Ó": "O", "Ô": "O", "Ù": "U", "Ú": "U" };
  function norm(c) { return ACC[c] || c; }
  function normStr(s) {
    return s.toUpperCase().split("").map(norm).join("").replace(/[^A-Z' ]/g, "").replace(/\s+/g, " ").trim();
  }
  function isLetter(c) { return /[A-Z]/.test(norm(c)); }
  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }
  function $(id) { return document.getElementById(id); }
  function eur(n) { return "€ " + (n || 0).toLocaleString("it-IT"); }
  function pct(n) { return Math.round(n * 100) + "%"; }
  function today() { return new Date().toISOString().slice(0, 10); }
  function rand(a) { return a[Math.floor(Math.random() * a.length)]; }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* ══════════════════════════════════════════════════════════
     Tastiera — un contesto attivo alla volta
     ══════════════════════════════════════════════════════════ */

  var KCTX = null;
  function setKeys(ctx) { KCTX = ctx; }

  function letterFromEvent(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return null;
    if (!e.key || e.key.length !== 1) return null;
    var L = norm(e.key.toUpperCase());
    return /^[A-Z]$/.test(L) ? L : null;
  }

  function globalKeys(e) {
    var t = e.target;
    if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) {
      if (e.key === "Escape") t.blur();
      return;
    }
    var ctx = KCTX;
    if (!ctx) return;
    if (e.key === "Enter" && ctx.enter) { e.preventDefault(); ctx.enter(); return; }
    if (e.code === "Space" && ctx.space) { e.preventDefault(); ctx.space(); return; }
    var L = letterFromEvent(e);
    if (L && ctx.letter) { e.preventDefault(); ctx.letter(L); }
  }

  function gameKeys() {
    return {
      letter: function (L) {
        if (!G || G.over || G.mode === "buzz" || !cur().human) return;
        if (VOW.indexOf(L) >= 0) buyVowelKey(L); else callConsonant(L);
      },
      space: function () {
        if (!G || G.over) return;
        if (G.mode === "buzz") { humanBuzz(); return; }
        if (!$("btn-spin").disabled) doSpin();
      },
      enter: function () {
        if (!G || G.over) return;
        if (G.mode === "buzz") { humanBuzz(); return; }
        $("solve-input").focus();
      }
    };
  }

  /* ══════════════════════════════════════════════════════════
     Stato + persistenza
     ══════════════════════════════════════════════════════════ */

  var S = {
    db: null,
    sample: null,
    corpus: [],
    recentIds: [],
    stats: null,
    mistakes: { counts: {}, recent: [] },
    rules: [],
    games: [],
    settings: { onlyTV: false },
    sessions: {}
  };

  var DEFAULT_STATS = {
    games: 0, wins: 0, totalWon: 0, best: 0, lastPlayed: null,
    drills: {}, kpi: { sogliaSum: 0, sogliaN: 0, buzzOk: 0, buzzN: 0, finaleOk: 0, finaleN: 0, grigliaSum: 0, grigliaN: 0 },
    days: {}, weeks: {}
  };

  function cloneStats(s) { return JSON.parse(JSON.stringify(s)); }

  async function boot() {
    buildUI();
    S.corpus = FALLBACK.slice();
    newGame();
    renderAll();

    var db = null, smp = null;
    try { db = window.claude && window.claude.use ? await window.claude.use("db") : null; } catch (e) { db = null; }
    try { smp = window.claude && window.claude.use ? await window.claude.use("sample") : null; } catch (e) { smp = null; }
    S.db = db; S.sample = smp;

    var badge = $("dbstate");
    if (!db) {
      badge.innerHTML = '<span class="dot off"></span> archivio non disponibile — modalità dimostrativa';
    } else {
      badge.innerHTML = '<span class="dot ok"></span> archivio collegato';
      await loadAll();
      renderAll();
      if (S.corpus.length > FALLBACK.length) newGame();
    }
    $("coach-wrap").hidden = !smp;
    $("gen-wrap").hidden = !smp;
  }

  async function loadAll() {
    try {
      var snap = await S.db.collection("corpus").get();
      var out = [];
      snap.docs.forEach(function (d) {
        var v = d.data() || {};
        (v.items || []).forEach(function (it) {
          if (it && it.t) out.push({
            t: String(it.t).toUpperCase(), cat: d.id, label: v.label || d.id,
            tv: !!v.authentic, d: it.d || "", m: it.m || ""
          });
        });
      });
      if (out.length > 8) S.corpus = out;
    } catch (e) { /* resta il fallback */ }

    try {
      var st = await S.db.doc("stats/summary").get();
      S.stats = st.exists ? Object.assign(cloneStats(DEFAULT_STATS), st.data()) : cloneStats(DEFAULT_STATS);
      if (!S.stats.kpi) S.stats.kpi = cloneStats(DEFAULT_STATS).kpi;
      if (!S.stats.drills) S.stats.drills = {};
      if (!S.stats.days) S.stats.days = {};
      if (!S.stats.weeks) S.stats.weeks = {};
    } catch (e) { S.stats = cloneStats(DEFAULT_STATS); }

    try {
      var mk = await S.db.doc("mistakes/log").get();
      if (mk.exists) S.mistakes = Object.assign({ counts: {}, recent: [] }, mk.data());
    } catch (e) { }

    try {
      var rs = await S.db.collection("rules").get();
      S.rules = rs.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
    } catch (e) { S.rules = []; }

    try {
      var st2 = await S.db.doc("settings/app").get();
      if (st2.exists) S.settings = Object.assign({ onlyTV: false }, st2.data());
    } catch (e) { }

    try {
      var ss = await S.db.doc("sessions/log").get();
      if (ss.exists) S.sessions = ss.data().days || {};
    } catch (e) { }

    try {
      var gs = await S.db.collection("games").orderBy("at", "desc").limit(20).get();
      S.games = gs.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
    } catch (e) { S.games = []; }
  }

  if (!S.stats) S.stats = cloneStats(DEFAULT_STATS);

  async function saveStats() {
    if (!S.db) return;
    try { await S.db.doc("stats/summary").set(S.stats); } catch (e) { }
  }
  async function saveMistakes() {
    if (!S.db) return;
    try { await S.db.doc("mistakes/log").set(S.mistakes); } catch (e) { }
  }

  function logMistake(type, ctx) {
    S.mistakes.counts[type] = (S.mistakes.counts[type] || 0) + 1;
    S.mistakes.recent.unshift({ type: type, at: new Date().toISOString(), ctx: ctx || "" });
    bumpWeek({ mistakes: 1 });
    if (S.mistakes.recent.length > 120) S.mistakes.recent.length = 120;
    saveMistakes();
    renderStats();
  }

  function bumpDay(n) {
    var d = today();
    S.stats.days[d] = (S.stats.days[d] || 0) + (n || 1);
  }

  function weekKey(dt) {
    var d = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
    var day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    var y0 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    var wk = Math.ceil((((d - y0) / 86400000) + 1) / 7);
    return d.getUTCFullYear() + "-W" + (wk < 10 ? "0" + wk : wk);
  }

  function bumpWeek(patch) {
    if (!S.stats.weeks) S.stats.weeks = {};
    var k = weekKey(new Date());
    var w = S.stats.weeks[k] || { sess: 0, games: 0, sogliaSum: 0, sogliaN: 0, buzzOk: 0, buzzN: 0, finOk: 0, finN: 0, mistakes: 0 };
    Object.keys(patch).forEach(function (f) { w[f] = (w[f] || 0) + patch[f]; });
    S.stats.weeks[k] = w;
  }

  function recordDrill(type, ok, ms, extra) {
    var d = S.stats.drills[type] || { runs: 0, ok: 0, msSum: 0 };
    d.runs++; if (ok) d.ok++; d.msSum += ms || 0;
    S.stats.drills[type] = d;
    if (extra) Object.keys(extra).forEach(function (k) { S.stats.kpi[k] = (S.stats.kpi[k] || 0) + extra[k]; });
    var wp = { sess: 1 };
    if (extra) {
      if (extra.sogliaN) { wp.sogliaSum = extra.sogliaSum; wp.sogliaN = extra.sogliaN; }
      if (extra.buzzN) { wp.buzzOk = extra.buzzOk || 0; wp.buzzN = extra.buzzN; }
      if (extra.finaleN) { wp.finOk = extra.finaleOk || 0; wp.finN = extra.finaleN; }
    }
    bumpWeek(wp);
    bumpDay(1);
    S.stats.lastPlayed = new Date().toISOString();
    saveStats();
    renderStats();
  }

  /* ══════════════════════════════════════════════════════════
     Frasi e tabelloni
     ══════════════════════════════════════════════════════════ */

  function pickPuzzle(cat) {
    var pool = S.corpus;
    if (S.settings.onlyTV) {
      var tv = S.corpus.filter(function (p) { return p.tv; });
      if (tv.length >= 20) { pool = tv; cat = null; }
    }
    if (cat) {
      var f = S.corpus.filter(function (p) { return p.cat === cat; });
      if (f.length > 4) pool = f;
    }
    var fresh = pool.filter(function (p) { return S.recentIds.indexOf(p.t) < 0; });
    var p = rand(fresh.length ? fresh : pool);
    S.recentIds.unshift(p.t);
    if (S.recentIds.length > 60) S.recentIds.length = 60;
    return p;
  }

  function lettersOf(t) {
    var set = {};
    t.split("").forEach(function (c) { if (isLetter(c)) set[norm(c)] = true; });
    return Object.keys(set);
  }
  function countOf(t, L) {
    var n = 0;
    t.split("").forEach(function (c) { if (norm(c) === L) n++; });
    return n;
  }
  function revealedRatio(t, rev) {
    var tot = 0, on = 0;
    t.split("").forEach(function (c) {
      if (!isLetter(c)) return;
      tot++; if (rev[norm(c)]) on++;
    });
    return tot ? on / tot : 0;
  }

  /* mode: 'play' (rivela le lettere in rev) | 'testacoda' | 'reveal' */
  function renderBoard(host, puzzle, rev, mode) {
    host.innerHTML = "";
    var words = puzzle.t.split(" ");
    words.forEach(function (w) {
      var wd = el("div", "word");
      var chars = w.split("");
      chars.forEach(function (c, i) {
        var t = el("div", "tile");
        if (!isLetter(c)) {
          t.className = "tile fixed";
          t.textContent = c;
        } else {
          var L = norm(c);
          var show = mode === "reveal" || (rev && rev[L]);
          if (mode === "testacoda" && !show) {
            var lastLetterIdx = -1;
            for (var k = chars.length - 1; k >= 0; k--) { if (isLetter(chars[k])) { lastLetterIdx = k; break; } }
            var firstLetterIdx = -1;
            for (var j = 0; j < chars.length; j++) { if (isLetter(chars[j])) { firstLetterIdx = j; break; } }
            if (i === firstLetterIdx || i === lastLetterIdx) { t.className = "tile hint"; t.textContent = c; }
          } else if (show) {
            t.className = "tile on"; t.textContent = c;
          }
        }
        wd.appendChild(t);
      });
      host.appendChild(wd);
    });
  }

  function flashTiles(host) {
    Array.prototype.forEach.call(host.querySelectorAll(".tile.on"), function (t) {
      t.classList.add("pop"); setTimeout(function () { t.classList.remove("pop"); }, 240);
    });
  }

  /* ══════════════════════════════════════════════════════════
     PARTITA
     ══════════════════════════════════════════════════════════ */

  var G = null;

  function newGame() {
    G = {
      manches: buildManches(),
      manche: 0,
      players: [
        { name: "Tu", human: true, round: 0, bank: 0 },
        { name: "Nadia", human: false, skill: 0.55, round: 0, bank: 0 },
        { name: "Rocco", human: false, skill: 0.45, round: 0, bank: 0 }
      ],
      turn: 0,
      starter: 0,
      spin: null,
      spun: 0,
      jolly: 0,
      boughtVowel: false,
      over: false,
      log: [],
      mancheMistakes: 0
    };
    startManche();
  }

  function startManche() {
    var m = G.manches[G.manche];
    if (m.type === "buzz") { startBuzz(m); return; }
    setMode("wheel");
    G.puzzle = pickPuzzle(m.cat);
    G.rev = {};
    G.used = {};
    G.spin = null; G.spun = 0; G.boughtVowel = false; G.freeVowel = false;
    G.turn = G.starter;
    G.players.forEach(function (p) { p.round = 0; });
    G.fixedValue = m.fixed ? rand([1200, 1500, 1700, 2000]) : null;
    pushLog("— " + m.nome + " —");
    if (m.fixed) pushLog("Ogni lettera vale " + eur(G.fixedValue) + ".");
    renderGame();
    maybeBotTurn();
  }

  function pushLog(txt, cls) {
    G.log.unshift({ t: txt, c: cls || "" });
    if (G.log.length > 40) G.log.length = 40;
    var host = $("gamelog");
    if (!host) return;
    host.innerHTML = "";
    G.log.forEach(function (l) {
      var d = el("div", l.c); d.innerHTML = l.t; host.appendChild(d);
    });
  }

  function cur() { return G.players[G.turn]; }

  function nextTurn() {
    G.turn = (G.turn + 1) % 3;
    G.spin = null; G.spun = 0; G.boughtVowel = false;
    renderGame();
    maybeBotTurn();
  }

  function renderGame() {
    if (G.mode === "buzz") { renderBuzz(); return; }
    var m = G.manches[G.manche];
    $("manche-name").textContent = m.nome;
    $("manche-num").textContent = "Manche " + (G.manche + 1) + " / " + G.manches.length;
    $("board-cat").textContent = G.puzzle.label || "Frase";
    renderBoard($("board"), G.puzzle, G.rev, "play");

    var ph = $("players"); ph.innerHTML = "";
    G.players.forEach(function (p, i) {
      var d = el("div", "pl" + (i === G.turn && !G.over ? " active" : ""));
      d.appendChild(el("div", "nm", p.name + (p.human ? "" : " ·")));
      d.appendChild(el("div", "rd", eur(p.round)));
      d.appendChild(el("div", "bk", "banca " + eur(p.bank)));
      ph.appendChild(d);
    });

    var human = cur().human && !G.over;
    var hasSpin = G.spin && typeof G.spin.v === "number";
    $("btn-spin").disabled = !human || !!hasSpin;
    $("btn-vowel").disabled = !human || cur().round < (G.freeVowel ? 0 : VOWEL_COST) || !hasUnrevealedVowel();
    $("btn-vowel").textContent = G.freeVowel ? "Vocale gratis (jolly)" : "Compra vocale \u00b7 \u20ac 200";
    $("btn-solve").disabled = !human;
    $("solve-input").disabled = !human;
    $("wheel-val").textContent = G.spin ? (typeof G.spin.v === "number" ? eur(G.spin.v) : G.spin.v) : (G.fixedValue ? eur(G.fixedValue) + " / lettera" : "—");

    var keys = document.querySelectorAll("#keys .key");
    Array.prototype.forEach.call(keys, function (k) {
      var L = k.dataset.l;
      var isV = VOW.indexOf(L) >= 0;
      k.classList.toggle("used", !!G.used[L]);
      k.disabled = !human || (isV ? cur().round < (G.freeVowel ? 0 : VOWEL_COST) : (!hasSpin && !G.fixedValue));
    });
    $("meta-info").textContent = "scoperto " + pct(revealedRatio(G.puzzle.t, G.rev)) +
      " · lettere usate " + Object.keys(G.used).length + " · vocale " + eur(VOWEL_COST);
  }

  function hasUnrevealedVowel() {
    return lettersOf(G.puzzle.t).some(function (L) { return VOW.indexOf(L) >= 0 && !G.rev[L]; });
  }

  var wheelSpinning = false;
  function spinWheel() {
    if (wheelSpinning) return Promise.resolve(null);
    wheelSpinning = true;
    var i = Math.floor(Math.random() * WHEEL.length);
    var w = $("wheel");
    var turns = 4 + Math.floor(Math.random() * 3);
    var deg = turns * 360 + (360 - (i * 15 + 7.5));
    w.__deg = (w.__deg || 0) + deg;
    w.style.transform = "rotate(" + w.__deg + "deg)";
    return sleep(1700).then(function () { wheelSpinning = false; return WHEEL[i]; });
  }

  async function doSpin() {
    var p = cur();
    var ratio = revealedRatio(G.puzzle.t, G.rev);
    if (p.human && ratio >= 0.7 && p.round >= 1000) {
      logMistake("giro_avido", G.puzzle.label + " · scoperto " + pct(ratio) + " con " + eur(p.round) + " in gioco");
      G.mancheMistakes++;
    }
    $("btn-spin").disabled = true;
    var sec = await spinWheel();
    G.spin = sec;
    G.spun++;
    if (sec.v === "BANCAROTTA") {
      if (p.human && p.round >= 1500 && ratio >= 0.5) {
        logMistake("bancarotta_evitabile", "persi " + eur(p.round) + " con il tabellone al " + pct(ratio));
      }
      pushLog("<b>" + p.name + "</b>: BANCAROTTA, persi " + eur(p.round) + ".", "neg");
      p.round = 0;
      renderGame();
      await sleep(700); nextTurn(); return;
    }
    if (sec.v === "PASSA") {
      pushLog("<b>" + p.name + "</b>: PASSA, turno all'avversario.", "neg");
      renderGame();
      await sleep(700); nextTurn(); return;
    }
    if (sec.v === "JOLLY") {
      G.spin = { v: 1000 };
      pushLog("<b>" + p.name + "</b>: JOLLY! Vale " + eur(1000) + " e una vocale gratis.", "pos");
      G.freeVowel = true;
    } else {
      pushLog("<b>" + p.name + "</b> gira: " + eur(sec.v) + ". Chiama una consonante.");
    }
    renderGame();
    if (!p.human) botCall();
  }

  function valueNow() {
    if (G.fixedValue) return G.fixedValue;
    return G.spin && typeof G.spin.v === "number" ? G.spin.v : 0;
  }

  function callConsonant(L) {
    var p = cur();
    if (!G.spin && !G.fixedValue) return;
    if (G.used[L]) {
      pushLog("<b>" + p.name + "</b>: la " + L + " era gi\u00e0 stata chiamata. Turno perso.", "neg");
      if (p.human) logMistake("lettera_ripetuta", L + " gi\u00e0 chiamata in \u00ab " + G.puzzle.t + " \u00bb");
      G.spin = null;
      renderGame();
      setTimeout(nextTurn, 700);
      return;
    }
    G.used[L] = true;
    var n = countOf(G.puzzle.t, L);
    if (n > 0) {
      G.rev[L] = true;
      var gain = valueNow() * n;
      p.round += gain;
      pushLog("<b>" + p.name + "</b>: " + L + " × " + n + " = " + eur(gain) + ".", "pos");
      if (!G.fixedValue) G.spin = null;
      renderGame();
      flashTiles($("board"));
      if (!p.human) setTimeout(botTurn, 900);
    } else {
      if (p.human) {
        var better = CONS.filter(function (c) { return !G.used[c] && FREQ[c] > (FREQ[L] || 0) + 1.5; });
        if (better.length >= 4) {
          logMistake("ordine_lettere", "chiamata " + L + " con ancora libere " + better.slice(0, 4).join(" "));
        }
        logMistake("lettera_a_vuoto", L + " assente in « " + G.puzzle.t + " »");
      }
      pushLog("<b>" + p.name + "</b>: la " + L + " non c'è.", "neg");
      renderGame();
      setTimeout(nextTurn, 800);
    }
  }

  function applyVowel(L) {
    var p = cur();
    var cost = G.freeVowel ? 0 : VOWEL_COST;
    p.round -= cost;
    G.freeVowel = false;
    G.boughtVowel = true;
    if (G.used[L]) {
      pushLog("<b>" + p.name + "</b>: la " + L + " era gi\u00e0 stata chiamata. Turno perso.", "neg");
      if (p.human) logMistake("lettera_ripetuta", "vocale " + L + " gi\u00e0 chiamata");
      renderGame();
      setTimeout(nextTurn, 700);
      return;
    }
    G.used[L] = true;
    var n = countOf(G.puzzle.t, L);
    if (n > 0) {
      G.rev[L] = true;
      pushLog("<b>" + p.name + "</b> compra la " + L + " (\u00d7 " + n + ").", "pos");
      renderGame();
      flashTiles($("board"));
    } else {
      pushLog("<b>" + p.name + "</b> compra la " + L + ": non c'\u00e8.", "neg");
      if (p.human) logMistake("lettera_a_vuoto", "vocale " + L + " assente");
      renderGame();
    }
  }

  function buyVowelKey(L) {
    if (!G || G.over || G.mode !== "wheel" || !cur().human) return;
    var cost = G.freeVowel ? 0 : VOWEL_COST;
    if (cur().round < cost) {
      pushLog("Servono " + eur(cost) + " in gioco per comprare una vocale.", "neg");
      return;
    }
    applyVowel(L);
  }

  function buyVowel() {
    var p = cur();
    var cost = G.freeVowel ? 0 : VOWEL_COST;
    if (p.round < cost) return;
    openVowelPicker(function (L) { applyVowel(L); });
  }

  function openVowelPicker(cb) {
    var box = $("vowel-pick");
    box.innerHTML = "";
    VOW.forEach(function (L) {
      var b = el("button", "key vowel" + (G.used[L] ? " used" : ""), L);
      b.onclick = function () { $("vowel-modal").classList.remove("on"); cb(L); };
      box.appendChild(b);
    });
    $("vowel-modal").classList.add("on");
  }

  function trySolve(txt) {
    var p = cur();
    var ok = normStr(txt) === normStr(G.puzzle.t);
    if (ok) {
      lettersOf(G.puzzle.t).forEach(function (L) { G.rev[L] = true; });
      p.bank += p.round;
      pushLog("<b>" + p.name + "</b> risolve: « " + G.puzzle.t + " » +" + eur(p.round), "pos");
      if (p.human && !G.boughtVowel && G.spun >= 3) {
        logMistake("vocale_tardiva", "tre giri senza comprare una vocale");
      }
      renderGame();
      setTimeout(endManche, 1400);
    } else {
      if (p.human) logMistake("soluzione_errata", "« " + txt.toUpperCase() + " » invece di « " + G.puzzle.t + " »");
      pushLog("<b>" + p.name + "</b> sbaglia la soluzione.", "neg");
      setTimeout(nextTurn, 700);
    }
  }

  function endManche() {
    G.players.forEach(function (p) { p.round = 0; });
    G.manche++;
    G.starter = (G.starter + 1) % 3;
    if (G.manche >= G.manches.length) { endGame(); return; }
    startManche();
  }

  async function endGame() {
    G.over = true;
    var best = G.players.slice().sort(function (a, b) { return b.bank - a.bank; })[0];
    var me = G.players[0];
    pushLog("<b>Fine partita.</b> Campione: " + best.name + " con " + eur(best.bank) + ".");
    S.stats.games++;
    if (best.human) S.stats.wins++;
    S.stats.totalWon += me.bank;
    if (me.bank > S.stats.best) S.stats.best = me.bank;
    S.stats.lastPlayed = new Date().toISOString();
    bumpWeek({ games: 1, sess: 1 });
    bumpDay(3);
    await saveStats();
    if (S.db) {
      try {
        await S.db.collection("games").doc("g" + Date.now()).set({
          at: Date.now(), date: today(), mine: me.bank, winner: best.name,
          scores: G.players.map(function (p) { return { n: p.name, b: p.bank }; }),
          mistakes: G.mancheMistakes
        });
      } catch (e) { }
    }
    renderGame();
    renderStats();
    if (best.human) {
      setTimeout(function () { startFinale(me.bank); }, 900);
    } else {
      pushLog("Niente finale: il campione è " + best.name + ". Riprova.");
      $("btn-newgame").focus();
    }
  }

  function maybeBotTurn() {
    if (G.over) return;
    if (!cur().human) setTimeout(botTurn, 1100);
  }

  async function botTurn() {
    if (G.over || cur().human) return;
    var p = cur();
    var ratio = revealedRatio(G.puzzle.t, G.rev);
    var solveP = Math.max(0, (ratio - 0.32)) * 2.1 * p.skill;
    if (ratio > 0.85) solveP = Math.max(solveP, 0.7 * p.skill);
    if (Math.random() < solveP && p.round > 0) { trySolve(G.puzzle.t); return; }
    if (p.round >= VOWEL_COST && hasUnrevealedVowel() && Math.random() < 0.35) {
      var fv = VOW.filter(function (L) { return !G.used[L]; });
      if (fv.length) {
        var L = fv.sort(function (a, b) { return countOf(G.puzzle.t, b) - countOf(G.puzzle.t, a); })[0];
        G.used[L] = true; p.round -= VOWEL_COST;
        var n = countOf(G.puzzle.t, L);
        if (n > 0) { G.rev[L] = true; pushLog("<b>" + p.name + "</b> compra la " + L + "."); }
        renderGame();
        setTimeout(botTurn, 900);
        return;
      }
    }
    if (G.fixedValue) { botCall(); return; }
    await doSpin();
  }

  function botCall() {
    if (cur().human) return;
    var p = cur();
    var pool = CONS.filter(function (c) { return !G.used[c]; });
    pool.sort(function (a, b) { return (FREQ[b] || 0) - (FREQ[a] || 0); });
    var pick = Math.random() < p.skill ? pool[0] : rand(pool.slice(0, 6));
    setTimeout(function () { callConsonant(pick); }, 800);
  }

  /* ── Finale: La Ruota delle Meraviglie ─────────────────── */

  var F = null;
  function startFinale(banked) {
    var envelopes = [100, 500, 1000, 2000, 3000, 5000, 10000, 20000, 50000, 100000, 200000];
    F = {
      prize: rand(envelopes),
      boards: [pickPuzzle(), pickPuzzle(), pickPuzzle()],
      idx: 0, rev: {}, left: 60000, t0: 0, timer: null, banked: banked, picks: [], done: 0
    };
    $("modal-title").textContent = "La Ruota delle Meraviglie";
    var b = $("modal-body"); b.innerHTML = "";

    var hint = el("p", "mono");
    hint.style.cssText = "font-size:.78rem;color:var(--ink-faint);margin:0 0 8px";
    hint.innerHTML = "Digita le <b>lettere</b> \u00b7 <b>Invio</b> per partire, poi <b>Invio</b> per scrivere la soluzione";
    b.appendChild(hint);

    var info = el("p");
    info.innerHTML = "Busta estratta: <b>" + eur(F.prize) + "</b>. Tre tabelloni, <b>60 secondi in tutto</b>. " +
      "Nel primo sono date <b>N R T E</b>: scegli tre consonanti e una vocale.";
    b.appendChild(info);

    var pickBox = el("div", "keys");
    var r1 = el("div", "keyrow"), r2 = el("div", "keyrow"), fmap = {};
    CONS.filter(function (c) { return "NRT".indexOf(c) < 0; }).forEach(function (L) {
      var k = el("button", "key", L);
      fmap[L] = k;
      k.onclick = function () { toggleF(L); };
      r1.appendChild(k);
    });
    VOW.filter(function (c) { return c !== "E"; }).forEach(function (L) {
      var k = el("button", "key vowel", L);
      fmap[L] = k;
      k.onclick = function () { toggleF(L); };
      r2.appendChild(k);
    });
    function toggleF(L) {
      var k = fmap[L];
      if (!k) return;
      var i = F.picks.indexOf(L);
      if (i >= 0) { F.picks.splice(i, 1); k.classList.remove("hit"); upd(); return; }
      if (VOW.indexOf(L) >= 0) {
        F.picks = F.picks.filter(function (x) { return VOW.indexOf(x) < 0; });
        Array.prototype.forEach.call(r2.children, function (c) { c.classList.remove("hit"); });
        F.picks.push(L); k.classList.add("hit");
      } else if (F.picks.filter(function (x) { return VOW.indexOf(x) < 0; }).length < 3) {
        F.picks.push(L); k.classList.add("hit");
      }
      upd();
    }
    pickBox.appendChild(r1); pickBox.appendChild(r2);
    b.appendChild(pickBox);

    var go = el("button", "btn primary", "Avvia i 60 secondi");
    go.disabled = true;
    b.appendChild(go);
    function upd() {
      var c = F.picks.filter(function (x) { return VOW.indexOf(x) < 0; }).length;
      var v = F.picks.filter(function (x) { return VOW.indexOf(x) >= 0; }).length;
      go.disabled = !(c === 3 && v === 1);
      go.textContent = c === 3 && v === 1 ? "Avvia i 60 secondi" : "Scegli 3 consonanti + 1 vocale (" + c + "/3, " + v + "/1)";
    }
    upd();
    go.onclick = runFinale;
    setKeys({ letter: toggleF, enter: function () { if (!go.disabled) runFinale(); } });
    $("drill-modal").classList.add("on");
  }

  function runFinale() {
    var b = $("modal-body"); b.innerHTML = "";
    var timer = el("div", "timer", "60.0");
    var head = el("div", "row"); head.appendChild(timer);
    var stage = el("div", "board-wrap");
    var cat = el("div", "board-cat"); var bd = el("div", "board");
    stage.appendChild(cat); stage.appendChild(bd);
    var bar = el("div", "solvebar");
    var inp = el("input"); inp.placeholder = "Scrivi la frase e premi Invio";
    var sub = el("button", "btn primary", "Risolvi");
    bar.appendChild(inp); bar.appendChild(sub);
    var note = el("p", "mono"); note.style.fontSize = ".8rem";
    var extra = el("div", "keys");
    b.appendChild(head); b.appendChild(stage); b.appendChild(bar); b.appendChild(extra); b.appendChild(note);

    F.t0 = Date.now();
    F.timer = setInterval(function () {
      var left = F.left - (Date.now() - F.t0);
      if (left <= 0) { left = 0; finishFinale(false); }
      timer.textContent = (left / 1000).toFixed(1);
      timer.classList.toggle("low", left < 15000);
    }, 100);

    var callLetter = null;
    function loadBoard() {
      var p = F.boards[F.idx];
      F.rev = {};
      extra.innerHTML = "";
      note.textContent = "";
      callLetter = null;
      if (F.idx === 0) {
        ["N", "R", "T", "E"].concat(F.picks).forEach(function (L) { F.rev[L] = true; });
        cat.textContent = p.label + " — tabellone 1";
        renderBoard(bd, p, F.rev, "play");
      } else if (F.idx === 1) {
        cat.textContent = p.label + " — TESTACODA (prima e ultima lettera)";
        renderBoard(bd, p, F.rev, "testacoda");
      } else {
        cat.textContent = p.label + " — RUBASECONDI (ogni lettera assente: −3 s)";
        renderBoard(bd, p, F.rev, "play");
        var row = el("div", "keyrow"), fk = {};
        CONS.concat(VOW).forEach(function (L) {
          var k = el("button", "key" + (VOW.indexOf(L) >= 0 ? " vowel" : ""), L);
          fk[L] = k;
          k.onclick = function () { callF(L); };
          row.appendChild(k);
        });
        callLetter = function (L) {
          var k = fk[L];
          if (!k) return;
          if (k.classList.contains("used")) {
            k.classList.add("miss");
            F.t0 -= 3000;
            logMistake("lettera_ripetuta", "finale \u00b7 " + L + " gi\u00e0 chiamata");
            note.textContent = "La " + L + " l'avevi gi\u00e0 chiamata: \u22123 secondi.";
            return;
          }
          k.classList.add("used");
          var n = countOf(p.t, L);
          if (n > 0) { F.rev[L] = true; renderBoard(bd, p, F.rev, "play"); k.classList.add("hit"); note.textContent = ""; }
          else {
            k.classList.add("miss");
            F.t0 -= 3000;
            logMistake("rubasecondi_spreco", L + " assente");
            note.textContent = "La " + L + " non c'\u00e8: \u22123 secondi.";
          }
        };
        function callF(L) { callLetter(L); }
        extra.appendChild(row);
        note.textContent = "Chiama solo le lettere di cui sei sicuro.";
      }
      inp.value = "";
      setKeys({
        letter: function (L) { if (callLetter) callLetter(L); },
        enter: function () { inp.focus(); }
      });
      if (F.idx !== 2) inp.focus();
    }

    function submit() {
      var p = F.boards[F.idx];
      if (normStr(inp.value) === normStr(p.t)) {
        F.done++;
        F.idx++;
        if (F.idx >= 3) { finishFinale(true); return; }
        loadBoard();
      } else {
        note.textContent = "No: « " + inp.value.toUpperCase() + " » non è la frase.";
        inp.select();
      }
    }
    sub.onclick = submit;
    inp.onkeydown = function (e) { if (e.key === "Enter") submit(); };
    loadBoard();
  }

  function finishFinale(won) {
    if (!F || !F.timer) return;
    clearInterval(F.timer); F.timer = null;
    var b = $("modal-body"); b.innerHTML = "";
    var h = el("h3", "d", won ? "Tutti e tre. " + eur(F.prize) + "!" : "Tempo scaduto — " + F.done + "/3 tabelloni");
    b.appendChild(h);
    F.boards.forEach(function (p, i) {
      var line = el("p", "mono");
      line.textContent = (i < F.done ? "✓ " : "✗ ") + p.t;
      line.style.fontSize = ".9rem";
      b.appendChild(line);
    });
    if (!won) logMistake("finale_incompleto", F.done + "/3 tabelloni");
    recordDrill("finale", won, Math.max(0, Date.now() - F.t0), { finaleOk: won ? 1 : 0, finaleN: 1 });
    if (SESSION && SESSION.active) {
      var nx2 = el("button", "btn primary",
        SESSION.i < SESSION.queue.length - 1 ? "Blocco successivo \u2192" : "Chiudi la sessione");
      nx2.onclick = sessionNext;
      b.appendChild(nx2);
    } else {
      var close = el("button", "btn primary", "Chiudi");
      close.onclick = function () { closeModal(); newGame(); renderAll(); };
      b.appendChild(close);
    }
  }

  /* ══════════════════════════════════════════════════════════
     ALLENAMENTO
     ══════════════════════════════════════════════════════════ */

  var DRILLS = [
    { id: "soglia", code: "D1", nome: "Soglia di informazione", desc: "Le lettere si scoprono una alla volta. Fermale appena riconosci la frase: conta la percentuale di lettere che ti è servita.", kpi: "obiettivo ≤ 35%" },
    { id: "testacoda", code: "D2", nome: "Testacoda", desc: "Solo la prima e l'ultima lettera di ogni parola. Replica esatta del secondo tabellone del finale.", kpi: "obiettivo 7/10 in 20 s" },
    { id: "rubasecondi", code: "D3", nome: "Rubasecondi", desc: "Chiami le lettere che vuoi, ma ogni lettera assente costa 3 secondi veri. Criterio: certezza, non frequenza.", kpi: "obiettivo ≤ 1 buco" },
    { id: "pulsante", code: "D4", nome: "Pulsante", desc: "Le lettere compaiono a ritmo fisso e un avversario simulato si prenota. Batti il suo tempo senza sbagliare.", kpi: "obiettivo > 80% corrette" },
    { id: "griglia", code: "D6", nome: "Lettura della griglia", desc: "Solo griglia vuota e categoria: otto secondi per dichiarare tre consonanti e una vocale. Poi conti le caselle.", kpi: "obiettivo ≥ 9 caselle" }
  ];

  function renderDrills() {
    var host = $("drill-cards"); host.innerHTML = "";
    DRILLS.forEach(function (d) {
      var c = el("div", "card");
      c.appendChild(el("div", "code", d.code));
      c.appendChild(el("h3", null, d.nome));
      c.appendChild(el("p", null, d.desc));
      var foot = el("div", "foot");
      var st = S.stats.drills[d.id];
      foot.appendChild(el("span", "kpi", st ? st.ok + "/" + st.runs + " riusciti" : d.kpi));
      var b = el("button", "btn sm primary", "Allena");
      b.onclick = function () { startDrill(d.id); };
      foot.appendChild(b);
      c.appendChild(foot);
      host.appendChild(c);
    });
  }

  function drillShell(title, hint) {
    $("modal-title").textContent = title;
    var b = $("modal-body"); b.innerHTML = "";
    setKeys(null);
    $("drill-modal").classList.add("on");
    if (hint) {
      var h = el("p", "mono");
      h.style.cssText = "font-size:.78rem;color:var(--ink-faint);margin:0";
      h.innerHTML = hint;
      b.appendChild(h);
    }
    return b;
  }

  function startDrill(id) {
    if (id === "soglia") return drillSoglia();
    if (id === "testacoda") return drillTestacoda();
    if (id === "rubasecondi") return drillRuba();
    if (id === "pulsante") return drillPulsante();
    if (id === "griglia") return drillGriglia();
  }

  function drillSoglia() {
    var b = drillShell("D1 \u00b7 Soglia di informazione",
      "<b>Invio</b> per scrivere la soluzione \u00b7 <b>Esc</b> per uscire dal campo");
    var p = pickPuzzle();
    var letters = shuffle(lettersOf(p.t));
    var rev = {}, i = 0, t0 = Date.now(), timer = null, stopped = false;
    var stage = el("div", "board-wrap");
    var cat = el("div", "board-cat", p.label); var bd = el("div", "board");
    stage.appendChild(cat); stage.appendChild(bd);
    var meter = el("div", "mono"); meter.style.fontSize = ".85rem";
    var bar = el("div", "solvebar");
    var inp = el("input"); inp.placeholder = "Scrivi la frase";
    var stop = el("button", "btn primary", "Risolvo!");
    bar.appendChild(inp); bar.appendChild(stop);
    var out = el("p", "mono"); out.style.fontSize = ".88rem";
    b.appendChild(stage); b.appendChild(meter); b.appendChild(bar); b.appendChild(out);
    renderBoard(bd, p, rev, "play");
    setKeys({ enter: function () { inp.focus(); } });

    function step() {
      if (stopped) return;
      if (i >= letters.length) { clearInterval(timer); return; }
      rev[letters[i++]] = true;
      renderBoard(bd, p, rev, "play");
      meter.textContent = "scoperto " + pct(revealedRatio(p.t, rev));
    }
    timer = setInterval(step, 900);
    meter.textContent = "scoperto 0%";
    inp.focus();

    stop.onclick = function () {
      if (stopped) return;
      stopped = true; clearInterval(timer);
      var ratio = revealedRatio(p.t, rev), ms = Date.now() - t0;
      var ok = normStr(inp.value) === normStr(p.t);
      renderBoard(bd, p, rev, "reveal");
      out.innerHTML = ok
        ? "<b>Corretta</b> con il " + pct(ratio) + " scoperto in " + (ms / 1000).toFixed(1) + " s."
        : "<b>Sbagliata.</b> Era « " + p.t + " ».";
      if (!ok) logMistake("soluzione_errata", "D1 · « " + inp.value.toUpperCase() + " »");
      recordDrill("soglia", ok, ms, ok ? { sogliaSum: ratio, sogliaN: 1 } : null);
      out.appendChild(again(drillSoglia));
    };
    inp.onkeydown = function (e) { if (e.key === "Enter") stop.click(); };
  }

  function drillTestacoda() {
    var b = drillShell("D2 \u00b7 Testacoda",
      "<b>Invio</b> per scrivere la soluzione \u00b7 <b>Esc</b> per uscire dal campo");
    var p = pickPuzzle();
    var t0 = Date.now();
    var stage = el("div", "board-wrap");
    var cat = el("div", "board-cat", p.label); var bd = el("div", "board");
    stage.appendChild(cat); stage.appendChild(bd);
    var bar = el("div", "solvebar");
    var inp = el("input"); inp.placeholder = "La frase intera";
    var sub = el("button", "btn primary", "Risolvi");
    bar.appendChild(inp); bar.appendChild(sub);
    var out = el("p", "mono"); out.style.fontSize = ".88rem";
    b.appendChild(stage); b.appendChild(bar); b.appendChild(out);
    renderBoard(bd, p, {}, "testacoda");
    inp.focus();
    setKeys({ enter: function () { inp.focus(); } });
    var tries = 0;
    sub.onclick = function () {
      var ok = normStr(inp.value) === normStr(p.t);
      tries++;
      if (ok || tries >= 3) {
        var ms = Date.now() - t0;
        renderBoard(bd, p, {}, "reveal");
        out.innerHTML = ok ? "<b>Presa</b> in " + (ms / 1000).toFixed(1) + " s." : "<b>Era</b> « " + p.t + " ».";
        if (!ok) logMistake("soluzione_errata", "D2 · " + p.t);
        recordDrill("testacoda", ok, ms);
        sub.disabled = true; inp.disabled = true;
        out.appendChild(again(drillTestacoda));
      } else {
        out.textContent = "No. Restano " + (3 - tries) + " tentativi.";
        inp.select();
      }
    };
    inp.onkeydown = function (e) { if (e.key === "Enter") sub.click(); };
  }

  function drillRuba() {
    var b = drillShell("D3 \u00b7 Rubasecondi",
      "Digita le <b>lettere</b> \u00b7 <b>Invio</b> per scrivere la soluzione \u00b7 <b>Esc</b> per tornare alle lettere");
    var p = pickPuzzle();
    var rev = {}, holes = 0, end = Date.now() + 45000, fin = false;
    var timer = el("div", "timer", "45.0");
    var stage = el("div", "board-wrap");
    var cat = el("div", "board-cat", p.label); var bd = el("div", "board");
    stage.appendChild(cat); stage.appendChild(bd);
    var keys = el("div", "keys"); var row = el("div", "keyrow");
    var kmap = {};
    CONS.concat(VOW).forEach(function (L) {
      var k = el("button", "key" + (VOW.indexOf(L) >= 0 ? " vowel" : ""), L);
      kmap[L] = k;
      k.onclick = function () { callRuba(L); };
      row.appendChild(k);
    });
    keys.appendChild(row);

    function callRuba(L) {
      if (fin) return;
      var k = kmap[L];
      if (k.classList.contains("used")) {
        k.classList.add("miss");
        holes++; end -= 3000;
        logMistake("lettera_ripetuta", "D3 \u00b7 " + L + " gi\u00e0 chiamata");
        out.textContent = "La " + L + " l'avevi gi\u00e0 chiamata: \u22123 secondi.";
        return;
      }
      k.classList.add("used");
      var n = countOf(p.t, L);
      if (n > 0) { rev[L] = true; k.classList.add("hit"); renderBoard(bd, p, rev, "play"); out.textContent = ""; }
      else {
        k.classList.add("miss"); holes++; end -= 3000;
        logMistake("rubasecondi_spreco", L + " \u00b7 " + p.label);
        out.textContent = "La " + L + " non c'\u00e8: \u22123 secondi.";
      }
    }
    var bar = el("div", "solvebar");
    var inp = el("input"); inp.placeholder = "La frase";
    var sub = el("button", "btn primary", "Risolvi");
    bar.appendChild(inp); bar.appendChild(sub);
    var out = el("p", "mono"); out.style.fontSize = ".88rem";
    b.appendChild(timer); b.appendChild(stage); b.appendChild(keys); b.appendChild(bar); b.appendChild(out);
    renderBoard(bd, p, rev, "play");
    setKeys({ letter: callRuba, enter: function () { inp.focus(); } });
    var iv = setInterval(function () {
      var left = end - Date.now();
      if (left <= 0) { left = 0; done(false); }
      timer.textContent = (left / 1000).toFixed(1);
      timer.classList.toggle("low", left < 12000);
    }, 100);
    function done(ok) {
      if (fin) return;
      fin = true; clearInterval(iv);
      renderBoard(bd, p, rev, "reveal");
      out.innerHTML = ok ? "<b>Risolta</b> con " + holes + " lettere a vuoto." : "<b>Era</b> « " + p.t + " » — " + holes + " buchi.";
      if (!ok) logMistake("tempo_scaduto", "D3 · " + p.label);
      recordDrill("rubasecondi", ok, 45000, null);
      out.appendChild(again(drillRuba));
    }
    sub.onclick = function () { if (normStr(inp.value) === normStr(p.t)) done(true); else { out.textContent = "No."; inp.select(); } };
    inp.onkeydown = function (e) { if (e.key === "Enter") sub.click(); };
  }

  function drillPulsante() {
    var b = drillShell("D4 \u00b7 Pulsante",
      "<b>Barra spaziatrice</b> per prenotarti \u00b7 poi scrivi e <b>Invio</b>");
    var p = pickPuzzle();
    var letters = shuffle(lettersOf(p.t));
    var rev = {}, i = 0, buzzed = false, fin = false;
    var botAt = 0.45 + Math.random() * 0.35;
    var stage = el("div", "board-wrap");
    var cat = el("div", "board-cat", p.label); var bd = el("div", "board");
    stage.appendChild(cat); stage.appendChild(bd);
    var buzz = el("button", "btn primary", "PRENOTATI  (barra spaziatrice)");
    var bar = el("div", "solvebar"); bar.hidden = true;
    var inp = el("input"); inp.placeholder = "La frase";
    var sub = el("button", "btn primary", "Rispondi");
    bar.appendChild(inp); bar.appendChild(sub);
    var out = el("p", "mono"); out.style.fontSize = ".88rem";
    b.appendChild(stage); b.appendChild(buzz); b.appendChild(bar); b.appendChild(out);
    renderBoard(bd, p, rev, "play");
    var t0 = Date.now();
    var iv = setInterval(function () {
      if (fin || buzzed) return;
      if (i >= letters.length) { clearInterval(iv); return; }
      rev[letters[i++]] = true;
      renderBoard(bd, p, rev, "play");
      if (revealedRatio(p.t, rev) >= botAt) { clearInterval(iv); botWins(); }
    }, 750);

    function botWins() {
      if (fin || buzzed) return;
      fin = true;
      renderBoard(bd, p, rev, "reveal");
      out.innerHTML = "<b>Ti ha battuto sul pulsante.</b> Era « " + p.t + " ».";
      recordDrill("pulsante", false, Date.now() - t0, { buzzN: 1 });
      out.appendChild(again(drillPulsante));
    }
    function doBuzz() {
      if (fin || buzzed) return;
      buzzed = true; clearInterval(iv);
      buzz.disabled = true; bar.hidden = false; inp.focus();
    }
    buzz.onclick = doBuzz;
    setKeys({ space: doBuzz, enter: doBuzz });

    sub.onclick = function () {
      if (fin) return;
      fin = true;
      var ok = normStr(inp.value) === normStr(p.t);
      var ratio = revealedRatio(p.t, rev);
      renderBoard(bd, p, rev, "reveal");
      out.innerHTML = ok
        ? "<b>Presa</b> al " + pct(ratio) + " scoperto."
        : "<b>Prenotato a vuoto.</b> Era « " + p.t + " ».";
      if (!ok) logMistake("soluzione_errata", "D4 · prenotazione senza frase");
      recordDrill("pulsante", ok, Date.now() - t0, { buzzOk: ok ? 1 : 0, buzzN: 1 });
      out.appendChild(again(drillPulsante));
    };
    inp.onkeydown = function (e) { if (e.key === "Enter") sub.click(); };
  }

  function drillGriglia() {
    var b = drillShell("D6 \u00b7 Lettura della griglia",
      "Digita le <b>lettere</b> per sceglierle (di nuovo per toglierle)");
    var p = pickPuzzle();
    var picks = [], fin = false;
    var timer = el("div", "timer", "8.0");
    var stage = el("div", "board-wrap");
    var cat = el("div", "board-cat", p.label); var bd = el("div", "board");
    stage.appendChild(cat); stage.appendChild(bd);
    var note = el("p", null, "Sono già date N R T E. Scegli tre consonanti e una vocale prima che scada il tempo.");
    var keys = el("div", "keys");
    var r1 = el("div", "keyrow"), r2 = el("div", "keyrow");
    var gmap = {};
    CONS.filter(function (c) { return "NRT".indexOf(c) < 0; }).forEach(function (L) {
      var k = el("button", "key", L);
      gmap[L] = k;
      k.onclick = function () { toggleG(L); };
      r1.appendChild(k);
    });
    VOW.filter(function (c) { return c !== "E"; }).forEach(function (L) {
      var k = el("button", "key vowel", L);
      gmap[L] = k;
      k.onclick = function () { toggleG(L); };
      r2.appendChild(k);
    });
    function toggleG(L) {
      if (fin || !gmap[L]) return;
      var k = gmap[L];
      var i = picks.indexOf(L);
      if (i >= 0) { picks.splice(i, 1); k.classList.remove("hit"); return; }
      if (VOW.indexOf(L) >= 0) {
        picks = picks.filter(function (x) { return VOW.indexOf(x) < 0; });
        Array.prototype.forEach.call(r2.children, function (c) { c.classList.remove("hit"); });
        picks.push(L); k.classList.add("hit");
      } else if (picks.filter(function (x) { return VOW.indexOf(x) < 0; }).length < 3) {
        picks.push(L); k.classList.add("hit");
      }
    }
    keys.appendChild(r1); keys.appendChild(r2);
    var out = el("p", "mono"); out.style.fontSize = ".88rem";
    b.appendChild(timer); b.appendChild(stage); b.appendChild(note); b.appendChild(keys); b.appendChild(out);
    renderBoard(bd, p, {}, "play");
    setKeys({ letter: toggleG, enter: function () { score(); } });
    var end = Date.now() + 8000;
    var iv = setInterval(function () {
      var left = end - Date.now();
      if (left <= 0) { left = 0; score(); }
      timer.textContent = (left / 1000).toFixed(1);
      timer.classList.toggle("low", left < 3000);
    }, 100);
    function score() {
      if (fin) return;
      fin = true; clearInterval(iv);
      var rev = {};
      ["N", "R", "T", "E"].concat(picks).forEach(function (L) { rev[L] = true; });
      var tiles = 0;
      picks.forEach(function (L) { tiles += countOf(p.t, L); });
      renderBoard(bd, p, rev, "play");
      out.innerHTML = "Le tue lettere hanno scoperto <b>" + tiles + " caselle</b>" +
        (picks.length ? " (" + picks.join(" ") + ")" : "") + ". Frase: « " + p.t + " ».";
      if (tiles < 6) logMistake("griglia_debole", picks.join(" ") + " → " + tiles + " caselle");
      recordDrill("griglia", tiles >= 9, 8000, { grigliaSum: tiles, grigliaN: 1 });
      out.appendChild(again(drillGriglia));
    }
  }

  function again(fn) {
    var wrap = el("div", "row");
    wrap.style.marginTop = "10px";
    if (SESSION && SESSION.active) {
      var nx = el("button", "btn primary sm",
        SESSION.i < SESSION.queue.length - 1 ? "Blocco successivo \u2192" : "Chiudi la sessione");
      nx.onclick = sessionNext;
      var rp = el("button", "btn ghost sm", "Ripeti questo");
      rp.onclick = fn;
      wrap.appendChild(nx); wrap.appendChild(rp);
      return wrap;
    }
    var a = el("button", "btn primary sm", "Un'altra");
    a.onclick = fn;
    var c = el("button", "btn ghost sm", "Chiudi");
    c.onclick = closeModal;
    wrap.appendChild(a); wrap.appendChild(c);
    return wrap;
  }

  function closeModal() {
    if (F && F.timer) { clearInterval(F.timer); F.timer = null; }
    $("drill-modal").dispatchEvent(new Event("modalclose"));
    $("drill-modal").classList.remove("on");
    setKeys(gameKeys());
  }

  /* ══════════════════════════════════════════════════════════
     STATISTICHE
     ══════════════════════════════════════════════════════════ */

  function renderStats() {
    var k = S.stats.kpi || {};
    var tiles = [
      ["Partite", S.stats.games, "giocate"],
      ["Vittorie", S.stats.wins + (S.stats.games ? " (" + Math.round(100 * S.stats.wins / S.stats.games) + "%)" : ""), "come campione"],
      ["Record", eur(S.stats.best), "miglior partita"],
      ["Soglia media", k.sogliaN ? pct(k.sogliaSum / k.sogliaN) : "—", "lettere per risolvere (D1)"],
      ["Pulsante", k.buzzN ? Math.round(100 * k.buzzOk / k.buzzN) + "%" : "—", "prenotazioni corrette (D4)"],
      ["Finale", k.finaleN ? Math.round(100 * k.finaleOk / k.finaleN) + "%" : "—", "tre tabelloni in 60 s"],
      ["Griglia", k.grigliaN ? (k.grigliaSum / k.grigliaN).toFixed(1) : "—", "caselle per apertura (D6)"],
      ["Sessioni oggi", S.stats.days[today()] || 0, "esercizi completati"]
    ];
    var h = $("kpi-tiles"); h.innerHTML = "";
    tiles.forEach(function (t) {
      var d = el("div");
      d.appendChild(el("b", null, String(t[1])));
      d.appendChild(el("span", null, t[0] + " · " + t[2]));
      h.appendChild(d);
    });

    renderTrend();

    var mh = $("mistake-table"); mh.innerHTML = "";
    var entries = Object.keys(S.mistakes.counts).map(function (k2) { return [k2, S.mistakes.counts[k2]]; })
      .sort(function (a, b) { return b[1] - a[1]; });
    if (!entries.length) {
      mh.appendChild(el("p", "empty", "Nessun errore registrato: gioca una partita o un esercizio e qui comparirà il profilo dei tuoi errori."));
    } else {
      var max = entries[0][1];
      var tb = el("table");
      var thead = el("thead");
      var trh = el("tr");
      ["Tipo di errore", "N.", "Peso"].forEach(function (x) { trh.appendChild(el("th", null, x)); });
      thead.appendChild(trh); tb.appendChild(thead);
      var tbody = el("tbody");
      entries.forEach(function (e) {
        var tr = el("tr");
        tr.appendChild(el("td", null, MISTAKE_LABEL[e[0]] || e[0]));
        tr.appendChild(el("td", "n", String(e[1])));
        var td = el("td");
        var bar = el("div", "bar" + (e[1] === max ? " warn" : ""));
        var fill = el("i"); fill.style.width = Math.round(100 * e[1] / max) + "%";
        bar.appendChild(fill); td.appendChild(bar);
        tr.appendChild(td);
        tbody.appendChild(tr);
      });
      tb.appendChild(tbody);
      var w = el("div", "tablewrap"); w.appendChild(tb);
      mh.appendChild(w);
    }

    var rh = $("recent-mistakes"); rh.innerHTML = "";
    S.mistakes.recent.slice(0, 8).forEach(function (m) {
      var d = el("div", "mono");
      d.style.fontSize = ".82rem";
      d.style.color = "var(--ink-soft)";
      d.textContent = m.at.slice(5, 10) + "  " + (MISTAKE_LABEL[m.type] || m.type) + (m.ctx ? " — " + m.ctx : "");
      rh.appendChild(d);
    });

    var gh = $("recent-games"); gh.innerHTML = "";
    if (!S.games.length) gh.appendChild(el("p", "empty", "Nessuna partita archiviata."));
    S.games.slice(0, 8).forEach(function (g) {
      var d = el("div", "mono");
      d.style.fontSize = ".82rem";
      d.textContent = (g.date || "") + "  vinto " + eur(g.mine || 0) + " · campione " + (g.winner || "—");
      gh.appendChild(d);
    });
  }


  /* ══════════════════════════════════════════════════════════
     MANCHE A PULSANTE — CruciRuota e Triplete
     ══════════════════════════════════════════════════════════ */

  var B = null;

  function setMode(mode) {
    G.mode = mode;
    $("wheel-box").hidden = mode !== "wheel";
    $("wheel-controls").hidden = mode !== "wheel";
    $("buzz-panel").hidden = mode !== "buzz";
    $("btn-vowel").hidden = mode !== "wheel";
    $("btn-skip").hidden = mode !== "wheel";
  }

  function pickSet(n, cat) {
    var out = [], guard = 0;
    while (out.length < n && guard++ < 300) {
      var p = pickPuzzle(cat);
      if (!out.some(function (x) { return x.t === p.t; })) out.push(p);
    }
    return out;
  }

  function startBuzz(m) {
    setMode("buzz");
    var cat = m.kind === "triplete" ? rand(THEMED).cat : null;
    B = { m: m, cat: cat, list: pickSet(m.n, cat), idx: 0, taken: {}, timer: null, answering: null };
    pushLog("— " + m.nome + " —");
    pushLog(m.kind === "triplete"
      ? "Tre frasi sullo stesso tema: 1.000, 2.000, 3.000 €. Tutte e tre valgono 10.000 €."
      : "Quattro frasi da 1.000 €: le lettere compaiono una alla volta, ci si prenota.");
    nextBuzzPhrase();
  }

  function buzzValue() {
    return B.m.kind === "triplete" ? [1000, 2000, 3000][B.idx] : 1000;
  }

  function nextBuzzPhrase() {
    if (!B) return;
    if (B.idx >= B.list.length) { finishBuzz(); return; }
    B.puz = B.list[B.idx];
    B.rev = {};
    B.letters = shuffle(lettersOf(B.puz.t));
    B.li = 0;
    B.locked = {};
    B.answering = null;
    B.botAt = G.players.map(function (p) { return p.human ? 9 : 0.34 + Math.random() * 0.42 * (1.3 - p.skill); });
    renderBuzz();
    B.timer = setInterval(tickBuzz, 750);
  }

  function stopBuzzTimer() { if (B && B.timer) { clearInterval(B.timer); B.timer = null; } }

  function tickBuzz() {
    if (!B || B.answering !== null) return;
    if (B.li >= B.letters.length) { stopBuzzTimer(); missedPhrase(); return; }
    B.rev[B.letters[B.li++]] = true;
    renderBuzz();
    var ratio = revealedRatio(B.puz.t, B.rev);
    for (var i = 1; i < 3; i++) {
      if (!B.locked[i] && ratio >= B.botAt[i]) { botBuzz(i, ratio); return; }
    }
  }

  function botBuzz(i, ratio) {
    stopBuzzTimer();
    B.answering = i;
    var p = G.players[i];
    pushLog("<b>" + p.name + "</b> si prenota…");
    renderBuzz();
    setTimeout(function () {
      if (!B) return;
      var ok = Math.random() < Math.min(0.95, ratio * p.skill * 1.9);
      if (ok) { awardBuzz(i); }
      else {
        B.locked[i] = true;
        B.answering = null;
        pushLog("<b>" + p.name + "</b> sbaglia ed è fuori da questa frase.", "neg");
        renderBuzz();
        B.timer = setInterval(tickBuzz, 750);
      }
    }, 1200);
  }

  function humanBuzz() {
    if (!B || B.answering !== null || B.locked[0]) return;
    stopBuzzTimer();
    B.answering = 0;
    renderBuzz();
    $("buzz-answer").hidden = false;
    $("buzz-input").value = "";
    $("buzz-input").focus();
  }

  function submitBuzz() {
    if (!B || B.answering !== 0) return;
    var v = $("buzz-input").value;
    $("buzz-answer").hidden = true;
    if (normStr(v) === normStr(B.puz.t)) { awardBuzz(0); return; }
    logMistake("soluzione_errata", B.m.nome + " · « " + v.toUpperCase() + " » invece di « " + B.puz.t + " »");
    B.locked[0] = true;
    B.answering = null;
    pushLog("<b>Tu</b>: prenotazione a vuoto, sei fuori da questa frase.", "neg");
    renderBuzz();
    B.timer = setInterval(tickBuzz, 750);
  }

  function awardBuzz(i) {
    var p = G.players[i], v = buzzValue();
    p.bank += v;
    B.taken[i] = (B.taken[i] || 0) + 1;
    lettersOf(B.puz.t).forEach(function (L) { B.rev[L] = true; });
    B.answering = "done";
    pushLog("<b>" + p.name + "</b> prende « " + B.puz.t + " » +" + eur(v), "pos");
    renderBuzz();
    setTimeout(function () { if (!B) return; B.idx++; nextBuzzPhrase(); }, 1500);
  }

  function missedPhrase() {
    lettersOf(B.puz.t).forEach(function (L) { B.rev[L] = true; });
    B.answering = "done";
    pushLog("Nessuno l'ha presa: « " + B.puz.t + " ».", "neg");
    renderBuzz();
    setTimeout(function () { if (!B) return; B.idx++; nextBuzzPhrase(); }, 1500);
  }

  function finishBuzz() {
    stopBuzzTimer();
    if (B.m.kind === "triplete") {
      for (var i = 0; i < 3; i++) {
        if (B.taken[i] === 3) {
          G.players[i].bank += 10000;
          pushLog("<b>" + G.players[i].name + "</b> fa il TRIPLETE: +" + eur(10000) + "!", "pos");
        }
      }
    }
    B = null;
    setTimeout(endManche, 1600);
  }

  function renderBuzz() {
    var m = G.manches[G.manche];
    $("manche-name").textContent = m.nome;
    $("manche-num").textContent = "Manche " + (G.manche + 1) + " / " + G.manches.length;
    if (!B || !B.puz) return;
    $("board-cat").textContent = B.puz.label || "Frase";
    renderBoard($("board"), B.puz, B.rev, "play");

    var ph = $("players"); ph.innerHTML = "";
    G.players.forEach(function (p, i) {
      var d = el("div", "pl" + (B.answering === i ? " active" : ""));
      d.appendChild(el("div", "nm", p.name + (B.locked[i] ? " ✕" : "")));
      d.appendChild(el("div", "rd", eur(p.bank)));
      d.appendChild(el("div", "bk", B.taken[i] ? B.taken[i] + " prese" : "in gara"));
      ph.appendChild(d);
    });

    $("buzz-count").textContent = "Frase " + Math.min(B.idx + 1, B.list.length) + " / " + B.list.length;
    $("buzz-value").textContent = eur(buzzValue());
    $("btn-buzz").disabled = B.answering !== null || !!B.locked[0];
    $("btn-buzz").textContent = B.locked[0] ? "Sei fuori da questa frase"
      : B.answering === 0 ? "Rispondi!" : "PRENOTATI  ·  barra spaziatrice";
    $("meta-info").textContent = "scoperto " + pct(revealedRatio(B.puz.t, B.rev)) + " · " + m.nome;
  }

  /* ══════════════════════════════════════════════════════════
     Andamento settimanale
     ══════════════════════════════════════════════════════════ */

  function lastWeeks(n) {
    var out = [], d = new Date();
    for (var i = 0; i < n; i++) {
      out.unshift(weekKey(d));
      d.setDate(d.getDate() - 7);
    }
    return out;
  }

  function svg(tag, attrs) {
    var n = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }

  function renderTrend() {
    var host = $("trend"); if (!host) return;
    host.innerHTML = "";
    var weeks = lastWeeks(8);
    var data = weeks.map(function (k) {
      var w = (S.stats.weeks || {})[k] || {};
      return { k: k, label: k.slice(6), sess: w.sess || 0, soglia: w.sogliaN ? w.sogliaSum / w.sogliaN : null };
    });
    var any = data.some(function (d) { return d.sess > 0; });
    if (!any) {
      host.appendChild(el("p", "empty", "Ancora nessuna settimana registrata: il grafico si riempie da solo dopo i primi esercizi."));
      return;
    }

    /* ── barre: sessioni per settimana ── */
    var W = 640, H = 150, ml = 34, mr = 12, mt = 16, mb = 26;
    var iw = W - ml - mr, ih = H - mt - mb;
    var max = Math.max.apply(null, data.map(function (d) { return d.sess; })) || 1;
    var step = iw / data.length, bw = Math.max(10, step - 6);
    var s1 = svg("svg", { viewBox: "0 0 " + W + " " + H, width: "100%", height: "auto", role: "img",
      "aria-label": "Sessioni di allenamento per settimana, ultime otto settimane" });

    [0, .5, 1].forEach(function (f) {
      var y = mt + ih - ih * f;
      s1.appendChild(svg("line", { x1: ml, x2: W - mr, y1: y, y2: y, style: "stroke:var(--rule-soft);stroke-width:1" }));
      var t = svg("text", { x: ml - 6, y: y + 4, "text-anchor": "end",
        style: "fill:var(--ink-faint);font-family:var(--f-mono);font-size:10px" });
      t.textContent = Math.round(max * f);
      s1.appendChild(t);
    });

    data.forEach(function (d, i) {
      var h = d.sess ? Math.max(6, ih * d.sess / max) : 0;
      var x = ml + i * step + (step - bw) / 2;
      if (h) {
        var r = svg("rect", { x: x, y: mt + ih - h, width: bw, height: h, rx: 4,
          style: "fill:var(--accent)" });
        var ti = svg("title"); ti.textContent = d.label + ": " + d.sess + " sessioni";
        r.appendChild(ti);
        s1.appendChild(r);
      }
      if (i % 2 === 1 || i === data.length - 1) {
        var lb = svg("text", { x: x + bw / 2, y: H - 8, "text-anchor": "middle",
          style: "fill:var(--ink-faint);font-family:var(--f-mono);font-size:10px" });
        lb.textContent = d.label;
        s1.appendChild(lb);
      }
      if (d.sess && (d.sess === max || i === data.length - 1)) {
        var vl = svg("text", { x: x + bw / 2, y: mt + ih - h - 5, "text-anchor": "middle",
          style: "fill:var(--ink-soft);font-family:var(--f-mono);font-size:11px;font-weight:600" });
        vl.textContent = d.sess;
        s1.appendChild(vl);
      }
    });
    var t1 = el("h4", "d", "Sessioni per settimana");
    t1.style.margin = "0 0 4px";
    host.appendChild(t1);
    host.appendChild(s1);

    /* ── linea: soglia media di soluzione ── */
    var pts = data.map(function (d, i) { return { i: i, v: d.soglia, label: d.label }; })
      .filter(function (p2) { return p2.v != null; });
    if (pts.length < 2) return;
    var t2 = el("h4", "d", "Soglia media di soluzione — più bassa è, meglio è");
    t2.style.margin = "16px 0 4px";
    host.appendChild(t2);
    var s2 = svg("svg", { viewBox: "0 0 " + W + " " + H, width: "100%", height: "auto", role: "img",
      "aria-label": "Percentuale media di lettere scoperte al momento della soluzione, per settimana" });
    var lo = 0, hi = 1;
    [0, .25, .5, .75, 1].forEach(function (f) {
      var y = mt + ih - ih * f;
      s2.appendChild(svg("line", { x1: ml, x2: W - mr, y1: y, y2: y, style: "stroke:var(--rule-soft);stroke-width:1" }));
      var t = svg("text", { x: ml - 6, y: y + 4, "text-anchor": "end",
        style: "fill:var(--ink-faint);font-family:var(--f-mono);font-size:10px" });
      t.textContent = Math.round(f * 100) + "%";
      s2.appendChild(t);
    });
    function px(i) { return ml + i * step + step / 2; }
    function py(v) { return mt + ih - ih * ((v - lo) / (hi - lo)); }
    var dstr = pts.map(function (p2, n) { return (n ? "L" : "M") + px(p2.i) + " " + py(p2.v); }).join(" ");
    s2.appendChild(svg("path", { d: dstr, style: "fill:none;stroke:var(--accent);stroke-width:2;stroke-linejoin:round" }));
    pts.forEach(function (p2, n) {
      var c = svg("circle", { cx: px(p2.i), cy: py(p2.v), r: 4.5,
        style: "fill:var(--accent);stroke:var(--panel);stroke-width:2" });
      var ti = svg("title"); ti.textContent = p2.label + ": " + Math.round(p2.v * 100) + "% di lettere scoperte";
      c.appendChild(ti);
      s2.appendChild(c);
      if (n === pts.length - 1) {
        var vl = svg("text", { x: px(p2.i), y: py(p2.v) - 10, "text-anchor": "end",
          style: "fill:var(--ink-soft);font-family:var(--f-mono);font-size:11px;font-weight:600" });
        vl.textContent = Math.round(p2.v * 100) + "%";
        s2.appendChild(vl);
      }
    });
    data.forEach(function (d, i) {
      if (i % 2 === 1 || i === data.length - 1) {
        var lb = svg("text", { x: px(i), y: H - 8, "text-anchor": "middle",
          style: "fill:var(--ink-faint);font-family:var(--f-mono);font-size:10px" });
        lb.textContent = d.label;
        s2.appendChild(lb);
      }
    });
    host.appendChild(s2);
  }


  /* ══════════════════════════════════════════════════════════
     OGGI — la sessione del giorno
     ══════════════════════════════════════════════════════════ */

  var SESSION = null;

  var BLOCKS = {
    soglia: { nome: "Soglia di informazione", code: "D1", min: 4, run: drillSoglia },
    testacoda: { nome: "Testacoda", code: "D2", min: 3, run: drillTestacoda },
    rubasecondi: { nome: "Rubasecondi", code: "D3", min: 3, run: drillRuba },
    pulsante: { nome: "Pulsante", code: "D4", min: 4, run: drillPulsante },
    griglia: { nome: "Lettura della griglia", code: "D6", min: 2, run: drillGriglia },
    finale: { nome: "Finale in 60 secondi", code: "D5", min: 3, run: function () { startFinale(0); } }
  };

  function dayKey(offset) {
    var d = new Date();
    d.setDate(d.getDate() + (offset || 0));
    return d.toISOString().slice(0, 10);
  }

  function streakLength() {
    var n = 0, i = 0;
    if (!S.sessions[dayKey(0)]) i = 1;
    while (S.sessions[dayKey(-i)]) { n++; i++; }
    return n;
  }

  function prescribe() {
    var k = S.stats.kpi || {}, m = S.mistakes.counts || {}, dr = S.stats.drills || {};
    var cand = [];
    function push(id, prio, why) { cand.push({ id: id, prio: prio, why: why }); }

    var soglia = k.sogliaN ? k.sogliaSum / k.sogliaN : null;
    push("soglia", soglia == null ? 70 : (soglia > 0.45 ? 96 : soglia > 0.38 ? 62 : 34),
      soglia == null ? "Non hai ancora una soglia di riferimento"
        : "Risolvi con il " + pct(soglia) + " delle lettere scoperte");

    var buzz = k.buzzN ? k.buzzOk / k.buzzN : null;
    push("pulsante", buzz == null ? 64 : (buzz < 0.7 ? 90 : buzz < 0.85 ? 55 : 30),
      buzz == null ? "Prenotazione al pulsante mai misurata"
        : pct(buzz) + " di prenotazioni corrette");

    var fin = k.finaleN ? k.finaleOk / k.finaleN : null;
    push("finale", fin == null ? 84 : (fin < 0.6 ? 93 : fin < 0.8 ? 58 : 36),
      fin == null ? "Il finale vale fino a 200.000 €: va provato"
        : pct(fin) + " di finali completati");

    var gri = k.grigliaN ? k.grigliaSum / k.grigliaN : null;
    push("griglia", gri == null ? 58 : (gri < 8 ? 86 : gri < 10 ? 48 : 26),
      gri == null ? "Apertura del finale mai misurata"
        : gri.toFixed(1) + " caselle scoperte per apertura");

    var sprechi = (m.rubasecondi_spreco || 0) + (m.lettera_ripetuta || 0);
    push("rubasecondi", Math.min(94, 40 + sprechi * 9),
      sprechi ? sprechi + " lettere buttate a vuoto finora" : "Disciplina delle chiamate sicure");

    var td = dr.testacoda;
    push("testacoda", td ? (td.ok / Math.max(1, td.runs) < 0.6 ? 80 : 44) : 66,
      td ? Math.round(100 * td.ok / Math.max(1, td.runs)) + "% di Testacoda risolti"
        : "Testacoda mai allenato");

    var ieri = S.sessions[dayKey(-1)];
    if (ieri && ieri.blocks) {
      cand.forEach(function (c) { if (ieri.blocks.indexOf(c.id) >= 0) c.prio -= 14; });
    }
    cand.sort(function (a, b) { return b.prio - a.prio; });
    return cand.slice(0, 3);
  }

  function renderToday() {
    var host = $("today-host");
    if (!host) return;
    host.innerHTML = "";

    var fatta = !!S.sessions[dayKey(0)];
    var st = streakLength();
    var plan = prescribe();
    var mins = plan.reduce(function (a, b) { return a + BLOCKS[b.id].min; }, 0);
    var titolo = fatta ? "Fatto. Ci vediamo domani." : "Tre blocchi, circa " + mins + " minuti";

    /* striscia della costanza */
    var strip = el("div", "streak");
    for (var i = 6; i >= 0; i--) {
      var d = dayKey(-i);
      var cell = el("div", "sday" + (S.sessions[d] ? " on" : "") + (i === 0 ? " today" : ""));
      cell.title = d;
      cell.appendChild(el("span", null, ["D", "L", "M", "M", "G", "V", "S"][new Date(d + "T12:00:00").getDay()]));
      strip.appendChild(cell);
    }
    var head = el("div", "today-head");
    var left = el("div");
    left.appendChild(el("p", "eyebrow", fatta ? "Sessione di oggi completata" : "La sessione di stasera"));
    left.appendChild(el("h2", null, titolo));
    var right = el("div", "streak-box");
    right.appendChild(el("b", null, String(st)));
    right.appendChild(el("span", null, st === 1 ? "giorno di fila" : "giorni di fila"));
    head.appendChild(left); head.appendChild(right);
    host.appendChild(head);
    host.appendChild(strip);

    var why = el("p", "lead");
    why.textContent = fatta
      ? "Hai già allenato oggi. Se vuoi insistere, puoi rifare la sessione: i risultati contano lo stesso."
      : "Scelti dai tuoi numeri: questi tre blocchi attaccano i punti dove stai perdendo di più.";
    host.appendChild(why);

    var list = el("div", "blocks");
    plan.forEach(function (b, i2) {
      var B2 = BLOCKS[b.id];
      var row = el("div", "block");
      var n = el("div", "bnum", String(i2 + 1));
      var body = el("div", "bbody");
      var t = el("h3", null, B2.nome);
      body.appendChild(t);
      body.appendChild(el("p", null, b.why));
      var meta = el("div", "bmeta mono");
      meta.textContent = B2.code + " · ~" + B2.min + " min";
      body.appendChild(meta);
      var go = el("button", "btn ghost sm", "Solo questo");
      go.onclick = function () { SESSION = null; B2.run(); };
      row.appendChild(n); row.appendChild(body); row.appendChild(go);
      list.appendChild(row);
    });
    host.appendChild(list);

    var cta = el("button", "btn primary big", (fatta ? "Rifai la sessione" : "Inizia la sessione") + " · ~" + mins + " min");
    cta.onclick = function () { startSession(plan); };
    host.appendChild(cta);

    var due = dueRules().length;
    var extras = el("div", "extras");
    if (due) {
      var r = el("button", "btn sm", "Ripassa " + due + " carte regola");
      r.onclick = function () { gotoTab("regole"); };
      extras.appendChild(r);
    }
    var g = el("button", "btn sm", "Partita completa (~12 min)");
    g.onclick = function () { B = null; newGame(); renderAll(); gotoTab("gioca"); };
    extras.appendChild(g);
    host.appendChild(extras);
  }

  function startSession(plan) {
    SESSION = { queue: plan, i: -1, active: true, t0: Date.now(), blocks: [] };
    sessionNext();
  }

  function sessionNext() {
    if (!SESSION) return;
    if (SESSION.i >= 0) SESSION.blocks.push(SESSION.queue[SESSION.i].id);
    SESSION.i++;
    if (SESSION.i >= SESSION.queue.length) { finishSession(); return; }
    BLOCKS[SESSION.queue[SESSION.i].id].run();
  }

  async function finishSession() {
    var mins = Math.max(1, Math.round((Date.now() - SESSION.t0) / 60000));
    var blocks = SESSION.blocks.slice();
    SESSION.active = false;
    S.sessions[dayKey(0)] = { at: Date.now(), blocks: blocks, mins: mins };
    if (S.db) {
      try { await S.db.doc("sessions/log").set({ days: S.sessions }); } catch (e) { }
    }
    var b = drillShell("Sessione completata");
    var st = streakLength();
    var h = el("h3", "d", st > 1 ? st + " giorni di fila." : "Prima sessione registrata.");
    b.appendChild(h);
    b.appendChild(el("p", null, "Hai chiuso " + blocks.length + " blocchi in circa " + mins + " minuti. " +
      "I risultati sono già nelle statistiche: domani la sessione cambia di conseguenza."));
    var row = el("div", "row");
    var due = dueRules().length;
    if (due) {
      var r = el("button", "btn sm", "Ripassa " + due + " carte regola");
      r.onclick = function () { closeModal(); gotoTab("regole"); };
      row.appendChild(r);
    }
    var g = el("button", "btn sm", "Una partita completa");
    g.onclick = function () { closeModal(); B = null; newGame(); renderAll(); gotoTab("gioca"); };
    var c = el("button", "btn primary sm", "Chiudi");
    c.onclick = function () { closeModal(); renderToday(); };
    row.appendChild(g); row.appendChild(c);
    b.appendChild(row);
    SESSION = null;
    renderToday();
  }

  /* ══════════════════════════════════════════════════════════
     ARCHIVIO TV — frasi realmente andate in onda
     ══════════════════════════════════════════════════════════ */

  function renderArchive() {
    var tv = S.corpus.filter(function (p) { return p.tv; });
    $("tv-count").textContent = tv.length
      ? tv.length + (tv.length === 1 ? " frase autentica in archivio" : " frasi autentiche in archivio")
      : "Archivio ancora vuoto";
    var host = $("tv-list"); host.innerHTML = "";
    tv.slice(-12).reverse().forEach(function (p) {
      var d = el("div", "mono");
      d.style.cssText = "font-size:.84rem;color:var(--ink-soft)";
      d.textContent = (p.d ? p.d + "  " : "") + p.t + (p.m ? "  · " + p.m : "");
      host.appendChild(d);
    });
    var cb = $("tv-only");
    cb.checked = !!S.settings.onlyTV;
    cb.disabled = tv.length < 20;
    $("tv-only-note").textContent = tv.length < 20
      ? "Disponibile da 20 frasi in su (ne mancano " + (20 - tv.length) + ")."
      : "Il gioco e gli esercizi pescheranno solo da qui.";
  }

  async function importTV() {
    var out = $("tv-out");
    if (!S.db) { out.textContent = "Archivio non collegato."; return; }
    var raw = $("tv-text").value || "";
    var data = ($("tv-date").value || "").trim();
    var manche = ($("tv-manche").value || "").trim();
    var have = {};
    S.corpus.forEach(function (p) { have[p.t] = true; });
    var clean = [], scarti = 0;
    raw.split("\n").forEach(function (line) {
      var t = line.toUpperCase().replace(/[’`]/g, "'").replace(/[^A-Z' ÀÈÉÌÒÙ]/g, "").replace(/\s+/g, " ").trim();
      if (!t) return;
      if (t.length < 6 || t.length > 48 || have[t]) { scarti++; return; }
      have[t] = true;
      clean.push({ t: t, d: data, m: manche });
    });
    if (!clean.length) { out.textContent = "Nessuna frase nuova da aggiungere (" + scarti + " scartate o già presenti)."; return; }
    $("btn-tv-add").disabled = true;
    try {
      var ref = S.db.doc("corpus/tv-reali");
      var snap = await ref.get();
      var cur = snap.exists ? (snap.data().items || []) : [];
      await ref.set({ label: "Viste in TV", authentic: true, items: cur.concat(clean), updated: Date.now() });
      clean.forEach(function (it) {
        S.corpus.push({ t: it.t, cat: "tv-reali", label: "Viste in TV", tv: true, d: it.d, m: it.m });
      });
      $("tv-text").value = "";
      out.textContent = "Aggiunte " + clean.length + " frasi" + (scarti ? " (" + scarti + " scartate)" : "") + ".";
      renderArchive();
      renderAll();
    } catch (e) {
      out.textContent = "Salvataggio non riuscito (" + ((e && e.code) || "errore") + ").";
    } finally { $("btn-tv-add").disabled = false; }
  }

  async function toggleOnlyTV(v) {
    S.settings.onlyTV = v;
    if (S.db) { try { await S.db.doc("settings/app").set(S.settings); } catch (e) { } }
    renderArchive();
  }

  function gotoTab(name) {
    var btns = document.querySelectorAll("nav.tabs button");
    Array.prototype.forEach.call(btns, function (b) {
      if (b.dataset.v === name) b.click();
    });
  }

  /* ══════════════════════════════════════════════════════════
     REGOLE (ripetizione spaziata)
     ══════════════════════════════════════════════════════════ */

  var BOX_DAYS = [0, 1, 3, 7, 16, 35];

  function dueRules() {
    var now = Date.now();
    return S.rules.filter(function (r) { return !r.due || new Date(r.due).getTime() <= now; });
  }

  function renderRules() {
    var host = $("rules-host"); host.innerHTML = "";
    if (!S.rules.length) {
      host.appendChild(el("p", "empty", "Il mazzo delle regole non è ancora caricato."));
      return;
    }
    var due = dueRules();
    $("rules-count").textContent = due.length + " da ripassare · " + S.rules.length + " in totale";
    if (!due.length) {
      host.appendChild(el("p", "empty", "Niente da ripassare oggi. Il prossimo giro arriva secondo la scadenza di ogni carta."));
      return;
    }
    var r = due[0];
    var card = el("div", "rule-card");
    card.appendChild(el("span", "pill", r.tag || "regola"));
    card.appendChild(el("div", "rule-q", r.q));
    var ans = el("div", "rule-a", r.a); ans.hidden = true;
    card.appendChild(ans);
    var row = el("div", "row");
    var show = el("button", "btn primary", "Mostra la risposta");
    show.onclick = function () {
      ans.hidden = false; row.innerHTML = "";
      [["Sbagliata", 0], ["Faticosa", 1], ["Sicura", 2]].forEach(function (b) {
        var btn = el("button", "btn" + (b[1] === 2 ? " primary" : ""), b[0]);
        btn.onclick = function () { gradeRule(r, b[1]); };
        row.appendChild(btn);
      });
    };
    row.appendChild(show);
    card.appendChild(row);
    host.appendChild(card);
  }

  async function gradeRule(r, grade) {
    var box = r.box || 1;
    box = grade === 0 ? 1 : Math.min(BOX_DAYS.length - 1, box + (grade === 2 ? 1 : 0));
    r.box = box;
    r.due = new Date(Date.now() + BOX_DAYS[box] * 86400000).toISOString();
    r.seen = (r.seen || 0) + 1;
    if (grade === 0) r.missed = (r.missed || 0) + 1;
    if (S.db) { try { await S.db.doc("rules/" + r.id).set(r); } catch (e) { } }
    bumpDay(0);
    saveStats();
    renderRules();
  }

  /* ══════════════════════════════════════════════════════════
     COACH + GENERATORE (capacità sample)
     ══════════════════════════════════════════════════════════ */

  async function askCoach() {
    if (!S.sample) return;
    var btn = $("btn-coach"), out = $("coach-out");
    btn.disabled = true;
    out.textContent = "Sto ragionando sui tuoi dati…";
    var k = S.stats.kpi || {};
    var prof = [
      "Partite giocate: " + S.stats.games + ", vinte: " + S.stats.wins + ", miglior bottino: " + S.stats.best + " euro.",
      "Soglia media di soluzione (percentuale di lettere scoperte quando risolve): " + (k.sogliaN ? Math.round(100 * k.sogliaSum / k.sogliaN) + "%" : "nessun dato"),
      "Precisione al pulsante: " + (k.buzzN ? Math.round(100 * k.buzzOk / k.buzzN) + "% su " + k.buzzN + " prenotazioni" : "nessun dato"),
      "Finali completati: " + (k.finaleN ? k.finaleOk + " su " + k.finaleN : "nessun dato"),
      "Caselle medie scoperte dall'apertura del finale: " + (k.grigliaN ? (k.grigliaSum / k.grigliaN).toFixed(1) : "nessun dato"),
      "Conteggio errori per tipo: " + (Object.keys(S.mistakes.counts).length
        ? Object.keys(S.mistakes.counts).map(function (t) { return (MISTAKE_LABEL[t] || t) + ": " + S.mistakes.counts[t]; }).join("; ")
        : "nessuno"),
      "Ultimi errori concreti: " + S.mistakes.recent.slice(0, 12).map(function (m) { return (MISTAKE_LABEL[m.type] || m.type) + (m.ctx ? " (" + m.ctx + ")" : ""); }).join("; ")
    ].join("\n");

    var prompt = [
      "Sei l'allenatore di un concorrente che si prepara al gioco televisivo italiano La Ruota della Fortuna.",
      "Il gioco: si girano spicchi con valori in euro, si chiamano consonanti, le vocali si comprano a 200 euro, la bancarotta azzera il montepremi della manche, e il finale chiede tre tabelloni in 60 secondi con N R T E date in regalo.",
      "Questi sono i dati reali del suo allenamento:",
      "",
      prof,
      "",
      "Scrivi in italiano, massimo 220 parole, in questo formato:",
      "1) DIAGNOSI: la singola debolezza che gli costa più punti, dedotta dai numeri sopra (cita i numeri).",
      "2) CAUSA: perché quell'errore si ripete, in una frase.",
      "3) PRESCRIZIONE: tre esercizi per questa settimana, con volume e obiettivo numerico, scelti fra: D1 soglia di informazione, D2 testacoda, D3 rubasecondi, D4 pulsante, D6 lettura della griglia, partita completa.",
      "4) REGOLA DA RIPETERE: una sola frase imperativa da ricordare in studio.",
      "Niente preamboli, niente elenchi puntati oltre a questi quattro blocchi."
    ].join("\n");

    try {
      await S.sample(prompt, {
        modelTier: "default",
        cache: false,
        onText: function (e) { out.textContent = e.text; }
      });
    } catch (e) {
      out.textContent = e && e.code === "not_granted"
        ? "Serve il tuo consenso per usare Claude da questa pagina."
        : "Non è arrivata una risposta (" + ((e && e.code) || "errore") + ").";
    } finally { btn.disabled = false; }
  }

  async function generatePuzzles() {
    if (!S.sample || !S.db) return;
    var btn = $("btn-gen"), out = $("gen-out");
    var cat = $("gen-cat").value;
    var n = Math.max(5, Math.min(40, parseInt($("gen-n").value, 10) || 15));
    btn.disabled = true;
    out.textContent = "Genero " + n + " frasi…";
    var label = $("gen-cat").selectedOptions[0].textContent;
    var existing = S.corpus.filter(function (p) { return p.cat === cat; }).map(function (p) { return p.t; });
    var prompt = [
      "Genera " + n + " frasi per un tabellone italiano tipo La Ruota della Fortuna.",
      "Categoria: " + label + ".",
      "Regole: tutto maiuscolo; solo lettere A-Z, spazi, apostrofi e vocali accentate maiuscole; nessuna punteggiatura; nessun numero in cifre; da 2 a 7 parole; lunghezza fra 10 e 42 caratteri; solo cose realmente esistenti e note in Italia.",
      "Non ripetere nessuna di queste: " + existing.slice(0, 120).join(" | "),
      "Rispondi solo con un array JSON di stringhe."
    ].join("\n");
    try {
      var arr = await S.sample.json(prompt, { modelTier: "default", cache: false });
      if (!Array.isArray(arr)) throw { code: "invalid_json" };
      var clean = [];
      arr.forEach(function (x) {
        var t = String(x || "").toUpperCase().replace(/[^A-Z' ÀÈÉÌÒÙ]/g, "").replace(/\s+/g, " ").trim();
        if (t.length >= 8 && t.length <= 48 && existing.indexOf(t) < 0 && clean.indexOf(t) < 0) clean.push(t);
      });
      if (!clean.length) { out.textContent = "Nessuna frase nuova utilizzabile."; btn.disabled = false; return; }
      var ref = S.db.doc("corpus/" + cat);
      var snap = await ref.get();
      var cur2 = snap.exists ? (snap.data().items || []) : [];
      var merged = cur2.concat(clean.map(function (t) { return { t: t }; }));
      await ref.set({ label: label, items: merged, updated: Date.now() });
      clean.forEach(function (t) { S.corpus.push({ t: t, cat: cat, label: label }); });
      out.textContent = "Aggiunte " + clean.length + " frasi a « " + label + " » (ora " + merged.length + " in archivio).";
    } catch (e) {
      out.textContent = "Generazione non riuscita (" + ((e && e.code) || "errore") + ").";
    } finally { btn.disabled = false; }
  }

  /* ══════════════════════════════════════════════════════════
     UI
     ══════════════════════════════════════════════════════════ */

  function buildUI() {
    // ruota
    var w = $("wheel");
    var grad = [];
    WHEEL.forEach(function (s, i) {
      var c = s.v === "BANCAROTTA" ? "#7E2A22" : s.v === "PASSA" ? "#4A5A57" : s.v === "JOLLY" ? "#C79A3C" :
        (i % 2 ? "#0F6E67" : "#14524E");
      grad.push(c + " " + (i * 15) + "deg " + ((i + 1) * 15) + "deg");
    });
    w.style.background = "conic-gradient(" + grad.join(",") + ")";
    WHEEL.forEach(function (s, i) {
      var l = el("div", "lbl", s.v === "BANCAROTTA" ? "BANC." : s.v === "PASSA" ? "PASSA" : s.v === "JOLLY" ? "JOLLY" : String(s.v));
      l.style.transform = "rotate(" + (i * 15 + 7.5 - 90) + "deg) translate(48px,-4px)";
      w.appendChild(l);
    });

    // tastiera
    var kh = $("keys");
    var r1 = el("div", "keyrow"), r2 = el("div", "keyrow");
    CONS.forEach(function (L) {
      var k = el("button", "key", L); k.dataset.l = L;
      k.onclick = function () { callConsonant(L); };
      r1.appendChild(k);
    });
    VOW.forEach(function (L) {
      var k = el("button", "key vowel", L); k.dataset.l = L;
      k.onclick = function () { buyVowelKey(L); };
      r2.appendChild(k);
    });
    kh.appendChild(r1); kh.appendChild(r2);

    $("btn-spin").onclick = doSpin;
    $("btn-vowel").onclick = buyVowel;
    $("btn-solve").onclick = function () {
      var v = $("solve-input").value.trim();
      if (!v) return;
      $("solve-input").value = "";
      trySolve(v);
    };
    $("solve-input").onkeydown = function (e) { if (e.key === "Enter") $("btn-solve").click(); };
    $("btn-newgame").onclick = function () { B = null; newGame(); renderAll(); };
    $("btn-buzz").onclick = humanBuzz;
    $("btn-buzz-send").onclick = submitBuzz;
    $("buzz-input").onkeydown = function (e) { if (e.key === "Enter") submitBuzz(); };
    document.addEventListener("keydown", globalKeys);
    setKeys(gameKeys());
    $("btn-skip").onclick = function () {
      lettersOf(G.puzzle.t).forEach(function (L) { G.rev[L] = true; });
      pushLog("Tabellone svelato: « " + G.puzzle.t + " ».");
      renderGame();
      setTimeout(endManche, 1200);
    };
    $("modal-close").onclick = closeModal;
    $("vowel-close").onclick = function () { $("vowel-modal").classList.remove("on"); };
    $("btn-coach").onclick = askCoach;
    $("btn-tv-add").onclick = importTV;
    $("tv-only").onchange = function () { toggleOnlyTV(this.checked); };
    $("btn-gen").onclick = generatePuzzles;

    var tabs = document.querySelectorAll("nav.tabs button");
    Array.prototype.forEach.call(tabs, function (b) {
      b.onclick = function () {
        Array.prototype.forEach.call(tabs, function (x) { x.setAttribute("aria-selected", x === b ? "true" : "false"); });
        Array.prototype.forEach.call(document.querySelectorAll(".view"), function (v) {
          v.classList.toggle("on", v.id === "view-" + b.dataset.v);
        });
        if (b.dataset.v === "oggi") renderToday();
        if (b.dataset.v === "stats") renderStats();
        if (b.dataset.v === "regole") renderRules();
        if (b.dataset.v === "archivio") renderArchive();
      };
    });
  }

  function renderAll() {
    renderToday();
    renderArchive();
    renderGame();
    renderDrills();
    renderStats();
    renderRules();
    var sel = $("gen-cat");
    if (sel && !sel.options.length) {
      var seen = {};
      S.corpus.forEach(function (p) { if (!seen[p.cat]) { seen[p.cat] = p.label; } });
      Object.keys(seen).forEach(function (c) {
        var o = document.createElement("option");
        o.value = c; o.textContent = seen[c];
        sel.appendChild(o);
      });
    }
    $("corpus-count").textContent = S.corpus.length + " frasi in archivio";
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
