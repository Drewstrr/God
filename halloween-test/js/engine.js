// Motorul jocului Balul Contelui – logică pură, fără Firebase și fără DOM.
// Toate funcțiile primesc starea și întorc o stare nouă; nimic nu e modificat pe loc.

export const PLAYERS = [
  'Andrei', 'Flori', 'Luca', 'Nico', 'Bogdan', 'Gabriela',
  'Marian', 'Elisa', 'Robi', 'Cella', 'Radu',
].map((name) => ({ id: normalize(name), name }));

export const ROLES = {
  vampire: {
    name: 'Contele Dracula', emoji: '🧛', team: 'evil', ability: true,
    prompt: 'Pe cine muști?',
    card: 'Ești stăpânul castelului. Noaptea alegi o victimă. Nu știi cine sunt aliații tăi. Blestemele nu te ating. Supraviețuiește până la miezul nopții.',
  },
  servant: {
    name: 'Vizitiul Contelui', emoji: '🐴', team: 'evil', ability: false,
    prompt: 'Cine crezi că e Contele?',
    card: 'Știi cine e Contele, el nu te știe pe tine. Pentru Van Helsing apari „nu e Contele”. O singură dată te poți sacrifica în locul lui la vot.',
  },
  hypnotist: {
    name: 'Vrăjitoarea satului', emoji: '🧙‍♀️', team: 'evil', ability: true,
    prompt: 'Pe cine blestemi?',
    card: 'Noaptea arunci un blestem: persoana aleasă rămâne fără grai la ședință. Dacă alegi Contele, blestemul eșuează și afli cine e. Nu poți alege aceeași persoană de două ori la rând.',
  },
  detective: {
    name: 'Van Helsing', emoji: '🔍', team: 'good', ability: true,
    prompt: 'Pe cine cercetezi?',
    card: 'Ești vânătorul de vampiri. Noaptea cercetezi o persoană și afli pe loc dacă e Contele. Atenție: unii par altceva decât sunt.',
  },
  hunter: {
    name: 'Preotul satului', emoji: '✝️', team: 'good', ability: true,
    prompt: 'Pe cine binecuvântezi?',
    card: 'Noaptea binecuvântezi pe cineva cu apă sfințită și îl aperi de mușcătură. Nu te poți apăra singur și nici aceeași persoană de două ori la rând.',
  },
  mayor: {
    name: 'Pârcălabul', emoji: '🗝️', team: 'good', ability: false,
    prompt: 'Cine crezi că e Contele?',
    card: 'Ești cârmuitorul castelului și ții cheile lui. Rolul tău e public. Votul tău contează dublu, iar la egalitate după revot decizi tu.',
  },
  gossip: {
    name: 'Bârfitoarea', emoji: '🗣️', team: 'good', ability: false,
    prompt: 'Cine crezi că e Contele?',
    card: 'Între ședințe scrii un mesaj de maximum 140 de caractere, care apare anonim pe proiector dimineața. Adevăr sau minciună, tu alegi.',
  },
  watchman: {
    name: 'Străjerul de la poartă', emoji: '🏰', team: 'good', ability: true,
    prompt: 'Pe cine păzești?',
    card: 'Noaptea păzești pe cineva. Dacă Contele îl atacă, afli cine e Contele. Nu poți salva pe nimeni.',
  },
  photographer: {
    name: 'Cronicarul', emoji: '📜', team: 'good', ability: true,
    prompt: 'Pe cine urmărești?',
    card: 'Scrii cronica castelului. Noaptea urmărești pe cineva și afli pe cine a vizat acea persoană cu abilitatea ei.',
  },
  ironman: {
    name: 'Haiducul', emoji: '⚔️', team: 'good', ability: true,
    prompt: 'Lângă cine stai de pază?',
    card: 'Noaptea păzești pe cineva. Dacă Contele îl mușcă (sau te mușcă pe tine), preiei tu mușcătura, primești o listă care îl conține pe Conte și mori noaptea următoare.',
  },
  werewolf: {
    name: 'Vârcolacul blând', emoji: '🐺', team: 'good', ability: false,
    prompt: 'Cine crezi că e Contele?',
    card: 'Ești de partea binelui, dar pentru Van Helsing apari „e Contele”. Pregătește-ți apărarea.',
  },
};

export const ROLE_KEYS = Object.keys(ROLES);

