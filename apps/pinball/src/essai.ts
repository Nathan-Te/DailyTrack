// Les options d'ESSAI de Pinball lues dans l'adresse (lot PB2). **Jamais sur la production** (`restreint`, règle R9) : une adresse qui change la partie la rend non classable.
//   · `?debug&tune` : le panneau des réglages (la simulation, la vue) ; `&reglages=<JSON>` : des réglages collés (ceux que « Exporter » écrit) ;
//   · `?qualite=haute|basse` : le niveau de rendu (haute : three.js ; basse : le rendu à plat de secours, sans three.js). Sans le paramètre : haute, avec un passage automatique en basse si l'appareil est lent (jamais s'il est
//     seulement bridé à 30 images par seconde : `@cdj/core/bridage`) ;
//   · `?debug&fps` : l'affichage des images par seconde et de la durée d'une image ;
//   · `?essai=mission` (lot PB3) : la partie commence au but de la mission moins un, pour voir tout de suite le moment fort (jamais classée) ;
//   · `?debug&sons` (lot PBS1) : la table des sons, un panneau où chaque bouton joue un son (jamais en production) ;
//   · `?robot` (lot PB4) : on regarde le robot jouer la table du jour (sa première partie ; `?robot=2` : la troisième) avec la mention « Le robot joue » ; `?jour=AAAA-MM-JJ&robot` pour un autre jour (jamais classé).
// Ce fichier est dans le premier chargement (la définition y lit `classable`) : **il ne fait que lire l'adresse**, tout le reste (bornes, validation, panneau) est à la demande.
export type Qualite = "haute" | "basse";

export interface Essai {
  tune: boolean;
  fps: boolean;
  /** `?debug&sons` (lot PBS1) : le panneau de la table des sons. */
  sons: boolean;
  /** Le niveau de rendu imposé par l'adresse, ou `null` (haute, avec le passage automatique en basse). */
  qualite: Qualite | null;
  /** Les réglages collés dans l'adresse (le JSON lu, non vérifié : `bornes.ts` le fait, à la demande), ou `null`. */
  reglages: unknown;
  /** `?essai=mission` : la mission commence au but moins un. */
  mission: boolean;
  /** `?robot` (lot PB4) : le rang de la partie du robot qu'on regarde (0 : la première), ou `null`. */
  robot: number | null;
  /** Vrai dès qu'une option change la partie : elle n'est alors pas classable. */
  essai: boolean;
}

export function lireEssai(search: string, restreint: boolean): Essai {
  const vide: Essai = { tune: false, fps: false, sons: false, qualite: null, reglages: null, mission: false, robot: null, essai: false };
  if (restreint) return vide;
  const q = new URLSearchParams(search);
  const debug = q.has("debug");
  let reglages: unknown = null;
  const brut = q.get("reglages");
  if (brut) {
    try {
      reglages = JSON.parse(brut);
    } catch {
      /* un JSON abîmé : les réglages par défaut */
    }
  }
  const niveau = q.get("qualite");
  const tune = debug && q.has("tune");
  const mission = q.get("essai") === "mission";
  // `?robot` seul : sa première partie ; `?robot=2` : la troisième ; une valeur qui n'est pas un petit entier : la première
  const brutRobot = q.get("robot");
  const rang = brutRobot === null || brutRobot === "" ? 0 : Number(brutRobot);
  const robot = q.has("robot") ? (Number.isInteger(rang) && rang >= 0 && rang < 100 ? rang : 0) : null;
  return { tune, fps: debug && q.has("fps"), sons: debug && q.has("sons"), qualite: niveau === "haute" || niveau === "basse" ? niveau : null, reglages, mission, robot, essai: tune || reglages !== null || mission || robot !== null };
}
