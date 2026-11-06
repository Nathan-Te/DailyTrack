import { BORNES, REGLAGES_DEFAUT, type Reglages } from "@cdj/rush-sim";
import { BORNES_SENSATIONS, SENSATIONS_DEFAUT, type Sensations } from "./sensations";

// Le panneau des sensations (`?debug&tune`, jamais en production) : des curseurs pour la simulation (vitesse, portée, cadence du coup, recul, fenêtre d'esquive, vie et cadence du golem, RYTHME des ennemis — changer l'un relance
// la partie, qui n'est alors pas classable) et pour ce que le joueur voit (arrêt sur image, secousse, éclats, caméra : angle, distance, champ ; éclair — en direct). « Exporter » écrit les réglages en JSON, que Nathan colle dans un lot (ou dans
// l'adresse : `&reglages=`).
type Traduire = (cle: string, params?: Readonly<Record<string, string | number>>) => string;

interface Curseur {
  cle: string;
  groupe: "sim" | "vue";
  libelle: string;
  min: number;
  max: number;
}
const CURSEURS: Curseur[] = [
  { cle: "vitesse", groupe: "sim", libelle: "tune.vitesse", min: BORNES.vitesse[0], max: BORNES.vitesse[1] },
  { cle: "portee", groupe: "sim", libelle: "tune.portee", min: BORNES.portee[0], max: BORNES.portee[1] },
  { cle: "arc", groupe: "sim", libelle: "tune.arc", min: BORNES.arc[0], max: BORNES.arc[1] },
  { cle: "cadence", groupe: "sim", libelle: "tune.cadence", min: BORNES.cadence[0], max: BORNES.cadence[1] },
  { cle: "anticipation", groupe: "sim", libelle: "tune.anticipation", min: BORNES.anticipation[0], max: BORNES.anticipation[1] },
  { cle: "degats", groupe: "sim", libelle: "tune.degats", min: BORNES.degats[0], max: BORNES.degats[1] },
  { cle: "coupFinal", groupe: "sim", libelle: "tune.coupFinal", min: BORNES.coupFinal[0], max: BORNES.coupFinal[1] },
  { cle: "engagement", groupe: "sim", libelle: "tune.engagement", min: BORNES.engagement[0], max: BORNES.engagement[1] },
  { cle: "recul", groupe: "sim", libelle: "tune.recul", min: BORNES.recul[0], max: BORNES.recul[1] },
  { cle: "fenetreEsquive", groupe: "sim", libelle: "tune.fenetreEsquive", min: BORNES.fenetreEsquive[0], max: BORNES.fenetreEsquive[1] },
  { cle: "golemVie", groupe: "sim", libelle: "tune.golemVie", min: BORNES.golemVie[0], max: BORNES.golemVie[1] },
  { cle: "golemCadence", groupe: "sim", libelle: "tune.golemCadence", min: BORNES.golemCadence[0], max: BORNES.golemCadence[1] },
  { cle: "rythme", groupe: "sim", libelle: "tune.rythme", min: BORNES.rythme[0], max: BORNES.rythme[1] },
  { cle: "courseDelai", groupe: "sim", libelle: "tune.courseDelai", min: BORNES.courseDelai[0], max: BORNES.courseDelai[1] },
  { cle: "courseMontee", groupe: "sim", libelle: "tune.courseMontee", min: BORNES.courseMontee[0], max: BORNES.courseMontee[1] },
  { cle: "courseFacteur", groupe: "sim", libelle: "tune.courseFacteur", min: BORNES.courseFacteur[0], max: BORNES.courseFacteur[1] },
  { cle: "courseRayon", groupe: "sim", libelle: "tune.courseRayon", min: BORNES.courseRayon[0], max: BORNES.courseRayon[1] },
  { cle: "arretImage", groupe: "vue", libelle: "tune.arretImage", min: BORNES_SENSATIONS.arretImage[0], max: BORNES_SENSATIONS.arretImage[1] },
  { cle: "arretPhase", groupe: "vue", libelle: "tune.arretPhase", min: BORNES_SENSATIONS.arretPhase[0], max: BORNES_SENSATIONS.arretPhase[1] },
  { cle: "secousse", groupe: "vue", libelle: "tune.secousse", min: BORNES_SENSATIONS.secousse[0], max: BORNES_SENSATIONS.secousse[1] },
  { cle: "eclats", groupe: "vue", libelle: "tune.eclats", min: BORNES_SENSATIONS.eclats[0], max: BORNES_SENSATIONS.eclats[1] },
  { cle: "angle", groupe: "vue", libelle: "tune.angle", min: BORNES_SENSATIONS.angle[0], max: BORNES_SENSATIONS.angle[1] },
  { cle: "distance", groupe: "vue", libelle: "tune.distance", min: BORNES_SENSATIONS.distance[0], max: BORNES_SENSATIONS.distance[1] },
  { cle: "champ", groupe: "vue", libelle: "tune.champ", min: BORNES_SENSATIONS.champ[0], max: BORNES_SENSATIONS.champ[1] },
  { cle: "eclair", groupe: "vue", libelle: "tune.eclair", min: BORNES_SENSATIONS.eclair[0], max: BORNES_SENSATIONS.eclair[1] },
];

