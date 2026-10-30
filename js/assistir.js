// Aba "Assistir": feed de vídeos longos + fatos históricos da Wikipédia.
import { S, update, dayKey, addLearn } from "./store.js";
import { VIDEOS, TOPICS } from "./data-videos.js";
import { esc, $, $$, ICON, sheet, overlay, toast, fmtDur, shuffle } from "./ui.js";
import { attachMic, micButtonHtml } from "./voz.js";

const FILTERS = [
  ["tudo", "Tudo"], ["historia", "História"], ["filosofia", "Filosofia"], ["ciencia", "Ciência"],
  ["geopolitica", "Geopolítica"], ["salvos", "Salvos"], ["vistos", "Assistidos"],
];
const PAGE = 10; // Quantos vídeos aparecem antes do aviso de pausa.

let filter = "tudo";
let shown = PAGE;
let facts = null;

const allVideos = () => [...S.watch.custom, ...VIDEOS];


function ordered() {
  const seed = Number(dayKey().replace(/-/g, ""));
  let list = shuffle(allVideos(), seed);
  if (filter === "salvos") list = list.filter((v) => S.watch.saved[v.id]);
  else if (filter === "vistos") list = list.filter((v) => S.watch.seen[v.id]);
  else if (filter !== "tudo") list = list.filter((v) => v.t === filter);
  if (filter !== "vistos") list.sort((a, b) => !!S.watch.seen[a.id] - !!S.watch.seen[b.id]);
  return list;
}

// Sugestão para a tela Hoje: um salvo, senão o primeiro não assistido do dia.
export function suggestion() {
  const saved = allVideos().find((v) => S.watch.saved[v.id] && !S.watch.seen[v.id]);
  if (saved) return saved;
  const seed = Number(dayKey().replace(/-/g, ""));
  return shuffle(allVideos(), seed).find((v) => !S.watch.seen[v.id]);
}

/* ---------- Fatos: "Neste dia" da Wikipédia em português ---------- */
async function loadFacts() {
  if (facts) return facts;
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0"), dd = String(d.getDate()).padStart(2, "0");
  const cacheKey = `ritmo.facts.${mm}${dd}`;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) return (facts = JSON.parse(cached));
  } catch (e) { /* sem cache */ }
  try {
    const [sel, ev] = await Promise.all(["selected", "events"].map((t) =>
      fetch(`https://pt.wikipedia.org/api/rest_v1/feed/onthisday/${t}/${mm}/${dd}`).then((r) => (r.ok ? r.json() : {}))));
    const seen = new Set();
    const list = [...(sel.selected || []), ...(ev.events || [])]
      .filter((e) => e.pages?.length && e.text && !seen.has(e.text) && seen.add(e.text))
      .map((e) => {
        const p = e.pages.find((x) => x.thumbnail) || e.pages[0];
        return { year: e.year, text: e.text, title: p.titles?.normalized || p.title, page: p.title, img: p.thumbnail?.source || "", extract: p.extract || "", url: p.content_urls?.mobile?.page || "" };
      });
    facts = shuffle(list, Number(mm + dd)).slice(0, 12);
    try {
      Object.keys(localStorage).filter((k) => k.startsWith("ritmo.facts.")).forEach((k) => localStorage.removeItem(k));
      localStorage.setItem(cacheKey, JSON.stringify(facts));
    } catch (e) { /* sem espaço */ }
  } catch (e) {
    facts = [];
  }
  return facts;
}

export const todayFact = () => loadFacts().then((f) => f[0]);

export function openFact(f) {
  sheet(`
    <div class="sheet-head"><div><span class="eyebrow">Neste dia</span><h2>Em ${esc(f.year)}</h2></div><button class="icon-btn" data-close aria-label="Fechar">${ICON.close}</button></div>
    ${f.img ? `<img src="${esc(f.img)}" alt="" style="border-radius:16px;max-height:240px;object-fit:cover;width:100%">` : ""}
    <p style="font-size:18px">${esc(f.text)}</p>
    ${f.extract ? `<div class="card" style="display:grid;gap:6px"><b>${esc(f.title)}</b><p class="muted">${esc(f.extract)}</p></div>` : ""}
    ${f.url ? `<a class="btn block" href="${esc(f.url)}" target="_blank" rel="noopener">Ler na Wikipédia ${ICON.ext.replace("<svg", '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"')}</a>` : ""}
  `);
}

