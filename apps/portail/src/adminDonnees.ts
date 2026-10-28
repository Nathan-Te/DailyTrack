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

const LIBELLES_CHAMP: Record<string, string> = { pseudo: "pseudo", masque: "masqué", jeu: "jeu", jour: "jour", tempsMs: "temps", retire: "retiré", motif: "motif", supprime: "supprimé" };

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
