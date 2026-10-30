// Telas "Hoje" e "Hábitos", modo foco e editor de atividades.
import { S, update, dayKey, addDays, weekday, dayLog, activitiesOn, consistency, isDone, periodOf, PERIODS, uid } from "./store.js";
import { esc, $, $$, ICON, sheet, overlay, toast, fmtDur, nowMinutes, toMin, beep } from "./ui.js";
import { go } from "./app.js";
import { suggestion as videoSuggestion, todayFact, openFact } from "./assistir.js";
import { dueCount, startLesson } from "./espanhol.js";
import { openSettings } from "./ajustes.js";

const WD = ["D", "S", "T", "Q", "Q", "S", "S"];
const WD_LONG = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const status = (id, key = dayKey()) => S.log[key]?.a?.[id];

function setStatus(id, st) {
  update(() => {
    const a = dayLog().a;
    if (st) a[id] = st; else delete a[id];
  });
}

// Qual atividade é "agora": a que está no horário, senão a próxima, senão a que ficou pendente.
function pickNow(list) {
  const m = nowMinutes();
  const pending = list.filter((a) => !status(a.id) && a.time);
  const current = pending.find((a) => toMin(a.time) <= m && m < toMin(a.time) + Math.max(a.dur, 15));
  if (current) return { act: current, kind: "agora" };
  const next = pending.find((a) => toMin(a.time) > m);
  const late = pending.filter((a) => toMin(a.time) <= m).pop();
  if (late && (!next || toMin(next.time) - m > 20)) return { act: late, kind: "pendente" };
  if (next) return { act: next, kind: "proxima" };
  return null;
}

function planHtml(a) {
  const parts = [];
  if (a.when && a.then) parts.push(`<div><span class="w">Quando eu</span> ${esc(a.when)}, <span class="w">eu vou</span> ${esc(a.then)}.</div>`);
  if (a.ifObs && a.thenObs) parts.push(`<div><span class="w">Se eu</span> ${esc(a.ifObs)}, <span class="w">então</span> ${esc(a.thenObs)}.</div>`);
  return parts.length ? `<div class="plan">${parts.join("")}</div>` : "";
}

