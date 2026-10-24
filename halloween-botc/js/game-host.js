// Gazda jocului: rulează în pagina Proiector, pe MacBook, logată ca motor. Ține locul naratorului:
// citește alegerile secrete, aplică regulile din engine.js și scrie rezultatele.
// Proiectorul și panoul citesc doar /public; fiecare telefon își citește doar /private/<nume>.
import {
  PLAYERS, ROLES, TYPES, DISTRIBUTION, MIN_PLAYERS, MAX_PLAYERS, ROLE_KEYS, newGame, initialKnowledge, resolveNight, resolveRaven,
  startDay, nominate, nominationError, tallyNomination, endDay, slay, nextNight, nightAction, validTargets,
  believedRole, voteThreshold, checkWinner, shuffle, buildReplay, computeTitles, betLeaderboard, teamOf, grimoire,
} from './engine.js';
import { setVoteHandler, setEngineActive } from './pin-service.js';
import {
  r, get, set, update, remove, push, onValue, onChildAdded, serverNow,
} from './fb.js';

let state = null;   // starea secretă a jocului (roluri, otravă, istoric)
let host = {};      // date de lucru: nominalizarea curentă, intrările deja procesate
let pub = {};       // copie a /public
let nightTimer = null;
let dayTimer = null;
let botDayTimer = null;
let stopActions = null;
let busy = Promise.resolve();

const nameOf = (id) => PLAYERS.find((p) => p.id === id)?.name ?? id;
const GP = () => state?.players ?? PLAYERS;
const aliveIds = () => GP().filter((p) => state.alive[p.id]).map((p) => p.id);
const names = (ids) => (ids ?? []).map((id) => ({ id, name: nameOf(id) }));

// Un singur motor are voie să lucreze. Ultimul proiector deschis preia controlul.
const ENGINE_ID = Math.random().toString(36).slice(2, 10);
let active = true;
setEngineActive(() => active);
const serial = (fn) => (...args) => (busy = busy.then(() => fn(...args)).catch((e) => console.error('motor', e)));

// Firebase nu păstrează null-urile și listele goale; refacem forma așteptată.
function revive(s) {
  if (!s) return null;
  s.players = Object.values(s.players ?? {});
  s.history = Object.values(s.history ?? {}).map((h) => ({
    ...h,
    deaths: Object.values(h.deaths ?? {}),
    nominations: Object.values(h.nominations ?? {}).map((n) => ({ ...n, yes: Object.values(n.yes ?? {}) })),
  }));
  s.bluffs = Object.values(s.bluffs ?? {});
  for (const k of ['believed', 'ghostVote', 'slayerUsed', 'alive']) s[k] = s[k] ?? {};
  for (const k of ['poisoned', 'lastExecuted', 'pendingRaven', 'winner', 'redHerring']) s[k] = s[k] ?? null;
  if (s.today) {
    s.today = {
      nominators: {}, nominees: {}, block: null, executed: null, ...s.today,
      nominations: Object.values(s.today.nominations ?? {}).map((n) => ({ ...n, yes: Object.values(n.yes ?? {}) })),
    };
  } else s.today = null;
  return s;
}

async function save() {
  if (!active) return;
  await set(r('secret/state'), state);
  await set(r('secret/host'), host);
}

const setPublic = (patch) => update(r('public'), patch);
const isBot = (id) => Boolean(pub.players?.[id]?.bot);
const inLineup = (id) => pub.lineup?.players?.[id] !== false;
const clamp = (v, lo, hi, def) => (Number.isFinite(+v) ? Math.min(hi, Math.max(lo, Math.round(+v))) : def);

// ---------- pornire ----------

