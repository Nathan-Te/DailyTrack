// Lot 56 — la planche d'écoute des ambiances (`/track/vitrine/?planche=ambiances`, recette et aperçus seulement, chargée à la demande). Une ambiance par thème, écoutée **seule** (avec la
// vitesse qu'on veut, pour entendre la façon dont elle s'efface) puis **sous le moteur**, sur la course de voiture virtuelle du lot 55 ou à vitesse fixe, avec les pneus et le vent.
// La tribune du Stade, les lampadaires de la Nuit, la clameur d'un point de contrôle et de l'arrivée ont leurs boutons. Nathan écoute (casque, téléphone) et garde, retouche ou
// écarte chaque thème ; rien de ceci n'est dans le jeu. Outil interne, en français, exempté des catalogues (comme le reste de la vitrine).
import { boiteInitiale, pasBoite, type EtatBoite } from "../son/boite";
import { creerCoucheRoues, type CoucheRoues } from "../son/coucheRoues";
import { bruitBlanc, type Moteur } from "../son/moteur";
import { profilDe, VOITURES_SON } from "../son/profils";
import { creerAmbiance, fabriquerAmbiance, type Ambiance, type Fabrication } from "../son/ambiance";

export { creerAmbiance, fabriquerAmbiance };
import { THEMES_AMBIANCE, VITESSE_PLEINE, niveauSelonVitesse, type EntreeAmbiance, type ThemeAmbiance } from "../son/ambiance/donnees";
import { bandesDEnergie, rms as rmsDe, SR } from "../son/ambiance/kit";
import { DUREE_SCENARIO, gazDe, voitureVirtuelle, type TrameVirtuelle } from "../son/voitureVirtuelle";
import { fabriquer as fabriquerMoteur, rendreHorsLigne as rendreMoteur } from "./son";

const NOMS: Record<ThemeAmbiance, string> = {
  stade: "Stade",
  rallye: "Rallye",
  banquise: "Banquise",
  campagne: "Campagne",
  canyon: "Canyon",
  col: "Col alpin",
  ville: "Ville",
  nuit: "Nuit",
};

/** Ce que chaque thème fait entendre, pour la légende. */
const PISTES: Record<ThemeAmbiance, string> = {
  stade: "Rumeur de foule lointaine ; la tribune de départ enfle quand on passe devant (côté gauche) ; clameur à un point de contrôle, ovation à l'arrivée ; claquements de mains isolés.",
  rallye: "Vent sec par rafales, bruissement de broussaille, sifflement dans les rochers ; des graviers qui roulent ; le cri d'un rapace au loin.",
  banquise: "Vent froid et fin, sifflements ; la glace : « pings » qui plongent, craquements secs, longs gémissements graves.",
  campagne: "Brise, feuillage, insectes dans l'herbe ; une mésange, un merle, une tourterelle, un pinson ; une cloche de village au loin.",
  canyon: "Rafales amples dans les parois, grondement creux et « tuyaux d'orgue » de la roche, écho ; un corbeau et des pierres qui roulent, l'écho derrière.",
  col: "Grand vent d'altitude, souffles sourds et sifflement mince ; sonnailles de troupeau au loin ; un sifflement de marmotte.",
  ville: "Grondement de la circulation, chuintement des pneus ; des voitures qui passent d'un côté à l'autre ; un klaxon de temps en temps.",
  nuit: "Un champ de grillons, souffle de nuit ; le bourdonnement électrique des lampadaires (100 Hz et ses harmoniques, un arc qui crépite) quand on passe devant ; une chouette, très rarement.",
};

const NOMS_VOITURES = { civile: "Sparrow · petit 4-cylindres", fourgon: "Pelican · vieux moteur", muscle: "Boar · V8", monoplace: "Sailfish · monoplace", rallye: "Badger · rallye turbo", gt: "Moray · 6-cylindres" };

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, texte?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (texte !== undefined) e.textContent = texte;
  return e;
};
const fmt = (n: number, d = 0) => n.toLocaleString("fr-FR", { maximumFractionDigits: d, minimumFractionDigits: d });

export interface HoteAmbiances {
  erreurs: string[];
  /** Le poids ajouté au jeu, partie par partie (`poids-parties.json`). */
  parties(): Record<string, number> | null;
}

// --- Le décor de la course virtuelle : où sont la tribune et les lampadaires ----------------------------------------------------------------------

/** La distance (m) parcourue à l'instant `t` du scénario de la voiture virtuelle (intégrale de la vitesse, tabulée une fois). */
const DISTANCES: number[] = (() => {
  const d = [0];
  const pas = 1 / 30;
  for (let t = pas; t <= DUREE_SCENARIO + 1e-6; t += pas) d.push(d[d.length - 1]! + voitureVirtuelle(t).speed * pas);
  return d;
})();
export const distanceA = (t: number): number => DISTANCES[Math.min(DISTANCES.length - 1, Math.max(0, Math.round(t * 30)))]!;

