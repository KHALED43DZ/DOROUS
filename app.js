"use strict";
const VERSION = "1.2.0";
const $ = id => document.getElementById(id);
$("ver").textContent = "الإصدار " + VERSION;

/* ---------- الإعدادات ---------- */
const DEF = {
  textKeys: "", audioKeys: "",
  textModel: "gemini-3.8-flash", ttsModel: "gemini-3.8-flash-lite-tts",
  voice: "Charon", style: "تكلّم بهدوء ووقار وببطء، بلهجة جزائرية واضحة يفهمها كبار السن:",
  monitor: "1", channel: "", intro: "درس جديد", outro: "شكراً لكم، اشتركوا وشاركوا الفائدة",
  aspect: "v", bg: "#0e2f29", motion: "1"
};
let cfg = { ...DEF };
try { Object.assign(cfg, JSON.parse(localStorage.getItem("dorous") || "{}")); } catch (e) {}
const OKM = /^[a-z][a-z0-9.\-]*$/i;
for (const k of ["textModel", "ttsModel"]) { cfg[k] = String(cfg[k] || "").trim().replace(/^models\//, ""); if (!OKM.test(cfg[k])) cfg[k] = DEF[k]; }
const MODELS = {
  textModel: [
    ["gemini-4-carbon", "Gemini 4 Carbon (مدفوع)"],
    ["gemini-4-argon", "Gemini 4 Argon (مدفوع)"],
    ["gemini-3.8-flash", "Gemini 3.8 Flash"],
    ["gemini-3.6-flash", "Gemini 3.6 Flash (مدفوع)"],
    ["gemini-3.5-flash-lite", "Gemini 3.5 Flash Lite"],
    ["gemini-3.1-pro-preview", "Gemini 3.1 Pro Preview"],
    ["gemini-3.1-flash-lite", "Gemini 3.1 Flash Lite"],
    ["gemini-3-flash-preview", "Gemini 3 Flash Preview (مدفوع)"]
  ],
  ttsModel: [
    ["gemini-3.8-flash-lite-tts", "Gemini 3.8 Flash Lite TTS"],
    ["gemini-3.1-flash-tts-preview", "Gemini 3.1 Flash TTS Preview"],
    ["gemini-2.5-flash-preview-tts", "Gemini 2.5 Flash TTS (قديم)"]
  ]
};
const addOpt = (el, v, l) => { const o = document.createElement("option"); o.value = v; o.textContent = l; el.insertBefore(o, el.lastElementChild && el.lastElementChild.value === "__custom__" ? el.lastElementChild : null); };
for (const k in MODELS) {
  const el = $(k);
  MODELS[k].forEach(([v, l]) => addOpt(el, v, l));
  const c = document.createElement("option"); c.value = "__custom__"; c.textContent = "نموذج آخر (اكتب الاسم)…"; el.appendChild(c);
  if (cfg[k] && !MODELS[k].some(m => m[0] === cfg[k])) addOpt(el, cfg[k], cfg[k]);
}
for (const k in DEF) {
  const el = $(k); el.value = cfg[k];
  el.addEventListener("input", () => {
    if (el.value === "__custom__") {
      const v = (prompt("اكتب اسم النموذج بالضبط:") || "").trim();
      if (v) { addOpt(el, v, v); el.value = v; } else el.value = cfg[k];
    }
    cfg[k] = el.value;
    try { localStorage.setItem("dorous", JSON.stringify(cfg)); } catch (e) {}
    if (k === "aspect" || k === "bg") idle();
  });
}
document.querySelectorAll(".tab").forEach(b => b.onclick = () => {
  document.querySelectorAll(".tab").forEach(x => x.classList.toggle("on", x === b));
  for (const p of ["home", "les", "set"]) $(p).hidden = b.dataset.t !== p;
  if (b.dataset.t === "les") renderList();
});
const msg = t => $("msg").textContent = t;
const lines = s => s.split("\n").map(x => x.trim()).filter(Boolean);
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- Gemini مع تدوير المفاتيح ---------- */
const rot = { text: 0, audio: 0 };
async function gem(kind, model, body) {
  const keys = lines(cfg[kind + "Keys"]);
  if (!keys.length) throw new Error("أضف مفتاحاً واحداً على الأقل في الإعدادات");
  model = String(model || "").trim().replace(/^models\//, "");
  if (!OKM.test(model)) throw new Error("اسم النموذج غير صالح (" + model + ")، اختره من الإعدادات");
  let last;
  for (let r = 0; r < keys.length * 2; r++) {
    const i = rot[kind] % keys.length;
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": keys[i] },
        body: JSON.stringify(body)
      });
      if (res.ok) return await res.json();
      let tx = await res.text(); try { tx = JSON.parse(tx).error.message; } catch (e) {}
      last = new Error(res.status + " [" + model + "] " + String(tx).slice(0, 220));
    } catch (e) { last = e; }
    rot[kind]++;
    if (r % keys.length === keys.length - 1) { msg("الحصة ممتلئة، انتظار قصير…"); await sleep(5000); }
  }
  throw last;
}

