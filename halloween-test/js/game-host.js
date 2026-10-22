// Gazda jocului: rulează în pagina Proiector, pe MacBook, logată ca motor.
// Citește acțiunile secrete, aplică regulile din engine.js și scrie rezultatele.
// Nu afișează nimic: proiectorul și panoul citesc doar /public.
import {
  PLAYERS, ROLES, newGame, initialKnowledge, resolveNight, detectiveResult, validTargets,
  nightMode, nightPrompt, nextRound, shuffle, voteOutcome, applyElimination, applyNoElimination,
  sacrificeCandidate,
} from './engine.js';
import { setVoteHandler } from './pin-service.js';
import {
  r, get, set, update, remove, push, onValue, onChildAdded, serverNow,
} from './fb.js';

const BOT_HINTS = ['ceață', 'usturoi', 'sânge', 'liliac', 'umbră', 'cripta', 'clopot', 'lună'];

let state = null;   // starea secretă a motorului (roluri, istoric)
let host = {};      // date de lucru: roboți, bârfa, verificările Detectivului
let pub = {};       // copie a /public
let nightTimer = null;
let stopActions = null;
let busy = Promise.resolve();

const nameOf = (id) => PLAYERS.find((p) => p.id === id)?.name ?? id;
const serial = (fn) => (...args) => (busy = busy.then(() => fn(...args)).catch((e) => console.error('motor', e)));

// Firebase nu păstrează null-urile și transformă listele; refacem forma așteptată.
function revive(s) {
  if (!s) return null;
  s.history = Object.values(s.history ?? {});
  s.lastTargets = { hunter: null, hypnotist: null, ...(s.lastTargets ?? {}) };
  s.iron = { used: false, doomed: false, ...(s.iron ?? {}) };
  s.hypnotized = s.hypnotized ?? null;
  s.winner = s.winner ?? null;
  s.sacrificeUsed = Boolean(s.sacrificeUsed);
  return s;
}

async function save() {
  await set(r('secret/state'), state);
  await set(r('secret/host'), host);
}

const inbox = (id, round, text, kind = 'info') => push(r(`private/${id}/inbox`), { round, text, kind });

async function setPublic(patch) {
  await update(r('public'), patch);
}

// ---------- pornire ----------

export async function startHost() {
  state = revive((await get(r('secret/state'))).val());
  host = (await get(r('secret/host'))).val() ?? {};
  if (host.vote) host.vote = { votes: {}, candidates: null, outcome: null, ...host.vote };
  onValue(r('public'), (snap) => { pub = snap.val() ?? {}; });
  pub = (await get(r('public'))).val() ?? {};
  if (!pub.phase) await setPublic({ phase: 'lobby', settings: pub.settings ?? { sessions: 4, nightSeconds: 90, discussionSeconds: 300 } });

  onChildAdded(r('commands'), (snap) => {
    const cmd = snap.val();
    remove(r(`commands/${snap.key}`));
    run(cmd);
  });

  // După o reîncărcare a proiectorului în timpul nopții, reluăm noaptea de unde era.
  if (pub.phase === 'night' && state) watchNight();
  if (pub.phase === 'vote' && state) botVoteSoon();
  if (pub.phase === 'reveal' && host.vote?.outcome?.result === 'mayor-decides') askMayor();
  if (pub.phase === 'sacrifice' && host.sacrifice) armSacrifice(pub.endsAt ?? serverNow());
}

const run = serial(async (cmd) => {
  const handlers = {
    fillBots, clearBots, start, party, session, endNight, discussion, reset, settings,
    startVote, castVote, skipVoter, botVote, reveal, revote, mayorChoice, execute, finishElimination,
    continue: continueGame,
  };
  await handlers[cmd?.type]?.(cmd);
});

// ---------- roboți ----------

async function fillBots() {
  const players = pub.players ?? {};
  const patch = {};
  for (const [id, p] of Object.entries(players)) if (!p.hasPin) patch[`players/${id}/bot`] = true;
  await update(r('public'), patch);
}

