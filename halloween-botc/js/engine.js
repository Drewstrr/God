// Motorul jocului (varianta în stil Blood on the Clocktower) – logică pură, fără Firebase și fără DOM.
// Aplicația ține locul naratorului: împarte rolurile, rezolvă noaptea, dă informațiile (adevărate sau false)
// și numără voturile. Funcțiile primesc starea și întorc o stare nouă; nimic nu e modificat pe loc.

export const GAME_TITLE = 'Balul Contelui';

export const PLAYERS = [
  'Andrei', 'Flori', 'Luca', 'Nico', 'Bogdan', 'Gabriela',
  'Marian', 'Elisa', 'Robi', 'Cella', 'Radu',
].map((name) => ({ id: normalize(name), name })).concat({ id: 'invitat', name: 'Invitatul Secret' });

// Fetele din grup: textele folosesc forma de feminin („o nominalizează pe Flori”, „executată”).
export const FEMALE = new Set(['nico', 'cella', 'flori', 'gabriela', 'elisa']);
export const isFemale = (id) => FEMALE.has(id);
// gen(id, 'executat', 'executată') → forma potrivită pentru jucător.
export const gen = (id, masc, fem) => (isFemale(id) ? fem : masc);

// Tipurile de personaje (ca la BotC: Townsfolk, Outsider, Minion, Demon).
export const TYPES = {
  townsfolk: { name: 'Sătean', plural: 'Săteni', team: 'good' },
  outsider: { name: 'Străin', plural: 'Străini', team: 'good' },
  minion: { name: 'Slujitor', plural: 'Slujitori', team: 'evil' },
  demon: { name: 'Conte', plural: 'Conte', team: 'evil' },
};

