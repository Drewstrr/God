// Roboții care completează masa la teste: joacă „ca oamenii”.
// Cei buni țin minte ce au aflat (Ghicitoarea, Sfetnicul, Groparul…) și bănuiesc, votează și pariază după asta.
// Cei răi se cunosc între ei: nu se mușcă, nu se otrăvesc, nu se nominalizează și nu votează unul împotriva altuia.

import { ROLES, teamOf, believedRole, validTargets, nightAction } from './engine.js';

const rand = (list) => list[Math.floor(Math.random() * list.length)];

// Mintea unui robot: cât de mult bănuiește pe fiecare (pozitiv = suspect, negativ = de încredere).
export const newMind = () => ({ sus: {} });

// Răii pe care îi cunoaște robotul (el inclus). Cei buni nu cunosc pe nimeni: null.
function evilFriends(state, id) {
  if (teamOf(state.roles[id]) !== 'evil') return null;
  return new Set(state.players.map((p) => p.id).filter((x) => teamOf(state.roles[x]) === 'evil'));
}

const alive = (state) => state.players.map((p) => p.id).filter((x) => state.alive[x]);
const score = (mind, x) => (mind?.sus?.[x] ?? 0) + Math.random() * 0.3;  // un pic de zgomot, ca să nu fie mereu la fel
const bump = (mind, x, by) => { mind.sus[x] = (mind.sus[x] ?? 0) + by; };
// Ordonați de la cel mai suspect la cel mai de încredere.
const bySuspicion = (mind, list) => [...list].sort((a, b) => score(mind, b) - score(mind, a));

// Robotul „citește” ce i-a venit pe telefon (câmpul data din mesajele motorului).
// weight < 1: ce povestesc alții la masă (poate fi minciună), cântărește mai puțin decât ce afli tu.
export function learn(mind, self, msg, weight = 1) {
  const d = msg?.data;
  if (!d) return;
  const others = (ids) => (ids ?? []).filter((x) => x !== self);
  const add = (x, by) => bump(mind, x, by * weight);
  if (d.type === 'pair') {
    const t = ROLES[d.role]?.type;
    for (const x of others(d.ids)) add(x, t === 'minion' ? 1.6 : t === 'townsfolk' ? -0.8 : 0.3);
  }
  if (d.type === 'fortune') for (const x of others(d.ids)) add(x, d.yes ? 2.5 : -3);
  if (d.type === 'role' && d.id !== self) add(d.id, teamOf(d.role) === 'evil' ? 6 : -3);
}

// Ca oamenii, roboții își spun informațiile la masă: ceilalți roboți le aud (cu greutate mai mică).
// Răii „povestesc” și ei, dar inventează: arată spre un jucător bun.
export function claimsFor(state, id, msgs) {
  if (teamOf(state.roles[id]) !== 'evil') return msgs.filter((m) => m?.data);
  if (Math.random() < 0.5) return [];
  const evil = evilFriends(state, id);
  const good = alive(state).filter((x) => !evil.has(x));
  if (!good.length) return [];
  const victim = rand(good);
  const other = rand(alive(state).filter((x) => x !== victim && x !== id)) ?? victim;
  return [Math.random() < 0.5
    ? { data: { type: 'fortune', ids: [victim, other], yes: true } }
    : { data: { type: 'pair', ids: [victim, other], role: 'poisoner' } }];
}
export function hear(minds, state, from, claims) {
  for (const [id, m] of Object.entries(minds)) if (id !== from && state.alive[id] !== undefined) for (const c of claims) learn(m, id, c, 0.5);
}

