import type { OuMessage, TonMessage, ZoneNouveaute } from "@cdj/core/nouveautes";
import { instantDeParis } from "./adminGithub";

// Lot N1 : ce que le panneau d'administration lit et écrit (`/api/admin/*`, `apps/api/CLAUDE.md`, « Administration (lot N1) ») et les calculs purs de son
// affichage (barres, formats). Aucune page ici : testé dans `test/admin.test.ts`. Outil interne de l'éditeur, en français seulement.

export type Medaille = "author" | "gold" | "silver" | "bronze";

export interface Configuration {
  actif: boolean;
  clientId: string | null;
  factice: boolean;
}

export interface Chiffres {
  joueursAujourdhui: number;
  joueursHier: number;
  nouveauxProfils: number;
  track: { finis: number };
  jump: { finis: number; morts: number };
}

export interface JourDeLaCourbe {
  date: string;
  joueurs: number;
}

export interface EntreeJournal {
  id: number;
  at: string;
  admin: string;
  action: string;
  cible: string;
  avant: Record<string, unknown> | null;
  apres: Record<string, unknown> | null;
}

export interface Tableau {
  calculeA: string;
  date: string;
  chiffres: Chiffres;
  courbe: JourDeLaCourbe[];
  etat: {
    environnement: string;
    api: { ok: boolean; ms: number };
    base: { ok: boolean; ms: number };
    version: { etiquette: string | null; commit: string | null; revision: string | null };
    joursPrets: { jeu: string; nom: string; figes: number; planifies?: number }[];
    erreurs24h: { serveur: number; rediffusions: number };
    prDepuisMiseEnProduction: number | null;
  };
  journal: EntreeJournal[];
}

export interface JoueurListe {
  ref: string;
  pseudo: string;
  masque: boolean;
  creeLe: string;
}

export interface Recherche {
  page: number;
  parPage: number;
  suivante: boolean;
  joueurs: JoueurListe[];
}

export interface ResultatFiche {
  date: string;
  tempsMs: number;
  morts: number | null;
  medaille: Medaille | null;
  rang: number;
  classes: number;
  envoyeA: string;
  rediffusion: string | null;
}

export interface Fiche {
  ref: string;
  pseudo: string;
  masque: boolean;
  creeLe: string;
  dernierePartie: string | null;
  joursJoues: number;
  resultats: { jeu: string; nom: string; jours: number; resultats: ResultatFiche[] }[];
  retires: { jeu: string; date: string; tempsMs: number; motif: string; retireLe: string; rediffusionGardee: boolean }[];
  gardeJours: number;
}

// --- Lot N2 : nouveautés et message en direct ---------------------------------------------------------------------------------------------------
export interface LigneAdmin {
  zone: ZoneNouveaute | null;
  fr: string;
  en: string;
  /** Le numéro de la PR d'où vient la ligne (pour ne pas la proposer deux fois). */
  pr?: number;
}

export interface NouveauteAdmin {
  id: number;
  titre: { fr: string; en: string };
  date: string;
  lignes: LigneAdmin[];
  statut: "brouillon" | "publiee";
  creeLe: string;
  modifieLe: string;
  publieLe: string | null;
}

export interface AnnonceAdmin {
  id: number;
  fr: string;
  en: string;
  ou: OuMessage[];
  ton: TonMessage;
  /** Fin, en ms depuis 1970. */
  fin: number;
}

export interface MessagesAdmin {
  actif: AnnonceAdmin | null;
  maintenant: number;
  max: number;
  passes: (AnnonceAdmin & { debut: number; retireLe: number | null })[];
}

export interface CorpsNouveaute {
  id?: number;
  titre: { fr: string; en: string };
  date: string;
  lignes: LigneAdmin[];
  publier: boolean;
}

export interface CorpsMessage {
  fr: string;
  en: string;
  ou: OuMessage[];
  ton: TonMessage;
  fin: number;
}

/** Une erreur du serveur : son statut et son code (un code de `apps/api/src/codesErreur.ts`, jamais un message). */
export class ErreurAdmin extends Error {
  constructor(
    readonly statut: number,
    readonly code: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(code);
  }
}