export async function startHost({ onPassive = () => {} } = {}) {
  await set(r('secret/engineOwner'), ENGINE_ID);
  await set(r('public/engineInfo'), { id: ENGINE_ID, device: navigator.userAgent.match(/\(([^)]+)\)/)?.[1] ?? 'necunoscut', since: serverNow() });
  onValue(r('secret/engineOwner'), (snap) => {
    if (snap.val() && snap.val() !== ENGINE_ID && active) {
      active = false;
      clearTimeout(nightTimer); clearTimeout(dayTimer); clearInterval(botDayTimer);
      stopActions?.();
      onPassive();
    }
  });
  state = revive((await get(r('secret/state'))).val());
  host = (await get(r('secret/host'))).val() ?? {};
  host.seen ??= {};
  onValue(r('public'), (snap) => { pub = snap.val() ?? {}; });
  pub = (await get(r('public'))).val() ?? {};
  if (!pub.phase) await setPublic({ phase: 'lobby', settings: pub.settings ?? { nightSeconds: 90, defenseSeconds: 60, voteSeconds: 20 } });

  onChildAdded(r('commands'), (snap) => {
    if (!active) return;
    const cmd = snap.val();
    remove(r(`commands/${snap.key}`));
    run(cmd);
  });
  // Tot ce trimit telefoanele ziua: nominalizări, voturi, țărușul, alegerea Corbierului.
  onValue(r('playerInput'), (snap) => run({ type: 'inputs', inputs: snap.val() ?? {} }));

  // După o reîncărcare a proiectorului, reluăm de unde era.
  if (pub.phase === 'night' && state) watchNight();
  if (pub.phase === 'day' && state) resumeDay();
}

const run = serial(async (cmd) => {
  if (!active) return;
  const handlers = {
    fillBots, clearBots, start, firstNight, endNight, beginDay, startVoting, cancelNomination, endDayCmd,
    toNight, endStage, reset, settings, lineup, leave, inputs, closeVoting, finishReveal, botDayTick,
    adminRevive, adminKill, adminRestartNight,
  };
  await handlers[cmd?.type]?.(cmd);
});

// Votul pe iPad nu mai există în varianta asta (se votează pe telefoane, public).
setVoteHandler(async () => ({ ok: false, error: 'În acest joc se votează pe telefon.' }));

// ---------- lobby ----------

async function fillBots() {
  const patch = {};
  for (const [id, p] of Object.entries(pub.players ?? {})) if (!p.hasPin && inLineup(id)) patch[`players/${id}/bot`] = true;
  await update(r('public'), patch);
}

async function clearBots() {
  if (pub.phase !== 'lobby') return;
  const patch = {};
  for (const id of Object.keys(pub.players ?? {})) patch[`players/${id}/bot`] = null;
  await update(r('public'), patch);
}

async function lineup(cmd) {
  if (pub.phase !== 'lobby') return;
  const players = Object.fromEntries(PLAYERS.map((p) => [p.id, cmd.players?.[p.id] !== false]));
  const patch = { lineup: { players } };
  for (const p of PLAYERS) if (!players[p.id]) patch[`players/${p.id}/bot`] = null;
  await update(r('public'), patch);
}

async function settings(cmd) {
  if (pub.phase !== 'lobby') return;
  const s = cmd.settings ?? {};
  await setPublic({
    settings: {
      nightSeconds: clamp(s.nightSeconds, 20, 600, 90),
      defenseSeconds: clamp(s.defenseSeconds, 10, 600, 60),
      voteSeconds: clamp(s.voteSeconds, 8, 120, 20),
    },
  });
}

// Lista personajelor posibile, grupate pe tipuri (o văd toți; nu spune care sunt în joc).
const scriptList = () => Object.fromEntries(Object.keys(TYPES).map((t) => [t, ROLE_KEYS.filter((k) => ROLES[k].type === t)]));

// ---------- începutul jocului ----------

async function start() {
  if (pub.phase !== 'lobby') return;
  const chosen = PLAYERS.filter((p) => inLineup(p.id));
  const missing = chosen.filter((p) => !pub.players?.[p.id]?.hasPin && !pub.players?.[p.id]?.bot);
  if (missing.length || chosen.length < MIN_PLAYERS || chosen.length > MAX_PLAYERS) return;

  state = newGame(chosen, pub.settings ?? {});
  host = { seen: {} };
  const knowledge = initialKnowledge(state);
  const patch = {};
  for (const p of PLAYERS) if (!inLineup(p.id)) patch[`private/${p.id}`] = { name: p.name, sitOut: true };
  for (const p of chosen) {
    const role = believedRole(state, p.id);
    patch[`private/${p.id}`] = {
      name: p.name,
      role,
      roleName: ROLES[role].name,
      emoji: ROLES[role].emoji,
      type: ROLES[role].type,
      team: teamOf(role),
      card: ROLES[role].card,
      status: { alive: true },
      inbox: Object.fromEntries((knowledge[p.id] ?? []).map((m, i) => [`k${i}`, { night: 0, text: m.text, kind: m.kind }])),
    };
  }
  const [tf, os, mn, dm] = DISTRIBUTION[chosen.length];
  Object.assign(patch, {
    actions: null,
    playerInput: null,
    'public/phase': 'intro',
    'public/gameId': Date.now().toString(36),
    'public/round': 1,
    'public/counts': { townsfolk: tf, outsider: os, minion: mn, demon: dm },
    'public/script': scriptList(),
    'public/alive': state.alive,
    'public/ghostVote': null,
    'public/seats': chosen.map((p) => p.id),
    'public/morning': null,
    'public/day': null,
    'public/execution': null,
    'public/winner': null,
    'public/endsAt': null,
    'public/final': null,
    'public/endStage': null,
    'public/slay': null,
  });
  await update(r(), patch);
  await save();
}