/* ---------- Tela ---------- */
export function renderAssistir(root) {
  const list = ordered();
  const visible = list.slice(0, shown);
  root.innerHTML = `
    <header class="head">
      <div><span class="eyebrow">Vídeos longos para aprender</span><h1>Assistir</h1></div>
      <button class="icon-btn" id="add" aria-label="Adicionar vídeo">${ICON.plus}</button>
    </header>
    <div class="chips" role="toolbar" aria-label="Filtrar">
      ${FILTERS.map(([k, l]) => `<button class="chip" data-f="${k}" aria-pressed="${filter === k}">${l}</button>`).join("")}
    </div>
    <div class="feed" id="feed">
      ${visible.length ? "" : `<div class="endcard"><b>Nada aqui ainda.</b><span class="muted small">${filter === "salvos" ? "Salve vídeos para assistir depois." : filter === "vistos" ? "Os vídeos que você terminar aparecem aqui." : "Adicione vídeos pelo botão +."}</span></div>`}
    </div>
    ${list.length > shown ? `
      <div class="endcard">
        <b style="font-family:var(--display);font-size:20px">Pausa para respirar</b>
        <span class="muted">Você já passou por ${shown} vídeos. Escolha um e assista de verdade, ou volte para as suas tarefas.</span>
        <button class="btn" id="more">Mostrar mais ${Math.min(PAGE, list.length - shown)}</button>
      </div>` : ""}
  `;

  const feed = $("#feed", root);
  visible.forEach((v, i) => {
    feed.insertAdjacentHTML("beforeend", videoCard(v));
    if (filter === "tudo" && i % 3 === 2) feed.insertAdjacentHTML("beforeend", `<div class="fact-slot" data-n="${Math.floor(i / 3)}"></div>`);
  });
  if (filter === "tudo") {
    loadFacts().then((fs) => $$(".fact-slot", root).forEach((slot) => {
      const f = fs[Number(slot.dataset.n) + 1];
      if (!f) return slot.remove();
      slot.outerHTML = `
        <button class="fact" data-fact="${Number(slot.dataset.n) + 1}">
          ${f.img ? `<div class="fimg"><img src="${esc(f.img)}" alt="" loading="lazy"></div>` : ""}
          <div class="fbody"><span class="eyebrow">Neste dia</span><span class="year">${esc(f.year)}</span><span>${esc(f.text)}</span></div>
        </button>`;
    })).then(() => $$("[data-fact]", root).forEach((b) => (b.onclick = () => openFact(facts[Number(b.dataset.fact)]))));
  }

  $$(".chip", root).forEach((c) => (c.onclick = () => { filter = c.dataset.f; shown = PAGE; renderAssistir(root); window.scrollTo(0, 0); }));
  $$(".vcard", root).forEach((c) => (c.onclick = () => openPlayer(allVideos().find((v) => v.id === c.dataset.id))));
  $("#add", root).onclick = openAdd;
  const more = $("#more", root);
  if (more) more.onclick = () => { shown += PAGE; renderAssistir(root); };
}

function videoCard(v) {
  return `
    <button class="vcard" data-id="${esc(v.id)}">
      <div class="thumb">
        <img src="https://i.ytimg.com/vi/${esc(v.id)}/hqdefault.jpg" alt="" loading="lazy">
        ${v.d ? `<span class="dur">${fmtDur(v.d)}</span>` : ""}
        ${S.watch.seen[v.id] ? `<span class="seen">Assistido</span>` : ""}
      </div>
      <div class="vmeta"><b>${esc(v.title)}</b><span>${esc(v.c)} · ${TOPICS[v.t] || "Outro"}${S.watch.saved[v.id] ? " · salvo" : ""}</span></div>
    </button>`;
}