/** Le client du panneau : même origine, cookie `__session` envoyé par le navigateur, l'en-tête `X-Cdj-Admin: 1` sur tout ce qui n'est pas une lecture. */
export function clientAdmin(base: string, fetchImpl: typeof fetch = (...a) => fetch(...a)) {
  async function appeler<T>(methode: string, chemin: string, corps?: unknown): Promise<T> {
    const lecture = methode === "GET";
    let res: Response;
    try {
      res = await fetchImpl(`${base}${chemin}`, {
        method: methode,
        credentials: "same-origin",
        cache: "no-store",
        headers: { ...(lecture ? {} : { "X-Cdj-Admin": "1" }), ...(corps !== undefined ? { "Content-Type": "application/json" } : {}) },
        ...(corps !== undefined ? { body: JSON.stringify(corps) } : {}),
      });
    } catch {
      throw new ErreurAdmin(0, "reseau");
    }
    const json = (await res.json().catch(() => null)) as (Record<string, unknown> & { error?: unknown }) | null;
    if (!res.ok) {
      const { error, ...details } = json ?? {};
      throw new ErreurAdmin(res.status, typeof error === "string" ? error : "inconnu", details);
    }
    return json as T;
  }
  const q = (o: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== "") p.set(k, String(v));
    const s = p.toString();
    return s ? `?${s}` : "";
  };
  const joueur = (ref: string) => `/api/admin/joueurs/${encodeURIComponent(ref)}`;
  return {
    configuration: () => appeler<Configuration>("GET", "/api/admin/config"),
    session: () => appeler<{ admin: string; expire: string }>("GET", "/api/admin/session"),
    connecter: (credential: string) => appeler<{ admin: string; expire: string }>("POST", "/api/admin/session", { credential }),
    deconnecter: () => appeler<{ deconnecte: true }>("DELETE", "/api/admin/session"),
    tableau: () => appeler<Tableau>("GET", "/api/admin/tableau"),
    joueurs: (o: { q?: string; filtre?: "tous" | "masques"; page?: number }) => appeler<Recherche>("GET", `/api/admin/joueurs${q({ q: o.q, filtre: o.filtre, page: o.page })}`),
    fiche: (ref: string) => appeler<Fiche>("GET", joueur(ref)),
    renommer: (ref: string, pseudo: string) => appeler<{ pseudo: string }>("POST", `${joueur(ref)}/renommer`, { pseudo, confirmer: true }),
    masquer: (ref: string, masque: boolean) => appeler<{ masque: boolean }>("POST", `${joueur(ref)}/masquer`, { masque, confirmer: true }),
    retirer: (ref: string, jeu: string, date: string, motif: string) => appeler<{ retire: true }>("POST", `${joueur(ref)}/retirer`, { jeu, date, motif, confirmer: true }),
    supprimer: (ref: string, pseudo: string) => appeler<{ supprime: true }>("POST", `${joueur(ref)}/supprimer`, { pseudo, confirmer: true }),
    journal: () => appeler<{ lignes: EntreeJournal[]; max: number }>("GET", "/api/admin/journal"),
    // Lot N2
    nouveautes: () => appeler<{ nouveautes: NouveauteAdmin[]; max: number }>("GET", "/api/admin/nouveautes"),
    enregistrerNouveaute: (c: CorpsNouveaute) => appeler<{ nouveaute: NouveauteAdmin }>("POST", "/api/admin/nouveautes", { ...c, confirmer: true }),
    depublierNouveaute: (id: number) => appeler<{ nouveaute: NouveauteAdmin }>("POST", `/api/admin/nouveautes/${id}/depublier`, { confirmer: true }),
    supprimerNouveaute: (id: number) => appeler<{ supprimee: true }>("POST", `/api/admin/nouveautes/${id}/supprimer`, { confirmer: true }),
    message: () => appeler<MessagesAdmin>("GET", "/api/admin/message"),
    mettreAJourMessage: (c: CorpsMessage) => appeler<{ actif: AnnonceAdmin | null }>("POST", "/api/admin/message", { ...c, confirmer: true }),
    retirerMessage: () => appeler<{ actif: null }>("POST", "/api/admin/message/retirer", { confirmer: true }),
  };
}
export type ClientAdmin = ReturnType<typeof clientAdmin>;

// --- Affichage : calculs purs ---------------------------------------------------------------------------------------------------

