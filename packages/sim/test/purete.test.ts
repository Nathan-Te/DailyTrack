import { describePurity } from "@cdj/core/testing";

// La simulation ne doit utiliser aucune fonction dont le résultat peut varier selon le moteur JS, ni source de hasard/temps (voir CLAUDE.md).
// La liste d'interdits est celle de `@cdj/core/testing`, commune à `core`, `sim` et `jump-sim` ; le seul import extérieur permis est `@cdj/core`.
describePurity("packages/sim/src", new URL("../src", import.meta.url).pathname, { allowedImports: ["@cdj/core"] });