/* ================= HOJE ================= */
export function renderHoje(root) {
  const today = dayKey();
  const d = new Date();
  const list = activitiesOn(today);
  const doneN = list.filter((a) => isDone(status(a.id))).length;
  const learn = dayLog().learn;
  const learnMin = Math.round((learn.video || 0) + (learn.es || 0));
  const now = pickNow(list);
  const focusAct = S.focus && S.activities.find((a) => a.id === S.focus.id);

  // "Nunca falhe duas vezes": algo de ontem ficou sem fazer e está planejado para hoje.
  const yesterday = addDays(today, -1);
  const missed = list.find((a) => a.created <= yesterday && a.days.includes(weekday(yesterday)) && !isDone(status(a.id, yesterday)) && !isDone(status(a.id)) && Object.keys(S.log).some((k) => k <= yesterday));

  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone = window.navigator.standalone || matchMedia("(display-mode: standalone)").matches;

  const groups = {};
  list.forEach((a) => (groups[periodOf(a.time)] ||= []).push(a));

  const sug = videoSuggestion();
  const due = dueCount();

  root.innerHTML = `
    <header class="head">
      <div>
        <span class="eyebrow">${WD_LONG[d.getDay()]} · ${d.getDate()} ${MONTHS[d.getMonth()]}</span>
        <h1>Hoje</h1>
      </div>
      <button class="icon-btn" id="settings" aria-label="Ajustes">${ICON.gear}</button>
    </header>

    ${isIOS && !standalone ? `<div class="banner"><b>Instale o Ritmo no iPhone</b><span class="small">No Safari, toque em Compartilhar e depois em <b>Adicionar à Tela de Início</b>. Assim ele abre em tela cheia e funciona sem internet.</span></div>` : ""}

    <div class="section">
      <div class="bar"><i style="width:${list.length ? (doneN / list.length) * 100 : 0}%"></i></div>
      <span class="small muted">${doneN} de ${list.length} feitos${learnMin ? ` · ${learnMin} min aprendendo hoje` : ""}</span>
    </div>

    ${focusAct ? nowCard(focusAct, "foco") : now ? nowCard(now.act, now.kind) : `
      <div class="now-card calm"><span class="eyebrow">Dia cumprido</span><h2>Nada pendente agora.</h2><p class="muted">Bom momento para um vídeo ou uma lição curta.</p></div>`}

    ${missed ? `<div class="note"><b>Ontem não rolou: ${esc(missed.title)}.</b><span>Um dia não desfaz nada. Hoje é o dia que conta${missed.min ? `: a versão mínima é “${esc(missed.min)}”` : ""}.</span></div>` : ""}

    ${S.exampleRoutine ? `<div class="banner"><b>Essa é uma rotina de exemplo</b><span class="small">Troque pelos seus horários reais na aba Hábitos. Toque numa atividade para ver o plano dela.</span><div class="row"><button class="btn pri" id="edit-routine">Editar minha rotina</button><button class="btn" id="dismiss-example">Entendi</button></div></div>` : ""}

    <section class="section">
      <div class="section-title"><h2>Em vez do Instagram</h2></div>
      <div class="quick">
        <button class="tile" id="q-es">
          <span class="k">${ICON.chat}</span><b>Espanhol</b><span>${due ? `${due} para revisar · ` : ""}lição de 5 min</span>
        </button>
        <button class="tile" id="q-video">
          <span class="k">${ICON.play}</span><b>Assistir</b><span>${sug ? esc(sug.title) : "Vídeos longos para aprender"}</span>
        </button>
        <button class="tile wide" id="q-fact" hidden>
          <span class="k">${ICON.spark}</span><b id="fact-title">Neste dia</b><span id="fact-text"></span>
        </button>
      </div>
    </section>

    <section class="section">
      <div class="section-title"><h2>Rotina</h2><button class="small" style="color:var(--accent);font-weight:700" id="go-habits">Editar</button></div>
      ${Object.keys(PERIODS).filter((p) => groups[p]).map((p) => `
        <span class="period">${PERIODS[p]}</span>
        <div class="tl">${groups[p].map((a) => blockHtml(a, (now?.kind === "agora" && now.act.id === a.id) || focusAct?.id === a.id)).join("")}</div>
      `).join("") || `<p class="muted">Nada planejado para hoje. Crie atividades na aba Hábitos.</p>`}
    </section>
  `;

  $("#settings", root).onclick = openSettings;
  $("#go-habits", root).onclick = () => go("habitos");
  $("#q-es", root).onclick = () => startLesson();
  $("#q-video", root).onclick = () => go("assistir");
  $("#edit-routine", root) && ($("#edit-routine", root).onclick = () => { update((s) => (s.exampleRoutine = false)); go("habitos"); });
  $("#dismiss-example", root) && ($("#dismiss-example", root).onclick = () => update((s) => (s.exampleRoutine = false)));

  const nowBtn = $("#now-start", root);
  if (nowBtn) nowBtn.onclick = () => {
    const a = S.activities.find((x) => x.id === nowBtn.dataset.id);
    if (a.link === "espanhol" && !S.focus) return startLesson(a.id);
    openFocus(a);
  };
  const nowMin = $("#now-min", root);
  if (nowMin) nowMin.onclick = () => { setStatus(nowMin.dataset.id, "min"); toast("Versão mínima conta. Feito!"); };

  $$(".blk", root).forEach((b) => {
    const a = S.activities.find((x) => x.id === b.dataset.id);
    $(".chk", b).onclick = (e) => {
      e.stopPropagation();
      const st = status(a.id);
      setStatus(a.id, isDone(st) ? null : "done");
      if (!isDone(st)) toast(`${a.title}: feito`);
    };
    $(".c", b).onclick = () => openActivity(a);
  });

  todayFact().then((f) => {
    const tile = $("#q-fact", root);
    if (!f || !tile) return;
    tile.hidden = false;
    $("#fact-title", root).textContent = `Neste dia, em ${f.year}`;
    $("#fact-text", root).textContent = f.text;
    tile.onclick = () => openFact(f);
  });
}

