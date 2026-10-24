import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PLAYERS, newGame, resolveNight, voteOutcome, applyElimination, applyNoElimination,
  nextRound, sacrificeCandidate, detectiveResult, validTargets, sanitizeHint, checkWinner,
  ironListSize, nightMode, initialKnowledge, computeTitles, buildReplay, betLeaderboard,
} from '../js/engine.js';

// Distribuția din exemplul de partidă (capitolul 12 din specificație).
const EXAMPLE = {
  marian: 'vampire', flori: 'servant', bogdan: 'hypnotist', elisa: 'detective', radu: 'hunter',
  andrei: 'mayor', cella: 'gossip', luca: 'watchman', gabriela: 'photographer', robi: 'ironman', nico: 'werewolf',
};

function game(roles = EXAMPLE, settings = {}) {
  const g = newGame(PLAYERS, settings, () => 0.5);
  g.roles = { ...roles };
  g.mayor = Object.keys(roles).find((id) => roles[id] === 'mayor');
  return g;
}

const t = (target) => ({ target });
const msg = (report, id) => (report.private[id] ?? []).map((m) => m.text).join(' | ');

test('distribuirea dă fiecare rol exact o dată', () => {
  const g = newGame();
  const roles = Object.values(g.roles).sort();
  assert.equal(new Set(roles).size, 11);
  assert.equal(g.roles[g.mayor], 'mayor');
});

test('Servitorul îl știe pe vampir de la început', () => {
  const k = initialKnowledge(game());
  assert.match(k.flori[0].text, /Marian/);
  assert.equal(k.marian, undefined);
});

test('partida exemplu din specificație', () => {
  let g = game();

  // Ședința 1
  let { state, report } = resolveNight(g, {
    marian: t('cella'), bogdan: t('luca'), elisa: t('nico'), gabriela: t('bogdan'),
    radu: t('andrei'), robi: t('elisa'), luca: t('andrei'),
  });
  assert.deepEqual(report.deaths, [{ id: 'cella', cause: 'bite' }]);
  assert.equal(report.saved, false);
  assert.equal(report.hypnotized, 'luca');
  assert.match(msg(report, 'gabriela'), /Bogdan l-a vizat pe Luca/);
  assert.equal(detectiveResult(g, 'nico').isVampire, true);
  let v = voteOutcome(state, { andrei: 'nico', elisa: 'nico', luca: 'nico', marian: 'radu' });
  assert.equal(v.result, 'eliminate');
  ({ state } = applyElimination(state, v.target));
  assert.equal(state.alive.nico, false);
  assert.equal(state.winner, null);
  g = nextRound(state);

  // Ședința 2: Vânătorul și Omul de fier pe aceeași țintă -> contează Vânătorul
  ({ state, report } = resolveNight(g, {
    marian: t('elisa'), radu: t('elisa'), robi: t('elisa'), bogdan: t('marian'), gabriela: t('marian'),
  }));
  assert.deepEqual(report.deaths, []);
  assert.equal(report.saved, true);
  assert.equal(state.iron.used, false);
  assert.equal(report.hypnotized, null);
  assert.match(msg(report, 'bogdan'), /ai găsit Contele/);
  assert.match(msg(report, 'gabriela'), /Marian l-a vizat pe Elisa/);
  assert.equal(sacrificeCandidate(state, 'marian'), 'flori');
  ({ state, report } = applyElimination(state, 'marian', { sacrifice: true }));
  assert.equal(report.eliminated, 'flori');
  assert.equal(report.exposedVampire, 'marian');
  assert.equal(state.alive.marian, true);
  assert.equal(state.winner, null);
  g = nextRound(state);

  // Ședința 3: Omul de fier preia mușcătura, Paznicul vede atacul
  ({ state, report } = resolveNight(g, {
    marian: t('gabriela'), robi: t('gabriela'), luca: t('gabriela'), bogdan: t('radu'), radu: t('andrei'),
  }, () => 0.3));
  assert.deepEqual(report.deaths, []);
  assert.equal(report.saved, true);
  assert.equal(state.iron.doomed, true);
  const list = report.private.robi[0].list;
  assert.equal(list.length, 3);
  assert.ok(list.includes('marian'));
  assert.match(msg(report, 'luca'), /Marian l-a atacat pe Gabriela/);
  assert.equal(report.hypnotized, 'radu');
  assert.equal(sacrificeCandidate(state, 'marian'), null); // Servitorul e mort
  ({ state, report } = applyElimination(state, 'marian'));
  assert.equal(report.role, 'vampire');
  assert.equal(state.winner, 'good');
});

