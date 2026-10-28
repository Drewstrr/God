// Gazda jocului: rulează în pagina Proiector, pe MacBook, logată ca motor. Ține locul naratorului:
// citește alegerile secrete, aplică regulile din engine.js și scrie rezultatele.
// Proiectorul și panoul citesc doar /public; fiecare telefon își citește doar /private/<nume>.
import {
  PLAYERS, ROLES, TYPES, DISTRIBUTION, MIN_PLAYERS, MAX_PLAYERS, ROLE_KEYS, newGame, initialKnowledge, resolveNight, resolveRaven,
  startDay, nominate, nominationError, tallyNomination, endDay, slay, nextNight, nightAction, validTargets,
  believedRole, voteThreshold, finalRoleName, inLineup as inLineupFor, checkWinner, shuffle, buildReplay, computeTitles, betLeaderboard, teamOf, grimoire, demonId, removeFromGame,
} from './engine.js';
import { setVoteHandler, setEngineActive } from './pin-service.js';
import { INTRO } from './intro.js';
import * as bots from './bots.js';
import { TEST_TOOLS } from './config.js';
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
  for (const k of ['believed', 'ghostVote', 'slayerUsed', 'alive', 'promoted']) s[k] = s[k] ?? {};
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
const inLineup = (id) => inLineupFor(pub.lineup, id, pub.players);
// Testamentul scris pe telefon (apare pe proiector când moare jucătorul).
const testamentOf = async (id) => String((await get(r(`playerInput/${id}/testament`))).val() ?? '').trim().slice(0, 200) || null;

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
  if (!pub.phase) await setPublic({ phase: 'lobby', settings: pub.settings ?? { nightSeconds: 90, defenseSeconds: 60, voteSeconds: 20, freeMinutes: 22 } });

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
  if (pub.phase === 'morning' && state?.winner) armFinish();
}

const run = serial(async (cmd) => {
  if (!active) return;
  const handlers = {
    fillBots, clearBots, start, firstNight, endNight, beginDay, startVoting, cancelNomination, endDayCmd,
    toNight, endStage, reset, settings, lineup, leave, inputs, closeVoting, finishReveal, botDayTick, openGathering, extendFree, skipIntro, skipFilm, soundTest, announce, extendNight, backToIntro, backToFree,
    adminRevive, adminKill, adminRestartNight, pause, resume, finishDawn, storyteller,
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
      freeMinutes: clamp(s.freeMinutes, 0, 120, 22),
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

  // Povestitorul inteligent e pornit implicit; se poate opri din panou oricând.
  const forced = TEST_TOOLS ? (await get(r('secret/forced'))).val() ?? {} : {};
  state = newGame(chosen, { ...(pub.settings ?? {}), storyteller: pub.storyteller !== false, forced });
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
    // Filmul de deschidere (proiector + vibrațiile telefoanelor). Fără film: un moment din trecut, ca filmul să fie „deja terminat”.
    'public/introAt': pub.skipFilm ? filmOver() : serverNow() + 1500,
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
    'public/virgin': null,
  });
  await update(r(), patch);
  await save();
}

// ---------- noaptea ----------

async function firstNight() {
  if (!state || pub.phase !== 'intro') return;
  host.firstNightAt = serverNow();
  await openNight();
  await setPublic({ undoIntroUntil: host.firstNightAt + UNDO_INTRO_MS });
}

