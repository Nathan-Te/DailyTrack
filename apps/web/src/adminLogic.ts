import { FIGURE_NAMES, THEME_NAMES } from "@cdj/sim";

// Page /admin : construit l'adresse du jeu à partir de choix de test. Logique pure (testée par Vitest) ; le DOM est dans
// `admin.ts`. Rien de tout cela ne touche à la simulation : ce ne sont que les paramètres d'adresse que le jeu connaît déjà.

export type Scenario = "jour" | "essai" | "pilotage" | "surfaces" | "largeurs" | "vitesse" | "glace" | "relief" | "cuves" | "air" | "bas-cotes" | "figures" | "figure" | "plat";

/** Lot 46 : les scènes que la page d'admin propose (`?reglages=`) : le palier 3 (ordinateur), le palier 2 et le groupe « vie et ciel » (téléphone récent) ; lot 45 : les paliers 1 et 2 seuls. */
export const SCENES_ADMIN = ["3", "2+vie+ciel", "3-ombres", "1", "2"] as const;
/**
 * Lot 45 : essayer la règle de qualité automatique (recette et aperçus) — l'appareil imposé (`?appareil=`) et, au besoin, les médianes des mesures de l'accueil
 * (`?intervalles=`, à 60 Hz) : un téléphone qui tient le palier 2, un ordinateur trop lent qui descend jusqu'au palier 1.
 */
export const ESSAIS_QUALITE: Record<string, [appareil: string, intervalles?: string]> = { telephone: ["telephone"], ordinateur: ["ordinateur"], "telephone-tient": ["telephone", "16"], "ordinateur-lent": ["ordinateur", "30,25,40"] };

export interface AdminState {
  scenario: Scenario;
  /** AAAA-MM-JJ du circuit du jour ("" : aujourd'hui). Seulement pour le scénario `jour`. */
  date: string;
  /** Thème forcé ("" : celui du jour). Seulement pour le scénario `jour`. */
  theme: string;
  /** Figure à essayer en boucle (`?scenario=figure&f=…`, lot 20) : son nom, sa variante ("" : la première) et le miroir. Seulement pour le scénario `figure`. */
  figure: string;
  figureVariant: string;
  figureMirror: boolean;
  /** Variante du planning à essayer ("" : celle en vigueur ; `?variant=N`, jamais classée). Seulement pour le scénario `jour`. */
  variant: string;
  /** Panneau de réglages de la voiture (`debug` + `tune`). */
  tune: boolean;
  /** Outils de test (`debug`). */
  debug: boolean;
  demo: boolean;
  fxOff: boolean;
  quality: "" | "0" | "1" | "2";
  /** Lot 46 : la scène à un palier (`?reglages=` : `3`, `2+vie+ciel`…), recette et aperçus seulement ; vide : le palier 1. */
  scene: "" | (typeof SCENES_ADMIN)[number];
  /** Lot 45 : un essai de la règle de qualité (`ESSAIS_QUALITE`) ; vide : l'appareil tel qu'il est. */
  essaiQualite: string;
  /** Caméra forcée au chargement (`?camera=`, lot 23) : "" celle mémorisée. */
  camera: "" | "proche" | "loin" | "capot";
  shakeOff: boolean;
  ghostOff: boolean;
  /** Lot 43 : l'ancienne scène (`?palier=existant`, chargée à la demande, recette et aperçus seulement) pour la comparer au palier 1. */
  palierExistant: boolean;
  touch: "" | "1" | "0";
  /** Miniatures des archives : "" normales (3D inclinée), "top" d'aplomb, "2d" repli sans WebGL, "off" aucune. */
  thumbs: "" | "top" | "2d" | "off";
  /** Mode de direction tactile forcé ("" : celui des réglages). */
  steer: "" | "boutons" | "glisser";
  /** Dessine les zones tactiles actives (`?zones=1`). */
  zones: boolean;
  /** Force l'écran d'accueil (`?home=1`, lot 29) : sans cela, `debug` et les liens directs le sautent. */
  home: boolean;
  /** Montre l'aide « Comment jouer » même avec `debug` (`?howto=1`, lot 29). */
  howto: boolean;
  /** Le Salon (`?mode=salon`, lot 26) : un circuit toutes les 10 minutes ; avec `api=demo` ou une API. Remplace le circuit du jour. */
  salon: boolean;
  /** Revoir le meilleur tour (`?watch=best`, lot 27b) : mode spectateur sur le circuit du jour ou, avec le Salon, la session en cours. */
  watch: boolean;
  /** Durée d'une session du Salon en minutes (`?salonMinutes=`), "" : 10. Démo et essais seulement. */
  salonMinutes: string;
  /** Accélération du temps (outil `debug`), "" : normal. */
  timescale: string;
  /** Adresse de l'API de classement ("" : aucune). */
  api: string;
  /** Retouche 40b : une voiture d'essai (`?voiture=<id>&couleur=<n>&motif=<m>`, recette et aperçus : rien d'enregistré, course non classée) ; "" : celle choisie. */
  voiture: "" | (typeof VOITURES_ESSAI)[number];
  /** Rang de la couleur dans la palette ("" : l'orange de Track). */
  couleur: string;
  motif: "" | "flancs" | "unie";
}

