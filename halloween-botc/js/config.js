// Setări care depind de unde rulează jocul.
// LIVE: versiunea de pe godguard.ro (cea jucată pe 31 octombrie); altfel e versiunea de test (GitHub Pages).
export const LIVE = typeof location !== 'undefined' && /(^|\.)godguard\.ro$/.test(location.hostname);
// TEST_TOOLS: alegerea rolurilor din panou, doar pentru teste. Pe godguard.ro e oprită (vezi LANSARE.md):
// panoul nu arată alegerea, iar motorul ignoră orice rol ales.
export const TEST_TOOLS = !LIVE;
