import { REGLAGES, reglagesDe, type Reglages } from "@cdj/pilepoil-sim";
import "./tune.css";

// Le panneau des réglages de « Pile poil » (`?debug&tune`, jamais en production), repris de la maquette : un curseur par réglage, « Exporter en JSON » et « Valeurs de départ ». Un réglage changé recommence la
// partie ; elle n'est alors jamais classée (`classable` de la définition, le kit le dit à la fin). Ce fichier est à la demande et ne pèse que dans l'essai : ses libellés sont ici, pas dans les catalogues.
type Langue = "fr" | "en";
/** Libellés (fr, en), minimum, maximum et pas de chaque curseur : ceux de la maquette, plus la fin de jauge sans appui. */
const CURSEURS: Record<keyof Reglages, [string, string, number, number, number]> = {
  vitesseDebut: ["Vitesse, 1re jauge", "Speed, 1st gauge", 500, 6000, 50], // i18n-ok: panneau d'essai (`?debug&tune`), deux langues ici, absent de la production
  vitesseFin: ["Vitesse, 10e jauge", "Speed, 10th gauge", 1000, 12000, 50], // i18n-ok: panneau d'essai
  demiCibleDebut: ["Demi-cible, 1re", "Half target, 1st", 20000, 250000, 1000], // i18n-ok: panneau d'essai
  demiCibleFin: ["Demi-cible, 10e", "Half target, 10th", 8000, 150000, 1000], // i18n-ok: panneau d'essai
  parfait: ["Tolérance « pile »", "“Pile” tolerance", 1000, 30000, 500], // i18n-ok: panneau d'essai
  bonusParfait: ["Bonus du pile", "Pile bonus", 0, 200, 5], // i18n-ok: panneau d'essai
  bonusEnchaine: ["+ par pile d'affilée", "+ per pile in a row", 0, 100, 5], // i18n-ok: panneau d'essai
  pauseResultat: ["Pause entre jauges (pas)", "Pause between gauges (steps)", 20, 160, 2], // i18n-ok: panneau d'essai
  bougeDes: ["La cible bouge dès la jauge", "Target moves from gauge", 1, 11, 1], // i18n-ok: panneau d'essai
  ampliBouge: ["Amplitude du mouvement", "Movement amplitude", 0, 400000, 5000], // i18n-ok: panneau d'essai
  vitesseBouge: ["Vitesse du mouvement", "Movement speed", 0, 120, 1], // i18n-ok: panneau d'essai
  attenteMax: ["Jauge ratée sans appui après (pas)", "Gauge missed without a press after (steps)", 240, 3600, 60], // i18n-ok: panneau d'essai
};
const TEXTES = {
  fr: { titre: "Réglages (?tune)", note: "Un réglage changé recommence la partie : elle n'est pas classée.", exporter: "Exporter JSON", defaut: "Valeurs de départ" }, // i18n-ok: panneau d'essai (`?debug&tune`)
  en: { titre: "Tuning (?tune)", note: "Changing a setting restarts the game: it is not ranked.", exporter: "Export JSON", defaut: "Starting values" }, // i18n-ok: panneau d'essai (`?debug&tune`)
} as const;

export function monterTune(langue: Langue, depart: Readonly<Reglages>, surChangement: (r: Reglages) => void): { detruire(): void } {
  const tx = TEXTES[langue];
  const l = langue === "en" ? 1 : 0;
  let r: Reglages = reglagesDe(depart);
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, classe = "", texte?: string): HTMLElementTagNameMap[K] => {
    const e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texte !== undefined) e.textContent = texte;
    return e;
  };
  const panneau = el("aside", "pilepoil-tune");
  panneau.append(el("h4", "", tx.titre), el("p", "", tx.note));
  const champs: [keyof Reglages, HTMLInputElement, HTMLOutputElement][] = [];
  for (const [cle, [fr, en, min, max, pas]] of Object.entries(CURSEURS) as [keyof Reglages, (typeof CURSEURS)[keyof Reglages]][]) {
    const ligne = el("label", "pilepoil-tune__ligne");
    const sortie = el("output", "", String(r[cle]));
    const champ = el("input");
    champ.type = "range";
    champ.min = String(min);
    champ.max = String(max);
    champ.step = String(pas);
    champ.value = String(r[cle]);
    champ.addEventListener("input", () => {
      r = reglagesDe({ ...r, [cle]: Number(champ.value) });
      sortie.textContent = String(r[cle]);
      surChangement({ ...r });
    });
    ligne.append(el("span", "", [fr, en][l]), sortie, champ);
    panneau.append(ligne);
    champs.push([cle, champ, sortie]);
  }
  const sortieJson = el("textarea");
  sortieJson.readOnly = true;
  const exporter = el("button", "", tx.exporter);
  exporter.type = "button";
  exporter.addEventListener("click", () => {
    sortieJson.value = JSON.stringify(r, null, 2);
    sortieJson.select();
  });
  const defaut = el("button", "", tx.defaut);
  defaut.type = "button";
  defaut.addEventListener("click", () => {
    r = { ...REGLAGES };
    for (const [cle, champ, sortie] of champs) {
      champ.value = String(r[cle]);
      sortie.textContent = String(r[cle]);
    }
    surChangement({ ...r });
  });
  panneau.append(exporter, defaut, sortieJson);
  // Un appui dans le panneau ne doit jamais arrêter le curseur ni ouvrir la pause.
  panneau.addEventListener("pointerdown", (e) => e.stopPropagation());
  document.body.append(panneau);
  return { detruire: () => panneau.remove() };
}