$("bTest").onclick = async () => {
  const out = [];
  for (const [n, k] of [["التحليل", "textKeys"], ["الصوت", "audioKeys"]]) {
    let ok = 0; const ks = lines(cfg[k]);
    for (const key of ks) {
      try { const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models", { headers: { "x-goog-api-key": key } }); if (r.ok) ok++; } catch (e) {}
    }
    out.push(`${n}: ${ok} من ${ks.length} صالح`);
  }
  alert(out.join("\n"));
};

/* ---------- التحويل إلى الدارجة ---------- */
const SYS = "أنت محرّر يحوّل النصوص الدينية والتعليمية من العربية الفصحى إلى الدارجة الجزائرية البسيطة، لجمهور من كبار السن غير المتعلمين. القواعد: جمل قصيرة وواضحة؛ كلمات جزائرية يومية؛ أبقِ الآيات والأحاديث بنصها الفصيح كما هي ثم اشرحها بالدارجة؛ اشرح كل مصطلح صعب بمثال من الحياة اليومية؛ لا تغيّر المعنى ولا تضف أحكاماً؛ اكتب نصاً متصلاً بلا عناوين ولا رموز. أخرج النص المحوّل فقط.";
$("bConv").onclick = async () => {
  const t = $("src").value.trim();
  if (!t) return msg("ألصق النص أولاً");
  $("bConv").disabled = true; msg("جارٍ التحويل…");
  try {
    const j = await gem("text", cfg.textModel, { systemInstruction: { parts: [{ text: SYS }] }, contents: [{ parts: [{ text: t }] }] });
    $("out").value = j.candidates[0].content.parts.map(p => p.text || "").join("").trim();
    ensureLesson(); await save(); msg("تم وحُفظ الدرس. راجع النص وعدّله إن لزم.");
  } catch (e) { msg("تعذّر التحويل: " + e.message); }
  $("bConv").disabled = false;
};

/* ---------- حفظ الدروس (IndexedDB) ---------- */
const idbP = new Promise((res, rej) => { const r = indexedDB.open("dorous", 1); r.onupgradeneeded = () => r.result.createObjectStore("lessons", { keyPath: "id" }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const idb = (m, f) => idbP.then(d => new Promise((res, rej) => { const t = d.transaction("lessons", m), q = f(t.objectStore("lessons")); t.oncomplete = () => res(q.result); t.onerror = () => rej(t.error); }));
let cur = null, sv;
function ensureLesson() { if (!cur) cur = { id: Date.now(), title: "", src: "", out: "", segs: [], t: Date.now() }; }
function save() {
  if (!cur) return Promise.resolve();
  cur.src = $("src").value; cur.out = $("out").value; cur.t = Date.now();
  cur.title = (cur.out || cur.src).trim().replace(/\s+/g, " ").slice(0, 40) || "درس بلا عنوان";
  return idb("readwrite", s => s.put({ id: cur.id, title: cur.title, src: cur.src, out: cur.out, t: cur.t, segs: cur.segs.map(x => ({ text: x.text, voice: x.voice, raw: x.raw })) })).catch(() => {});
}
const later = () => { clearTimeout(sv); sv = setTimeout(() => { if ($("src").value.trim() || $("out").value.trim()) { ensureLesson(); save(); } }, 800); };
$("src").addEventListener("input", later); $("out").addEventListener("input", later);
function upd() {
  const s = cur ? cur.segs : [], d = s.filter(x => x.raw).length;
  $("bAud").textContent = s.length && d < s.length ? `أكمل توليد الصوت (${d} من ${s.length})` : "ولّد الصوت";
  $("prog").hidden = !s.length; $("prog").value = s.length ? d / s.length : 0;
}
function openLesson(l, quiet) {
  cur = { ...l, segs: l.segs.map(s => ({ ...s })) };
  $("src").value = l.src; $("out").value = l.out; $("dl").hidden = true; upd(); idle();
  if (!quiet) document.querySelector('.tab[data-t="home"]').click();
}
function newLesson() { cur = null; $("src").value = ""; $("out").value = ""; $("dl").hidden = true; upd(); idle(); document.querySelector('.tab[data-t="home"]').click(); }
$("bNew").onclick = newLesson;
async function renderList() {
  const L = ((await idb("readonly", s => s.getAll()).catch(() => [])) || []).sort((a, b) => b.t - a.t), box = $("list");
  box.textContent = L.length ? "" : "لا توجد دروس محفوظة بعد.";
  for (const l of L) {
    const d = l.segs.filter(s => s.raw).length, n = l.segs.length;
    const lab = !n ? "نص فقط" : d === n ? "مكتمل" : `ناقص (${d} من ${n})`;
    const el = document.createElement("div"); el.className = "item";
    const info = document.createElement("div"), b = document.createElement("b"), sm = document.createElement("small");
    b.textContent = l.title; sm.textContent = lab + " - " + new Date(l.t).toLocaleDateString("ar");
    info.append(b, sm);
    const bo = document.createElement("button"); bo.textContent = "فتح"; bo.onclick = () => openLesson(l);
    const bd = document.createElement("button"); bd.textContent = "حذف";
    bd.onclick = async () => { if (confirm("حذف هذا الدرس نهائياً؟")) { await idb("readwrite", s => s.delete(l.id)); if (cur && cur.id === l.id) newLesson(); else renderList(); } };
    el.append(info, bo, bd); box.append(el);
  }
}
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

/* ---------- توليد الصوت ---------- */
let ac; const AC = () => ac || (ac = new (window.AudioContext || window.webkitAudioContext)());
function split(t, max = 260) {
  const parts = t.replace(/[ \t]+/g, " ").split(/(?<=[.!؟?،:؛\n])\s*/).map(s => s.trim()).filter(Boolean);
  const out = []; let c = "";
  for (const p of parts) {
    if (c && (c + " " + p).length > max) { out.push(c); c = p; } else c = c ? c + " " + p : p;
  }
  if (c) out.push(c);
  return out;
}
async function tts(text) {
  const j = await gem("audio", cfg.ttsModel, {
    contents: [{ parts: [{ text: cfg.style + "\n" + text }] }],
    generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: cfg.voice } } } }
  });
  const bin = atob(j.candidates[0].content.parts[0].inlineData.data), n = bin.length >> 1, u = new Uint8Array(n * 2);
  for (let i = 0; i < n * 2; i++) u[i] = bin.charCodeAt(i);
  return u.buffer;
}
const pcm = ab => {
  const i = new Int16Array(ab), f = new Float32Array(i.length);
  for (let k = 0; k < i.length; k++) f[k] = i[k] / 32768;
  const b = AC().createBuffer(1, f.length, 24000); b.copyToChannel(f, 0); return b;
};
$("bAud").onclick = async () => {
  const parts = split($("out").value.trim());
  if (!parts.length) return msg("لا يوجد نص بالدارجة");
  ensureLesson();
  const prior = new Map(cur.segs.map(s => [s.text + "|" + s.voice, s]));
  cur.segs = parts.map(t => prior.get(t + "|" + cfg.voice) || { text: t, voice: cfg.voice, raw: null });
  await save(); upd();
  $("bAud").disabled = true; let err;
  for (let i = 0; i < cur.segs.length; i++) {
    const s = cur.segs[i];
    if (!s.raw) {
      msg(`توليد الصوت ${i + 1} من ${cur.segs.length}…`);
      try { s.raw = await tts(s.text); } catch (e) { err = e; break; }
      await save(); upd();
    }
  }
  $("bAud").disabled = false; upd();
  const d = cur.segs.filter(s => s.raw).length;
  msg(err ? `توقف التوليد عند ${d} من ${cur.segs.length} (${String(err.message).slice(0, 120)}). تم حفظ ما اكتمل، اضغط «أكمل توليد الصوت» لاحقاً.` : "الصوت جاهز ومحفوظ. اضغط معاينة أو سجّل الفيديو.");
};

