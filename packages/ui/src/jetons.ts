// Les jetons de la charte « Cartouches » (docs/plateforme/identite.md, lot I0 ; lot I1 de la plateforme) : **la seule source** des couleurs,
// rayons, épaisseurs, ombres, typographies, espacements et durées de l'interface. Le fichier `jetons.css` (propriétés `--dj-*`, `--track-*`,
// `--jump-*`, `--tower-*`) en est **généré** (`cssDesJetons`) ; le test `packages/ui/test/jetons.test.ts` vérifie qu'il est à jour
// (`MAJ_JETONS=1 npx vitest run packages/ui/test/jetons.test.ts` le réécrit). Aucune couleur, police ni durée en dur ailleurs.
//
// Une valeur qui commence par `--` est un renvoi vers un autre jeton (`--jump-papier` = `--dj-papier`) : en CSS `var(--…)`, en TypeScript la
// valeur résolue (`valeurJeton`).

/** Couleurs (charte § 3). */
export const COULEURS = {
  // 3.1 Marque (portail et cadre des jeux)
  "dj-creme": "#EDE3CF",
  "dj-creme-2": "#E3D6BC",
  "dj-papier": "#FFF6E0",
  "dj-encre": "#2A1E16",
  "dj-encre-douce": "#6B5847",
  "dj-terre": "#C2401F",
  "dj-terre-texte": "#FFF4E0",
  "dj-moutarde": "#E8B23A",
  "dj-kofi": "#72A4F2", // lot S1 : le bleu du bouton Ko-fi (portail et accueil des jeux)
  "dj-discord": "#5865F2", // lot S1 : le bleu-violet du bouton Discord
  "dj-blanc": "#FFFFFF", // lot S1 : le texte du bouton Discord
  "dj-ecran": "#3A2C20",
  "dj-ambre": "#F2B544",
  "dj-ecran-texte": "#E9DCC2",
  // Ombres internes de l'afficheur (charte § 5 : « sombre en haut, reflet clair en bas »), opaques (pas de translucidité) : l'écran assombri
  // de 35 % et éclairci de 8 %, comme la maquette.
  "dj-ecran-ombre": "#261D15",
  "dj-ecran-reflet": "#4A3D32",
  // 3.2 Médailles (communes à tous les jeux)
  "dj-diamant": "#4FC3DC",
  "dj-diamant-texte": "#0B2530",
  "dj-or": "#D9A21B",
  "dj-argent": "#A7A9AC",
  "dj-bronze": "#C07A42",
  "dj-medaille-texte": "--dj-encre",
  // 3.3 Étiquette Track
  "track-asphalte": "#1E1B19",
  "track-coque": "#4A4440",
  "track-route": "#5A524C",
  "track-piste": "#26221F",
  "track-texte": "#F4EFE6",
  "track-texte-doux": "#CFC6BA",
  "track-livree": "#E8552D",
  "track-livree-texte": "#FF8A5C",
  "track-livree-ombre": "#8E2E14",
  // 3.4 Étiquette Jump
  "jump-jaune": "#FFD23F",
  "jump-papier": "--dj-papier",
  "jump-encre": "--dj-encre",
  "jump-danger": "#D7263D",
  // 3.5 Étiquette Tower (charte rév. 13)
  "tower-menthe": "#9ED9BE",
  "tower-coque": "#2F7D62",
  "tower-bonus": "#5DBB63",
} as const;

/** Polices (charte § 4) : la famille, puis le repli générique pendant le chargement (`font-display: swap`). */
export const POLICES = {
  "dj-police-marque": "\"Archivo Black\", \"Archivo\", sans-serif",
  "dj-police-texte": "\"Archivo\", sans-serif",
  "dj-police-chiffres": "\"JetBrains Mono\", monospace",
  "track-police": "\"Barlow Condensed\", \"Archivo\", sans-serif",
  "jump-police": "\"Lilita One\", \"Archivo\", sans-serif",
  "tower-police": "\"Rubik Mono One\", \"Archivo\", sans-serif",
} as const;

/** Échelle typographique (charte § 4) : 12 · 13 · 15 · 22 · 24 · 32 · 38 · 64-72 px ; 10-11 px pour les seules légendes en capitales (700). */
export const TAILLES = {
  "dj-taille-legende": "11px",
  "dj-taille-legende-petite": "10px",
  "dj-taille-12": "12px",
  "dj-taille-13": "13px",
  "dj-taille-14": "14px",
  "dj-taille-15": "15px",
  "dj-taille-16": "16px",
  "dj-taille-21": "21px",
  "dj-taille-22": "22px",
  "dj-taille-24": "24px",
  "dj-taille-32": "32px",
  "dj-taille-38": "38px",
  "dj-taille-64": "64px",
  "dj-taille-72": "72px",
} as const;

