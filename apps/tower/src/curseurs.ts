import { type ReglagesTune, reglagesEssai } from "./reglagesEssai";
import type { VolumesFamilles } from "./sonsLogique";

// Les curseurs de `?debug&tune` (lots T1 et T5) : leur liste, leurs bornes, leurs unités, et le bloc JSON que « Copier les valeurs » donne. **Chargé à la demande, seulement avec `?debug&tune`** (jamais
// dans le jeu d'un joueur : les textes de cet outil sont en français, hors des catalogues). La partie qui décide ce qui est un réglage d'essai est `reglagesEssai.ts`.

export interface Curseur {
  /** La clé du bloc JSON. */
  cle: string;
  nom: string;
  groupe: 1 | 2;
  min: number;
  max: number;
  pas: number;
  unite: string;
  /** Chiffres après la virgule à l'affichage. */
  decimales?: number;
  lire(r: ReglagesTune): number;
  ecrire(r: ReglagesTune, v: number): void;
}

const MS = 1000 / 60;
const famille = (nom: string, cle: keyof VolumesFamilles): Curseur => ({ cle: `volume.${cle}`, nom, groupe: 2, min: 0, max: 1.5, pas: 0.05, unite: "×", decimales: 2, lire: (r) => r.rendu.volumes[cle], ecrire: (r, v) => (r.rendu.volumes[cle] = v) });

