// Lot N2 (plateforme) : les règles pures des nouveautés et du message en direct, **écrites une fois** : le serveur les applique à chaque enregistrement, le
// panneau d'administration les applique avant d'envoyer (même message d'erreur des deux côtés) et lit la section « Pour les joueurs » d'une PR.
// Aucune dépendance : ni DOM, ni réseau, ni horloge (le temps est passé).

import { ZONES_NOUVEAUTES, estZone, type ZoneNouveaute } from "./zonesNouveautes";

/** Les zones (liste unique des codes : `zonesNouveautes.ts`). */
export { ZONES_NOUVEAUTES, estZone, type ZoneNouveaute };
/** Le nom écrit entre crochets dans la PR et affiché devant chaque ligne ; typé de façon exhaustive : une zone sans nom ne compile pas. */
export const NOM_DE_ZONE: Readonly<Record<ZoneNouveaute, string>> = { dujour: "Du Jour", track: "Track", jump: "Jump", tower: "Tower" };
/** La liste lisible des noms, pour les messages : « Du Jour, Track, Jump ou Tower ». (Une fonction : rien ne s'exécute au chargement du module.) */
export const nomsDeZoneTexte = (): string => `${ZONES_NOUVEAUTES.slice(0, -1).map((z) => NOM_DE_ZONE[z]).join(", ")} ou ${NOM_DE_ZONE[ZONES_NOUVEAUTES[ZONES_NOUVEAUTES.length - 1]!]}`;

/** Longueurs maximales (en caractères) : le titre de l'accueil, une ligne. */
export const TITRE_MAX = 80;
export const LIGNE_MAX = 200;
/** Lignes au plus dans une nouveauté. */
export const LIGNES_MAX = 30;

/** Le message en direct : 160 caractères au plus, texte seul. */
export const MESSAGE_MAX = 160;
export const OU_MESSAGE = ["portail", "track", "jump", "tower"] as const;
export type OuMessage = (typeof OU_MESSAGE)[number];
export const TONS_MESSAGE = ["information", "important"] as const;
export type TonMessage = (typeof TONS_MESSAGE)[number];
/** Un message dure 7 jours au plus (« heure précise » comprise) : un message oublié ne reste pas indéfiniment. */
export const MESSAGE_DUREE_MAX_MS = 7 * 86_400_000;

export interface LigneNouveaute {
  /** `null` : zone illisible (ligne mal formée, montrée telle quelle à retoucher) ; refusée à la publication. */
  zone: ZoneNouveaute | null;
  fr: string;
  en: string;
}

export interface NouveauteContenu {
  titre: { fr: string; en: string };
  /** AAAA-MM-JJ. */
  date: string;
  lignes: LigneNouveaute[];
}

/** Un texte sur une seule ligne, espaces réduits, sans caractères de contrôle (un texte venu de GitHub ou du panneau n'est jamais du HTML : il se pose en `textContent`). */
export function nettoyerTexte(brut: unknown): string {
  // eslint-disable-next-line no-control-regex
  return typeof brut === "string" ? brut.replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028\u2029\ufeff]/g, " ").replace(/\s+/g, " ").trim() : "";
}

/** La longueur en caractères visibles (un émoji compte pour un), pas en unités UTF-16. */
export const longueur = (s: string): number => [...s].length;

// --- Lire la section « Pour les joueurs » d'une PR ------------------------------------------------------------------------------------

export interface LigneLue {
  zone: ZoneNouveaute | null;
  fr: string;
  en: string;
  /** La ligne d'origine, telle qu'écrite dans la PR. */
  brut: string;
  /** Vrai si la forme `- [Zone] français // anglais` n'est pas respectée (zone inconnue, rien après la zone). Un anglais manquant n'est pas « mal formé » : il bloque la publication. */
  malformee: boolean;
}

export interface SectionLue {
  /** La section « ## Pour les joueurs » existe-t-elle ? */
  presente: boolean;
  /** `rien` : rien ne se voit. */
  rien: boolean;
  lignes: LigneLue[];
}

const sansAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** `Du Jour`, `du jour`, `Portail` → `dujour` ; `Track`, `DailyTrack` ; `Jump`, `DailyJump` ; `Tower` (le nom de chaque zone, sans casse ni espaces) ; sinon `null`. */
export function zoneDeNom(nom: string): ZoneNouveaute | null {
  const n = sansAccents(nom).replace(/\s+/g, "");
  if (n === "portail") return "dujour";
  for (const z of ZONES_NOUVEAUTES) if (n === sansAccents(NOM_DE_ZONE[z]).replace(/\s+/g, "") || n === `daily${z}`) return z;
  return null;
}

