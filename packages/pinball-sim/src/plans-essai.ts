import type { Plan } from "./plans";
import { orbite, porteDeLOrbite, theme, trou } from "./plans-outils";

// LES SIX PLANS D'ESSAI (lot PBT0) — des tables dessinées d'un seul tenant, à jouer avant de choisir (`?plan=t1` à `?plan=t6`, `?miroir`). **Ils ne sont jamais tirés par le générateur** (ils ne sont pas dans `PLANS`) ; le lot PBT1 fera
// des tables du jour de ceux que Nathan garde. Règles et tests : `conception.ts`, `test/conception*.test.ts`, `packages/pinball-sim/CLAUDE.md` (« Concevoir une table »). Ce que tous partagent, et pourquoi :
//   · **le verrou est le trou à (180, 398)**, devant les batteurs : c'est le seul endroit où sa fenêtre de tir atteint 30 ms (33 à 35 ms : le trou ne garde que les billes de moins de 650 px/s) ;
//   · **la mission est l'élément du thème en (182, 315)**, au centre bas (163 ms à la Foire, 45 ms ailleurs), la poche des bumpers au-dessus (212, 176), sous les couloirs du haut ;
//   · **les bouches de l'orbite et la porte** sont celles que le lot PBL2 a éprouvées (`orbite(88, 304, 295, 158, 20, 0, 35, 285)`, la porte penchée à 35° sur la bouche droite : 50 à 68 ms) ;
//   · **les emplacements 3 et 4 (et 5) portent, dans l'Espace, les deux portails de la mission** : leurs places sont aussi des places de tir pour un portail (36 ms au mieux) ;
//   · aucun module à mur (spinner, coulée) : la zone de tir libre reste vide ; les banques de cibles sont sur les flancs bas ou en haut à droite, jamais au milieu d'un tir.
// Les coordonnées sont des pixels de la table ; elles ont été trouvées par `tools/regler-essai.ts` (une montée de colline sur les quatre thèmes) puis retouchées à la main d'après `tools/conception.ts --svg`.

export const PLANS_ESSAI: readonly Plan[] = [
  {
    id: "t1",
    idee: "L'orbite et la rampe se répondent",
    emplacements: [
      theme(182, 315, "geyser"),
      trou(180, 398),
      { x: 212, y: 176, permis: ["bumpers"], fixe: { espace: "asteroide" } },
      { x: 284, y: 415, permis: ["cibles"], fixe: { espace: "portailB" } },
      { x: 151, y: 233, permis: ["mini"], fixe: { espace: "portailA" } },
    ],
    rampes: [{ genre: "rampe", points: [[118, 392], [84, 366], [48, 352], [32, 392], [32, 448]], hauteur: 24, demiPorte: 17 }],
    orbite: orbite(88, 304, 295, 158, 20, 0, 35, 285),
    porte: porteDeLOrbite(304, 285, 35, 56, 24),
    aiguillage: { rampe: 0, partie: 300 },
  },
  {
    id: "t2",
    idee: "La poche des bumpers en haut, nourrie par l'orbite",
    emplacements: [
      theme(182, 315, "geyser"),
      trou(180, 398),
      { x: 212, y: 176, permis: ["bumpers"], fixe: { espace: "asteroide" } },
      { x: 82, y: 415, permis: ["cibles"], fixe: { espace: "portailB" } },
      { x: 151, y: 233, permis: ["mini"], fixe: { espace: "portailA" } },
    ],
    rampes: [],
    orbite: orbite(88, 304, 295, 158, 20, 0, 35, 285),
    porte: porteDeLOrbite(304, 285, 35, 56, 24),
  },
  {
    id: "t3",
    idee: "Deux cibles de chaque côté, un tir central",
    emplacements: [
      theme(182, 315, "geyser"),
      trou(180, 398),
      { x: 212, y: 176, permis: ["bumpers"], fixe: { espace: "asteroide" } },
      { x: 82, y: 415, permis: ["cibles"], fixe: { espace: "portailB" } },
      { x: 284, y: 415, permis: ["cibles"] },
      { x: 151, y: 233, permis: ["mini"], fixe: { espace: "portailA" } },
    ],
    rampes: [],
    orbite: orbite(88, 304, 295, 158, 20, 0, 35, 285),
    porte: porteDeLOrbite(304, 285, 35, 56, 24),
  },
  {
    id: "t4",
    idee: "Le mini-batteur et sa rampe",
    emplacements: [
      theme(182, 315, "geyser"),
      trou(180, 398),
      { x: 212, y: 176, permis: ["bumpers"], fixe: { espace: "asteroide" } },
      { x: 262, y: 415, permis: ["cibles"], fixe: { espace: "portailB" } },
      { x: 255, y: 250, permis: ["cibles"] },
      { x: 151, y: 233, permis: ["mini"], fixe: { espace: "portailA" } },
    ],
    rampes: [{ genre: "rampe", points: [[124, 392], [106, 358], [60, 326], [38, 250], [46, 165], [56, 100], [150, 34], [250, 34], [326, 100], [335, 170], [338, 260], [337, 448]], hauteur: 30, demiPorte: 17 }],
    orbite: null,
    mini: { cote: 0, x: 46, y: 405, longueur: 38 },
    aiguillage: { rampe: 0, partie: 500 },
  },
  {
    id: "t5",
    idee: "Le mini-batteur de gauche nourrit l'orbite",
    emplacements: [
      theme(182, 315, "geyser"),
      trou(180, 398),
      { x: 212, y: 176, permis: ["bumpers"], fixe: { espace: "asteroide" } },
      { x: 284, y: 415, permis: ["cibles"], fixe: { espace: "portailB" } },
      { x: 151, y: 233, permis: ["mini"], fixe: { espace: "portailA" } },
    ],
    rampes: [],
    orbite: orbite(88, 304, 295, 158, 20, 0, 35, 285),
    porte: porteDeLOrbite(304, 285, 35, 56, 24),
    mini: { cote: 0, x: 46, y: 405, longueur: 38 },
  },
  {
    id: "t6",
    idee: "Le mini-batteur de droite et la banque de gauche",
    emplacements: [
      theme(182, 315, "geyser"),
      trou(180, 398),
      { x: 212, y: 176, permis: ["bumpers"], fixe: { espace: "asteroide" } },
      { x: 82, y: 415, permis: ["cibles"], fixe: { espace: "portailB" } },
      { x: 151, y: 233, permis: ["mini"], fixe: { espace: "portailA" } },
    ],
    rampes: [],
    orbite: orbite(88, 304, 295, 158, 20, 0, 35, 285),
    porte: porteDeLOrbite(304, 285, 35, 56, 24),
    mini: { cote: 1, x: 46, y: 405, longueur: 38 },
  },
];
