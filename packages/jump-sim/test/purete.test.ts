import { describePurity } from "@cdj/core/testing";

// Mêmes interdits que `sim` et `core` (liste commune de `@cdj/core/testing`) ; le seul import extérieur permis est `@cdj/core`.
describePurity("packages/jump-sim/src", new URL("../src", import.meta.url).pathname, { allowedImports: ["@cdj/core"] });