/** Sépare « français // anglais » au premier ` // ` (entouré d'espaces : une adresse `https://…` n'est pas coupée). */
export function separerLangues(texte: string): { fr: string; en: string } {
  const m = /\s\/\/\s/.exec(` ${texte} `);
  if (!m) return { fr: nettoyerTexte(texte), en: "" };
  const i = m.index - 1; // décalage de l'espace ajouté en tête
  return { fr: nettoyerTexte(texte.slice(0, Math.max(0, i))), en: nettoyerTexte(texte.slice(i + m[0].length)) };
}

/**
 * Lit la section « ## Pour les joueurs » du corps d'une PR (texte de GitHub : jamais interprété comme du HTML). Chaque ligne `- [Zone] français // anglais` donne une
 * ligne ; `rien` seul dit que rien ne se voit ; une ligne qui ne respecte pas la forme est gardée **telle quelle** (`malformee`), à retoucher. Les commentaires HTML du
 * modèle de PR (`<!-- … -->`) sont ignorés. Une PR sans la section n'est ni « rien » ni lue : `presente` est faux.
 */
export function lirePourLesJoueurs(corps: string | null | undefined): SectionLue {
  const texte = (corps ?? "").replace(/\r\n?/g, "\n").replace(/<!--[\s\S]*?-->/g, "");
  const lignes = texte.split("\n");
  const debut = lignes.findIndex((l) => /^\s{0,3}#{2,3}\s+pour les joueurs\s*:?\s*$/.test(sansAccents(l)));
  if (debut < 0) return { presente: false, rien: false, lignes: [] };
  const corpsSection: string[] = [];
  for (const l of lignes.slice(debut + 1)) {
    if (/^\s{0,3}#{1,3}\s/.test(l)) break;
    corpsSection.push(l);
  }
  const utiles = corpsSection.map((l) => l.trim()).filter((l) => l !== "");
  if (utiles.length === 0) return { presente: true, rien: false, lignes: [] };
  const estRien = (l: string) => /^(?:[-*]\s*)?`?rien`?\s*\.?$/i.test(sansAccents(l));
  if (utiles.length === 1 && estRien(utiles[0]!)) return { presente: true, rien: true, lignes: [] };
  const lues: LigneLue[] = [];
  for (const brut of utiles) {
    if (estRien(brut)) continue;
    const puce = /^[-*+]\s+(.*)$/.exec(brut);
    if (!puce) {
      lues.push({ zone: null, fr: nettoyerTexte(brut), en: "", brut, malformee: true });
      continue;
    }
    const m = /^\[([^\]]{1,20})\]\s*(.*)$/.exec(puce[1]!);
    const zone = m ? zoneDeNom(m[1]!) : null;
    if (!m || zone === null || m[2]!.trim() === "") {
      lues.push({ zone: null, fr: nettoyerTexte(puce[1]), en: "", brut, malformee: true });
      continue;
    }
    const { fr, en } = separerLangues(m[2]!);
    lues.push({ zone, fr, en, brut, malformee: fr === "" });
  }
  return { presente: true, rien: false, lignes: lues };
}

// --- Valider une nouveauté ---------------------------------------------------------------------------------------------------------------

export type ProblemeNouveaute =
  | { code: "titre_fr" }
  | { code: "titre_en" }
  | { code: "titre_long" }
  | { code: "date" }
  | { code: "sans_ligne" }
  | { code: "trop_de_lignes" }
  | { code: "zone"; n: number }
  | { code: "francais"; n: number }
  | { code: "anglais"; n: number }
  | { code: "ligne_longue"; n: number };

/** Le texte que le panneau montre pour un problème (le serveur ne rend que le code : lot I6). « Anglais : n lignes pas encore traduites » bloque la publication. */
export function texteProbleme(p: ProblemeNouveaute): string {
  switch (p.code) {
    case "titre_fr": return "Titre français manquant.";
    case "titre_en": return "Titre anglais manquant.";
    case "titre_long": return `Titre : ${TITRE_MAX} caractères au plus.`;
    case "date": return "Date affichée illisible (AAAA-MM-JJ).";
    case "sans_ligne": return "Au moins une ligne est attendue.";
    case "trop_de_lignes": return `${LIGNES_MAX} lignes au plus.`;
    case "zone": return `Zone : ${p.n} ligne${p.n > 1 ? "s" : ""} sans zone (${nomsDeZoneTexte()}).`;
    case "francais": return `Français : ${p.n} ligne${p.n > 1 ? "s" : ""} vide${p.n > 1 ? "s" : ""}.`;
    case "anglais": return `Anglais : ${p.n} ligne${p.n > 1 ? "s" : ""} pas encore traduite${p.n > 1 ? "s" : ""}`;
    case "ligne_longue": return `${p.n} ligne${p.n > 1 ? "s" : ""} de plus de ${LIGNE_MAX} caractères.`;
  }
}

const JOUR = /^(\d{4})-(\d{2})-(\d{2})$/;
/** Une date AAAA-MM-JJ qui existe au calendrier (calcul des jours du mois : `core` n'utilise aucune API de date, test de pureté). */
export function dateValide(s: unknown): s is string {
  if (typeof s !== "string") return false;
  const m = JOUR.exec(s);
  if (!m) return false;
  const annee = Number(m[1]);
  const mois = Number(m[2]);
  const jour = Number(m[3]);
  if (mois < 1 || mois > 12 || jour < 1) return false;
  const bissextile = (annee % 4 === 0 && annee % 100 !== 0) || annee % 400 === 0;
  const jours = [31, bissextile ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mois - 1]!;
  return jour <= jours;
}

/**
 * Ce qui empêche de **publier** une nouveauté (un brouillon n'a pas à être complet). Liste vide = publiable. Le texte est nettoyé avant d'être compté : ce que le serveur
 * garde est `nettoyerNouveaute`.
 */
export function problemesDePublication(n: NouveauteContenu): ProblemeNouveaute[] {
  const p: ProblemeNouveaute[] = [];
  if (n.titre.fr === "") p.push({ code: "titre_fr" });
  if (n.titre.en === "") p.push({ code: "titre_en" });
  if (longueur(n.titre.fr) > TITRE_MAX || longueur(n.titre.en) > TITRE_MAX) p.push({ code: "titre_long" });
  if (!dateValide(n.date)) p.push({ code: "date" });
  if (n.lignes.length === 0) p.push({ code: "sans_ligne" });
  if (n.lignes.length > LIGNES_MAX) p.push({ code: "trop_de_lignes" });
  const sansZone = n.lignes.filter((l) => l.zone === null).length;
  if (sansZone) p.push({ code: "zone", n: sansZone });
  const sansFrancais = n.lignes.filter((l) => l.fr === "").length;
  if (sansFrancais) p.push({ code: "francais", n: sansFrancais });
  const sansAnglais = n.lignes.filter((l) => l.fr !== "" && l.en === "").length;
  if (sansAnglais) p.push({ code: "anglais", n: sansAnglais });
  const longues = n.lignes.filter((l) => longueur(l.fr) > LIGNE_MAX || longueur(l.en) > LIGNE_MAX).length;
  if (longues) p.push({ code: "ligne_longue", n: longues });
  return p;
}

/** Ce que le serveur garde : textes nettoyés (une ligne, sans contrôle), zones valides, rien d'autre. Jamais de HTML interprété : un texte reste un texte. */
export function nettoyerNouveaute(brut: unknown): NouveauteContenu {
  const o = (brut && typeof brut === "object" ? brut : {}) as Record<string, unknown>;
  const titre = (o.titre && typeof o.titre === "object" ? o.titre : {}) as Record<string, unknown>;
  const lignes = Array.isArray(o.lignes) ? o.lignes : [];
  return {
    titre: { fr: nettoyerTexte(titre.fr), en: nettoyerTexte(titre.en) },
    date: typeof o.date === "string" ? o.date.trim() : "",
    lignes: lignes.slice(0, LIGNES_MAX + 1).map((l): LigneNouveaute => {
      const x = (l && typeof l === "object" ? l : {}) as Record<string, unknown>;
      return { zone: estZone(x.zone) ? x.zone : null, fr: nettoyerTexte(x.fr), en: nettoyerTexte(x.en) };
    }),
  };
}

// --- Exporter et importer un changelog -------------------------------------------------------------------------------------------------------
// Préparer les nouveautés à l'avance (sur la recette, ou chez soi) puis les reprendre en production : un fichier JSON versionné qui porte une ou plusieurs nouveautés. **Un import ne publie jamais** :
// chaque nouveauté arrive en brouillon, à relire, puis à publier à la main. Tout ce qui vient du fichier est une donnée : lue prudemment (taille, forme, version), nettoyée comme une saisie
// (`nettoyerNouveaute`), jamais interprétée. Pur : l'heure de l'export et « aujourd'hui » viennent de l'appelant.

export const FORMAT_EXPORT = "cdj-nouveautes";
export const VERSION_EXPORT = 1;
/** Un fichier plus gros n'est pas un changelog : refusé sans être lu. */
export const EXPORT_OCTETS_MAX = 200_000;
export const EXPORT_NOUVEAUTES_MAX = 100;

export interface LigneExportee extends LigneNouveaute {
  /** Le numéro de la PR d'où vient la ligne. */
  pr?: number;
}
export interface NouveauteExportee extends NouveauteContenu {
  lignes: LigneExportee[];
  statut: "brouillon" | "publiee";
}

/** Le fichier d'export : lisible (indenté), versionné, trié comme on le lui donne. `exporteLe` : l'instant de l'export (ISO), pour s'y retrouver. */
export function exporterNouveautes(nouveautes: readonly { titre: { fr: string; en: string }; date: string; lignes: readonly { zone: ZoneNouveaute | null; fr: string; en: string; pr?: number }[]; statut?: "brouillon" | "publiee" }[], exporteLe: string): string {
  return JSON.stringify(
    {
      format: FORMAT_EXPORT,
      version: VERSION_EXPORT,
      exporteLe,
      nouveautes: nouveautes.map((n) => ({
        titre: { fr: n.titre.fr, en: n.titre.en },
        date: n.date,
        statut: n.statut ?? "brouillon",
        lignes: n.lignes.map((l) => ({ zone: l.zone, fr: l.fr, en: l.en, ...(Number.isInteger(l.pr) && (l.pr as number) > 0 ? { pr: l.pr } : {}) })),
      })),
    },
    null,
    2,
  );
}

export type ProblemeImport = "trop_gros" | "illisible" | "format" | "version" | "vide" | "trop_nombreuses";
export function texteProblemeImport(p: ProblemeImport): string {
  switch (p) {
    case "trop_gros":
      return "Ce fichier est trop gros pour être un changelog.";
    case "illisible":
      return "Ce fichier n'est pas du JSON lisible.";
    case "format":
      return "Ce n'est pas un export de nouveautés de Du Jour.";
    case "version":
      return "Cet export vient d'une version plus récente du panneau : mets le panneau à jour.";
    case "vide":
      return "Aucune nouveauté dans ce fichier.";
    case "trop_nombreuses":
      return `Plus de ${EXPORT_NOUVEAUTES_MAX} nouveautés dans ce fichier : il n'est pas lu.`;
  }
}

export type LectureExport = { ok: true; nouveautes: NouveauteExportee[]; ignorees: number } | { ok: false; probleme: ProblemeImport };

/**
 * Lit un export. `aujourdhui` remplace une date absente ou invalide. Une entrée qui n'est pas un objet est ignorée (comptée) ; les textes sont nettoyés comme une saisie ; le statut du fichier est
 * gardé à titre d'information (l'import les met tous en brouillon).
 */
export function lireExport(texte: string, aujourdhui: string): LectureExport {
  if (typeof texte !== "string" || texte.length > EXPORT_OCTETS_MAX) return { ok: false, probleme: "trop_gros" };
  let brut: unknown;
  try {
    brut = JSON.parse(texte);
  } catch {
    return { ok: false, probleme: "illisible" };
  }
  const o = (brut && typeof brut === "object" && !Array.isArray(brut) ? brut : null) as Record<string, unknown> | null;
  if (!o || o.format !== FORMAT_EXPORT) return { ok: false, probleme: "format" };
  if (typeof o.version !== "number" || !Number.isInteger(o.version) || o.version < 1) return { ok: false, probleme: "format" };
  if (o.version > VERSION_EXPORT) return { ok: false, probleme: "version" };
  const liste = Array.isArray(o.nouveautes) ? o.nouveautes : [];
  if (liste.length > EXPORT_NOUVEAUTES_MAX) return { ok: false, probleme: "trop_nombreuses" };
  const nouveautes: NouveauteExportee[] = [];
  let ignorees = 0;
  for (const entree of liste) {
    if (!entree || typeof entree !== "object" || Array.isArray(entree)) {
      ignorees++;
      continue;
    }
    const e = entree as Record<string, unknown>;
    const propre = nettoyerNouveaute(e);
    const lignesBrutes = Array.isArray(e.lignes) ? e.lignes : [];
    const lignes = propre.lignes.map((l, i): LigneExportee => {
      const pr = (lignesBrutes[i] as { pr?: unknown } | undefined)?.pr;
      return Number.isInteger(pr) && (pr as number) > 0 && (pr as number) < 1_000_000 ? { ...l, pr: pr as number } : l;
    });
    nouveautes.push({ titre: propre.titre, date: dateValide(propre.date) ? propre.date : aujourdhui, lignes, statut: e.statut === "publiee" ? "publiee" : "brouillon" });
  }
  if (nouveautes.length === 0) return { ok: false, probleme: "vide" };
  return { ok: true, nouveautes, ignorees };
}

/** La clé d'une nouveauté pour reconnaître « déjà là » à la réimportation : la date affichée et le titre français, sans casse ni espaces en trop. */
export const cleDeNouveaute = (n: { titre: { fr: string }; date: string }): string => `${n.date}|${n.titre.fr.trim().toLowerCase().replace(/\s+/g, " ")}`;

// --- Le message en direct --------------------------------------------------------------------------------------------------------------

export interface MessageContenu {
  fr: string;
  en: string;
  ou: OuMessage[];
  ton: TonMessage;
  /** Fin, en ms depuis 1970 (UTC). */
  fin: number;
}

export type ProblemeMessage =
  | { code: "fr" }
  | { code: "en" }
  | { code: "long"; langue: "fr" | "en" }
  | { code: "lien"; langue: "fr" | "en" }
  | { code: "ou" }
  | { code: "ton" }
  | { code: "fin_passee" }
  | { code: "fin_lointaine" };

export function texteProblemeMessage(p: ProblemeMessage): string {
  switch (p.code) {
    case "fr": return "Texte français manquant.";
    case "en": return "Texte anglais manquant.";
    case "long": return `Texte ${p.langue === "fr" ? "français" : "anglais"} : ${MESSAGE_MAX} caractères au plus.`;
    case "lien": return `Texte ${p.langue === "fr" ? "français" : "anglais"} : texte seul, ni lien ni HTML.`;
    case "ou": return "Choisis au moins un endroit : Portail, Track, Jump ou Tower.";
    case "ton": return "Ton : Information ou Important.";
    case "fin_passee": return "L'heure de fin est déjà passée.";
    case "fin_lointaine": return "Un message dure 7 jours au plus.";
  }
}

/** Un lien ou du HTML : `<`, `>`, `://`, `www.`, `mailto:`, un nom de domaine courant. Un message est du texte seul. */
export function contientLienOuHtml(s: string): boolean {
  return /[<>]|:\/\/|\bwww\.|\bmailto:|\b[a-z0-9-]{2,}\.(?:com|fr|org|net|io|app|dev|co|eu|me|info|gg|ly|tv)\b/i.test(s);
}

export function problemesDeMessage(m: MessageContenu, maintenant: number): ProblemeMessage[] {
  const p: ProblemeMessage[] = [];
  if (m.fr === "") p.push({ code: "fr" });
  if (m.en === "") p.push({ code: "en" });
  if (longueur(m.fr) > MESSAGE_MAX) p.push({ code: "long", langue: "fr" });
  if (longueur(m.en) > MESSAGE_MAX) p.push({ code: "long", langue: "en" });
  if (contientLienOuHtml(m.fr)) p.push({ code: "lien", langue: "fr" });
  if (contientLienOuHtml(m.en)) p.push({ code: "lien", langue: "en" });
  if (m.ou.length === 0) p.push({ code: "ou" });
  if (!(TONS_MESSAGE as readonly string[]).includes(m.ton)) p.push({ code: "ton" });
  if (!Number.isFinite(m.fin) || m.fin <= maintenant) p.push({ code: "fin_passee" });
  else if (m.fin - maintenant > MESSAGE_DUREE_MAX_MS) p.push({ code: "fin_lointaine" });
  return p;
}

export function nettoyerMessage(brut: unknown): MessageContenu {
  const o = (brut && typeof brut === "object" ? brut : {}) as Record<string, unknown>;
  const ou = Array.isArray(o.ou) ? OU_MESSAGE.filter((x) => (o.ou as unknown[]).includes(x)) : [];
  return {
    fr: nettoyerTexte(o.fr),
    en: nettoyerTexte(o.en),
    ou,
    ton: o.ton === "important" ? "important" : o.ton === "information" ? "information" : ("" as TonMessage),
    fin: typeof o.fin === "number" ? o.fin : Number.NaN,
  };
}

/** Le message actif à cet instant (`fin` pas atteinte), ou `null`. Le client s'en sert aussi : un message qui a passé son heure de fin s'éteint tout seul, même si le cache n'a pas encore changé. */
export function messageActif<T extends { fin: number }>(m: T | null | undefined, maintenant: number): T | null {
  return m && m.fin > maintenant ? m : null;
}
