// Aba "Espanhol": frases reais gravadas por nativos (Tatoeba), repetição espaçada,
// ouvir antes de ler, falar em voz alta e comparar a própria pronúncia. Sem voz sintética.
import { S, update, dayKey, addDays, dayLog, addLearn, activitiesOn } from "./store.js";
import { COURSE, AUDIO_CREDITS } from "./data-curso.js";
import { STORIES } from "./data-espanhol.js";
import { esc, $, $$, ICON, overlay, sheet, toast, shuffle } from "./ui.js";
import { play, stopAudio, attachMic, micButtonHtml, canDictate, canRecord, record, compare, norm, cacheAllAudio, preload } from "./voz.js";
import { go } from "./app.js";
import { setFilter } from "./assistir.js";

const ITEMS = COURSE.flatMap((u) => u.items.map((it) => ({ ...it, unit: u.id })));
const BY_ID = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
const words = (s) => norm(s).split(" ").filter(Boolean);
const pt = (it) => it.pt[0];

/* ---------- Repetição espaçada ---------- */
export function dueCount() {
  const t = dayKey();
  return Object.entries(S.es.cards).filter(([id, c]) => BY_ID[id] && c.due <= t).length;
}

function grade(id, ok) {
  const c = S.es.cards[id] || { reps: 0, int: 0, ease: 2.5, lapses: 0 };
  if (ok) {
    c.reps += 1;
    c.int = c.reps === 1 ? 1 : c.reps === 2 ? 3 : Math.round(c.int * c.ease);
    c.ease = Math.min(3, c.ease + 0.05);
  } else {
    c.lapses += 1;
    c.reps = 0;
    c.int = 1;
    c.ease = Math.max(1.3, c.ease - 0.2);
  }
  c.due = addDays(dayKey(), Math.max(1, c.int));
  S.es.cards[id] = c;
}

// O tipo de exercício sobe de nível conforme você domina a frase:
// ouvir e entender → montar → ditado → falar sozinho.
function reviewType(it, c) {
  const r = Math.random();
  if (!c || c.reps === 0) return "escuta";
  if (c.reps === 1) return r < 0.5 ? "escuta" : "montar";
  if (c.reps === 2) return r < 0.5 ? "ditado" : "montar";
  if (canRecord && r < 0.15) return "eco";
  return r < 0.55 ? "fala" : "ditado";
}

function buildTasks(unitId) {
  const today = dayKey();
  const newN = unitId ? 5 : Math.max(0, Math.min(5, S.es.newPerDay - (dayLog().esNew || 0)));
  const due = Object.entries(S.es.cards)
    .filter(([id, c]) => BY_ID[id] && c.due <= today && (!unitId || BY_ID[id].unit === unitId))
    .sort((a, b) => a[1].due.localeCompare(b[1].due))
    .slice(0, 12)
    .map(([id, c]) => ({ type: reviewType(BY_ID[id], c), it: BY_ID[id] }));
  const pool = unitId ? ITEMS.filter((i) => i.unit === unitId) : ITEMS;
  const fresh = pool.filter((i) => !S.es.cards[i.id]).slice(0, newN);
  let tasks = [
    ...fresh.map((it) => ({ type: "nova", it })),
    ...shuffle([...fresh.map((it) => ({ type: "escuta", it, isNew: true })), ...due]),
  ];
  if (!tasks.length) {
    const learned = shuffle(Object.keys(S.es.cards).filter((id) => BY_ID[id] && (!unitId || BY_ID[id].unit === unitId))).slice(0, 8);
    tasks = learned.map((id) => ({ type: reviewType(BY_ID[id], S.es.cards[id]), it: BY_ID[id], free: true }));
  }
  return { tasks, newCount: fresh.length };
}

/* ---------- Pedaços de interface ---------- */
const listenBtns = (big = false) => `
  <span class="say">
    <button class="speak${big ? " big" : ""}" data-play="1" aria-label="Ouvir de novo">${ICON.speaker}</button>
    <button class="speak slow" data-play="0.7" aria-label="Ouvir mais devagar">${ICON.turtle}</button>
  </span>`;

