// Motorul jocului Conacul Blackwood – logică pură, fără Firebase și fără DOM.
// Toate funcțiile primesc starea și întorc o stare nouă; nimic nu e modificat pe loc.

export const PLAYERS = [
  'Andrei', 'Flori', 'Luca', 'Nico', 'Bogdan', 'Gabriela',
  'Marian', 'Elisa', 'Robi', 'Cella', 'Radu',
].map((name) => ({ id: normalize(name), name }));

export const ROLES = {
  vampire: {
    name: 'Vampirul', emoji: '🧛', team: 'evil', ability: true,
    prompt: 'Pe cine muști?',
    card: 'Noaptea alegi o victimă. Nu știi cine sunt aliații tăi. Hipnoza nu are efect asupra ta. Supraviețuiește până la miezul nopții.',
  },
  servant: {
    name: 'Servitorul', emoji: '🦇', team: 'evil', ability: false,
    prompt: 'Cine crezi că e vampirul?',
    card: 'Știi cine e vampirul, el nu te știe pe tine. Pentru Detectiv apari „nu e vampir”. O singură dată te poți sacrifica în locul lui la vot.',
  },
  hypnotist: {
    name: 'Hipnotizatorul', emoji: '😵', team: 'evil', ability: true,
    prompt: 'Pe cine hipnotizezi?',
    card: 'Noaptea alegi pe cineva care nu are voie să vorbească la ședință. Dacă alegi vampirul, hipnoza eșuează și afli cine e. Nu poți alege aceeași persoană de două ori la rând.',
  },
  detective: {
    name: 'Detectivul', emoji: '🔍', team: 'good', ability: true,
    prompt: 'Pe cine verifici?',
    card: 'Noaptea verifici o persoană și afli pe loc dacă e vampir. Atenție: unii mint fără să vrea.',
  },
  hunter: {
    name: 'Vânătorul', emoji: '🗡️', team: 'good', ability: true,
    prompt: 'Pe cine protejezi?',
    card: 'Noaptea protejezi pe cineva de mușcătură. Nu te poți proteja singur și nici aceeași persoană de două ori la rând.',
  },
  mayor: {
    name: 'Primarul', emoji: '🎩', team: 'good', ability: false,
    prompt: 'Cine crezi că e vampirul?',
    card: 'Rolul tău e public. Votul tău contează dublu, iar la egalitate după revot decizi tu.',
  },
  gossip: {
    name: 'Bârfitoarea', emoji: '🗣️', team: 'good', ability: false,
    prompt: 'Cine crezi că e vampirul?',
    card: 'Între ședințe scrii un mesaj de maximum 140 de caractere, care apare anonim pe proiector dimineața. Adevăr sau minciună, tu alegi.',
  },
  watchman: {
    name: 'Paznicul de noapte', emoji: '🔦', team: 'good', ability: true,
    prompt: 'Pe cine păzești?',
    card: 'Noaptea păzești pe cineva. Dacă vampirul îl atacă, afli cine e vampirul. Nu poți salva pe nimeni.',
  },
  photographer: {
    name: 'Fotograful', emoji: '📸', team: 'good', ability: true,
    prompt: 'Pe cine fotografiezi?',
    card: 'Noaptea fotografiezi pe cineva. Dimineața afli pe cine a vizat acea persoană cu abilitatea ei.',
  },
  ironman: {
    name: 'Omul de fier', emoji: '💪', team: 'good', ability: true,
    prompt: 'Lângă cine stai de pază?',
    card: 'Noaptea păzești pe cineva. Dacă vampirul îl mușcă (sau te mușcă pe tine), preiei tu mușcătura, primești o listă care îl conține pe vampir și mori noaptea următoare.',
  },
  werewolf: {
    name: 'Vârcolacul blând', emoji: '🐺', team: 'good', ability: false,
    prompt: 'Cine crezi că e vampirul?',
    card: 'Ești de partea binelui, dar pentru Detectiv apari „e vampir”. Pregătește-ți apărarea.',
  },
};

export const ROLE_KEYS = Object.keys(ROLES);

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

export function newGame(players = PLAYERS, settings = {}, rng = Math.random) {
  if (players.length !== ROLE_KEYS.length) throw new Error(`Jocul are nevoie de exact ${ROLE_KEYS.length} jucători.`);
  const keys = shuffle(ROLE_KEYS, rng);
  const roles = Object.fromEntries(players.map((p, i) => [p.id, keys[i]]));
  return {
    players,
    roles,
    alive: Object.fromEntries(players.map((p) => [p.id, true])),
    settings: { ...DEFAULT_SETTINGS, ...settings },
    round: 1,
    mayor: players.find((p) => roles[p.id] === 'mayor').id,
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
  if (servant) out[servant] = [{ kind: 'servant-master', text: `🧛 Stăpânul tău, vampirul, este ${nameOf(state, findByRole(state, 'vampire'))}.` }];
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
  if (mode === 'thermometer') return 'Cine crezi că e vampirul?';
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
    text: isVampire ? `🧛 ${nameOf(state, target)} E VAMPIR` : `✅ ${nameOf(state, target)} nu e vampir`,
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
      tell(hyp.id, { kind: 'hypnosis-failed', text: `🧛 Hipnoza a eșuat... ai găsit vampirul! Este ${nameOf(state, hyp.target)}.` });
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
      text: `💪 Ai fost mușcat! Mai trăiești o zi. Vampirul e unul dintre: ${list.map((id) => nameOf(state, id)).join(', ')}.`,
    });
  }

  // 7. Paznicul.
  if (bite && watch.target === bite) {
    tell(watch.id, { kind: 'watchman', text: `👁️ ${nameOf(state, vamp.id)} l-a atacat pe ${nameOf(state, bite)}.` });
  }

  // 8. Fotograful.
  if (photo.target) {
    const targetOf = { vampire: vamp, hypnotist: hyp, hunter, ironman: iron, watchman: watch, photographer: photo, detective: det };
    const seen = targetOf[prev.roles[photo.target]]?.target ?? null;
    tell(photo.id, {
      kind: 'photo',
      text: seen
        ? `📸 ${nameOf(state, photo.target)} l-a vizat pe ${nameOf(state, seen)}.`
        : `📸 ${nameOf(state, photo.target)} n-a vizat pe nimeni.`,
    });
  }

  // Termometrul suspiciunii: doar cei vii fără abilitate.
  const thermo = {};
  for (const p of prev.players) {
    if (nightMode(prev, p.id) !== 'thermometer') continue;
    const t = pick(p.id);
    if (t) thermo[t] = (thermo[t] ?? 0) + 1;
  }
  const thermometer = Object.entries(thermo)
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
  });

  state.winner = checkWinner(state);
  const report = {
    round: night,
    deaths,
    saved,
    hypnotized: state.hypnotized,
    thermometer,
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