// Lista personajelor posibile („scenariul”). În joc intră doar o parte, deci unele roluri lipsesc mereu.
// night1 / nights: ce alege jucătorul noaptea (pick = câți jucători); null = nu alege nimic.
export const ROLES = {
  // Săteni
  washer: {
    name: 'Spălătoreasa', emoji: '🧺', type: 'townsfolk', night1: { info: true },
    card: 'În prima noapte afli că unul din doi jucători are un anumit rol de Sătean. Ex.: „Ana sau Dan e Preotul”. Așa poți dovedi cine spune adevărul.',
  },
  librarian: {
    name: 'Arhivarul', emoji: '📚', type: 'townsfolk', night1: { info: true },
    card: 'În prima noapte afli că unul din doi jucători are un anumit rol de Străin. Ex.: „Ana sau Dan e Bețivul” (sau afli că nu e niciun Străin în joc).',
  },
  investigator: {
    name: 'Sfetnicul', emoji: '📯', type: 'townsfolk', night1: { info: true },
    card: 'În prima noapte afli că unul din doi jucători e un Slujitor al Contelui. Ex.: „Ana sau Dan e Vrăjitoarea”: unul din ei sigur e rău.',
  },
  fortune: {
    name: 'Ghicitoarea', emoji: '🔮', type: 'townsfolk',
    night1: { pick: 2, prompt: 'Alege doi jucători: e Contele unul dintre ei?', anyone: true },
    nights: { pick: 2, prompt: 'Alege doi jucători: e Contele unul dintre ei?', anyone: true },
    card: 'În fiecare noapte alegi doi jucători și afli dacă unul dintre ei e Contele. Atenție: un anumit jucător bun îți apare mereu drept Conte.',
  },
  undertaker: {
    name: 'Groparul', emoji: '⚰️', type: 'townsfolk', nights: { info: true },
    card: 'În fiecare noapte, începând cu a doua, afli rolul celui executat în ziua de dinainte.',
  },
  monk: {
    name: 'Preotul', emoji: '✝️', type: 'townsfolk',
    nights: { pick: 1, prompt: 'Pe cine binecuvântezi în noaptea asta?', notSelf: true },
    card: 'În fiecare noapte, începând cu a doua, binecuvântezi un alt jucător: Contele nu-l poate ucide în noaptea aceea.',
  },
  raven: {
    name: 'Corbierul', emoji: '🪶', type: 'townsfolk',
    card: 'Dacă Contele te ucide noaptea, dimineața alegi un jucător și îi afli rolul.',
  },
  slayer: {
    name: 'Van Helsing', emoji: '🗡️', type: 'townsfolk', day: true,
    card: 'O singură dată în tot jocul, ziua, în fața tuturor, înfigi țărușul într-un jucător. Dacă e Contele, moare.',
  },
  soldier: {
    name: 'Haiducul', emoji: '⚔️', type: 'townsfolk',
    card: 'Contele nu te poate ucide noaptea.',
  },
  mayor: {
    name: 'Primarul', emoji: '🎩', type: 'townsfolk',
    card: 'Dacă rămân doar 3 jucători în viață și ziua se încheie fără execuție, binele câștigă. Dacă Contele te atacă noaptea, se poate să moară altcineva în locul tău.',
  },
  // Străini
  drunk: {
    name: 'Bețivul', emoji: '🍷', type: 'outsider',
    card: 'Nu știi că ești Bețivul: crezi că ai un rol de Sătean, dar abilitatea ta nu funcționează și informațiile tale pot fi false.',
  },
  recluse: {
    name: 'Sihastrul', emoji: '🏚️', type: 'outsider',
    card: 'Ești de partea binelui, dar abilitățile celorlalți te pot vedea drept Slujitor sau chiar drept Conte.',
  },
  saint: {
    name: 'Sfântul', emoji: '😇', type: 'outsider',
    card: 'Dacă ești executat, răul câștigă imediat.',
  },
  // Slujitori
  poisoner: {
    name: 'Vrăjitoarea', emoji: '🧙‍♀️', type: 'minion',
    night1: { pick: 1, prompt: 'Pe cine otrăvești?', anyone: true },
    nights: { pick: 1, prompt: 'Pe cine otrăvești?', anyone: true },
    card: 'În fiecare noapte otrăvești un jucător: până la noaptea următoare, abilitatea lui nu funcționează și informațiile lui pot fi false.',
  },
  spy: {
    name: 'Vizitiul', emoji: '🐴', type: 'minion', night1: { info: true }, nights: { info: true },
    card: 'În fiecare noapte vezi rolurile tuturor. Abilitățile celorlalți te pot vedea drept jucător bun, chiar drept Sătean.',
  },
  scarlet: {
    name: 'Mireasa Contelui', emoji: '🥀', type: 'minion',
    card: 'Dacă Contele moare și sunt încă cel puțin 5 jucători în viață, devii tu noul Conte.',
  },
  // Contele
  demon: {
    name: 'Contele Dracula', emoji: '🧛', type: 'demon',
    nights: { pick: 1, prompt: 'Pe cine muști în noaptea asta?', notSelf: true },
    card: 'În fiecare noapte, începând cu a doua, ucizi un jucător. Știi cine îți sunt Slujitorii și primești trei roluri care nu sunt în joc, ca să te ascunzi în spatele lor.',
  },
};

export const ROLE_KEYS = Object.keys(ROLES);
export const keysOfType = (type) => ROLE_KEYS.filter((k) => ROLES[k].type === type);
export const teamOf = (role) => TYPES[ROLES[role].type].team;

// Câte personaje din fiecare tip intră în joc, după numărul de jucători (ca la BotC).
export const DISTRIBUTION = {
  5: [3, 0, 1, 1], 6: [3, 1, 1, 1], 7: [5, 0, 1, 1], 8: [5, 1, 1, 1], 9: [5, 2, 1, 1],
  10: [7, 0, 2, 1], 11: [7, 1, 2, 1], 12: [7, 2, 2, 1], 13: [9, 0, 3, 1], 14: [9, 1, 3, 1], 15: [9, 2, 3, 1],
};
export const MIN_PLAYERS = 5;
// Al 12-lea loc („Invitatul Secret”) apare și intră în joc doar după ce cineva își setează PIN-ul pe numele lui.
export const SECRET_GUEST = 'invitat';
export const inLineup = (lineup, id, players) => lineup?.players?.[id] !== false && (id !== SECRET_GUEST || Boolean(players?.[id]?.hasPin));
export const MAX_PLAYERS = 15;