const credit = (it) => `<span class="credit">Voz: ${esc(it.by)} · Tatoeba</span>`;

function diffHtml(it, missed) {
  const miss = new Set(missed.map(norm));
  return it.es.split(/(\s+)/).map((w) => (/^\s+$/.test(w) ? w : miss.has(norm(w)) ? `<mark>${esc(w)}</mark>` : esc(w))).join("");
}

/* ---------- Lição ---------- */
export function startLesson(activityId, unitId) {
  const { tasks, newCount } = buildTasks(unitId);
  if (!tasks.length) { toast("Tudo em dia por aqui."); return; }
  preload(tasks.map((t) => t.it));
  const started = Date.now();
  let i = 0, firstTry = 0, graded = 0, xp = 0, spokenCount = 0;
  const retried = new Set();

  const ov = overlay(`<div id="lesson" style="display:flex;flex-direction:column;gap:18px;flex:1"></div>`);
  const host = $("#lesson", ov.el);
  let current = null;

  const finish = (quit) => {
    stopAudio();
    const mins = (Date.now() - started) / 60000;
    update((s) => {
      s.es.xp = (s.es.xp || 0) + xp;
      const log = dayLog();
      log.esNew = (log.esNew || 0) + newCount;
      if (!quit) activitiesOn(dayKey()).filter((a) => a.link === "espanhol" || a.id === activityId).forEach((a) => (log.a[a.id] ||= "done"));
    });
    addLearn("es", mins);
    if (quit) { ov.close(); return; }
    const pct = graded ? Math.round((firstTry / graded) * 100) : 100;
    host.innerHTML = `
      <div style="flex:1;display:grid;place-content:center;gap:14px;text-align:center">
        <span class="eyebrow">Lição concluída</span>
        <span class="big">+${xp} XP</span>
        <p class="muted">${pct}% de acerto de primeira · ${Math.max(1, Math.round(mins))} min${spokenCount ? ` · falou ${spokenCount} frases em voz alta` : ""}</p>
        <p>As frases voltam no dia em que você estaria para esquecer.</p>
      </div>
      <button class="btn pri block" id="end">Voltar</button>`;
    $("#end", host).onclick = () => ov.close();
  };

  const top = (label) => `
    <div class="lesson-top">
      <button class="icon-btn" id="quit" aria-label="Sair da lição">${ICON.close}</button>
      <div class="bar"><i style="width:${(i / tasks.length) * 100}%"></i></div>
      <span class="mono small muted">${Math.min(i + 1, tasks.length)}/${tasks.length}</span>
    </div>
    <span class="eyebrow">${label}</span>`;

  function bindCommon() {
    $("#quit", host).onclick = () => finish(true);
    $$("[data-play]", host).forEach((b) => (b.onclick = () => play(current, Number(b.dataset.play))));
  }

  function feedback(result, task, { missed = [], spoken = false } = {}) {
    const it = task.it;
    const ok = result !== "erro";
    const isRetry = retried.has(task);
    if (!task.free && !isRetry && !task.graded) {
      task.graded = true;
      graded++;
      if (ok) firstTry++;
      update(() => grade(it.id, ok));
    }
    xp += ok ? (isRetry ? 5 : spoken ? 15 : 10) : 0;
    if (!ok && !isRetry) {
      const again = { ...task, type: "montar" };
      retried.add(again);
      tasks.push(again);
    }
    const title = { ok: "Correto!", acento: "Certo, só faltou acento", quase: "Quase lá", erro: "Ainda não" }[result];
    $(".lesson-foot", host).innerHTML = `
      <div class="feedback ${ok ? "ok" : "no"}">
        <b>${title}</b>
        <div class="answer-es">${missed.length ? diffHtml(it, missed) : esc(it.es)}</div>
        <span class="muted">${esc(pt(it))}</span>
        ${missed.length && ok ? `<span class="small">Marquei as palavras que faltaram.</span>` : ""}
        ${it.tip && (!ok || task.isNew) ? `<span class="small">${esc(it.tip)}</span>` : ""}
        <div class="row" style="align-items:center">${listenBtns()}<button class="btn ${ok ? "pri" : "now"}" id="next" style="flex:1">Continuar</button></div>
      </div>`;
    bindCommon();
    play(it);
    $("#next", host).onclick = next;
  }

  function next() { i++; render(); }

  function render() {
    if (i >= tasks.length) return finish(false);
    const task = tasks[i];
    const it = (current = task.it);
    const t = task.type;

    if (t === "nova") {
      if (!S.es.cards[it.id]) update((s) => (s.es.cards[it.id] = { reps: 0, int: 0, ease: 2.5, lapses: 0, due: dayKey() }));
      host.innerHTML = `${top("Frase nova · ouça antes de ler")}
        <div class="intro-card">
          <div class="listen-row">${listenBtns(true)}<span class="small muted">Ouça 2 ou 3 vezes. Depois repita em voz alta.</span></div>
          <button class="reveal" id="reveal">Mostrar a frase</button>
          <div id="text" hidden style="display:grid;gap:8px">
            <span class="es">${esc(it.es)}</span>
            <span class="pt">${esc(pt(it))}</span>
            ${it.tip ? `<div class="hint">${esc(it.tip)}</div>` : ""}
          </div>
          ${credit(it)}
        </div>
        ${canRecord ? `<div class="eco" id="eco"></div>` : ""}
        <div class="lesson-foot"><button class="btn pri block" id="next">Entendi</button></div>`;
      bindCommon();
      $("#reveal", host).onclick = (e) => { e.currentTarget.remove(); $("#text", host).hidden = false; };
      if (canRecord) ecoWidget($("#eco", host), it);
      $("#next", host).onclick = next;
      play(it);
      return;
    }

    if (t === "escuta") {
      // Só o áudio: entenda o sentido antes de ver o texto.
      const sameLen = ITEMS.filter((x) => x.id !== it.id && Math.abs(words(x.es).length - words(it.es).length) <= 3);
      const pool = shuffle(sameLen.filter((x) => x.unit === it.unit)).concat(shuffle(sameLen));
      const opts = [it];
      for (const x of pool) { if (opts.length >= 4) break; if (!opts.some((o) => pt(o) === pt(x))) opts.push(x); }
      host.innerHTML = `${top("Ouça e escolha o que significa")}
        <div class="listen-row">${listenBtns(true)}<span class="small muted">Sem texto: treine o ouvido.</span></div>
        <div class="opts">${shuffle(opts).map((c) => `<button class="opt" data-id="${c.id}">${esc(pt(c))}</button>`).join("")}</div>
        <div class="lesson-foot"></div>`;
      bindCommon();
      play(it);
      $$(".opt", host).forEach((b) => (b.onclick = () => {
        if (host.dataset.locked === String(i)) return;
        host.dataset.locked = String(i);
        const ok = b.dataset.id === it.id;
        b.classList.add(ok ? "right" : "wrong");
        if (!ok) $(`.opt[data-id="${it.id}"]`, host).classList.add("right");
        feedback(ok ? "ok" : "erro", task);
      }));
      return;
    }

    if (t === "ditado" || t === "fala") {
      // ditado: ouve e escreve o que ouviu. fala: vê o português e diz em espanhol.
      host.innerHTML = `${top(t === "ditado" ? "Ouça e escreva (ou fale) o que ouviu" : "Diga em espanhol")}
        ${t === "ditado" ? `<div class="listen-row">${listenBtns(true)}</div>` : `<span class="q-pt">${esc(pt(it))}</span>`}
        <div class="answer-box">
          <textarea class="input" id="ans" rows="2" autocomplete="off" autocapitalize="sentences" autocorrect="off" spellcheck="false" lang="es" placeholder="${canDictate ? "Toque em Falar ou digite" : "Digite em espanhol"}"></textarea>
          ${micButtonHtml()}
        </div>
        ${canDictate ? "" : `<p class="small muted">Para ditar: troque o teclado do iPhone para Espanhol e use o microfone do teclado.</p>`}
        <div class="lesson-foot"><button class="btn pri block" id="check" disabled>Verificar</button></div>`;
      bindCommon();
      if (t === "ditado") play(it);
      const input = $("#ans", host);
      let spoken = false;
      const check = () => {
        if (!input.value.trim() || host.dataset.locked === String(i)) return;
        host.dataset.locked = String(i);
        input.disabled = true;
        if (spoken) spokenCount++;
        const c = compare(input.value, it.es, { spoken });
        feedback(c.r, task, { missed: c.missed, spoken });
      };
      input.addEventListener("input", () => ($("#check", host).disabled = !input.value.trim()));
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); check(); } });
      attachMic($(".mic", host), input, { lang: "es-ES", onFinal: () => { spoken = true; check(); } });
      $("#check", host).onclick = check;
      return;
    }

    if (t === "montar") {
      const ws = it.es.replace(/[¿?¡!.,;:—]/g, " ").split(/\s+/).filter(Boolean);
      const others = shuffle(ITEMS.filter((x) => x.unit !== it.unit).flatMap((x) => x.es.replace(/[¿?¡!.,;:—]/g, " ").split(/\s+/).filter(Boolean)))
        .filter((w) => !ws.map(norm).includes(norm(w)));
      const tiles = shuffle([...ws, ...[...new Set(others)].slice(0, 2)]).map((w, k) => ({ w, k }));
      const picked = [];
      host.innerHTML = `${top("Monte a frase em espanhol")}
        <span class="q-pt">${esc(pt(it))}</span>
        <div class="answer-line" id="line"></div>
        <div class="bank" id="bank">${tiles.map((x) => `<button class="wtile" data-k="${x.k}">${esc(x.w)}</button>`).join("")}</div>
        <div class="lesson-foot"><button class="btn pri block" id="check" disabled>Verificar</button></div>`;
      bindCommon();
      const line = $("#line", host);
      const drawLine = () => {
        line.innerHTML = picked.map((k) => `<button class="wtile" data-k="${k}">${esc(tiles[k].w)}</button>`).join("");
        $$(".wtile", line).forEach((b) => (b.onclick = () => {
          if (host.dataset.locked === String(i)) return;
          picked.splice(picked.indexOf(Number(b.dataset.k)), 1);
          $(`#bank .wtile[data-k="${b.dataset.k}"]`, host).classList.remove("used");
          drawLine();
        }));
        $("#check", host).disabled = !picked.length;
      };
      $$("#bank .wtile", host).forEach((b) => (b.onclick = () => {
        if (b.classList.contains("used") || host.dataset.locked === String(i)) return;
        b.classList.add("used");
        picked.push(Number(b.dataset.k));
        drawLine();
      }));
      $("#check", host).onclick = () => {
        host.dataset.locked = String(i);
        feedback(norm(picked.map((k) => tiles[k].w).join(" ")) === norm(it.es) ? "ok" : "erro", task);
      };
      return;
    }

    if (t === "eco") {
      // Sombra: ouça o nativo, grave você, compare os dois e avalie.
      host.innerHTML = `${top("Repita igual ao nativo")}
        <div class="intro-card">
          <div class="listen-row">${listenBtns(true)}</div>
          <span class="es">${esc(it.es)}</span>
          <span class="pt">${esc(pt(it))}</span>
          ${credit(it)}
        </div>
        <div class="eco" id="eco"></div>
        <div class="lesson-foot">
          <span class="small muted">Como ficou a sua versão?</span>
          <div class="row"><button class="btn" data-rate="erro">Preciso treinar</button><button class="btn pri" data-rate="ok">Ficou parecido</button></div>
        </div>`;
      bindCommon();
      ecoWidget($("#eco", host), it);
      play(it);
      $$("[data-rate]", host).forEach((b) => (b.onclick = () => {
        spokenCount++;
        const ok = b.dataset.rate === "ok";
        if (!task.free && !task.graded) { task.graded = true; graded++; if (ok) firstTry++; update(() => grade(it.id, ok)); }
        xp += ok ? 15 : 5;
        next();
      }));
    }
  }

  render();
}

