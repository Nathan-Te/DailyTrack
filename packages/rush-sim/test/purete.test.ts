import { describePurity } from "@cdj/core/testing";

// Mêmes interdits que les autres simulations (liste commune de `@cdj/core/testing`) : tout ce qui entre dans l'état d'une partie est entier, sans hasard non semé ni horloge. Seul `@cdj/core` s'importe.
describePurity("packages/rush-sim/src", new URL("../src", import.meta.url).pathname, { allowedImports: ["@cdj/core", "@cdj/core/enveloppe"] });
