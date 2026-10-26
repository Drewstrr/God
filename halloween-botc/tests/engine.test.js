import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PLAYERS, ROLES, DISTRIBUTION, newGame, initialKnowledge, resolveNight, resolveRaven, startDay, nominate,
  nominationError, tallyNomination, endDay, slay, nextNight, checkWinner, validTargets, nightAction,
  voteThreshold, buildReplay, computeTitles, keysOfType, demonId, finalRoleName, storytellerLean,
} from '../js/engine.js';

const seq = (...vals) => { let i = 0; return () => vals[i++ % vals.length]; };
const P = (n) => PLAYERS.slice(0, n);

// O partidă cu roluri fixe, ca testele să fie previzibile.
function fixed(roles, extra = {}) {
  const players = PLAYERS.filter((p) => p.id in roles);
  const g = newGame(players, {}, seq(0.1));
  return { ...g, roles: { ...roles }, believed: {}, bluffs: ['soldier', 'mayor', 'saint'], redHerring: null, ...extra };
}
const ROLES11 = {
  andrei: 'washer', flori: 'fortune', luca: 'monk', nico: 'undertaker', bogdan: 'slayer', gabriela: 'raven',
  marian: 'mayor', elisa: 'saint', robi: 'poisoner', cella: 'scarlet', radu: 'demon',
};
const msgs = (report, id) => (report.private[id] ?? []).map((m) => m.text).join(' | ');

test('distribuția pentru 11 jucători: 7 Săteni, 1 Străin, 2 Slujitori, 1 Conte; rolurile sunt unice', () => {
  for (let k = 0; k < 50; k++) {
    const g = newGame(P(11));
    const types = Object.values(g.roles).map((r) => ROLES[r].type);
    const count = (t) => types.filter((x) => x === t).length;
    assert.deepEqual([count('townsfolk'), count('outsider'), count('minion'), count('demon')], DISTRIBUTION[11]);
    assert.equal(new Set(Object.values(g.roles)).size, 11);
  }
});

test('cele 3 roluri-paravan ale Contelui sunt bune și nu sunt în joc', () => {
  for (let k = 0; k < 100; k++) {
    const g = newGame(P(11));
    const inPlay = new Set(Object.values(g.roles));
    assert.equal(g.bluffs.length, 3);
    for (const b of g.bluffs) {
      assert.ok(!inPlay.has(b), `${b} e în joc`);
      assert.notEqual(ROLES[b].type, 'minion');
      assert.ok(!Object.values(g.believed).includes(b));
    }
  }
});

test('Bețivul crede că e un Sătean care nu e în joc', () => {
  let seen = 0;
  for (let k = 0; k < 200; k++) {
    const g = newGame(P(11));
    const drunk = Object.keys(g.roles).find((id) => g.roles[id] === 'drunk');
    if (!drunk) continue;
    seen++;
    const b = g.believed[drunk];
    assert.equal(ROLES[b].type, 'townsfolk');
    assert.ok(!Object.values(g.roles).includes(b));
  }
  assert.ok(seen > 0);
});

test('răul se cunoaște: Contele își știe Slujitorii și paravanele, Slujitorii îl știu pe Conte', () => {
  const g = fixed(ROLES11);
  const k = initialKnowledge(g);
  assert.match(k.radu.map((m) => m.text).join(' '), /Robi.*Cella|Cella.*Robi/);
  assert.match(k.radu.map((m) => m.text).join(' '), /NU sunt în joc/);
  assert.match(k.robi[0].text, /Contele este Radu/);
  assert.equal(k.andrei, undefined);
});

