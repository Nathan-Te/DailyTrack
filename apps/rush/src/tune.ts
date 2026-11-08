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
  /** Lot BR5 : le nom du curseur en français et en anglais, quand il n'est pas dans le catalogue (le panneau d'essai ne pèse rien dans le premier chargement). */
  noms?: readonly [string, string];
}
const nouveau = (cle: keyof Reglages, fr: string, en: string): Curseur => ({ cle, groupe: "sim", libelle: "", min: BORNES[cle][0], max: BORNES[cle][1], noms: [fr, en] });
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
  { cle: "xpGelee", groupe: "sim", libelle: "tune.xpGelee", min: BORNES.xpGelee[0], max: BORNES.xpGelee[1] },
  { cle: "xpChauve", groupe: "sim", libelle: "tune.xpChauve", min: BORNES.xpChauve[0], max: BORNES.xpChauve[1] },
  // Lot BR5 : le temps de recharge, les trois compétences, les vases, les gélatons, le coup d'élan et les cartes de compétence.
  nouveau("rechargeTourbillon", "Tourbillon : recharge (ticks)", "Whirlwind: cooldown (ticks)"),
  nouveau("rechargeBond", "Bond : recharge (ticks)", "Leap: cooldown (ticks)"),
  nouveau("rechargeBouclier", "Bouclier : recharge (ticks)", "Shield: cooldown (ticks)"),
  nouveau("rechargeVase", "Recharge rendue par un vase (ticks)", "Cooldown refunded by a vase (ticks)"),
  nouveau("tourbillonDuree", "Tourbillon : durée (ticks)", "Whirlwind: duration (ticks)"),
  nouveau("tourbillonRayon", "Tourbillon : rayon (cm)", "Whirlwind: radius (cm)"),
  nouveau("tourbillonDegats", "Tourbillon : dégâts par passe (%)", "Whirlwind: damage per pass (%)"),
  nouveau("tourbillonVitesse", "Tourbillon : vitesse (%)", "Whirlwind: speed (%)"),
  nouveau("bondPortee", "Bond : portée (cm)", "Leap: range (cm)"),
  nouveau("bondRayon", "Bond : onde de choc (cm)", "Leap: shockwave (cm)"),
  nouveau("bondDegats", "Bond : dégâts (%)", "Leap: damage (%)"),
  nouveau("bondEtourdi", "Bond : étourdissement (ticks)", "Leap: stun (ticks)"),
  nouveau("bouclierPortee", "Bouclier : portée (cm)", "Shield: range (cm)"),
  nouveau("bouclierCibles", "Bouclier : cibles traversées", "Shield: targets pierced"),
  nouveau("bouclierDegats", "Bouclier : dégâts (%)", "Shield: damage (%)"),
  nouveau("vaseGemme", "Vases : part de gemmes (%)", "Vases: gem share (%)"),
  nouveau("vaseRecharge", "Vases : part de recharges (%)", "Vases: cooldown share (%)"),
  nouveau("xpVase", "XP d'un vase", "Vase XP"),
  nouveau("xpGelaton", "XP d'un gélaton", "Gelaton XP"),
  nouveau("elanDistance", "Coup d'élan : fente (cm)", "Charge strike: lunge (cm)"),
  nouveau("elanDegats", "Coup d'élan : dégâts (%)", "Charge strike: damage (%)"),
  nouveau("elanRecul", "Coup d'élan : recul (%)", "Charge strike: knockback (%)"),
  nouveau("rechargeVive", "Recharge vive (%/palier)", "Quick recharge (%/tier)"),
  nouveau("maitriseDegats", "Maîtrise : dégâts (%/palier)", "Mastery: damage (%/tier)"),
  nouveau("maitriseZone", "Maîtrise : zone (%/palier)", "Mastery: area (%/tier)"),
  nouveau("echoRecharge", "Écho : part de la recharge (%)", "Echo: share of the cooldown (%)"),
  nouveau("signatureTourbillon", "Signature : tourbillon (%/palier)", "Signature: whirlwind (%/tier)"),
  nouveau("signatureBond", "Signature : bond (ticks/palier)", "Signature: leap (ticks/tier)"),
  nouveau("signatureBouclier", "Signature : bouclier (cibles/palier)", "Signature: shield (targets/tier)"),
  // Lot BR6 : les quatre nouveaux ennemis (XP), les élites, le chaman, les cartes de fin de partie.
  nouveau("xpCracheur", "XP d'un cracheur", "Spitter XP"),
  nouveau("xpChaman", "XP d'un chaman", "Shaman XP"),
  nouveau("xpTotem", "XP d'un totem", "Totem XP"),
  nouveau("xpPorteBouclier", "XP d'un porte-bouclier", "Shield-bearer XP"),
  nouveau("xpEpreuve", "XP dans la salle d'épreuve (%)", "Trial room XP (%)"),
  nouveau("xpElite", "XP d'un élite (%)", "Elite XP (%)"),
  nouveau("protectionChaman", "Bouclier du chaman : dégâts retirés (%)", "Shaman shield: damage removed (%)"),
  nouveau("eliteVie", "Élite : vie (×)", "Elite: health (×)"),
  nouveau("eliteTaille", "Élite : taille (%)", "Elite: size (%)"),
  nouveau("eliteRapidite", "Élite : durée de ses attaques (%)", "Elite: attack duration (%)"),
  nouveau("flammeDegats", "Lame enflammée : dégâts (%)", "Flaming blade: damage (%)"),
  nouveau("flammeDuree", "Lame enflammée : durée (ticks)", "Flaming blade: duration (ticks)"),
  nouveau("flammeRayon", "Lame enflammée : rayon (cm)", "Flaming blade: radius (cm)"),
  nouveau("frenesieGain", "Frénésie : gain par cran (%)", "Frenzy: gain per stack (%)"),
  nouveau("frenesieDuree", "Frénésie : durée (ticks)", "Frenzy: duration (ticks)"),
  nouveau("ecrasementDegats", "Écrasement : dégâts en plus (%)", "Crush: extra damage (%)"),
  nouveau("sismiqueDegats", "Bond sismique : dégâts (%)", "Seismic leap: damage (%)"),
  nouveau("sismiqueRayon", "Bond sismique : rayon (%)", "Seismic leap: radius (%)"),
  nouveau("ricochetRebonds", "Bouclier ricochet : rebonds", "Ricochet shield: bounces"),
  { cle: "xpBase", groupe: "sim", libelle: "tune.xpBase", min: BORNES.xpBase[0], max: BORNES.xpBase[1] },
  { cle: "xpPas", groupe: "sim", libelle: "tune.xpPas", min: BORNES.xpPas[0], max: BORNES.xpPas[1] },
  { cle: "xpCamp", groupe: "sim", libelle: "tune.xpCamp", min: BORNES.xpCamp[0], max: BORNES.xpCamp[1] },
  { cle: "aimant", groupe: "sim", libelle: "tune.aimant", min: BORNES.aimant[0], max: BORNES.aimant[1] },
  { cle: "lourdeDegats", groupe: "sim", libelle: "tune.lourdeDegats", min: BORNES.lourdeDegats[0], max: BORNES.lourdeDegats[1] },
  { cle: "lourdeLenteur", groupe: "sim", libelle: "tune.lourdeLenteur", min: BORNES.lourdeLenteur[0], max: BORNES.lourdeLenteur[1] },
  { cle: "allongePortee", groupe: "sim", libelle: "tune.allongePortee", min: BORNES.allongePortee[0], max: BORNES.allongePortee[1] },
  { cle: "allongeArc", groupe: "sim", libelle: "tune.allongeArc", min: BORNES.allongeArc[0], max: BORNES.allongeArc[1] },
  { cle: "cadenceGain", groupe: "sim", libelle: "tune.cadenceGain", min: BORNES.cadenceGain[0], max: BORNES.cadenceGain[1] },
  { cle: "ondeDegats", groupe: "sim", libelle: "tune.ondeDegats", min: BORNES.ondeDegats[0], max: BORNES.ondeDegats[1] },
  { cle: "ondePortee", groupe: "sim", libelle: "tune.ondePortee", min: BORNES.ondePortee[0], max: BORNES.ondePortee[1] },
  { cle: "bottesVitesse", groupe: "sim", libelle: "tune.bottesVitesse", min: BORNES.bottesVitesse[0], max: BORNES.bottesVitesse[1] },
  { cle: "esquiveLongue", groupe: "sim", libelle: "tune.esquiveLongue", min: BORNES.esquiveLongue[0], max: BORNES.esquiveLongue[1] },
  { cle: "esquiveVive", groupe: "sim", libelle: "tune.esquiveVive", min: BORNES.esquiveVive[0], max: BORNES.esquiveVive[1] },
  { cle: "tranchanteDegats", groupe: "sim", libelle: "tune.tranchanteDegats", min: BORNES.tranchanteDegats[0], max: BORNES.tranchanteDegats[1] },
  { cle: "volVie", groupe: "sim", libelle: "tune.volVie", min: BORNES.volVie[0], max: BORNES.volVie[1] },
  { cle: "briseDegats", groupe: "sim", libelle: "tune.briseDegats", min: BORNES.briseDegats[0], max: BORNES.briseDegats[1] },
  { cle: "aimantGain", groupe: "sim", libelle: "tune.aimantGain", min: BORNES.aimantGain[0], max: BORNES.aimantGain[1] },
  { cle: "affinite", groupe: "sim", libelle: "tune.affinite", min: BORNES.affinite[0], max: BORNES.affinite[1] },
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

export function monterTune(hote: HTMLElement, t: Traduire, etat: EtatTune, surSimulation: (r: Reglages) => void, surSensations: (s: Sensations) => void, langue: "fr" | "en" = "fr"): Tune {
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
    nom.textContent = c.noms ? c.noms[langue === "en" ? 1 : 0] : t(c.libelle);
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
