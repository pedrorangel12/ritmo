// Aba "Tarefas": pendências com data, horário opcional e lembrete no Calendário.
import { S, update, dayKey, addDays, weekday, uid } from "./store.js";
import { esc, $, $$, ICON, sheet, toast } from "./ui.js";
import { attachMic, micButtonHtml } from "./voz.js";
import { taskIcsHref } from "./ajustes.js";

const WD_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const WD_WORDS = { domingo: 0, segunda: 1, terça: 2, terca: 2, quarta: 3, quinta: 4, sexta: 5, sábado: 6, sabado: 6 };

let quickWhen = "hoje";
let showDone = false;

export function dateLabel(key) {
  const today = dayKey();
  if (!key) return "Sem data";
  if (key === today) return "Hoje";
  if (key === addDays(today, 1)) return "Amanhã";
  if (key === addDays(today, -1)) return "Ontem";
  const [, m, d] = key.split("-").map(Number);
  return `${WD_SHORT[weekday(key)]}, ${d} ${MONTHS[m - 1]}`;
}

// Entende frases como "pagar a conta amanhã às 15h" ou "dentista sexta 9:30".
export function parseQuick(text) {
  const today = dayKey();
  let t = ` ${text.trim()} `;
  let date = null, time = "";
  const take = (re, fn) => { const m = t.match(re); if (m) { fn(m); t = t.replace(m[0], " "); } };
  take(/\s(depois de amanh[ãa])\s/i, () => (date = addDays(today, 2)));
  take(/\s(amanh[ãa])\s/i, () => (date = addDays(today, 1)));
  take(/\s(hoje)\s/i, () => (date = today));
  take(/\s(?:na |no |nesta |neste |próxima |proxima )?(domingo|segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado)(?:-feira)?\s/i, (m) => {
    const target = WD_WORDS[m[1].toLowerCase()];
    let k = addDays(today, 1);
    while (weekday(k) !== target) k = addDays(k, 1);
    date = k;
  });
  take(/\s(?:[àa]s?\s)?(\d{1,2})[:h](\d{2})\s/i, (m) => (time = `${m[1].padStart(2, "0")}:${m[2]}`));
  if (!time) take(/\s(?:[àa]s?\s)?(\d{1,2})\s?(?:h|horas?)\s/i, (m) => (time = `${m[1].padStart(2, "0")}:00`));
  if (time && Number(time.slice(0, 2)) > 23) time = "";
  const title = t.replace(/\s+/g, " ").trim();
  return { title: title.charAt(0).toUpperCase() + title.slice(1), date, time };
}

const openTasks = () => S.tasks.filter((t) => !t.done);

// Para a tela Hoje: atrasadas + de hoje, por horário.
export function tasksForToday() {
  const today = dayKey();
  return openTasks()
    .filter((t) => t.date && t.date <= today)
    .sort((a, b) => (a.date + (a.time || "99")).localeCompare(b.date + (b.time || "99")));
}

export function toggleTask(id) {
  let nowDone = false;
  update((s) => {
    const t = s.tasks.find((x) => x.id === id);
    t.done = t.done ? null : Date.now();
    nowDone = !!t.done;
  });
  if (nowDone) toast("Tarefa feita");
}

export function taskRow(t) {
  const today = dayKey();
  const late = !t.done && t.date && t.date < today;
  const sub = [late ? dateLabel(t.date) : "", t.time, t.note].filter(Boolean).join(" · ");
  return `
    <div class="row-item task ${t.done ? "is-done" : ""} ${late ? "is-late" : ""}" data-task="${t.id}">
      <button class="chk" data-check="${t.id}" role="checkbox" aria-checked="${!!t.done}" aria-label="Marcar ${esc(t.title)}">${ICON.check}</button>
      <button class="row-body" data-open="${t.id}">
        <span class="row-title">${esc(t.title)}</span>
        ${sub ? `<span class="row-sub">${esc(sub)}</span>` : ""}
      </button>
    </div>`;
}

export function bindTaskRows(root) {
  $$("[data-check]", root).forEach((b) => (b.onclick = () => toggleTask(b.dataset.check)));
  $$("[data-open]", root).forEach((b) => (b.onclick = () => openTask(S.tasks.find((t) => t.id === b.dataset.open))));
}