// Ordinea în care se rezolvă noaptea (cine acționează înaintea cui).
export const NIGHT_ORDER = ['poisoner', 'monk', 'demon', 'raven', 'undertaker', 'washer', 'librarian', 'investigator', 'fortune', 'spy'];

export const DEFAULT_SETTINGS = { nightSeconds: 90, defenseSeconds: 60, voteSeconds: 20, freeMinutes: 22 };

// Cât de des „mint” Vizitiul și Sihastrul în fața abilităților (decizia naratorului, aici la întâmplare).
const MISREGISTER = 0.5;
// Primarul atacat: șansa ca altcineva să moară în locul lui.
const MAYOR_BOUNCE = 0.5;

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

const pickOne = (list, rng) => list[Math.floor(rng() * list.length)];
export const nameOf = (state, id) => state.players.find((p) => p.id === id)?.name ?? id;
export const roleName = (role) => `${ROLES[role].emoji} ${ROLES[role].name}`;
export const alivePlayers = (state) => state.players.filter((p) => state.alive[p.id]);
export const aliveCount = (state) => alivePlayers(state).length;
export const findByRole = (state, role) => state.players.find((p) => state.roles[p.id] === role)?.id ?? null;
export const playersOfType = (state, type) => state.players.filter((p) => ROLES[state.roles[p.id]].type === type).map((p) => p.id);
// Contele viu (după ce Mireasa preia rolul, vechiul Conte mort rămâne trecut tot drept Conte).
export const demonId = (state) => state.players.find((p) => state.roles[p.id] === 'demon' && state.alive[p.id])?.id ?? findByRole(state, 'demon');
// Rolul pe care jucătorul crede că îl are (Bețivul vede un rol de Sătean).
export const believedRole = (state, id) => state.believed?.[id] ?? state.roles[id];
// Voturi necesare pentru ca cineva să ajungă „pe butuc”: jumătate din cei vii, rotunjit în sus.
export const voteThreshold = (state) => Math.ceil(aliveCount(state) / 2);

// Abilitatea merge doar dacă jucătorul e viu, nu e otrăvit și nu e Bețivul.
export function functioning(state, id) {
  return Boolean(id) && state.alive[id] && state.poisoned !== id && state.roles[id] !== 'drunk';
}

// ---------- începutul jocului ----------

export function newGame(players = PLAYERS, settings = {}, rng = Math.random) {
  const n = players.length;
  const dist = DISTRIBUTION[n];
  if (!dist) throw new Error(`Jocul merge cu ${MIN_PLAYERS}–${MAX_PLAYERS} jucători.`);
  const [tf, os, mn] = dist;
  const town = shuffle(keysOfType('townsfolk'), rng);
  const outs = shuffle(keysOfType('outsider'), rng);
  const mins = shuffle(keysOfType('minion'), rng);
  const inPlay = [...town.slice(0, tf), ...outs.slice(0, os), ...mins.slice(0, mn), 'demon'];
  const order = shuffle(players, rng);
  const roles = Object.fromEntries(order.map((p, i) => [p.id, inPlay[i]]));

  // Bețivul crede că e un Sătean care nu e în joc.
  const outOfPlayTown = town.slice(tf);
  const believed = {};
  const drunk = Object.keys(roles).find((id) => roles[id] === 'drunk');
  if (drunk) believed[drunk] = outOfPlayTown.shift();

  // Trei roluri bune care nu sunt în joc, pentru Conte (de preferat Săteni).
  const bluffs = [...outOfPlayTown, ...outs.slice(os)].slice(0, 3);
  const good = Object.keys(roles).filter((id) => teamOf(roles[id]) === 'good');
  return {
    players,
    roles,
    believed,
    bluffs,
    redHerring: pickOne(good, rng),         // jucătorul bun care îi apare Ghicitoarei drept Conte
    alive: Object.fromEntries(players.map((p) => [p.id, true])),
    ghostVote: {},                           // morții care și-au păstrat votul de fantomă
    settings: { ...DEFAULT_SETTINGS, ...settings },
    night: 1,
    poisoned: null,
    slayerUsed: {},
    lastExecuted: null,
    today: null,
    pendingRaven: null,
    winner: null,
    history: [],
  };
}