function nowCard(a, kind) {
  const label = { agora: "Agora", proxima: `Próxima · ${a.time}`, pendente: `Ficou para trás · ${a.time}`, foco: "Em foco" }[kind];
  let action = "Começar foco";
  if (kind === "foco") {
    const left = Math.max(0, Math.round((S.focus.endAt - Date.now()) / 60000));
    action = `Voltar ao foco · ${left} min`;
  } else if (a.link === "espanhol") action = "Abrir lição";
  else if (!a.dur) action = "Abrir";
  return `
    <div class="now-card">
      <div class="top"><span class="eyebrow">${label}</span>${kind === "agora" || kind === "foco" ? '<span class="pill">AGORA</span>' : ""}</div>
      <div><h2>${esc(a.title)}</h2>${a.dur ? `<span class="small muted">${fmtDur(a.dur)}</span>` : ""}</div>
      ${a.min ? `<div class="min"><span class="eyebrow">Travou? Versão mínima</span>${esc(a.min)}</div>` : ""}
      <div class="row">
        <button class="btn now" id="now-start" data-id="${a.id}">${action}</button>
        ${a.min && kind !== "foco" ? `<button class="btn" id="now-min" data-id="${a.id}" style="flex:0 0 auto">Fiz o mínimo</button>` : ""}
      </div>
    </div>`;
}

function blockHtml(a, isNow) {
  const st = status(a.id);
  const cls = ["blk", st === "done" ? "done" : "", st === "min" ? "done min-done" : "", st === "skip" ? "skip" : "", isNow && !st ? "now" : ""].join(" ");
  const sub = st === "min" ? "versão mínima" : st === "skip" ? "pulado" : [a.dur ? fmtDur(a.dur) : "", a.min ? `mín.: ${a.min}` : ""].filter(Boolean).join(" · ");
  return `
    <div class="${cls}" data-id="${a.id}">
      <span class="t">${a.time || "—"}</span>
      <button class="c">
        <span class="txt"><b>${esc(a.title)}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</span>
        ${isNow && !st ? '<span class="pill">AGORA</span>' : ""}
        <span class="chk" role="checkbox" aria-checked="${isDone(st)}" aria-label="Marcar ${esc(a.title)}">${ICON.check}</span>
      </button>
    </div>`;
}

function openActivity(a) {
  const st = status(a.id);
  const s = sheet(`
    <div class="sheet-head"><div><span class="eyebrow">${a.time || "Sem horário"}${a.dur ? ` · ${fmtDur(a.dur)}` : ""}</span><h2>${esc(a.title)}</h2></div><button class="icon-btn" data-close aria-label="Fechar">${ICON.close}</button></div>
    ${planHtml(a)}
    ${a.min ? `<div class="hint"><b>Versão mínima:</b> ${esc(a.min)}</div>` : ""}
    <div style="display:grid;gap:8px">
      ${a.link === "espanhol" ? `<button class="btn pri block" data-do="lesson">Abrir lição de espanhol</button>` : ""}
      ${a.link === "assistir" ? `<button class="btn pri block" data-do="watch">Abrir Assistir</button>` : ""}
      ${a.dur ? `<button class="btn ${a.link ? "" : "pri"} block" data-do="focus">Começar foco · ${fmtDur(a.dur)}</button>` : ""}
      <div class="row"><button class="btn" data-do="done">Feito</button>${a.min ? `<button class="btn" data-do="min">Fiz o mínimo</button>` : ""}</div>
      <div class="row"><button class="btn ghost" data-do="skip">Pular sem culpa</button>${st ? `<button class="btn ghost" data-do="clear">Desmarcar</button>` : ""}<button class="btn ghost" data-do="edit">Editar</button></div>
    </div>
  `);
  s.el.addEventListener("click", (e) => {
    const b = e.target.closest("[data-do]");
    if (!b) return;
    const act = b.dataset.do;
    s.close();
    if (act === "focus") openFocus(a);
    else if (act === "lesson") startLesson(a.id);
    else if (act === "watch") go("assistir");
    else if (act === "edit") openEditor(a);
    else if (act === "clear") setStatus(a.id, null);
    else {
      setStatus(a.id, act);
      toast(act === "skip" ? "Pulado. Amanhã você volta." : act === "min" ? "Versão mínima conta. Feito!" : `${a.title}: feito`);
    }
  });
}

