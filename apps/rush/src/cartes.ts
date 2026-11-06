import { AMELIORATIONS, type Famille, type Reglages } from "@cdj/rush-sim";
import type { CarteVue } from "./interface";

// Les cartes du choix d'amélioration (lot BR2), côté vue : l'icône de chacune (un tracé dans une grille de 24, des traits comme tous les pictogrammes du jeu), les nombres que son effet écrit (lus dans les RÉGLAGES de la partie : un curseur
// de `?debug&tune` change le texte avec la force) et la carte prête à afficher. **Les textes sont ceux du catalogue** (`carte.<id avec _>.nom`, `carte.<id avec _>.effet` : `lame_lourde`…).
const ICONES: Readonly<Record<string, string>> = {
  "lame-lourde": "M12 2 L17 8 L12 18 L7 8 Z M5 18 L19 18 M12 18 L12 22",
  allonge: "M3 12 L21 12 M16 7 L21 12 L16 17 M3 8 L3 16",
  cadence: "M13 2 L5 13 L11 13 L9 22 L19 9 L13 9 Z",
  tourbillon: "M12 3 A9 9 0 1 1 3 12 M12 7 A5 5 0 1 1 7 12 M12 11 A1.5 1.5 0 1 1 10.5 12.5",
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
};

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
  "brise-pierre": (r) => ({ n: r.briseDegats }),
  aimant: (r) => ({ n: r.aimantGain }),
};

type Traduire = (cle: string, params?: Readonly<Record<string, string | number>>) => string;

/** La carte `i` du catalogue, prête à afficher ; `palier` : combien de fois elle est déjà prise. */
export function carteVue(i: number, palier: number, r: Reglages, t: Traduire): CarteVue {
  const a = AMELIORATIONS[i]!;
  const famille: Famille = a.famille;
  const cle = a.id.replace(/-/g, "_"); // une clé de catalogue n'a pas de tiret
  const place = a.max === Infinity ? "" : a.max === 1 ? t("choix.unique") : t("choix.palier", { n: palier + 1, max: a.max });
  return { id: a.id, nom: t(`carte.${cle}.nom`), effet: t(`carte.${cle}.effet`, NOMBRES[a.id]?.(r) ?? {}), palier: place, icone: ICONES[a.id]!, famille };
}