// Ce află fiecare la început: Contele și Slujitorii se cunosc, Contele primește cele trei roluri-paravan.
export function initialKnowledge(state) {
  const out = {};
  const demon = demonId(state);
  const minions = playersOfType(state, 'minion');
  if (state.players.length < 7) return out;  // la mai puțin de 7 jucători, răul nu se cunoaște (ca la BotC)
  out[demon] = [
    { kind: 'minions', text: `🦇 Slujitorii tăi: ${minions.map((id) => nameOf(state, id)).join(', ')}.` },
    { kind: 'bluffs', text: `🎭 Roluri care NU sunt în joc (te poți ascunde în spatele lor): ${state.bluffs.map(roleName).join(', ')}.` },
  ];
  for (const m of minions) {
    const others = minions.filter((x) => x !== m);
    out[m] = [{
      kind: 'master',
      text: `🧛 Contele este ${nameOf(state, demon)}.${others.length ? ` Ceilalți Slujitori: ${others.map((id) => nameOf(state, id)).join(', ')}.` : ''}`,
    }];
  }
  return out;
}

// ---------- noaptea ----------

// Ce alege jucătorul în noaptea curentă (după rolul pe care crede că îl are). null = nu alege nimic.
export function nightAction(state, id) {
  if (!state.alive[id]) return null;
  const spec = state.night === 1 ? ROLES[believedRole(state, id)].night1 : ROLES[believedRole(state, id)].nights;
  return spec?.pick ? spec : null;
}

// Pe cine poate alege jucătorul.
export function validTargets(state, id) {
  const spec = nightAction(state, id);
  if (!spec) return [];
  return state.players.map((p) => p.id)
    .filter((t) => spec.anyone || state.alive[t])
    .filter((t) => !(spec.notSelf && t === id));
}

// Cum „apare” un jucător în fața abilităților: Vizitiul poate părea Sătean, Sihastrul poate părea Slujitor sau Conte.
export function registersAs(state, id, rng = Math.random) {
  const role = state.roles[id];
  if (role === 'spy' && rng() < MISREGISTER) return pickOne(keysOfType('townsfolk'), rng);
  if (role === 'recluse' && rng() < MISREGISTER) return pickOne([...keysOfType('minion'), 'demon'], rng);
  return role;
}

function pairInfo(state, self, type, rng, honest) {
  const others = state.players.map((p) => p.id).filter((id) => id !== self);
  const label = { townsfolk: 'Sătean', outsider: 'Străin', minion: 'Slujitor' }[type];
  if (honest) {
    const matches = shuffle(others, rng).map((id) => [id, registersAs(state, id, rng)]).filter(([, r]) => ROLES[r].type === type);
    if (!matches.length) return { text: `Nu e niciun ${label} în joc.` };
    const [x, role] = matches[0];
    const y = pickOne(others.filter((id) => id !== x), rng);
    const [a, b] = shuffle([x, y], rng);
    return { text: `Unul dintre ${nameOf(state, a)} și ${nameOf(state, b)} este ${roleName(role)}.` };
  }
  // Informație falsă: un rol oarecare de tipul cerut și doi jucători la întâmplare.
  if (type === 'outsider' && rng() < 0.2) return { text: `Nu e niciun ${label} în joc.` };
  const [a, b] = shuffle(others, rng);
  return { text: `Unul dintre ${nameOf(state, a)} și ${nameOf(state, b)} este ${roleName(pickOne(keysOfType(type), rng))}.` };
}

// Grimoarul: tot ce vede Vizitiul (și panoul de urgență).
export function grimoire(state) {
  return state.players.map((p) => {
    const role = state.roles[p.id];
    const extra = [
      role === 'drunk' ? `crede că e ${ROLES[state.believed[p.id]].name}` : '',
      state.poisoned === p.id ? 'otrăvit' : '',
      state.alive[p.id] ? '' : 'mort',
    ].filter(Boolean).join(', ');
    return `${p.name}: ${roleName(role)}${extra ? ` (${extra})` : ''}`;
  });
}