// ---------- noaptea ----------

async function firstNight() {
  if (!state || pub.phase !== 'intro') return;
  await openNight();
}

async function toNight() {
  if (!state || pub.phase !== 'execution') return;
  if (state.winner) return setPublic({ phase: 'end' });
  state = nextNight(state);
  await openNight();
}

async function openNight({ restart = false } = {}) {
  const patch = {};
  const everyone = GP().map((p) => ({ id: p.id, name: p.name }));
  for (const p of GP()) {
    const spec = nightAction(state, p.id);
    const allowed = validTargets(state, p.id);
    const info = state.alive[p.id] && ROLES[believedRole(state, p.id)][state.night === 1 ? 'night1' : 'nights']?.info;
    patch[`private/${p.id}/night`] = {
      night: state.night,
      seq: (pub.nightSeq ?? 0) + 1,
      pick: spec?.pick ?? 0,
      prompt: spec?.prompt ?? null,
      targets: spec ? everyone.filter((t) => allowed.includes(t.id)) : null,
      info: Boolean(info),
      ghost: !state.alive[p.id],
      bets: everyone.filter((t) => t.id !== p.id && state.alive[t.id]),
    };
  }
  const endsAt = serverNow() + (state.settings.nightSeconds ?? 90) * 1000;
  Object.assign(patch, {
    'public/phase': 'night',
    'public/round': state.night,
    'public/nightSeq': (pub.nightSeq ?? 0) + 1,
    'public/endsAt': endsAt,
    'public/progress': { done: 0, total: GP().length },
    'public/morning': null,
    'public/execution': null,
    'public/day': null,
  });
  if (restart) patch[`actions/${state.night}`] = null;
  await update(r(), patch);
  await save();
  for (const p of GP().filter((x) => isBot(x.id))) {
    setTimeout(() => botNight(p.id, state.night), 2500 + Math.random() * Math.min(15000, (state.settings.nightSeconds ?? 90) * 300));
  }
  watchNight(endsAt);
}

function botChoice(id) {
  const spec = nightAction(state, id);
  const targets = spec ? shuffle(validTargets(state, id)).slice(0, spec.pick) : null;
  const bet = shuffle(aliveIds().filter((x) => x !== id))[0] ?? null;
  return { targets, bet, done: true, at: Date.now() };
}

async function botNight(id, night) {
  if (pub.phase !== 'night' || state.night !== night) return;
  const existing = (await get(r(`actions/${night}/${id}`))).val();
  if (existing?.done) return;
  await set(r(`actions/${night}/${id}`), botChoice(id));
}

function watchNight(endsAt = pub.endsAt) {
  stopActions?.();
  clearTimeout(nightTimer);
  const night = state.night;
  get(r(`actions/${night}`)).then((snap) => {
    const acted = snap.val() ?? {};
    for (const p of GP().filter((x) => isBot(x.id) && !acted[x.id]?.done)) setTimeout(() => botNight(p.id, night), 2000 + Math.random() * 6000);
  });
  stopActions = onValue(r(`actions/${night}`), serial(async (snap) => {
    if (pub.phase !== 'night' || state.night !== night) return;
    const actions = snap.val() ?? {};
    const done = GP().filter((p) => actions[p.id]?.done).length;
    await setPublic({ progress: { done, total: GP().length } });
    if (done >= GP().length) setTimeout(() => run({ type: 'endNight', night }), 2500);
  }));
  nightTimer = setTimeout(() => run({ type: 'endNight', night }), Math.max(0, (endsAt ?? serverNow()) - serverNow()) + 500);
}

