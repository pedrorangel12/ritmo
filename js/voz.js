// Áudio humano gravado, ditado por voz (fala → texto) e gravação para comparar a pronúncia.
import { toast, ICON } from "./ui.js";

/* ---------- Tocar a gravação de um nativo ---------- */
const player = new Audio();
player.preload = "auto";

export const audioSrc = (item) => `audio/es/${item.id.replace(/^t/, "")}.mp3`;

// O áudio é lido como arquivo inteiro (blob): assim funciona offline no iPhone,
// que pede pedaços do arquivo e não se dá bem com respostas vindas do cache.
const blobs = new Map();   // src -> promessa
const ready = new Map();   // src -> blob URL já carregado
function blobUrl(src) {
  if (!blobs.has(src)) {
    blobs.set(src, fetch(src)
      .then((r) => (r.ok ? r.blob() : Promise.reject()))
      .then((b) => { const u = URL.createObjectURL(b); ready.set(src, u); return u; })
      .catch(() => { blobs.delete(src); return src; }));
  }
  return blobs.get(src);
}

// Carrega antes os áudios de uma lição, para tocarem na hora.
export function preload(items) { items.forEach((it) => blobUrl(audioSrc(it))); }

// Guarda todos os áudios do curso no aparelho, uma vez, para usar sem internet.
export function cacheAllAudio(items) {
  try {
    if (!("caches" in window) || localStorage.getItem("ritmo.audioCached") === String(items.length)) return;
    caches.open("ritmo-audio")
      .then((c) => c.addAll(items.map(audioSrc)))
      .then(() => localStorage.setItem("ritmo.audioCached", String(items.length)))
      .catch(() => {});
  } catch (e) { /* sem cache */ }
}

// Toca a gravação; rate < 1 deixa mais devagar mantendo a voz natural.
// Troca a fonte sem esperar nada, para o iPhone aceitar o toque como ação do usuário.
export function play(item, rate = 1) {
  const src = audioSrc(item);
  if (!ready.has(src)) blobUrl(src);
  return new Promise((resolve) => {
    player.pause();
    player.src = ready.get(src) || src;
    player.playbackRate = rate;
    player.preservesPitch = true;
    player.webkitPreservesPitch = true;
    player.onended = () => resolve(true);
    player.onerror = () => resolve(false);
    player.play().catch(() => resolve(false));
  });
}

export function stopAudio() { player.pause(); }

/* ---------- Ditado: fala vira texto ---------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
export const canDictate = !!SR;

// Liga um botão de microfone a um campo de texto. append: soma ao que já foi escrito.
export function attachMic(button, input, { lang = "es-ES", append = false, onFinal } = {}) {
  if (!SR) { button.hidden = true; return; }
  let rec = null;
  const stop = () => { rec?.stop(); };
  button.onclick = () => {
    if (rec) return stop();
    stopAudio();
    rec = new SR();
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = false;
    const base = append && input.value.trim() ? input.value.trim() + " " : "";
    let finalText = "";
    button.classList.add("on");
    button.setAttribute("aria-pressed", "true");
    rec.onresult = (e) => {
      let interim = "";
      finalText = "";
      for (const r of e.results) (r.isFinal ? (finalText += r[0].transcript) : (interim += r[0].transcript));
      input.value = base + (finalText || interim);
      input.dispatchEvent(new Event("input"));
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") toast("Libere o microfone para o Ritmo nos Ajustes do iPhone.");
      else if (e.error === "no-speech") toast("Não ouvi nada. Toque e fale de novo.");
    };
    rec.onend = () => {
      rec = null;
      button.classList.remove("on");
      button.setAttribute("aria-pressed", "false");
      if (finalText && onFinal) onFinal(input.value);
    };
    try { rec.start(); } catch (e) { rec = null; button.classList.remove("on"); }
  };
}

export const micButtonHtml = (label = "Falar") =>
  `<button class="mic" type="button" aria-pressed="false" aria-label="${label}">${ICON.mic}<span>${label}</span></button>`;

/* ---------- Gravar a própria voz para comparar ---------- */
export const canRecord = !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);

export async function record(maxMs = 6000) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const rec = new MediaRecorder(stream);
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise((resolve) => {
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      resolve(URL.createObjectURL(new Blob(chunks, { type: rec.mimeType || "audio/mp4" })));
    };
  });
  rec.start();
  const timer = setTimeout(() => rec.state === "recording" && rec.stop(), maxMs);
  return { stop: () => { clearTimeout(timer); if (rec.state === "recording") rec.stop(); }, done };
}

/* ---------- Comparar respostas ---------- */
export const norm = (s) => s.toLowerCase().replace(/[¿?¡!.,;:«»"“”()—–-]/g, " ").replace(/\s+/g, " ").trim();
export const plain = (s) => norm(s).normalize("NFD").replace(/[̀-ͯ]/g, "");

function lev(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

// Resultado: "ok" | "acento" | "quase" | "erro", e quais palavras da resposta certa faltaram.
export function compare(answer, target, { spoken = false } = {}) {
  if (norm(answer) === norm(target)) return { r: "ok", missed: [] };
  const A = plain(answer).split(" "), T = plain(target).split(" ");
  const missed = norm(target).split(" ").filter((w, i) => !A.includes(plain(w)));
  if (A.join(" ") === T.join(" ")) return { r: spoken ? "ok" : "acento", missed: [] };
  const wordSim = 1 - lev(A, T) / Math.max(A.length, T.length);
  const charDist = lev([...A.join(" ")], [...T.join(" ")]);
  if (spoken && wordSim >= 0.75) return { r: "quase", missed };
  if (!spoken && charDist <= Math.max(1, Math.floor(T.join(" ").length / 15))) return { r: "quase", missed };
  return { r: "erro", missed };
}