// Noaptea: ținta abilității și pariul.
export function nightChoice(state, id, mind) {
  const spec = nightAction(state, id);
  const valid = validTargets(state, id);
  const evil = evilFriends(state, id);
  const notFriends = (list) => (evil ? list.filter((x) => !evil.has(x)) : list);
  const living = alive(state);
  let targets = null;
  if (spec?.pick) {
    const role = believedRole(state, id);
    let pool;
    if (role === 'demon' || role === 'poisoner') pool = notFriends(valid.filter((x) => state.alive[x]));
    else if (role === 'monk') pool = [...valid].sort((a, b) => score(mind, a) - score(mind, b)).slice(0, 3);  // îi apără pe cei de încredere
    else if (role === 'fortune') pool = bySuspicion(mind, valid.filter((x) => state.alive[x] && x !== id)).slice(0, 4);
    else pool = valid;
    if (!pool.length) pool = valid;
    targets = [];
    const order = role === 'fortune' ? pool : [...pool].sort(() => Math.random() - 0.5);
    for (const x of order) if (targets.length < spec.pick && !targets.includes(x)) targets.push(x);
    // Ghicitoarea: perechea începe cu cel mai bănuit; al doilea e unul dintre următorii, la întâmplare.
    if (role === 'fortune' && pool.length > 2) targets = [pool[0], rand(pool.slice(1))];
  }
  const others = living.filter((x) => x !== id);
  // Răii pariază pe un jucător bun (camuflaj), cei buni pe cel mai bănuit.
  const bet = evil ? rand(notFriends(others)) ?? null : bySuspicion(mind, others)[0] ?? null;
  return { targets, bet };
}

// Ziua: pe cine nominalizează (sau null: nu nominalizează azi).
export function nominee(state, id, mind, allowed) {
  if (!allowed.length) return null;
  const evil = evilFriends(state, id);
  if (evil) {
    const good = allowed.filter((x) => !evil.has(x));
    return Math.random() < 0.6 ? rand(good) ?? null : null;
  }
  const top = bySuspicion(mind, allowed)[0];
  if (score(mind, top) >= 1.2) return top;
  return Math.random() < 0.25 ? rand(allowed.filter((x) => (mind.sus[x] ?? 0) > -1)) ?? null : null;
}

// Votul: DA sau NU pentru cel nominalizat. Fantomele își păstrează votul pentru când chiar contează.
export function vote(state, id, mind, target) {
  const ghost = !state.alive[id];
  const evil = evilFriends(state, id);
  // Răii nu-și votează Contele; pe un Slujitor coleg îl „sacrifică” rar, ca să pară buni.
  if (evil) return evil.has(target) ? state.roles[target] !== 'demon' && !ghost && Math.random() < 0.12 : Math.random() < (ghost ? 0.3 : 0.6);
  const s = mind?.sus?.[target] ?? 0;
  if (ghost) return s >= 3;
  if (s >= 0.8) return Math.random() < 0.9;
  if (s <= -1) return Math.random() < 0.05;
  return Math.random() < 0.3;
}

// Corbierul ucis noaptea: verifică pe cel mai bănuit.
export const ravenPick = (state, id, mind) => bySuspicion(mind, state.players.map((p) => p.id).filter((x) => x !== id))[0] ?? null;

// După fiecare vot, cei buni se uită cine a votat cum: cine apără un suspect sau acuză un om de încredere devine suspect.
export function sawVotes(minds, state, by, target, votes) {
  for (const [id, m] of Object.entries(minds)) {
    if (teamOf(state.roles[id]) === 'evil') continue;
    const opinion = m.sus[target] ?? 0;
    if (opinion <= -1 && by !== id) bump(m, by, 0.6);
    for (const [v, yes] of Object.entries(votes)) {
      if (v === id) continue;
      if (yes && opinion <= -1) bump(m, v, 0.4);
      if (!yes && opinion >= 1.5) bump(m, v, 0.4);
    }
  }
}

// Van Helsing (sau cine crede că e): înfige țărușul doar când e destul de sigur.
export function slayPick(state, id, mind) {
  if (believedRole(state, id) !== 'slayer' || state.slayerUsed?.[id] || !state.alive[id]) return null;
  const top = bySuspicion(mind, alive(state).filter((x) => x !== id))[0];
  return top && (mind.sus[top] ?? 0) >= 4 ? top : null;
}