test('prima noapte: Contele nu mușcă, Spălătoreasa primește informație adevărată', () => {
  const g = fixed(ROLES11);
  assert.equal(nightAction(g, 'radu'), null);
  const { state, report } = resolveNight(g, {}, seq(0.3));
  assert.deepEqual(report.deaths, []);
  const m = msgs(report, 'andrei');
  // rolul anunțat trebuie să fie chiar rolul unuia dintre cei doi numiți
  const names = m.match(/Unul dintre (\S+) și (\S+) este/).slice(1, 3);
  const ids = names.map((n) => PLAYERS.find((p) => p.name === n).id);
  assert.ok(ids.some((id) => m.includes(ROLES[state.roles[id]].name)));
});

test('Contele ucide din a doua noapte; Preotul salvează; Haiducul nu poate fi ucis', () => {
  let g = nextNight(fixed(ROLES11));
  let r = resolveNight(g, { radu: { targets: ['andrei'] } });
  assert.deepEqual(r.report.deaths.map((d) => d.id), ['andrei']);
  r = resolveNight(g, { radu: { targets: ['andrei'] }, luca: { targets: ['andrei'] } });
  assert.deepEqual(r.report.deaths, []);
  const g2 = nextNight(fixed({ ...ROLES11, andrei: 'soldier' }));
  r = resolveNight(g2, { radu: { targets: ['andrei'] } });
  assert.deepEqual(r.report.deaths, []);
});

test('Vrăjitoarea strică abilitatea: Preotul otrăvit nu mai salvează, Haiducul otrăvit moare', () => {
  const g = nextNight(fixed(ROLES11));
  let r = resolveNight(g, { robi: { targets: ['luca'] }, luca: { targets: ['andrei'] }, radu: { targets: ['andrei'] } });
  assert.deepEqual(r.report.deaths.map((d) => d.id), ['andrei']);
  const g2 = nextNight(fixed({ ...ROLES11, andrei: 'soldier' }));
  r = resolveNight(g2, { robi: { targets: ['andrei'] }, radu: { targets: ['andrei'] } });
  assert.deepEqual(r.report.deaths.map((d) => d.id), ['andrei']);
});

test('Ghicitoarea: DA dacă unul e Contele sau jucătorul-capcană; Ghicitoarea otrăvită poate primi minciuni', () => {
  const g = fixed(ROLES11, { redHerring: 'marian' });
  let r = resolveNight(g, { flori: { targets: ['radu', 'andrei'] } });
  assert.match(msgs(r.report, 'flori'), /DA/);
  r = resolveNight(g, { flori: { targets: ['marian', 'andrei'] } });
  assert.match(msgs(r.report, 'flori'), /DA/);
  r = resolveNight(g, { flori: { targets: ['luca', 'andrei'] } });
  assert.match(msgs(r.report, 'flori'), /NU/);
  r = resolveNight(g, { robi: { targets: ['flori'] }, flori: { targets: ['luca', 'andrei'] } }, seq(0.1));
  assert.match(msgs(r.report, 'flori'), /DA/);  // otrăvită: răspunsul e inversat
});

test('Groparul află rolul celui executat ieri', () => {
  let g = startDay(fixed(ROLES11));
  g = nominate(g, 'andrei', 'robi');
  ({ state: g } = tallyNomination(g, 'andrei', 'robi', Object.fromEntries(Object.keys(ROLES11).map((id) => [id, true]))));
  ({ state: g } = endDay(g));
  g = nextNight(g);
  const r = resolveNight(g, {}, seq(0.9));
  assert.match(msgs(r.report, 'nico'), /Robi, executat ieri, era 🧙‍♀️ Vrăjitoarea/);
});

test('Corbierul ucis noaptea află rolul cuiva', () => {
  const g = nextNight(fixed(ROLES11));
  const { state } = resolveNight(g, { radu: { targets: ['gabriela'] } });
  assert.equal(state.pendingRaven.id, 'gabriela');
  const { message } = resolveRaven(state, 'robi', seq(0.9));
  assert.match(message.text, /Robi este 🧙‍♀️ Vrăjitoarea/);
});

