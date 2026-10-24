// Retouche 38b, lot 46 — **le palier 3 de chaque thème, tout compris** (la vitrine : `composerPalier.ts`, `post.ts`) : la brume et les nuages (`CIEL_3`,
// lumiere3.ts), les particules (`PARTICULES_3`, vie.ts), l'étalonnage, le halo et la lumière des reflets (`POST_3`, themesPost.ts : lot 47). Le jeu ne charge pas ce module : ses pas
// « ciel » et « vie » lisent leurs tables chacun de son côté (un morceau à la demande chacun, sans morceau partagé).
import type { PaletteName } from "@cdj/sim";
import { CIEL_3, type Theme3 } from "./lumiere3";
import { PARTICULES_3 } from "./vie";
import { POST_3 } from "./themesPost";

export const THEMES_3: Record<PaletteName, Theme3> = Object.fromEntries((Object.keys(CIEL_3) as PaletteName[]).map((k) => [k, { ...CIEL_3[k], particules: PARTICULES_3[k], ...POST_3[k] }])) as Record<PaletteName, Theme3>;