/** Le décor qui chante pour un thème, à la distance `s` : la tribune du départ (Stade), les lampadaires (Nuit). Les autres thèmes n'en ont pas (`null`). */
export function decorVirtuel(theme: ThemeAmbiance, s: number): EntreeAmbiance["decor"] {
  if (theme === "stade") {
    // La tribune de départ (s = 0) et une seconde, plus loin : à gauche, de 55 m de portée.
    const d = Math.min(Math.abs(s - 18), Math.abs(s - 560));
    return { cote: -0.85, proche: Math.exp(-((d / 60) ** 2)) };
  }
  if (theme === "nuit") {
    // Un lampadaire tous les 42 m, de chaque côté à son tour.
    const k = Math.round((s - 21) / 42);
    const d = Math.abs(s - (21 + 42 * k));
    return { cote: k % 2 === 0 ? -0.75 : 0.75, proche: Math.exp(-((d / 10) ** 2)) };
  }
  return null;
}

/** Les instants (s) du scénario où le jeu enverrait une réaction : deux points de contrôle, l'arrivée. */
export const REACTIONS: readonly { t: number; nom: "checkpoint" | "finish" }[] = [
  { t: 9, nom: "checkpoint" },
  { t: 20, nom: "checkpoint" },
  { t: 28.2, nom: "finish" },
];

// --- Le rendu hors ligne et l'analyse (tests et mesures) ----------------------------------------------------------------------------------------------

export interface RapportAmbiance {
  theme: ThemeAmbiance;
  secondes: number;
  /** Deux canaux. */
  canaux: Float32Array[];
  crete: number;
  rms: number;
  nonFinis: number;
  noeuds: number;
  brefs: number;
  /** Événements joués (nom@instant). */
  evenements: string[];
  joues: number;
  renduMs: number;
  memoire: number;
}

/**
 * Joue l'ambiance **hors ligne** (plus vite que le temps réel) : à vitesse fixe, ou sur le scénario de la voiture virtuelle (`vitesse: "scenario"`), image par image comme sur la planche,
 * et rend les deux canaux et leur analyse : de quoi vérifier sans oreilles que rien ne sature ni ne se casse, que le niveau suit la vitesse, que les événements arrivent espacés.
 */
export async function rendreAmbianceHorsLigne(theme: ThemeAmbiance, secondes: number, vitesse: number | "scenario" = 0, decor: EntreeAmbiance["decor"] | "virtuel" = "virtuel", graine = 7, reactions: readonly { t: number; nom: "checkpoint" | "finish" }[] = []): Promise<RapportAmbiance> {
  const fab = await fabriquerAmbiance(theme);
  const ctx = new OfflineAudioContext(2, Math.round(secondes * SR), SR);
  const maitre = ctx.createGain();
  maitre.connect(ctx.destination);
  const amb = await creerAmbiance({ ctx, sortie: maitre, theme, graine, t0: 0, fabrication: fab });
  const dt = 1 / 60;
  let s = 0;
  const dejaJoue = new Set<number>();
  for (let t = 0; t < secondes; t += dt) {
    const v = vitesse === "scenario" ? voitureVirtuelle(t % DUREE_SCENARIO).speed : vitesse;
    s = vitesse === "scenario" ? distanceA(t % DUREE_SCENARIO) : s + v * dt;
    const d = decor === "virtuel" ? decorVirtuel(theme, s) : decor;
    // L'entrée est gelée : l'ambiance ne la modifie jamais (elle ne fait que la lire).
    amb.maj(Object.freeze({ vitesse: v, actif: true, decor: d && Object.freeze({ ...d }), t }));
    for (const r of reactions) if (t >= r.t && t < r.t + dt) amb.reagir(r.nom);
    if (vitesse === "scenario") REACTIONS.forEach((r, i) => {
      const k = Math.floor(t / DUREE_SCENARIO) * 100 + i;
      if (t % DUREE_SCENARIO >= r.t && !dejaJoue.has(k)) {
        dejaJoue.add(k);
        amb.reagir(r.nom);
      }
    });
  }
  const tampon = await ctx.startRendering();
  const canaux = [new Float32Array(tampon.getChannelData(0)), new Float32Array(tampon.getChannelData(1))];
  let crete = 0;
  let nonFinis = 0;
  for (const c of canaux) for (const v of c) Number.isFinite(v) ? (crete = Math.max(crete, Math.abs(v))) : nonFinis++;
  const e = amb.etat();
  amb.arreter();
  return { theme, secondes, canaux, crete, rms: rmsDe(canaux), nonFinis, noeuds: e.noeuds, brefs: e.brefs, evenements: e.derniers, joues: e.joues, renduMs: fab.renduMs, memoire: fab.memoire };
}