test('nominalizări: fiecare nominalizează o dată pe zi, fiecare poate fi nominalizat o dată; fantomele nu nominalizează', () => {
  let g = startDay(fixed(ROLES11));
  g = nominate(g, 'andrei', 'radu');
  assert.ok(nominationError(g, 'andrei', 'robi'));
  assert.ok(nominationError(g, 'flori', 'radu'));
  g.alive.luca = false;
  assert.ok(nominationError(g, 'luca', 'robi'));
  assert.equal(nominationError(g, 'flori', 'robi'), null);
});

test('votul: e nevoie de jumătate din cei vii; cel cu cele mai multe voturi ajunge pe butuc; egalitatea salvează pe toți', () => {
  let g = startDay(fixed(ROLES11));
  assert.equal(voteThreshold(g), 6);
  const yes = (ids) => Object.fromEntries(ids.map((id) => [id, true]));
  let e;
  ({ state: g, entry: e } = tallyNomination(g, 'andrei', 'radu', yes(['andrei', 'flori', 'luca', 'nico', 'bogdan'])));
  assert.equal(e.result, 'failed');
  ({ state: g, entry: e } = tallyNomination(g, 'flori', 'robi', yes(['andrei', 'flori', 'luca', 'nico', 'bogdan', 'gabriela'])));
  assert.equal(e.result, 'block');
  ({ state: g, entry: e } = tallyNomination(g, 'luca', 'cella', yes(['andrei', 'flori', 'luca', 'nico', 'bogdan', 'gabriela'])));
  assert.equal(e.result, 'tie');
  assert.equal(g.today.block.id, null);
  const { report } = endDay(g);
  assert.equal(report.executed, null);
});

test('morții votează o singură dată (votul de fantomă)', () => {
  let g = startDay(fixed(ROLES11));
  g.alive.andrei = false; g.ghostVote.andrei = true;
  let e;
  ({ state: g, entry: e } = tallyNomination(g, 'flori', 'robi', { andrei: true }));
  assert.deepEqual(e.yes, ['andrei']);
  ({ state: g, entry: e } = tallyNomination(g, 'luca', 'cella', { andrei: true }));
  assert.deepEqual(e.yes, []);
});

test('Contele executat: câștigă binele; dar Mireasa preia rolul dacă sunt ≥5 în viață', () => {
  const all = Object.fromEntries(Object.keys(ROLES11).map((id) => [id, true]));
  let g = startDay(fixed(ROLES11));
  g = nominate(g, 'andrei', 'radu');
  ({ state: g } = tallyNomination(g, 'andrei', 'radu', all));
  let r = endDay(g);
  assert.equal(r.report.newDemon, 'cella');
  assert.equal(r.state.winner, null);
  assert.equal(demonId(r.state), 'cella');
  // fără Mireasă: binele câștigă
  let g2 = startDay(fixed({ ...ROLES11, cella: 'spy' }));
  g2 = nominate(g2, 'andrei', 'radu');
  ({ state: g2 } = tallyNomination(g2, 'andrei', 'radu', all));
  r = endDay(g2);
  assert.equal(r.state.winner, 'good');
});

test('Sfântul executat: câștigă răul', () => {
  const all = Object.fromEntries(Object.keys(ROLES11).map((id) => [id, true]));
  let g = startDay(fixed(ROLES11));
  g = nominate(g, 'andrei', 'elisa');
  ({ state: g } = tallyNomination(g, 'andrei', 'elisa', all));
  assert.equal(endDay(g).state.winner, 'evil');
});

test('Van Helsing: o singură dată; omoară doar Contele; Bețivul care crede că e Van Helsing nu omoară', () => {
  let g = startDay(fixed({ ...ROLES11, cella: 'spy' }));
  let r = slay(g, 'bogdan', 'robi');
  assert.equal(r.report.hit, false);
  assert.throws(() => slay(r.state, 'bogdan', 'radu'));
  r = slay(g, 'bogdan', 'radu');
  assert.equal(r.report.hit, true);
  assert.equal(r.state.winner, 'good');
  const g2 = startDay(fixed({ ...ROLES11, bogdan: 'drunk', cella: 'spy' }, { believed: { bogdan: 'slayer' } }));
  assert.equal(slay(g2, 'bogdan', 'radu').report.hit, false);
});

