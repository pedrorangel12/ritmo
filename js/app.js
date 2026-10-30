// Navegação entre as abas e inicialização.
import { subscribe } from "./store.js";
import { $, $$ } from "./ui.js";
import { renderHoje, renderHabitos } from "./rotina.js";
import { renderAssistir } from "./assistir.js";
import { renderEspanhol } from "./espanhol.js";

const VIEWS = { hoje: renderHoje, assistir: renderAssistir, espanhol: renderEspanhol, habitos: renderHabitos };
let current = VIEWS[location.hash.slice(1)] ? location.hash.slice(1) : "hoje";

// Troca de aba (ou redesenha a atual, mantendo a rolagem).
export function go(tab) {
  const view = $("#view");
  const same = !tab || tab === current;
  const y = window.scrollY;
  if (tab) current = tab;
  VIEWS[current](view);
  $$(".tabbar button").forEach((b) => b.setAttribute("aria-current", b.dataset.tab === current ? "page" : "false"));
  if (same) window.scrollTo(0, y);
  else {
    window.scrollTo(0, 0);
    history.replaceState(null, "", "#" + current);
  }
}

$$(".tabbar button").forEach((b) => (b.onclick = () => go(b.dataset.tab)));
subscribe(() => go());

// "Hoje" muda com o relógio: redesenha a cada minuto se nada estiver aberto por cima.
setInterval(() => {
  if (current === "hoje" && !$("#layer").children.length) go();
}, 60000);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && !$("#layer").children.length) go();
});

go();

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
navigator.storage?.persist?.().catch(() => {});