/** Les textes des erreurs du serveur que le panneau sait dire (français seulement : outil de l'éditeur) ; un autre code est montré tel quel. */
export const TEXTES_ERREUR: Record<string, string> = {
  unauthorized: "Session absente ou expirée.",
  forbidden: "Action refusée par le serveur (en-têtes de protection).",
  invalid_action: "L'action est refusée : confirmation, motif ou pseudo incorrect.",
  unknown_result: "Ce joueur n'a pas de résultat ce jour-là dans ce jeu.",
  unknown_player: "Joueur introuvable.",
  name_taken: "Ce pseudo est déjà pris.",
  name_forbidden: "Ce pseudo n'est pas permis (mot interdit ou nom réservé).",
  invalid_name: "Ce pseudo n'est pas valide (1 à 20 caractères : lettres, chiffres, espace . _ ' -).",
  rate_limited: "Trop de requêtes : réessaie dans un moment.",
  reseau: "Le serveur ne répond pas.",
  not_found: "Fonction non disponible sur ce serveur.",
  invalid_news: "La nouveauté est incomplète : elle n'est pas publiée.",
  unknown_news: "Nouveauté introuvable (déjà supprimée ?).",
  invalid_message: "Le message est refusé : texte, endroit, ton ou heure de fin incorrects.",
};
export const texteErreur = (e: unknown): string => (e instanceof ErreurAdmin ? (TEXTES_ERREUR[e.code] ?? `Erreur : ${e.code}.`) : "Erreur inattendue.");

export interface Barre {
  date: string;
  joueurs: number;
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
  aujourdhui: boolean;
}

/**
 * Les barres pleines de la courbe « joueurs par jour » dans un cadre `largeur × hauteur` (unités du dessin), l'échelle commençant à 0 : une barre à 0 a une
 * hauteur nulle (le trait de base la montre). `ecart` : le blanc entre deux barres. Pas de dégradé, pas de courbe : des aplats (charte § 11).
 */
export function barres(courbe: readonly JourDeLaCourbe[], largeur: number, hauteur: number, ecart = 4): { barres: Barre[]; max: number } {
  const max = Math.max(1, ...courbe.map((j) => j.joueurs));
  const n = Math.max(1, courbe.length);
  const l = (largeur - ecart * (n - 1)) / n;
  return {
    max,
    barres: courbe.map((j, i) => {
      const h = Math.round((j.joueurs / max) * hauteur * 100) / 100;
      return { date: j.date, joueurs: j.joueurs, x: Math.round(i * (l + ecart) * 100) / 100, y: Math.round((hauteur - h) * 100) / 100, largeur: Math.round(l * 100) / 100, hauteur: h, aujourdhui: i === n - 1 };
    }),
  };
}

/** Ce que dit une barre : « 28/10 · 84 joueurs » (« aujourd'hui » pour la dernière). */
export const texteDeBarre = (b: Pick<Barre, "date" | "joueurs" | "aujourdhui">): string =>
  `${jourCourt(b.date)}${b.aujourdhui ? " (aujourd'hui)" : ""} · ${b.joueurs} joueur${b.joueurs > 1 ? "s" : ""}`;

export interface Infobulle {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
  texte: string;
}

/**
 * L'infobulle d'une barre, dans les unités du dessin : au-dessus de la barre (sous elle si la barre touche le haut), centrée sur elle et **toujours dans le cadre**
 * `largeurCadre` (elle ne dépasse ni à gauche ni à droite). `pasCaractere` : la largeur d'un caractère de la police des chiffres (≈ 7,2 pour 12 px).
 */
export function infobulle(b: Barre, texte: string, largeurCadre: number, hauteurCadre: number, pasCaractere = 7.2): Infobulle {
  const hauteur = 22;
  const largeur = Math.min(largeurCadre, Math.round((texte.length * pasCaractere + 16) * 100) / 100);
  const centre = b.x + b.largeur / 2;
  const x = Math.round(Math.min(Math.max(0, centre - largeur / 2), largeurCadre - largeur) * 100) / 100;
  const dessus = b.y - hauteur - 4;
  const y = dessus >= 0 ? dessus : Math.min(b.y + 4, hauteurCadre - hauteur);
  return { x, y: Math.round(y * 100) / 100, largeur, hauteur, texte };
}