test('Primarul: 3 în viață și fără execuție = câștigă binele', () => {
  let g = fixed(ROLES11);
  for (const id of ['andrei', 'flori', 'luca', 'nico', 'bogdan', 'gabriela', 'elisa', 'cella']) g.alive[id] = false;
  g = startDay(g);
  const { state, report } = endDay(g);
  assert.ok(report.mayorWin);
  assert.equal(state.winner, 'good');
});

test('răul câștigă când rămân doar doi jucători în viață', () => {
  let g = nextNight(fixed(ROLES11));
  for (const id of ['flori', 'luca', 'nico', 'bogdan', 'gabriela', 'marian', 'elisa', 'cella']) g.alive[id] = false;
  const { state } = resolveNight(g, { radu: { targets: ['andrei'] } });
  assert.equal(state.winner, 'evil');
});

test('ținte valide: Contele nu se mușcă singur, Preotul nu se binecuvântează singur, Ghicitoarea poate alege și morți', () => {
  const g = nextNight(fixed(ROLES11));
  g.alive.andrei = false;
  assert.ok(!validTargets(g, 'radu').includes('radu'));
  assert.ok(!validTargets(g, 'radu').includes('andrei'));
  assert.ok(!validTargets(g, 'luca').includes('luca'));
  assert.ok(validTargets(g, 'flori').includes('andrei'));
});

test('partidă la întâmplare: se termină mereu cu un câștigător, fără erori', () => {
  for (let k = 0; k < 300; k++) {
    let g = newGame(P(5 + (k % 11)));
    let guard = 0;
    while (!g.winner && guard++ < 40) {
      const acts = {};
      for (const p of g.players) {
        const t = validTargets(g, p.id);
        const need = nightAction(g, p.id)?.pick ?? 0;
        if (need) acts[p.id] = { targets: t.sort(() => Math.random() - 0.5).slice(0, need) };
      }
      ({ state: g } = resolveNight(g, acts));
      if (g.pendingRaven) ({ state: g } = resolveRaven(g, g.players[0].id));
      if (g.winner) break;
      g = startDay(g);
      const alive = g.players.filter((p) => g.alive[p.id]);
      const by = alive[0].id;
      const target = alive[Math.floor(Math.random() * alive.length)].id;
      g = nominate(g, by, target);
      ({ state: g } = tallyNomination(g, by, target, Object.fromEntries(g.players.map((p) => [p.id, Math.random() < 0.7]))));
      ({ state: g } = endDay(g));
      if (!g.winner) g = nextNight(g);
    }
    assert.ok(g.winner, 'jocul trebuie să se termine');
    assert.ok(buildReplay(g).length > 0);
    computeTitles(g);
  }
});

test('fantomele nu pot fi nominalizate', () => {
  let g = startDay(fixed(ROLES11));
  g.alive.robi = false;
  assert.ok(nominationError(g, 'andrei', 'robi'));
});

test('reluarea spune când atacul Contelui a fost oprit (Preot / Haiduc)', () => {
  const g = nextNight(fixed(ROLES11));
  let { state } = resolveNight(g, { radu: { targets: ['andrei'] }, luca: { targets: ['andrei'] } });
  assert.ok(buildReplay(state)[0].lines.some((l) => /atacat pe Andrei — salvat de binecuvântarea Preotului/.test(l)));
  const g2 = nextNight(fixed({ ...ROLES11, andrei: 'soldier' }));
  ({ state } = resolveNight(g2, { radu: { targets: ['andrei'] } }));
  assert.ok(buildReplay(state)[0].lines.some((l) => /Haiducul nu poate fi ucis/.test(l)));
});

