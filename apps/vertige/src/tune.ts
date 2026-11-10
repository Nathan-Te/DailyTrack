import { BORNES, CLES_REGLAGES, REGLAGES_DEFAUT, type Reglages } from "@cdj/vertige-sim";
import { BORNES_CONFORT, CONFORT_DEFAUT, type Confort } from "./confort";

// Le panneau des sensations (`?debug&tune`, jamais en production) : un curseur par réglage de la simulation (vitesses, accélération au sol et en l'air, saut, gravité, temps de grâce, saut mémorisé, course sur le mur,
// saut de mur, dash) et par réglage de confort (sensibilité, champ de vision, roulis). Changer un réglage de la simulation recommence le parcours ; la partie n'est alors plus classable. « Exporter » écrit les réglages en
// JSON, que Nathan colle dans un lot (ou dans l'adresse : `&reglages=`). Ce fichier est à la demande et pèse dans le seul essai : ses libellés sont ici, pas dans les catalogues.
type Langue = "fr" | "en";
const NOMS: Record<keyof Reglages, [string, string]> = {
  vitesse: ["Vitesse de course (cm/s)", "Run speed (cm/s)"],
  accelSol: ["Accélération au sol (dixièmes de 1/s)", "Ground acceleration (tenths of 1/s)"],
  accelAir: ["Contrôle en l'air (dixièmes de 1/s)", "Air control (tenths of 1/s)"],
  accelMur: ["Accélération sur le mur (dixièmes de 1/s)", "Wall acceleration (tenths of 1/s)"],
  saut: ["Saut : vitesse (cm/s)", "Jump: speed (cm/s)"],
  gravite: ["Gravité (cm/s²)", "Gravity (cm/s²)"],
  coyote: ["Temps de grâce au bord (ms)", "Coyote time (ms)"],
  tampon: ["Saut mémorisé (ms)", "Jump buffer (ms)"],
  murGravite: ["Mur : gravité restante (%)", "Wall: remaining gravity (%)"],
  murDuree: ["Mur : durée maximale (ms)", "Wall: maximum duration (ms)"],
  murVitesse: ["Mur : vitesse minimale le long (cm/s)", "Wall: minimum speed along (cm/s)"],
  murChute: ["Mur : chute maximale (cm/s)", "Wall: maximum fall (cm/s)"],
  murAttirance: ["Mur : attirance (cm/s²)", "Wall: pull (cm/s²)"],
  sautMurPousse: ["Saut de mur : poussée (cm/s)", "Wall jump: push (cm/s)"],
  sautMurHaut: ["Saut de mur : hauteur (cm/s)", "Wall jump: height (cm/s)"],
  murVerrou: ["Saut de mur : verrou (ms)", "Wall jump: lock (ms)"],
  dashVitesse: ["Dash : vitesse (cm/s)", "Dash: speed (cm/s)"],
  dashDuree: ["Dash : durée (ms)", "Dash: duration (ms)"],
  dashRecharge: ["Dash : recharge (ms)", "Dash: cooldown (ms)"],
};
const CONFORT_NOMS: Record<"sensibilite" | "champ", [string, string]> = { sensibilite: ["Sensibilité (%)", "Sensitivity (%)"], champ: ["Champ de vision (°)", "Field of view (°)"] };
const TEXTES = {
  fr: { ouvrir: "Sensations", titre: "Sensations (essai)", note: "Un réglage de la simulation recommence le parcours : la partie n'est plus classable.", roulis: "Inclinaison sur le mur", exporter: "Exporter en JSON", copie: "Copié", retablir: "Rétablir", fermer: "Fermer" }, // i18n-ok: le panneau d'essai (`?debug&tune`) a ses deux langues ici, il n'existe pas en production
  en: { ouvrir: "Feel", titre: "Feel (test)", note: "Changing a simulation setting restarts the course: the run can no longer be ranked.", roulis: "Tilt on the wall", exporter: "Export as JSON", copie: "Copied", retablir: "Reset", fermer: "Close" }, // i18n-ok: le panneau d'essai (`?debug&tune`) a ses deux langues ici, il n'existe pas en production
} as const;

export interface Tune {
  detruire(): void;
}

