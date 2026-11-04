import { NOM_DE_ZONE, type OuMessage, type TonMessage, type ZoneNouveaute } from "@cdj/core/nouveautes";
import { instantDeParis } from "./adminGithub";
import { FICHES } from "./jeuxFiches";

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

/**
 * Lots K1 à K1c : le tableau de bord a **une tuile par jeu** (sa fiche), « <Nom> finis », dès que la réponse de l'API porte ses chiffres (`chiffres.<id>`, envoyés quand le jeu est monté sur le serveur) ;
 * un jeu qui compte aussi ses morts (Jump) les dit en sous-texte. Rend `{ legende, valeur }`.
 */
export function tuilesDesJeux(c: Chiffres): { legende: string; valeur: string; sousTexte?: string }[] {
  const chiffres = c as unknown as Record<string, { finis?: number; morts?: number } | undefined>;
  return FICHES.flatMap((f) => {
    const x = chiffres[f.id];
    return typeof x?.finis === "number" ? [{ legende: `${NOM_DE_ZONE[f.id as ZoneNouveaute] ?? f.id} finis`, valeur: String(x.finis), ...(typeof x.morts === "number" ? { sousTexte: `${x.morts} mort${x.morts > 1 ? "s" : ""}` } : {}) }] : [];
  });
}