test('12 jucători: 7 Săteni, 2 Străini, 2 Slujitori, Contele; paravanele tot bune și lipsă din joc', () => {
  for (let k = 0; k < 100; k++) {
    const g = newGame(P(12));
    const types = Object.values(g.roles).map((r) => ROLES[r].type);
    const count = (t) => types.filter((x) => x === t).length;
    assert.deepEqual([count('townsfolk'), count('outsider'), count('minion'), count('demon')], [7, 2, 2, 1]);
    assert.equal(g.bluffs.length, 3);
    for (const b of g.bluffs) assert.ok(!Object.values(g.roles).includes(b));
  }
});

test('Arhivarul: nu intră în joc când nu sunt Străini; altfel numește mereu un Străin', () => {
  for (const n of [7, 10]) {
    for (let k = 0; k < 60; k++) {
      const g = newGame(P(n));
      assert.ok(!Object.values(g.roles).includes('librarian'));
      assert.ok(!g.bluffs.includes('librarian'));
    }
  }
  const g = fixed({ ...ROLES11, andrei: 'librarian' });
  for (let k = 0; k < 30; k++) {
    const { report } = resolveNight(g, {});
    assert.match(msgs(report, 'andrei'), /este 😇 Sfântul/);
  }
});

test('Mireasa care preia rolul apare la final „Mireasa Contelui (Contele)”', () => {
  const all = Object.fromEntries(Object.keys(ROLES11).map((id) => [id, true]));
  let g = startDay(fixed(ROLES11));
  g = nominate(g, 'andrei', 'radu');
  ({ state: g } = tallyNomination(g, 'andrei', 'radu', all));
  const { state } = endDay(g);
  assert.equal(finalRoleName(state, 'cella'), 'Mireasa Contelui (Contele)');
  assert.equal(finalRoleName(state, 'radu'), 'Contele Dracula');
});

// ---------- Fecioara ----------
const ROLES_V = { ...ROLES11, gabriela: 'virgin' };

test('Fecioara: un Sătean care o nominalizează e executat pe loc, iar ziua se termină', () => {
  let g = startDay(fixed(ROLES_V));
  g = nominate(g, 'andrei', 'gabriela');
  assert.deepEqual(g.today.virgin, { by: 'andrei', target: 'gabriela' });
  const { state, report } = endDay(g);
  assert.equal(report.executed, 'andrei');
  assert.equal(state.alive.andrei, false);
  assert.ok(buildReplay(state).some((d) => d.lines.some((l) => l.includes('Fecioara'))));
});

test('Fecioara: un rău care o nominalizează nu pățește nimic, dar puterea ei se consumă', () => {
  let g = startDay(fixed(ROLES_V));
  g = nominate(g, 'robi', 'gabriela');
  assert.equal(g.today.virgin, undefined);
  assert.equal(g.virginUsed, true);
  g = endDay(g).state;
  g = startDay(nextNight(g));
  g = nominate(g, 'andrei', 'gabriela');
  assert.equal(g.today.virgin, undefined);
});

test('Fecioara otrăvită nu execută pe nimeni', () => {
  let g = startDay(fixed(ROLES_V, { poisoned: 'gabriela' }));
  g = nominate(g, 'andrei', 'gabriela');
  assert.equal(g.today.virgin, undefined);
});

// ---------- povestitorul ----------
test('povestitorul: oprit sau în prima noapte nu înclină nimic', () => {
  const g = fixed(ROLES11);
  assert.equal(storytellerLean({ ...g, night: 3 }, {}), null);
  assert.equal(storytellerLean({ ...g, settings: { ...g.settings, storyteller: true }, night: 1 }, {}), null);
});