// Grava você falando e deixa ouvir lado a lado com o nativo.
function ecoWidget(box, it) {
  let mine = null, recording = null;
  const draw = () => {
    box.innerHTML = `
      <button class="btn ${recording ? "now" : ""}" id="rec">${recording ? `${ICON.rec.replace("<svg", '<svg width="18" height="18" fill="currentColor"')} Parar` : `${ICON.mic.replace("<svg", '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"')} ${mine ? "Gravar de novo" : "Gravar minha voz"}`}</button>
      ${mine ? `<div class="row"><button class="btn" id="p-native">Nativo</button><button class="btn" id="p-mine">Você</button></div>` : ""}`;
    $("#rec", box).onclick = async () => {
      if (recording) { recording.stop(); return; }
      try {
        stopAudio();
        recording = await record(8000);
        draw();
        mine = await recording.done;
        recording = null;
        draw();
        new Audio(mine).play().catch(() => {});
      } catch (e) {
        recording = null;
        toast("Libere o microfone para gravar.");
        draw();
      }
    };
    if (mine) {
      $("#p-native", box).onclick = () => play(it);
      $("#p-mine", box).onclick = () => new Audio(mine).play().catch(() => {});
    }
  };
  draw();
}

/* ---------- Modo escuta: para ouvir na rua, no ônibus, na viagem ---------- */
function startListening() {
  const learned = shuffle(Object.keys(S.es.cards).filter((id) => BY_ID[id]).map((id) => BY_ID[id]));
  const list = learned.length >= 5 ? learned : ITEMS.slice(0, 20);
  preload(list.slice(0, 30));
  const started = Date.now();
  let k = 0, running = true, token = 0;
  const ov = overlay(`
    <div class="ov-top">
      <button class="icon-btn" data-x="close" aria-label="Fechar">${ICON.back}</button>
      <span class="eyebrow">Modo escuta</span>
      <span style="width:40px"></span>
    </div>
    <p class="muted small">Cada frase toca, aparece a tradução, e toca de novo. Repita junto em voz baixa.</p>
    <div class="intro-card" style="flex:1;align-content:center">
      <span class="mono small muted" id="l-n"></span>
      <span class="es" id="l-es"></span>
      <span class="pt" id="l-pt" style="min-height:1.5em"></span>
      <span class="credit" id="l-by"></span>
    </div>
    <div class="row"><button class="btn" data-x="toggle" id="l-toggle">Pausar</button><button class="btn pri" data-x="next">Próxima</button></div>
  `);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function loop() {
    const my = ++token;
    while (running && my === token) {
      const it = list[k % list.length];
      $("#l-n", ov.el).textContent = `${(k % list.length) + 1} de ${list.length}`;
      $("#l-es", ov.el).textContent = it.es;
      $("#l-pt", ov.el).textContent = "";
      $("#l-by", ov.el).textContent = `Voz: ${it.by} · Tatoeba`;
      await play(it);
      if (my !== token) return;
      await wait(1400);
      if (my !== token) return;
      $("#l-pt", ov.el).textContent = pt(it);
      await wait(900);
      if (my !== token) return;
      await play(it, 0.85);
      if (my !== token) return;
      await wait(1800);
      k++;
    }
  }
  loop();
  ov.el.addEventListener("click", (e) => {
    const b = e.target.closest("[data-x]");
    if (!b) return;
    if (b.dataset.x === "close") {
      running = false; token++; stopAudio();
      addLearn("es", (Date.now() - started) / 60000);
      ov.close();
    } else if (b.dataset.x === "next") {
      k++; running = true; $("#l-toggle", ov.el).textContent = "Pausar"; stopAudio(); loop();
    } else if (b.dataset.x === "toggle") {
      running = !running;
      b.textContent = running ? "Pausar" : "Continuar";
      token++;
      stopAudio();
      if (running) loop();
    }
  });
}