// Ce face fiecare personaj, spus pentru ceilalți jucători (fișa „Personajele din joc”).
export const ROLE_ABOUT = {
  vampire: 'Noaptea mușcă pe cineva. Nu-și cunoaște aliații. Blestemele nu-l ating. Răul câștigă dacă rezistă până la final.',
  servant: 'Știe de la început cine e Contele. Pentru Van Helsing pare nevinovat. O singură dată se poate sacrifica la vot în locul Contelui.',
  hypnotist: 'Noaptea blestemă pe cineva, care rămâne fără grai la ședință. Dacă alege Contele, blestemul eșuează și află cine e. Pentru Van Helsing pare nevinovată.',
  detective: 'Noaptea cercetează o persoană și află pe loc dacă e Contele. Atenție: Vârcolacul pare Contele, Vizitiul și Vrăjitoarea par nevinovați.',
  hunter: 'Noaptea binecuvântează pe cineva și îl apără de mușcătură. Nu se poate apăra singur și nici aceeași persoană de două ori la rând.',
  mayor: 'Rol public. Votul lui contează dublu, iar la egalitate după revot decide el.',
  gossip: 'Între ședințe scrie un mesaj anonim care apare pe proiector dimineața. Poate spune adevărul sau poate minți.',
  watchman: 'Noaptea păzește pe cineva. Dacă Contele îl atacă, Străjerul află cine e Contele, dar nu-l poate salva.',
  photographer: 'Noaptea urmărește pe cineva și află pe cine a vizat acea persoană cu abilitatea ei.',
  ironman: 'Noaptea păzește pe cineva. Dacă Contele îl mușcă (sau îl mușcă pe el), preia mușcătura, primește o listă care îl conține pe Conte și moare noaptea următoare.',
  werewolf: 'E de partea binelui, dar pentru Van Helsing pare Contele. Știe asta și trebuie să se apere.',
};

// Ordinea în care intră personajele când sunt mai puțini jucători.
export const ROLE_PRIORITY = ['vampire', 'detective', 'hunter', 'mayor', 'servant', 'watchman', 'hypnotist', 'photographer', 'ironman', 'gossip', 'werewolf'];
export const MIN_PLAYERS = 4;
export const recommendedRoles = (n) => ROLE_PRIORITY.slice(0, Math.max(0, Math.min(n, ROLE_PRIORITY.length)));

export const DEFAULT_SETTINGS = { sessions: 4, nightSeconds: 90, discussionSeconds: 300, sacrificeSeconds: 15 };

// ---------- utilitare ----------