test('povestitorul: Binele aproape de Conte → norocul înclină spre Rău; Binele pierdut la final → spre Bine', () => {
  const g = { ...fixed(ROLES11), settings: { storyteller: true }, night: 3 };
  const good = Object.keys(ROLES11).filter((id) => !['robi', 'cella', 'radu'].includes(id));
  const bets = (ids, on) => Object.fromEntries(ids.map((id) => [id, { bet: on }]));
  assert.equal(storytellerLean(g, bets(good, 'radu')), 'evil');
  assert.equal(storytellerLean(g, bets(good, 'andrei')), null);   // 11 în viață: încă devreme
  const late = { ...g, alive: Object.fromEntries(Object.keys(ROLES11).map((id) => [id, ['andrei', 'flori', 'luca', 'nico', 'robi', 'radu'].includes(id)])) };
  assert.equal(storytellerLean(late, bets(['andrei', 'flori', 'luca', 'nico'], 'robi')), 'good');
});

test('povestitorul nu schimbă cine moare: același atac, aceeași moarte', () => {
  const base = { ...fixed(ROLES11), night: 2, settings: { storyteller: true } };
  const actions = { radu: { targets: ['andrei'] }, flori: { bet: 'radu' }, luca: { bet: 'radu' }, nico: { bet: 'radu' }, andrei: { bet: 'radu' }, bogdan: { bet: 'radu' } };
  const on = resolveNight(base, actions, seq(0.3));
  const off = resolveNight({ ...base, settings: { storyteller: false } }, actions, seq(0.3));
  assert.deepEqual(on.report.deaths, off.report.deaths);
  assert.equal(on.state.lean, 'evil');
});

test('Vrăjitoarea poate otrăvi doar jucători vii', () => {
  const g = { ...fixed(ROLES11), night: 2, alive: { ...fixed(ROLES11).alive, andrei: false } };
  const targets = validTargets(g, 'robi');
  assert.ok(!targets.includes('andrei'));
  assert.ok(targets.includes('flori'));
});

test('reluarea spune pe scurt ce a făcut povestitorul', () => {
  const roles = { ...ROLES11, elisa: 'recluse' };
  const base = { ...fixed(roles), night: 2, settings: { storyteller: true } };
  const good = Object.keys(roles).filter((id) => !['robi', 'cella', 'radu'].includes(id));
  const actions = Object.fromEntries(good.map((id) => [id, { bet: 'radu' }]));
  actions.flori = { targets: ['elisa', 'luca'], bet: 'radu' };
  const { state } = resolveNight(base, actions, seq(0.1));
  const night = state.history.at(-1);
  assert.equal(night.lean, 'evil');
  assert.ok(night.leanNotes.some((n) => n.includes('Sihastrul')), JSON.stringify(night.leanNotes));
  assert.ok(buildReplay(state).some((d) => d.lines.some((l) => l.startsWith('📜 Povestitorul (spre Rău):'))));
});

test('reluarea spune când Spălătoreasa, otrăvită în prima noapte, a primit informație falsă', () => {
  const g = fixed(ROLES11);
  let { state } = resolveNight(g, { robi: { targets: ['andrei'] } });
  assert.ok(buildReplay(state)[0].lines.some((l) => /Spălătoreasa \(Andrei\), otrăvit în prima noapte, a primit o informație falsă: „Unul dintre/.test(l)));
  // Neotrăvită: nicio mențiune.
  ({ state } = resolveNight(fixed(ROLES11), { robi: { targets: ['luca'] } }));
  assert.ok(!buildReplay(state)[0].lines.some((l) => /informație falsă/.test(l)));
});

test('reluarea spune când Bețivul a crezut că e Spălătoreasa', () => {
  const g = fixed({ ...ROLES11, andrei: 'drunk' }, { believed: { andrei: 'washer' } });
  const { state } = resolveNight(g, { robi: { targets: ['luca'] } });
  assert.ok(buildReplay(state)[0].lines.some((l) => /Andrei era de fapt Bețivul, deci informația primită ca Spălătoreasa era falsă/.test(l)));
});
