// Lot 55 (partie B) — la planche sonore de la vitrine (`/track/vitrine/?planche=son`, recette et aperçus seulement, chargée à la demande). Elle fait écouter **la même course**
// (la voiture virtuelle : ralenti, coup de gaz à l'arrêt, accélération sur six rapports, lever de pied, freinage, terre en dérive, turbo, vibreur, saut) avec le moteur d'avant
// et les trois approches : A (synthèse), B (échantillons rendus hors ligne), C (enregistrements CC0), pour quatre voitures très différentes — et donne le coût de chacune.
// Nathan écoute (téléphone et ordinateur, au casque) et choisit ; rien de ceci n'est dans le jeu. Outil interne, en français, exempté des catalogues (comme le reste de la vitrine).
import { boiteInitiale, pasBoite, type EtatBoite } from "../son/boite";
import { creerCoucheRoues, type CoucheRoues } from "../son/coucheRoues";
import { bruitBlanc, type EntreeMoteur, type Moteur } from "../son/moteur";
import { creerActuel } from "../son/moteurActuel";
import { chargerBoucles, creerEchantillons, type Boucle, type EntreeBoucle } from "../son/moteurEchantillons";
import { creerSynthese } from "../son/moteurSynthese";
import { PROFILS_PLANCHE, frequenceAllumage, profilDe, type ProfilMoteur } from "../son/profils";
import { DUREE_SCENARIO, MOMENTS, gazDe, voitureVirtuelle, type TrameVirtuelle } from "../son/voitureVirtuelle";
import manifesteB from "../../vitrine/son/b/manifeste.json";
import manifesteC from "../../vitrine/son/c/manifeste.json";

/** Les fichiers audio de la planche : leurs adresses finales (Vite les copie avec une empreinte). */
const FICHIERS = import.meta.glob("../../vitrine/son/**/*.m4a", { query: "?url", import: "default", eager: true }) as Record<string, string>;
const urlDe = (rel: string): string => {
  const u = FICHIERS[`../../vitrine/son/${rel}`];
  if (!u) throw new Error(`fichier sonore absent : ${rel}`);
  return u;
};

export type Approche = "actuel" | "A" | "B" | "C";
const APPROCHES: readonly Approche[] = ["actuel", "A", "B", "C"];
const NOMS: Record<Approche, string> = { actuel: "Actuel (lot 9)", A: "A · Synthèse", B: "B · Échantillons rendus hors ligne", C: "C · Enregistrements CC0" };

const NOMS_VOITURES: Record<string, string> = { civile: "Sparrow · petit 4-cylindres", muscle: "Boar · V8", monoplace: "Sailfish · monoplace", fourgon: "Pelican · vieux moteur" };

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, texte?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (texte !== undefined) e.textContent = texte;
  return e;
};
const fmt = (n: number, d = 0) => n.toLocaleString("fr-FR", { maximumFractionDigits: d, minimumFractionDigits: d });
const ko = (o: number) => `${fmt(o / 1024, 1)} ko`;

export interface HoteSon {
  erreurs: string[];
  /** Le poids ajouté au jeu, partie par partie (`poids-parties.json`). */
  parties(): Record<string, number> | null;
}

/** Ce qu'on a mesuré d'une approche sur cet appareil. */
interface Mesure {
  noeuds: number;
  /** Fichiers à télécharger pour la voiture écoutée (octets) et leur décodage. */
  octets: number;
  decodageMs: number;
  memoire: number;
  /** Temps JS moyen par image (boîte + moteur + roues), ms. */
  jsMs: number;
  images: number;
  /** Charge du fil audio (API `renderCapacity` de Chrome) : moyenne et pic, ou null. */
  charge: { moyenne: number; pic: number } | null;
}

/** Les boucles d'une approche pour une voiture (B : rendues pour elle ; C : les six enregistrements, replacés sur sa plage de régime). */
function entreesDe(approche: "B" | "C", p: ProfilMoteur): EntreeBoucle[] {
  if (approche === "B") {
    const liste = (manifesteB.profils as Record<string, { fichier: string; rpm: number; debut: number; fin: number }[]>)[p.id] ?? [];
    return liste.map((b) => ({ url: urlDe(`b/${b.fichier}`), rpm: b.rpm, debut: b.debut, fin: b.fin }));
  }
  return manifesteC.boucles.map((b) => ({ url: urlDe(`c/${b.fichier}`), rpm: p.ralenti + b.fraction * (p.rouge - p.ralenti), marge: b.marge }));
}

