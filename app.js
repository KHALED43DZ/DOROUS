"use strict";
const VERSION = "1.1.0";
const $ = id => document.getElementById(id);
$("ver").textContent = "الإصدار " + VERSION;

/* ---------- الإعدادات ---------- */
const DEF = {
  textKeys: "", audioKeys: "",
  textModel: "gemini-3.8-flash", ttsModel: "gemini-3.8-flash-lite-tts",
  voice: "Charon", style: "تكلّم بهدوء ووقار وببطء، بلهجة جزائرية واضحة يفهمها كبار السن:",
  monitor: "1", channel: "", intro: "درس جديد", outro: "شكراً لكم، اشتركوا وشاركوا الفائدة",
  aspect: "v", bg: "#0e2f29"
};
let cfg = { ...DEF };
try { Object.assign(cfg, JSON.parse(localStorage.getItem("dorous") || "{}")); } catch (e) {}
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
  $("home").hidden = b.dataset.t !== "home";
  $("set").hidden = b.dataset.t !== "set";
});
const msg = t => $("msg").textContent = t;
const lines = s => s.split("\n").map(x => x.trim()).filter(Boolean);
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- Gemini مع تدوير المفاتيح ---------- */
const rot = { text: 0, audio: 0 };
async function gem(kind, model, body) {
  const keys = lines(cfg[kind + "Keys"]);
  if (!keys.length) throw new Error("أضف مفتاحاً واحداً على الأقل في الإعدادات");
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
      last = new Error(res.status + " " + (await res.text()).slice(0, 140));
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
    msg("تم. راجع النص وعدّله إن لزم.");
  } catch (e) { msg("تعذّر التحويل: " + e.message); }
  $("bConv").disabled = false;
};

/* ---------- توليد الصوت ---------- */
let ac; const AC = () => ac || (ac = new (window.AudioContext || window.webkitAudioContext)());
const cache = new Map();
let segs = [];
function split(t, max = 260) {
  const parts = t.replace(/[ \t]+/g, " ").split(/(?<=[.!؟?،:؛\n])\s*/).map(s => s.trim()).filter(Boolean);
  const out = []; let cur = "";
  for (const p of parts) {
    if (cur && (cur + " " + p).length > max) { out.push(cur); cur = p; } else cur = cur ? cur + " " + p : p;
  }
  if (cur) out.push(cur);
  return out;
}
async function tts(text) {
  const key = cfg.voice + "|" + cfg.style + "|" + text;
  if (cache.has(key)) return cache.get(key);
  const j = await gem("audio", cfg.ttsModel, {
    contents: [{ parts: [{ text: cfg.style + "\n" + text }] }],
    generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: cfg.voice } } } }
  });
  const bin = atob(j.candidates[0].content.parts[0].inlineData.data), n = bin.length >> 1, f = new Float32Array(n);
  for (let i = 0; i < n; i++) { let v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8); if (v > 32767) v -= 65536; f[i] = v / 32768; }
  const buf = AC().createBuffer(1, n, 24000); buf.copyToChannel(f, 0);
  cache.set(key, buf); return buf;
}
$("bAud").onclick = async () => {
  const parts = split($("out").value.trim());
  if (!parts.length) return msg("لا يوجد نص بالدارجة");
  $("bAud").disabled = true; $("prog").hidden = false; $("prog").value = 0; segs = [];
  try {
    for (let i = 0; i < parts.length; i++) {
      msg(`توليد الصوت ${i + 1} من ${parts.length}…`);
      segs.push({ text: parts[i], buf: await tts(parts[i]) });
      $("prog").value = (i + 1) / parts.length;
    }
    msg("الصوت جاهز. اضغط معاينة أو سجّل الفيديو.");
  } catch (e) { segs = []; msg("تعذّر توليد الصوت: " + e.message); }
  $("bAud").disabled = false;
};

/* ---------- الرسم والشخصية ---------- */
const cv = $("cv"), g = cv.getContext("2d");
const imgO = new Image(), imgC = new Image();
imgO.src = "assets/open.png"; imgC.src = "assets/closed.png";
const st = { text: "", talk: false, lvl: 0, t0: 0, dur: 1, pages: [] };
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
  const idx = st.talk ? Math.round(st.lvl * 11) : 0;
  const blink = t % 3800 < 150;
  const im = blink ? imgC : imgO;
  if (im.complete && im.naturalWidth) {
    g.save(); g.translate(W / 2, cy + ch); g.rotate(Math.sin(t / 900) * 0.012); g.translate(-W / 2, -(cy + ch));
    g.drawImage(im, (idx % 4) * 256 + 2, Math.floor(idx / 4) * 341.33 + 2, 252, 337, cx, cy + Math.sin(t / 650) * 6, cw, ch);
    g.restore();
  }
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
function idle() { if (running) return; size(); st.talk = false; st.text = "دروس"; draw(0); }
imgO.onload = imgC.onload = idle; idle();

/* ---------- التشغيل والتسجيل ---------- */
async function run(rec) {
  if (running) return;
  if (!segs.length) return msg("ولّد الصوت أولاً");
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
    st.lvl = st.lvl * 0.55 + Math.min(1, Math.sqrt(s / data.length) * 5) * 0.45;
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

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