// „Înapoi” doar unde nu s-a întâmplat încă nimic ireversibil (nimeni n-a ales noaptea, nimeni n-a nominalizat).
const UNDO_INTRO_MS = 60000;
const UNDO_FREE_MS = 120000;
async function backToIntro() {
  if (!state || pub.phase !== 'night' || state.night !== 1 || serverNow() > (host.firstNightAt ?? 0) + UNDO_INTRO_MS) return;
  const acted = (await get(r('actions/1'))).val() ?? {};
  if (Object.entries(acted).some(([id, a]) => a?.done && !isBot(id))) return;
  stopActions?.(); stopActions = null;
  clearTimeout(nightTimer);
  host.firstNightAt = null;
  const patch = {
    'public/phase': 'intro', 'public/endsAt': null, 'public/progress': null, 'public/undoIntroUntil': null,
    'public/introAt': filmOver(), actions: null,
  };
  for (const p of GP()) patch[`private/${p.id}/night`] = null;
  await update(r(), patch);
  await save();
}
async function backToFree() {
  if (!state || pub.phase !== 'day' || host.free || host.current || !host.lastFree) return;
  if (state.today?.nominations?.length || serverNow() > host.lastFree.at + UNDO_FREE_MS) return;
  host.free = { endsAt: serverNow() + Math.max(60000, host.lastFree.remaining) };
  host.lastFree = null;
  await setPublic({ day: publicDay() });
  await save();
  armFree();
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
      // Ordinea numelor e alta în fiecare noapte și pe fiecare telefon: cine trage cu ochiul nu ghicește alegerea după poziție.
      targets: spec ? shuffle(everyone.filter((t) => allowed.includes(t.id))) : null,
      info: Boolean(info),
      ghost: !state.alive[p.id],
      bets: shuffle(everyone.filter((t) => t.id !== p.id && state.alive[t.id])),
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

// Mintea fiecărui robot (ce bănuiește), păstrată cu restul datelor gazdei.
const mind = (id) => ((host.minds ??= {})[id] ??= bots.newMind());
function botChoice(id) {
  const { targets, bet } = bots.nightChoice(state, id, mind(id));
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
  if (!host.paused) nightTimer = setTimeout(() => run({ type: 'endNight', night }), Math.max(0, (endsAt ?? serverNow()) - serverNow()) + 500);
}

// Contele trebuie să muște: dacă n-a ales până expiră timpul, noaptea îl mai așteaptă 30 de secunde
// (pe proiector se vede doar că timpul s-a prelungit, nu pentru cine), apoi jocul alege în locul lui un jucător bun.
const COUNT_GRACE = 30;
const countMissing = (raw) => {
  const demon = demonId(state);
  return state.night > 1 && demon && state.alive[demon] && !Object.values(raw[demon]?.targets ?? {}).length ? demon : null;
};

async function endNight(cmd = {}) {
  if (pub.phase !== 'night' || !state) return;
  if (cmd.night && cmd.night !== state.night) return;
  const night = state.night;
  if (cmd.night && host.graceNight !== night) {
    const pending = (await get(r(`actions/${night}`))).val() ?? {};
    if (countMissing(pending)) {
      host.graceNight = night;
      clearTimeout(nightTimer);
      const endsAt = serverNow() + COUNT_GRACE * 1000;
      await setPublic({ endsAt });
      if (!host.paused) nightTimer = setTimeout(() => run({ type: 'endNight', night }), COUNT_GRACE * 1000 + 500);
      return;
    }
  }
  stopActions?.(); stopActions = null;
  clearTimeout(nightTimer);
  const raw = (await get(r(`actions/${night}`))).val() ?? {};
  const late = countMissing(raw);
  if (late) {
    const good = validTargets(state, late).filter((id) => teamOf(state.roles[id]) === 'good');
    if (good.length) raw[late] = { ...raw[late], targets: [shuffle(good)[0]], auto: true };
  }
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
  // Roboții țin minte ce au aflat în noaptea asta.
  for (const [id, msgs] of Object.entries(report.private)) if (isBot(id)) for (const m of msgs) bots.learn(mind(id), id, m);
  // …și și-o spun la masă (răii inventează); ceilalți roboți ascultă.
  for (const id of aliveIds().filter(isBot)) bots.hear(host.minds ?? {}, state, id, bots.claimsFor(state, id, report.private[id] ?? []));
  let n = 0;
  const keyBase = Date.now();
  // Fiecare primește un mesaj în fiecare noapte (chiar și „nimic nou”): pe ecran toți arată la fel,
  // iar bulina de pe Pergament nu-i dă de gol pe cei care au roluri cu informații.
  for (const p of GP()) if (!report.private[p.id]?.length) patch[`private/${p.id}/inbox/n${keyBase}_none`] = { night, text: '🌙 Noaptea asta n-ai aflat nimic nou.', kind: 'none' };
  for (const [id, msgs] of Object.entries(report.private)) {
    for (const m of msgs) patch[`private/${id}/inbox/n${keyBase}_${n++}`] = { night, text: m.text, kind: m.kind };
  }
  if (state.pendingRaven) patch[`private/${state.pendingRaven.id}/raven`] = { night, targets: names(GP().map((p) => p.id).filter((id) => id !== state.pendingRaven.id)) };
  // Dimineața vine mereu cu ritualul ei, chiar dacă moartea din noaptea asta încheie jocul:
  // întâi doliul pentru ultima victimă, apoi finalul (anunțat abia după ritual).
  const morning = await dawnTimeline(night, report.deaths.map((d) => d.id));
  Object.assign(patch, {
    'public/phase': 'morning',
    'public/alive': state.alive,
    'public/ghostVote': state.ghostVote,
    'public/endsAt': null,
    'public/progress': null,
    'public/undoIntroUntil': null,
    'public/winner': null,
    'public/morning': morning,
  });
  await update(r(), patch);
  await save();
  if (state.winner) armFinish();
  const raven = state.pendingRaven?.id;
  if (raven && isBot(raven)) {
    const target = bots.ravenPick(state, raven, mind(raven)) ?? shuffle(aliveIds())[0];
    setTimeout(() => set(r(`playerInput/${raven}/raven`), { night, target, at: Date.now() }), 3000);
  }
}

// ---------- dimineața: ritualul lumânărilor ----------

// Epitafurile: fraza de pe cartonașul de doliu, sub numele celui ucis noaptea (una diferită pentru fiecare mort).
// Pentru una nouă: adaug-o la final, cu următorul număr. Scrise ca să se potrivească oricui (bărbat sau femeie).
const EPITAPHS = [
  /*  1 */ 'A avut încredere în cine nu trebuia.',
  /*  2 */ 'Ultimul dans l-a dansat cu Contele.',
  /*  3 */ 'Castelul i-a păstrat numele. Contele, sângele.',
  /*  4 */ 'A plecat de la bal fără să-și ia rămas-bun.',
  /*  5 */ 'Lumânarea i s-a stins înaintea zorilor.',
  /*  6 */ 'Nimeni nu i-a auzit ultimul strigăt.',
  /*  7 */ 'A închis ochii la miezul nopții și nu i-a mai deschis.',
  /*  8 */ 'Pe pernă a rămas doar o pată de sânge.',
  /*  9 */ 'Oglinda din sala mare nu-i mai arată chipul.',
  /* 10 */ 'A lăsat ușa descuiată. Contele n-a bătut.',
  /* 11 */ 'Ultimul pahar de vin a fost roșu. Prea roșu.',
  /* 12 */ 'Liliecii i-au cântat de leagăn.',
  /* 13 */ 'A adormit cu ochii pe ușă. Contele a intrat pe fereastră.',
  /* 14 */ 'Două urme mici pe gât. Atât a rămas.',
  /* 15 */ 'Avea răspunsul. Contele a avut întrebarea.',
  /* 16 */ 'A știut prea mult, prea devreme.',
  /* 17 */ 'Vântul de pe coridor i-a șoptit numele. Prea târziu.',
  /* 18 */ 'Se spune că umbra i se vede încă, la miezul nopții, la fereastră.',
  /* 19 */ 'Și-a pus usturoi la gât. Contele preferă ceafa.',
  /* 20 */ 'Ultimele cuvinte au fost: „Doar o clipă, mă duc să văd ce-i zgomotul ăsta.”',
  /* 21 */ 'Un vals, o privire, un sărut pe gât. Și gata.',
  /* 22 */ 'Patul e rece. Fereastra, deschisă.',
  /* 23 */ 'A visat frumos. Contele s-a asigurat că visul nu se termină.',
  /* 24 */ 'Răsăritul a venit. Pentru unii, prea târziu.',
  /* 25 */ 'A căutat Contele toată ziua. Noaptea, Contele a căutat mai bine.',
];

// Cronologia dimineții (în secunde de la dawnAt), ca proiectorul și telefoanele să meargă împreună:
// actul I (clopotul, 0–8 s), actul II (lumânările celor treziți se aprind una câte una, tot mai rar),
// actul III (doliul, pentru fiecare mort), apoi începe ziua.
const ACT2 = 8;
const MOURN = 27;
async function dawnTimeline(night, deadIds) {
  const survivors = shuffle(aliveIds());
  const wake = {};
  let t = ACT2 + 1.2;
  survivors.forEach((id, i) => {
    const left = survivors.length - i;
    t += left <= 3 ? [3.2, 2.4, 1.7][left - 1] : 0.75 + Math.random() * 0.35;
    wake[id] = Math.round(t * 10) / 10;
  });
  const act3 = t + (deadIds.length ? 3 : 1.5);
  // Contele a atacat, dar nu a murit nimeni (Preotul, Haiducul): dimineața se aude urletul lui furios, din depărtare.
  // Nu spune pe cine a atacat; după prima noapte, o dimineață fără morți înseamnă oricum un atac oprit.
  const growl = !deadIds.length && Boolean(state.history.at(-1)?.attack);
  const epitaphs = shuffle(EPITAPHS);
  return {
    night,
    dawnAt: serverNow() + 1500,
    wake,
    act3,
    growl,
    end: act3 + (deadIds.length ? deadIds.length * MOURN : 6),
    deaths: await Promise.all(deadIds.map(async (id, i) => ({ id, name: nameOf(id), testament: await testamentOf(id), epitaph: epitaphs[i % epitaphs.length] }))),
  };
}

// ---------- ziua ----------

function publicDay(extra = {}) {
  const t = state.today;
  const block = t?.virgin ? null : t?.block;  // execuția Fecioarei nu e un „butuc” cu voturi
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
    // Timpul liber (petrecerea): cât rulează, nominalizările sunt închise.
    free: host.free?.endsAt ?? null,
    // Timpul liber a expirat: se așteaptă gazda să deschidă adunarea.
    freeOver: Boolean(host.free?.over),
    lastActivity: host.lastActivity ?? null,
    // Adunarea deschisă din greșeală: 2 minute se poate reveni la timpul liber (cât n-a nominalizat nimeni).
    undoFreeUntil: host.lastFree && !t?.nominations?.length ? host.lastFree.at + UNDO_FREE_MS : null,
    // Ieri nu a fost executat nimeni: proiectorul le amintește, ca jocul să nu se lungească.
    noExecYesterday: state.night > 1 && [...state.history].reverse().find((h) => h.type === 'day')?.executed === null,
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

// Ziua începe cu timp liber (petrecerea), apoi vine adunarea cu nominalizări și voturi.
// Jocul s-a terminat noaptea: după ritualul dimineții trecem singuri la final.
let finishTimer = null;
function armFinish() {
  clearTimeout(finishTimer);
  const m = pub.morning;
  const left = m?.dawnAt ? m.dawnAt + m.end * 1000 - serverNow() : 0;
  finishTimer = setTimeout(() => run({ type: 'finishDawn' }), Math.max(0, left) + 1500);
}
async function finishDawn() {
  if (!state?.winner || pub.phase !== 'morning') return;
  clearTimeout(finishTimer);
  await update(r(), { 'public/phase': 'end', 'public/winner': state.winner, ...finalPatch() });
  await save();
}

async function beginDay(cmd = {}) {
  if (!state || pub.phase !== 'morning') return;
  if (state.winner) return finishDawn();
  state = startDay(state);
  host.current = null;
  host.lastFree = null;
  host.lastActivity = serverNow();
  const minutes = clamp(cmd.minutes ?? state.settings.freeMinutes, 0, 120, 22);
  host.free = minutes ? { endsAt: serverNow() + minutes * 60000 } : null;
  await update(r(), { 'public/phase': 'day', 'public/day': publicDay(), 'public/endsAt': null, 'public/slay': null, 'public/virgin': null });
  await save();
  if (host.free) armFree();
  startBotDay();
}

let freeTimer = null;
function armFree() {
  if (host.paused) return;
  clearTimeout(freeTimer);
  freeTimer = setTimeout(() => run({ type: 'openGathering', auto: true }), Math.max(0, host.free.endsAt - serverNow()) + 300);
}

// Se termină timpul liber: toată lumea vine la proiector.
async function openGathering(cmd = {}) {
  if (pub.phase !== 'day' || !host.free) return;
  if (cmd.auto && host.free.endsAt > serverNow() + 1000) return armFree();  // timpul a fost prelungit între timp
  // Când expiră timpul liber, adunarea NU se deschide singură: oamenii pot fi împrăștiați prin casă.
  // Proiectorul și telefoanele îi cheamă la masă, iar gazda deschide adunarea când sunt toți acolo.
  if (cmd.auto) {
    if (host.free.over) return;
    host.free.over = true;
    await setPublic({ day: publicDay() });
    await save();
    return;
  }
  clearTimeout(freeTimer);
  host.lastFree = { at: serverNow(), remaining: Math.max(0, host.free.endsAt - serverNow()) };
  host.free = null;
  host.lastActivity = serverNow();
  await setPublic({ day: publicDay() });
  await save();
}

// Filmul de deschidere: îl poți sări în timp ce rulează, sau îl poți opri pentru jocurile următoare.
const filmOver = () => serverNow() - (INTRO.length + 5) * 1000;
async function skipIntro() {
  if (pub.phase !== 'intro') return;
  await setPublic({ introAt: filmOver() });
}
async function skipFilm(cmd = {}) {
  await setPublic({ skipFilm: Boolean(cmd.on) });
}

// Unelte din panou: testul de sunet, un mesaj scurt pe proiector, încă 30 de secunde de noapte.
async function soundTest() {
  await setPublic({ soundTest: serverNow() });
}
async function announce(cmd = {}) {
  const text = String(cmd.text ?? '').trim().slice(0, 140);
  if (text) await setPublic({ notice: { text: `📢 ${text}`, at: serverNow(), long: true } });
}
async function extendNight() {
  if (pub.phase !== 'night' || !state || host.paused) return;
  const endsAt = Math.max(pub.endsAt ?? 0, serverNow()) + 30000;
  await setPublic({ endsAt });
  watchNight(endsAt);
}

async function extendFree(cmd = {}) {
  if (pub.phase !== 'day' || !host.free) return;
  host.free.endsAt = Math.max(host.free.endsAt, serverNow()) + clamp(cmd.minutes, 1, 60, 5) * 60000;
  host.free.over = false;
  await setPublic({ day: publicDay() });
  await save();
  armFree();
}

function resumeDay() {
  if (host.free) armFree();
  if (!host.current) return startBotDay();
  const c = host.current;
  if (c.stage === 'defense') armDay(c.endsAt, 'startVoting');
  else if (c.stage === 'voting') { armDay(c.endsAt, 'closeVoting'); botVotes(); }
  else if (c.stage === 'reveal') armDay(c.endsAt, 'finishReveal');
  startBotDay();
}

function armDay(endsAt, type) {
  if (host.paused) return;  // la reluare se pornesc din nou
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
  if (pub.phase !== 'day' || !state?.today || host.current || host.free) return;
  // Van Helsing-robot lovește doar când e destul de sigur pe cine e Contele.
  for (const id of aliveIds().filter(isBot)) {
    const target = bots.slayPick(state, id, mind(id));
    if (target) return set(r(`playerInput/${id}/slay`), { target, at: Date.now() });
  }
  if (state.today.nominations.length >= 3 || Math.random() < 0.5) return;
  // Primul robot care are pe cine bănui nominalizează (răii nu-și nominalizează niciodată colegii).
  for (const by of shuffle(aliveIds().filter((id) => isBot(id) && !state.today.nominators[id]))) {
    const allowed = aliveIds().filter((id) => !state.today.nominees[id] && id !== by);
    const target = bots.nominee(state, by, mind(by), allowed);
    if (target) return set(r(`playerInput/${by}/nominate`), { target, day: state.today.day, at: Date.now() });
  }
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
      if (kind === 'nominate' && !host.paused) await onNominate(id, v);
      if (kind === 'slay' && !host.paused) await onSlay(id, v);
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
  if (pub.phase !== 'day' || !state.today || host.current || host.free || state.today.virgin) return;
  if (v.day !== state.today.day) return;
  if (nominationError(state, by, v.target)) return;
  state = nominate(state, by, v.target);
  if (state.today.virgin) return virginStrikes(by, v.target);
  const endsAt = serverNow() + (state.settings.defenseSeconds ?? 60) * 1000;
  host.current = { key: `${state.today.day}_${state.today.nominations.length}`, by, target: v.target, stage: 'defense', endsAt, votes: {} };
  await setPublic({ day: publicDay() });
  await save();
  armDay(endsAt, 'startVoting');
}

// Fecioara: proiectorul arată ce s-a întâmplat, apoi cel care a nominalizat-o e executat (ziua se încheie).
async function virginStrikes(by, target) {
  clearTimeout(dayTimer); clearInterval(botDayTimer);
  host.current = null;
  await setPublic({ virgin: { byName: nameOf(by), targetName: nameOf(target), by, target, at: serverNow() }, day: publicDay() });
  await save();
  setTimeout(() => run({ type: 'endDayCmd' }), 9000);
}

// Povestitorul inteligent: pornit/oprit din panou, în orice fază.
async function storyteller(cmd) {
  const on = cmd.on !== false;
  await setPublic({ storyteller: on });
  if (state) { state.settings.storyteller = on; await save(); }
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
    const yes = bots.vote(state, id, mind(id), c.target);
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
  if (host.minds) bots.sawVotes(host.minds, state, c.by, c.target, c.votes);   // doar când joacă roboți
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
  host.lastActivity = serverNow();
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
  if (pub.phase !== 'day' || !state.today || host.free || state.today.virgin || state.slayerUsed[by] || !state.alive[by]) return;
  if (!state.players.some((p) => p.id === v.target)) return;
  const { state: next, report } = slay(state, by, v.target);
  state = next;
  const patch = {
    'public/slay': { byName: nameOf(by), targetName: nameOf(v.target), hit: report.hit, at: serverNow(), testament: report.hit ? await testamentOf(v.target) : null },
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
  if (!state || pub.phase !== 'day' || !state.today || host.free) return;
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
      id: report.executed ?? null,
      name: report.executed ? nameOf(report.executed) : null,
      testament: report.executed ? await testamentOf(report.executed) : null,
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

// ---------- pauza (cineva a ieșit din cameră) ----------

// Toate cronometrele se opresc; la reluare, fiecare continuă de unde a rămas.
async function pause() {
  if (host.paused || !state || ['lobby', 'end'].includes(pub.phase)) return;
  host.paused = { at: serverNow() };
  clearTimeout(nightTimer); clearTimeout(dayTimer); clearTimeout(freeTimer); clearInterval(botDayTimer);
  await setPublic({ paused: { at: host.paused.at } });
  await save();
}

async function resume() {
  if (!host.paused) return;
  const shift = serverNow() - host.paused.at;
  host.paused = null;
  const patch = { paused: null };
  if (pub.phase === 'night' && pub.endsAt) patch.endsAt = pub.endsAt + shift;
  if (host.free) host.free.endsAt += shift;
  if (host.current?.endsAt) host.current.endsAt += shift;
  if (host.lastActivity) host.lastActivity += shift;
  if (pub.phase === 'day') patch.day = publicDay();
  await setPublic(patch);
  await save();
  if (pub.phase === 'night') watchNight(patch.endsAt);
  if (pub.phase === 'day') resumeDay();
}

// ---------- finalul ----------

function finalPatch() {
  return {
    'public/endStage': 'winner',
    'public/final': {
      // Dezvăluirea rolurilor: întâi binele, apoi Slujitorii, iar Contele mereu ultimul (Mireasa devenită Conte, chiar înaintea lui).
      roles: GP().map((p) => {
        const role = state.roles[p.id];
        const drunkAs = role === 'drunk' ? ROLES[state.believed[p.id]]?.name : null;
        const bride = state.promoted?.[p.id] === 'scarlet';
        const rank = bride ? 2 : role === 'demon' ? 3 : teamOf(role) === 'evil' ? 1 : 0;
        return { name: p.name, roleName: finalRoleName(state, p.id), emoji: bride ? ROLES.scarlet.emoji : ROLES[role].emoji, evil: teamOf(role) === 'evil', alive: Boolean(state.alive[p.id]), drunkAs, rank };
      }).sort((a, b) => a.rank - b.rank).map(({ rank, ...x }) => x),
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

async function setAliveAndCheck(id, alive, extra = {}, { left = false } = {}) {
  if (!state || !(id in state.alive)) return;
  let newDemon = null;
  if (alive) {
    state.alive[id] = true;
    delete state.ghostVote[id];
    state.winner = null;
  } else {
    // Ca o moarte: dacă pleacă (sau e scos) Contele, Mireasa îi ia locul, ca la execuție.
    const ghost = state.ghostVote[id];
    let report;
    ({ state, report } = removeFromGame(state, id, { left }));
    state.ghostVote[id] = ghost ?? true;
    newDemon = report.newDemon;
  }
  const patch = {
    [`private/${id}/status`]: { alive, ghostVote: Boolean(state.ghostVote[id]) },
    'public/alive': state.alive,
    'public/ghostVote': state.ghostVote,
    ...extra,
  };
  if (newDemon) await tellNewDemon(newDemon, patch);
  if (state.winner) Object.assign(patch, { 'public/phase': 'end', 'public/winner': state.winner, 'public/endsAt': null }, finalPatch());
  await update(r(), patch);
  await save();
}

// Din panoul de comandă: cine pleacă de la petrecere devine fantomă fără vot (rolul rămâne secret).
async function leave(cmd) {
  if (!state || !state.alive[cmd.id] || pub.phase === 'end') return;
  state.ghostVote[cmd.id] = false;
  await setAliveAndCheck(cmd.id, false, { 'public/notice': { text: `🚪 ${nameOf(cmd.id)} a părăsit castelul.`, at: serverNow() } }, { left: true });
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
  clearTimeout(nightTimer); clearTimeout(dayTimer); clearInterval(botDayTimer); clearTimeout(freeTimer); clearTimeout(finishTimer);
  state = null;
  host = { seen: {} };
  const patch = {
    'secret/state': null,
    'secret/host': null,
    actions: null,
    playerInput: null,
  };
  for (const k of ['round', 'gameId', 'alive', 'ghostVote', 'seats', 'counts', 'script', 'morning', 'day', 'execution', 'winner', 'endsAt',
    'progress', 'final', 'endStage', 'nightSeq', 'notice', 'slay', 'paused', 'virgin']) patch[`public/${k}`] = null;
  patch['public/phase'] = 'lobby';
  for (const p of PLAYERS) patch[`private/${p.id}`] = { name: p.name };
  await update(r(), patch);
}

// Panoul trimite comenzi prin această funcție.
export const sendCommand = (type, extra = {}) => push(r('commands'), { type, ...extra, at: Date.now() });