/** Les boucles décodées, gardées par approche et par voiture (on ne recharge pas à chaque bascule). */
const cacheBoucles = new Map<string, Promise<{ boucles: Boucle[]; octets: number; decodageMs: number; memoire: number }>>();
function boucles(ctx: BaseAudioContext, approche: "B" | "C", p: ProfilMoteur) {
  const cle = `${approche}:${p.id}`;
  let r = cacheBoucles.get(cle);
  if (!r) {
    r = chargerBoucles(ctx, entreesDe(approche, p));
    cacheBoucles.set(cle, r);
  }
  return r;
}

/** Fabrique le moteur d'une approche (les boucles de B et C sont chargées avant). */
async function fabriquer(ctx: BaseAudioContext, sortie: AudioNode, bruit: AudioBuffer, approche: Approche, p: ProfilMoteur): Promise<{ moteur: Moteur; octets: number; decodageMs: number; memoire: number }> {
  if (approche === "actuel") return { moteur: creerActuel(ctx, sortie), octets: 0, decodageMs: 0, memoire: 0 };
  if (approche === "A") return { moteur: creerSynthese(ctx, sortie, p, bruit), octets: 0, decodageMs: 0, memoire: 0 };
  const b = await boucles(ctx, approche, p);
  return { moteur: creerEchantillons(ctx, sortie, p, b.boucles, NOMS[approche], approche === "B" ? p.etalon.echantillons : p.etalon.enregistre), octets: b.octets, decodageMs: b.decodageMs, memoire: b.memoire };
}

// --- Le rendu hors ligne et l'analyse (tests et mesures) ----------------------------------------------------------------------------------------------

/** La hauteur dominante d'un morceau de signal (produit harmonique des 3 premiers partiels), en Hz, entre 20 et 1 100 Hz. */
export function hauteurHPS(x: Float32Array, sr: number, debut: number, duree = 0.25): number {
  const i0 = Math.floor(debut * sr);
  const n = Math.min(Math.floor(duree * sr), x.length - i0);
  if (n < 256) return 0;
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) w[i] = (x[i0 + i] ?? 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));
  // DFT directe aux seules fréquences voulues, par pas de 2 Hz.
  const mag = (f: number) => {
    let re = 0;
    let im = 0;
    const om = (2 * Math.PI * f) / sr;
    for (let i = 0; i < n; i += 2) {
      re += w[i]! * Math.cos(om * i);
      im += w[i]! * Math.sin(om * i);
    }
    return Math.hypot(re, im);
  };
  let meilleur = 0;
  let f0 = 0;
  for (let f = 20; f <= 1100; f += 2) {
    const s = Math.log(mag(f) + 1e-9) + Math.log(mag(2 * f) + 1e-9) + Math.log(mag(3 * f) + 1e-9);
    if (s > meilleur || f0 === 0) {
      meilleur = s;
      f0 = f;
    }
  }
  return f0;
}

export interface RapportRendu {
  sr: number;
  secondes: number;
  /** Crête, niveau efficace moyen, échantillons non finis. */
  crete: number;
  rms: number;
  nonFinis: number;
  /** Une ligne par fenêtre analysée : l'instant, le régime et la hauteur attendue, la hauteur trouvée, le niveau. */
  fenetres: { t: number; rpm: number; attendu: number; trouve: number; rms: number; brillance: number }[];
  /** Nombre de nœuds Web Audio créés par le moteur. */
  noeuds: number;
  donnees: Float32Array;
}

/**
 * Joue le scénario **hors ligne** (plus vite que le temps réel) avec une approche et une voiture : la boîte virtuelle règle le moteur image par image (60 par seconde), exactement
 * comme sur la planche. Rend le signal et son analyse : de quoi vérifier sans oreilles que le son suit le régime, ne sature pas et n'est ni muet ni cassé.
 */
