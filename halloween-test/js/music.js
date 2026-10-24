// Melodii de pe YouTube pentru anumite faze ale jocului (în locul muzicii generate).
// start / end: secundele dintre care se cântă în buclă (4:40 = 280, 11:01 = 661).
// Dacă YouTube nu merge (fără internet, videoclip blocat), se aude muzica generată a jocului.
const ballSong = { id: 'x668K4TBUMQ', start: 4 * 60 + 40, end: 11 * 60 + 1 };

export const YOUTUBE_MUSIC = {
  lobby: ballSong,   // cât intră oaspeții
  end: ballSong,     // finalul: câștigătorii, rolurile, reluarea, titlurile
};
