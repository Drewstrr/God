// Muzica fazelor cu melodie adevărată (în locul muzicii generate).
//
// Din fișier (audio/<nume>.mp3, trecut și în audio/list.json): merge fără internet și fără reclame,
// intră și iese lin, iar când revine continuă de unde a rămas.
// ball.mp3 = melodia balului, bucata 4:40–11:01, cântată în buclă.
export const FILE_MUSIC = {
  lobby: 'ball',   // cât intră oaspeții
  free: 'ball',    // timpul liber dintre adunări (petrecerea)
  end: 'ball',     // finalul: câștigătorii, rolurile, reluarea, titlurile
};

// De pe YouTube. start / end: secundele dintre care se cântă în buclă; fără end: până la final, apoi de la start.
// Dacă YouTube nu merge (fără internet, videoclip blocat), se aude muzica generată a jocului.
const debateSong = { id: 'pHJUQo6-2yE', start: 3 * 60 + 7 };

export const YOUTUBE_MUSIC = {
  day: debateSong,         // adunarea: nominalizări, voturi
};
