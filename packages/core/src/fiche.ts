// Lot K1 (plateforme) — **la fiche d'un jeu** : le fichier `config/jeux/<id>.json` dit à la plateforme ce qu'elle doit savoir d'un jeu pour le PRÉSENTER et le BRANCHER (nom,
// accroche, étiquette, thèmes, critère de classement, zones de la CI, tables, préfixe de stockage, scènes de musique, budgets…). Ce module est pur (aucun accès au disque, au DOM ni
// au réseau) : le type, la validation et les **projections** — une par lecteur (`portail`, `serveur`, `ci`, `jeu`), que `npm run fiches` écrit dans `config/jeux/projections/`
// et dont un test vérifie qu'elles sont à jour. Conception : docs/plateforme/kit-de-jeu.md (lot K0), § 3 ; rapport : docs/plateforme/lots/lot-K1-fiche-de-jeu.md.
//
// **Ce que la fiche ne porte pas** : le générateur, la simulation, le rendu, les sensations, les fonctions de rejeu — tout ce qui est du jeu. Les textes restent dans les catalogues
// `fr` + `en` ; la fiche porte les CLÉS (`accroche`, `titre`). **Qui l'écrit** : le lot du jeu (seule exception à la règle des zones : `config/jeux/<id>.json`) ;
// `validerFiche` refuse donc une fiche qui sortirait de ce que le jeu peut réclamer (zones de CI ailleurs que dans les siennes, tables d'un autre jeu…).
//
// **Jeux sans fiche (jusqu'aux lots K1b et K1c)** : Track et Jump gardent leur code d'aujourd'hui ; chaque consommateur lit la fiche d'un jeu qui en a une et garde sinon son code
// actuel. `JEUX_SANS_FICHE` nomme ces deux jeux pour les listes qui doivent encore les contenir ; il disparaît quand leurs fiches existent.

export type SensClassement = "asc" | "desc";
export type UniteScore = "ms" | "ticks" | "mm" | "points";
export type FormatScore = "temps" | "hauteur" | "entier";
export type MethodeMedailles = "facteurs-auteur" | "figees-niveau" | "pourcentage-diamant";
export type ModeJours = "registre" | "fichier-par-jour";
export type SortTable = "videe" | "gardee";

/** Un fichier de zones de la CI : des motifs de chemins (`*` = un segment, `**` = tout) moins `sauf`. Même forme que `e2e/zones.json`. */
export interface ZoneCI {
  _?: string;
  globs: string[];
  sauf?: string[];
}

