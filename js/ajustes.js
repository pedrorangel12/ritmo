// Ajustes: travar Instagram/TikTok, lembretes no Calendário, backup.
import { S, update, exportData, importData, resetAll, dayKey, addDays, weekday } from "./store.js";
import { esc, $, $$, ICON, sheet, toast } from "./ui.js";

const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

export function openSettings() {
  const s = sheet(`
    <div class="sheet-head"><h2>Ajustes</h2><button class="icon-btn" data-close aria-label="Fechar">${ICON.close}</button></div>

    <button class="tile wide" data-open="block" style="grid-template-columns:auto 1fr;align-items:center;column-gap:12px">
      <span class="k">${ICON.spark}</span><span style="display:grid;gap:2px"><b>Travar Instagram e TikTok</b><span>Desvio para o Ritmo e limite diário, passo a passo</span></span>
    </button>
    <button class="tile wide" data-open="cal" style="grid-template-columns:auto 1fr;align-items:center;column-gap:12px">
      <span class="k">${ICON.book}</span><span style="display:grid;gap:2px"><b>Lembretes no horário</b><span>Manda rotina e tarefas para o Calendário do iPhone, com aviso</span></span>
    </button>

    <div class="card" style="display:grid;gap:10px">
      <b>Backup</b>
      <p class="small muted">Seus dados ficam só neste iPhone. Copie o backup de vez em quando e guarde nas Notas.</p>
      <div class="row"><button class="btn" id="b-copy">Copiar backup</button><button class="btn" id="b-restore">Restaurar</button></div>
      <div id="b-area" hidden style="display:grid;gap:8px">
        <textarea class="input" id="b-text" placeholder="Cole aqui o backup"></textarea>
        <button class="btn pri" id="b-apply">Restaurar este backup</button>
      </div>
    </div>

    <button class="btn ghost danger block" id="reset">Apagar tudo e recomeçar</button>
  `);
  const el = s.el;

  $("[data-open=block]", el).onclick = () => { s.close(); openBlockGuide(); };
  $("[data-open=cal]", el).onclick = () => { s.close(); openCalendar(); };

  $("#b-copy", el).onclick = async () => {
    const data = exportData();
    try {
      await navigator.clipboard.writeText(data);
      toast("Backup copiado. Cole nas Notas.");
    } catch (e) {
      $("#b-area", el).hidden = false;
      $("#b-text", el).value = data;
      $("#b-text", el).select();
      toast("Selecione e copie o texto");
    }
  };
  $("#b-restore", el).onclick = () => { $("#b-area", el).hidden = false; $("#b-text", el).value = ""; $("#b-text", el).focus(); };
  $("#b-apply", el).onclick = () => {
    try {
      importData($("#b-text", el).value);
      s.close();
      toast("Backup restaurado");
    } catch (e) {
      toast("Esse texto não é um backup do Ritmo.");
    }
  };
  const reset = $("#reset", el);
  reset.onclick = () => {
    if (!reset.dataset.armed) { reset.dataset.armed = "1"; reset.textContent = "Toque de novo para apagar tudo"; return; }
    resetAll();
    s.close();
    toast("Tudo apagado");
  };
}

function openBlockGuide() {
  sheet(`
    <div class="sheet-head"><div><span class="eyebrow">Duas camadas</span><h2>Travar Instagram e TikTok</h2></div><button class="icon-btn" data-close aria-label="Fechar">${ICON.close}</button></div>
    <p class="muted">Um app instalado pelo Safari não consegue bloquear outros apps. Mas o próprio iPhone consegue, com o app Atalhos e o Tempo de Uso. Leva uns 5 minutos.</p>

    <div class="card" style="display:grid;gap:10px">
      <span class="eyebrow">Camada 1 · Desvio</span>
      <b>Ao abrir o Instagram, o iPhone pergunta se você quer ir para o Ritmo</b>
      <ol class="steps">
        <li>Abra o app <b>Atalhos</b> e toque em <b>Automação</b>, embaixo.</li>
        <li>Toque em <b>+</b> (ou <b>Nova Automação</b>) e escolha <b>App</b>.</li>
        <li>Em App, toque em <b>Escolher</b>, marque <b>Instagram</b> e <b>TikTok</b> e deixe <b>É Aberto</b> selecionado.</li>
        <li>Marque <b>Executar Imediatamente</b> e toque em <b>Seguinte</b>.</li>
        <li>Toque em <b>Nova Automação em Branco</b> e adicione a ação <b>Escolher do Menu</b>.</li>
        <li>No texto da pergunta, escreva: <code>Você ia rolar o feed. Vamos de Ritmo?</code></li>
        <li>Deixe duas opções: <code>Ir para o Ritmo</code> e <code>Usar mesmo assim</code>.</li>
        <li>Embaixo de <b>Ir para o Ritmo</b>, adicione a ação <b>Ir para a Tela de Início</b>. Deixe a outra opção vazia.</li>
        <li>Coloque o ícone do Ritmo no <b>Dock</b>, onde o Instagram ficava. Segure o Instagram e toque em <b>Remover da Tela de Início</b> (ele continua na Biblioteca de Apps).</li>
      </ol>
    </div>

    <div class="card" style="display:grid;gap:10px">
      <span class="eyebrow">Camada 2 · Limite diário</span>
      <b>Depois de X minutos por dia, o iPhone bloqueia</b>
      <ol class="steps">
        <li>Vá em <b>Ajustes → Tempo de Uso → Limites de Apps</b> e toque em <b>Adicionar Limite</b>.</li>
        <li>Marque <b>Instagram</b> e <b>TikTok</b> (ficam em Redes Sociais) e escolha um tempo, por exemplo <b>20 min</b>.</li>
        <li>Ative <b>Bloquear ao Fim do Limite</b>.</li>
        <li>Em Tempo de Uso, ative <b>Bloquear Ajustes do Tempo de Uso</b> com um código. Melhor: peça para outra pessoa criar o código, assim você não destrava no impulso.</li>
        <li>Opcional: em <b>Tempo Inativo</b>, bloqueie tudo menos o essencial das 23h às 7h.</li>
      </ol>
    </div>
    <button class="btn pri block" data-close>Pronto</button>
  `);
}

