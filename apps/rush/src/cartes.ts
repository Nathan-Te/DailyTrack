import { AMELIORATIONS, BOSS, BOSS_IDS, COMPETENCES, idiv, type Famille, type Reglages } from "@cdj/rush-sim";
import { cleBoss } from "./bosses";
import type { CarteVue } from "./interface";

// Les cartes du choix d'amélioration (lot BR2), côté vue : l'icône de chacune (un tracé dans une grille de 24, des traits comme tous les pictogrammes du jeu), les nombres que son effet écrit (lus dans les RÉGLAGES de la partie : un curseur
// de `?debug&tune` change le texte avec la force) et la carte prête à afficher. **Les textes sont ceux du catalogue** (`carte.<id avec _>.nom`, `carte.<id avec _>.effet` : `lame_lourde`…).
const ICONES: Readonly<Record<string, string>> = {
  "lame-lourde": "M12 2 L17 8 L12 18 L7 8 Z M5 18 L19 18 M12 18 L12 22",
  allonge: "M3 12 L21 12 M16 7 L21 12 L16 17 M3 8 L3 16",
  cadence: "M13 2 L5 13 L11 13 L9 22 L19 9 L13 9 Z",
  moulinet: "M12 3 A9 9 0 1 1 3 12 M12 7 A5 5 0 1 1 7 12 M12 11 A1.5 1.5 0 1 1 10.5 12.5",
  "onde-epee": "M4 19 Q12 1 20 19 M8 19 Q12 9 16 19",
  "bottes-legeres": "M7 3 L12 3 L12 12 L20 15 L20 20 L5 20 L5 12 Z",
  "esquive-longue": "M3 12 L17 12 M12 7 L17 12 L12 17 M3 6 L9 6 M3 18 L9 18",
  "esquive-vive": "M12 6 A8 8 0 1 0 12.01 6 M12 10 L12 14 L15 14 M9 2 L15 2",
  "esquive-tranchante": "M3 20 L20 3 M9 20 L20 9 M3 14 L14 3",
  "coeur-en-plus": "M12 21 C5 15 2.5 11.5 2.5 8 C2.5 5 4.8 3 7.4 3 C9.3 3 11 4 12 5.8 C13 4 14.7 3 16.6 3 C19.2 3 21.5 5 21.5 8 C21.5 11.5 19 15 12 21 Z",
  soin: "M9 3 L15 3 L15 9 L21 9 L21 15 L15 15 L15 21 L9 21 L9 15 L3 15 L3 9 L9 9 Z",
  "vol-de-vie": "M12 3 C12 3 5 11 5 15 A7 7 0 0 0 19 15 C19 11 12 3 12 3 Z",
  "brise-pierre": "M4 20 L10 8 L16 12 L12 20 Z M14 4 L21 11",
  aimant: "M5 4 L5 13 A7 7 0 0 0 19 13 L19 4 M5 8 L9 8 M15 8 L19 8",
  // Lot BR5 : les cartes de compétence.
  "recharge-vive": "M12 2 C12 7 7 9 7 14 A5 5 0 0 0 17 14 C17 11 15 10 14 8 C14 11 12 11 12 8 Z",
  maitrise: "M12 3 L14.6 9 L21 9.6 L16.2 13.8 L17.6 20 L12 16.8 L6.4 20 L7.8 13.8 L3 9.6 L9.4 9 Z",
  echo: "M3 12 A9 9 0 0 1 12 3 M21 12 A9 9 0 0 1 12 21 M7 12 A5 5 0 0 1 12 7 M17 12 A5 5 0 0 1 12 17 M12 11 L12 13",
  signature: "M4 20 L8 20 L19 9 L15 5 L4 16 Z M13 7 L17 11",
  // Lot BR6 : les cartes de fin de partie.
  frenesie: "M13 2 L4 14 L10 14 L8 22 L20 9 L13 9 L16 2 Z",
  "lame-enflammee": "M12 2 C14 6 18 8 18 13 A6 6 0 0 1 6 13 C6 10 8 9 9 7 C10 9 11 9 12 2 Z M12 20 L12 14",
  ecrasement: "M5 4 L19 4 L19 9 L5 9 Z M12 9 L12 20 M7 20 L17 20",
  "seconde-charge": "M6 4 A4 4 0 1 1 6 12 A4 4 0 1 1 6 4 M16 12 A4 4 0 1 1 16 20 A4 4 0 1 1 16 12 M9 10 L13 14",
  "bond-sismique": "M3 18 Q12 0 21 18 M6 20 L18 20 M2 15 L5 17 M22 15 L19 17",
  "bouclier-ricochet": "M5 5 L12 12 L5 19 M12 12 L19 5 M19 5 L19 10 M19 5 L14 5",
};
/** Lot BR5 : l'icône de chacune des trois compétences (dans l'ordre de `COMPETENCES`). */
const ICONES_COMPETENCES: readonly string[] = ["M12 3 A9 9 0 1 1 3 12 M12 7 A5 5 0 1 1 7 12 M12 11 A1.5 1.5 0 1 1 10.5 12.5", "M3 18 Q12 -2 21 18 M17 14 L21 18 L15 19", "M12 3 L20 6 L20 12 C20 17 16 20 12 22 C8 20 4 17 4 12 L4 6 Z M12 7 L12 17"];

