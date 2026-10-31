// Lot P4 (plateforme) : la projection du coût d'un mois, à partir du nombre de joueurs par jour de chaque jeu (saisis à la main). Logique pure
// (testée : `apps/api/test/platformBudget.test.ts`) ; `scripts/measure-platform.ts` l'affiche. Les coûts unitaires sont **mesurés**, pas
// supposés : chaque chiffre dit d'où il vient (README de lot, `npm run measure:budget`, `npm run measure:jump-api -w @cdj/api`). Ils sont à
// remesurer quand un jeu change ce qu'il lit ou écrit (le README du lot qui le change le dit).

/** L'offre gratuite, par mois (Cloud Run : niveau 1, requêtes et calcul ; Turso : offre gratuite). */
export const FREE_TIER = {
  requests: 2_000_000,
  vcpuS: 180_000,
  gibS: 360_000,
  tursoRead: 500_000_000,
  tursoWritten: 10_000_000,
} as const;

/**
 * Prix au-delà de l'offre gratuite (Cloud Run, facturation à la requête, niveau 1 — `europe-west1`), en dollars US : tarifs publics de Google
 * au moment du lot, **à vérifier dans la console** (Facturation → Tarifs). Turso : au-delà de l'offre gratuite, il faut une offre payante (prix
 * sur turso.tech/pricing) : pas de chiffre ici.
 */
export const PRICES_USD = { perMillionRequests: 0.4, perVcpuS: 0.000024, perGibS: 0.0000025 } as const;

/** Mémoire d'une instance (512 Mio, `deploy-api.yml`) : facturée pendant le même temps que le processeur. */
const GIB_PER_INSTANCE = 0.5;
/** Borne haute du calcul facturé : chaque requête seule, arrondie aux 100 ms (comme `measure:budget`). */
const BILLED_S_PER_REQUEST = 0.1;

/** Ce que coûte un joueur pendant une journée (ou une demi-heure de Salon). */
export interface UnitCost {
  /**
   * Requêtes applicatives : toutes passent par Cloud Run. Lot R5 : **plus de pré-vols CORS** — depuis le lot R4, les jeux appellent `/api/` sur
   * leur propre adresse (Firebase Hosting renvoie vers Cloud Run) : aucune requête `OPTIONS`.
   */
  requests: number;
  read: number;
  written: number;
  /** Secondes de calcul mesurées (sans l'arrondi de facturation). */
  cpuS: number;
  /** Secondes facturées au plus (arrondi aux 100 ms par requête, et plus pour les requêtes longues). */
  billedS: number;
}

/**
 * **DailyJump**, un joueur type d'une journée (lot P4 : `npm run measure:jump-api -w @cdj/api`, sqld local, 19/10/2026) : 2 chargements, 4
 * arrivées dont 2 envois, 1 pseudo, 50 morts dont 30 envoyées en 3 lots, le carnage de tout le monde regardé 2 fois, 30 jours d'historique.
 * Calcul : envois ≈ 50 ms, lecture regroupée ≈ 30 ms, lot de vies ≈ 60 ms. Facturé au plus : 12 requêtes × 100 ms (lot P4 : 1,9 s avec les 7
 * pré-vols, retirés au lot R5). **Lot I3** : une requête de plus, « Jeu suivant du jour » (`GET /api/portail/jour` après l'envoi accepté : 8 instructions,
 * ≈ 172 lignes lues avec 30 jours d'historique, 0 écrite) : 13 requêtes, 1 292 lignes lues.
 */
export const JUMP_PLAYER: UnitCost = { requests: 13, read: 1292, written: 32, cpuS: 0.47, billedS: 1.3 };
/**
 * **DailyJump**, ce qui ne dépend pas d'un joueur, par jour (lot P3) : la carte recalculée au plus toutes les 3 min (480 fois au pire, une ligne lue
 * par joueur du jour), l'oubli de fin de jour (3 lignes lues et 1 écrite par joueur).
 */