export function normalize(text) {
  return String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export function shuffle(list, rng = Math.random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const alivePlayers = (state) => state.players.filter((p) => state.alive[p.id]);
const findByRole = (state, role) => state.players.find((p) => state.roles[p.id] === role)?.id ?? null;
const nameOf = (state, id) => state.players.find((p) => p.id === id)?.name ?? id;
const isAlive = (state, id) => Boolean(id && state.alive[id]);

// ---------- începutul jocului ----------

// roleKeys: personajele din joc; trebuie să fie câte unul pentru fiecare jucător și să includă vampirul.
export function newGame(players = PLAYERS, settings = {}, rng = Math.random, roleKeys = recommendedRoles(players.length)) {
  if (players.length < MIN_PLAYERS) throw new Error(`Jocul are nevoie de cel puțin ${MIN_PLAYERS} jucători.`);
  if (roleKeys.length !== players.length) throw new Error('Trebuie să fie câte un personaj pentru fiecare jucător.');
  if (!roleKeys.includes('vampire')) throw new Error('Contele trebuie să fie în joc.');
  if (new Set(roleKeys).size !== roleKeys.length || roleKeys.some((k) => !ROLES[k])) throw new Error('Personaje invalide.');
  const keys = shuffle(roleKeys, rng);
  const roles = Object.fromEntries(players.map((p, i) => [p.id, keys[i]]));
  return {
    players,
    roles,
    alive: Object.fromEntries(players.map((p) => [p.id, true])),
    settings: { ...DEFAULT_SETTINGS, ...settings },
    round: 1,
    mayor: players.find((p) => roles[p.id] === 'mayor')?.id ?? null,
    iron: { used: false, doomed: false },
    sacrificeUsed: false,
    lastTargets: { hunter: null, hypnotist: null },
    hypnotized: null,
    winner: null,
    history: [],
  };
}

// Ce știe fiecare jucător la început, pe lângă rolul lui.
export function initialKnowledge(state) {
  const out = {};
  const servant = findByRole(state, 'servant');
  if (servant) out[servant] = [{ kind: 'servant-master', text: `🧛 Stăpânul tău, Contele, este ${nameOf(state, findByRole(state, 'vampire'))}.` }];
  return out;
}

// ---------- noaptea ----------

// Ce fel de acțiune are jucătorul în noaptea asta: 'ability', 'thermometer' sau 'ghost'.
export function nightMode(state, id) {
  if (!state.alive[id]) return 'ghost';
  const role = state.roles[id];
  if (role === 'ironman' && state.iron.used) return 'thermometer';
  return ROLES[role].ability ? 'ability' : 'thermometer';
}

export function nightPrompt(state, id) {
  const mode = nightMode(state, id);
  if (mode === 'ghost') return 'Lasă un indiciu de un cuvânt';
  if (mode === 'thermometer') return 'Lângă cine stai în noaptea asta?';
  return ROLES[state.roles[id]].prompt;
}

// Pe cine poate alege jucătorul în noaptea asta (doar dintre cei vii).
export function validTargets(state, id) {
  if (nightMode(state, id) === 'ghost') return [];
  const role = state.roles[id];
  return alivePlayers(state)
    .map((p) => p.id)
    .filter((t) => t !== id)
    .filter((t) => !(role === 'hunter' && t === state.lastTargets.hunter))
    .filter((t) => !(role === 'hypnotist' && t === state.lastTargets.hypnotist));
}

export function detectiveResult(state, target) {
  const role = state.roles[target];
  const isVampire = role === 'vampire' || role === 'werewolf';
  return {
    kind: 'detective',
    target,
    isVampire,
    text: isVampire ? `🧛 ${nameOf(state, target)} E CONTELE` : `✅ ${nameOf(state, target)} nu e Contele`,
  };
}

export function ironListSize(othersAlive) {
  if (othersAlive >= 8) return 4;
  if (othersAlive >= 6) return 3;
  return 2;
}

// Indiciul fantomei: un singur cuvânt, fără nume de jucători. Întoarce null dacă e respins.
export function sanitizeHint(state, raw) {
  const word = String(raw ?? '').trim().split(/\s+/)[0]?.slice(0, 24) ?? '';
  if (!word) return null;
  const n = normalize(word).replace(/[^a-z0-9]/g, '');
  if (!n) return null;
  const blocked = state.players.some((p) => n.includes(normalize(p.name).replace(/[^a-z0-9]/g, '')));
  return blocked ? null : word;
}

// actions: { [playerId]: { target } | { hint } }
// Întoarce { state, report } unde report are partea publică și rezultatele private.
export function resolveNight(prev, actions = {}, rng = Math.random) {
  const state = structuredClone(prev);
  const night = state.round;
  const priv = {};
  const tell = (id, msg) => { if (id) (priv[id] ??= []).push(msg); };
  const deaths = [];
  const kill = (id, cause) => { state.alive[id] = false; deaths.push({ id, cause }); };

  // Doar acțiunile valide ale celor vii la începutul nopții contează.
  const pick = (id) => {
    if (!id || !prev.alive[id]) return null;
    const t = actions[id]?.target;
    return t && validTargets(prev, id).includes(t) ? t : null;
  };
  const roleTarget = (role) => {
    const id = findByRole(prev, role);
    if (role === 'ironman' && prev.iron.used) return { id, target: null };
    return { id, target: nightMode(prev, id) === 'ability' ? pick(id) : null };
  };

  const vamp = roleTarget('vampire');
  const hyp = roleTarget('hypnotist');
  const hunter = roleTarget('hunter');
  const iron = roleTarget('ironman');
  const watch = roleTarget('watchman');
  const photo = roleTarget('photographer');
  const det = roleTarget('detective');

  // 1. Omul de fier condamnat noaptea trecută moare acum.
  if (prev.iron.doomed && isAlive(state, iron.id)) {
    kill(iron.id, 'iron-doom');
    state.iron.doomed = false;
  }

  // 2. Hipnoza.
  state.hypnotized = null;
  if (hyp.target) {
    if (prev.roles[hyp.target] === 'vampire') {
      tell(hyp.id, { kind: 'hypnosis-failed', text: `🧛 Blestemul a eșuat... ai găsit Contele! Este ${nameOf(state, hyp.target)}.` });
    } else {
      state.hypnotized = hyp.target;
    }
  }
  state.lastTargets.hypnotist = hyp.target;
  state.lastTargets.hunter = hunter.target;

  // 3–6. Mușcătura.
  let saved = false;
  let savedBy = null;
  const bite = vamp.target;
  if (bite && state.alive[bite]) {
    if (hunter.target === bite) {
      saved = true; savedBy = 'hunter';
    } else if (!prev.iron.used && isAlive(state, iron.id) && (iron.target === bite || iron.id === bite)) {
      saved = true; savedBy = 'ironman';
      state.iron.used = true;
      state.iron.doomed = true;
    } else {
      kill(bite, 'bite');
    }
  }

  // Lista Omului de fier, calculată după morțile nopții.
  if (savedBy === 'ironman') {
    const others = alivePlayers(state).map((p) => p.id).filter((id) => id !== iron.id);
    const size = Math.min(ironListSize(others.length), others.length);
    const fillers = shuffle(others.filter((id) => id !== vamp.id), rng).slice(0, size - 1);
    const list = shuffle([vamp.id, ...fillers], rng);
    tell(iron.id, {
      kind: 'iron-bitten',
      list,
      text: `⚔️ Ai fost mușcat! Mai trăiești o zi. Contele e unul dintre: ${list.map((id) => nameOf(state, id)).join(', ')}.`,
    });
  }

  // 7. Paznicul.
  if (bite && watch.target === bite) {
    tell(watch.id, { kind: 'watchman', text: `🏰 ${nameOf(state, vamp.id)} l-a atacat pe ${nameOf(state, bite)}.` });
  }

  // 8. Fotograful.
  if (photo.target) {
    const targetOf = { vampire: vamp, hypnotist: hyp, hunter, ironman: iron, watchman: watch, photographer: photo, detective: det };
    const seen = targetOf[prev.roles[photo.target]]?.target ?? null;
    tell(photo.id, {
      kind: 'photo',
      text: seen
        ? `📜 ${nameOf(state, photo.target)} l-a vizat pe ${nameOf(state, seen)}.`
        : `📜 ${nameOf(state, photo.target)} n-a vizat pe nimeni.`,
    });
  }

  // Pariul nopții: fiecare jucător (și fantomele) pariază pe cine crede că e vampirul.
  const bets = {};
  for (const p of prev.players) {
    const b = actions[p.id]?.bet;
    if (b && b !== p.id && prev.alive[b]) bets[p.id] = b;
  }
  const tally = {};
  for (const b of Object.values(bets)) tally[b] = (tally[b] ?? 0) + 1;
  const thermometer = Object.entries(tally)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, votes]) => ({ id, name: nameOf(state, id), votes }));

  // Indiciile fantomelor.
  const hints = prev.players
    .filter((p) => !prev.alive[p.id])
    .map((p) => sanitizeHint(prev, actions[p.id]?.hint))
    .filter(Boolean);

  state.history.push({
    type: 'night',
    round: night,
    actions: {
      bite, hypnosis: hyp.target, protect: hunter.target, iron: iron.target,
      watch: watch.target, photo: photo.target, check: det.target,
    },
    deaths: deaths.map((d) => d.id),
    savedBy,
    bets,
  });

  state.winner = checkWinner(state);
  const report = {
    round: night,
    deaths,
    saved,
    hypnotized: state.hypnotized,
    thermometer,
    betCount: Object.keys(bets).length,
    hints,
    private: priv,
  };
  return { state, report };
}