export interface FicheJeu {
  /** Le dossier du jeu sur le site (`/tower/`), son préfixe de route (`/api/tower/`) et son nom de dossier (`apps/tower`). `a-z`, `0-9`, `-`. */
  id: string;
  /** Son code au registre du serveur (`GET /api/portail/jour`, tables) : `cdj` pour Track, sinon l'identifiant. */
  code: string;
  /** Sa place dans les listes (cartouches, onglets, zones) ; unique. */
  ordre: number;
  nom: { fr: string; en: string };
  /** Clé de catalogue du portail : l'accroche de la cartouche. */
  accroche: string;
  /** Clé de catalogue du titre de la cartouche ; absente : le nom en capitales. */
  titre?: string;
  etiquette: {
    /** Couleurs et police de l'étiquette (valeurs des jetons du socle). */
    fond: string;
    coque: string;
    police: string;
    /** `propre` : un dessin écrit dans `@cdj/ui` (Tower) ; `generique` : l'étiquette sans dessin (jeu neuf, lot K3). */
    dessin: "propre" | "generique";
  };
  /** Un nouveau jeu naît `off` ; Track et Jump sont `on` (hérité de l'arrivée de l'interrupteur). */
  etatDepart: "off" | "on";
  /** Le premier jour du jeu (AAAA-MM-JJ) ; sa numérotation. */
  premierJour: string;
  classement: {
    /** Le tri, départages compris. */
    colonnes: { nom: string; sens: SensClassement }[];
    /** Compte-t-il dans le classement cumulé (au temps) ? Un jeu à la hauteur : non. */
    cumul: boolean;
    unite: UniteScore;
    format: FormatScore;
  };
  medailles: { methode: MethodeMedailles; bareme: number[]; plafondDiamant?: number };
  partage: { extras: ("morts" | "vies" | "rang")[] };
  /** Les codes des thèmes ; les textes sont `portail.theme.<id>.<code>` dans le catalogue du portail. */
  themes: string[];
  /** `fichier:constante` des versions que la plateforme lit (lot K2) : un test vérifie que chacune existe. */
  versions: { sim: string; generateur: string; medailles?: string };
  jours: {
    /** Le champ que prévoit K1 pour le registre des versions de Tower (traité à part) : `registre` (plages, comme Track) ou `fichier-par-jour`. */
    mode: ModeJours;
    dossier?: string;
    /** La preuve de l'auteur ne quitte jamais le serveur (règle R9) : vrai pour un jeu dont les jours figés portent une `preuve`. */
    preuveInterditeEnProd: boolean;
  };
  rejeu: { unitesServeur: number; fil?: boolean; maxTicks: number };
  donnees: {
    /** Les tables liées à un joueur ou une partie (vidées par la remise à zéro) ou gardées (contenu du jour). */
    tables: { nom: string; sort: SortTable }[];
    stockage: { prefixe: string; reglagesGardes: string[] };
  };
  message: { ou: string };
  zoneNouveautes: string;
  musique: { scenes: string[] };
  /** Le jeu a-t-il une page d'outils `/<id>/admin/` ? */
  admin: { outils: boolean };
  /** Les zones qu'une PR de ce jeu peut toucher (`zones-jeu.mjs`) ; `serveur` en est la part qui compte aussi pour la plateforme (`ci-scope.mjs`). */
  zones: { jeu: string[]; serveur: string[] };
  e2e: {
    /** Le dossier des specs ; la suite de la CI (`tower` : `tower/<spec>`, projet Playwright `tower-<navigateur>`). */
    dossier: string;
    suite: string;
    fumee: string[];
    /** Zones nommées de `e2e/zones.json` pour ce jeu, et ses specs (nom de fichier → zones). */
    zones: Record<string, ZoneCI>;
    specs: Record<string, string[]>;
    /** Nombre de parts Chromium de la CI complète, par mode. */
    parts: { main: number; complet: number; nuit: number };
  };
  /** Les lignes de `docs/plateforme/budgets.md` du jeu (les plafonds y restent : un seul endroit). */
  budget: { lignes: string[] };
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// Validation

const ID = /^[a-z][a-z0-9-]{1,23}$/;
const JOUR = /^\d{4}-\d{2}-\d{2}$/;
const COULEUR = /^#[0-9A-Fa-f]{6}$/;
const NOM_TABLE = /^[a-z][a-z0-9_]*$/;
const NOM_COLONNE = /^[a-z][a-z0-9_]*$/;
const CHEMIN = /^[A-Za-z0-9_./*@-]+$/;
const LIGNE_BUDGET = /^[a-z0-9-]+\.[A-Za-z0-9]+$/;
const SCENE = /^[a-z0-9]+(:[a-z0-9-]+)?$/;
const FICHIER_VERSION = /^[A-Za-z0-9_./-]+\.ts:[A-Z][A-Z0-9_]*$/;

const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const estTexte = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const estEntier = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
const listeDeTextes = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

/** Les préfixes de chemins qu'un jeu `id` peut réclamer pour ses zones : les siens, rien d'autre (la fiche est écrite par le lot du jeu). */
export function prefixesDeZones(id: string): string[] {
  return [`apps/${id}/`, `packages/${id}-sim/`, `docs/${id}/`, `apps/api/src/${id}`, `apps/api/test/${id}`, `apps/api/scripts/${id}-`];
}
const globDuJeu = (glob: string, id: string): boolean => !glob.split("/").includes("..") && prefixesDeZones(id).some((p) => glob.startsWith(p));

/**
 * Les problèmes d'une fiche lue (JSON brut) : une liste vide veut dire « valide ». Chaque message nomme le champ (`etiquette.fond : …`). `idDuFichier` : le nom du fichier sans `.json`,
 * qui doit être l'identifiant (un fichier ne peut pas se faire passer pour un autre jeu).
 */
export function validerFiche(brut: unknown, idDuFichier?: string): string[] {
  const p: string[] = [];
  if (!estObjet(brut)) return ["la fiche n'est pas un objet JSON"];
  const f = brut;
  const ko = (champ: string, attendu: string) => p.push(`${champ} : ${attendu}`);

  if (!estTexte(f.id) || !ID.test(f.id)) ko("id", "minuscules, chiffres et tirets (2 à 24 caractères)");
  const id = typeof f.id === "string" ? f.id : "";
  if (idDuFichier !== undefined && id !== idDuFichier) ko("id", `doit être « ${idDuFichier} » (le nom du fichier)`);
  if (!estTexte(f.code) || !ID.test(f.code)) ko("code", "le code du registre du serveur");
  if (!estEntier(f.ordre) || f.ordre < 1) ko("ordre", "entier ≥ 1");

  if (!estObjet(f.nom) || !estTexte(f.nom.fr) || !estTexte(f.nom.en)) ko("nom", "{ fr, en } non vides");
  if (!estTexte(f.accroche)) ko("accroche", "une clé de catalogue");
  if (f.titre !== undefined && !estTexte(f.titre)) ko("titre", "une clé de catalogue, ou absent");

  const e = f.etiquette;
  if (!estObjet(e)) ko("etiquette", "objet attendu");
  else {
    for (const c of ["fond", "coque"] as const) if (typeof e[c] !== "string" || !COULEUR.test(e[c] as string)) ko(`etiquette.${c}`, "couleur #RRGGBB");
    if (!estTexte(e.police) || /[;{}<>]/.test(e.police as string)) ko("etiquette.police", "une liste de polices (sans ; { } < >)");
    if (e.dessin !== "propre" && e.dessin !== "generique") ko("etiquette.dessin", "`propre` ou `generique`");
  }

  if (f.etatDepart !== "off" && f.etatDepart !== "on") ko("etatDepart", "`off` ou `on`");
  if (typeof f.premierJour !== "string" || !JOUR.test(f.premierJour)) ko("premierJour", "AAAA-MM-JJ");

  const c = f.classement;
  if (!estObjet(c)) ko("classement", "objet attendu");
  else {
    if (!Array.isArray(c.colonnes) || c.colonnes.length === 0 || !c.colonnes.every((x) => estObjet(x) && typeof x.nom === "string" && NOM_COLONNE.test(x.nom) && (x.sens === "asc" || x.sens === "desc"))) ko("classement.colonnes", "au moins une colonne { nom, sens: asc | desc }");
    if (typeof c.cumul !== "boolean") ko("classement.cumul", "booléen");
    if (!["ms", "ticks", "mm", "points"].includes(c.unite as string)) ko("classement.unite", "ms, ticks, mm ou points");
    if (!["temps", "hauteur", "entier"].includes(c.format as string)) ko("classement.format", "temps, hauteur ou entier");
    if (c.cumul === true && c.unite !== "ms" && c.unite !== "ticks") ko("classement.cumul", "seul un jeu au temps entre dans le cumul");
  }

  const m = f.medailles;
  if (!estObjet(m)) ko("medailles", "objet attendu");
  else {
    if (!["facteurs-auteur", "figees-niveau", "pourcentage-diamant"].includes(m.methode as string)) ko("medailles.methode", "facteurs-auteur, figees-niveau ou pourcentage-diamant");
    if (!Array.isArray(m.bareme) || !m.bareme.every((x) => typeof x === "number" && Number.isFinite(x) && x > 0)) ko("medailles.bareme", "une liste de nombres > 0");
    if (m.plafondDiamant !== undefined && (!estEntier(m.plafondDiamant) || m.plafondDiamant <= 0)) ko("medailles.plafondDiamant", "entier > 0, ou absent");
  }

  if (!estObjet(f.partage) || !Array.isArray(f.partage.extras) || !f.partage.extras.every((x) => x === "morts" || x === "vies" || x === "rang")) ko("partage.extras", "une liste parmi morts, vies, rang");

  if (!Array.isArray(f.themes) || f.themes.length === 0 || !f.themes.every((x) => typeof x === "string" && /^[a-z][a-z0-9-]*$/.test(x)) || new Set(f.themes).size !== f.themes.length) ko("themes", "des codes uniques (a-z, chiffres, tirets), au moins un");

  const v = f.versions;
  if (!estObjet(v) || typeof v.sim !== "string" || !FICHIER_VERSION.test(v.sim) || typeof v.generateur !== "string" || !FICHIER_VERSION.test(v.generateur) || (v.medailles !== undefined && (typeof v.medailles !== "string" || !FICHIER_VERSION.test(v.medailles)))) ko("versions", "{ sim, generateur, medailles? } au format fichier.ts:CONSTANTE");

  const j = f.jours;
  if (!estObjet(j)) ko("jours", "objet attendu");
  else {
    if (j.mode !== "registre" && j.mode !== "fichier-par-jour") ko("jours.mode", "`registre` ou `fichier-par-jour`");
    if (j.dossier !== undefined && (typeof j.dossier !== "string" || !CHEMIN.test(j.dossier) || !globDuJeu(j.dossier, id))) ko("jours.dossier", `un dossier du jeu (${prefixesDeZones(id).slice(0, 2).join(" ou ")}…)`);
    if (j.mode === "fichier-par-jour" && typeof j.dossier !== "string") ko("jours.dossier", "obligatoire pour `fichier-par-jour`");
    if (typeof j.preuveInterditeEnProd !== "boolean") ko("jours.preuveInterditeEnProd", "booléen");
  }

  const r = f.rejeu;
  if (!estObjet(r) || !estEntier(r.unitesServeur) || r.unitesServeur < 1 || !estEntier(r.maxTicks) || r.maxTicks < 1 || (r.fil !== undefined && typeof r.fil !== "boolean")) ko("rejeu", "{ unitesServeur ≥ 1, maxTicks ≥ 1, fil? }");

  const d = f.donnees;
  if (!estObjet(d)) ko("donnees", "objet attendu");
  else {
    if (!Array.isArray(d.tables) || d.tables.length === 0 || !d.tables.every((x) => estObjet(x) && typeof x.nom === "string" && NOM_TABLE.test(x.nom) && (x.sort === "videe" || x.sort === "gardee"))) ko("donnees.tables", "des { nom, sort: videe | gardee }");
    else {
      for (const t of d.tables as { nom: string }[]) if (!t.nom.startsWith(`${id}_`)) ko("donnees.tables", `« ${t.nom} » doit commencer par « ${id}_ » (un jeu ne déclare que ses tables)`);
      if (new Set((d.tables as { nom: string }[]).map((t) => t.nom)).size !== d.tables.length) ko("donnees.tables", "noms uniques");
    }
    const s = d.stockage;
    if (!estObjet(s) || typeof s.prefixe !== "string" || s.prefixe !== `${id}:` || !listeDeTextes(s.reglagesGardes) || !s.reglagesGardes.every((k) => k.startsWith(`${id}:`))) ko("donnees.stockage", `{ prefixe: « ${id}: », reglagesGardes: des clés qui commencent par ce préfixe }`);
  }

  if (!estObjet(f.message) || f.message.ou !== id) ko("message.ou", `doit être « ${id} » (la destination du message en direct d'un jeu est son identifiant)`);
  if (f.zoneNouveautes !== id) ko("zoneNouveautes", `doit être « ${id} » (une zone par jeu du registre)`);

  if (!estObjet(f.musique) || !listeDeTextes(f.musique.scenes) || !f.musique.scenes.every((s) => SCENE.test(s))) ko("musique.scenes", "des scènes (`menu`, `theme:<code>`)");
  else if (Array.isArray(f.themes) && listeDeTextes(f.themes)) {
    const attendues = ["menu", ...f.themes.map((t) => `theme:${t}`)];
    if (JSON.stringify(f.musique.scenes) !== JSON.stringify(attendues)) ko("musique.scenes", `doit être menu puis un theme:<code> par thème (${attendues.join(", ")})`);
  }

  if (!estObjet(f.admin) || typeof f.admin.outils !== "boolean") ko("admin.outils", "booléen");

  const z = f.zones;
  if (!estObjet(z) || !listeDeTextes(z.jeu) || !listeDeTextes(z.serveur)) ko("zones", "{ jeu: [motifs], serveur: [motifs] }");
  else {
    for (const g of [...z.jeu, ...z.serveur]) if (!CHEMIN.test(g) || !globDuJeu(g, id)) ko("zones", `« ${g} » n'est pas dans les zones du jeu (${prefixesDeZones(id).join(", ")})`);
    for (const g of z.serveur) if (!z.jeu.includes(g)) ko("zones.serveur", `« ${g} » doit aussi être dans zones.jeu`);
  }

  const t = f.e2e;
  if (!estObjet(t)) ko("e2e", "objet attendu");
  else {
    if (typeof t.dossier !== "string" || !globDuJeu(t.dossier, id)) ko("e2e.dossier", "un dossier du jeu");
    if (typeof t.suite !== "string" || !ID.test(t.suite)) ko("e2e.suite", "le nom de la suite de la CI");
    const specs = estObjet(t.specs) ? t.specs : {};
    if (!estObjet(t.specs) || !Object.entries(specs).every(([k, zs]) => /^[a-z0-9-]+\.spec\.ts$/.test(k) && listeDeTextes(zs) && zs.length > 0)) ko("e2e.specs", "{ \"x.spec.ts\": [zones] } avec au moins une zone par spec");
    if (!listeDeTextes(t.fumee) || !t.fumee.every((s) => s in specs)) ko("e2e.fumee", "des specs déclarés dans e2e.specs");
    if (!estObjet(t.zones)) ko("e2e.zones", "objet attendu");
    else {
      for (const [nom, zc] of Object.entries(t.zones)) {
        if (!new RegExp(`^${id}-[a-z0-9-]+$|^api-${id}$`).test(nom)) ko("e2e.zones", `« ${nom} » doit s'appeler ${id}-… (ou api-${id}) : une fiche ne définit que ses zones`);
        if (!estObjet(zc) || !listeDeTextes(zc.globs) || zc.globs.length === 0 || (zc.sauf !== undefined && !listeDeTextes(zc.sauf))) ko(`e2e.zones.${nom}`, "{ globs: [motifs], sauf?: [motifs] }");
        else for (const g of [...zc.globs, ...(zc.sauf ?? [])]) if (!CHEMIN.test(g) || !globDuJeu(g, id)) ko(`e2e.zones.${nom}`, `« ${g} » n'est pas dans les zones du jeu`);
      }
    }
    if (estObjet(t.zones) && estObjet(t.specs)) {
      // Une zone de spec est une des siennes ou une zone partagée de `e2e/zones.json` (`ui`, `core-clock`…) : le contrôle de ces noms est celui de `apps/web/test/ciZones.test.ts`.
      const propres = Object.keys(t.zones);
      for (const [spec, zs] of Object.entries(specs)) if (!propres.some((n) => (zs as string[]).includes(n))) ko(`e2e.specs.${spec}`, "doit citer au moins une zone du jeu");
    }
    const parts = t.parts;
    if (!estObjet(parts) || !(["main", "complet", "nuit"] as const).every((k) => estEntier(parts[k]) && (parts[k] as number) >= 1)) ko("e2e.parts", "{ main, complet, nuit } : des entiers ≥ 1");
  }

  const b = f.budget;
  if (!estObjet(b) || !listeDeTextes(b.lignes) || b.lignes.length === 0 || !b.lignes.every((l) => LIGNE_BUDGET.test(l) && l.startsWith(`${id}.`))) ko("budget.lignes", `des lignes de budgets.md qui commencent par « ${id}. »`);

  return p;
}

/** Lit une fiche : la valide et la rend typée, ou lève une erreur qui liste tous les problèmes. */
export function lireFiche(brut: unknown, idDuFichier?: string): FicheJeu {
  const problemes = validerFiche(brut, idDuFichier);
  if (problemes.length > 0) throw new Error(`fiche${idDuFichier ? ` « ${idDuFichier} »` : ""} invalide :\n  - ${problemes.join("\n  - ")}`);
  return brut as FicheJeu;
}

/** Les problèmes de l'ensemble des fiches : identifiants, codes et ordres uniques, tables et zones qui ne se recouvrent pas. */
export function validerEnsemble(fiches: readonly FicheJeu[]): string[] {
  const p: string[] = [];
  for (const cle of ["id", "code", "ordre", "zoneNouveautes"] as const) {
    const vus = new Map<unknown, string>();
    for (const f of fiches) {
      const v = f[cle];
      if (vus.has(v)) p.push(`${cle} « ${String(v)} » : ${vus.get(v)} et ${f.id}`);
      else vus.set(v, f.id);
    }
  }
  const tables = new Map<string, string>();
  for (const f of fiches) for (const t of f.donnees.tables) {
    if (tables.has(t.nom)) p.push(`table « ${t.nom} » : ${tables.get(t.nom)} et ${f.id}`);
    else tables.set(t.nom, f.id);
  }
  return p;
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// Les jeux qui n'ont pas encore de fiche

/**
 * Track et Jump, **jusqu'à leurs lots de fiche (K1b, K1c)** : les listes dérivées des fiches doivent encore les contenir, dans leur forme d'aujourd'hui. Ce n'est PAS une fiche (leurs
 * consommateurs gardent leur code), seulement de quoi composer les listes sans changer un octet pour eux. Le jour où un jeu a sa fiche, sa ligne disparaît d'ici.
 */
export const JEUX_SANS_FICHE = [
  { id: "track", code: "cdj", ordre: 1, nom: "Track", etatDepart: "on" as const, prefixe: "cdj:", ou: "track", zone: "track" },
  { id: "jump", code: "jump", ordre: 2, nom: "Jump", etatDepart: "on" as const, prefixe: "jump:", ou: "jump", zone: "jump" },
] as const;

// ---------------------------------------------------------------------------------------------------------------------------------------
// Les projections : ce que chaque lecteur reçoit, et rien de plus.

const parOrdre = <T extends { ordre: number }>(l: readonly T[]): T[] => [...l].sort((a, b) => a.ordre - b.ordre);

/** Le portail (accueil, profil, classement du jour, partage) : **ce qu'il dessine, rien de plus** (il l'embarque : chaque octet pèse sur son budget). Le nom est `jeu.<id>.nom` du catalogue commun. */
export interface ProjectionPortail {
  jeux: {
    id: string;
    /** Le code au registre du serveur (`GET /api/portail/jour`). */
    code: string;
    accroche: string;
    titre: string | null;
    cumul: boolean;
    format: FormatScore;
  }[];
}
export function projectionPortail(fiches: readonly FicheJeu[]): ProjectionPortail {
  return { jeux: parOrdre(fiches).map((f) => ({ id: f.id, code: f.code, accroche: f.accroche, titre: f.titre ?? null, cumul: f.classement.cumul, format: f.classement.format })) };
}

/** Le serveur (registre, remise à zéro, mentions, jours figés) : lu par les tests de cohérence au lot K1, par le module du lot K2. */
export interface ProjectionServeur {
  jeux: {
    id: string;
    code: string;
    etatDepart: "off" | "on";
    premierJour: string;
    classement: FicheJeu["classement"];
    medailles: FicheJeu["medailles"];
    versions: FicheJeu["versions"];
    jours: FicheJeu["jours"];
    rejeu: FicheJeu["rejeu"];
    tables: FicheJeu["donnees"]["tables"];
    prefixe: string;
    reglagesGardes: string[];
    messageOu: string;
    zoneNouveautes: string;
  }[];
}
export function projectionServeur(fiches: readonly FicheJeu[]): ProjectionServeur {
  return {
    jeux: parOrdre(fiches).map((f) => ({
      id: f.id,
      code: f.code,
      etatDepart: f.etatDepart,
      premierJour: f.premierJour,
      classement: f.classement,
      medailles: f.medailles,
      versions: f.versions,
      jours: f.jours,
      rejeu: f.rejeu,
      tables: f.donnees.tables,
      prefixe: f.donnees.stockage.prefixe,
      reglagesGardes: f.donnees.stockage.reglagesGardes,
      messageOu: f.message.ou,
      zoneNouveautes: f.zoneNouveautes,
    })),
  };
}

/** La CI (zones d'une PR de jeu, étendue du diff, specs, parts, site, budgets). */
export interface ProjectionCI {
  jeux: {
    id: string;
    zones: FicheJeu["zones"];
    e2e: FicheJeu["e2e"];
    jours: { dossier: string | null; preuveInterditeEnProd: boolean };
    budget: string[];
    outilsAdmin: boolean;
  }[];
}
export function projectionCI(fiches: readonly FicheJeu[]): ProjectionCI {
  return {
    jeux: parOrdre(fiches).map((f) => ({ id: f.id, zones: f.zones, e2e: f.e2e, jours: { dossier: f.jours.dossier ?? null, preuveInterditeEnProd: f.jours.preuveInterditeEnProd }, budget: f.budget.lignes, outilsAdmin: f.admin.outils })),
  };
}

/**
 * Les jeux côté jeu et socle (`@cdj/core`, `@cdj/profile`, `@cdj/ui`, `@cdj/musique`) : le nom, l'étiquette, le stockage, le message, les scènes. Les listes qui doivent aussi contenir Track et
 * Jump (`publics`, `prefixes`, `ou`, `zones`, `jeuxMusique`) sont **complètes** : elles sont écrites telles qu'elles étaient dans le code, pour que les paquets n'embarquent pas un octet de plus.
 */
export interface ProjectionJeu {
  jeux: {
    id: string;
    code: string;
    ordre: number;
    nom: { fr: string; en: string };
    etiquette: FicheJeu["etiquette"];
    etatDepart: "off" | "on";
    format: FormatScore;
    unite: UniteScore;
    prefixe: string;
    messageOu: string;
    zoneNouveautes: string;
    themes: string[];
    scenes: string[];
  }[];
  /** Les jeux publics au départ (`on`), dans l'ordre : Track, Jump, puis les fiches `on`. */
  publics: string[];
  /** Les préfixes de stockage des données de jeu, dans l'ordre historique : `cdj:`, `jump:`, puis les fiches. */
  prefixes: string[];
  /** Les destinations du message en direct : le portail, Track, Jump, puis les fiches. */
  ou: string[];
  /** Les zones des nouveautés : `dujour`, Track, Jump, puis les fiches. */
  zones: string[];
  /** Les noms affichés des zones, par code. */
  nomsDeZones: Record<string, string>;
}
export function projectionJeu(fiches: readonly FicheJeu[]): ProjectionJeu {
  const l = parOrdre(fiches);
  return {
    jeux: l.map((f) => ({
      id: f.id,
      code: f.code,
      ordre: f.ordre,
      nom: f.nom,
      etiquette: f.etiquette,
      etatDepart: f.etatDepart,
      format: f.classement.format,
      unite: f.classement.unite,
      prefixe: f.donnees.stockage.prefixe,
      messageOu: f.message.ou,
      zoneNouveautes: f.zoneNouveautes,
      themes: f.themes,
      scenes: f.musique.scenes,
    })),
    publics: [...JEUX_SANS_FICHE.filter((j) => j.etatDepart === "on").map((j) => j.id), ...l.filter((f) => f.etatDepart === "on").map((f) => f.id)],
    prefixes: [...JEUX_SANS_FICHE.map((j) => j.prefixe), ...l.map((f) => f.donnees.stockage.prefixe)],
    ou: ["portail", ...JEUX_SANS_FICHE.map((j) => j.ou), ...l.map((f) => f.message.ou)],
    zones: ["dujour", ...JEUX_SANS_FICHE.map((j) => j.zone), ...l.map((f) => f.zoneNouveautes)],
    nomsDeZones: { dujour: "Du Jour", ...Object.fromEntries(JEUX_SANS_FICHE.map((j) => [j.zone, j.nom])), ...Object.fromEntries(l.map((f) => [f.zoneNouveautes, f.nom.fr])) },
  };
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// Le texte écrit sur le disque

/** Le JSON d'une projection, tel que `npm run fiches` l'écrit (et tel que le test de fraîcheur le relit). */
export const jsonDeProjection = (p: unknown): string => JSON.stringify(p, null, 2) + "\n";
