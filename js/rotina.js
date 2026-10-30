// Telas "Hoje" e "Hábitos", modo foco e editor de atividades.
import { S, update, dayKey, addDays, weekday, dayLog, activitiesOn, consistency, isDone, periodOf, PERIODS, uid } from "./store.js";
import { esc, $, $$, ICON, sheet, overlay, toast, fmtDur, nowMinutes, toMin, beep } from "./ui.js";
import { go } from "./app.js";
import { suggestion as videoSuggestion, todayFact, openFact } from "./assistir.js";
import { tasksForToday, taskRow, bindTaskRows } from "./tarefas.js";
import { openSettings } from "./ajustes.js";

const WD = ["D", "S", "T", "Q", "Q", "S", "S"];
const WD_LONG = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

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
  if (a.when && a.then) parts.push(`<p><span class="w">Quando eu</span> ${esc(a.when)}, <span class="w">eu vou</span> ${esc(a.then)}.</p>`);
  if (a.ifObs && a.thenObs) parts.push(`<p><span class="w">Se eu</span> ${esc(a.ifObs)}, <span class="w">então</span> ${esc(a.thenObs)}.</p>`);
  return parts.length ? `<div class="plan">${parts.join("")}</div>` : "";
}

function openLink(a) {
  if (a.link === "tarefas") go("tarefas");
  else if (a.link === "assistir") go("assistir");
  else openFocus(a);
}

/* ================= HOJE ================= */
export function renderHoje(root) {
  const today = dayKey();
  const d = new Date();
  const list = activitiesOn(today);
  const tasks = tasksForToday();
  const doneN = list.filter((a) => isDone(status(a.id))).length;
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
  const pct = list.length ? Math.round((doneN / list.length) * 100) : 0;

  root.innerHTML = `
    <header class="head">
      <div><span class="eyebrow">${WD_LONG[d.getDay()].replace(/^./, (c) => c.toUpperCase())}, ${d.getDate()} de ${MONTHS[d.getMonth()]}</span><h1>Hoje</h1></div>
      <button class="icon-btn" id="settings" aria-label="Ajustes">${ICON.gear}</button>
    </header>

    ${isIOS && !standalone ? `<div class="notice"><b>Instale o Ritmo</b><span>No Safari, toque em Compartilhar e depois em Adicionar à Tela de Início.</span></div>` : ""}

    <div class="progress">
      <div class="bar"><i style="width:${pct}%"></i></div>
      <span>${doneN} de ${list.length} da rotina</span>
    </div>

    ${focusAct ? nowCard(focusAct, "foco") : now ? nowCard(now.act, now.kind) : `
      <div class="now calm"><span class="now-label">Tudo em dia</span><h2>Nada pendente na rotina agora.</h2></div>`}

    ${missed ? `<div class="notice"><b>Ontem não rolou: ${esc(missed.title)}.</b><span>Um dia não desfaz nada. Hoje é o que conta${missed.min ? `: a versão mínima é “${esc(missed.min)}”` : ""}.</span></div>` : ""}

    ${S.exampleRoutine ? `<div class="notice"><b>Rotina de exemplo</b><span>Troque pelos seus horários reais em Hábitos.</span><div class="row"><button class="btn pri" id="edit-routine">Editar rotina</button><button class="btn" id="dismiss-example">Entendi</button></div></div>` : ""}

    <section class="group">
      <div class="group-head"><h2 class="group-title">Tarefas de hoje</h2><button class="text-btn" id="go-tasks">${tasks.length ? "Ver todas" : "Adicionar"}</button></div>
      ${tasks.length ? `<div class="list">${tasks.map(taskRow).join("")}</div>` : `<p class="empty-line">Nenhuma tarefa para hoje.</p>`}
    </section>

    <section class="group">
      <div class="group-head"><h2 class="group-title">Rotina</h2><button class="text-btn" id="go-habits">Editar</button></div>
      ${Object.keys(PERIODS).filter((p) => groups[p]).map((p) => `
        <span class="list-label">${PERIODS[p]}</span>
        <div class="list">${groups[p].map((a) => blockHtml(a, (now?.kind === "agora" && now.act.id === a.id) || focusAct?.id === a.id)).join("")}</div>
      `).join("") || `<p class="empty-line">Nada planejado para hoje.</p>`}
    </section>

    <section class="group">
      <h2 class="group-title">Em vez do Instagram</h2>
      <div class="list">
        <button class="row-item link" id="q-video"><span class="row-icon">${ICON.play}</span><span class="row-body"><span class="row-title">Assistir algo longo</span><span class="row-sub">${sug ? esc(sug.title) : "Vídeos para aprender"}</span></span><span class="chev">›</span></button>
        <button class="row-item link" id="q-fact" hidden><span class="row-icon">${ICON.spark}</span><span class="row-body"><span class="row-title" id="fact-title">Neste dia</span><span class="row-sub" id="fact-text"></span></span><span class="chev">›</span></button>
      </div>
    </section>
  `;

  $("#settings", root).onclick = openSettings;
  $("#go-habits", root).onclick = () => go("habitos");
  $("#go-tasks", root).onclick = () => go("tarefas");
  $("#q-video", root).onclick = () => go("assistir");
  $("#edit-routine", root) && ($("#edit-routine", root).onclick = () => { update((s) => (s.exampleRoutine = false)); go("habitos"); });
  $("#dismiss-example", root) && ($("#dismiss-example", root).onclick = () => update((s) => (s.exampleRoutine = false)));

  const nowBtn = $("#now-start", root);
  if (nowBtn) nowBtn.onclick = () => openLink(S.activities.find((x) => x.id === nowBtn.dataset.id));
  const nowMin = $("#now-min", root);
  if (nowMin) nowMin.onclick = () => { setStatus(nowMin.dataset.id, "min"); toast("Versão mínima conta. Feito!"); };

  $$("[data-act]", root).forEach((row) => {
    const a = S.activities.find((x) => x.id === row.dataset.act);
    $(".chk", row).onclick = () => {
      const st = status(a.id);
      setStatus(a.id, isDone(st) ? null : "done");
      if (!isDone(st)) toast(`${a.title}: feito`);
    };
    $(".row-body", row).onclick = () => openActivity(a);
  });
  bindTaskRows(root);

  todayFact().then((f) => {
    const row = $("#q-fact", root);
    if (!f || !row) return;
    row.hidden = false;
    $("#fact-title", root).textContent = `Neste dia, em ${f.year}`;
    $("#fact-text", root).textContent = f.text;
    row.onclick = () => openFact(f);
  });
}