/** Les voitures du catalogue (`voiture/catalogue.ts` : la page d'admin ne l'importe pas, il tire les modèles ; un test vérifie qu'elles sont les mêmes). */
export const VOITURES_ESSAI = ["civile", "evolution", "gt", "proto"] as const;

export const DEFAULT_ADMIN: Readonly<AdminState> = Object.freeze({
  scenario: "jour",
  date: "",
  theme: "",
  variant: "",
  figure: "",
  figureVariant: "",
  figureMirror: false,
  tune: false,
  debug: false,
  demo: false,
  fxOff: false,
  quality: "",
  scene: "",
  essaiQualite: "",
  camera: "",
  shakeOff: false,
  ghostOff: false,
  palierExistant: false,
  touch: "",
  thumbs: "",
  steer: "",
  zones: false,
  home: false,
  howto: false,
  salon: false,
  watch: false,
  salonMinutes: "",
  timescale: "",
  api: "",
  voiture: "",
  couleur: "",
  motif: "",
});

/** Paramètres d'adresse (sans « ? ») : uniquement ce qui s'écarte de la valeur par défaut. */
export function buildQuery(s: Readonly<AdminState>): string {
  const p = new URLSearchParams();
  if (s.scenario !== "jour") p.set("scenario", s.scenario);
  if (s.watch) p.set("watch", "best");
  if (s.salon) {
    // Le Salon remplace le circuit du jour : ni date, ni thème, ni variante.
    p.set("mode", "salon");
    if (s.salonMinutes !== "") p.set("salonMinutes", s.salonMinutes);
  } else if (s.scenario === "jour") {
    if (s.date) p.set("seed", s.date);
    if (s.variant !== "") p.set("variant", s.variant);
    if (s.theme) p.set("theme", s.theme);
  }
  if (s.scenario === "figure") {
    p.set("f", s.figure || FIGURE_NAMES[0]!);
    if (s.figureVariant !== "") p.set("v", s.figureVariant);
    if (s.figureMirror) p.set("m", "1");
  }
  // `tune` et `timescale` ne marchent qu'avec `debug` : on le sous-entend.
  const debug = s.debug || s.tune || s.timescale !== "";
  if (debug) p.set("debug", "");
  if (s.tune) p.set("tune", "");
  if (s.timescale !== "") p.set("timescale", s.timescale);
  if (s.demo) p.set("demo", "");
  if (s.fxOff) p.set("fx", "off");
  if (s.quality !== "") p.set("quality", s.quality);
  if (s.scene !== "") p.set("reglages", s.scene);
  const essai = ESSAIS_QUALITE[s.essaiQualite];
  if (essai) p.set("appareil", essai[0]);
  if (essai?.[1]) p.set("intervalles", essai[1]);
  if (s.camera !== "") p.set("camera", s.camera);
  if (s.shakeOff) p.set("shake", "0");
  if (s.ghostOff) p.set("ghost", "off");
  if (s.palierExistant) p.set("palier", "existant");
  if (s.touch !== "") p.set("touch", s.touch);
  if (s.thumbs !== "") p.set("thumbs", s.thumbs);
  if (s.steer !== "") p.set("steer", s.steer);
  if (s.zones) p.set("zones", "1");
  if (s.home) p.set("home", "1");
  if (s.howto) p.set("howto", "1");
  if (s.voiture !== "") {
    p.set("voiture", s.voiture);
    if (s.couleur !== "") p.set("couleur", s.couleur);
    if (s.motif !== "") p.set("motif", s.motif);
  }
  if (s.api.trim() !== "") p.set("api", s.api.trim());
  return p.toString().replace(/=(?=&|$)/g, "");
}