// ---------- votul ----------

// votes: { [voterId]: targetId | 'abstain' }. Primarul are vot dublu.
export function tallyVotes(state, votes, candidates = null) {
  const counts = {};
  for (const [voter, target] of Object.entries(votes)) {
    if (!state.alive[voter] || !target || target === 'abstain') continue;
    if (!state.alive[target]) continue;
    if (candidates && !candidates.includes(target)) continue;
    counts[target] = (counts[target] ?? 0) + (voter === state.mayor ? 2 : 1);
  }
  const max = Math.max(0, ...Object.values(counts));
  const leaders = max > 0 ? Object.keys(counts).filter((id) => counts[id] === max) : [];
  return { counts, max, leaders };
}

// Decide rezultatul unei runde de vot.
// isRevote: dacă e deja revotul; mayorChoice: decizia Primarului la egalitate după revot.
export function voteOutcome(state, votes, { candidates = null, isRevote = false, mayorChoice = null } = {}) {
  const tally = tallyVotes(state, votes, candidates);
  if (tally.leaders.length === 0) return { ...tally, result: 'none' };
  if (tally.leaders.length === 1) return { ...tally, result: 'eliminate', target: tally.leaders[0] };
  if (!isRevote) return { ...tally, result: 'revote', candidates: tally.leaders };
  if (!isAlive(state, state.mayor)) return { ...tally, result: 'none' };
  if (mayorChoice && tally.leaders.includes(mayorChoice)) return { ...tally, result: 'eliminate', target: mayorChoice, byMayor: true };
  return { ...tally, result: 'mayor-decides', candidates: tally.leaders };
}