export const JUMP_DAY = { rebuilds: 480, readPerPlayerPerRebuild: 1, readPerPlayerForget: 3, writtenPerPlayerForget: 1, rebuildS: 0.25 };
/**
 * **DailyTrack**, un joueur du circuit du jour avec la synchronisation du profil (lot 30 : 4 lectures, 14 jours d'historique ; `npm run
 * measure:budget`, sqld local, 19/10/2026) : 13 requêtes, 1 650 lignes lues, 42 écrites, 0,5 s de calcul, 3 vCPU-s facturées au plus (mesurées
 * sans pré-vols ; lot P4 : 4 pré-vols estimés en plus, retirés au lot R5). **Lot I3** : « Jeu suivant du jour » à l'arrivée (une requête de plus,
 * ≈ 172 lignes lues) : 14 requêtes, 1 822 lignes lues. **Lot 41 (Garage ; lot de plateforme « suites de Track 2 »)** : + 1 requête par ouverture du Garage
 * (`GET /api/garage`, une ouverture par joueur et par jour comptée) : 15 requêtes ; la requête indexée du Garage lit ≈ 2 lignes par jour joué (14 jours
 * d'historique comptés : 28), et **l'envoi garde son nombre de requêtes** avec la même requête indexée de plus (28 lignes) : + 56 lignes, 1 878 lues.
 * Aucune écriture de plus, calcul négligeable (README du lot 41, § 5).
 * **Lot 51 (la voiture sur tous les appareils)** : **zéro requête de plus par chargement** — le choix gardé par le serveur arrive avec le profil que le jeu lit déjà
 * (`GET /api/me`, 2 par jour comptées : +1 ligne lue chacune) et avec l'ouverture du Garage (+1 ligne) ; la voiture de la course est jointe à l'envoi (lue avant l'écriture,
 * la même requête indexée qu'avant : rien de plus). Seul ajout : **un enregistrement du choix par jour** (`PUT /api/garage`, un joueur qui change de voiture une fois) :
 * 16 requêtes ; 3 lectures fixes + la requête indexée du Garage (≈ 28 lignes pour 14 jours) ; 1 ligne écrite + 2 compteurs de débit. Total : + 33 lignes lues, + 3 écrites.
 */
export const TRACK_PLAYER: UnitCost = { requests: 16, read: 1911, written: 45, cpuS: 0.52, billedS: 3.2 };
/**
 * **Tower** (lot TP), un joueur type d'une journée : 2 chargements de l'accueil (`GET /api/tower/day/<date>` puis `…/board` avec sa ligne : 2 requêtes chacun), 2 envois de partie
 * (le rejeu côté serveur), le fantôme Diamant (`…/diamant`, 1), le profil (`GET /api/tower/me`, 1) et « Jeu suivant du jour » (`GET /api/portail/jour`, 1) : **10 requêtes** (comme les autres
 * jeux, aucune requête OPTIONS : même adresse). Lignes lues, **mesurées sur la base de référence** (`npm run measure:lignes -w @cdj/api`, 300 joueurs, 14 jours, base libSQL locale comptée,
 * estimation basse — **pas sur un `sqld` ni sur Turso : l'environnement du lot n'a pas Docker**, à remesurer par `npm run measure:tower -w @cdj/api` sur un `sqld` local) : jour ≈ 7 (relu en base), classement
 * avec ta ligne 53 à 59, envoi amélioré ≈ 69 (dont les 50 lignes du classement rendu), profil 10 à 16, portail ≈ 434 à froid : 2 × (7 + 59) + 2 × 69 + 1 + 16 + 434 ≈ **720**. Écrites : 2 par envoi
 * (la partie, `tower_levels` au premier du jour) plus les compteurs de débit : ≈ 10. Calcul : un rejeu mesuré à 0,28 s (partie complète de 40 pièces, `scripts/tower-mesure.ts`) × 2 +
 * 8 requêtes ordinaires → 0,75 s ; facturé au plus 10 × 100 ms + les rejeux arrondis au-delà (2 × 0,3 s) = 1,6 s. Le rejeu est le poids de Tower : `UNITES_REJEU_TOWER` = 30 unités du plafond global.
 */