const PARIS = "Europe/Paris";
const formatHeure = new Intl.DateTimeFormat("fr-FR", { timeZone: PARIS, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const formatJour = new Intl.DateTimeFormat("fr-FR", { timeZone: PARIS, day: "numeric", month: "long", year: "numeric" });
const formatJourCourt = new Intl.DateTimeFormat("fr-FR", { timeZone: PARIS, day: "2-digit", month: "2-digit" });

/** `20/10, 14:05` (heure de Paris). */
export const heure = (iso: string): string => formatHeure.format(new Date(iso)).replace(" ", ", ");
/** `20 octobre 2026` (heure de Paris). */
export const jourLong = (iso: string): string => formatJour.format(new Date(iso));
/** `20/10` pour un `AAAA-MM-JJ`. */
export const jourCourt = (date: string): string => formatJourCourt.format(new Date(`${date}T12:00:00Z`));

/** `1:02,345` ou `32,805` : un temps en millisecondes, comme les jeux l'écrivent. */
export function temps(ms: number): string {
  const total = Math.max(0, Math.round(ms));
  const minutes = Math.floor(total / 60_000);
  const reste = total % 60_000;
  const s = `${Math.floor(reste / 1000)}`.padStart(minutes > 0 ? 2 : 1, "0");
  return `${minutes > 0 ? `${minutes}:` : ""}${s},${String(reste % 1000).padStart(3, "0")}`;
}

/** `1er`, `2e`, `14e` : le rang. */
export const rang = (n: number): string => (n === 1 ? "1er" : `${n}e`);

const NOMS_MEDAILLE: Record<Medaille, string> = { author: "Diamant", gold: "Or", silver: "Argent", bronze: "Bronze" };
export const nomMedaille = (m: Medaille): string => NOMS_MEDAILLE[m];

const LIBELLES_CHAMP: Record<string, string> = { pseudo: "pseudo", masque: "masqué", jeu: "jeu", jour: "jour", tempsMs: "temps", retire: "retiré", motif: "motif", supprime: "supprimé", statut: "statut", titre: "titre", lignes: "lignes", fr: "texte", en: "anglais", ou: "où", ton: "ton", fin: "jusqu'à" };

/** Un avant / après du journal en une ligne lisible (`pseudo : Bob`, `temps : 1:02,345 · jeu : DailyTrack`) ; jamais d'objet brut. */
export function resumeJournal(v: Record<string, unknown> | null): string {
  if (!v) return "—";
  const lignes = Object.entries(v).map(([k, x]) => {
    const valeur = typeof x === "boolean" ? (x ? "oui" : "non") : k === "tempsMs" && typeof x === "number" ? temps(x) : String(x);
    return `${LIBELLES_CHAMP[k] ?? k} : ${valeur}`;
  });
  return lignes.length ? lignes.join(" · ") : "—";
}

/** Le nom d'une action du journal, tel que le serveur l'écrit, en début de phrase. */
export const nomAction = (action: string): string => action.charAt(0).toUpperCase() + action.slice(1);

// --- Lot N2 : le message en direct — l'heure de fin ----------------------------------------------------------------------------------------
export type FinDuMessage = { mode: "1h" } | { mode: "minuit" } | { mode: "precise"; /** `AAAA-MM-JJTHH:MM`, l'heure de Paris (le champ `datetime-local`). */ valeur: string };

/** L'heure de fin choisie (ms), ou `null` si l'heure précise est illisible. 1 h : dans une heure ; minuit : le prochain minuit **de Paris** ; précise : l'heure de Paris saisie. */
export function finDuMessage(f: FinDuMessage, maintenant: number): number | null {
  if (f.mode === "1h") return maintenant + 3_600_000;
  if (f.mode === "minuit") {
    // Le jour de Paris d'aujourd'hui, puis le lendemain à 00:00 de Paris.
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(maintenant)).map((x) => [x.type, Number(x.value)])) as Record<string, number>;
    return instantDeParis(p.year!, p.month!, p.day! + 1, 0, 0);
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(f.valeur);
  return m ? instantDeParis(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5])) : null;
}

/** `AAAA-MM-JJ` d'aujourd'hui à Paris (la date affichée d'une nouveauté par défaut). */
export function aujourdhuiParis(maintenant: number): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(maintenant)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
