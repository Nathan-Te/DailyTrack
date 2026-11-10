import { fileURLToPath } from "node:url";
import { describePurity } from "@cdj/core/testing";

// Mêmes interdits que les autres simulations (liste commune de `@cdj/core/testing`) : tout ce qui entre dans l'état d'une partie est entier, sans hasard non semé ni horloge. Seul `@cdj/core` s'importe.
// (`fileURLToPath` et non `.pathname` : le chemin reste juste sous Windows.)
describePurity("packages/vertige-sim/src", fileURLToPath(new URL("../src", import.meta.url)), { allowedImports: ["@cdj/core", "@cdj/core/enveloppe"] });
