// Estado do app, salvo só neste aparelho (localStorage).
const KEY = "ritmo.v1";

export const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const addDays = (key, n) => {
  const [y, m, d] = key.split("-").map(Number);
  return dayKey(new Date(y, m - 1, d + n));
};

export const weekday = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
};

export const uid = () => Math.random().toString(36).slice(2, 9);

export const periodOf = (time) => {
  if (!time) return "livre";
  const h = Number(time.slice(0, 2));
  return h < 12 ? "manha" : h < 18 ? "tarde" : "noite";
};

export const PERIODS = { manha: "Manhã", tarde: "Tarde", noite: "Noite", livre: "Sem horário" };

const ALL = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS = [1, 2, 3, 4, 5];

function seedActivities(today) {
  const a = (title, time, dur, extra = {}) => ({ id: uid(), title, time, dur, days: ALL, min: "", when: "", then: "", ifObs: "", thenObs: "", link: "", created: today, ...extra });
  return [
    a("Acordar e beber água", "07:00", 5, { min: "Só o copo d'água" }),
    a("Alongar", "07:10", 10, { min: "Três alongamentos de 30 s", when: "beber a água", then: "alongar no tapete do quarto" }),
    a("Café da manhã", "07:30", 20),
    a("Estudar", "08:00", 50, {
      days: WEEKDAYS, min: "Abrir o material e fazer 1 exercício",
      when: "terminar o café", then: "sentar na mesa e abrir o caderno",
      ifObs: "pegar o celular", thenObs: "deixo o celular em outra sala",
    }),
    a("Pausa sem celular", "08:50", 10, { days: WEEKDAYS, min: "Olhar pela janela 2 min" }),
    a("Treino", "18:00", 45, { days: [1, 3, 5], min: "10 minutos de caminhada", when: "chegar em casa", then: "trocar de roupa na hora" }),
    a("Espanhol", "21:00", 10, { min: "Uma lição de 5 min", link: "espanhol", when: "jantar", then: "abrir o Ritmo em vez do Instagram" }),
    a("Ler sem tela", "22:15", 20, { min: "Ler 2 páginas", ifObs: "quiser rolar o feed", thenObs: "abro a aba Assistir ou o livro" }),
    a("Dormir", "23:00", 0, { min: "Celular fora da cama" }),
  ];
}

function fresh() {
  const today = dayKey();
  return {
    v: 1,
    exampleRoutine: true,
    activities: seedActivities(today),
    log: {},           // { "AAAA-MM-DD": { a: { id: "done"|"min"|"skip" }, learn: { video: min, es: min } } }
    focus: null,       // { id, endAt, total }
    watch: { seen: {}, saved: {}, notes: {}, custom: [] },
    es: { cards: {}, newPerDay: 8, xp: 0 },
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...fresh(), ...JSON.parse(raw) };
  } catch (e) { /* armazenamento indisponível: começa do zero */ }
  return fresh();
}

export const S = load();
const listeners = new Set();

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* sem espaço ou bloqueado */ }
}

export function update(fn) {
  fn(S);
  save();
  listeners.forEach((l) => l());
}

export const subscribe = (fn) => listeners.add(fn);

export function dayLog(key = dayKey()) {
  if (!S.log[key]) S.log[key] = { a: {}, learn: {} };
  if (!S.log[key].learn) S.log[key].learn = {};
  return S.log[key];
}

export function addLearn(kind, minutes) {
  if (!(minutes > 0)) return;
  update(() => {
    const l = dayLog().learn;
    l[kind] = Math.round(((l[kind] || 0) + minutes) * 10) / 10;
  });
}

export function exportData() { return JSON.stringify(S); }

export function importData(text) {
  const data = JSON.parse(text);
  if (!data || !Array.isArray(data.activities)) throw new Error("formato");
  update((s) => {
    Object.keys(s).forEach((k) => delete s[k]);
    Object.assign(s, fresh(), data);
  });
}

export function resetAll() {
  update((s) => {
    Object.keys(s).forEach((k) => delete s[k]);
    Object.assign(s, fresh());
  });
}

// Atividades marcadas para um dia, em ordem de horário.
export function activitiesOn(key) {
  const wd = weekday(key);
  return S.activities
    .filter((a) => a.days.includes(wd) && (!a.created || a.created <= key))
    .sort((x, y) => (x.time || "99").localeCompare(y.time || "99"));
}

export const isDone = (st) => st === "done" || st === "min";

// Consistência: dias cumpridos / dias planejados nas últimas N jornadas (hoje só conta se já cumprido).
export function consistency(act, days = 28) {
  const today = dayKey();
  let planned = 0, done = 0;
  for (let i = 0; i < days; i++) {
    const k = addDays(today, -i);
    if (act.created && k < act.created) break;
    if (!act.days.includes(weekday(k))) continue;
    const st = S.log[k]?.a?.[act.id];
    if (i === 0 && !isDone(st)) continue;
    planned++;
    if (isDone(st)) done++;
  }
  return { planned, done, pct: planned ? Math.round((done / planned) * 100) : null };
}