async function clearBots() {
  if (pub.phase !== 'lobby') return;
  const patch = {};
  for (const id of Object.keys(pub.players ?? {})) patch[`players/${id}/bot`] = null;
  await update(r('public'), patch);
}

const isBot = (id) => Boolean(pub.players?.[id]?.bot);

// ---------- începutul jocului ----------

async function start() {
  if (pub.phase !== 'lobby') return;
  const missing = Object.values(pub.players ?? {}).filter((p) => !p.hasPin && !p.bot);
  if (missing.length) return;

  state = newGame(PLAYERS, pub.settings ?? {});
  host = {};
  const knowledge = initialKnowledge(state);

  const patch = {};
  for (const p of PLAYERS) {
    const role = ROLES[state.roles[p.id]];
    patch[`private/${p.id}`] = {
      name: p.name,
      role: state.roles[p.id],
      roleName: role.name,
      emoji: role.emoji,
      team: role.team,
      card: role.card,
      status: { alive: true },
      inbox: Object.fromEntries((knowledge[p.id] ?? []).map((m, i) => [`k${i}`, { round: 0, text: m.text, kind: m.kind }])),
    };
  }
  patch.actions = null;
  patch.playerInput = null;
  patch['public/phase'] = 'intro';
  patch['public/gameId'] = Date.now().toString(36);
  patch['public/round'] = 1;
  patch['public/mayor'] = { id: state.mayor, name: nameOf(state.mayor) };
  patch['public/alive'] = state.alive;
  patch['public/morning'] = null;
  patch['public/winner'] = null;
  patch['public/endsAt'] = null;
  await update(r(), patch);
  await save();
}

// Introducerea s-a terminat: începe petrecerea până la prima ședință.
async function party() {
  if (!state || !['intro', 'discussion', 'morning'].includes(pub.phase)) return;
  await setPublic({ phase: 'day', endsAt: null, nextSessionAt: pub.nextSessionAt ?? null });
}

async function settings(cmd) {
  if (pub.phase !== 'lobby') return;
  const s = cmd.settings ?? {};
  await setPublic({
    settings: {
      sessions: clamp(s.sessions, 1, 8, 4),
      nightSeconds: clamp(s.nightSeconds, 20, 600, 90),
      discussionSeconds: clamp(s.discussionSeconds, 30, 1800, 300),
    },
  });
}

const clamp = (v, lo, hi, def) => (Number.isFinite(+v) ? Math.min(hi, Math.max(lo, Math.round(+v))) : def);

// ---------- noaptea ----------

async function session() {
  if (!state || state.winner || !['day', 'intro'].includes(pub.phase)) return;

  // Mesajul Bârfitoarei se fixează la începutul nopții.
  const gossipId = PLAYERS.find((p) => state.roles[p.id] === 'gossip').id;
  const gossip = state.alive[gossipId] ? (await get(r(`playerInput/${gossipId}/gossip`))).val() : null;
  host.gossip = gossip ? String(gossip).slice(0, 140) : null;
  // O Bârfitoare-robot șoptește și ea ceva, ca să se vadă mesajul pe proiector.
  if (!host.gossip && state.alive[gossipId] && isBot(gossipId)) host.gossip = botGossip(gossipId);
  host.detectiveDone = false;
  if (gossip) await remove(r(`playerInput/${gossipId}/gossip`));

  const alive = PLAYERS.filter((p) => state.alive[p.id]);
  const patch = {};
  for (const p of PLAYERS) {
    const mode = nightMode(state, p.id);
    patch[`private/${p.id}/night`] = {
      round: state.round,
      mode,
      prompt: nightPrompt(state, p.id),
      targets: mode === 'ghost' ? null : alive.filter((t) => t.id !== p.id).map((t) => ({ id: t.id, name: t.name })),
      allowed: mode === 'ghost' ? null : Object.fromEntries(validTargets(state, p.id).map((id) => [id, true])),
    };
  }
  const nightSeconds = state.settings.nightSeconds ?? 90;
  patch['public/phase'] = 'night';
  patch['public/round'] = state.round;
  const endsAt = serverNow() + nightSeconds * 1000;
  patch['public/endsAt'] = endsAt;
  patch['public/progress'] = { done: 0, total: PLAYERS.length };
  patch['public/morning'] = null;
  patch['public/nextSessionAt'] = null;
  await update(r(), patch);
  await save();

  // Roboții aleg după câteva secunde.
  for (const p of PLAYERS.filter((x) => isBot(x.id))) {
    const delay = 3000 + Math.random() * Math.min(20000, nightSeconds * 400);
    setTimeout(() => botAct(p.id, state.round), delay);
  }
  watchNight(endsAt);
}