/** Les nombres que l'effet de chaque carte écrit (`{n}`, `{m}`) : ceux des réglages. */
const NOMBRES: Readonly<Record<string, (r: Reglages) => Record<string, number | string>>> = {
  "lame-lourde": (r) => ({ n: r.lourdeDegats }),
  allonge: (r) => ({ n: r.allongePortee }),
  cadence: (r) => ({ n: r.cadenceGain }),
  "onde-epee": (r) => ({ n: r.ondeDegats }),
  "bottes-legeres": (r) => ({ n: r.bottesVitesse }),
  "esquive-longue": (r) => ({ n: r.esquiveLongue }),
  "esquive-vive": (r) => ({ n: (r.esquiveVive / 60).toFixed(1) }),
  "vol-de-vie": (r) => ({ n: r.volVie }),
  aimant: (r) => ({ n: r.aimantGain }),
  "recharge-vive": (r) => ({ n: r.rechargeVive }),
  maitrise: (r) => ({ n: r.maitriseDegats, m: r.maitriseZone }),
  frenesie: (r) => ({ n: r.frenesieGain }),
  ecrasement: (r) => ({ n: r.ecrasementDegats }),
  "bouclier-ricochet": (r) => ({ n: r.ricochetRebonds }),
};

type Traduire = (cle: string, params?: Readonly<Record<string, string | number>>) => string;

/**
 * La carte `i` du catalogue, prête à afficher ; `palier` : combien de fois elle est déjà prise. `boss` (lot BR4) : l'indice du boss du jour — « Brise-pierre » dit sa valeur CONTRE CE BOSS (« +90 % contre le golem », « +31 % contre la reine gelée » :
 * le pourcentage par palier est `briseDegats` × la part que le boss encaisse, `BOSS[].brise`, comme la simulation le compte) ; sans boss (aucun : un essai sans combat), « le boss du jour » et le plein pourcentage.
 */
export function carteVue(i: number, palier: number, r: Reglages, t: Traduire, boss = -1, competence = 0): CarteVue {
  const a = AMELIORATIONS[i]!;
  const def = BOSS[boss];
  const famille: Famille = a.famille;
  const cle = a.id.replace(/-/g, "_"); // une clé de catalogue n'a pas de tiret
  const place = a.max === Infinity ? "" : a.max === 1 ? t("choix.unique") : t("choix.palier", { n: palier + 1, max: a.max });
  // « Signature » dit ce qu'elle fait pour la compétence choisie au départ.
  const sig = a.id === "signature" ? signature(competence, r, t) : "";
  const nombres = a.id === "signature" ? { sig } : a.id === "brise-pierre" ? { n: idiv(r.briseDegats * (def?.brise ?? 100), 100), boss: t(`boss.contre.${def ? cleBoss(BOSS_IDS[boss]!) : "tous"}`) } : (NOMBRES[a.id]?.(r) ?? {});
  return { id: a.id, nom: t(`carte.${cle}.nom`), effet: t(`carte.${cle}.effet`, nombres), palier: place, icone: ICONES[a.id]!, famille };
}

/** Lot BR5 : l'effet de « Signature » pour la compétence `c` : le tourbillon dure plus, le bond étourdit plus longtemps, le bouclier traverse plus d'ennemis. */
function signature(c: number, r: Reglages, t: Traduire): string {
  const id = COMPETENCES[c] ?? COMPETENCES[0];
  return t(`signature.${id}`, { n: id === "tourbillon" ? r.signatureTourbillon : id === "bond" ? (r.signatureBond / 60).toFixed(1) : r.signatureBouclier });
}

/** Lot BR5 : la carte de la compétence `i` (0 à 2) de l'écran de départ : son nom, son effet écrit avec les réglages, son icône. */
export function competenceVue(i: number, r: Reglages, t: Traduire): CarteVue {
  const id = COMPETENCES[i]!;
  const n = id === "tourbillon" ? (r.tourbillonDuree / 60).toFixed(1) : id === "bond" ? (r.bondPortee / 100).toFixed(0) : r.bouclierCibles;
  return { id, nom: t(`comp.${id}.nom`), effet: t(`comp.${id}.effet`, { n }), palier: "", icone: ICONES_COMPETENCES[i]!, famille: "competence" };
}