async function endNight(cmd = {}) {
  if (pub.phase !== 'night' || !state) return;
  if (cmd.night && cmd.night !== state.night) return;
  stopActions?.(); stopActions = null;
  clearTimeout(nightTimer);
  const night = state.night;
  const raw = (await get(r(`actions/${night}`))).val() ?? {};
  // Siguranță: roboții care n-au apucat să aleagă aleg acum.
  for (const p of GP().filter((x) => isBot(x.id) && !raw[x.id]?.done)) raw[p.id] = botChoice(p.id);
  const actions = Object.fromEntries(Object.entries(raw).map(([id, a]) => [id, { targets: Object.values(a.targets ?? {}), bet: a.bet ?? null }]));
  const { state: next, report } = resolveNight(state, actions);
  state = next;

  const patch = {};
  for (const p of GP()) {
    patch[`private/${p.id}/night`] = null;
    patch[`private/${p.id}/status`] = { alive: state.alive[p.id], ghostVote: Boolean(state.ghostVote[p.id]) };
  }
  let n = 0;
  const keyBase = Date.now();
  for (const [id, msgs] of Object.entries(report.private)) {
    for (const m of msgs) patch[`private/${id}/inbox/n${keyBase}_${n++}`] = { night, text: m.text, kind: m.kind };
  }
  if (state.pendingRaven) patch[`private/${state.pendingRaven.id}/raven`] = { night, targets: names(GP().map((p) => p.id).filter((id) => id !== state.pendingRaven.id)) };
  Object.assign(patch, {
    'public/phase': state.winner ? 'end' : 'morning',
    'public/alive': state.alive,
    'public/ghostVote': state.ghostVote,
    'public/endsAt': null,
    'public/progress': null,
    'public/winner': state.winner,
    'public/morning': { night, deaths: report.deaths.map((d) => ({ id: d.id, name: nameOf(d.id) })) },
  });
  if (state.winner) Object.assign(patch, finalPatch());
  await update(r(), patch);
  await save();
  const raven = state.pendingRaven?.id;
  if (raven && isBot(raven)) {
    const target = shuffle(aliveIds())[0];
    setTimeout(() => set(r(`playerInput/${raven}/raven`), { night, target, at: Date.now() }), 3000);
  }
}

// ---------- ziua ----------

function publicDay(extra = {}) {
  const t = state.today;
  const block = t?.block;
  return {
    day: t?.day ?? state.night,
    threshold: voteThreshold(state),
    block: block ? { id: block.id, name: block.id ? nameOf(block.id) : null, votes: block.votes } : null,
    nominations: (t?.nominations ?? []).map((nm) => ({
      byName: nameOf(nm.by), targetName: nameOf(nm.target), count: nm.count, threshold: nm.threshold, result: nm.result,
    })),
    nominated: Object.keys(t?.nominees ?? {}),
    nominators: Object.keys(t?.nominators ?? {}),
    current: host.current ? publicCurrent() : null,
    ...extra,
  };
}

function publicCurrent() {
  const c = host.current;
  const base = { key: c.key, by: c.by, target: c.target, byName: nameOf(c.by), targetName: nameOf(c.target), stage: c.stage, endsAt: c.endsAt ?? null };
  if (c.stage === 'voting') base.voted = Object.keys(c.votes ?? {}).length;
  if (c.stage === 'reveal') base.reveal = c.reveal;
  return base;
}

async function beginDay() {
  if (!state || pub.phase !== 'morning') return;
  state = startDay(state);
  host.current = null;
  await update(r(), { 'public/phase': 'day', 'public/day': publicDay(), 'public/endsAt': null, 'public/slay': null });
  await save();
  startBotDay();
}

function resumeDay() {
  if (!host.current) return startBotDay();
  const c = host.current;
  if (c.stage === 'defense') armDay(c.endsAt, 'startVoting');
  else if (c.stage === 'voting') { armDay(c.endsAt, 'closeVoting'); botVotes(); }
  else if (c.stage === 'reveal') armDay(c.endsAt, 'finishReveal');
  startBotDay();
}

