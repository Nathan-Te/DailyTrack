import { suiteIdentite } from "./helpers/identite";

// Lot 49 : le générateur v18 sur soixante circuits par thème (`helpers/identite.ts`), en deux fichiers que Vitest lance en parallèle.
suiteIdentite(["stade", "rallye", "banquise", "nuit"]);