/* ---------- الرسم والشخصية ---------- */
const cv = $("cv"), g = cv.getContext("2d");
const imgO = new Image(), imgC = new Image();
imgO.src = "assets/open.png"; imgC.src = "assets/closed.png";
const st = { text: "", talk: false, lvl: 0, t0: 0, dur: 1, pages: [] };
const OFF = [[0.0, 0.0], [2.5, -0.2], [2.1, -0.2], [4.3, -0.2], [6.6, -4.4], [6.2, -4.5], [4.4, -4.6], [5.0, -4.4], [6.8, -1.4], [5.9, -1.4], [4.7, -1.5], [5.2, -1.4]];
let fi = 0, ft = 0;
function frameIdx(t) {
  const tg = st.talk ? Math.round(st.lvl * 11) : 0;
  if (tg !== fi && t - ft > 110) { fi += Math.sign(tg - fi) * Math.min(2, Math.abs(tg - fi)); ft = t; }
  return fi;
}
let running = false, stopFlag = false, curSrc = null;

function wrap(t, w) {
  const out = [];
  for (const para of t.split("\n")) {
    let l = "";
    for (const wd of para.split(" ")) {
      const x = l ? l + " " + wd : wd;
      if (g.measureText(x).width > w && l) { out.push(l); l = wd; } else l = x;
    }
    out.push(l);
  }
  return out;
}
function draw(t) {
  const v = cfg.aspect === "v", W = cv.width, H = cv.height;
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, cfg.bg); gr.addColorStop(1, "#050f0d");
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.strokeStyle = "#d4a94f"; g.lineWidth = 10; g.strokeRect(24, 24, W - 48, H - 48);
  const ch = H * (v ? 0.5 : 0.7), cw = ch * 0.75, cx = W / 2 - cw / 2, cy = H * (v ? 0.1 : 0.06);
  const idx = frameIdx(t), im = t % 4200 < 140 ? imgC : imgO;
  const m = [0, 0.35, 1][+cfg.motion || 0], k = cw / 252, o = OFF[idx];
  if (im.complete && im.naturalWidth) g.drawImage(im, (idx % 4) * 256 + 2, Math.floor(idx / 4) * 341.33 + 2, 252, 337, cx - o[0] * k, cy - o[1] * k + Math.sin(t / 1500) * 5 * m, cw, ch);
  const py = cy + ch - 10, ph = H - 60 - py;
  g.fillStyle = "rgba(8,32,27,.94)"; g.beginPath(); g.roundRect(48, py, W - 96, ph, 28); g.fill();
  g.strokeStyle = "#d4a94f"; g.lineWidth = 4; g.stroke();
  const fs = v ? 62 : 54; g.font = `700 ${fs}px "Noto Naskh Arabic","Segoe UI",Tahoma,sans-serif`;
  g.fillStyle = "#f5efdf"; g.textAlign = "center"; g.textBaseline = "middle"; g.direction = "rtl";
  let txt = st.text;
  if (st.talk && st.pages.length) {
    const p = Math.min(st.pages.length - 1, Math.floor(Math.max(0, (AC().currentTime - st.t0) / st.dur) * st.pages.length));
    txt = st.pages[p];
  }
  const ls = wrap(txt, W - 180), lh = fs * 1.5, y0 = py + ph / 2 - (ls.length - 1) * lh / 2;
  ls.forEach((l, i) => g.fillText(l, W / 2, y0 + i * lh));
}
function size() { const v = cfg.aspect === "v"; cv.width = v ? 1080 : 1920; cv.height = v ? 1920 : 1080; }
function idle() { if (running) return; fi = 0; size(); st.talk = false; st.text = "دروس"; draw(0); }
imgO.onload = imgC.onload = idle; idle();