/** Adresse relative du jeu depuis `/admin/` (le jeu est à la racine : `../`). */
export function gameHref(s: Readonly<AdminState>): string {
  const q = buildQuery(s);
  return q ? `../?${q}` : "../";
}

/** Lit un état depuis un texte JSON ; toute valeur absente ou invalide retombe sur la valeur par défaut. */
export function parseAdmin(raw: string | null): AdminState {
  const s: AdminState = { ...DEFAULT_ADMIN };
  if (!raw) return s;
  try {
    const o = JSON.parse(raw) as Partial<Record<keyof AdminState, unknown>>;
    if (o.scenario === "jour" || o.scenario === "essai" || o.scenario === "pilotage" || o.scenario === "surfaces" || o.scenario === "largeurs" || o.scenario === "vitesse" || o.scenario === "glace" || o.scenario === "relief" || o.scenario === "cuves" || o.scenario === "air" || o.scenario === "bas-cotes" || o.scenario === "figures" || o.scenario === "figure" || o.scenario === "plat") s.scenario = o.scenario;
    if (typeof o.date === "string" && /^(\d{4}-\d{2}-\d{2})?$/.test(o.date)) s.date = o.date;
    if (typeof o.theme === "string" && (["", ...THEME_NAMES] as readonly string[]).includes(o.theme)) s.theme = o.theme;
    for (const k of ["tune", "debug", "demo", "fxOff", "shakeOff", "ghostOff", "palierExistant", "zones", "home", "howto", "salon", "watch"] as const) if (typeof o[k] === "boolean") s[k] = o[k] as boolean;
    if (o.quality === "" || o.quality === "0" || o.quality === "1" || o.quality === "2") s.quality = o.quality;
    if (o.scene === "" || (SCENES_ADMIN as readonly unknown[]).includes(o.scene)) s.scene = o.scene as AdminState["scene"];
    if (typeof o.essaiQualite === "string" && (o.essaiQualite === "" || o.essaiQualite in ESSAIS_QUALITE)) s.essaiQualite = o.essaiQualite;
    if (o.camera === "" || o.camera === "proche" || o.camera === "loin" || o.camera === "capot") s.camera = o.camera;
    if (o.thumbs === "" || o.thumbs === "top" || o.thumbs === "2d" || o.thumbs === "off") s.thumbs = o.thumbs;
    if (o.steer === "" || o.steer === "boutons" || o.steer === "glisser") s.steer = o.steer;
    if (o.touch === "" || o.touch === "1" || o.touch === "0") s.touch = o.touch;
    if (typeof o.figure === "string" && (o.figure === "" || (FIGURE_NAMES as readonly string[]).includes(o.figure))) s.figure = o.figure;
    if (typeof o.figureVariant === "string" && /^\d{0,2}$/.test(o.figureVariant)) s.figureVariant = o.figureVariant;
    if (typeof o.figureMirror === "boolean") s.figureMirror = o.figureMirror;
    if (typeof o.variant === "string" && /^\d{0,2}$/.test(o.variant)) s.variant = o.variant;
    if (typeof o.timescale === "string" && /^\d{0,2}$/.test(o.timescale)) s.timescale = o.timescale;
    if (typeof o.salonMinutes === "string" && /^\d{0,2}$/.test(o.salonMinutes)) s.salonMinutes = o.salonMinutes;
    if (typeof o.api === "string") s.api = o.api.slice(0, 300);
    if (typeof o.voiture === "string" && (["", ...VOITURES_ESSAI] as readonly string[]).includes(o.voiture)) s.voiture = o.voiture as AdminState["voiture"];
    if (typeof o.couleur === "string" && /^[0-7]?$/.test(o.couleur)) s.couleur = o.couleur;
    if (o.motif === "" || o.motif === "flancs" || o.motif === "unie") s.motif = o.motif;
  } catch {
    /* état illisible : valeurs par défaut */
  }
  return s;
}