function icsEscape(s) { return String(s).replace(/[\\;,]/g, (c) => "\\" + c).replace(/\n/g, "\\n"); }

function buildIcs() {
  const today = dayKey();
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Ritmo//PT-BR", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Ritmo"];
  S.activities.filter((a) => a.time && a.days.length).forEach((a) => {
    // Primeiro dia (a partir de hoje) em que a atividade acontece.
    let k = today;
    for (let i = 0; i < 7 && !a.days.includes(weekday(k)); i++) k = addDays(k, 1);
    const desc = [a.min && `Versão mínima: ${a.min}`, a.when && a.then && `Quando eu ${a.when}, eu vou ${a.then}.`].filter(Boolean).join("\n");
    lines.push(
      "BEGIN:VEVENT",
      `UID:ritmo-${a.id}@ritmo.app`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${k.replace(/-/g, "")}T${a.time.replace(":", "")}00`,
      `DURATION:PT${Math.max(5, a.dur || 5)}M`,
      `RRULE:FREQ=WEEKLY;BYDAY=${a.days.map((d) => BYDAY[d]).join(",")}`,
      `SUMMARY:${icsEscape(a.title)}`,
      ...(desc ? [`DESCRIPTION:${icsEscape(desc)}`] : []),
      "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsEscape(a.title)}`, "TRIGGER:PT0M", "END:VALARM",
      "END:VEVENT",
    );
  });
  S.tasks.filter((t) => !t.done && t.date && t.date >= today).forEach((t) => lines.push(...taskEvent(t, stamp)));
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

// Evento de uma tarefa: com horário avisa na hora; sem horário, vira evento do dia com aviso às 9h.
function taskEvent(t, stamp) {
  const d = t.date.replace(/-/g, "");
  return [
    "BEGIN:VEVENT",
    `UID:ritmo-tarefa-${t.id}@ritmo.app`,
    `DTSTAMP:${stamp}`,
    ...(t.time ? [`DTSTART:${d}T${t.time.replace(":", "")}00`, "DURATION:PT15M"] : [`DTSTART;VALUE=DATE:${d}`]),
    `SUMMARY:${icsEscape(t.title)}`,
    ...(t.note ? [`DESCRIPTION:${icsEscape(t.note)}`] : []),
    "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsEscape(t.title)}`, `TRIGGER:${t.time ? "PT0M" : "PT9H"}`, "END:VALARM",
    "END:VEVENT",
  ];
}

export function taskIcsHref(t) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Ritmo//PT-BR", ...taskEvent(t, stamp), "END:VCALENDAR"].join("\r\n");
  return "data:text/calendar;charset=utf-8," + encodeURIComponent(ics);
}

function openCalendar() {
  const count = S.activities.filter((a) => a.time).length + S.tasks.filter((t) => !t.done && t.date && t.date >= dayKey()).length;
  const href = "data:text/calendar;charset=utf-8," + encodeURIComponent(buildIcs());
  sheet(`
    <div class="sheet-head"><div><span class="eyebrow">Avisos na hora certa</span><h2>Lembretes no Calendário</h2></div><button class="icon-btn" data-close aria-label="Fechar">${ICON.close}</button></div>
    <p class="muted">O iPhone não deixa um app web avisar no horário sozinho. Então o Ritmo manda a rotina e as tarefas para o Calendário, que avisa na hora. A rotina se repete toda semana.</p>
    <ol class="steps">
      <li>Toque em <b>Enviar ${count} lembretes</b> (rotina e tarefas com data).</li>
      <li>O iPhone mostra os eventos: toque em <b>Adicionar Tudo</b>.</li>
      <li>Para não misturar com outros eventos, escolha (ou crie) um calendário chamado <b>Ritmo</b>.</li>
    </ol>
    <p class="small muted">Mudou a rotina? Apague o calendário Ritmo no app Calendário e envie de novo. Para uma tarefa só, abra a tarefa e toque em Lembrete no Calendário.</p>
    <a class="btn pri block" href="${esc(href)}" download="ritmo.ics">Enviar ${count} lembretes</a>
  `);
}