/** Rayons (charte § 5 : jamais uniformes). */
export const RAYONS = {
  "dj-rayon-bouton": "3px",
  "dj-rayon-etiquette": "3px",
  "dj-rayon-tuile": "4px",
  "dj-rayon-afficheur": "6px",
  "dj-rayon-coque": "12px 12px 3px 3px",
  "dj-rayon-avatar": "50%",
} as const;

/** Épaisseurs de trait et décalages. */
export const TRAITS = {
  "dj-trait": "2px",
  "dj-trait-fort": "3px",
  "dj-trait-icone": "2.25px",
  "dj-enfonce": "2px",
  "dj-focus": "3px",
  "dj-focus-ecart": "2px",
} as const;

/** Ombres, toujours nettes (charte § 5) ; les épaisseurs de boutons de jeu (§ 5, « Bouton »). */
export const OMBRES = {
  "dj-ombre-cartouche": "4px 4px 0 var(--dj-encre)",
  "dj-ombre-cartouche-enfoncee": "2px 2px 0 var(--dj-encre)",
  "dj-ombre-logo": "3px 3px 0 var(--dj-terre)",
  "dj-ombre-bouton": "2px 2px 0 var(--dj-encre)",
  "dj-ombre-afficheur": "inset 0 3px 0 var(--dj-ecran-ombre), inset 0 -2px 0 var(--dj-ecran-reflet)",
  "track-epaisseur-courir": "0 4px 0 var(--track-livree-ombre)",
  "jump-epaisseur-jouer": "0 5px 0 var(--dj-terre)",
  "jump-ombre-titre": "4px 4px 0 var(--dj-papier)",
  "tower-epaisseur-jouer": "0 5px 0 var(--tower-coque)",
  "tower-ombre-titre": "4px 4px 0 var(--dj-papier)",
} as const;

/** Espacements (multiples de la maquette). */
export const ESPACES = {
  "dj-espace-1": "4px",
  "dj-espace-2": "6px",
  "dj-espace-3": "8px",
  "dj-espace-4": "10px",
  "dj-espace-5": "12px",
  "dj-espace-6": "14px",
  "dj-espace-7": "16px",
  "dj-espace-8": "24px",
  "dj-espace-9": "40px",
  "dj-marge": "16px",
  "dj-largeur-portail": "720px",
  "dj-stries-retrait": "40px",
} as const;

/** Cibles tactiles (charte § 5 et § 10). */
export const CIBLES = {
  "dj-cible": "44px",
  "dj-cible-portail": "46px",
  "dj-cible-jeu": "56px",
} as const;

/** Durées (charte § 8 : 120 à 200 ms, mécaniques). */
export const DUREES = {
  "dj-duree-courte": "120ms",
  "dj-duree": "160ms",
  "dj-duree-longue": "200ms",
} as const;

/** Tous les jetons, par famille, dans l'ordre du fichier CSS. */
export const JETONS = { COULEURS, POLICES, TAILLES, RAYONS, TRAITS, OMBRES, ESPACES, CIBLES, DUREES } as const;

type Familles = typeof JETONS;
export type NomJeton = { [F in keyof Familles]: keyof Familles[F] }[keyof Familles] & string;
export type NomCouleur = keyof typeof COULEURS;

// Lue à la demande (`tous()`), pas au chargement du module : un `Object.assign({}, ...Object.values(JETONS))` en tête de module garde dans le JavaScript de chaque application,
// même sans appel à `valeurJeton`, toute la table des jetons (le résultat de la décomposition `...` ne peut pas être écarté ; lot T1 : mesuré sur Track, +115 o par six jetons).
let TOUS: Record<string, string> | undefined;
const tous = (): Record<string, string> => (TOUS ??= Object.assign({}, ...Object.values(JETONS)));

/** La valeur d'un jeton, renvois résolus (`jump-papier` → `#FFF6E0`). */
export function valeurJeton(nom: NomJeton): string {
  const table = tous();
  let v = table[nom];
  for (let i = 0; v !== undefined && v.startsWith("--") && i < 8; i++) v = table[v.slice(2)];
  if (v === undefined) throw new Error(`jeton inconnu : ${nom}`);
  return v;
}

/** `var(--nom)` : pour les styles posés par les composants (jamais une valeur en dur). */
export function varJeton(nom: NomJeton): string {
  return `var(--${nom})`;
}

/** Le fichier `jetons.css` : les propriétés de `:root`, générées depuis cette source. */
export function cssDesJetons(): string {
  const lignes = [
    "/* Généré depuis packages/ui/src/jetons.ts (lot I1) : ne pas modifier à la main.",
    "   MAJ_JETONS=1 npx vitest run packages/ui/test/jetons.test.ts le réécrit. */",
    ":root {",
  ];
  for (const [famille, valeurs] of Object.entries(JETONS)) {
    lignes.push(`  /* ${famille.toLowerCase()} */`);
    for (const [nom, v] of Object.entries(valeurs)) lignes.push(`  --${nom}: ${v.startsWith("--") ? `var(${v})` : v};`);
  }
  lignes.push("}");
  return lignes.join("\n") + "\n";
}