/* ---------- Leituras (texto, sem áudio) ---------- */
function openStory(st) {
  const started = Date.now();
  const dict = Object.fromEntries(Object.entries(st.gloss).map(([k, v]) => [norm(k), v]));
  const html = st.text.split(/(\s+)/).map((tok) => {
    if (/^\s+$/.test(tok)) return tok;
    const key = norm(tok);
    return `<span class="w${dict[key] ? " g" : ""}" data-w="${esc(key)}">${esc(tok)}</span>`;
  }).join("");
  const ov = overlay(`
    <div class="ov-top">
      <button class="icon-btn" data-x="close" aria-label="Fechar">${ICON.back}</button>
      <span class="eyebrow">Leitura · ${st.level}</span>
      <span style="width:40px"></span>
    </div>
    <h1>${esc(st.title)}</h1>
    <p class="small muted">Leia em voz alta. Toque numa palavra sublinhada para ver a tradução.</p>
    <div class="story">${html}</div>
    <div class="gloss" id="gloss" hidden><div style="flex:1;min-width:0"><b id="g-w" style="font-family:var(--display);font-size:19px"></b><div id="g-t" class="muted"></div></div></div>
  `);
  ov.el.addEventListener("click", (e) => {
    const w = e.target.closest(".w");
    if (w) {
      $$(".w.on", ov.el).forEach((x) => x.classList.remove("on"));
      w.classList.add("on");
      $("#gloss", ov.el).hidden = false;
      $("#g-w", ov.el).textContent = w.textContent.replace(/[¿?¡!.,;:«»]/g, "");
      $("#g-t", ov.el).textContent = dict[w.dataset.w] || "Tente pelo contexto.";
      return;
    }
    if (e.target.closest("[data-x=close]")) {
      addLearn("es", (Date.now() - started) / 60000);
      update((s) => ((s.es.read ||= {})[st.id] = Date.now()));
      ov.close();
    }
  });
}