/** Le moteur (civile) et les pneus de la course virtuelle, rendus hors ligne : pour comparer leur niveau à celui de l'ambiance (README du lot). */
export async function rendreMoteurDeReference(id: (typeof VOITURES_SON)[number] = "civile", secondes = DUREE_SCENARIO): Promise<{ canal: Float32Array; rms: number; fenetres: { t: number; rms: number; vitesse: number }[] }> {
  const r = await rendreMoteur("B", id, secondes, true);
  return { canal: r.donnees, rms: r.rms, fenetres: r.fenetres.map((f) => ({ t: f.t, rms: f.rms, vitesse: voitureVirtuelle(f.t).speed })) };
}

// --- L'analyse d'un thème fabriqué (tests et mesures) ------------------------------------------------------------------------------------------------

export interface AnalyseTheme {
  theme: ThemeAmbiance;
  renduMs: number;
  memoire: number;
  lit: {
    secondes: number;
    rms: number;
    crete: number;
    nonFinis: number;
    /** Corrélation entre les deux canaux (0 : large). */
    correlation: number;
    /** Part de l'énergie : < 250 Hz, 250 à 6 000 Hz (ce qu'un haut-parleur de téléphone rend), > 6 000 Hz. */
    bandes: number[];
    /** La couture de la boucle : l'écart entre le dernier échantillon et le premier (en écarts-types du signal), et le niveau efficace de ± 0,25 s autour de la couture ÷ celui de l'ensemble. */
    couture: { saut: number; ratio: number };
  };
  local: { rms: number; crete: number; secondes: number; couture: { saut: number; ratio: number } } | null;
  banque: { secondes: number; groupes: Record<string, { n: number; dureeMin: number; dureeMax: number; crete: number }> };
  flux: { nom: string; ecart: readonly [number, number]; pasDeGroupe: boolean }[];
  reactions: string[];
  deuxLectures: boolean;
}

const coutureDe = (x: Float32Array): { saut: number; ratio: number } => {
  const n = x.length;
  const w = Math.round(0.25 * SR);
  const e = rmsDe([x]);
  const autour = new Float32Array(2 * w);
  autour.set(x.subarray(n - w), 0);
  autour.set(x.subarray(0, w), w);
  return { saut: Math.abs(x[0]! - x[n - 1]!) / (e || 1), ratio: rmsDe([autour]) / (e || 1) };
};

/** Fabrique un thème et le mesure : niveau, saturation, largeur stéréo, équilibre des bandes, couture de la boucle, variantes de la banque. */
export async function analyserTheme(theme: ThemeAmbiance): Promise<AnalyseTheme> {
  const fab = await fabriquerAmbiance(theme);
  const d = fab.donnees;
  const [l, r] = d.lit as [Float32Array, Float32Array];
  let nonFinis = 0;
  let cr = 0;
  let sab = 0;
  for (let i = 0; i < l.length; i++) {
    if (!Number.isFinite(l[i]!) || !Number.isFinite(r[i]!)) nonFinis++;
    cr = Math.max(cr, Math.abs(l[i]!), Math.abs(r[i]!));
    sab += l[i]! * r[i]!;
  }
  const mono = new Float32Array(l.length);
  for (let i = 0; i < l.length; i++) mono[i] = (l[i]! + r[i]!) / 2;
  const groupes: AnalyseTheme["banque"]["groupes"] = {};
  for (const [nom, trs] of Object.entries(d.banque.tranches)) {
    const durees = trs.map((t) => t.duree);
    let c = 0;
    for (const t of trs) for (let i = Math.round(t.debut * SR); i < Math.round((t.debut + t.duree) * SR); i++) c = Math.max(c, Math.abs(d.banque.donnees[i]!));
    groupes[nom] = { n: trs.length, dureeMin: Math.min(...durees), dureeMax: Math.max(...durees), crete: c };
  }
  const loc = d.local;
  return {
    theme,
    renduMs: fab.renduMs,
    memoire: fab.memoire,
    lit: { secondes: l.length / SR, rms: rmsDe([l, r]), crete: cr, nonFinis, correlation: sab / ((l.length * rmsDe([l]) * rmsDe([r])) || 1), bandes: bandesDEnergie(mono, [0, 250, 6000, SR / 2]), couture: coutureDe(l) },
    local: loc ? { rms: rmsDe(loc.canaux), crete: Math.max(...loc.canaux.map((c) => c.reduce((m, v) => Math.max(m, Math.abs(v)), 0))), secondes: loc.canaux[0]!.length / SR, couture: coutureDe(loc.canaux[0]!) } : null,
    banque: { secondes: d.banque.donnees.length / SR, groupes },
    flux: d.flux.map((f) => ({ nom: f.nom, ecart: f.ecart, pasDeGroupe: !d.banque.tranches[f.nom]?.length })),
    reactions: Object.values(d.reactions).map((x) => x!.nom),
    deuxLectures: d.deuxLectures,
  };
}