/** Tous les curseurs : le groupe 1 (sensation et physique) puis le groupe 2 (rendu et son). */
export const CURSEURS: readonly Curseur[] = [
  { cle: "delaiTicks", nom: "Délai avant répétition", groupe: 1, min: 50, max: 500, pas: MS, unite: "ms", lire: (r) => r.entrees.delaiTicks * MS, ecrire: (r, v) => (r.entrees.delaiTicks = Math.round(v / MS)) },
  { cle: "cadenceTicks", nom: "Cadence de répétition", groupe: 1, min: 17, max: 300, pas: MS, unite: "ms", lire: (r) => r.entrees.cadenceTicks * MS, ecrire: (r, v) => (r.entrees.cadenceTicks = Math.max(1, Math.round(v / MS))) },
  { cle: "vitesseChute8", nom: "Vitesse de chute", groupe: 1, min: 0.5, max: 8, pas: 0.125, unite: "m/s", decimales: 3, lire: (r) => r.sim.vitesseChute8 / 8, ecrire: (r, v) => (r.sim.vitesseChute8 = Math.round(v * 8)) },
  { cle: "facteurDescente", nom: "Facteur de descente", groupe: 1, min: 1, max: 12, pas: 1, unite: "×", lire: (r) => r.sim.facteurDescente, ecrire: (r, v) => (r.sim.facteurDescente = Math.round(v)) },
  { cle: "hauteurApparition8", nom: "Hauteur d'apparition", groupe: 1, min: 2, max: 14, pas: 0.5, unite: "m", decimales: 1, lire: (r) => r.sim.hauteurApparition8 / 8, ecrire: (r, v) => (r.sim.hauteurApparition8 = Math.round(v * 8)) },
  { cle: "physique.frottement", nom: "Frottement (pièces et plateforme)", groupe: 1, min: 0, max: 1.5, pas: 0.05, unite: "", decimales: 2, lire: (r) => r.physique.frottement, ecrire: (r, v) => (r.physique.frottement = v) },
  { cle: "physique.rebond", nom: "Rebond", groupe: 1, min: 0, max: 0.9, pas: 0.05, unite: "", decimales: 2, lire: (r) => r.physique.rebond, ecrire: (r, v) => (r.physique.rebond = v) },
  { cle: "physique.ventPas8", nom: "Force du vent (pas par poussée)", groupe: 1, min: 1, max: 6, pas: 1, unite: "× 12,5 cm", lire: (r) => r.physique.ventPas8, ecrire: (r, v) => (r.physique.ventPas8 = Math.round(v)) },
  { cle: "physique.ventPeriodeTicks", nom: "Période du vent", groupe: 1, min: 2, max: 40, pas: 1, unite: "ticks", lire: (r) => r.physique.ventPeriodeTicks, ecrire: (r, v) => (r.physique.ventPeriodeTicks = Math.round(v)) },
  { cle: "physique.frottementGlissant", nom: "Frottement de la pièce glissante", groupe: 1, min: 0, max: 0.6, pas: 0.01, unite: "", decimales: 2, lire: (r) => r.physique.frottementGlissant, ecrire: (r, v) => (r.physique.frottementGlissant = v) },
  { cle: "physique.echellePetite4", nom: "Taille de la petite pièce", groupe: 1, min: 0.25, max: 1, pas: 0.25, unite: "× la normale", decimales: 2, lire: (r) => r.physique.echellePetite4 / 4, ecrire: (r, v) => (r.physique.echellePetite4 = Math.round(v * 4)) },
  { cle: "physique.echelleGeante4", nom: "Taille de la pièce géante", groupe: 1, min: 1, max: 3, pas: 0.25, unite: "× la normale", decimales: 2, lire: (r) => r.physique.echelleGeante4 / 4, ecrire: (r, v) => (r.physique.echelleGeante4 = Math.round(v * 4)) },
  { cle: "physique.margeContact", nom: "Seuil de contact (lâcher)", groupe: 1, min: 0.005, max: 0.15, pas: 0.005, unite: "m", decimales: 3, lire: (r) => r.physique.margeContact, ecrire: (r, v) => (r.physique.margeContact = v) },
  { cle: "physique.distanceSoudure", nom: "Seuil de contact (soudure)", groupe: 1, min: 0.005, max: 0.1, pas: 0.005, unite: "m", decimales: 3, lire: (r) => r.physique.distanceSoudure, ecrire: (r, v) => (r.physique.distanceSoudure = v) },
  { cle: "rendu.panique", nom: "Panique des yeux", groupe: 2, min: 0, max: 2, pas: 0.05, unite: "×", decimales: 2, lire: (r) => r.rendu.panique, ecrire: (r, v) => (r.rendu.panique = v) },
  { cle: "rendu.secousse", nom: "Secousse de caméra", groupe: 2, min: 0, max: 2, pas: 0.05, unite: "×", decimales: 2, lire: (r) => r.rendu.secousse, ecrire: (r, v) => (r.rendu.secousse = v) },
  { cle: "rendu.cris", nom: "Cris de panique", groupe: 2, min: 0, max: 1, pas: 0.05, unite: "", decimales: 2, lire: (r) => r.rendu.cris, ecrire: (r, v) => ((r.rendu.cris = v), (r.rendu.volumes.cris = v)) },
  { cle: "rendu.inclinaisonVent", nom: "Inclinaison au vent", groupe: 2, min: 0, max: 12, pas: 0.5, unite: "°", decimales: 1, lire: (r) => r.rendu.inclinaisonVent, ecrire: (r, v) => (r.rendu.inclinaisonVent = v) },
  { cle: "rendu.trainees", nom: "Traînées de vent", groupe: 2, min: 0, max: 12, pas: 1, unite: "", lire: (r) => r.rendu.trainees, ecrire: (r, v) => (r.rendu.trainees = Math.round(v)) },
  famille("Volume : clics", "clics"),
  famille("Volume : contacts", "contacts"),
  famille("Volume : paliers", "paliers"),
  famille("Volume : chute et plouf", "chute"),
  famille("Volume : effondrement", "effondrement"),
  famille("Volume : vent", "vent"),
  famille("Volume : fin et médailles", "fin"),
];

/** Le bloc JSON que « Copier les valeurs » donne (un seul bloc, pour le lot T5b) : les clés d'origine du lot T1 à plat, puis la physique, la largeur de plateforme et le rendu. */
export function blocJson(r: ReglagesTune, demiLargeurDuJour: number): string {
  return JSON.stringify({
    delaiTicks: r.entrees.delaiTicks,
    cadenceTicks: r.entrees.cadenceTicks,
    vitesseChute8: r.sim.vitesseChute8,
    facteurDescente: r.sim.facteurDescente,
    hauteurApparition8: r.sim.hauteurApparition8,
    physique: { ...r.physique },
    plateformeDemi8: r.plateformeDemi8 ?? demiLargeurDuJour,
    plateformeForcee: r.plateformeDemi8 !== null,
    rendu: { panique: r.rendu.panique, secousse: r.rendu.secousse, cris: r.rendu.cris, inclinaisonVent: r.rendu.inclinaisonVent, trainees: r.rendu.trainees, volumes: { ...r.rendu.volumes } },
    essai: reglagesEssai(r),
  });
}