/* ---------- التشغيل والتسجيل ---------- */
async function run(rec) {
  if (running) return;
  const segs = cur ? cur.segs : [];
  if (!segs.length || segs.some(s => !s.raw)) return msg("الصوت غير مكتمل، ولّده أو أكمله أولاً");
  segs.forEach(s => { s.buf = s.buf || pcm(s.raw); });
  running = true; stopFlag = false; $("dl").hidden = true; size();
  const ctx = AC(); await ctx.resume();
  const an = ctx.createAnalyser(); an.fftSize = 1024;
  const dest = ctx.createMediaStreamDestination();
  an.connect(dest); if (cfg.monitor === "1") an.connect(ctx.destination);
  const data = new Uint8Array(an.fftSize);
  let mr, chunks = [], mime = "";
  if (rec) {
    const stream = cv.captureStream(30);
    dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
    mime = ["video/mp4;codecs=avc1,mp4a.40.2", "video/webm;codecs=vp9,opus", "video/webm"].find(m => MediaRecorder.isTypeSupported(m)) || "";
    mr = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5e6 });
    mr.ondataavailable = e => e.data.size && chunks.push(e.data);
    mr.start(1000);
  }
  (function loop(t) {
    if (!running) return;
    an.getByteTimeDomainData(data);
    let s = 0; for (const x of data) { const d = (x - 128) / 128; s += d * d; }
    st.lvl = st.lvl * 0.75 + Math.min(1, Math.sqrt(s / data.length) * 5) * 0.25;
    draw(t); requestAnimationFrame(loop);
  })(0);
  const card = async (text, ms) => { st.talk = false; st.text = text; await sleep(ms); };
  const per = cfg.aspect === "v" ? 7 : 11;
  try {
    await card([cfg.channel, cfg.intro].filter(Boolean).join("\n"), 3000);
    for (const sg of segs) {
      if (stopFlag) break;
      const w = sg.text.split(" "), pages = [];
      for (let i = 0; i < w.length; i += per) pages.push(w.slice(i, i + per).join(" "));
      st.pages = pages; st.talk = true; st.dur = sg.buf.duration; st.t0 = ctx.currentTime;
      await new Promise(res => {
        const sr = ctx.createBufferSource(); sr.buffer = sg.buf; sr.connect(an); curSrc = sr; sr.onended = res; sr.start();
      });
      st.talk = false; await sleep(250);
    }
    if (!stopFlag) await card([cfg.outro, cfg.channel].filter(Boolean).join("\n"), 3500);
  } catch (e) { msg("خطأ: " + e.message); }
  running = false; st.talk = false;
  try { an.disconnect(); } catch (e) {}
  if (rec) {
    await new Promise(res => { mr.onstop = res; mr.stop(); });
    const ext = mime.includes("mp4") ? "mp4" : "webm";
    const a = $("dl"); a.href = URL.createObjectURL(new Blob(chunks, { type: mime || "video/webm" }));
    a.download = `dorous-${Date.now()}.${ext}`; a.hidden = false;
    msg(stopFlag ? "تم الإيقاف." : "الفيديو جاهز للتحميل.");
  } else msg(stopFlag ? "تم الإيقاف." : "انتهت المعاينة.");
  idle();
}
$("bPrev").onclick = () => run(false);
$("bRec").onclick = () => run(true);
$("bStop").onclick = () => { stopFlag = true; try { curSrc && curSrc.stop(); } catch (e) {} };

idb("readonly", s => s.getAll()).then(L => { if (L && L.length) openLesson(L.sort((a, b) => b.t - a.t)[0], true); }).catch(() => {});
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