/** Lots K1 à K1c : le nom d'un jeu d'après son code au registre du serveur (`cdj`, `jump`, `tower`), pour un résultat retiré : jamais « Track » par défaut pour un jeu qu'on ne reconnaît pas. */
export function nomDuJeuAdmin(code: string): string {
  const fiche = FICHES.find((f) => f.code === code);
  return fiche ? (NOM_DE_ZONE[fiche.id as ZoneNouveaute] ?? fiche.id) : code;
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

/** Lot D2 (C1) : un jeu (ou la plateforme) sur une période : le nombre de refus par cause et le détail par code. */
export interface RefusPeriode {
  total: { perime: number; invalide: number; limites: number; jour: number; serveur: number; codes: Record<string, number> };
  parJeu: { jeu: string; nom: string; perime: number; invalide: number; limites: number; jour: number; serveur: number; codes: Record<string, number> }[];
}
export interface RefusDuTableau {
  h24: RefusPeriode;
  j7: RefusPeriode;
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
    erreurs24h: { serveur: number; rediffusions: number; perimes: number; limites: number };
    /** Lot D2 (C1) : les refus d'envoi par cause et par jeu, sur 24 h et sur 7 jours. */
    refus: RefusDuTableau;
    /** Lot D3 : l'instance qui répond (mémoire, plus grand retard de la boucle pendant une requête sur 24 h) ; absent si elle n'est pas mesurée. */
    instance?: { depuisMs: number; memoire: { rssMo: number; tasMo: number; externeMo: number }; retardMax24hMs: number; blocages24h: number };
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
/** Lot P (interrupteur des jeux) : un jeu vu par le panneau. `cle` : si une clé d'aperçu existe (jamais sa valeur : le serveur n'en garde que l'empreinte). */
export interface JeuAdmin {
  jeu: string;
  nom: string;
  etat: "off" | "preview" | "on";
  /** Le premier jour entier où le jeu compte dans la journée (AAAA-MM-JJ), ou `null`. */
  liveFrom: string | null;
  periodes: { du: string; au: string | null }[];
  cle: { presente: boolean; creeeLe: string | null };
  modifieLe: string | null;
}

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
    // Lot C1, partie B : les images (la liste, les octets en adresse `data:` — la CSP de /admin/ n'autorise pas `blob:` —, les quatre actions)
    images: () => appeler<ListeImages>("GET", "/api/admin/images"),
    octetsImage: async (genre: string, ref: string): Promise<string | null> => {
      try {
        const res = await fetchImpl(`${base}/api/admin/images/${encodeURIComponent(genre)}/${encodeURIComponent(ref)}`, { credentials: "same-origin", cache: "no-store" });
        const type = res.headers.get("Content-Type") ?? "";
        if (!res.ok || !/^image\/(webp|jpeg)$/.test(type)) return null;
        const octets = new Uint8Array(await res.arrayBuffer());
        let binaire = "";
        for (const o of octets) binaire += String.fromCharCode(o);
        return `data:${type};base64,${btoa(binaire)}`;
      } catch {
        return null;
      }
    },
    actionImage: (genre: string, ref: string, action: ActionImage) => appeler<Record<string, unknown>>("POST", `/api/admin/images/${encodeURIComponent(genre)}/${encodeURIComponent(ref)}/${action}`, { confirmer: true }),
    // Lot C1, partie C : les groupes
    groupes: (o: { q?: string; page?: number }) => appeler<ListeGroupes>("GET", `/api/admin/groupes${q({ q: o.q, page: o.page && o.page > 1 ? o.page : undefined })}`),
    groupe: (id: string) => appeler<FicheGroupeAdmin>("GET", `/api/admin/groupes/${encodeURIComponent(id)}`),
    actionGroupe: (id: string, action: ActionGroupe, corps: Record<string, unknown> = {}) => appeler<Record<string, unknown>>("POST", `/api/admin/groupes/${encodeURIComponent(id)}/${action}`, { ...corps, confirmer: true }),
    // Lot C1 : les retours
    retours: (f: FiltresRetours) => appeler<ListeRetours>("GET", `/api/admin/retours${q({ type: f.type, jeu: f.jeu, statut: f.statut, page: f.page && f.page > 1 ? f.page : undefined })}`),
    retoursCompte: () => appeler<{ nonLus: number }>("GET", "/api/admin/retours/compte"),
    retour: (id: number) => appeler<RetourDetail>("GET", `/api/admin/retours/${id}`),
    lireRetour: (id: number) => appeler<{ statut: StatutRetourAdmin }>("POST", `/api/admin/retours/${id}/lu`, { confirmer: true }),
    repondreRetour: (id: number, texte: string) => appeler<{ ok: true; statut: StatutRetourAdmin }>("POST", `/api/admin/retours/${id}/repondre`, { texte, confirmer: true }),
    statutRetour: (id: number, statut: StatutRetourAdmin) => appeler<{ statut: StatutRetourAdmin }>("POST", `/api/admin/retours/${id}/statut`, { statut, confirmer: true }),
    // Lot P
    jeux: () => appeler<{ aujourdhui: string; jeux: JeuAdmin[] }>("GET", "/api/admin/jeux"),
    changerEtatJeu: (jeu: string, etat: JeuAdmin["etat"]) => appeler<{ aujourdhui: string; jeux: JeuAdmin[] }>("POST", `/api/admin/jeux/${encodeURIComponent(jeu)}/etat`, { etat, confirmer: true }),
    genererCleApercu: (jeu: string) => appeler<{ cle: string; jeu: string }>("POST", `/api/admin/jeux/${encodeURIComponent(jeu)}/cle`, { confirmer: true }),
    revoquerCleApercu: (jeu: string) => appeler<{ aujourdhui: string; jeux: JeuAdmin[] }>("POST", `/api/admin/jeux/${encodeURIComponent(jeu)}/cle/revoquer`, { confirmer: true }),
    retirerMessage: () => appeler<{ actif: null }>("POST", "/api/admin/message/retirer", { confirmer: true }),
  };
}
export type ClientAdmin = ReturnType<typeof clientAdmin>;

// --- Lot C1, partie C : les groupes ---------------------------------------------------------------------------------------------
export type ActionGroupe = "renommer" | "emblem-retirer" | "retirer" | "chef" | "masquer" | "dissoudre";
export interface GroupeResume {
  id: string;
  nom: string;
  membres: number;
  masque: boolean;
  creeLe: string;
}
export interface ListeGroupes {
  page: number;
  suivante: boolean;
  groupes: GroupeResume[];
}
export interface FicheGroupeAdmin {
  id: string;
  nom: string;
  description: string;
  creeLe: string;
  renommeLe: string | null;
  masque: boolean;
  emblem: { statut: string; hash: string } | null;
  membres: { ref: string; pseudo: string; chef: boolean; depuis: string; masque: boolean }[];
}

// --- Lot C1, partie B : les images ----------------------------------------------------------------------------------------------
export type ActionImage = "garder" | "retirer" | "interdire" | "autoriser";
export interface ImageAdmin {
  kind: string;
  ref: string;
  nom: string | null;
  hash: string;
  statut: string;
  signalements: number;
  interdit: boolean;
  majLe: string;
}
export interface ListeImages {
  signalees: ImageAdmin[];
  nouvelles: ImageAdmin[];
  max: number;
}