function openMethod() {
  const voices = Object.keys(AUDIO_CREDITS);
  sheet(`
    <div class="sheet-head"><h2>Como o curso funciona</h2><button class="icon-btn" data-close aria-label="Fechar">${ICON.close}</button></div>
    <ol class="steps">
      <li><b>Só vozes humanas.</b> Todas as ${ITEMS.length} frases foram gravadas por pessoas reais no projeto Tatoeba. Nada de voz de robô.</li>
      <li><b>Ouvir antes de ler.</b> Cada frase nova começa só pelo áudio. O ouvido aprende primeiro, como criança.</li>
      <li><b>Frases inteiras, não palavras soltas.</b> Você aprende como o espanhol é falado de verdade.</li>
      <li><b>Falar em voz alta.</b> Você dita as respostas e grava a sua voz para comparar com a do nativo.</li>
      <li><b>O nível sobe com você.</b> Primeiro entender, depois montar, depois escrever o que ouviu, depois dizer sozinho.</li>
      <li><b>Revisão no momento certo.</b> Cada frase volta no dia em que você estaria para esquecer.</li>
    </ol>
    <div class="card" style="display:grid;gap:6px">
      <b>Créditos dos áudios</b>
      <p class="small muted">Frases e gravações do <a href="https://tatoeba.org" target="_blank" rel="noopener">Tatoeba</a>, usadas para estudo pessoal sob licenças Creative Commons. Vozes de: ${voices.map((v) => `${esc(v)} (${esc(AUDIO_CREDITS[v])})`).join(", ")}.</p>
    </div>
  `);
}