test('Omul de fier mușcat direct preia mușcătura și moare noaptea următoare', () => {
  let { state, report } = resolveNight(game(), { marian: t('robi'), robi: t('andrei') });
  assert.deepEqual(report.deaths, []);
  assert.equal(report.saved, true);
  assert.equal(state.alive.robi, true);
  assert.equal(nightMode(state, 'robi'), 'thermometer');
  state = nextRound(state);
  ({ state, report } = resolveNight(state, { marian: t('andrei'), robi: t('marian') }));
  assert.deepEqual(report.deaths.map((d) => d.id).sort(), ['andrei', 'robi']);
  assert.equal(report.saved, false);
});

test('mușcătura pe Omul de fier condamnat se pierde', () => {
  let { state } = resolveNight(game(), { marian: t('elisa'), robi: t('elisa') });
  state = nextRound(state);
  const { report } = resolveNight(state, { marian: t('robi'), radu: t('robi') });
  assert.deepEqual(report.deaths, [{ id: 'robi', cause: 'iron-doom' }]);
  assert.equal(report.saved, false);
});

test('Omul de fier nu poate fi salvat de Vânător după ce e condamnat', () => {
  let { state } = resolveNight(game(), { marian: t('robi') });
  state = nextRound(state);
  const { report } = resolveNight(state, { radu: t('robi') });
  assert.deepEqual(report.deaths.map((d) => d.id), ['robi']);
});

test('vampirul care nu alege pe nimeni: nu moare nimeni', () => {
  const { report } = resolveNight(game(), { radu: t('andrei') });
  assert.deepEqual(report.deaths, []);
  assert.equal(report.saved, false);
});

test('vampirul nu se poate mușca singur', () => {
  const { report } = resolveNight(game(), { marian: t('marian') });
  assert.deepEqual(report.deaths, []);
});

test('Vânătorul nu protejează aceeași persoană de două ori la rând', () => {
  let { state } = resolveNight(game(), { radu: t('andrei') });
  state = nextRound(state);
  assert.ok(!validTargets(state, 'radu').includes('andrei'));
  assert.ok(!validTargets(state, 'radu').includes('radu'));
  const { report } = resolveNight(state, { radu: t('andrei'), marian: t('andrei') });
  assert.deepEqual(report.deaths.map((d) => d.id), ['andrei']);
});

test('Hipnotizatorul nu alege aceeași persoană de două ori la rând', () => {
  let { state } = resolveNight(game(), { bogdan: t('luca') });
  state = nextRound(state);
  assert.ok(!validTargets(state, 'bogdan').includes('luca'));
  const { report } = resolveNight(state, { bogdan: t('luca') });
  assert.equal(report.hypnotized, null);
});

test('Detectivul: Servitorul și Hipnotizatorul par nevinovați, Vârcolacul pare vampir', () => {
  const g = game();
  assert.equal(detectiveResult(g, 'flori').isVampire, false);
  assert.equal(detectiveResult(g, 'bogdan').isVampire, false);
  assert.equal(detectiveResult(g, 'nico').isVampire, true);
  assert.equal(detectiveResult(g, 'marian').isVampire, true);
});

test('Fotograful: rolurile fără abilitate n-au vizat pe nimeni', () => {
  const { report } = resolveNight(game(), { gabriela: t('andrei'), andrei: t('marian') });
  assert.match(msg(report, 'gabriela'), /Andrei n-a vizat pe nimeni/);
});

test('Pariul nopții: pariază toată lumea, inclusiv fantomele; pariurile invalide se ignoră', () => {
  const g = game();
  g.alive.cella = false;
  const { state, report } = resolveNight(g, {
    andrei: { target: 'marian', bet: 'marian' }, elisa: { target: 'nico', bet: 'marian' }, cella: { hint: 'ceață', bet: 'nico' },
    luca: { target: 'radu', bet: 'luca' }, radu: { target: 'andrei', bet: 'cella' },
  });
  assert.deepEqual(report.thermometer.map((r) => [r.id, r.votes]), [['marian', 2], ['nico', 1]]);
  assert.equal(report.betCount, 3);
  assert.deepEqual(state.history[0].bets, { andrei: 'marian', elisa: 'marian', cella: 'nico' });
});

test('indiciile fantomelor blochează numele, și fără diacritice', () => {
  const g = game();
  assert.equal(sanitizeHint(g, 'usturoi'), 'usturoi');
  assert.equal(sanitizeHint(g, 'MARIAN'), null);
  assert.equal(sanitizeHint(g, 'Marianul'), null);
  assert.equal(sanitizeHint(g, 'gabrielă'), null);
  assert.equal(sanitizeHint(g, 'două cuvinte'), 'două');
  assert.equal(sanitizeHint(g, '   '), null);
});

test('votul: Primarul contează dublu', () => {
  const v = voteOutcome(game(), { andrei: 'nico', luca: 'radu' });
  assert.equal(v.counts.nico, 2);
  assert.equal(v.target, 'nico');
});