function nowCard(a, kind) {
  const label = { agora: "Agora", proxima: `A seguir · ${a.time}`, pendente: `Ficou para trás · ${a.time}`, foco: "Em foco" }[kind];
  let action = a.link === "tarefas" ? "Abrir tarefas" : a.link === "assistir" ? "Abrir vídeos" : "Começar foco";
  if (kind === "foco") action = `Voltar ao foco · ${Math.max(0, Math.round((S.focus.endAt - Date.now()) / 60000))} min`;
  return `
    <div class="now ${kind === "agora" || kind === "foco" ? "live" : ""}">
      <span class="now-label">${label}</span>
      <h2>${esc(a.title)}</h2>
      ${a.dur || a.min ? `<p class="now-meta">${[a.dur ? fmtDur(a.dur) : "", a.min ? `Mínimo: ${esc(a.min)}` : ""].filter(Boolean).join(" · ")}</p>` : ""}
      <div class="row">
        <button class="btn pri" id="now-start" data-id="${a.id}">${action}</button>
        ${a.min && kind !== "foco" ? `<button class="btn" id="now-min" data-id="${a.id}">Fiz o mínimo</button>` : ""}
      </div>
    </div>`;
}

function blockHtml(a, isNow) {
  const st = status(a.id);
  const sub = st === "min" ? "versão mínima" : st === "skip" ? "pulado" : [a.dur ? fmtDur(a.dur) : "", a.min ? `mín.: ${a.min}` : ""].filter(Boolean).join(" · ");
  return `
    <div class="row-item ${isDone(st) ? "is-done" : ""} ${st === "min" ? "is-min" : ""} ${st === "skip" ? "is-skip" : ""} ${isNow && !st ? "is-now" : ""}" data-act="${a.id}">
      <button class="chk" role="checkbox" aria-checked="${isDone(st)}" aria-label="Marcar ${esc(a.title)}">${ICON.check}</button>
      <button class="row-body">
        <span class="row-title">${esc(a.title)}${isNow && !st ? ' <span class="live-dot" aria-label="agora"></span>' : ""}</span>
        ${sub ? `<span class="row-sub">${esc(sub)}</span>` : ""}
      </button>
      <span class="row-time">${a.time || ""}</span>
    </div>`;
}