/* ---------- Player ---------- */
function openPlayer(v) {
  const opened = Date.now();
  const ov = overlay(`
    <div class="ov-top">
      <button class="icon-btn" data-x="close" aria-label="Fechar">${ICON.back}</button>
      <span class="eyebrow">${TOPICS[v.t] || ""}</span>
      <span style="width:40px"></span>
    </div>
    <div class="player">
      <iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(v.id)}?playsinline=1&rel=0&modestbranding=1" title="${esc(v.title)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>
    </div>
    <div style="display:grid;gap:4px"><h2>${esc(v.title)}</h2><span class="muted">${esc(v.c)}${v.d ? ` · ${fmtDur(v.d)}` : ""}</span></div>
    <div class="row">
      <button class="btn pri" data-x="seen">${S.watch.seen[v.id] ? "Assistido" : "Terminei"}</button>
      <button class="btn" data-x="save">${S.watch.saved[v.id] ? "Salvo" : "Salvar"}</button>
    </div>
    <div class="field">
      <label for="notes">Anotações</label>
      <div class="notes-box">
        <textarea class="input" id="notes" placeholder="O que você aprendeu? Uma frase já basta.">${esc(S.watch.notes[v.id] || "")}</textarea>
        ${micButtonHtml("Ditar")}
      </div>
    </div>
    <a class="btn ghost block" href="https://www.youtube.com/watch?v=${encodeURIComponent(v.id)}" target="_blank" rel="noopener">Não carregou? Abrir no YouTube</a>
    ${v.custom ? `<button class="btn ghost danger block" data-x="remove">Remover da lista</button>` : ""}
  `);
  const saveNotes = () => {
    const t = $("#notes", ov.el).value.trim();
    if ((S.watch.notes[v.id] || "") !== t) update((s) => { if (t) s.watch.notes[v.id] = t; else delete s.watch.notes[v.id]; });
  };
  ov.el.addEventListener("click", (e) => {
    const b = e.target.closest("[data-x]");
    if (!b) return;
    const x = b.dataset.x;
    if (x === "close") {
      saveNotes();
      // Conta o tempo com o vídeo aberto como aprendizado (no máximo a duração do vídeo).
      const mins = Math.min((Date.now() - opened) / 60000, v.d || 180);
      if (mins >= 1) addLearn("video", mins);
      ov.close();
    } else if (x === "seen") {
      update((s) => { if (s.watch.seen[v.id]) delete s.watch.seen[v.id]; else s.watch.seen[v.id] = Date.now(); });
      b.textContent = S.watch.seen[v.id] ? "Assistido" : "Terminei";
      if (S.watch.seen[v.id]) toast("Marcado como assistido");
    } else if (x === "save") {
      update((s) => { if (s.watch.saved[v.id]) delete s.watch.saved[v.id]; else s.watch.saved[v.id] = Date.now(); });
      b.textContent = S.watch.saved[v.id] ? "Salvo" : "Salvar";
    } else if (x === "remove") {
      if (!b.dataset.armed) { b.dataset.armed = "1"; b.textContent = "Toque de novo para remover"; return; }
      update((s) => { s.watch.custom = s.watch.custom.filter((c) => c.id !== v.id); });
      ov.close();
    }
  });
  $("#notes", ov.el).addEventListener("blur", saveNotes);
  attachMic($(".mic", ov.el), $("#notes", ov.el), { append: true, onFinal: saveNotes });
}

/* ---------- Adicionar vídeo por link ---------- */
function parseId(url) {
  const m = String(url).match(/(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([\w-]{11})/) || String(url).trim().match(/^([\w-]{11})$/);
  return m ? m[1] : null;
}

function openAdd() {
  let topic = "historia";
  const s = sheet(`
    <div class="sheet-head"><h2>Adicionar vídeo</h2><button class="icon-btn" data-close aria-label="Fechar">${ICON.close}</button></div>
    <p class="muted small">Cole o link de um vídeo do YouTube. No app do YouTube: Compartilhar → Copiar link.</p>
    <div class="field"><label for="a-url">Link</label><input class="input" id="a-url" inputmode="url" autocomplete="off" placeholder="https://youtu.be/..."></div>
    <div class="field"><span class="lbl">Tema</span><div class="chips wrap" id="a-topic">${Object.entries(TOPICS).map(([k, l]) => `<button class="chip" data-t="${k}" aria-pressed="${k === topic}">${l}</button>`).join("")}</div></div>
    <div class="field"><label for="a-min">Duração aproximada (min)</label><input class="input" id="a-min" type="number" inputmode="numeric" placeholder="Ex.: 45"></div>
    <button class="btn pri block" id="a-save">Adicionar</button>
  `);
  const el = s.el;
  $$("#a-topic .chip", el).forEach((c) => (c.onclick = () => {
    topic = c.dataset.t;
    $$("#a-topic .chip", el).forEach((x) => x.setAttribute("aria-pressed", x === c));
  }));
  $("#a-save", el).onclick = async () => {
    const id = parseId($("#a-url", el).value);
    if (!id) { toast("Esse link não parece ser do YouTube."); return; }
    if (allVideos().some((v) => v.id === id)) { toast("Esse vídeo já está na lista."); return; }
    const btn = $("#a-save", el);
    btn.disabled = true;
    btn.textContent = "Buscando título...";
    let title = "Vídeo do YouTube", channel = "YouTube";
    try {
      const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent("https://www.youtube.com/watch?v=" + id)}`);
      if (r.ok) { const j = await r.json(); title = j.title || title; channel = j.author_name || channel; }
    } catch (e) { /* sem internet: fica com o título genérico */ }
    update((st) => st.watch.custom.unshift({ id, t: topic, d: Number($("#a-min", el).value) || 0, c: channel, title, custom: true }));
    s.close();
    toast("Vídeo adicionado");
  };
}