export const TOWER_PLAYER: UnitCost = { requests: 10, read: 720, written: 10, cpuS: 0.75, billedS: 1.6 };
/**
 * **Lot 55 (choisir ses fantômes dans le classement)** : `GET /api/day/<date>/run/<ref>` (la rediffusion d'une ligne), **une requête par fantôme choisi et par page** (cinq au plus ; la page garde
 * ce qu'elle a téléchargé : recommencer ne relit rien), **seulement pour un joueur qui coche des cases ou qui garde « Ma sélection »** — le joueur type de `TRACK_PLAYER` n'en fait aucune de
 * plus (le premier et celui devant toi, proposés cochés, ne sont téléchargés qu'en passant en « Ma sélection »). Une requête : 2 instructions (la ligne de la course par `players_by_ref` puis la
 * clé de `results`, puis le rang par l'index des temps du jour), ≈ 3 lignes lues + les entrées d'index avant la sienne (un fantôme est un bon temps : son rang est petit), **0 écrite**, aucun
 * compteur en base (limite de lecture en mémoire, comme le classement). Poids : 3,6 à 7,4 ko par rediffusion (≈ 2 à 3 ko compressés), jamais plus de 38 ko pour cinq.
 */
export const TRACK_FANTOMES_CHOISIS = { maxParPage: 5, requestsParFantome: 1, readParFantome: 3, written: 0 } as const;
/**
 * **Salon de DailyTrack**, 30 minutes d'un joueur (3 sessions ; `measure:budget` : 558 requêtes, 12 763 lignes lues à 10 présents — 63 025 à 50 —,
 * 265 écrites, 5,8 s de calcul, 97 vCPU-s au plus ; `measure:salon` : 0,64 ms de calcul par joueur et par seconde, une instance tient ≈ 770
 * joueurs à 50 %). (Lot P4 : 3 pré-vols en plus, retirés au lot R5.)
 */
export const SALON_HALF_HOUR: UnitCost = { requests: 558, read: 12_763, written: 265, cpuS: 5.8, billedS: 97 };

/**
 * **Portail** (lot I2, mis à jour au lot I3), un visiteur d'une journée : 2 chargements de l'accueil (`GET /api/portail/jour`, une requête chacun) avec 30
 * jours d'historique dans les deux jeux (`npm run measure:portail -w @cdj/api`, sqld local, 20/10/2026 : 8 à 11 instructions, **172 lignes lues**, 0 écrite,
 * ≈ 20 ms) et **une page du classement du jour** (`GET /api/portail/classement` : publique, 30 s de cache de Hosting ; elle ne lit rien en base tant que le
 * classement gardé de l'instance dure) ; le profil commun n'est pas compté (ouvert rarement : 11 instructions, 393 lignes lues ensuite, une fois 6 775 et 58
 * écrites pour calculer les places finales de 30 jours). **Le classement du jour lui-même** (`CLASSEMENT_JOUR`) est une charge par instance, pas par
 * visiteur. Facturé au plus : 3 × 100 ms.
 */
export const PORTAIL_VISITOR: UnitCost = { requests: 3, read: 350, written: 0, cpuS: 0.07, billedS: 0.3 };

/**
 * **Le classement du jour** (lot I3) : calculé **au plus une fois par fenêtre de 45 s et par instance**, quand quelqu'un le lit (une lecture de `results` et de
 * `jump_results` : mesuré **1,9 ligne lue par joueur du jour**, 4 instructions, 0 écrite : 341 lignes à 100 joueurs, 2 051 à 1 000, 19 151 à 10 000 ; ≈ 190 ms
 * et ≈ 2 à 10 Mo en mémoire à 10 000). Pire cas d'un jour : `maxInstances` instances qui le recalculent chaque fenêtre pendant `heuresActives` heures.
 * Les lectures suivantes (page, tuile, arrivées des jeux) ne lisent rien : 0 à 9 lignes.
 */