export function monterTune(hote: HTMLElement, langue: Langue, etat: { reglages: Reglages; confort: Confort }, surSimulation: (r: Reglages) => void, surConfort: (c: Partial<Confort>) => void, rendreLaSouris: () => void): Tune {
  const i = langue === "en" ? 1 : 0;
  const tx = TEXTES[langue];
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, classe: string, texte?: string): HTMLElementTagNameMap[K] => {
    const e = document.createElement(tag);
    e.className = classe;
    if (texte !== undefined) e.textContent = texte;
    return e;
  };
  const ouvrir = el("button", "vertige-bouton vertige-tune__ouvrir", tx.ouvrir);
  ouvrir.type = "button";
  const panneau = el("div", "vertige-tune");
  panneau.hidden = true;
  panneau.append(el("h3", "", tx.titre), el("p", "", tx.note));
  const champs = new Map<string, HTMLInputElement>();
  const sorties = new Map<string, HTMLElement>();
  const curseur = (cle: string, nom: string, min: number, max: number, valeur: number, change: (v: number) => void): void => {
    const l = el("label", "vertige-tune__ligne");
    const sortie = el("output", "", String(valeur));
    const champ = el("input", "");
    champ.type = "range";
    champ.min = String(min);
    champ.max = String(max);
    champ.step = "1";
    champ.value = String(valeur);
    champ.addEventListener("input", () => {
      sortie.textContent = champ.value;
      change(Number(champ.value));
    });
    l.append(el("span", "", nom), sortie, champ);
    panneau.append(l);
    champs.set(cle, champ);
    sorties.set(cle, sortie);
  };
  for (const k of CLES_REGLAGES) {
    curseur(k, NOMS[k][i], BORNES[k][0], BORNES[k][1], etat.reglages[k], (v) => {
      etat.reglages = { ...etat.reglages, [k]: v };
      surSimulation(etat.reglages);
    });
  }
  for (const k of ["sensibilite", "champ"] as const) {
    curseur(k, CONFORT_NOMS[k][i], BORNES_CONFORT[k][0], BORNES_CONFORT[k][1], etat.confort[k], (v) => {
      etat.confort = { ...etat.confort, [k]: v };
      surConfort({ [k]: v });
    });
  }
  const roulis = el("input", "");
  roulis.type = "checkbox";
  roulis.checked = etat.confort.roulis;
  roulis.addEventListener("change", () => {
    etat.confort = { ...etat.confort, roulis: roulis.checked };
    surConfort({ roulis: roulis.checked });
  });
  const roulisLigne = el("label", "vertige-tune__ligne vertige-tune__ligne--case");
  roulisLigne.append(roulis, el("span", "", tx.roulis));
  panneau.append(roulisLigne);

  const json = el("textarea", "vertige-tune__json");
  json.readOnly = true;
  json.hidden = true;
  const actions = el("div", "vertige-tune__actions");
  const exporter = el("button", "vertige-bouton", tx.exporter);
  exporter.type = "button";
  exporter.addEventListener("click", () => {
    json.value = JSON.stringify({ reglages: etat.reglages, confort: { sensibilite: etat.confort.sensibilite, champ: etat.confort.champ, roulis: etat.confort.roulis } });
    json.hidden = false;
    json.select();
    void navigator.clipboard?.writeText(json.value).then(
      () => (exporter.textContent = tx.copie),
      () => undefined,
    );
  });
  const retablir = el("button", "vertige-bouton", tx.retablir);
  retablir.type = "button";
  retablir.addEventListener("click", () => {
    etat.reglages = { ...REGLAGES_DEFAUT };
    etat.confort = { ...etat.confort, sensibilite: CONFORT_DEFAUT.sensibilite, champ: CONFORT_DEFAUT.champ, roulis: CONFORT_DEFAUT.roulis };
    for (const k of CLES_REGLAGES) {
      champs.get(k)!.value = String(etat.reglages[k]);
      sorties.get(k)!.textContent = String(etat.reglages[k]);
    }
    for (const k of ["sensibilite", "champ"] as const) {
      champs.get(k)!.value = String(etat.confort[k]);
      sorties.get(k)!.textContent = String(etat.confort[k]);
    }
    roulis.checked = etat.confort.roulis;
    surConfort({ sensibilite: etat.confort.sensibilite, champ: etat.confort.champ, roulis: etat.confort.roulis });
    surSimulation(etat.reglages);
  });
  const fermer = el("button", "vertige-bouton", tx.fermer);
  fermer.type = "button";
  fermer.addEventListener("click", () => {
    panneau.hidden = true;
    ouvrir.hidden = false;
  });
  actions.append(exporter, retablir, fermer);
  panneau.append(actions, json);
  ouvrir.addEventListener("click", () => {
    rendreLaSouris();
    panneau.hidden = false;
    ouvrir.hidden = true;
  });
  hote.append(ouvrir, panneau);
  return {
    detruire() {
      ouvrir.remove();
      panneau.remove();
    },
  };
}