// actions: { [jucător]: { targets: [..], bet } }. Întoarce { state, report } cu morțile și mesajele private.
export function resolveNight(prev, actions = {}, rng = Math.random) {
  const state = structuredClone(prev);
  const night = state.night;
  const priv = {};
  const tell = (id, msg) => { if (id) (priv[id] ??= []).push(msg); };
  const deaths = [];
  const kill = (id, cause) => { if (state.alive[id]) { state.alive[id] = false; state.ghostVote[id] = true; deaths.push({ id, cause }); } };
  const pick = (id) => {
    const t = actions[id]?.targets ?? [];
    const valid = validTargets(prev, id);
    const need = nightAction(prev, id)?.pick ?? 0;
    const ok = [...new Set(t)].filter((x) => valid.includes(x));
    return ok.length >= need ? ok.slice(0, need) : null;
  };
  // Cine are de fapt un anumit rol (sau crede că îl are, cazul Bețivului).
  const holders = (role) => state.players.map((p) => p.id).filter((id) => prev.alive[id] && believedRole(prev, id) === role);

  // 1. Vrăjitoarea otrăvește (otrava ține până la noaptea următoare).
  state.poisoned = null;
  const poisoner = findByRole(prev, 'poisoner');
  if (poisoner && prev.alive[poisoner]) state.poisoned = pick(poisoner)?.[0] ?? null;

  // 2. Preotul binecuvântează.
  let protectedId = null;
  for (const monk of holders('monk')) {
    const t = pick(monk)?.[0];
    if (t && functioning(state, monk)) protectedId = t;
  }

  // 3. Contele mușcă (nu în prima noapte).
  let attack = null;
  let attackResult = null;   // ce s-a întâmplat cu atacul (pentru reluarea de la final)
  const demon = demonId(prev);
  if (night > 1 && demon && prev.alive[demon]) {
    const t = pick(demon)?.[0];
    if (t && state.alive[t]) {
      attack = t;
      let victim = t;
      if (state.roles[t] === 'mayor' && functioning(state, t) && rng() < MAYOR_BOUNCE) {
        const others = alivePlayers(state).map((p) => p.id).filter((id) => id !== t && id !== demon);
        victim = others.length ? pickOne(others, rng) : t;
      }
      const blessed = victim === protectedId;
      const soldier = state.roles[victim] === 'soldier' && functioning(state, victim);
      if (!blessed && !soldier) kill(victim, 'bite');
      attackResult = { victim, saved: blessed ? 'monk' : soldier ? 'soldier' : null, bounced: victim !== t };
    }
  }

  // 4. Corbierul ucis noaptea alege dimineața pe cineva.
  const ravenDead = deaths.find((d) => believedRole(prev, d.id) === 'raven');
  state.pendingRaven = ravenDead ? { id: ravenDead.id, honest: state.roles[ravenDead.id] === 'raven' && state.poisoned !== ravenDead.id } : null;

  // Cine a murit în noaptea asta nu mai primește informații (în afară de Corbier).
  const awake = (id) => state.alive[id];

  // 5. Groparul: rolul celui executat ieri.
  if (night > 1 && prev.lastExecuted) {
    for (const u of holders('undertaker').filter(awake)) {
      const role = functioning(state, u) ? registersAs(state, prev.lastExecuted, rng) : pickOne(ROLE_KEYS, rng);
      tell(u, { kind: 'info', text: `⚰️ ${nameOf(state, prev.lastExecuted)}, ${gen(prev.lastExecuted, 'executat', 'executată')} ieri, era ${roleName(role)}.` });
    }
  }

  // 6. Informațiile din prima noapte.
  if (night === 1) {
    for (const [role, type] of [['washer', 'townsfolk'], ['librarian', 'outsider'], ['investigator', 'minion']]) {
      for (const id of holders(role)) {
        tell(id, { kind: 'info', text: `${ROLES[role].emoji} ${pairInfo(state, id, type, rng, functioning(state, id)).text}` });
      }
    }
  }

  // 7. Ghicitoarea.
  for (const ft of holders('fortune').filter(awake)) {
    const pair = pick(ft);
    if (!pair) continue;
    const truth = pair.some((id) => id === state.redHerring || registersAs(state, id, rng) === 'demon');
    const answer = functioning(state, ft) ? truth : (rng() < 0.7 ? !truth : truth);
    const names = pair.map((id) => nameOf(state, id)).join(' și ');
    tell(ft, { kind: 'info', text: answer ? `🔮 DA: unul dintre ${names} este Contele.` : `🔮 NU: niciunul dintre ${names} nu este Contele.` });
  }

  // 8. Vizitiul vede grimoarul.
  const spy = findByRole(state, 'spy');
  if (spy && awake(spy)) tell(spy, { kind: 'grimoire', text: `🐴 Grimoarul nopții ${night}:\n${grimoire(state).join('\n')}` });

  // Pariul nopții: pe cine crede fiecare că e Contele (doar pentru titlurile de la final).
  const bets = {};
  for (const p of prev.players) {
    const b = actions[p.id]?.bet;
    if (b && b !== p.id) bets[p.id] = b;
  }

  state.history.push({
    type: 'night', night,
    poisoned: state.poisoned, protected: protectedId, attack, attackResult,
    fortune: Object.fromEntries(holders('fortune').map((id) => [id, pick(id)])),
    deaths: deaths.map((d) => d.id), bets,
  });
  state.winner = checkWinner(state);
  return { state, report: { night, deaths, private: priv } };
}