export interface EtatTune {
  reglages: Reglages;
  sensations: Sensations;
}
export interface Tune {
  detruire(): void;
}

export function monterTune(hote: HTMLElement, t: Traduire, etat: EtatTune, surSimulation: (r: Reglages) => void, surSensations: (s: Sensations) => void): Tune {
  const ouvrir = document.createElement("button");
  ouvrir.type = "button";
  ouvrir.className = "rush-tune__ouvrir";
  ouvrir.textContent = t("tune.ouvrir");
  const panneau = document.createElement("div");
  panneau.className = "rush-tune";
  panneau.hidden = true;
  const titre = document.createElement("h3");
  titre.textContent = t("tune.titre");
  const note = document.createElement("div");
  note.textContent = t("tune.note");
  panneau.append(titre, note);
  const valeurs = new Map<string, HTMLElement>();
  const entrees = new Map<string, HTMLInputElement>();
  const lire = (c: Curseur): number => (c.groupe === "sim" ? etat.reglages[c.cle as keyof Reglages] : etat.sensations[c.cle as keyof Sensations]);
  for (const c of CURSEURS) {
    const l = document.createElement("label");
    const nom = document.createElement("span");
    nom.textContent = t(c.libelle);
    const v = document.createElement("span");
    const r = document.createElement("input");
    r.type = "range";
    r.min = String(c.min);
    r.max = String(c.max);
    r.step = "1";
    r.value = String(lire(c));
    v.textContent = r.value;
    r.addEventListener("input", () => {
      const n = Number(r.value);
      v.textContent = r.value;
      if (c.groupe === "sim") {
        etat.reglages = { ...etat.reglages, [c.cle]: n };
        surSimulation(etat.reglages);
      } else {
        etat.sensations = { ...etat.sensations, [c.cle]: n };
        surSensations(etat.sensations);
      }
    });
    l.append(nom, v, r);
    panneau.append(l);
    valeurs.set(c.cle, v);
    entrees.set(c.cle, r);
  }
  const json = document.createElement("textarea");
  json.readOnly = true;
  json.hidden = true;
  json.setAttribute("aria-label", t("tune.json"));
  const actions = document.createElement("div");
  actions.className = "rush-tune__actions";
  const exporter = document.createElement("button");
  exporter.type = "button";
  exporter.textContent = t("tune.exporter");
  exporter.addEventListener("click", () => {
    json.value = JSON.stringify({ reglages: etat.reglages, sensations: etat.sensations });
    json.hidden = false;
    json.select();
    void navigator.clipboard?.writeText(json.value).then(
      () => (exporter.textContent = t("tune.copie")),
      () => undefined,
    );
  });
  const retablir = document.createElement("button");
  retablir.type = "button";
  retablir.textContent = t("tune.retablir");
  retablir.addEventListener("click", () => {
    etat.reglages = { ...REGLAGES_DEFAUT };
    etat.sensations = { ...SENSATIONS_DEFAUT };
    for (const c of CURSEURS) {
      entrees.get(c.cle)!.value = String(lire(c));
      valeurs.get(c.cle)!.textContent = String(lire(c));
    }
    surSimulation(etat.reglages);
    surSensations(etat.sensations);
  });
  const fermer = document.createElement("button");
  fermer.type = "button";
  fermer.textContent = t("tune.fermer");
  fermer.addEventListener("click", () => {
    panneau.hidden = true;
    ouvrir.hidden = false;
  });
  actions.append(exporter, retablir, fermer);
  panneau.append(actions, json);
  ouvrir.addEventListener("click", () => {
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