/* ---------- Tela ---------- */
export function renderEspanhol(root) {
  cacheAllAudio(ITEMS);
  const today = dayKey();
  const due = dueCount();
  const learned = Object.keys(S.es.cards).filter((id) => BY_ID[id]).length;
  const minsToday = Math.round(dayLog().learn.es || 0);
  const newLeft = Math.max(0, Math.min(5, S.es.newPerDay - (dayLog().esNew || 0)));
  const remaining = ITEMS.length - learned;
  const hasWork = due || (newLeft && remaining);
  const last28 = Array.from({ length: 28 }, (_, k) => addDays(today, k - 27));
  const studied = last28.filter((k) => (S.log[k]?.learn?.es || 0) > 0).length;

  root.innerHTML = `
    <header class="head">
      <div><span class="eyebrow">Frases reais, vozes reais</span><h1>Espanhol</h1></div>
      <button class="icon-btn" id="method" aria-label="Como o curso funciona">?</button>
    </header>

    <div class="stats">
      <div class="stat"><b>${due}</b><span>para revisar</span></div>
      <div class="stat"><b>${learned}</b><span>de ${ITEMS.length} frases</span></div>
      <div class="stat"><b>${minsToday}</b><span>min hoje</span></div>
    </div>

    <div class="now-card ${hasWork ? "" : "calm"}">
      <span class="eyebrow">Lição de hoje · cerca de 6 min</span>
      <h2>${hasWork ? [due ? `${Math.min(due, 12)} ${Math.min(due, 12) === 1 ? "revisão" : "revisões"}` : "", newLeft && remaining ? `${Math.min(newLeft, remaining)} ${Math.min(newLeft, remaining) === 1 ? "frase nova" : "frases novas"}` : ""].filter(Boolean).join(" + ") : "Tudo revisado hoje"}</h2>
      <p class="muted small">${hasWork ? "Ouvir, entender, montar, escrever e falar. Com fone fica melhor." : "Bom momento para o modo escuta ou um vídeo em espanhol."}</p>
      <button class="btn ${hasWork ? "now" : "pri"} block" id="start">${hasWork ? "Começar" : "Revisão livre"}</button>
    </div>

    <div class="quick">
      <button class="tile" id="listen"><span class="k">${ICON.ear}</span><b>Modo escuta</b><span>Para ouvir no ônibus ou na viagem</span></button>
      <button class="tile" id="es-videos"><span class="k">${ICON.play}</span><b>Vídeos em espanhol</b><span>História e ciência, para treinar o ouvido</span></button>
    </div>

    <section class="section">
      <div class="section-title"><h2>Seu ritmo</h2><span class="small muted">${studied} de 28 dias</span></div>
      <div class="days">${last28.map((k) => `<i class="${(S.log[k]?.learn?.es || 0) > 0 ? "y" : k < today ? "x" : ""}${k === today ? " today" : ""}" title="${k}"></i>`).join("")}</div>
    </section>

    <section class="section">
      <div class="section-title"><h2>Unidades</h2><span class="small muted">toque para estudar uma</span></div>
      ${COURSE.map((u, k) => {
        const n = u.items.filter((it) => S.es.cards[it.id]).length;
        return `<button class="unit ${n === u.items.length ? "full" : ""}" data-unit="${u.id}"><span class="n">${k + 1}</span><span class="txt"><b>${esc(u.title)}</b><div class="bar"><i style="width:${(n / u.items.length) * 100}%"></i></div></span><span class="count">${n}/${u.items.length}</span></button>`;
      }).join("")}
    </section>

    <section class="section">
      <div class="section-title"><h2>Leituras</h2><span class="small muted">leia em voz alta</span></div>
      ${STORIES.map((s) => `<button class="unit" data-story="${s.id}"><span class="n" style="font-size:13px">${s.level}</span><span class="txt"><b>${esc(s.title)}</b><span class="small muted">${S.es.read?.[s.id] ? "Lida · ler de novo" : "Toque nas palavras para traduzir"}</span></span><span class="count">›</span></button>`).join("")}
    </section>
  `;
  $("#start", root).onclick = () => startLesson();
  $("#method", root).onclick = openMethod;
  $("#listen", root).onclick = startListening;
  $("#es-videos", root).onclick = () => { setFilter("es"); go("assistir"); };
  $$("[data-unit]", root).forEach((b) => (b.onclick = () => startLesson(null, b.dataset.unit)));
  $$("[data-story]", root).forEach((b) => (b.onclick = () => openStory(STORIES.find((s) => s.id === b.dataset.story))));
}
