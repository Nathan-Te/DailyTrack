import { describePurity } from "@cdj/core/testing";

// Mêmes interdits que `sim` et `jump-sim` (liste commune de `@cdj/core/testing`) pour tout ce qui entre dans l'ÉTAT d'un moteur : l'interface, les pièces, le banc,
// l'empreinte (lab/) et le moteur A (lab/a/). Ne sont PAS scannés : lab/b/ (Rapier, dépendance externe permise là seulement) et lab/mesures/ (outils de lecture
// qui utilisent Math.hypot, cos, sin sur les sorties flottantes : jamais dans un état). Le seul import extérieur permis ici : `@cdj/core`.
describePurity("packages/tower-sim/lab", new URL("../lab", import.meta.url).pathname, { allowedImports: ["@cdj/core"] });
describePurity("packages/tower-sim/lab/a", new URL("../lab/a", import.meta.url).pathname, { allowedImports: ["@cdj/core"] });
