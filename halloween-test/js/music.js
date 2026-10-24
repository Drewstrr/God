// Melodii de pe YouTube pentru anumite faze ale jocului (în locul muzicii generate).
// start / end: secundele dintre care se cântă în buclă (4:40 = 280, 11:01 = 661).
// Dacă YouTube nu merge (fără internet, videoclip blocat), se aude muzica generată a jocului.
// Fără end: cântă până la finalul videoclipului, apoi reia de la start.
const ballSong = { id: 'x668K4TBUMQ', start: 4 * 60 + 40, end: 11 * 60 + 1 };
const debateSong = { id: 'pHJUQo6-2yE', start: 3 * 60 + 7 };

export const YOUTUBE_MUSIC = {
  lobby: ballSong,   // cât intră oaspeții
  discussion: debateSong,  // discuția dinaintea votului
  end: ballSong,     // finalul: câștigătorii, rolurile, reluarea, titlurile
};