/**
 * Recommencer une course, changer de thème, basculer le Salon : crée et détruit `fois` ambiances de suite dans un même contexte, et rend le nombre de nœuds permanents à chaque tour
 * (constant : rien ne s'accumule) et le nombre de nœuds brefs vivants après l'arrêt (zéro).
 */
export async function verifierRecommencements(theme: ThemeAmbiance, fois = 6): Promise<{ noeuds: number[]; brefsApresArret: number[] }> {
  const fab = await fabriquerAmbiance(theme);
  const ctx = new OfflineAudioContext(2, SR, SR);
  const maitre = ctx.createGain();
  maitre.connect(ctx.destination);
  const noeuds: number[] = [];
  const brefsApresArret: number[] = [];
  for (let i = 0; i < fois; i++) {
    const amb = await creerAmbiance({ ctx, sortie: maitre, theme, t0: 0, fabrication: fab, graine: 100 + i });
    amb.maj({ vitesse: 10, actif: true, decor: { cote: 0.3, proche: 0.4 }, t: 0 });
    amb.declencher();
    amb.reagir("finish");
    noeuds.push(amb.etat().noeuds);
    amb.arreter();
    brefsApresArret.push(amb.etat().brefs);
  }
  return { noeuds, brefsApresArret };
}

/**
 * Aucune fuite de nœuds : une ambiance qui joue (des événements, des réactions) puis qu'on arrête ne laisse aucun nœud attaché ; un thème qu'on remplace, un recommencement, la bascule
 * du Salon créent et détruisent la leur. Compte les nœuds créés, les `disconnect` appelés, les sources démarrées et arrêtées.
 */
export async function verifierFuitesAmbiance(theme: ThemeAmbiance): Promise<{ crees: number; deconnectes: number; sourcesDemarrees: number; sourcesArretees: number; brefsApresArret: number }> {
  const fab = await fabriquerAmbiance(theme);
  const ctx = new OfflineAudioContext(2, SR * 3, SR);
  const proto = AudioNode.prototype;
  const disconnectOrig = proto.disconnect;
  const startOrig = AudioScheduledSourceNode.prototype.start;
  const stopOrig = AudioScheduledSourceNode.prototype.stop;
  const suivis = new Set<AudioNode>();
  const arretes = new Set<AudioNode>();
  const demarres = new Set<AudioNode>();
  proto.disconnect = function (this: AudioNode, ...args: unknown[]) {
    suivis.add(this);
    return (disconnectOrig as (...a: unknown[]) => void).apply(this, args);
  } as typeof proto.disconnect;
  AudioScheduledSourceNode.prototype.start = function (this: AudioScheduledSourceNode, ...args: [number?, number?, number?]) {
    demarres.add(this);
    return startOrig.apply(this, args as [number?]);
  };
  AudioScheduledSourceNode.prototype.stop = function (this: AudioScheduledSourceNode, ...args: [number?]) {
    arretes.add(this);
    return stopOrig.apply(this, args);
  };
  try {
    const maitre = ctx.createGain();
    maitre.connect(ctx.destination);
    const amb = await creerAmbiance({ ctx, sortie: maitre, theme, t0: 0, fabrication: fab });
    amb.maj({ vitesse: 20, actif: true, decor: { cote: -0.5, proche: 0.5 }, t: 0 });
    for (const f of fab.donnees.flux) amb.declencher(f.nom);
    amb.reagir("checkpoint");
    amb.reagir("finish");
    const crees = amb.etat().noeuds;
    amb.arreter();
    return { crees, deconnectes: suivis.size, sourcesDemarrees: demarres.size, sourcesArretees: arretes.size, brefsApresArret: amb.etat().brefs };
  } finally {
    proto.disconnect = disconnectOrig;
    AudioScheduledSourceNode.prototype.start = startOrig;
    AudioScheduledSourceNode.prototype.stop = stopOrig;
  }
}

// --- La planche -------------------------------------------------------------------------------------------------------------------------------------

export interface PlancheAmbiances {
  activer(): Promise<void>;
  choisir(theme: ThemeAmbiance): Promise<void>;
  etat(): { actif: boolean; theme: ThemeAmbiance; mode: "seule" | "course"; vitesse: number; t: number; ambiance: ReturnType<Ambiance["etat"]> | null; rendus: Partial<Record<ThemeAmbiance, { renduMs: number; memoire: number }>> };
  arreter(): void;
}

