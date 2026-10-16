// Configuration de la fusion des rapports « blob » (job `e2e` de .github/workflows/ci.yml), lot 3c : les rapports de DailyTrack (apps/web/e2e) et de
// DailyJump (apps/jump/e2e) ont été enregistrés avec des dossiers de tests différents, et Playwright refuse de les fusionner sans cela.
// `testDir` = le dossier commun (`apps/`) : les fichiers du rapport fusionné s'écrivent `web/e2e/…` et `jump/e2e/…`, sans ambiguïté
// (smoke.spec.ts, mobile.spec.ts, replay.spec.ts, themes.spec.ts existent dans les deux jeux).
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export default {
  testDir: join(dirname(fileURLToPath(import.meta.url)), "..", "apps"),
};