// Corbierul ucis alege un jucător: îi află rolul (sau un rol fals, dacă era otrăvit sau Bețiv).
export function resolveRaven(prev, target, rng = Math.random) {
  const state = structuredClone(prev);
  const pending = state.pendingRaven;
  if (!pending || !state.players.some((p) => p.id === target)) return { state, message: null };
  state.pendingRaven = null;
  const role = pending.honest ? registersAs(state, target, rng) : pickOne(ROLE_KEYS, rng);
  return { state, message: { kind: 'info', text: `🪶 ${nameOf(state, target)} este ${roleName(role)}.` } };
}

// ---------- ziua: nominalizări, vot, execuție ----------

export function startDay(prev) {
  const state = structuredClone(prev);
  state.today = { day: state.night, nominators: {}, nominees: {}, block: null, nominations: [], executed: null };
  return state;
}

// Poate X să-l nominalizeze pe Y? Întoarce motivul refuzului sau null.
export function nominationError(state, by, target) {
  const t = state.today;
  if (!t) return 'Nu e zi.';
  if (!state.alive[by]) return 'Fantomele nu pot nominaliza.';
  if (t.nominators[by]) return 'Ai nominalizat deja pe cineva azi.';
  if (t.nominees[target]) return 'Jucătorul a fost deja nominalizat azi.';
  if (!state.players.some((p) => p.id === target)) return 'Jucător necunoscut.';
  // La BotC original și morții pot fi nominalizați, dar nu are rost și încurcă începătorii: doar cei vii.
  if (!state.alive[target]) return 'Fantomele nu pot fi nominalizate.';
  return null;
}

export function nominate(prev, by, target) {
  const err = nominationError(prev, by, target);
  if (err) throw new Error(err);
  const state = structuredClone(prev);
  state.today.nominators[by] = true;
  state.today.nominees[target] = true;
  return state;
}

// votes: { [jucător]: true | false }. Morții votează doar dacă și-au păstrat votul de fantomă (care se consumă).
export function tallyNomination(prev, by, target, votes) {
  const state = structuredClone(prev);
  const counted = [];
  for (const p of state.players) {
    if (!votes[p.id]) continue;
    if (state.alive[p.id]) counted.push(p.id);
    else if (state.ghostVote[p.id]) { counted.push(p.id); state.ghostVote[p.id] = false; }
  }
  const count = counted.length;
  const threshold = voteThreshold(state);
  const block = state.today.block;
  let result = 'failed';
  if (count >= threshold) {
    if (!block || count > block.votes) { state.today.block = { id: target, votes: count }; result = 'block'; }
    else if (count === block.votes) { state.today.block = { id: null, votes: count }; result = 'tie'; }
  }
  const entry = { by, target, yes: counted, count, threshold, result };
  state.today.nominations.push(entry);
  return { state, entry };
}