test('votul: abținerile nu contează, toți abținuți = nimeni eliminat', () => {
  assert.equal(voteOutcome(game(), { luca: 'abstain', elisa: 'abstain' }).result, 'none');
  assert.equal(voteOutcome(game(), { luca: 'nico', elisa: 'abstain', andrei: 'abstain' }).target, 'nico');
});

test('votul: egalitate -> revot -> decide Primarul', () => {
  const g = game();
  const first = voteOutcome(g, { luca: 'nico', elisa: 'radu' });
  assert.equal(first.result, 'revote');
  const second = voteOutcome(g, { luca: 'nico', elisa: 'radu', cella: 'flori' }, { candidates: first.candidates, isRevote: true });
  assert.equal(second.counts.flori, undefined);
  assert.equal(second.result, 'mayor-decides');
  const decided = voteOutcome(g, { luca: 'nico', elisa: 'radu' }, { candidates: first.candidates, isRevote: true, mayorChoice: 'radu' });
  assert.equal(decided.target, 'radu');
});

test('votul: egalitate după revot cu Primarul mort -> nimeni eliminat', () => {
  const g = game();
  g.alive.andrei = false;
  const v = voteOutcome(g, { luca: 'nico', elisa: 'radu' }, { candidates: ['nico', 'radu'], isRevote: true });
  assert.equal(v.result, 'none');
});

test('morții nu votează', () => {
  const g = game();
  g.alive.luca = false;
  assert.equal(voteOutcome(g, { luca: 'nico' }).result, 'none');
});

test('Sacrificiul se poate folosi o singură dată', () => {
  let { state } = applyElimination(game(), 'marian', { sacrifice: true });
  assert.equal(state.sacrificeUsed, true);
  assert.equal(sacrificeCandidate(state, 'marian'), null);
});

test('fără sacrificiu, vampirul eliminat = câștigă binele', () => {
  const { state } = applyElimination(game(), 'marian', { sacrifice: false });
  assert.equal(state.winner, 'good');
});

test('răii la fel de mulți ca restul -> câștigă răul', () => {
  const g = game();
  for (const id of ['andrei', 'luca', 'nico', 'elisa']) g.alive[id] = false;
  // vii: marian, flori, bogdan (răi) + gabriela, robi, cella, radu (buni)
  assert.equal(checkWinner(g), null);
  const { state } = resolveNight(g, { marian: t('cella') });
  assert.equal(state.winner, 'evil');
});

test('vampirul viu după ultima ședință -> câștigă răul', () => {
  const g = game({ ...EXAMPLE }, { sessions: 1 });
  assert.equal(applyNoElimination(g).state.winner, 'evil');
  assert.equal(applyElimination(g, 'nico').state.winner, 'evil');
});

test('mărimea listei Omului de fier', () => {
  assert.equal(ironListSize(10), 4);
  assert.equal(ironListSize(8), 4);
  assert.equal(ironListSize(7), 3);
  assert.equal(ironListSize(6), 3);
  assert.equal(ironListSize(5), 2);
});

test('acțiunile morților și țintele moarte sunt ignorate', () => {
  const g = game();
  g.alive.marian = true;
  g.alive.cella = false;
  const { report } = resolveNight(g, { marian: t('cella') });
  assert.deepEqual(report.deaths, []);
});

test('simulare aleatorie: 2000 de partide fără erori și mereu cu un câștigător', () => {
  let seed = 42;
  const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pickFrom = (list) => list[Math.floor(rng() * list.length)];
  for (let n = 0; n < 2000; n++) {
    let g = newGame(PLAYERS, {}, rng);
    for (let guard = 0; !g.winner && guard < 10; guard++) {
      const actions = {};
      for (const p of g.players) {
        if (!g.alive[p.id]) actions[p.id] = { hint: 'ceață' };
        else if (rng() < 0.9) actions[p.id] = { target: pickFrom(validTargets(g, p.id)) };
      }
      let { state } = resolveNight(g, actions, rng);
      if (!state.winner) {
        const alive = state.players.filter((p) => state.alive[p.id]).map((p) => p.id);
        const votes = Object.fromEntries(alive.map((id) => [id, rng() < 0.1 ? 'abstain' : pickFrom(alive)]));
        let v = voteOutcome(state, votes);
        if (v.result === 'revote') v = voteOutcome(state, votes, { candidates: v.candidates, isRevote: true, mayorChoice: v.candidates[0] });
        state = v.result === 'eliminate'
          ? applyElimination(state, v.target, { sacrifice: rng() < 0.5, votes }).state
          : applyNoElimination(state, votes).state;
      }
      g = state.winner ? state : nextRound(state);
    }
    assert.ok(['good', 'evil'].includes(g.winner), `partida ${n} n-a avut câștigător`);
  }
});