export async function rendreHorsLigne(approche: Approche, id: ProfilMoteur["id"], secondes = DUREE_SCENARIO, avecRoues = true): Promise<RapportRendu> {
  const sr = 22050;
  const ctx = new OfflineAudioContext(1, Math.round(secondes * sr), sr);
  const p = profilDe(id);
  const bruit = bruitBlanc(ctx);
  const maitre = ctx.createGain();
  maitre.connect(ctx.destination);
  const { moteur } = await fabriquer(ctx, maitre, bruit, approche, p);
  const roues = avecRoues ? creerCoucheRoues(ctx, maitre, bruit) : null;
  let e: EtatBoite = boiteInitiale(p);
  const fenetres: RapportRendu["fenetres"] = [];
  const regimes: number[] = [];
  const dt = 1 / 60;
  let avant: TrameVirtuelle | null = null;
  for (let t = 0; t < secondes; t += dt) {
    const f = voitureVirtuelle(t);
    e = pasBoite(e, p, f.speed, gazDe(f), dt, !f.grounded);
    moteur.maj({ rpm: e.rpm, charge: e.charge, passage: e.passage, sens: e.sens, rapport: e.rapport, vitesse: f.speed, gaz: gazDe(f), enAir: !f.grounded, t });
    if (roues) {
      roues.maj(f, t);
      if (f.boost && !avant?.boost) roues.ponctuel("turbo", t);
      if (f.grounded && avant && !avant.grounded) roues.ponctuel("land", t);
    }
    regimes.push(e.rpm);
    avant = f;
  }
  const tampon = await ctx.startRendering();
  const x = tampon.getChannelData(0);
  let crete = 0;
  let s2 = 0;
  let nonFinis = 0;
  for (const v of x) {
    if (!Number.isFinite(v)) nonFinis++;
    else {
      crete = Math.max(crete, Math.abs(v));
      s2 += v * v;
    }
  }
  // Analyse : une fenêtre toutes les 1,5 s sans roues, pour que la hauteur soit celle du moteur seul si on a demandé les roues, on garde seulement le début des fenêtres calmes.
  for (let t = 0.6; t + 0.3 < secondes; t += 1.5) {
    const rpm = regimes[Math.min(regimes.length - 1, Math.round((t + 0.125) * 60))]!;
    const i0 = Math.floor(t * sr);
    let q = 0;
    let d2 = 0;
    const n = Math.floor(0.25 * sr);
    for (let i = 0; i < n; i++) {
      const v = x[i0 + i] ?? 0;
      q += v * v;
      d2 += (v - (x[i0 + i - 1] ?? 0)) ** 2;
    }
    // La brillance (écart-type de la dérivée ÷ écart-type du signal) monte avec le régime quand le son s'ouvre et s'accélère : elle ne suppose pas de hauteur claire.
    fenetres.push({ t, rpm, attendu: frequenceAllumage(rpm, p.cylindres), trouve: hauteurHPS(x, sr, t), rms: Math.sqrt(q / n), brillance: q > 0 ? Math.sqrt(d2 / q) : 0 });
  }
  moteur.arreter();
  roues?.arreter();
  return { sr, secondes, crete, rms: Math.sqrt(s2 / x.length), nonFinis, fenetres, noeuds: moteur.noeuds, donnees: x };
}

/**
 * Aucune fuite de nœuds : construit un moteur (et la couche des pneus), l'arrête, et compte les nœuds créés, les `disconnect` appelés et les sources arrêtées.
 * Au redémarrage d'une course, au changement de voiture ou de mode, tout ce qui a été créé doit être détaché.
 */
export async function verifierFuites(approche: Approche, id: ProfilMoteur["id"]): Promise<{ crees: number; deconnectes: number; sourcesDemarrees: number; sourcesArretees: number }> {
  const ctx = new OfflineAudioContext(1, 22050, 22050);
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
    const p = profilDe(id);
    const bruit = bruitBlanc(ctx);
    const { moteur } = await fabriquer(ctx, ctx.destination, bruit, approche, p);
    const roues = creerCoucheRoues(ctx, ctx.destination, bruit);
    moteur.maj({ rpm: p.ralenti, charge: 0.5, passage: 0, sens: 0, rapport: 1, vitesse: 5, gaz: 0.5, enAir: false, t: 0 });
    roues.maj(voitureVirtuelle(5), 0);
    roues.ponctuel("turbo", 0);
    const crees = moteur.noeuds + roues.noeuds;
    moteur.arreter();
    roues.arreter();
    return { crees, deconnectes: suivis.size, sourcesDemarrees: demarres.size, sourcesArretees: arretes.size };
  } finally {
    proto.disconnect = disconnectOrig;
    AudioScheduledSourceNode.prototype.start = startOrig;
    AudioScheduledSourceNode.prototype.stop = stopOrig;
  }
}

// --- La planche -------------------------------------------------------------------------------------------------------------------------------------

