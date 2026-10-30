// Ditado: fala vira texto, usando o reconhecimento de voz do próprio iPhone.
import { toast, ICON } from "./ui.js";

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
export const canDictate = !!SR;

// Liga um botão de microfone a um campo de texto. append: soma ao que já foi escrito.
export function attachMic(button, input, { lang = "pt-BR", append = false, onFinal } = {}) {
  if (!SR || !button) { if (button) button.hidden = true; return; }
  let rec = null;
  button.onclick = () => {
    if (rec) return rec.stop();
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

export const micButtonHtml = (label = "Ditar") =>
  `<button class="mic" type="button" aria-pressed="false" aria-label="${label}">${ICON.mic}</button>`;