export async function monter(racine: HTMLElement, hote: HoteAmbiances): Promise<PlancheAmbiances> {
  let ctx: AudioContext | null = null;
  let maitre: GainNode | null = null;
  let bruit: AudioBuffer | null = null;
  let theme: ThemeAmbiance = "stade";
  let mode: "seule" | "course" = "seule";
  let voiture: (typeof VOITURES_SON)[number] = "civile";
  let ambiance: Ambiance | null = null;
  let moteur: Moteur | null = null;
  let roues: CoucheRoues | null = null;
  let boite: EtatBoite = boiteInitiale(profilDe(voiture));
  let construction = 0;
  let tScenario = 0;
  let distance = 0;
  let vitesseFixe: number | null = null; // null : le scénario
  let vitesseSeule = 0;
  let proche = 0;
  let cote = -0.8;
  let enPause = false;
  let sansAmbiance = false;
  let volume = 0.7;
  let niveau = 1;
  let dernierRaf = 0;
  let raf = 0;
  let vitesseAff = 0;
  let capacite: { moyenne: number; pic: number } | null = null;
  const rendus: Partial<Record<ThemeAmbiance, Fabrication>> = {};

  racine.textContent = "";
  const intro = el("section", "son-intro");
  intro.append(el("h2", undefined, "Planche d'écoute · les ambiances des thèmes"));
  const p1 = el("p");
  p1.append(
    "Une ambiance par thème, fabriquée par le code au chargement du thème (aucun fichier). ",
    el("strong", undefined, "Seule"),
    " : l'ambiance au niveau du jeu, avec la vitesse qu'on veut (à 0, la voiture est à l'arrêt ; plus elle va vite, plus l'ambiance s'efface — le vent de la course prend le relais). ",
    el("strong", undefined, "Sous le moteur"),
    " : la course virtuelle du lot 55 (ralenti, accélération, freinage, terre, turbo, saut) ou une vitesse fixe, avec le moteur, les pneus et le vent. ",
    "Écoute au casque, puis au haut-parleur d'un téléphone.",
  );
  intro.append(p1);
  const p2 = el("p", "note", "Je n'ai pas d'oreilles : j'ai vérifié par des mesures que rien ne sature ni ne se casse, que le niveau suit la vitesse et que les événements restent espacés. Si ça sonne bien ou mal, c'est à toi de le dire — thème par thème : garde, retouche ou écarte.");
  intro.append(p2);
  const activer = el("button", "action", "Activer le son");
  activer.type = "button";
  intro.append(activer);
  racine.append(intro);

  const banc = el("section", "son-banc");
  const groupe = (nom: string) => {
    const g = el("div", "segments");
    g.setAttribute("role", "group");
    g.setAttribute("aria-label", nom);
    return g;
  };
  const bouton = (cls: string, texte: string, pressable = false) => {
    const b = el("button", cls, texte);
    b.type = "button";
    if (pressable) b.setAttribute("aria-pressed", "false");
    return b;
  };
  const gThemes = groupe("Thème");
  const bThemes = new Map<ThemeAmbiance, HTMLButtonElement>();
  for (const t of THEMES_AMBIANCE) {
    const b = bouton("segment", NOMS[t], true);
    b.dataset.theme = t;
    gThemes.append(b);
    bThemes.set(t, b);
  }
  const gMode = groupe("Mode");
  const bSeule = bouton("segment", "Seule", true);
  const bCourse = bouton("segment", "Sous le moteur", true);
  gMode.append(bSeule, bCourse);
  const gVoiture = groupe("Voiture");
  const sVoiture = el("select");
  for (const id of VOITURES_SON) {
    const o = el("option", undefined, (NOMS_VOITURES as Record<string, string>)[id] ?? id);
    o.value = id;
    sVoiture.append(o);
  }
  const lVoiture = el("label", "choix", "Voiture ");
  lVoiture.append(sVoiture);
  gVoiture.append(lVoiture);

  const transport = el("div", "son-transport");
  const bLecture = bouton("segment segment--action", "⏸ Pause");
  const bDebut = bouton("segment segment--action", "↺ Au début");
  const bSans = bouton("segment", "Sans ambiance", true);
  const curseur = (nom: string, min: number, max: number, pas: number, valeur: number) => {
    const l = el("label", "choix", `${nom} `);
    const i = el("input");
    i.type = "range";
    i.min = String(min);
    i.max = String(max);
    i.step = String(pas);
    i.value = String(valeur);
    l.append(i);
    return { l, i };
  };
  const cVolume = curseur("Volume général", 0, 1, 0.01, volume);
  const cNiveau = curseur("Ambiance (×)", 0, 2, 0.05, niveau);
  transport.append(bLecture, bDebut, bSans, cVolume.l, cNiveau.l);

  const reglagesSeule = el("div", "son-manuel");
  const cVitesse = curseur("Vitesse (m/s)", 0, 90, 1, 0);
  const cProche = curseur("Décor proche (tribune, lampadaires)", 0, 1, 0.01, 0);
  const cCote = curseur("Côté du décor (−1 gauche, 1 droite)", -1, 1, 0.05, -0.8);
  reglagesSeule.append(cVitesse.l, cProche.l, cCote.l);

  const reglagesCourse = el("div", "son-manuel");
  reglagesCourse.hidden = true;
  const bScenario = bouton("segment", "Course virtuelle", true);
  const bFixes = [0, 20, 40, 60, 80].map((v) => {
    const b = bouton("segment", v === 0 ? "À l'arrêt" : `${v} m/s (${Math.round(v * 3.6)} km/h)`, true);
    b.dataset.vitesse = String(v);
    return b;
  });
  reglagesCourse.append(bScenario, ...bFixes);
  reglagesCourse.prepend(gVoiture);

  const evenements = el("div", "son-manuel");
  const bEvenement = bouton("segment segment--action", "Un événement maintenant");
  const bCheckpoint = bouton("segment segment--action", "Point de contrôle");
  const bArrivee = bouton("segment segment--action", "Arrivée");
  evenements.append(bEvenement, bCheckpoint, bArrivee);

  const lecture = el("div", "son-lecture");
  const lVitesse = el("span", "son-lecture__vitesse", "—");
  const lNiveau = el("span", "son-lecture__regime", "—");
  const lMoment = el("span", "son-lecture__moment", "—");
  const lCharge = el("span", "son-lecture__moment", "Charge du fil audio : —");
  const barre = el("div", "son-barre");
  const barreInterieur = el("div", "son-barre__rempli");
  barre.append(barreInterieur);
  lecture.append(lVitesse, lNiveau, barre, lMoment, lCharge);
  const avis = el("div", "son-avis");
  banc.append(gThemes, gMode, reglagesSeule, reglagesCourse, transport, evenements, lecture, avis);
  racine.append(banc);

  // --- Le tableau des coûts ---
  const couts = el("section", "couts son-couts");
  couts.append(el("h2", undefined, "Ce que coûte chaque ambiance"));
  const mesurerTout = bouton("action", "Fabriquer tous les thèmes (mesure)");
  couts.append(mesurerTout);
  const tableau = el("div", "tableau");
  const table = el("table");
  const tete = el("thead");
  const trTete = el("tr");
  for (const t of ["Thème", "Code du thème (JS gzip ; + ≈ 5 ko communs)", "Fabrication au chargement", "Mémoire des tampons", "Nœuds permanents"]) {
    const th = el("th", undefined, t);
    th.scope = "col";
    trTete.append(th);
  }
  tete.append(trTete);
  const corps = el("tbody");
  table.append(tete, corps);
  tableau.append(table);
  couts.append(tableau, el("p", "note", "« Fabrication » : le temps que le thème met à fabriquer ses sons sur cet appareil (rendu hors ligne du lit continu, synthèse des événements). C'est ce que le joueur paie, une fois, au chargement du thème — sur un téléphone, ×3 à ×6. Les fichiers sont inexistants : tout est calculé."));
  racine.append(couts);

  const poidsCode = (t: ThemeAmbiance): string => {
    const parties = hote.parties();
    if (!parties) return "…";
    const o = Object.entries(parties).find(([n]) => n.startsWith(`Ambiance : ${NOMS[t]}`))?.[1];
    return o === undefined ? "…" : `${fmt(o / 1024, 1)} ko`;
  };
  function majTableau(): void {
    corps.textContent = "";
    for (const t of THEMES_AMBIANCE) {
      const r = rendus[t];
      const tr = el("tr");
      tr.dataset.ligne = t;
      tr.append(el("th", undefined, NOMS[t]), el("td", undefined, poidsCode(t)), el("td", undefined, r ? `${fmt(r.renduMs)} ms` : "à écouter"), el("td", undefined, r ? `${fmt(r.memoire / 1024 / 1024, 1)} Mo` : "—"), el("td", undefined, t === theme && ambiance ? String(ambiance.etat().noeuds) : "—"));
      corps.append(tr);
    }
  }

  function majAvis(): void {
    avis.textContent = "";
    avis.append(el("h3", undefined, NOMS[theme]), el("p", undefined, PISTES[theme]));
    const r = rendus[theme];
    if (r) avis.append(el("p", "note", `Fabriquée en ${fmt(r.renduMs)} ms sur cet appareil · ${fmt(r.memoire / 1024 / 1024, 1)} Mo de tampons.`));
  }

  function marquer(): void {
    for (const [t, b] of bThemes) b.setAttribute("aria-pressed", String(t === theme));
    bSeule.setAttribute("aria-pressed", String(mode === "seule"));
    bCourse.setAttribute("aria-pressed", String(mode === "course"));
    bScenario.setAttribute("aria-pressed", String(vitesseFixe === null));
    for (const b of bFixes) b.setAttribute("aria-pressed", String(vitesseFixe !== null && Number(b.dataset.vitesse) === vitesseFixe));
    bSans.setAttribute("aria-pressed", String(sansAmbiance));
    reglagesSeule.hidden = mode !== "seule";
    reglagesCourse.hidden = mode !== "course";
    majAvis();
  }

  async function reconstruire(): Promise<void> {
    const mien = ++construction;
    ambiance?.arreter();
    ambiance = null;
    moteur?.arreter();
    roues?.arreter();
    moteur = null;
    roues = null;
    if (!ctx || !maitre || !bruit) return;
    avis.dataset.etat = "chargement";
    try {
      const fab = await fabriquerAmbiance(theme);
      rendus[theme] = fab;
      if (mien !== construction) return;
      ambiance = await creerAmbiance({ ctx, sortie: maitre, theme, fabrication: fab });
      ambiance.regler(sansAmbiance ? 0 : niveau);
      if (mode === "course") {
        const m = await fabriquerMoteur(ctx, maitre, bruit, "B", profilDe(voiture));
        if (mien !== construction) {
          m.moteur.arreter();
          return;
        }
        moteur = m.moteur;
        roues = creerCoucheRoues(ctx, maitre, bruit);
        boite = boiteInitiale(profilDe(voiture));
      }
    } catch (e) {
      hote.erreurs.push(`planche ambiances : ${String(e)}`);
    }
    avis.dataset.etat = "pret";
    majAvis();
    majTableau();
  }

  async function activerSon(): Promise<void> {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) {
        hote.erreurs.push("planche ambiances : Web Audio n'est pas disponible");
        return;
      }
      ctx = new Ctor();
      maitre = ctx.createGain();
      maitre.gain.value = volume;
      maitre.connect(ctx.destination);
      bruit = bruitBlanc(ctx);
      // La charge du fil audio (API de Chrome ; vide ailleurs) : le vrai coût d'une ambiance sur un téléphone.
      const rc = (ctx as unknown as { renderCapacity?: { start(o: { updateInterval: number }): void; addEventListener(t: string, f: (e: { averageLoad: number; peakLoad: number }) => void): void } }).renderCapacity;
      if (rc) {
        let somme = 0;
        let n = 0;
        let pic = 0;
        rc.addEventListener("update", (e) => {
          somme += e.averageLoad;
          n++;
          pic = Math.max(pic, e.peakLoad);
          capacite = { moyenne: somme / n, pic };
        });
        rc.start({ updateInterval: 1 });
      }
      document.addEventListener("visibilitychange", () => {
        if (!ctx) return;
        if (document.hidden) void ctx.suspend();
        else void ctx.resume();
      });
    }
    if (ctx.state === "suspended") await ctx.resume();
    activer.textContent = "Son activé";
    activer.disabled = true;
    if (!ambiance) await reconstruire();
  }

  async function choisir(t: ThemeAmbiance): Promise<void> {
    theme = t;
    distance = 0;
    marquer();
    await activerSon();
    await reconstruire();
  }

  // --- La boucle ---
  function trame(dt: number): TrameVirtuelle {
    const base: TrameVirtuelle = { speed: 0, throttle: 0, brake: false, slide: 0, grounded: true, surface: "road", kerb: 0, boost: false, cut: false };
    if (mode === "seule") return { ...base, speed: vitesseSeule };
    if (vitesseFixe !== null) return { ...base, speed: vitesseFixe, throttle: vitesseFixe > 0 ? 1 : 0 };
    if (!enPause) tScenario = (tScenario + dt) % DUREE_SCENARIO;
    return voitureVirtuelle(tScenario);
  }

  function tick(maintenant: number): void {
    raf = requestAnimationFrame(tick);
    const dt = dernierRaf ? Math.min(0.05, (maintenant - dernierRaf) / 1000) : 0;
    dernierRaf = maintenant;
    const avant = tScenario;
    const f = trame(dt);
    vitesseAff = f.speed;
    if (!enPause) distance = mode === "course" && vitesseFixe === null ? distanceA(tScenario) : distance + f.speed * dt;
    // Les réactions du scénario : au franchissement de leur instant.
    if (mode === "course" && vitesseFixe === null && !enPause) {
      for (const r of REACTIONS) if ((avant < r.t && tScenario >= r.t) && ambiance) ambiance.reagir(r.nom);
      if (tScenario < avant) distance = 0;
    }
    if (ctx?.state === "running" && ambiance) {
      const decor = mode === "seule" ? (theme === "stade" || theme === "nuit" ? { cote, proche } : null) : decorVirtuel(theme, distance);
      ambiance.maj({ vitesse: f.speed, actif: !enPause, decor });
      if (moteur) {
        const p = profilDe(voiture);
        boite = pasBoite(boite, p, f.speed, gazDe(f), dt, !f.grounded);
        moteur.maj({ rpm: boite.rpm, charge: boite.charge, passage: boite.passage, sens: boite.sens, rapport: boite.rapport, vitesse: f.speed, gaz: gazDe(f), enAir: !f.grounded, silence: enPause });
        roues?.maj(enPause ? { ...f, speed: 0 } : f);
      }
    }
    lVitesse.textContent = `${fmt(vitesseAff * 3.6)} km/h`;
    const part = niveauSelonVitesse(vitesseAff);
    lNiveau.textContent = `Ambiance à ${fmt(part * 100)} % de son niveau`;
    barreInterieur.style.transform = `scaleX(${Math.min(1, vitesseAff / VITESSE_PLEINE)})`;
    lCharge.textContent = capacite ? `Charge du fil audio : ${fmt(capacite.moyenne * 100, 1)} % (pic ${fmt(capacite.pic * 100, 1)} %)` : "Charge du fil audio : — (Chrome seulement)";
    lMoment.textContent = mode === "course" && vitesseFixe === null ? `${fmt(tScenario, 1)} s / ${DUREE_SCENARIO} s · ${fmt(distance)} m` : `${fmt(distance)} m`;
  }

  // --- Les gestes ---
  activer.addEventListener("click", () => void activerSon().then(() => reconstruire()));
  for (const [t, b] of bThemes) b.addEventListener("click", () => void choisir(t));
  const changerMode = (m: "seule" | "course") => {
    mode = m;
    marquer();
    void activerSon().then(() => reconstruire());
  };
  bSeule.addEventListener("click", () => changerMode("seule"));
  bCourse.addEventListener("click", () => changerMode("course"));
  sVoiture.addEventListener("change", () => {
    voiture = sVoiture.value as typeof voiture;
    void reconstruire();
  });
  bScenario.addEventListener("click", () => {
    vitesseFixe = null;
    tScenario = 0;
    marquer();
  });
  for (const b of bFixes)
    b.addEventListener("click", () => {
      vitesseFixe = Number(b.dataset.vitesse);
      marquer();
    });
  bLecture.addEventListener("click", () => {
    enPause = !enPause;
    bLecture.textContent = enPause ? "▶ Jouer" : "⏸ Pause";
    void activerSon();
  });
  bDebut.addEventListener("click", () => {
    tScenario = 0;
    distance = 0;
    enPause = false;
    bLecture.textContent = "⏸ Pause";
    void activerSon();
  });
  bSans.addEventListener("click", () => {
    sansAmbiance = !sansAmbiance;
    ambiance?.regler(sansAmbiance ? 0 : niveau);
    marquer();
  });
  cVolume.i.addEventListener("input", () => {
    volume = Number(cVolume.i.value);
    maitre?.gain.setTargetAtTime(volume, ctx?.currentTime ?? 0, 0.03);
  });
  cNiveau.i.addEventListener("input", () => {
    niveau = Number(cNiveau.i.value);
    if (!sansAmbiance) ambiance?.regler(niveau);
  });
  cVitesse.i.addEventListener("input", () => {
    vitesseSeule = Number(cVitesse.i.value);
  });
  cProche.i.addEventListener("input", () => {
    proche = Number(cProche.i.value);
  });
  cCote.i.addEventListener("input", () => {
    cote = Number(cCote.i.value);
  });
  bEvenement.addEventListener("click", () => {
    void activerSon();
    ambiance?.declencher();
  });
  bCheckpoint.addEventListener("click", () => ambiance?.reagir("checkpoint"));
  bArrivee.addEventListener("click", () => ambiance?.reagir("finish"));
  mesurerTout.addEventListener("click", async () => {
    mesurerTout.disabled = true;
    for (const t of THEMES_AMBIANCE) {
      mesurerTout.textContent = `Fabrication : ${NOMS[t]}…`;
      rendus[t] = await fabriquerAmbiance(t);
      majTableau();
    }
    mesurerTout.textContent = "Fabriquer tous les thèmes (mesure)";
    mesurerTout.disabled = false;
  });

  marquer();
  majTableau();
  raf = requestAnimationFrame(tick);

  return {
    activer: activerSon,
    choisir,
    etat: () => ({ actif: ctx?.state === "running", theme, mode, vitesse: vitesseAff, t: tScenario, ambiance: ambiance?.etat() ?? null, rendus: Object.fromEntries(Object.entries(rendus).map(([k, v]) => [k, { renduMs: v.renduMs, memoire: v.memoire }])) }),
    arreter() {
      cancelAnimationFrame(raf);
      ambiance?.arreter();
      moteur?.arreter();
      roues?.arreter();
      void ctx?.close();
    },
  };
}