// Cine primește butonul de Sacrificiu (dacă e cazul) când e eliminat `target`.
export function sacrificeCandidate(state, target) {
  if (state.roles[target] !== 'vampire' || state.sacrificeUsed) return null;
  const servant = findByRole(state, 'servant');
  return isAlive(state, servant) ? servant : null;
}

// Aplică eliminarea prin vot. sacrifice=true dacă Servitorul a apăsat „Mă sacrific”.
export function applyElimination(prev, target, { sacrifice = false, votes = {} } = {}) {
  const state = structuredClone(prev);
  let eliminated = target;
  let sacrificed = false;
  if (sacrifice && sacrificeCandidate(prev, target)) {
    eliminated = findByRole(prev, 'servant');
    sacrificed = true;
    state.sacrificeUsed = true;
  }
  if (eliminated) state.alive[eliminated] = false;
  state.history.push({ type: 'vote', round: prev.round, votes, voted: target, eliminated, sacrificed });

  if (eliminated && state.roles[eliminated] === 'vampire') state.winner = 'good';
  else state.winner = checkWinner(state);
  if (!state.winner && state.round >= state.settings.sessions) state.winner = 'evil';
  return {
    state,
    report: { eliminated, role: eliminated ? state.roles[eliminated] : null, sacrificed, exposedVampire: sacrificed ? target : null },
  };
}

// Votul se încheie fără eliminare.
export function applyNoElimination(prev, votes = {}) {
  const state = structuredClone(prev);
  state.history.push({ type: 'vote', round: prev.round, votes, voted: null, eliminated: null, sacrificed: false });
  state.winner = checkWinner(state) ?? (state.round >= state.settings.sessions ? 'evil' : null);
  return { state };
}

export function nextRound(prev) {
  const state = structuredClone(prev);
  state.round += 1;
  return state;
}

// ---------- victoria ----------

export function checkWinner(state) {
  const vampire = findByRole(state, 'vampire');
  if (!state.alive[vampire]) return 'good';
  const alive = alivePlayers(state);
  const evil = alive.filter((p) => ROLES[state.roles[p.id]].team === 'evil').length;
  if (evil >= alive.length - evil) return 'evil';
  return null;
}

// ---------- finalul: reluarea și titlurile ----------

const ACTION_TEXT = {
  bite: ['vampire', 'a mușcat pe'],
  hypnosis: ['hypnotist', 'a blestemat pe'],
  protect: ['hunter', 'a binecuvântat pe'],
  iron: ['ironman', 'a stat de pază lângă'],
  watch: ['watchman', 'a păzit pe'],
  photo: ['photographer', 'a urmărit pe'],
  check: ['detective', 'a cercetat pe'],
};

// Cronologia completă a jocului, pentru ecranul de final.
export function buildReplay(state) {
  const out = [];
  for (const h of state.history ?? []) {
    if (h.type === 'night') {
      const lines = [];
      for (const [key, [role, verb]] of Object.entries(ACTION_TEXT)) {
        const actor = findByRole(state, role);
        const target = h.actions?.[key];
        if (actor && target) lines.push(`${ROLES[role].emoji} ${nameOf(state, actor)} ${verb} ${nameOf(state, target)}`);
      }
      const deaths = (h.deaths ?? []).map((id) => nameOf(state, id));
      if (h.savedBy) lines.push(h.savedBy === 'hunter' ? '✝️ Preotul a salvat victima' : '⚔️ Haiducul a preluat mușcătura');
      lines.push(deaths.length ? `💀 Au murit: ${deaths.join(', ')}` : '🌙 Nu a murit nimeni');
      out.push({ title: `🌑 Noaptea ${h.round}`, lines });
    } else if (h.type === 'vote') {
      // Voturile grupate pe țintă, ca reluarea să încapă pe un singur ecran.
      const groups = {};
      for (const [v, t] of Object.entries(h.votes ?? {})) (groups[t] ??= []).push(nameOf(state, v));
      const lines = Object.entries(groups)
        .sort(([a, x], [b, y]) => (a === 'abstain') - (b === 'abstain') || y.length - x.length)
        .map(([t, vs]) => `${t === 'abstain' ? '🤐 S-au abținut' : `${nameOf(state, t)} (${vs.length})`}: ${vs.join(', ')}`);
      if (h.sacrificed) lines.push(`🩸 ${nameOf(state, h.eliminated)} s-a sacrificat pentru ${nameOf(state, h.voted)}`);
      else if (h.eliminated) lines.push(`⚰️ Eliminat: ${nameOf(state, h.eliminated)} (${ROLES[state.roles[h.eliminated]].name})`);
      else lines.push('Nimeni nu a fost eliminat');
      out.push({ title: `🗳️ Votul ${h.round}`, lines });
    }
  }
  return out;
}