/** Clés de stockage du jeu (`cdj:…`) : records, réglages, caméra, son, planning de démonstration. Le jeton d'admin et les choix de l'admin (`cdj:admin…`) restent. */
export function gameKeys(keys: string[]): string[] {
  return keys.filter((k) => k.startsWith("cdj:") && !k.startsWith("cdj:admin")).sort();
}

export const PRESETS: { label: string; hint: string; state: Partial<AdminState> }[] = [
  { label: "Réglage de la voiture", hint: "circuit de pilotage + panneau de réglages", state: { scenario: "pilotage", tune: true } },
  { label: "Revêtements et blocs", hint: "terre, glace, herbe, turbo, relevés, plaque", state: { scenario: "surfaces" } },
  { label: "Largeurs de route", hint: "14, 20 et 26 m, transitions, courbe ample, S large, rétrécissement avant un virage", state: { scenario: "largeurs" } },
  { label: "Glace", hint: "ligne droite de glace après une de route, deux virages en roue libre, slalom", state: { scenario: "glace" } },
  { label: "Vitesse", hint: "plaque et longue descente, turbos enchaînés, grande courbe relevée à fond, freinage avant un virage serré", state: { scenario: "vitesse" } },
  { label: "Relief et sauts", hint: "montées de deux niveaux, longue descente, saut court et long saut au-dessus du vide, section surélevée sans rebords", state: { scenario: "relief" } },
  { label: "Air et atterrissages", hint: "dos d'âne à haute vitesse, tremplin pris en braquant, long saut, saut vers un virage relevé, chute de trois niveaux, mur quitté en l'air ; le frein fige la caisse en l'air", state: { scenario: "air" } },
  { label: "Les figures", hint: "onze figures marquantes de la bibliothèque (lot 20) : S serré-large, turbo et courbe, saut vers un virage relevé, slalom de glace, double saut…", state: { scenario: "figures" } },
  { label: "Une figure en boucle", hint: "la figure choisie, cinq droites de lancement, point de contrôle juste avant (touche R pour recommencer)", state: { scenario: "figure" } },
  { label: "Bas-côtés et vibreurs", hint: "un virage par bas-côté (herbe, terre et gravier, neige poudreuse, vide), des vibreurs, une portion bosselée, un serré à couper", state: { scenario: "bas-cotes" } },
  { label: "Cuves et murs", hint: "cuve droite, mur latéral, virage en cuve à pleine vitesse, puis le même virage abordé trop lentement", state: { scenario: "cuves" } },
  { label: "Démo automatique", hint: "le pilote roule seul, tous les effets", state: { scenario: "surfaces", demo: true } },
  { label: "Tremplin et sauts", hint: "circuit d'essai", state: { scenario: "essai" } },
  { label: "Le Salon (démonstration)", hint: "un circuit toutes les 10 minutes, joueurs fictifs, fantômes, classement de session, podium (?mode=salon&api=demo)", state: { api: "demo", salon: true } },
  { label: "Le Salon, sessions de 2 minutes", hint: "pour voir une bascule de circuit en deux minutes (?salonMinutes=2)", state: { api: "demo", salon: true, salonMinutes: "2" } },
  { label: "Revoir le meilleur tour (démonstration)", hint: "un jour passé du jeu de données de démonstration, en spectateur (?api=demo&day=2026-09-30&watch=best)", state: { api: "demo", date: "2026-09-30", watch: true } },
  { label: "Accueil (démonstration)", hint: "l'écran d'accueil du jeu, classement et Salon de démonstration (?api=demo) ; ajoute le téléphone avec ?touch=1", state: { api: "demo" } },
  { label: "Accueil avec les outils de test", hint: "l'accueil forcé (?home=1) malgré debug : pour tester le parcours accueil → course", state: { api: "demo", home: true, debug: true } },
  { label: "Archives de démonstration", hint: "14 jours passés, classements figés et fantômes (?api=demo)", state: { api: "demo" } },
  { label: "Essai tactile (souris = doigt)", hint: "interface mobile sur ordinateur", state: { touch: "1" } },
  { label: "Zones tactiles (boutons)", hint: "boutons ← → et frein, zones actives dessinées", state: { scenario: "pilotage", touch: "1", steer: "boutons", zones: true } },
];