export interface PlancheSon {
  /** Active le son (comme le premier geste du joueur), sans toucher à l'interface. */
  activer(): Promise<void>;
  choisir(approche: Approche, voiture?: ProfilMoteur["id"]): Promise<void>;
  /** Un état lisible pour les tests. */
  etat(): { actif: boolean; approche: Approche; voiture: string; rapport: number; rpm: number; vitesse: number; t: number; lecture: boolean; noeuds: number; mesures: Partial<Record<Approche, Mesure>> };
  /** Place le scénario à l'instant `t` (s) et le laisse jouer. */
  aller(t: number): void;
  /** Mesure le coût d'une approche pour la voiture courante : `images` images simulées (JS) et la charge du fil audio pendant `ms` millisecondes. */
  mesurer(approche: Approche, images?: number, ms?: number): Promise<Mesure>;
  arreter(): void;
}

export async function monter(racine: HTMLElement, hote: HoteSon): Promise<PlancheSon> {
  // --- L'état de l'écoute ---
  let ctx: AudioContext | null = null;
  let maitre: GainNode | null = null;
  let bruit: AudioBuffer | null = null;
  let approche: Approche = "A";
  let voiture: ProfilMoteur["id"] = "civile";
  let moteur: Moteur | null = null;
  let roues: CoucheRoues | null = null;
  let boite: EtatBoite = boiteInitiale(profilDe(voiture));
  let tScenario = 0;
  let lecture = true;
  let manuel = false;
  let dernierRaf = 0;
  let trame: TrameVirtuelle = voitureVirtuelle(0);
  let precedente: TrameVirtuelle = trame;
  let construction = 0;
  let volume = 0.7;
  const mesures: Partial<Record<Approche, Mesure>> = {};
  const jsEma = { somme: 0, n: 0 };
  let raf = 0;
  let capacite: { moyenne: number; pic: number } | null = null;

  // --- La page ---
  racine.textContent = "";
  const intro = el("section", "son-intro");
  intro.append(el("h2", undefined, "Planche sonore · le moteur et la route"));
  const p1 = el("p");
  p1.append(
    "Une même course, jouée par une ",
    el("strong", undefined, "voiture virtuelle"),
    " (ralenti, coup de gaz à l'arrêt, accélération sur six rapports, lever de pied, freinage, relance sur la terre en dérive, turbo, vibreur, saut), écoutée avec le moteur d'avant et avec trois approches. ",
    "Écoute au casque puis au haut-parleur, sur téléphone et sur ordinateur. Les pneus, le vent et les bruitages sont ",
    el("strong", undefined, "les mêmes"),
    " partout : seule la voix du moteur change. Touche une approche ou une voiture pendant que ça joue pour comparer sur le même instant.",
  );
  intro.append(p1);
  const p2 = el("p", "note", "Je n'ai pas d'oreilles : j'ai vérifié par des mesures que le régime, les rapports et la hauteur du son suivent la voiture, que rien ne sature ni ne se casse. Si ça sonne bien ou mal, c'est à toi de le dire.");
  intro.append(p2);
  const activer = el("button", "action", "Activer le son");
  activer.type = "button";
  intro.append(activer);
  racine.append(intro);

  const banc = el("section", "son-banc");
  const groupeApproches = el("div", "segments");
  groupeApproches.setAttribute("role", "group");
  groupeApproches.setAttribute("aria-label", "Approche");
  const boutonsApproche = new Map<Approche, HTMLButtonElement>();
  for (const a of APPROCHES) {
    const b = el("button", "segment", NOMS[a]);
    b.type = "button";
    b.dataset.approche = a;
    b.setAttribute("aria-pressed", String(a === approche));
    groupeApproches.append(b);
    boutonsApproche.set(a, b);
  }
  const groupeVoitures = el("div", "segments");
  groupeVoitures.setAttribute("role", "group");
  groupeVoitures.setAttribute("aria-label", "Voiture");
  const boutonsVoiture = new Map<string, HTMLButtonElement>();
  for (const id of PROFILS_PLANCHE) {
    const b = el("button", "segment", NOMS_VOITURES[id] ?? id);
    b.type = "button";
    b.dataset.voiture = id;
    b.setAttribute("aria-pressed", String(id === voiture));
    groupeVoitures.append(b);
    boutonsVoiture.set(id, b);
  }
  const transport = el("div", "son-transport");
  const bLecture = el("button", "segment segment--action", "⏸ Pause");
  bLecture.type = "button";
  const bDebut = el("button", "segment segment--action", "↺ Au début");
  bDebut.type = "button";
  const bManuel = el("button", "segment", "Conduire à la main");
  bManuel.type = "button";
  bManuel.setAttribute("aria-pressed", "false");
  const etiquetteVolume = el("label", "choix", "Volume ");
  const curseurVolume = el("input");
  curseurVolume.type = "range";
  curseurVolume.min = "0";
  curseurVolume.max = "1";
  curseurVolume.step = "0.01";
  curseurVolume.value = String(volume);
  etiquetteVolume.append(curseurVolume);
  transport.append(bLecture, bDebut, bManuel, etiquetteVolume);

  const moments = el("ol", "son-moments");
  const liMoments = MOMENTS.map((m) => {
    const li = el("li");
    const b = el("button", "son-moment", `${fmt(m.t, 1)} s · ${m.nom}`);
    b.type = "button";
    b.addEventListener("click", () => aller(m.t));
    li.append(b);
    moments.append(li);
    return li;
  });

  const lecturePanneau = el("div", "son-lecture");
  const lRapport = el("span", "son-lecture__rapport", "—");
  const lRegime = el("span", "son-lecture__regime", "—");
  const barre = el("div", "son-barre");
  const barreInterieur = el("div", "son-barre__rempli");
  barre.append(barreInterieur);
  const lVitesse = el("span", "son-lecture__vitesse", "—");
  const lMoment = el("span", "son-lecture__moment", "—");
  lecturePanneau.append(lRapport, lRegime, barre, lVitesse, lMoment);
  lecturePanneau.setAttribute("aria-live", "off");

  // Conduite à la main.
  const panneauManuel = el("div", "son-manuel");
  panneauManuel.hidden = true;
  const curseur = (nom: string, min: number, max: number, pas: number, valeur: number) => {
    const l = el("label", "choix", `${nom} `);
    const i = el("input");
    i.type = "range";
    i.min = String(min);
    i.max = String(max);
    i.step = String(pas);
    i.value = String(valeur);
    l.append(i);
    panneauManuel.append(l);
    return i;
  };
  const mVitesse = curseur("Vitesse (m/s)", 0, 80, 0.5, 0);
  const mGaz = curseur("Gaz", 0, 1, 0.01, 0);
  const coche = (nom: string) => {
    const l = el("label", "choix");
    const i = el("input");
    i.type = "checkbox";
    l.append(i, ` ${nom}`);
    panneauManuel.append(l);
    return i;
  };
  const mFrein = coche("Frein");
  const mAir = coche("En l'air");
  const mDerape = coche("Dérapage");
  const mSurface = el("select");
  for (const s of ["road", "dirt", "grass", "ice", "gravel", "snow", "kerb"]) {
    const o = el("option", undefined, { road: "Route", dirt: "Terre", grass: "Herbe", ice: "Glace", gravel: "Gravier", snow: "Neige", kerb: "Vibreur" }[s]);
    o.value = s;
    mSurface.append(o);
  }
  const lSurface = el("label", "choix", "Revêtement ");
  lSurface.append(mSurface);
  panneauManuel.append(lSurface);
  const bTurbo = el("button", "segment segment--action", "Turbo");
  bTurbo.type = "button";
  const bAtterrissage = el("button", "segment segment--action", "Réception");
  bAtterrissage.type = "button";
  panneauManuel.append(bTurbo, bAtterrissage);

  const avis = el("div", "son-avis");
  banc.append(groupeApproches, groupeVoitures, transport, moments, lecturePanneau, panneauManuel, avis);
  racine.append(banc);

  const couts = el("section", "couts son-couts");
  couts.append(el("h2", undefined, "Ce que coûte chaque approche"));
  const tableau = el("div", "tableau");
  const table = el("table");
  const tete = el("thead");
  const trTete = el("tr");
  for (const t of ["Approche", "Code ajouté (JS gzip)", "Fichiers (voiture écoutée)", "Décodage", "Mémoire décodée", "Nœuds audio", "JS par image", "Charge du fil audio"]) {
    const th = el("th", undefined, t);
    th.scope = "col";
    trTete.append(th);
  }
  tete.append(trTete);
  const corps = el("tbody");
  table.append(tete, corps);
  tableau.append(table);
  couts.append(tableau);
  const noteCouts = el("p", "note");
  noteCouts.append(
    "« JS par image » : la boîte virtuelle, le moteur et les pneus réglés une fois par image (60 par seconde), mesuré en direct sur cet appareil. ",
    "« Charge du fil audio » : la part du temps de calcul que le navigateur dépense à produire le son (API ",
    el("code", undefined, "renderCapacity"),
    ", Chrome seulement ; vide ailleurs). Le poids du code est celui de ce que l'approche ajouterait au jeu (",
    el("code", undefined, "poids-parties.mjs"),
    "). Les chiffres sont ceux de la voiture écoutée : B et C chargent leurs fichiers à la demande, une voiture à la fois.",
  );
  couts.append(noteCouts);
  racine.append(couts);

  // --- Le moteur ---
  const AVIS: Record<Approche, string[]> = {
    actuel: ["Le son d'avant (lot 9) : deux oscillateurs, un filtre, six rapports aux vitesses fixes. Sert de repère.", "Aucun profil par voiture : toutes sonnent pareil."],
    A: [
      "Synthèse en direct : une onde riche en harmoniques à la fréquence d'allumage, un deuxième oscillateur désaccordé, l'harmonique ½, une saturation douce, un filtre qui suit le régime et la charge, le souffle d'admission, la pétarade. Une voiture = quelques nombres (cylindres, ralenti, rouge, timbre).",
      "Coût : aucun fichier, une douzaine de nœuds. Risque : un timbre « synthé » qu'aucun réglage ne fait tout à fait disparaître. Mon avis (sans l'avoir entendu) : la plus économique et la plus souple ; la crédibilité dépend de ton oreille.",
    ],
    B: [
      "Échantillons rendus hors ligne par un outil du dépôt : un modèle d'allumages et d'échappement (résonances amorties par moteur) rendu en six boucles par voiture, jouées en boucle sans fin, fondues l'une dans l'autre selon le régime, accélérées ou ralenties pour suivre le régime exact.",
      "Coût : ≈ 38 ko par voiture à télécharger (à la demande, la voiture choisie seulement), un décodage au chargement, très peu de calcul (lecture de six boucles). Aucune licence. Mon avis (sans l'avoir entendu) : plus de matière que la synthèse pour le même calcul, des voix vraiment distinctes ; mais rendu par modèle, pas enregistré.",
    ],
    C: [
      "Enregistrements libres de droits (CC0) : six boucles de moteur d'une même voiture (OpenGameArt), replacées sur la plage de régime de la voiture écoutée et jouées comme en B.",
      "Coût : ≈ 28 ko pour ce seul moteur ; il faudrait un jeu d'enregistrements par voiture (dix), qu'il faut trouver, licencier et créditer ; qualité des CC0 libres limitée (un seul moteur, hauteur étroite). Mon avis (sans l'avoir entendu) : le plus réaliste en principe, mais ce qui existe en libre n'offre pas dix voix ; on entend ici le plafond de l'approche avec une seule source.",
    ],
  };
  const majAvis = () => {
    avis.textContent = "";
    avis.append(el("h3", undefined, NOMS[approche]));
    for (const t of AVIS[approche]) avis.append(el("p", undefined, t));
    if (approche === "C") {
      const note = el("p", "note");
      note.append("Sources, licence CC0 et empreintes : ", el("code", undefined, "apps/web/vitrine/son/LISEZMOI.md"), ".");
      avis.append(note);
    }
  };

  async function construire(): Promise<void> {
    const mien = ++construction;
    moteur?.arreter();
    roues?.arreter();
    moteur = null;
    roues = null;
    if (!ctx || !maitre || !bruit) return;
    const p = profilDe(voiture);
    avis.dataset.etat = "chargement";
    try {
      const fab = await fabriquer(ctx, maitre, bruit, approche, p);
      if (mien !== construction) {
        fab.moteur.arreter();
        return;
      }
      moteur = fab.moteur;
      roues = creerCoucheRoues(ctx, maitre, bruit);
      boite = { ...boiteInitiale(p), rapport: boite.rapport };
      const m: Mesure = { ...(mesures[approche] ?? { jsMs: 0, images: 0, charge: null }), noeuds: fab.moteur.noeuds + roues.noeuds, octets: fab.octets, decodageMs: fab.decodageMs, memoire: fab.memoire, jsMs: 0, images: 0, charge: null };
      mesures[approche] = m;
      jsEma.somme = 0;
      jsEma.n = 0;
    } catch (e) {
      hote.erreurs.push(`planche son : ${String(e)}`);
    }
    avis.dataset.etat = "pret";
    majTableau();
  }

  function majTableau(): void {
    corps.textContent = "";
    const parties = hote.parties();
    const poidsCode = (a: Approche): string => {
      if (!parties) return "…";
      const cle = { actuel: "Son : le moteur d'avant", A: "Son : approche A", B: "Son : approche B", C: "Son : approche B" }[a];
      const o = Object.entries(parties).find(([n]) => n.startsWith(cle))?.[1];
      return o === undefined ? "…" : a === "actuel" ? `${ko(o)} (déjà dans le jeu)` : ko(o);
    };
    for (const a of APPROCHES) {
      const m = mesures[a];
      const tr = el("tr");
      tr.dataset.ligne = a;
      tr.append(el("th", undefined, NOMS[a]));
      tr.append(el("td", undefined, poidsCode(a)));
      tr.append(el("td", undefined, m ? (a === "B" || a === "C" ? ko(m.octets) : "aucun") : "à écouter"));
      tr.append(el("td", undefined, m ? (a === "B" || a === "C" ? `${fmt(m.decodageMs)} ms` : "—") : "—"));
      tr.append(el("td", undefined, m ? (a === "B" || a === "C" ? `${fmt(m.memoire / 1024)} ko` : "—") : "—"));
      tr.append(el("td", undefined, m ? String(m.noeuds) : "—"));
      tr.append(el("td", undefined, m && m.images > 0 ? `${fmt(m.jsMs, 3)} ms` : "—"));
      tr.append(el("td", undefined, m?.charge ? `${fmt(m.charge.moyenne * 100, 1)} % (pic ${fmt(m.charge.pic * 100, 1)} %)` : "—"));
      corps.append(tr);
    }
  }

  function marquer(): void {
    for (const [a, b] of boutonsApproche) b.setAttribute("aria-pressed", String(a === approche));
    for (const [id, b] of boutonsVoiture) b.setAttribute("aria-pressed", String(id === voiture));
    majAvis();
  }

  async function choisir(a: Approche, v?: ProfilMoteur["id"]): Promise<void> {
    approche = a;
    if (v) voiture = v;
    marquer();
    await construire();
  }

  async function activerSon(): Promise<void> {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) {
        hote.erreurs.push("planche son : Web Audio n'est pas disponible");
        return;
      }
      ctx = new Ctor();
      maitre = ctx.createGain();
      maitre.gain.value = volume;
      maitre.connect(ctx.destination);
      bruit = bruitBlanc(ctx);
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
      // Un onglet caché se tait (comme le jeu) ; il reprend au retour.
      document.addEventListener("visibilitychange", () => {
        if (!ctx) return;
        if (document.hidden) void ctx.suspend();
        else void ctx.resume();
      });
    }
    if (ctx.state === "suspended") await ctx.resume();
    activer.textContent = "Son activé";
    activer.disabled = true;
    if (!moteur) await construire();
  }

  // --- La boucle ---
  function lireTrame(dt: number): TrameVirtuelle {
    if (manuel) {
      return {
        speed: Number(mVitesse.value),
        throttle: Number(mGaz.value),
        brake: mFrein.checked,
        slide: mDerape.checked ? 0.35 : 0,
        grounded: !mAir.checked,
        surface: mSurface.value as TrameVirtuelle["surface"],
        kerb: mSurface.value === "kerb" ? 2 : 0,
        boost: false,
        cut: false,
      };
    }
    if (lecture) tScenario = (tScenario + dt) % DUREE_SCENARIO;
    return voitureVirtuelle(tScenario);
  }

  function tick(maintenant: number): void {
    raf = requestAnimationFrame(tick);
    const dt = dernierRaf ? Math.min(0.05, (maintenant - dernierRaf) / 1000) : 0;
    dernierRaf = maintenant;
    const p = profilDe(voiture);
    precedente = trame;
    trame = lireTrame(dt);
    const t0 = performance.now();
    boite = pasBoite(boite, p, trame.speed, gazDe(trame), dt, !trame.grounded);
    if (moteur && ctx?.state === "running") {
      const entree: EntreeMoteur = { rpm: boite.rpm, charge: boite.charge, passage: boite.passage, sens: boite.sens, rapport: boite.rapport, vitesse: trame.speed, gaz: gazDe(trame), enAir: !trame.grounded };
      moteur.maj(entree);
      roues?.maj(trame);
      if (trame.boost && !precedente.boost) roues?.ponctuel("turbo");
      if (trame.grounded && !precedente.grounded) roues?.ponctuel("land");
      const ms = performance.now() - t0;
      jsEma.somme += ms;
      jsEma.n++;
      const m = mesures[approche];
      if (m && jsEma.n % 30 === 0) {
        m.jsMs = jsEma.somme / jsEma.n;
        m.images = jsEma.n;
        if (capacite) m.charge = capacite;
        majTableau();
      }
    }
    // Lecture
    lRapport.textContent = `Rapport ${boite.rapport}`;
    lRegime.textContent = `${fmt(boite.rpm)} tr/min`;
    lVitesse.textContent = `${fmt(trame.speed * 3.6)} km/h`;
    barreInterieur.style.transform = `scaleX(${Math.min(1, Math.max(0, (boite.rpm - p.ralenti) / (p.rouge - p.ralenti)))})`;
    const iMoment = manuel ? -1 : MOMENTS.reduce((r, m, i) => (tScenario >= m.t ? i : r), 0);
    liMoments.forEach((li, i) => li.classList.toggle("actif", i === iMoment));
    lMoment.textContent = manuel ? "Conduite à la main" : `${fmt(tScenario, 1)} s / ${DUREE_SCENARIO} s${boite.passage > 0.2 ? " · changement de rapport" : ""}`;
  }

  function aller(t: number): void {
    manuel = false;
    bManuel.setAttribute("aria-pressed", "false");
    panneauManuel.hidden = true;
    tScenario = t;
    lecture = true;
    bLecture.textContent = "⏸ Pause";
    void activerSon();
  }

  // --- Les gestes ---
  activer.addEventListener("click", () => void activerSon());
  for (const [a, b] of boutonsApproche) b.addEventListener("click", () => void activerSon().then(() => choisir(a)));
  for (const [id, b] of boutonsVoiture) b.addEventListener("click", () => void activerSon().then(() => choisir(approche, id as ProfilMoteur["id"])));
  bLecture.addEventListener("click", () => {
    lecture = !lecture;
    bLecture.textContent = lecture ? "⏸ Pause" : "▶ Jouer";
    void activerSon();
  });
  bDebut.addEventListener("click", () => aller(0));
  bManuel.addEventListener("click", () => {
    manuel = !manuel;
    bManuel.setAttribute("aria-pressed", String(manuel));
    panneauManuel.hidden = !manuel;
    void activerSon();
  });
  curseurVolume.addEventListener("input", () => {
    volume = Number(curseurVolume.value);
    maitre?.gain.setTargetAtTime(volume, ctx?.currentTime ?? 0, 0.03);
  });
  bTurbo.addEventListener("click", () => roues?.ponctuel("turbo"));
  bAtterrissage.addEventListener("click", () => roues?.ponctuel("land"));

  marquer();
  majTableau();
  raf = requestAnimationFrame(tick);

  return {
    activer: activerSon,
    choisir,
    etat: () => ({ actif: ctx?.state === "running", approche, voiture, rapport: boite.rapport, rpm: boite.rpm, vitesse: trame.speed, t: tScenario, lecture, noeuds: moteur?.noeuds ?? 0, mesures }),
    aller,
    async mesurer(a, images = 300, ms = 2500) {
      await activerSon();
      await choisir(a);
      // Le coût JS : on rejoue `images` images du scénario sans attendre, en mesurant le seul temps des appels.
      const p = profilDe(voiture);
      let e: EtatBoite = boiteInitiale(p);
      const t0 = performance.now();
      for (let i = 0; i < images; i++) {
        const f = voitureVirtuelle((i / 60) % DUREE_SCENARIO);
        e = pasBoite(e, p, f.speed, gazDe(f), 1 / 60, !f.grounded);
        moteur?.maj({ rpm: e.rpm, charge: e.charge, passage: e.passage, sens: e.sens, rapport: e.rapport, vitesse: f.speed, gaz: gazDe(f), enAir: !f.grounded });
        roues?.maj(f);
      }
      const jsMs = (performance.now() - t0) / images;
      await new Promise((r) => setTimeout(r, ms));
      const m = mesures[a]!;
      m.jsMs = jsMs;
      m.images = images;
      if (capacite) m.charge = capacite;
      majTableau();
      return m;
    },
    arreter() {
      cancelAnimationFrame(raf);
      moteur?.arreter();
      roues?.arreter();
      void ctx?.close();
    },
  };
}