function openActivity(a) {
  const st = status(a.id);
  const s = sheet(`
    <div class="sheet-head"><span></span><h3>${esc(a.title)}</h3><button class="text-btn strong" data-close>OK</button></div>
    <p class="muted center">${a.time || "Sem horário"}${a.dur ? ` · ${fmtDur(a.dur)}` : ""}</p>
    ${planHtml(a)}
    ${a.min ? `<div class="notice"><b>Versão mínima</b><span>${esc(a.min)}</span></div>` : ""}
    <div class="stack">
      ${a.link === "tarefas" ? `<button class="btn pri block" data-do="tasks">Abrir tarefas</button>` : ""}
      ${a.link === "assistir" ? `<button class="btn pri block" data-do="watch">Abrir vídeos</button>` : ""}
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
    else if (act === "tasks") go("tarefas");
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
  const R = 124, C = 2 * Math.PI * R;
  const ov = overlay(`
    <div class="ov-top">
      <button class="text-btn" data-x="leave">Voltar</button>
      <span class="ov-title">Foco</span>
      <span style="width:52px"></span>
    </div>
    <div class="ring">
      <svg viewBox="0 0 270 270"><circle cx="135" cy="135" r="${R}" fill="none" stroke="var(--fill)" stroke-width="8"/><circle id="arc" cx="135" cy="135" r="${R}" fill="none" stroke="var(--accent)" stroke-width="8" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="0"/></svg>
      <div><div class="time" id="time">--:--</div><div class="of" id="of"></div></div>
    </div>
    <h1 class="center">${esc(a.title)}</h1>
    <p class="timeup" id="timeup" hidden>Tempo! Concluir ou mais 5 minutos?</p>
    ${a.min ? `<div class="notice"><b>Travou? Versão mínima</b><span>${esc(a.min)}</span></div>` : ""}
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
    clearInterval(timer);
    wakeLock?.release?.().catch(() => {});
    wakeLock = null;
    if (x === "leave") { ov.close(); go(); return; }
    update((s) => { s.focus = null; dayLog().a[a.id] = x; });
    ov.close();
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

    <div class="score">
      <span class="big${pct === null ? " muted" : ""}">${pct === null ? "0%" : pct + "%"}</span>
      <span class="muted">${pct === null ? "Marque o que fizer hoje para começar a medir." : "dos dias planejados cumpridos"}</span>
      <p class="small muted">Sem sequência que zera. O que importa é não perder dois dias seguidos.</p>
    </div>

    <section class="group">
      <div class="group-head"><h2 class="group-title">Atividades</h2>
        <div class="legend"><span><i class="y"></i>feito</span><span><i class="m"></i>mínimo</span><span><i class="x"></i>não feito</span></div>
      </div>
      <div class="list">
        <div class="days-head"><span></span><div class="days-lbl">${last7.map((k) => `<span>${WD[weekday(k)]}</span>`).join("")}</div></div>
        ${acts.map((a) => {
          const c = consistency(a);
          return `
            <button class="hab" data-id="${a.id}">
              <span class="hab-name"><span class="row-title">${esc(a.title)}</span><span class="row-sub">${a.time || "sem horário"} · ${c.pct === null ? "novo" : c.pct + "%"}</span></span>
              <span class="days">${last7.map((k) => {
                const st = S.log[k]?.a?.[a.id];
                const planned = a.days.includes(weekday(k)) && (!a.created || a.created <= k);
                let cls = planned ? "p" : "";
                if (st === "done") cls = "y";
                else if (st === "min") cls = "m";
                else if (planned && k < today) cls = "x";
                if (k === today && planned) cls += " today";
                return `<i class="${cls}"></i>`;
              }).join("")}</span>
            </button>`;
        }).join("")}
      </div>
    </section>

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
    <div class="sheet-head"><button class="text-btn" data-close>Cancelar</button><h3>${isNew ? "Nova atividade" : "Editar"}</h3><button class="text-btn strong" id="f-save">${isNew ? "Criar" : "Salvar"}</button></div>
    <div class="form-group">
      <input class="input bare" id="f-title" value="${esc(v.title)}" placeholder="Nome (ex.: Estudar matemática)">
    </div>
    <div class="form-group">
      <label class="form-row"><span>Horário</span><input class="input inline" id="f-time" type="time" value="${esc(v.time)}"></label>
      <label class="form-row"><span>Duração (min)</span><input class="input inline" id="f-dur" type="number" inputmode="numeric" min="0" max="600" value="${v.dur}"></label>
    </div>
    <div class="field"><span class="lbl">Dias</span><div class="days-pick" id="f-days">${WD.map((l, i) => `<button class="day" data-d="${i}" aria-pressed="${days.has(i)}" aria-label="${WD_LONG[i]}">${l}</button>`).join("")}</div></div>
    <div class="field"><span class="lbl">Versão mínima (o que conta como feito num dia ruim)</span><div class="form-group"><input class="input bare" id="f-min" value="${esc(v.min)}" placeholder="Ex.: Fazer 1 exercício"></div></div>
    <div class="field"><span class="lbl">Plano</span>
      <div class="form-group plan-form">
        <label class="form-row"><span class="w">Quando eu</span><input class="input inline wide" id="f-when" value="${esc(v.when)}" placeholder="terminar o café"></label>
        <label class="form-row"><span class="w">eu vou</span><input class="input inline wide" id="f-then" value="${esc(v.then)}" placeholder="abrir o caderno"></label>
        <label class="form-row"><span class="w">Se eu</span><input class="input inline wide" id="f-ifobs" value="${esc(v.ifObs)}" placeholder="pegar o celular"></label>
        <label class="form-row"><span class="w">então</span><input class="input inline wide" id="f-thenobs" value="${esc(v.thenObs)}" placeholder="deixo em outra sala"></label>
      </div>
    </div>
    <div class="form-group">
      <label class="form-row"><span>Ao tocar</span>
        <select class="input inline" id="f-link">
          <option value="" ${!v.link ? "selected" : ""}>Modo foco</option>
          <option value="tarefas" ${v.link === "tarefas" ? "selected" : ""}>Abrir tarefas</option>
          <option value="assistir" ${v.link === "assistir" ? "selected" : ""}>Abrir vídeos</option>
        </select>
      </label>
    </div>
    ${isNew ? "" : `<button class="btn ghost danger block" id="f-del">Apagar atividade</button>`}
  `);
  const el = s.el;
  $$("#f-days .day", el).forEach((c) => (c.onclick = () => {
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