function botGossip(self) {
  const others = PLAYERS.filter((p) => state.alive[p.id] && p.id !== self).map((p) => p.name);
  const a = shuffle(others)[0] ?? 'cineva';
  const b = shuffle(others.filter((n) => n !== a))[0] ?? 'altcineva';
  const lines = [
    `L-am văzut pe ${a} ascunzând usturoiul.`,
    `${a} și ${b} au șușotit toată seara.`,
    `Aveți grijă la ${a}. Nu are reflexie în oglindă.`,
    `${a} mi-a spus în secret că știe cine e vampirul.`,
    `${b} a ieșit din cameră exact când s-a stins lumina.`,
    `Eu aș avea încredere în ${a}. Deocamdată.`,
  ];
  return shuffle(lines)[0];
}

async function botAct(id, round) {
  if (pub.phase !== 'night' || state.round !== round) return;
  const mode = nightMode(state, id);
  if (mode === 'ghost') {
    const hint = Math.random() < 0.5 ? shuffle(BOT_HINTS)[0] : '';
    return set(r(`actions/${round}/${id}`), { hint, at: Date.now() });
  }
  const targets = validTargets(state, id);
  if (!targets.length) return;
  return set(r(`actions/${round}/${id}`), { target: shuffle(targets)[0], at: Date.now() });
}

function watchNight(endsAt = pub.endsAt) {
  stopActions?.();
  clearTimeout(nightTimer);
  const round = state.round;
  stopActions = onValue(r(`actions/${round}`), serial(async (snap) => {
    if (pub.phase !== 'night' || state.round !== round) return;
    const actions = snap.val() ?? {};

    // Detectivul primește rezultatul pe loc, o singură dată pe noapte.
    const det = PLAYERS.find((p) => state.roles[p.id] === 'detective').id;
    const check = actions[det]?.target;
    if (!host.detectiveDone && state.alive[det] && check && validTargets(state, det).includes(check)) {
      host.detectiveDone = true;
      const res = detectiveResult(state, check);
      await inbox(det, round, res.text, 'detective');
      await set(r('secret/host'), host);
    }

    const done = PLAYERS.filter((p) => actions[p.id]).length;
    await setPublic({ progress: { done, total: PLAYERS.length } });
    if (done >= PLAYERS.length) setTimeout(() => run({ type: 'endNight', round }), 2500);
  }));
  const left = Math.max(0, (endsAt ?? serverNow()) - serverNow());
  nightTimer = setTimeout(() => run({ type: 'endNight', round }), left + 500);
}

