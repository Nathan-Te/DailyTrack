// Les options d'ESSAI de Pinball lues dans l'adresse (lot PB2). **Jamais sur la production** (`restreint`, règle R9) : une adresse qui change la partie la rend non classable.
//   · `?debug&tune` : le panneau des réglages (la simulation, la vue) ; `&reglages=<JSON>` : des réglages collés (ceux que « Exporter » écrit) ;
//   · `?qualite=haute|basse` : le niveau de rendu (haute : three.js ; basse : le rendu à plat de secours, sans three.js). Sans le paramètre : haute, avec un passage automatique en basse si l'appareil est lent (jamais s'il est
//     seulement bridé à 30 images par seconde : `@cdj/core/bridage`) ;
//   · `?debug&fps` : l'affichage des images par seconde et de la durée d'une image ;
//   · `?essai=mission` (lot PB3) : la partie commence au but de la mission moins un, pour voir tout de suite le moment fort (jamais classée) ;
//   · `?essai=verrou` (lot PBG2) : la mission est réussie et le verrou allumé ; `?essai=multibille` : la partie commence en multibille (jamais classés) ;
//   · `?essai=porte` (lot PBG3) : la porte est ouverte ; `?essai=poteau` : le poteau sauveur est armé (jamais classés) ;
//   · `?plan=A|B|C` (lot PBT1 ; PBG1 pour le principe) : cette table (A « Classique », B « Rampe et orbite », C « Mini-batteur ») ce jour-là, **combinable avec `?theme=`** (jamais classée) ; une table inconnue est ignorée par `niveau.ts` (la table du jour) ;
//   · `?miroir` (lot PBT1) : la table jouée en miroir (gauche-droite) ; seul, il reflète la table du jour ; avec `?plan=`, la table demandée en miroir (jamais classé) ;
//   · `?debug&tirs` (lot PBL2) : l'éventail des tirs d'un humain dessiné sur la table — la zone de tir et, en couleur, ce que la bille touche en premier à chaque moment de frappe, avec la fenêtre de chaque objectif en ms (jamais en production) ;
//   · `?debug&sons` (lot PBS1) : la table des sons, un panneau où chaque bouton joue un son (jamais en production) ;
//   · `?robot` (lot PB4) : on regarde le robot jouer la table du jour (sa première partie ; `?robot=2` : la troisième) avec la mention « Le robot joue » ; `?jour=AAAA-MM-JJ&robot` pour un autre jour (jamais classé).
// Ce fichier est dans le premier chargement (la définition y lit `classable`) : **il ne fait que lire l'adresse**, tout le reste (bornes, validation, panneau) est à la demande.
export type Qualite = "haute" | "basse";

export interface Essai {
  tune: boolean;
  fps: boolean;
  /** `?debug&sons` (lot PBS1) : le panneau de la table des sons. */
  sons: boolean;
  /** `?debug&tirs` (lot PBL2) : l'éventail des tirs et les fenêtres de tir de chaque objectif, dessinés sur la table. */
  tirs: boolean;
  /** Le niveau de rendu imposé par l'adresse, ou `null` (haute, avec le passage automatique en basse). */
  qualite: Qualite | null;
  /** Les réglages collés dans l'adresse (le JSON lu, non vérifié : `bornes.ts` le fait, à la demande), ou `null`. */
  reglages: unknown;
  /** `?essai=mission` : la mission commence au but moins un. */
  mission: boolean;
  /** `?essai=verrou` (lot PBG2) : la mission est réussie et le verrou allumé. `?essai=multibille` : la partie commence en multibille. */
  verrou: boolean;
  multibille: boolean;
  /** `?essai=porte` (lot PBG3) : la porte est ouverte. `?essai=poteau` : le poteau sauveur est armé. */
  porte: boolean;
  poteau: boolean;
  /** `?robot` (lot PB4) : le rang de la partie du robot qu'on regarde (0 : la première), ou `null`. */
  robot: number | null;
  /** `?plan=<id>` (lot PBG1) : l'identifiant demandé (une suite de lettres, mis en majuscules : `A`, `B`, `C`), **non vérifié ici** — la liste des tables est à la demande (`niveau.ts` l'ignore s'il est inconnu) —, ou `null`. */
  plan: string | null;
  /** `?miroir` (lot PBT1) : la table est jouée en miroir (non classable). */
  miroir: boolean;
  /** Vrai dès qu'une option change la partie : elle n'est alors pas classable. */
  essai: boolean;
}

export function lireEssai(search: string, restreint: boolean): Essai {
  const vide: Essai = { tune: false, fps: false, sons: false, tirs: false, qualite: null, reglages: null, mission: false, verrou: false, multibille: false, porte: false, poteau: false, robot: null, plan: null, miroir: false, essai: false };
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
  const verrou = q.get("essai") === "verrou";
  const multibille = q.get("essai") === "multibille";
  const porte = q.get("essai") === "porte";
  const poteau = q.get("essai") === "poteau";
  // `?robot` seul : sa première partie ; `?robot=2` : la troisième ; une valeur qui n'est pas un petit entier : la première
  const brutRobot = q.get("robot");
  const rang = brutRobot === null || brutRobot === "" ? 0 : Number(brutRobot);
  const robot = q.has("robot") ? (Number.isInteger(rang) && rang >= 0 && rang < 100 ? rang : 0) : null;
  // `?plan=` : un identifiant en lettres (mis en majuscules : A, B, C) ; autre chose est ignoré. `?miroir` : un drapeau
  const brutPlan = q.get("plan");
  const plan = brutPlan !== null && /^[A-Za-z]{1,20}$/.test(brutPlan) ? brutPlan.toUpperCase() : null;
  const miroir = q.has("miroir") && q.get("miroir") !== "0" && q.get("miroir") !== "false";
  return { tune, fps: debug && q.has("fps"), sons: debug && q.has("sons"), tirs: debug && q.has("tirs"), qualite: niveau === "haute" || niveau === "basse" ? niveau : null, reglages, mission, verrou, multibille, porte, poteau, robot, plan, miroir, essai: tune || reglages !== null || mission || verrou || multibille || porte || poteau || robot !== null || plan !== null || miroir };
}
