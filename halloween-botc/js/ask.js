// Fereastră de confirmare desenată în pagină. Înlocuiește confirm()-ul browserului, care pe Mac scoate
// proiectorul din ecran complet (fereastra de sistem fură focusul tuturor ferestrelor Chrome).
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function ask(text, { yes = 'Da', no = 'Anulează' } = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'ask-overlay';
    overlay.innerHTML = `<div class="card ask-box"><p>${esc(text)}</p>
      <div class="row2"><button class="btn ghost" data-a="0">${esc(no)}</button><button class="btn" data-a="1">${esc(yes)}</button></div></div>`;
    const done = (ok) => { overlay.remove(); document.removeEventListener('keydown', onKey); resolve(ok); };
    const onKey = (e) => { if (e.key === 'Escape') done(false); if (e.key === 'Enter') done(true); };
    overlay.addEventListener('click', (e) => {
      const b = e.target.closest('[data-a]');
      if (b) done(b.dataset.a === '1');
      else if (e.target === overlay) done(false);
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    overlay.querySelector('[data-a="1"]').focus();
  });
}

// Cere un PIN (cifre ascunse). Întoarce ce s-a tastat, sau null dacă s-a anulat.
export function askPin(text, { yes = 'Confirmă', no = 'Anulează' } = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'ask-overlay';
    overlay.innerHTML = `<div class="card ask-box"><p>${esc(text)}</p>
      <input class="ask-pin" type="password" inputmode="numeric" autocomplete="off" maxlength="8" placeholder="PIN">
      <div class="row2"><button class="btn ghost" data-a="0">${esc(no)}</button><button class="btn danger" data-a="1">${esc(yes)}</button></div></div>`;
    const input = overlay.querySelector('.ask-pin');
    const done = (ok) => { overlay.remove(); document.removeEventListener('keydown', onKey); resolve(ok ? input.value.trim() : null); };
    const onKey = (e) => { if (e.key === 'Escape') done(false); if (e.key === 'Enter') done(true); };
    overlay.addEventListener('click', (e) => {
      const b = e.target.closest('[data-a]');
      if (b) done(b.dataset.a === '1');
      else if (e.target === overlay) done(false);
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    input.focus();
  });
}