// --- Lot C1 : les retours des joueurs ---------------------------------------------------------------------------------------------
export const TYPES_RETOUR_ADMIN = { bug: "Bug", suggestion: "Idée", autre: "Autre" } as const;
export const STATUTS_RETOUR_ADMIN = { nouveau: "Nouveau", lu: "Lu", en_cours: "En cours", traite: "Traité", refuse: "Refusé" } as const;
export type StatutRetourAdmin = keyof typeof STATUTS_RETOUR_ADMIN;
export interface RetourResume {
  id: number;
  type: keyof typeof TYPES_RETOUR_ADMIN;
  jeu: string;
  statut: StatutRetourAdmin;
  creeLe: string;
  majLe: string;
  nonLu: boolean;
  messages: number;
  ref: string | null;
  pseudo: string | null;
  apercu: string;
}
export interface ListeRetours {
  page: number;
  parPage: number;
  suivante: boolean;
  nonLus: number;
  retours: RetourResume[];
}
export interface RetourDetail {
  id: number;
  type: keyof typeof TYPES_RETOUR_ADMIN;
  jeu: string;
  statut: StatutRetourAdmin;
  creeLe: string;
  majLe: string;
  nonLu: boolean;
  contexte: Record<string, unknown> | null;
  ref: string | null;
  pseudo: string | null;
  reponsePossible: boolean;
  messages: { auteur: "joueur" | "admin"; texte: string; creeLe: string }[];
}
export interface FiltresRetours {
  type?: string;
  jeu?: string;
  statut?: string;
  page?: number;
}

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
  game_unavailable: "Ce jeu n'est pas ouvert au public.",
  invalid_feedback: "Le message est vide, trop long (1 000 caractères) ou d'un type inconnu.",
  unknown_feedback: "Retour introuvable.",
  feedback_full: "Ce fil est complet (100 messages).",
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

/**
 * Où revenir après la connexion (`/admin/?retour=/track/admin/`) : **uniquement** les pages d'outils de Track et de Jump, jamais une adresse écrite par un tiers (un lien piégé ne
 * doit pas faire partir l'éditeur ailleurs une fois connecté). Une liste fermée de deux entrées, comparées telles quelles : ni schéma, ni `//`, ni encodage, ni requête.
 */
export const RETOURS_PERMIS = ["/track/admin/", "/jump/admin/"] as const;
export function retourAdmin(search: string): string | null {
  const brut = new URLSearchParams(search).get("retour");
  return (RETOURS_PERMIS as readonly string[]).includes(brut ?? "") ? brut : null;
}

// --- Lot P : l'interrupteur des jeux ---------------------------------------------------------------------------------------------------
export const NOMS_ETAT_JEU: Record<JeuAdmin["etat"], string> = { off: "Off", preview: "Aperçu", on: "On" };

/** Ce que change un état, dit à Nathan avant qu'il confirme. */
export function consequenceEtat(nom: string, de: JeuAdmin["etat"], vers: JeuAdmin["etat"], liveFrom: string | null): string {
  if (vers === "on")
    return `${nom} devient visible par tous : à l'accueil, jouable, son API s'ouvre. Il ne compte dans la journée (série, journée parfaite, classement du jour, partage) qu'à partir du premier jour entier${liveFrom ? ` (${liveFrom})` : " qui suit"}. Les résultats d'aperçu sont effacés.`;
  if (vers === "preview") return `${nom} disparaît de l'accueil et de la journée dès le lendemain ; sa page n'est jouable qu'avec la clé d'aperçu (bandeau « Aperçu »). Les résultats déjà là restent en base.`;
  return `${nom} disparaît de l'accueil, sa page affiche « Bientôt » et son API refuse tout${de === "on" ? " ; il sort de la journée dès le lendemain, sans casser les séries acquises" : ""}. Les résultats restent en base et reviennent à la réactivation.`;
}

/** Le lien d'aperçu d'un jeu : la clé est dans l'adresse **de ce lien seulement** (la page du jeu la range puis la retire de l'adresse ; elle ne va jamais à l'API par l'adresse). */
export const lienApercu = (origine: string, jeu: string, cle: string): string => `${origine.replace(/\/+$/, "")}/${encodeURIComponent(jeu)}/?apercu=${encodeURIComponent(cle)}`;
