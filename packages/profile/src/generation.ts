import { keysWith, type ListableStore } from "./identity";

// Lot R8 — « tout le monde repart de zéro » côté navigateur. Le serveur annonce une **génération de données** (un nombre, l'instant de la remise
// à zéro du lancement ; 0 tant qu'il n'y en a pas eu) dans `GET /api/portail/jour`, la lecture regroupée de DailyJump et `GET /api/day/<date>` de
// DailyTrack. Un navigateur qui en garde une **plus ancienne** efface au premier chargement toutes ses données de jeu (identité, pseudo, révision,
// historiques et séries, records, envois en attente, mémoire du jour : les clés `cdj:*` et `jump:*`), sauf ses réglages (langue, son, commandes,
// affichage : `CLES_GARDEES`), puis recharge la page : il est un joueur neuf, et un message court le dit une fois (`lireNouveauDepart`).
// Une génération plus ancienne que la sienne n'efface jamais rien (un cache qui rend une vieille réponse ne peut pas vider un joueur neuf).
// Aucun accès direct au stockage : il est injecté (comme le reste du module).

/** La génération que ce navigateur a adoptée (nombre), ou `neuf` : un navigateur démarré sans aucune donnée de jeu (rien à effacer). */
export const GENERATION_KEY = "cdj:generation";
/** Posée à l'effacement, lue (et retirée) une fois : le message « Nouveau départ » n'est montré qu'une fois. */
export const NOUVEAU_DEPART_KEY = "cdj:nouveau-depart";
/** La marque d'un navigateur démarré neuf. */
export const NAVIGATEUR_NEUF = "neuf";

/** Les préfixes des données de jeu : DailyTrack et la plateforme (`cdj:`), DailyJump (`jump:`), Tower (`tower:`, lot TP). */
export const PREFIXES_DE_JEU = ["cdj:", "jump:", "tower:"] as const;

/**
 * Ce qui **survit** à l'effacement : la langue commune, le son, les commandes (tactiles), les réglages d'affichage et de jeu, la qualité graphique,
 * la caméra, et les clés des outils d'essai et d'administration (jamais un profil). Les clés de la démonstration (`?api=demo`) ne sont pas gardées : elles ne
 * valent rien après une remise à zéro (et le portail de production ne doit contenir aucune trace de la démonstration : `construction.test.ts`). Tout le reste sous `cdj:`, `jump:` et `tower:` est effacé.
 */
export const CLES_GARDEES: readonly string[] = [
  "cdj:langue",
  "cdj:audio",
  "cdj:touch",
  "cdj:camera",
  "cdj:qualite",
  "cdj:settings",
  "cdj:astuce:plein-ecran",
  // Lot 53 : « Retrouver mon profil » passé : un réglage de l'appareil (une carte qui ne revient pas), pas une donnée de joueur.
  "cdj:retrouver:vu",
  // Lot N2 : le message en direct fermé sur cet appareil et la dernière nouveauté lue : du contenu de l'éditeur, pas une donnée de joueur (aucune raison de les rendre au « Nouveau départ »).
  "cdj:annonce:fermee",
  "cdj:nouveautes:lu",
  "cdj:tune",
  "cdj:admin",
  "cdj:admin-token",
  // La page d'outils de Jump (`/jump/admin/`) : ses choix d'essai, comme ceux de Track (`cdj:admin`).
  "jump:admin",
  "jump:settings",
  "jump:camera",
  "jump:fantome",
  "jump:tune",
];

/** Lot P : les clés d'aperçu (`cdj:apercu:<jeu>`) d'un appareil de test : un réglage de l'appareil, jamais une donnée de joueur. */
const PREFIXE_APERCU = "cdj:apercu:";

const gardee = (key: string): boolean => key === GENERATION_KEY || key === NOUVEAU_DEPART_KEY || key.startsWith(PREFIXE_APERCU) || CLES_GARDEES.includes(key);

