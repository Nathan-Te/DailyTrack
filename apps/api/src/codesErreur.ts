// Lot I1 (plateforme) : les codes d'erreur du serveur, **liste unique**. Toute réponse d'erreur du serveur a la forme
// `{ "error": "<code>", …détails }` : `error` est un code de cette liste, rendu avec le statut HTTP de la liste (imposé par le typage de
// `HttpError`, `errors.ts` : un mauvais statut fait échouer `tsc`). Le client traduit chaque code sous la clé `erreur.<code>` du catalogue
// commun (`packages/ui`, français et anglais). Lot I6 : plus de champ `message` (aucun client ne le lisait plus depuis les lots I4 et I5).
//
// Règle : une nouvelle erreur prend un code de cette liste (ou en ajoute un ici, avec son statut et son sens), le décrit dans
// `docs/plateforme/codes-erreur.md` et l'ajoute au catalogue commun. Tests : `apps/api/test/codesErreur.test.ts` (parcours des routes,
// analyse des sources, documentation) et `makeApi().call` de `apps/api/test/helpers.ts` (chaque réponse d'erreur des tests est vérifiée).

/** Chaque code : le statut HTTP avec lequel il est rendu (un seul) et quand le serveur le rend. */
export const CODES_ERREUR = {
  // --- Commun à toutes les routes ---------------------------------------------------------------------------
  not_found: { status: 404, sens: "Route inconnue (y compris les routes d'admin quand l'admin est désactivé, et toute adresse inconnue sous /api/jump/)." },
  method_not_allowed: { status: 405, sens: "La route existe, mais pas pour cette méthode HTTP." },
  invalid_json: { status: 400, sens: "Le corps de la requête n'est pas un objet JSON." },
  too_large: { status: 413, sens: "Le corps de la requête dépasse la taille permise (MAX_BODY_BYTES), annoncée ou lue." },
  rate_limited: { status: 429, sens: "Trop de requêtes pour cette adresse, ce joueur ou ce jeton d'admin dans la fenêtre de débit (en-tête Retry-After)." },
  busy: { status: 503, sens: "Serveur saturé : plafond de rejeux par minute de l'instance atteint (Retry-After), ou envois simultanés de vies du même joueur impossibles à fusionner." },
  internal: { status: 500, sens: "Erreur inattendue du serveur (défaut du code, base qui ne répond plus pendant une route) ; aucun détail n'est donné." },
  db_unavailable: { status: 503, sens: "/api/health : la base de données ne répond pas (la sonde de Cloud Run et la CI s'y fient)." },

  // --- Identité commune (joueur, pseudo, code de transfert, admin) -----------------------------------------
  invalid_player: { status: 400, sens: "Identifiant de joueur manquant ou mal formé (en-tête X-Player-Id ou corps), ou nouvel identifiant identique à l'ancien." },
  unknown_player: { status: 404, sens: "Aucun joueur sur le serveur pour cet identifiant (jamais classé), ou aucun profil à effacer pour ce code." },
  code_revoked: { status: 410, sens: "Ce code (identifiant secret) a été remplacé par « Changer mon code » : il ne vaut plus rien." },
  id_taken: { status: 409, sens: "« Changer mon code » : le nouvel identifiant tiré par le jeu est déjà pris (recommencer)." },
  invalid_name: { status: 400, sens: "Pseudo invalide (longueur ou caractères hors des règles)." },
  name_forbidden: { status: 400, sens: "Pseudo refusé : mot interdit ou nom réservé." },
  name_taken: { status: 409, sens: "Pseudo déjà à un autre joueur ; la réponse porte des suggestions libres (`suggestions`)." },
  name_required: { status: 400, sens: "Premier envoi d'un joueur inconnu sans pseudo." },
  invalid_code: { status: 400, sens: "Admin, effacement : code de transfert mal formé ou abîmé (somme de contrôle)." },
  unauthorized: { status: 401, sens: "Admin : jeton manquant ou incorrect." },

  // --- Jours, circuits et niveaux ----------------------------------------------------------------------------
  invalid_date: { status: 400, sens: "Date illisible (AAAA-MM-JJ attendue)." },
  unknown_day: { status: 404, sens: "Ce jour n'a pas (encore) de circuit ou de niveau : futur, ou avant le premier jour du jeu." },
  day_closed: { status: 409, sens: "Envoi pour un jour dont le classement est figé (jour passé, après la grâce de 10 minutes)." },
  day_started: { status: 409, sens: "Admin, planning : ce jour a déjà commencé, son circuit ne peut plus être remplacé." },
  too_far: { status: 400, sens: "Admin, planning : jour trop loin dans le futur (plus de PLANNING_HORIZON jours)." },
  invalid_variant: { status: 400, sens: "Admin, planning : variante hors de 0 à MAX_VARIANT." },
  invalid_theme: { status: 400, sens: "Admin, planning : thème inconnu." },
  circuit_unavailable: { status: 503, sens: "DailyTrack : le générateur n'a pas produit de circuit valide pour ce jour ou cette session du Salon (réessayer plus tard)." },

  // --- Envois et rejeu -------------------------------------------------------------------------------------------
  invalid_replay: { status: 400, sens: "Rediffusion manquante ou illisible, d'un autre niveau, ou essai qui ne part pas du départ (DailyJump)." },
  sim_version: { status: 409, sens: "DailyTrack : rediffusion enregistrée avec une autre version de la simulation que le serveur (recharger la page)." },
  track_mismatch: { status: 409, sens: "DailyTrack : la rediffusion n'est pas celle du circuit de ce jour ou de cette session du Salon." },
  not_finished: { status: 422, sens: "La rediffusion, rejouée par le serveur, n'arrive pas au bout (ligne d'arrivée, fin du niveau)." },
  no_ghost: { status: 404, sens: "Pas de fantôme à rendre : personne de classé, pas de temps pour ce joueur, ou personne devant lui." },
  invalid_kind: { status: 400, sens: "DailyTrack : fantôme demandé avec un `kind` autre que first ou ahead." },

  // --- Salon (DailyTrack) ----------------------------------------------------------------------------------------
  invalid_session: { status: 400, sens: "Salon : numéro de session (ou adresse) illisible." },
  unknown_session: { status: 404, sens: "Salon : cette session n'est pas servie (pas encore préparée, ou finie et oubliée)." },
  session_future: { status: 409, sens: "Salon : envoi pour une session qui n'a pas commencé." },
  session_closed: { status: 409, sens: "Salon : envoi arrivé après la fin de la session (plus de 3 secondes après)." },
  too_fast: { status: 429, sens: "Salon : plus d'un envoi par 5 secondes pour ce joueur (Retry-After)." },
  invalid_since: { status: 400, sens: "Salon, classement : le paramètre `since` n'est pas un entier." },
  too_many_refs: { status: 400, sens: "Salon, fantômes : trop de références demandées à la fois." },
  invalid_ref: { status: 400, sens: "Salon, fantômes : référence de joueur mal formée." },

  // --- DailyJump -------------------------------------------------------------------------------------------------
  invalid_level: { status: 400, sens: "DailyJump : identifiant de niveau illisible (jour-AAAA-MM-JJ-g<N> attendu)." },
  not_daily: { status: 409, sens: "DailyJump : ce n'est pas le niveau du jour (thème forcé, niveau futur ou d'avant le premier niveau) : jamais classé." },
  version: { status: 409, sens: "DailyJump : versions du jeu, de la rediffusion ou du niveau différentes de celles du serveur (recharger la page)." },
  level_unavailable: { status: 503, sens: "DailyJump : le niveau du jour gardé en base est abîmé (empreinte) : réessayer plus tard." },
  invalid_lives: { status: 400, sens: "DailyJump, vies : liste de vies (`lives`) absente ou vide." },
  too_many_lives: { status: 413, sens: "DailyJump, vies : plus de JUMP_LIVES_PER_LOT vies dans un même lot." },
} as const satisfies Record<string, { status: number; sens: string }>;

/** Un code d'erreur du serveur (une clé de `CODES_ERREUR`). */
export type CodeErreur = keyof typeof CODES_ERREUR;
/** Le statut HTTP d'un code : celui de la liste, et lui seul. */
export type StatutErreur<C extends CodeErreur> = (typeof CODES_ERREUR)[C]["status"];

/** Vrai si `x` est un code de la liste. */
export function estCodeErreur(x: unknown): x is CodeErreur {
  return typeof x === "string" && Object.hasOwn(CODES_ERREUR, x);
}

/** Le corps d'une réponse d'erreur construite hors de `HttpError` (500 inattendue, santé) : `{ error }` (lot I6 : sans `message`). */
export function corpsErreur<C extends CodeErreur>(code: C): { error: C } {
  return { error: code };
}

/** Le corps d'une erreur inattendue, le même pour `api.ts` et `node-server.ts` (statut : `CODES_ERREUR.internal.status`). */
export const ERREUR_INTERNE = corpsErreur("internal");