function armDay(endsAt, type) {
  clearTimeout(dayTimer);
  const key = host.current?.key;
  dayTimer = setTimeout(() => run({ type, key }), Math.max(0, endsAt - serverNow()) + 300);
}

// Roboții nominalizează din când în când, ca jocul să meargă și la teste cu puțini oameni.
function startBotDay() {
  clearInterval(botDayTimer);
  botDayTimer = setInterval(() => run({ type: 'botDayTick' }), 12000);
}

async function botDayTick() {
  if (pub.phase !== 'day' || !state?.today || host.current) return;
  if (state.today.nominations.length >= 3 || Math.random() < 0.5) return;
  const bots = shuffle(aliveIds().filter((id) => isBot(id) && !state.today.nominators[id]));
  const by = bots[0];
  const target = shuffle(GP().map((p) => p.id).filter((id) => !state.today.nominees[id] && id !== by))[0];
  if (by && target) await set(r(`playerInput/${by}/nominate`), { target, day: state.today.day, at: Date.now() });
}

// Procesează intrările noi de pe telefoane (fiecare tip o singură dată, după momentul trimiterii).
async function inputs(cmd) {
  if (!state) return;
  for (const [id, inp] of Object.entries(cmd.inputs ?? {})) {
    for (const kind of ['raven', 'nominate', 'slay', 'vote']) {
      const v = inp?.[kind];
      if (!v?.at) continue;
      const seenKey = `${id}_${kind}`;
      if ((host.seen[seenKey] ?? 0) >= v.at) continue;
      host.seen[seenKey] = v.at;
      if (kind === 'raven') await onRaven(id, v);
      if (kind === 'nominate') await onNominate(id, v);
      if (kind === 'slay') await onSlay(id, v);
      if (kind === 'vote') await onVote(id, v);
    }
  }
}

async function onRaven(id, v) {
  if (!state.pendingRaven || state.pendingRaven.id !== id) return;
  const { state: next, message } = resolveRaven(state, v.target);
  state = next;
  const patch = { [`private/${id}/raven`]: null };
  if (message) patch[`private/${id}/inbox/r${Date.now()}`] = { night: state.night, text: message.text, kind: 'info' };
  await update(r(), patch);
  await save();
}

async function onNominate(by, v) {
  if (pub.phase !== 'day' || !state.today || host.current) return;
  if (v.day !== state.today.day) return;
  if (nominationError(state, by, v.target)) return;
  state = nominate(state, by, v.target);
  const endsAt = serverNow() + (state.settings.defenseSeconds ?? 60) * 1000;
  host.current = { key: `${state.today.day}_${state.today.nominations.length}`, by, target: v.target, stage: 'defense', endsAt, votes: {} };
  await setPublic({ day: publicDay() });
  await save();
  armDay(endsAt, 'startVoting');
}

async function startVoting(cmd = {}) {
  const c = host.current;
  if (pub.phase !== 'day' || !c || c.stage !== 'defense' || (cmd.key && cmd.key !== c.key)) return;
  c.stage = 'voting';
  c.endsAt = serverNow() + (state.settings.voteSeconds ?? 20) * 1000;
  c.votes = {};
  await setPublic({ day: publicDay() });
  await save();
  armDay(c.endsAt, 'closeVoting');
  botVotes();
}

// Cine poate vota acum: cei vii și morții care încă au votul de fantomă.
const canVote = (id) => state.alive[id] || state.ghostVote[id];

function botVotes() {
  const c = host.current;
  for (const id of GP().map((p) => p.id).filter((x) => isBot(x) && canVote(x))) {
    const yes = state.alive[id] ? Math.random() < 0.45 : Math.random() < 0.2;
    setTimeout(() => set(r(`playerInput/${id}/vote`), { key: c.key, yes, at: Date.now() }), 1000 + Math.random() * 6000);
  }
}

async function onVote(id, v) {
  const c = host.current;
  if (pub.phase !== 'day' || !c || c.stage !== 'voting' || v.key !== c.key || !canVote(id)) return;
  c.votes[id] = Boolean(v.yes);
  await setPublic({ 'day/current/voted': Object.keys(c.votes).length });
  // Au votat toți: închidem mai devreme.
  if (GP().every((p) => !canVote(p.id) || p.id in c.votes)) setTimeout(() => run({ type: 'closeVoting', key: c.key }), 800);
}