/* ================= FOCO ================= */
let wakeLock = null;

export function openFocus(a) {
  if (!S.focus || S.focus.id !== a.id) {
    const total = Math.max(1, a.dur || 25) * 60000;
    update((s) => (s.focus = { id: a.id, endAt: Date.now() + total, total }));
  }
  const R = 120, C = 2 * Math.PI * R;
  const ov = overlay(`
    <div class="ov-top">
      <button class="icon-btn" data-x="leave" aria-label="Sair do foco">${ICON.back}</button>
      <span class="eyebrow">Modo foco</span>
      <span style="width:40px"></span>
    </div>
    <div class="ring">
      <svg viewBox="0 0 270 270"><circle cx="135" cy="135" r="${R}" fill="none" stroke="var(--line)" stroke-width="14"/><circle id="arc" cx="135" cy="135" r="${R}" fill="none" stroke="var(--now)" stroke-width="14" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="0"/></svg>
      <div><div class="time" id="time">--:--</div><div class="of" id="of"></div></div>
    </div>
    <div class="focus-title"><h1>${esc(a.title)}</h1></div>
    <p class="timeup" id="timeup" hidden>Tempo! Concluir ou mais 5 min?</p>
    ${a.min ? `<div class="hint"><span class="eyebrow" style="color:var(--accent)">Travou? Versão mínima</span><br>${esc(a.min)}</div>` : ""}
    ${planHtml(a)}
    <div class="focus-actions">
      <button class="btn pri block" data-x="done">Concluir</button>
      <div class="row"><button class="btn" data-x="plus">+5 min</button>${a.min ? `<button class="btn" data-x="min">Fiz o mínimo</button>` : ""}</div>
      <button class="btn ghost block" data-x="skip">Pular sem culpa</button>
    </div>
  `);

  let rang = false;
  const tick = () => {
    if (!S.focus) return;
    const left = S.focus.endAt - Date.now();
    const s = Math.max(0, Math.ceil(left / 1000));
    $("#time", ov.el).textContent = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
    $("#of", ov.el).textContent = `de ${fmtDur(Math.round(S.focus.total / 60000))}`;
    $("#arc", ov.el).setAttribute("stroke-dashoffset", String(C * (1 - Math.max(0, left) / S.focus.total)));
    if (left <= 0 && !rang) { rang = true; beep(); $("#timeup", ov.el).hidden = false; }
  };
  tick();
  const timer = setInterval(tick, 1000);
  navigator.wakeLock?.request("screen").then((l) => (wakeLock = l)).catch(() => {});

  const finish = (st) => {
    clearInterval(timer);
    wakeLock?.release?.().catch(() => {});
    wakeLock = null;
    if (st) {
      update((s) => {
        s.focus = null;
        if (st !== "leave") dayLog().a[a.id] = st;
      });
    }
    ov.close();
  };

  ov.el.addEventListener("click", (e) => {
    const b = e.target.closest("[data-x]");
    if (!b) return;
    const x = b.dataset.x;
    if (x === "plus") {
      rang = false;
      $("#timeup", ov.el).hidden = true;
      update((s) => {
        const base = Math.max(s.focus.endAt, Date.now());
        s.focus.total += base - s.focus.endAt + 5 * 60000;
        s.focus.endAt = base + 5 * 60000;
      });
      tick();
      return;
    }
    if (x === "leave") { clearInterval(timer); ov.close(); go(); return; }
    finish(x);
    const next = activitiesOn(dayKey()).find((n) => !status(n.id) && n.id !== a.id && n.time && toMin(n.time) >= toMin(a.time || "00:00"));
    toast(x === "skip" ? "Pulado. Sem culpa." : next ? `Feito. Próximo: ${next.title} às ${next.time}` : "Feito!");
  });
}