test('joc cu mai puțini jucători și personajele recomandate', () => {
  const five = PLAYERS.slice(0, 5);
  const g = newGame(five);
  assert.deepEqual(Object.values(g.roles).sort(), ['detective', 'hunter', 'mayor', 'servant', 'vampire']);
  assert.equal(Object.keys(g.alive).length, 5);
});

test('joc fără Primar: egalitatea după revot nu elimină pe nimeni', () => {
  const four = PLAYERS.slice(0, 4);
  const g = newGame(four, {}, Math.random, ['vampire', 'detective', 'hunter', 'werewolf']);
  assert.equal(g.mayor, null);
  const [a, b, c, d] = four.map((p) => p.id);
  const v = voteOutcome(g, { [a]: c, [b]: d }, { candidates: [c, d], isRevote: true });
  assert.equal(v.result, 'none');
});

test('newGame refuză configurații greșite', () => {
  assert.throws(() => newGame(PLAYERS.slice(0, 3)));
  assert.throws(() => newGame(PLAYERS.slice(0, 5), {}, Math.random, ['detective', 'hunter', 'mayor', 'servant', 'watchman']));
  assert.throws(() => newGame(PLAYERS.slice(0, 5), {}, Math.random, ['vampire', 'hunter']));
});

test('simulare aleatorie cu 4–11 jucători și personaje la întâmplare', () => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pickFrom = (list) => list[Math.floor(rnd() * list.length)];
  const others = ['servant', 'hypnotist', 'detective', 'hunter', 'mayor', 'gossip', 'watchman', 'photographer', 'ironman', 'werewolf'];
  for (let n = 0; n < 1500; n++) {
    const size = 4 + Math.floor(rnd() * 8);
    const roles = ['vampire', ...shuffleLocal(others, rnd).slice(0, size - 1)];
    let g = newGame(PLAYERS.slice(0, size), {}, rnd, roles);
    for (let guard = 0; !g.winner && guard < 10; guard++) {
      const actions = {};
      for (const p of g.players) {
        if (!g.alive[p.id]) actions[p.id] = { hint: 'ceață' };
        else { const t = validTargets(g, p.id); if (t.length && rnd() < 0.9) actions[p.id] = { target: pickFrom(t) }; }
      }
      let { state } = resolveNight(g, actions, rnd);
      if (!state.winner) {
        const alive = state.players.filter((p) => state.alive[p.id]).map((p) => p.id);
        const votes = Object.fromEntries(alive.map((id) => [id, rnd() < 0.1 ? 'abstain' : pickFrom(alive)]));
        let v = voteOutcome(state, votes);
        if (v.result === 'revote') v = voteOutcome(state, votes, { candidates: v.candidates, isRevote: true, mayorChoice: v.candidates[0] });
        state = v.result === 'eliminate' ? applyElimination(state, v.target, { sacrifice: rnd() < 0.5, votes }).state : applyNoElimination(state, votes).state;
      }
      g = state.winner ? state : nextRound(state);
    }
    assert.ok(['good', 'evil'].includes(g.winner));
  }
});

function shuffleLocal(list, rnd) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

test('titlurile și reluarea pentru partida exemplu', () => {
  let g = game();
  let { state } = resolveNight(g, { marian: t('cella'), elisa: { target: 'marian', bet: 'marian' }, andrei: { target: 'marian', bet: 'marian' }, radu: { target: 'andrei', bet: 'nico' } });
  ({ state } = applyElimination(state, 'nico', { votes: { andrei: 'nico', elisa: 'marian', luca: 'nico' } }));
  state = nextRound(state);
  ({ state } = resolveNight(state, { marian: t('elisa'), radu: t('elisa'), elisa: { target: 'luca', bet: 'marian' } }));
  ({ state } = applyElimination(state, 'marian', { votes: { andrei: 'marian', elisa: 'marian', luca: 'radu' } }));
  assert.equal(state.winner, 'good');
  const titles = Object.fromEntries(computeTitles(state).map((x) => [x.title, x.names]));
  assert.deepEqual(titles.Ghinionistul, ['Cella']);
  assert.deepEqual(titles['Ochiul de vultur'], ['Elisa']);
  assert.deepEqual(titles.Paranoicul, ['Luca']);
  assert.deepEqual(titles['Justițiarul'], ['Elisa']);
  assert.deepEqual(titles.Eroul, ['Radu']);
  assert.ok(titles.Actorul.includes('Flori') && titles.Actorul.includes('Bogdan'));
  const replay = buildReplay(state);
  assert.equal(replay.length, 4);
  assert.ok(replay[0].lines.some((l) => l.includes('Marian a mușcat pe Cella')));
  assert.ok(replay[2].lines.some((l) => l.includes('Preotul a salvat')));
  assert.ok(replay[3].lines.some((l) => l.includes('Eliminat: Marian (Contele Dracula)')));
  assert.equal(betLeaderboard(state)[0].name, 'Elisa');
});