async function closeVoting(cmd = {}) {
  const c = host.current;
  if (pub.phase !== 'day' || !c || c.stage !== 'voting' || (cmd.key && cmd.key !== c.key)) return;
  clearTimeout(dayTimer);
  const votes = Object.fromEntries(Object.entries(c.votes).filter(([, yes]) => yes));
  const before = { alive: { ...state.alive }, ghost: { ...state.ghostVote } };
  const { state: next, entry } = tallyNomination(state, c.by, c.target, votes);
  state = next;
  // Votul se dezvăluie pe rând, în ordinea mesei, începând cu cel de după nominalizat (ca la BotC).
  const seats = GP().map((p) => p.id);
  const start = seats.indexOf(c.target);
  const order = [...seats.slice(start + 1), ...seats.slice(0, start + 1)];
  c.stage = 'reveal';
  c.reveal = {
    items: order.map((id) => ({
      id, name: nameOf(id), dead: !before.alive[id], canVote: before.alive[id] || Boolean(before.ghost[id]), yes: entry.yes.includes(id),
    })),
    count: entry.count, threshold: entry.threshold, result: entry.result,
  };
  c.endsAt = serverNow() + (order.length * 650 + 6000);
  await update(r(), { 'public/day': publicDay(), 'public/ghostVote': state.ghostVote });
  await save();
  armDay(c.endsAt, 'finishReveal');
}

async function finishReveal(cmd = {}) {
  const c = host.current;
  if (!c || c.stage !== 'reveal' || (cmd.key && cmd.key !== c.key)) return;
  host.current = null;
  await setPublic({ day: publicDay() });
  await save();
}

async function cancelNomination() {
  const c = host.current;
  if (pub.phase !== 'day' || !c || c.stage === 'reveal') return;
  clearTimeout(dayTimer);
  // Nominalizarea anulată nu consumă dreptul nimănui.
  delete state.today.nominators[c.by];
  delete state.today.nominees[c.target];
  host.current = null;
  await setPublic({ day: publicDay() });
  await save();
}

async function onSlay(by, v) {
  if (pub.phase !== 'day' || !state.today || state.slayerUsed[by] || !state.alive[by]) return;
  if (!state.players.some((p) => p.id === v.target)) return;
  const { state: next, report } = slay(state, by, v.target);
  state = next;
  const patch = {
    'public/slay': { byName: nameOf(by), targetName: nameOf(v.target), hit: report.hit, at: serverNow() },
    'public/alive': state.alive,
    'public/ghostVote': state.ghostVote,
    [`private/${by}/slayUsed`]: true,
  };
  if (report.hit) patch[`private/${v.target}/status/alive`] = false;
  if (report.newDemon) await tellNewDemon(report.newDemon, patch);
  if (state.winner) {
    clearTimeout(dayTimer); clearInterval(botDayTimer);
    host.current = null;
    Object.assign(patch, { 'public/phase': 'end', 'public/winner': state.winner, 'public/day': null }, finalPatch());
  }
  await update(r(), patch);
  await save();
}

// Mireasa devine Conte: află pe telefon (ceilalți nu află nimic).
async function tellNewDemon(id, patch) {
  const demon = ROLES.demon;
  Object.assign(patch, {
    [`private/${id}/role`]: 'demon',
    [`private/${id}/roleName`]: demon.name,
    [`private/${id}/emoji`]: demon.emoji,
    [`private/${id}/type`]: 'demon',
    [`private/${id}/card`]: demon.card,
    [`private/${id}/inbox/demon${Date.now()}`]: { night: state.night, kind: 'info', text: '🧛 Contele a murit, iar tu i-ai luat locul. De acum ești Contele: în fiecare noapte muști pe cineva.' },
  });
}

