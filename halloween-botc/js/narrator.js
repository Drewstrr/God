// Vocea naratorului: vocea românească a sistemului (pe Mac: „Ioana”), prin sinteza de voce a browserului.
// Nu are nevoie de internet. Dacă nu există voce românească, tace.
let enabled = true;
let voice = null;

function pickVoice() {
  const voices = window.speechSynthesis?.getVoices?.() ?? [];
  voice = voices.find((v) => /^ro(-|_|$)/i.test(v.lang) && /ioana/i.test(v.name))
    ?? voices.find((v) => /^ro(-|_|$)/i.test(v.lang))
    ?? null;
}
if ('speechSynthesis' in window) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}

export const setVoice = (on) => { enabled = on; if (!on) window.speechSynthesis?.cancel(); };
export const hasVoice = () => Boolean(voice);

// Spune un text, rar și grav. Întoarce o promisiune care se rezolvă când termină (sau imediat, dacă nu vorbește).
export function speak(text, { rate = 0.82, pitch = 0.75 } = {}) {
  if (!enabled || !voice || !text) return Promise.resolve();
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = rate;
    u.pitch = pitch;
    u.onend = resolve;
    u.onerror = resolve;
    speechSynthesis.speak(u);
    setTimeout(resolve, 20000);
  });
}
export const hush = () => window.speechSynthesis?.cancel();
