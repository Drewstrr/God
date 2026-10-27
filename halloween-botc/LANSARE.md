# Înainte de urcarea jocului pe godguard.ro

Lista de pași pentru versiunea finală (cea jucată pe 31 octombrie).

1. **Scoate alegerea rolurilor din panou:** în `js/config.js` pune `TEST_TOOLS = false`.
   Panoul nu mai arată „🎭 Test: alege tu rolurile”, iar motorul ignoră orice rol ales rămas salvat.
2. **Șterge rolurile alese rămase de la teste** (`secret/forced` din baza de date), ca să nu rămână nimic.
3. Paginile de test (`*-test.html`, `masa.html`, `sange.html`) nu sunt legate de joc; se pot lăsa sau șterge.
4. Crește `APP_VERSION` în `js/fb.js`, ca telefoanele să încarce versiunea nouă.