export const CLASSEMENT_JOUR = { windowS: 45, readPerPlayer: 1.9, maxInstances: 2, heuresActives: 12 };

/** Lignes lues par jour, au pire, pour le classement du jour de `players` joueurs du jour (voir `CLASSEMENT_JOUR`). */
export function classementReadsPerDay(players: number, c = CLASSEMENT_JOUR): number {
  return Math.round(players * c.readPerPlayer * ((c.heuresActives * 3600) / c.windowS) * c.maxInstances);
}

/**
 * **Le message en direct** (lot N2) : chaque page ouverte et **visible** relit `GET /api/annonce` toutes les 60 s (`ANNONCE_RELECTURE_MS`) ; la réponse est publique
 * (`max-age=0, s-maxage=30`) : le cache de Firebase Hosting, partagé par toutes les pages ouvertes, ne laisse passer jusqu'à Cloud Run qu'**une requête par fenêtre de
 * 30 s et par point de présence du CDN qui sert des pages**. Une requête qui arrive à Cloud Run : 1 instruction, **1 ligne lue** (l'index de `fin`), 0 écrite, quelques
 * ms. `octetsParReponse` : le corps et les en-têtes, mesurés (`npm run measure:annonce -w @cdj/api`) ; c'est **Hosting**, pas Cloud Run, qui porte le poids quand les pages
 * sont très nombreuses (transfert gratuit : 360 Mo par jour).
 */
export const ANNONCE = { relectureS: 60, sMaxageS: 30, octetsParReponse: 711, lignesParRequete: 1, billedSParRequete: 0.1 };

export interface AnnonceParHeure {
  pages: number;
  /** Requêtes reçues par Hosting (une par page et par relecture). */
  hosting: number;
  /** Octets servis par Hosting. */
  octetsHosting: number;
  /** Requêtes qui arrivent à Cloud Run **sans** le cache de Hosting (pire cas : la même chose que `hosting`). */
  cloudRunSansCache: number;
  /** Requêtes qui arrivent à Cloud Run **avec** `s-maxage` (borne haute : chaque point de présence rafraîchit sa copie à chaque fenêtre). */
  cloudRun: number;
  /** Lignes lues dans Turso et secondes facturées (borne haute) par heure, avec le cache. */
  lignesLues: number;
  billedS: number;
}

/** Ce que coûtent `pages` pages ouvertes et visibles pendant une heure, quand le CDN sert la France par `pointsDePresence` points. */
export function annonceParHeure(pages: number, pointsDePresence: number, c = ANNONCE): AnnonceParHeure {
  const hosting = Math.round((pages * 3600) / c.relectureS);
  const cloudRun = Math.min(hosting, Math.round(pointsDePresence * (3600 / c.sMaxageS)));
  return { pages, hosting, octetsHosting: hosting * c.octetsParReponse, cloudRunSansCache: hosting, cloudRun, lignesLues: cloudRun * c.lignesParRequete, billedS: cloudRun * c.billedSParRequete };
}

export interface PlatformInput {
  /** Joueurs par jour de DailyJump, de DailyTrack (circuit du jour), et joueurs qui passent 30 minutes au Salon chaque jour. */
  jump: number;
  track: number;
  salon: number;
  /** Lot I2 : visiteurs du portail par jour (0 par défaut). */
  portail?: number;
  /** Lot TP : joueurs de Tower par jour (0 par défaut). */
  tower?: number;
  days?: number;
}

export interface Resource {
  name: string;
  used: number;
  free: number;
  /** Part de l'offre gratuite utilisée (1 = tout). */
  share: number;
  /** Au-delà de l'offre gratuite, en dollars US (Cloud Run) ; `null` : Turso, offre payante à choisir. */
  overUsd: number | null;
}