const best = (scores) => {
  const max = Math.max(0, ...Object.values(scores));
  return max > 0 ? Object.keys(scores).filter((id) => scores[id] === max) : [];
};

// Titlurile serii, calculate din istoric.
export function computeTitles(state) {
  const titles = [];
  const add = (emoji, title, ids, why) => { if (ids.length) titles.push({ emoji, title, names: ids.map((id) => nameOf(state, id)), why }); };
  const evil = (id) => ROLES[state.roles[id]]?.team === 'evil';
  const vampire = findByRole(state, 'vampire');

  // Ghinionistul: primul mort.
  const firstDeath = (state.history ?? []).map((h) => (h.type === 'night' ? h.deaths?.[0] : h.eliminated)).find(Boolean);
  if (firstDeath) add('🍀', 'Ghinionistul', [firstDeath], 'primul care a părăsit castelul');

  // Paranoicul și Justițiarul: voturi date nevinovaților / răilor.
  const innocent = {};
  const justice = {};
  for (const h of state.history ?? []) {
    if (h.type !== 'vote') continue;
    for (const [v, t] of Object.entries(h.votes ?? {})) {
      if (!t || t === 'abstain') continue;
      if (evil(t)) justice[v] = (justice[v] ?? 0) + 1;
      else innocent[v] = (innocent[v] ?? 0) + 1;
    }
  }
  add('😱', 'Paranoicul', best(innocent), 'cele mai multe voturi date nevinovaților');
  add('⚖️', 'Justițiarul', best(justice), 'cele mai multe voturi date răilor');

  // Ochiul de vultur: cele mai multe pariuri corecte pe vampir.
  const eagle = {};
  for (const h of state.history ?? []) {
    if (h.type !== 'night') continue;
    for (const [p, b] of Object.entries(h.bets ?? {})) if (b === vampire) eagle[p] = (eagle[p] ?? 0) + 1;
  }
  add('🦅', 'Ochiul de vultur', best(eagle), 'a ghicit Contele de cele mai multe ori');

  // Actorul: răul care a supraviețuit cel mai mult.
  const lifetime = {};
  for (const p of state.players) {
    if (!evil(p.id)) continue;
    let died = Infinity;
    (state.history ?? []).forEach((h, i) => {
      if ((h.type === 'night' && h.deaths?.includes(p.id)) || (h.type === 'vote' && h.eliminated === p.id)) died = Math.min(died, i);
    });
    lifetime[p.id] = died === Infinity ? 1000 : died + 1;
  }
  add('🎭', 'Actorul', best(lifetime), 'răul care a rezistat cel mai mult');

  // Eroul: Omul de fier care a preluat o mușcătură sau Vânătorul cu cele mai multe salvări.
  const iron = findByRole(state, 'ironman');
  const hunter = findByRole(state, 'hunter');
  const saves = (state.history ?? []).filter((h) => h.savedBy === 'hunter').length;
  if (iron && state.iron?.used) add('⚔️', 'Eroul', [iron], 'a preluat mușcătura Contelui');
  else if (hunter && saves) add('✝️', 'Eroul', [hunter], `a salvat ${saves === 1 ? 'o viață' : `${saves} vieți`}`);

  return titles;
}

// Clasamentul pariurilor: câte nopți a ghicit fiecare vampirul.
export function betLeaderboard(state) {
  const vampire = findByRole(state, 'vampire');
  const score = Object.fromEntries(state.players.map((p) => [p.id, 0]));
  for (const h of state.history ?? []) {
    if (h.type !== 'night') continue;
    for (const [p, b] of Object.entries(h.bets ?? {})) if (b === vampire && p in score) score[p] += 1;
  }
  return Object.entries(score).sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ name: nameOf(state, id), correct: n }));
}