async function endNight(cmd = {}) {
  if (pub.phase !== 'night' || !state) return;
  if (cmd.round && cmd.round !== state.round) return;
  stopActions?.(); stopActions = null;
  clearTimeout(nightTimer);

  const round = state.round;
  const raw = (await get(r(`actions/${round}`))).val() ?? {};
  const actions = Object.fromEntries(Object.entries(raw).map(([id, a]) => [id, { target: a.target ?? null, hint: a.hint ?? null }]));
  const { state: next, report } = resolveNight(state, actions);
  state = next;

  const testaments = (await get(r('playerInput'))).val() ?? {};
  const patch = {};
  for (const p of PLAYERS) {
    patch[`private/${p.id}/night`] = null;
    patch[`private/${p.id}/status`] = {
      alive: state.alive[p.id],
      hypnotized: state.hypnotized === p.id,
      doomed: state.roles[p.id] === 'ironman' && state.iron.doomed && state.alive[p.id],
    };
  }
  const keyBase = Date.now();
  let n = 0;
  for (const [id, msgs] of Object.entries(report.private)) {
    for (const m of msgs) patch[`private/${id}/inbox/n${keyBase}_${n++}`] = { round, text: m.text, kind: m.kind };
  }

  patch['public/phase'] = state.winner ? 'end' : 'morning';
  patch['public/alive'] = state.alive;
  patch['public/endsAt'] = null;
  patch['public/progress'] = null;
  patch['public/winner'] = state.winner;
  patch['public/morning'] = {
    round,
    deaths: report.deaths.map((d) => ({
      id: d.id,
      name: nameOf(d.id),
      testament: String(testaments[d.id]?.testament ?? '').slice(0, 200) || null,
    })),
    saved: report.saved,
    hypnotized: report.hypnotized ? nameOf(report.hypnotized) : null,
    gossip: host.gossip ?? null,
    hints: report.hints,
    thermometer: report.thermometer.map((t) => ({ name: t.name, votes: t.votes })),
  };
  host.gossip = null;
  await update(r(), patch);
  await save();
}

// ---------- ziua ----------

async function discussion() {
  if (!state || pub.phase !== 'morning') return;
  await setPublic({ phase: 'discussion', endsAt: serverNow() + (state.settings.discussionSeconds ?? 300) * 1000 });
}

// ---------- votul ----------

const aliveIds = () => PLAYERS.filter((p) => state.alive[p.id]).map((p) => p.id);
const names = (ids) => (ids ?? []).map((id) => ({ id, name: nameOf(id) }));

function publicVote() {
  const v = host.vote;
  return {
    stage: v.stage,
    order: names(v.order),
    current: v.idx,
    done: v.idx,
    total: v.order.length,
    candidates: v.candidates ? names(v.candidates) : null,
  };
}

async function openVote(stage, candidates = null) {
  host.vote = { stage, order: shuffle(aliveIds()), idx: 0, votes: {}, candidates, outcome: null };
  await setPublic({ phase: 'vote', vote: publicVote(), reveal: null, endsAt: null });
  await save();
  botVoteSoon();
}

async function startVote() {
  if (!state || state.winner || !['morning', 'discussion'].includes(pub.phase)) return;
  await openVote('first');
}

// Votul unui jucător, venit de pe iPad (după verificarea PIN-ului) sau de la un robot.
async function recordVote(voter, target) {
  const v = host.vote;
  if (pub.phase !== 'vote' || !v) return { ok: false, error: 'Votul nu e deschis.' };
  if (v.order[v.idx] !== voter) return { ok: false, error: `Acum e rândul lui ${nameOf(v.order[v.idx])}.` };
  const valid = target === 'abstain'
    || (target !== voter && state.alive[target] && (!v.candidates || v.candidates.includes(target)));
  if (!valid) return { ok: false, error: 'Vot invalid.' };
  v.votes[voter] = target;
  v.idx += 1;
  await setPublic({ vote: publicVote() });
  await save();
  botVoteSoon();
  return { ok: true, player: voter };
}
setVoteHandler((player, vote) => new Promise((resolve) => run({ type: 'castVote', player, vote, resolve })));

async function castVote(cmd) {
  const res = await recordVote(cmd.player, cmd.vote);
  cmd.resolve?.(res);
}

async function skipVoter() {
  const v = host.vote;
  if (pub.phase !== 'vote' || !v || v.idx >= v.order.length) return;
  await recordVote(v.order[v.idx], 'abstain');
}