/* ---------- Tela ---------- */
export function renderTarefas(root) {
  const today = dayKey(), tomorrow = addDays(today, 1);
  const open = openTasks().sort((a, b) => ((a.date || "9999") + (a.time || "99")).localeCompare((b.date || "9999") + (b.time || "99")));
  const groups = [
    ["Atrasadas", open.filter((t) => t.date && t.date < today)],
    ["Hoje", open.filter((t) => t.date === today)],
    ["Amanhã", open.filter((t) => t.date === tomorrow)],
    ["Próximos dias", open.filter((t) => t.date > tomorrow)],
    ["Sem data", open.filter((t) => !t.date)],
  ];
  const done = S.tasks.filter((t) => t.done && Date.now() - t.done < 14 * 864e5).sort((a, b) => b.done - a.done);

  root.innerHTML = `
    <header class="head">
      <div><span class="eyebrow">${open.length ? `${open.length} pendente${open.length > 1 ? "s" : ""}` : "Nada pendente"}</span><h1>Tarefas</h1></div>
    </header>

    <form class="quick-add" id="qa" autocomplete="off">
      <input class="input" id="qa-text" placeholder="Nova tarefa" enterkeyhint="done">
      ${micButtonHtml()}
      <button class="add-btn" type="submit" aria-label="Adicionar">${ICON.plus}</button>
    </form>
    <div class="seg" role="group" aria-label="Quando">
      ${[["hoje", "Hoje"], ["amanha", "Amanhã"], ["sem", "Sem data"]].map(([k, l]) => `<button class="seg-btn" data-when="${k}" aria-pressed="${quickWhen === k}">${l}</button>`).join("")}
    </div>
    <p class="hint-line">Dica: escreva ou dite “pagar a conta amanhã às 15h”. O Ritmo entende a data e o horário.</p>

    ${open.length ? groups.filter(([, l]) => l.length).map(([name, list]) => `
      <section class="group">
        <h2 class="group-title ${name === "Atrasadas" ? "late" : ""}">${name}</h2>
        <div class="list">${name === "Próximos dias" ? list.map((t) => `<div class="list-date">${dateLabel(t.date)}</div>${taskRow(t)}`).join("") : list.map(taskRow).join("")}</div>
      </section>`).join("") : `
      <div class="empty"><b>Tudo em dia.</b><span>Adicione a próxima coisa que você precisa fazer.</span></div>`}

    ${done.length ? `
      <button class="link-btn" id="toggle-done">${showDone ? "Esconder feitas" : `Mostrar feitas (${done.length})`}</button>
      ${showDone ? `<div class="list">${done.map(taskRow).join("")}</div>` : ""}` : ""}
  `;

  const input = $("#qa-text", root);
  const add = () => {
    const raw = input.value.trim();
    if (!raw) return;
    const p = parseQuick(raw);
    if (!p.title) return;
    const date = p.date ?? (quickWhen === "hoje" ? today : quickWhen === "amanha" ? tomorrow : "");
    update((s) => s.tasks.push({ id: uid(), title: p.title, date, time: p.time, note: "", done: null, created: Date.now() }));
    toast(`Adicionada${date ? ` para ${dateLabel(date).toLowerCase()}` : ""}${p.time ? ` às ${p.time}` : ""}`);
    $("#qa-text").focus();
  };
  $("#qa", root).onsubmit = (e) => { e.preventDefault(); add(); };
  attachMic($(".mic", root), input, { onFinal: add });
  $$("[data-when]", root).forEach((b) => (b.onclick = () => {
    quickWhen = b.dataset.when;
    $$("[data-when]", root).forEach((x) => x.setAttribute("aria-pressed", x === b));
  }));
  const tg = $("#toggle-done", root);
  if (tg) tg.onclick = () => { showDone = !showDone; renderTarefas(root); };
  bindTaskRows(root);
}

/* ---------- Editar tarefa ---------- */
export function openTask(t) {
  const isNew = !t;
  const v = t || { title: "", date: dayKey(), time: "", note: "" };
  const s = sheet(`
    <div class="sheet-head"><button class="text-btn" data-close>Cancelar</button><h3>${isNew ? "Nova tarefa" : "Tarefa"}</h3><button class="text-btn strong" id="t-save">Salvar</button></div>
    <div class="form-group">
      <input class="input bare" id="t-title" value="${esc(v.title)}" placeholder="Título">
      <textarea class="input bare" id="t-note" rows="2" placeholder="Observação">${esc(v.note)}</textarea>
    </div>
    <div class="form-group">
      <label class="form-row"><span>Data</span><input class="input inline" id="t-date" type="date" value="${esc(v.date)}"></label>
      <label class="form-row"><span>Horário</span><input class="input inline" id="t-time" type="time" value="${esc(v.time)}"></label>
    </div>
    <div class="chips wrap">
      <button class="chip" data-d="0">Hoje</button><button class="chip" data-d="1">Amanhã</button><button class="chip" data-d="7">Em 1 semana</button><button class="chip" data-d="">Sem data</button>
    </div>
    ${isNew ? "" : `
      <a class="btn block" id="t-remind" href="#">Lembrete no Calendário</a>
      <p class="small muted" style="text-align:center">O iPhone abre o evento com aviso. Toque em Adicionar.</p>
      <button class="btn ghost danger block" id="t-del">Apagar tarefa</button>`}
  `);
  const el = s.el;
  $$("[data-d]", el).forEach((c) => (c.onclick = () => { $("#t-date", el).value = c.dataset.d === "" ? "" : addDays(dayKey(), Number(c.dataset.d)); }));
  const read = () => ({ title: $("#t-title", el).value.trim(), note: $("#t-note", el).value.trim(), date: $("#t-date", el).value, time: $("#t-time", el).value });
  $("#t-save", el).onclick = () => {
    const d = read();
    if (!d.title) { $("#t-title", el).focus(); toast("Dê um nome para a tarefa."); return; }
    update((st) => {
      if (isNew) st.tasks.push({ id: uid(), done: null, created: Date.now(), ...d });
      else Object.assign(st.tasks.find((x) => x.id === t.id), d);
    });
    s.close();
    toast("Salvo");
  };
  const remind = $("#t-remind", el);
  if (remind) remind.onclick = (e) => {
    const d = read();
    if (!d.date) { e.preventDefault(); toast("Escolha uma data para o lembrete."); return; }
    remind.href = taskIcsHref({ ...t, ...d });
    remind.setAttribute("download", "tarefa.ics");
  };
  const del = $("#t-del", el);
  if (del) del.onclick = () => {
    if (!del.dataset.armed) { del.dataset.armed = "1"; del.textContent = "Toque de novo para apagar"; return; }
    update((st) => { st.tasks = st.tasks.filter((x) => x.id !== t.id); });
    s.close();
    toast("Tarefa apagada");
  };
  if (isNew) $("#t-title", el).focus();
}