/** Les clés de données de jeu (hors réglages) d'un stockage. */
export function clesDeDonnees(storage: Pick<ListableStore, "length" | "key">): string[] {
  const out: string[] = [];
  for (const prefix of PREFIXES_DE_JEU) for (const k of keysWith(storage, prefix)) if (!gardee(prefix + k)) out.push(prefix + k);
  return out;
}

/**
 * **À appeler tout au début d'une application, avant qu'elle écrive quoi que ce soit.** Un navigateur qui n'a aucune génération ni aucune donnée
 * de jeu est neuf : il est marqué (`neuf`), et la première génération du serveur est adoptée sans rien effacer ni dire. Un navigateur qui a des
 * données sans génération (d'avant le lot R8) n'est pas marqué : il sera effacé à la première génération servie qui n'est pas 0. Ne lève jamais.
 */
export function initialiserGeneration(storage: ListableStore): void {
  try {
    if (storage.getItem(GENERATION_KEY) !== null) return;
    if (clesDeDonnees(storage).length === 0) storage.setItem(GENERATION_KEY, NAVIGATEUR_NEUF);
  } catch {
    /* stockage refusé : rien ne s'efface */
  }
}

/** La génération d'une réponse du serveur (`generation`), ou `null` si elle manque ou est illisible (un serveur d'avant le lot R8, un cache). */
export function generationDeReponse(corps: unknown): number | null {
  const g = (corps as { generation?: unknown } | null)?.generation;
  return typeof g === "number" && Number.isSafeInteger(g) && g >= 0 ? g : null;
}

export type SuiteGeneration =
  /** Rien à faire : même génération, plus ancienne que la sienne, ou réponse sans génération. */
  | "inchangee"
  /** Génération adoptée sans rien effacer (navigateur neuf, ou première lecture d'un navigateur d'avant). */
  | "adoptee"
  /** Les données de jeu ont été effacées : **l'application recharge la page** (le message est posé). */
  | "efface";

/**
 * Applique la génération annoncée par le serveur. `efface` : les données de jeu sont parties, la nouvelle génération est notée **avant** tout
 * rechargement (jamais de boucle) et le message est posé ; l'appelant recharge. Si le stockage refuse l'écriture, rien n'est effacé.
 */
export function appliquerGeneration(storage: ListableStore, serveur: number | null): SuiteGeneration {
  if (serveur === null) return "inchangee";
  try {
    const vue = storage.getItem(GENERATION_KEY);
    if (vue === NAVIGATEUR_NEUF) {
      storage.setItem(GENERATION_KEY, String(serveur));
      return "adoptee";
    }
    const connue = vue === null ? null : Number(vue);
    if (connue !== null && (!Number.isSafeInteger(connue) || serveur <= connue)) return "inchangee";
    if (connue === null && serveur === 0) {
      storage.setItem(GENERATION_KEY, "0");
      return "adoptee";
    }
    // Une génération plus récente que la sienne (ou la première génération servie à un navigateur qui a des données d'avant) : on repart de zéro.
    const cles = clesDeDonnees(storage);
    storage.setItem(GENERATION_KEY, String(serveur));
    if (storage.getItem(GENERATION_KEY) !== String(serveur)) return "inchangee"; // le stockage ne retient rien : pas d'effacement (ni de boucle)
    for (const k of cles) storage.removeItem(k);
    if (cles.length === 0) return "adoptee"; // rien à effacer, rien à dire
    storage.setItem(NOUVEAU_DEPART_KEY, "1");
    return "efface";
  } catch {
    return "inchangee";
  }
}

/** Le message « Nouveau départ » est-il à montrer ? Vrai une seule fois (le drapeau est retiré à la lecture). Ne lève jamais. */
export function lireNouveauDepart(storage: Pick<ListableStore, "getItem" | "removeItem">): boolean {
  try {
    if (storage.getItem(NOUVEAU_DEPART_KEY) === null) return false;
    storage.removeItem(NOUVEAU_DEPART_KEY);
    return true;
  } catch {
    return false;
  }
}