function botVoteSoon() {
  const v = host.vote;
  if (!v || v.idx >= v.order.length) return;
  const voter = v.order[v.idx];
  if (!voter || !isBot(voter)) return;
  setTimeout(() => run({ type: 'botVote', voter }), 1500);
}

async function botVote(cmd) {
  const v = host.vote;
  if (!v || v.order[v.idx] !== cmd.voter) return;
  const options = (v.candidates ?? aliveIds()).filter((id) => id !== cmd.voter);
  const target = Math.random() < 0.1 || !options.length ? 'abstain' : shuffle(options)[0];
  await recordVote(cmd.voter, target);
}

async function reveal() {
  const v = host.vote;
  if (pub.phase !== 'vote' || !v || v.idx < v.order.length) return;
  const outcome = voteOutcome(state, v.votes, { candidates: v.candidates, isRevote: v.stage === 'revote' });
  v.outcome = { result: outcome.result, target: outcome.target ?? null, candidates: outcome.candidates ?? null };
  await setPublic({ phase: 'reveal', reveal: publicReveal() });
  await save();
  if (outcome.result === 'mayor-decides') await askMayor();
}

function publicReveal() {
  const v = host.vote;
  const o = v.outcome;
  return {
    stage: v.stage,
    items: v.order.map((voter) => {
      const t = v.votes[voter];
      return { voter: nameOf(voter), target: t && t !== 'abstain' ? nameOf(t) : null, weight: voter === state.mayor ? 2 : 1 };
    }),
    outcome: {
      result: o.result,
      target: o.target ? nameOf(o.target) : null,
      candidates: o.candidates ? o.candidates.map(nameOf) : null,
      byMayor: Boolean(o.byMayor),
    },
  };
}

// Egalitate după revot: decide Primarul pe telefonul lui.
async function askMayor() {
  const mayor = state.mayor;
  await remove(r(`playerInput/${mayor}/mayorChoice`));
  await set(r(`private/${mayor}/mayorPick`), { round: state.round, candidates: names(host.vote.outcome.candidates) });
  if (isBot(mayor)) {
    setTimeout(() => run({ type: 'mayorChoice', choice: shuffle(host.vote.outcome.candidates)[0] }), 3000);
  } else {
    stopMayor?.();
    stopMayor = onValue(r(`playerInput/${mayor}/mayorChoice`), (snap) => {
      if (snap.val()) run({ type: 'mayorChoice', choice: snap.val() });
    });
  }
}
let stopMayor = null;

async function mayorChoice(cmd) {
  const v = host.vote;
  if (pub.phase !== 'reveal' || v?.outcome?.result !== 'mayor-decides' || !v.outcome.candidates.includes(cmd.choice)) return;
  stopMayor?.(); stopMayor = null;
  v.outcome = { result: 'eliminate', target: cmd.choice, candidates: null, byMayor: true };
  await remove(r(`private/${state.mayor}/mayorPick`));
  await setPublic({ reveal: publicReveal() });
  await save();
}

async function revote() {
  const o = host.vote?.outcome;
  if (pub.phase !== 'reveal' || o?.result !== 'revote') return;
  await openVote('revote', o.candidates);
}

// Eliminarea: 15 secunde de suspans la FIECARE eliminare, ca să nu se ghicească vampirul.
async function execute() {
  const o = host.vote?.outcome;
  if (pub.phase !== 'reveal' || o?.result !== 'eliminate') return;
  const servant = sacrificeCandidate(state, o.target);
  host.sacrifice = { target: o.target, servant, round: state.round };
  const seconds = state.settings.sacrificeSeconds ?? 15;
  const endsAt = serverNow() + seconds * 1000;
  if (servant) {
    await remove(r(`playerInput/${servant}/sacrifice`));
    await set(r(`private/${servant}/sacrifice`), { round: state.round, target: nameOf(o.target), endsAt });
    if (isBot(servant) && Math.random() < 0.5) await set(r(`playerInput/${servant}/sacrifice`), state.round);
  }
  await setPublic({ phase: 'sacrifice', endsAt, doomedName: nameOf(o.target) });
  await save();
  armSacrifice(endsAt);
}

