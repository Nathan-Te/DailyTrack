import { type Reglages, REGLAGES_DEFAUT } from "@cdj/tower-sim";
import { el } from "@cdj/ui";
import { ENTREES_DEFAUT, type ReglagesEntrees } from "./entrees";

// Les réglages de sensation (`?debug&tune`, lot T1) — l'outil de Nathan, en français, comme `?debug&tune` de Track et de Jump. Les curseurs sont à Nathan : les valeurs de départ
// ci-dessous sont **provisoires** (un point de départ jouable, pas un réglage « au ressenti »). Les délais de répétition s'appliquent tout de suite ; la vitesse de chute, le facteur de
// descente et la hauteur d'apparition font partie des réglages de la simulation (`Reglages` de `@cdj/tower-sim`) : ils s'appliquent à la **partie suivante** (« Recommencer »). La ligne du
// bas se copie telle quelle pour dire à quelles valeurs la sensation est bonne. Rien n'est gardé dans le navigateur.

export interface ReglagesTune {
  entrees: ReglagesEntrees;
  sim: Reglages;
}

interface Curseur {
  nom: string;
  min: number;
  max: number;
  pas: number;
  unite: string;
  lire(r: ReglagesTune): number;
  ecrire(r: ReglagesTune, v: number): void;
}

const MS = 1000 / 60;
const CURSEURS: Curseur[] = [
  { nom: "Délai avant répétition", min: 50, max: 500, pas: 1000 / 60, unite: "ms", lire: (r) => r.entrees.delaiTicks * MS, ecrire: (r, v) => (r.entrees.delaiTicks = Math.round(v / MS)) },
  { nom: "Cadence de répétition", min: 17, max: 300, pas: 1000 / 60, unite: "ms", lire: (r) => r.entrees.cadenceTicks * MS, ecrire: (r, v) => (r.entrees.cadenceTicks = Math.max(1, Math.round(v / MS))) },
  { nom: "Vitesse de chute", min: 0.5, max: 8, pas: 0.125, unite: "m/s", lire: (r) => r.sim.vitesseChute8 / 8, ecrire: (r, v) => (r.sim.vitesseChute8 = Math.round(v * 8)) },
  { nom: "Facteur de descente", min: 1, max: 12, pas: 1, unite: "×", lire: (r) => r.sim.facteurDescente, ecrire: (r, v) => (r.sim.facteurDescente = Math.round(v)) },
  { nom: "Hauteur d'apparition", min: 2, max: 14, pas: 0.5, unite: "m", lire: (r) => r.sim.hauteurApparition8 / 8, ecrire: (r, v) => (r.sim.hauteurApparition8 = Math.round(v * 8)) },
];

export function reglagesDeDepart(): ReglagesTune {
  return { entrees: { ...ENTREES_DEFAUT }, sim: { ...REGLAGES_DEFAUT } };
}

export function monterTune(racine: HTMLElement, r: ReglagesTune, onRecommencer: () => void): void {
  const resume = el("pre", { classe: "tune__resume" });
  const maj = () => {
    resume.textContent = JSON.stringify({ delaiTicks: r.entrees.delaiTicks, cadenceTicks: r.entrees.cadenceTicks, vitesseChute8: r.sim.vitesseChute8, facteurDescente: r.sim.facteurDescente, hauteurApparition8: r.sim.hauteurApparition8 });
  };
  const lignes = CURSEURS.map((c) => {
    const valeur = el("output", { classe: "tune__valeur" });
    const champ = el("input", { attrs: { type: "range", min: c.min, max: c.max, step: c.pas, value: c.lire(r), "aria-label": c.nom } });
    const montrer = () => {
      const v = c.lire(r);
      valeur.textContent = `${Number.isInteger(v) ? v : v.toFixed(c.unite === "ms" ? 0 : 3).replace(/\.?0+$/, "")} ${c.unite}`;
    };
    champ.addEventListener("input", () => {
      c.ecrire(r, Number(champ.value));
      montrer();
      maj();
    });
    montrer();
    return el("label", { classe: "tune__ligne" }, el("span", { texte: c.nom }), champ, valeur);
  });
  const recommencer = el("button", { classe: "tune__bouton", attrs: { type: "button" }, texte: "Recommencer avec ces réglages" });
  recommencer.addEventListener("click", () => {
    recommencer.blur();
    onRecommencer();
  });
  maj();
  racine.append(el("aside", { classe: "tune", attrs: { id: "tune", "aria-label": "Réglages de sensation" } }, el("strong", { texte: "Sensation (valeurs provisoires)" }), ...lignes, recommencer, resume));
}