// Moartea Contelui: Mireasa preia rolul dacă sunt încă cel puțin 5 jucători în viață (înainte de moarte).
function demonDies(state, aliveBefore) {
  const bride = findByRole(state, 'scarlet');
  if (bride && functioning(state, bride) && aliveBefore >= 5) {
    state.roles[bride] = 'demon';
    return { newDemon: bride };
  }
  state.winner = 'good';
  return { newDemon: null };
}

// Sfârșitul zilei: cel de pe butuc e executat. Fără execuție la 3 jucători în viață, Primarul câștigă.
export function endDay(prev) {
  const state = structuredClone(prev);
  const target = state.today?.block?.id ?? null;
  const report = { executed: null, newDemon: null, saint: false, mayorWin: false };
  if (target) {
    const aliveBefore = aliveCount(state);
    const wasDemon = state.roles[target] === 'demon';
    const saintWorks = state.roles[target] === 'saint' && state.poisoned !== target;
    state.alive[target] = false;
    state.ghostVote[target] = true;
    state.lastExecuted = target;
    report.executed = target;
    if (saintWorks) { state.winner = 'evil'; report.saint = true; }
    else if (wasDemon) Object.assign(report, demonDies(state, aliveBefore));
  } else {
    state.lastExecuted = null;
    const mayor = findByRole(state, 'mayor');
    if (mayor && functioning(state, mayor) && aliveCount(state) === 3) { state.winner = 'good'; report.mayorWin = true; }
  }
  state.history.push({ type: 'day', day: state.today?.day ?? state.night, nominations: state.today?.nominations ?? [], executed: target });
  state.today = null;
  state.winner ??= checkWinner(state);
  return { state, report };
}

// Van Helsing (o dată pe joc): dacă ținta e Contele și abilitatea funcționează, Contele moare.
export function slay(prev, by, target) {
  const state = structuredClone(prev);
  if (state.slayerUsed[by]) throw new Error('Țărușul a fost deja folosit.');
  if (!state.alive[by]) throw new Error('Fantomele nu pot folosi țărușul.');
  state.slayerUsed[by] = true;
  const works = state.roles[by] === 'slayer' && functioning(state, by);
  const hit = works && state.alive[target] && state.roles[target] === 'demon';
  const report = { by, target, hit, newDemon: null };
  if (hit) {
    const aliveBefore = aliveCount(state);
    state.alive[target] = false;
    state.ghostVote[target] = true;
    Object.assign(report, demonDies(state, aliveBefore));
  }
  state.history.push({ type: 'slay', day: state.today?.day ?? state.night, by, target, hit });
  state.winner ??= checkWinner(state);
  return { state, report };
}

export function nextNight(prev) {
  const state = structuredClone(prev);
  state.night += 1;
  return state;
}

// Binele câștigă când moare Contele; răul, când rămân doar doi jucători în viață.
export function checkWinner(state) {
  if (state.winner) return state.winner;
  const demon = demonId(state);
  if (!demon || !state.alive[demon]) return 'good';
  if (aliveCount(state) <= 2) return 'evil';
  return null;
}

// ---------- finalul ----------