let sacrificeTimer = null;
function armSacrifice(endsAt) {
  clearTimeout(sacrificeTimer);
  sacrificeTimer = setTimeout(() => run({ type: 'finishElimination' }), Math.max(0, endsAt - serverNow()) + 300);
}

async function finishElimination() {
  if (pub.phase !== 'sacrifice' || !host.sacrifice) return;
  const { target, servant, round } = host.sacrifice;
  let sacrifice = false;
  if (servant) {
    sacrifice = (await get(r(`playerInput/${servant}/sacrifice`))).val() === round;
    await remove(r(`private/${servant}/sacrifice`));
  }
  const votes = { ...host.vote.votes };
  const { state: next, report } = applyElimination(state, target, { sacrifice, votes });
  state = next;
  const dead = report.eliminated;
  const testament = (await get(r(`playerInput/${dead}/testament`))).val();
  const role = ROLES[state.roles[dead]];
  host.sacrifice = null;
  await update(r(), {
    [`private/${dead}/status/alive`]: false,
    'public/phase': 'elimination',
    'public/endsAt': null,
    'public/doomedName': null,
    'public/alive': state.alive,
    'public/elimination': {
      name: nameOf(dead),
      roleName: role.name,
      emoji: role.emoji,
      evil: role.team === 'evil',
      sacrificed: report.sacrificed,
      vampire: report.exposedVampire ? nameOf(report.exposedVampire) : null,
      testament: testament ? String(testament).slice(0, 200) : null,
    },
  });
  await save();
}

// După eliminare sau după un vot fără eliminare: runda următoare sau finalul.
async function continueGame(cmd = {}) {
  if (!state) return;
  if (pub.phase === 'reveal' && host.vote?.outcome?.result === 'none') {
    state = applyNoElimination(state, { ...host.vote.votes }).state;
  } else if (pub.phase !== 'elimination') {
    return;
  }
  host.vote = null;
  if (state.winner) {
    await setPublic({ phase: 'end', winner: state.winner, endsAt: null, vote: null, reveal: null, elimination: null });
    return save();
  }
  state = nextRound(state);
  state.hypnotized = null;
  const patch = {};
  for (const p of PLAYERS) patch[`private/${p.id}/status/hypnotized`] = false;
  patch['public/phase'] = 'day';
  patch['public/round'] = state.round;
  patch['public/endsAt'] = null;
  patch['public/morning'] = null;
  patch['public/vote'] = null;
  patch['public/reveal'] = null;
  patch['public/elimination'] = null;
  patch['public/nextSessionAt'] = cmd.minutes ? serverNow() + cmd.minutes * 60000 : null;
  await update(r(), patch);
  await save();
}

// ---------- joc nou ----------

async function reset() {
  stopActions?.(); stopActions = null;
  stopMayor?.(); stopMayor = null;
  clearTimeout(nightTimer);
  clearTimeout(sacrificeTimer);
  state = null;
  host = {};
  const patch = {
    'secret/state': null,
    'secret/host': null,
    actions: null,
    playerInput: null,
    'public/phase': 'lobby',
    'public/round': null,
    'public/gameId': null,
    'public/alive': null,
    'public/mayor': null,
    'public/morning': null,
    'public/winner': null,
    'public/endsAt': null,
    'public/progress': null,
    'public/nextSessionAt': null,
    'public/vote': null,
    'public/reveal': null,
    'public/elimination': null,
    'public/doomedName': null,
  };
  for (const p of PLAYERS) patch[`private/${p.id}`] = { name: p.name };
  await update(r(), patch);
}

// Panoul trimite comenzi prin această funcție.
export const sendCommand = (type, extra = {}) => push(r('commands'), { type, ...extra, at: Date.now() });