async function endDayCmd() {
  if (!state || pub.phase !== 'day' || !state.today) return;
  if (host.current && host.current.stage !== 'reveal') return;
  clearTimeout(dayTimer); clearInterval(botDayTimer);
  host.current = null;
  const { state: next, report } = endDay(state);
  state = next;
  const patch = {
    // După execuție vine ceremonia; dacă jocul s-a terminat fără execuție (Primarul), direct finalul.
    'public/phase': state.winner && !report.executed ? 'end' : 'execution',
    'public/alive': state.alive,
    'public/ghostVote': state.ghostVote,
    'public/day': null,
    'public/execution': {
      name: report.executed ? nameOf(report.executed) : null,
      saint: report.saint,
      mayorWin: report.mayorWin,
    },
    'public/winner': state.winner,
  };
  if (report.executed) patch[`private/${report.executed}/status`] = { alive: false, ghostVote: true };
  if (report.newDemon) await tellNewDemon(report.newDemon, patch);
  if (state.winner) Object.assign(patch, finalPatch());
  await update(r(), patch);
  await save();
}

// ---------- finalul ----------

function finalPatch() {
  return {
    'public/endStage': 'winner',
    'public/final': {
      roles: GP().map((p) => {
        const role = state.roles[p.id];
        const drunkAs = role === 'drunk' ? ROLES[state.believed[p.id]]?.name : null;
        return { name: p.name, roleName: ROLES[role].name, emoji: ROLES[role].emoji, evil: teamOf(role) === 'evil', alive: Boolean(state.alive[p.id]), drunkAs };
      }),
      replay: buildReplay(state),
      titles: computeTitles(state),
      bets: betLeaderboard(state),
    },
  };
}

async function endStage(cmd) {
  if (pub.phase !== 'end' || !['winner', 'roles', 'replay', 'titles'].includes(cmd.stage)) return;
  await setPublic({ endStage: cmd.stage });
}

// ---------- urgențe ----------

async function setAliveAndCheck(id, alive, extra = {}) {
  if (!state || !(id in state.alive)) return;
  state.alive[id] = alive;
  if (alive) delete state.ghostVote[id]; else state.ghostVote[id] = state.ghostVote[id] ?? true;
  state.winner = alive ? null : checkWinner(state);
  const patch = {
    [`private/${id}/status`]: { alive, ghostVote: Boolean(state.ghostVote[id]) },
    'public/alive': state.alive,
    'public/ghostVote': state.ghostVote,
    ...extra,
  };
  if (state.winner) Object.assign(patch, { 'public/phase': 'end', 'public/winner': state.winner, 'public/endsAt': null }, finalPatch());
  await update(r(), patch);
  await save();
}

// Din panoul de comandă: cine pleacă de la petrecere devine fantomă fără vot (rolul rămâne secret).
async function leave(cmd) {
  if (!state || !state.alive[cmd.id] || pub.phase === 'end') return;
  state.ghostVote[cmd.id] = false;
  await setAliveAndCheck(cmd.id, false, { 'public/notice': { text: `🚪 ${nameOf(cmd.id)} a părăsit castelul.`, at: serverNow() } });
}

async function adminRevive(cmd) { await setAliveAndCheck(cmd.id, true); }
async function adminKill(cmd) { if (state?.alive[cmd.id]) await setAliveAndCheck(cmd.id, false); }

async function adminRestartNight() {
  if (pub.phase !== 'night' || !state) return;
  stopActions?.(); stopActions = null;
  clearTimeout(nightTimer);
  await openNight({ restart: true });
}

// Grimoarul complet pentru panoul de urgență.
export const grimoireLines = () => (state ? grimoire(state) : []);

// ---------- joc nou ----------

async function reset() {
  stopActions?.(); stopActions = null;
  clearTimeout(nightTimer); clearTimeout(dayTimer); clearInterval(botDayTimer);
  state = null;
  host = { seen: {} };
  const patch = {
    'secret/state': null,
    'secret/host': null,
    actions: null,
    playerInput: null,
  };
  for (const k of ['round', 'gameId', 'alive', 'ghostVote', 'seats', 'counts', 'script', 'morning', 'day', 'execution', 'winner', 'endsAt',
    'progress', 'final', 'endStage', 'nightSeq', 'notice', 'slay']) patch[`public/${k}`] = null;
  patch['public/phase'] = 'lobby';
  for (const p of PLAYERS) patch[`private/${p.id}`] = { name: p.name };
  await update(r(), patch);
}

// Panoul trimite comenzi prin această funcție.
export const sendCommand = (type, extra = {}) => push(r('commands'), { type, ...extra, at: Date.now() });