export function buildReplay(state) {
  const out = [];
  for (const h of state.history ?? []) {
    if (h.type === 'night') {
      const lines = [];
      const pe = (id, verb, vf) => (isFemale(id) ? `${vf} pe ${nameOf(state, id)}` : `l-a ${verb} pe ${nameOf(state, id)}`);
      if (h.poisoned) lines.push(`🧙‍♀️ Vrăjitoarea ${pe(h.poisoned, 'otrăvit', 'a otrăvit-o')}`);
      if (h.protected) lines.push(`✝️ Preotul ${pe(h.protected, 'binecuvântat', 'a binecuvântat-o')}`);
      if (h.attack) {
        const res = h.attackResult ?? {};
        let line = `🧛 Contele ${pe(h.attack, 'atacat', 'a atacat-o')}`;
        if (res.bounced) line += `, dar Primarul a scăpat: în locul lui a fost ${gen(res.victim, 'atacat', 'atacată')} ${nameOf(state, res.victim)}`;
        const who = res.bounced ? res.victim : h.attack;
        if (res.saved === 'monk') line += ` — ${gen(who, 'salvat', 'salvată')} de binecuvântarea Preotului`;
        else if (res.saved === 'soldier') line += ` — Haiducul nu poate fi ucis`;
        lines.push(line);
      }
      for (const [, pair] of Object.entries(h.fortune ?? {})) if (pair) lines.push(`🔮 Ghicitoarea i-a cercetat pe ${pair.map((id) => nameOf(state, id)).join(' și ')}`);
      lines.push(h.deaths.length ? `💀 Au murit: ${h.deaths.map((id) => nameOf(state, id)).join(', ')}` : '🌙 Nu a murit nimeni');
      out.push({ title: `🌑 Noaptea ${h.night}`, lines });
    } else if (h.type === 'day') {
      const lines = h.nominations.map((n) => `${nameOf(state, n.by)} → ${nameOf(state, n.target)}: ${n.count}/${n.threshold} voturi`);
      lines.push(h.executed ? `⚰️ ${gen(h.executed, 'Executat', 'Executată')}: ${nameOf(state, h.executed)} (${ROLES[state.roles[h.executed]].name})` : 'Nimeni nu a fost executat');
      out.push({ title: `☀️ Ziua ${h.day}`, lines });
    } else if (h.type === 'slay') {
      out.push({ title: `🗡️ Țărușul (ziua ${h.day})`, lines: [`${nameOf(state, h.by)} → ${nameOf(state, h.target)}: ${h.hit ? 'Contele a murit!' : 'nimic nu s-a întâmplat'}`] });
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
  const evil = (id) => teamOf(state.roles[id]) === 'evil';
  const firstDeath = (state.history ?? []).map((h) => (h.type === 'night' ? h.deaths?.[0] : h.type === 'day' ? h.executed : null)).find(Boolean);
  if (firstDeath) add('🍀', 'Ghinionistul', [firstDeath], 'primul care a părăsit castelul');

  const innocent = {};
  const justice = {};
  const accuser = {};
  for (const h of state.history ?? []) {
    if (h.type !== 'day') continue;
    for (const n of h.nominations) {
      accuser[n.by] = (accuser[n.by] ?? 0) + 1;
      for (const v of n.yes) {
        if (evil(n.target)) justice[v] = (justice[v] ?? 0) + 1;
        else innocent[v] = (innocent[v] ?? 0) + 1;
      }
    }
  }
  add('😱', 'Paranoicul', best(innocent), 'cele mai multe voturi date nevinovaților');
  add('⚖️', 'Justițiarul', best(justice), 'cele mai multe voturi date răilor');
  add('☝️', 'Acuzatorul', best(accuser), 'cele mai multe nominalizări');

  const eagle = {};
  for (const h of state.history ?? []) {
    if (h.type !== 'night') continue;
    for (const [p, b] of Object.entries(h.bets ?? {})) if (state.roles[b] === 'demon' || b === demonId(state)) eagle[p] = (eagle[p] ?? 0) + 1;
  }
  add('🦅', 'Ochiul de vultur', best(eagle), 'a ghicit Contele de cele mai multe ori');

  const lasted = {};
  for (const p of state.players.filter((x) => evil(x.id))) {
    const idx = (state.history ?? []).findIndex((h) => h.deaths?.includes(p.id) || h.executed === p.id || (h.type === 'slay' && h.hit && h.target === p.id));
    lasted[p.id] = idx === -1 ? 999 : idx;
  }
  add('🎭', 'Actorul', best(lasted), 'răul care a rezistat cel mai mult');
  return titles;
}

export function betLeaderboard(state) {
  const score = Object.fromEntries(state.players.map((p) => [p.id, 0]));
  for (const h of state.history ?? []) {
    if (h.type !== 'night') continue;
    for (const [p, b] of Object.entries(h.bets ?? {})) if (state.roles[b] === 'demon' && p in score) score[p] += 1;
  }
  return state.players.map((p) => ({ name: p.name, correct: score[p.id] })).sort((a, b) => b.correct - a.correct);
}