/* ================= HÁBITOS ================= */
export function renderHabitos(root) {
  const today = dayKey();
  const acts = [...S.activities].sort((x, y) => (x.time || "99").localeCompare(y.time || "99"));
  let planned = 0, done = 0;
  acts.forEach((a) => { const c = consistency(a); planned += c.planned; done += c.done; });
  const pct = planned ? Math.round((done / planned) * 100) : null;
  const last7 = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));

  root.innerHTML = `
    <header class="head">
      <div><span class="eyebrow">Últimas 4 semanas</span><h1>Hábitos</h1></div>
      <button class="icon-btn" id="new" aria-label="Nova atividade">${ICON.plus}</button>
    </header>

    <div class="card" style="display:grid;gap:8px">
      <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap">
        <span class="big">${pct === null ? "—" : pct + "%"}</span>
        <span class="muted">${pct === null ? "Marque o que fizer hoje para começar a medir." : "dos dias planejados cumpridos"}</span>
      </div>
      <p class="small muted">Sem sequência que zera. Um dia perdido não apaga nada; o que importa é não perder dois seguidos.</p>
    </div>

    <div class="legend">
      <span><i style="background:var(--good)"></i>feito</span>
      <span><i style="background:var(--accent)"></i>versão mínima</span>
      <span><i style="background:var(--line)"></i>não feito</span>
    </div>

    <div class="section">
      <div class="days-lbl">${last7.map((k) => `<span>${WD[weekday(k)]}</span>`).join("")}</div>
      ${acts.map((a) => {
        const c = consistency(a);
        return `
          <button class="hab" data-id="${a.id}">
            <div class="top"><b>${a.time ? `<span class="mono muted" style="font-weight:500">${a.time}</span> ` : ""}${esc(a.title)}</b><span class="pct">${c.pct === null ? "novo" : c.pct + "%"}</span></div>
            <div class="days">${last7.map((k) => {
              const st = S.log[k]?.a?.[a.id];
              const planned = a.days.includes(weekday(k)) && (!a.created || a.created <= k);
              let cls = "";
              if (st === "done") cls = "y";
              else if (st === "min") cls = "m";
              else if (planned && k < today) cls = "x";
              if (k === today && planned) cls += " today";
              return `<i class="${cls}"></i>`;
            }).join("")}</div>
          </button>`;
      }).join("")}
    </div>

    <button class="btn pri block" id="new2">Nova atividade</button>
  `;
  $("#new", root).onclick = () => openEditor();
  $("#new2", root).onclick = () => openEditor();
  $$(".hab", root).forEach((b) => (b.onclick = () => openEditor(S.activities.find((a) => a.id === b.dataset.id))));
}