/** Le mois projeté : chaque ressource, sa part de l'offre gratuite, ce qui dépasse ; et le jeu qui pèse le plus sur chacune. */
export function projectMonth(input: PlatformInput): { resources: Resource[]; byGame: Record<string, { requests: number; read: number; written: number; billedS: number }>; firstLimit: string | null; headroom: number } {
  const days = input.days ?? 30;
  const games = {
    DailyJump: {
      requests: input.jump * JUMP_PLAYER.requests,
      read: input.jump * JUMP_PLAYER.read + (input.jump > 0 ? JUMP_DAY.rebuilds * (input.jump * JUMP_DAY.readPerPlayerPerRebuild + 2) : 0) + input.jump * JUMP_DAY.readPerPlayerForget,
      written: input.jump * JUMP_PLAYER.written + (input.jump > 0 ? JUMP_DAY.rebuilds : 0) + input.jump * JUMP_DAY.writtenPerPlayerForget,
      billedS: input.jump * JUMP_PLAYER.billedS + (input.jump > 0 ? JUMP_DAY.rebuilds * JUMP_DAY.rebuildS : 0),
    },
    DailyTrack: {
      requests: input.track * TRACK_PLAYER.requests,
      read: input.track * TRACK_PLAYER.read,
      written: input.track * TRACK_PLAYER.written,
      billedS: input.track * TRACK_PLAYER.billedS,
    },
    Tower: {
      requests: (input.tower ?? 0) * TOWER_PLAYER.requests,
      read: (input.tower ?? 0) * TOWER_PLAYER.read,
      written: (input.tower ?? 0) * TOWER_PLAYER.written,
      billedS: (input.tower ?? 0) * TOWER_PLAYER.billedS,
    },
    Salon: {
      requests: input.salon * SALON_HALF_HOUR.requests,
      read: input.salon * SALON_HALF_HOUR.read,
      written: input.salon * SALON_HALF_HOUR.written,
      billedS: input.salon * SALON_HALF_HOUR.billedS,
    },
    Portail: {
      requests: (input.portail ?? 0) * PORTAIL_VISITOR.requests,
      read: (input.portail ?? 0) * PORTAIL_VISITOR.read,
      written: (input.portail ?? 0) * PORTAIL_VISITOR.written,
      billedS: (input.portail ?? 0) * PORTAIL_VISITOR.billedS,
    },
  };
  const byGame = Object.fromEntries(Object.entries(games).map(([k, v]) => [k, { requests: v.requests * days, read: v.read * days, written: v.written * days, billedS: v.billedS * days }]));
  const total = (key: "requests" | "read" | "written" | "billedS") => Object.values(byGame).reduce((s, g) => s + g[key], 0);
  const vcpu = total("billedS");
  const over = (used: number, free: number, price: number) => Math.max(0, used - free) * price;
  const resources: Resource[] = [
    { name: "requêtes Cloud Run", used: total("requests"), free: FREE_TIER.requests, share: 0, overUsd: over(total("requests"), FREE_TIER.requests, PRICES_USD.perMillionRequests / 1e6) },
    { name: "calcul Cloud Run, vCPU-s (borne haute)", used: vcpu, free: FREE_TIER.vcpuS, share: 0, overUsd: over(vcpu, FREE_TIER.vcpuS, PRICES_USD.perVcpuS) },
    { name: "mémoire Cloud Run, Gio-s (borne haute)", used: vcpu * GIB_PER_INSTANCE, free: FREE_TIER.gibS, share: 0, overUsd: over(vcpu * GIB_PER_INSTANCE, FREE_TIER.gibS, PRICES_USD.perGibS) },
    { name: "lignes lues Turso", used: total("read"), free: FREE_TIER.tursoRead, share: 0, overUsd: null },
    { name: "lignes écrites Turso", used: total("written"), free: FREE_TIER.tursoWritten, share: 0, overUsd: null },
  ].map((r) => ({ ...r, share: r.used / r.free }));
  const worst = resources.reduce((a, b) => (b.share > a.share ? b : a));
  // Tout est proportionnel au nombre de joueurs (à la carte recalculée près, négligeable) : la marge est l'inverse de la part la plus haute.
  return { resources, byGame, firstLimit: worst.share >= 1 ? worst.name : null, headroom: worst.share > 0 ? 1 / worst.share : Number.POSITIVE_INFINITY };
}
