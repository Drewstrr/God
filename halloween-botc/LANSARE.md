# Urcarea jocului pe godguard.ro

Jocul jucat pe 31 octombrie rulează pe godguard.ro (Netlify, ramura `main`), în folderul `halloween-botc/`.
Testele rămân pe GitHub Pages (ramura `halloween-dev`). Același cod, două comportamente, după adresă (`js/config.js`):

| | GitHub Pages (teste) | godguard.ro (jocul) |
|---|---|---|
| Zona din baza de date | `botc` | `bal` (separată: un tab de test uitat deschis nu atinge jocul) |
| Alegerea rolurilor din panou (`TEST_TOOLS`) | da | nu (panoul n-o arată, motorul ignoră orice rol ales) |
| Roboții („🧪 Test cu roboți”) | da | da (fără roboți activi, codul lor nu influențează jocul) |

## La fiecare urcare
1. Pe `halloween-dev`: crește `APP_VERSION` în `js/fb.js` (telefoanele cu cod vechi se reîncarcă singure).
2. Pe `main` se copiază DOAR folderul `halloween-botc/` (restul site-ului, de ex. teaserul `/halloween/teaser`, nu se atinge).
3. Folderul trebuie să rămână la o adresă care începe cu `/halloween`: service worker-ul site-ului (crew-zaky) le ignoră doar pe acestea.