/* ================= EDITOR ================= */
export function openEditor(a) {
  const isNew = !a;
  const v = a || { title: "", time: "", dur: 25, days: [1, 2, 3, 4, 5], min: "", when: "", then: "", ifObs: "", thenObs: "", link: "" };
  const days = new Set(v.days);
  const s = sheet(`
    <div class="sheet-head"><h2>${isNew ? "Nova atividade" : "Editar atividade"}</h2><button class="icon-btn" data-close aria-label="Fechar">${ICON.close}</button></div>
    <div class="field"><label for="f-title">Nome</label><input class="input" id="f-title" value="${esc(v.title)}" placeholder="Ex.: Estudar matemática"></div>
    <div class="grid2">
      <div class="field"><label for="f-time">Horário</label><input class="input" id="f-time" type="time" value="${esc(v.time)}"></div>
      <div class="field"><label for="f-dur">Duração (min)</label><input class="input" id="f-dur" type="number" inputmode="numeric" min="0" max="600" value="${v.dur}"></div>
    </div>
    <div class="field"><span class="lbl">Dias</span><div class="chips wrap" id="f-days">${WD.map((l, i) => `<button class="chip" data-d="${i}" aria-pressed="${days.has(i)}" aria-label="${WD_LONG[i]}">${l}</button>`).join("")}</div></div>
    <div class="field"><label for="f-min">Versão mínima (o que conta como feito num dia ruim)</label><input class="input" id="f-min" value="${esc(v.min)}" placeholder="Ex.: Fazer 1 exercício"></div>
    <div class="ifthen">
      <span class="eyebrow">Gatilho</span>
      <span class="w">Quando eu</span><input class="input" id="f-when" value="${esc(v.when)}" placeholder="terminar o café">
      <span class="w">eu vou</span><input class="input" id="f-then" value="${esc(v.then)}" placeholder="sentar na mesa e abrir o caderno">
    </div>
    <div class="ifthen">
      <span class="eyebrow">Obstáculo provável</span>
      <span class="w">Se eu</span><input class="input" id="f-ifobs" value="${esc(v.ifObs)}" placeholder="pegar o celular">
      <span class="w">então</span><input class="input" id="f-thenobs" value="${esc(v.thenObs)}" placeholder="deixo o celular em outra sala">
    </div>
    <div class="field"><label for="f-link">Atalho ao tocar</label>
      <select class="input" id="f-link">
        <option value="" ${!v.link ? "selected" : ""}>Modo foco com timer</option>
        <option value="espanhol" ${v.link === "espanhol" ? "selected" : ""}>Abrir lição de espanhol</option>
        <option value="assistir" ${v.link === "assistir" ? "selected" : ""}>Abrir vídeos</option>
      </select>
    </div>
    <button class="btn pri block" id="f-save">${isNew ? "Criar" : "Salvar"}</button>
    ${isNew ? "" : `<button class="btn ghost danger block" id="f-del">Apagar atividade</button>`}
  `);
  const el = s.el;
  $$("#f-days .chip", el).forEach((c) => (c.onclick = () => {
    const d = Number(c.dataset.d);
    days.has(d) ? days.delete(d) : days.add(d);
    c.setAttribute("aria-pressed", days.has(d));
  }));
  $("#f-save", el).onclick = () => {
    const title = $("#f-title", el).value.trim();
    if (!title) { $("#f-title", el).focus(); toast("Dê um nome para a atividade."); return; }
    if (!days.size) { toast("Escolha pelo menos um dia."); return; }
    const data = {
      title, time: $("#f-time", el).value, dur: Math.max(0, Number($("#f-dur", el).value) || 0),
      days: [...days].sort(), min: $("#f-min", el).value.trim(),
      when: $("#f-when", el).value.trim(), then: $("#f-then", el).value.trim(),
      ifObs: $("#f-ifobs", el).value.trim(), thenObs: $("#f-thenobs", el).value.trim(),
      link: $("#f-link", el).value,
    };
    update((st) => {
      st.exampleRoutine = false;
      if (isNew) st.activities.push({ id: uid(), created: dayKey(), ...data });
      else Object.assign(st.activities.find((x) => x.id === a.id), data);
    });
    s.close();
    toast(isNew ? "Atividade criada" : "Salvo");
  };
  const del = $("#f-del", el);
  if (del) del.onclick = () => {
    if (!del.dataset.armed) { del.dataset.armed = "1"; del.textContent = "Toque de novo para apagar"; return; }
    update((st) => {
      st.activities = st.activities.filter((x) => x.id !== a.id);
      if (st.focus?.id === a.id) st.focus = null;
    });
    s.close();
    toast("Atividade apagada");
  };
}
