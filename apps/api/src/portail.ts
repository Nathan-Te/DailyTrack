import { formatDay, parseDay } from "@cdj/core";
import { categorieLe, type CategorieJeu } from "@cdj/core/jeux";
import { PREMIER_JOUR_DU_JOUR, numeroDeJournee } from "@cdj/core/lancement";
import { parisDay, parisDayStart } from "@cdj/clock";
import { estNouveau, favorisLe, jeuxDeLaBase, jourDEffet, listeApresChoix, listeDeFavoris, mesJeuxDuJour, type PeriodeFavoris } from "@cdj/core/favoris";
import { WithHeaders } from "./cache";
import { classerEntreAmis, classerLaJournee, ligneDe, placer, rangEntreAmis, type ClassementDuJour, type LigneDuJour, type ResultatJeu } from "./classementDuJour";
import type { AmiLu as AmiPortail, AmisPourPortail } from "./amis";
import type { GroupePourPortail } from "./groupes";
import type { RetoursPourPortail } from "./retours";
import { HttpError } from "./errors";
import type { Diffusion } from "./diffusion";
import type { Jeux } from "./jeux";
import type { ClasseDuJour, EtatPortail, JourPortail, MedaillePortail, Platform, PortailDuJeu, RequestInfo, ScorePortail } from "./games";
import { refOfPlayer } from "./players";

// Le portail « Du Jour » (lot I2 de la plateforme, phase 3) : les lectures regroupées de la page d'accueil et du profil commun. Elles ne
// connaissent aucun jeu : chacun déclare au registre ce que le portail montre de lui (crochet `portail`, `games.ts`). Ajouter le jeu n° 3 ne
// change ni ce fichier ni le portail (test `portail.test.ts`, avec un faux jeu).
//
//   GET /api/portail/jour     les jeux du jour (numéro, thème, seuils), l'heure du serveur et le prochain minuit de Paris ; avec `X-Player-Id`,
//                             l'état du joueur dans chaque jeu, sa série tous jeux confondus et ses journées parfaites. **Une requête** au chargement.
//   GET /api/portail/profil   (`X-Player-Id`) le profil commun : pseudo, série, journées parfaites, et par jeu jours finis, médailles, meilleure place.
//   (lot N2) `jour` porte aussi `nouveaute` (la dernière publiée) et `annonce` (le message en direct) ; `GET /api/portail/nouveautes` et `GET /api/annonce` : `diffusion.ts`.
//   GET /api/portail/classement?date=&vue=cumul|<jeu>   (lot I3, refait au lot A1) le classement du jour **au chrono** : les 50 premiers (pseudo, temps,
//                             pastille de médaille par jeu) de la vue demandée — le cumul des jeux du jour (par défaut) ou un jeu (`vue` = son dossier
//                             sur le site : `track`, `jump`) — et, avec `X-Player-Id`, ta ligne. Jours passés lisibles ; jours futurs refusés (`unknown_day`).
//
// **Lot I3 — la journée partagée** : le numéro de journée commun (`journee` : la journée n° 1 est le lancement public, `config/lancement.json`, lot R8) ; le
// classement du jour (règle : `classementDuJour.ts`, plus de points depuis le lot A1). La route agrège sans connaître les jeux : chacun rend ses classés
// du jour (`portail.classes`). Le classement du jour est **calculé au plus une fois par fenêtre** (`CLASSEMENT_FENETRE_MS`) **et par instance**, jamais à
// chaque requête (une ligne lue par classé et par jeu) ; un jour fermé est figé, gardé plus longtemps. Ta propre ligne est exacte (tes états, lus à
// l'instant) même quand le classement gardé date de quelques secondes.
//
// **Série tous jeux confondus** : le nombre de jours de Paris consécutifs où le joueur a fini (été classé dans) **au moins un** jeu du jour. Si
// aujourd'hui n'est pas encore fini, la série court jusqu'à hier (`aProlonger` : joue aujourd'hui pour la garder). Une série cassée vaut 0.
// **Journée parfaite** : un jour où le joueur a fini **tous les jeux qui existaient ce jour-là** (premier jour de chaque jeu). Les jours sont des
// numéros de jours de Paris (`parisDay`) : un jour de 23 h ou de 25 h (changements d'heure) compte pour un, comme tous les autres.
//
// **Mes jeux (lot F1)** : le joueur épingle des jeux (`PUT /api/portail/favoris`, la liste entière, table `favoris_jeux` : une ligne par changement). La journée parfaite, « n fini sur m »,
// la série et la ligne de partage portent sur **mes jeux** (tous les jeux du jour sans favori). **Un changement compte à partir du lendemain** (`@cdj/core/favoris`) : chaque jour est
// jugé avec la liste qui était la sienne (l'historique est gardé), sauf pour un joueur dont le profil est créé aujourd'hui (son premier choix compte tout de suite). Le classement du jour
// **ne change pas** (il suit les jeux du classement général). `GET /api/portail/jour` porte `joueur.favoris` (la liste choisie, `null` : jamais choisie) et `joueur.jeuxDuJour` (les
// jeux qui comptent pour lui aujourd'hui) ; chaque jeu de la liste porte `nouveau` pendant 7 jours après son ouverture.
//
// **Cache** (règle du lot P4, `cache.ts`) : sans joueur, la réponse est **publique**, gardée au plus `PORTAIL_PUBLIC_MAX_S` et jamais au-delà
// du prochain minuit de Paris ; avec `X-Player-Id`, **jamais publique** (`private, no-cache`). Les deux portent `Vary: X-Player-Id` : un cache
// partagé qui garde la réponse publique ne la sert pas à une requête qui porte un identifiant. Lectures comptées **en mémoire** (aucune écriture,
// sauf les places finales d'un jour fermé du profil commun, calculées une fois).

/** Au plus 60 s de cache pour la réponse publique (et jamais au-delà du prochain minuit de Paris). */
export const PORTAIL_PUBLIC_MAX_S = 60;
/** Lectures du portail par adresse et par fenêtre de débit (10 minutes) : un chargement, le minuit, le profil. */
export const PORTAIL_READS_PER_CLIENT = 120;
/** Lectures du portail par joueur et par fenêtre. */
export const PORTAIL_READS_PER_PLAYER = 60;
/** Lot F1 : écritures de la liste des jeux épinglés par adresse et par joueur et par fenêtre (10 minutes) : un joueur touche quelques étoiles, jamais des dizaines. */
export const FAVORIS_PER_CLIENT = 40;
export const FAVORIS_PER_PLAYER = 20;

// Lot R8 : le premier jour de la journée commune (« Du Jour #1 », le lancement public) n'est plus une constante d'ici : il vient de
// `config/lancement.json` par `@cdj/core` (`PREMIER_JOUR_DU_JOUR`, `numeroDeJournee`). `createPortailRoutes(…, premierJour)` le reçoit (la
// recette peut le déplacer : `LANCEMENT_PREMIER_JOUR`, jamais en production). Avant ce jour : aucun numéro, et le classement du jour refuse
// les jours d'avant (`unknown_day`) : les archives commencent à la journée n° 1.
export { PREMIER_JOUR_DU_JOUR, numeroDeJournee };

/** Lot I3 : le classement du jour en cours est recalculé au plus une fois toutes les 45 s par instance (30 à 60 s : le compromis entre fraîcheur et lignes lues). */
export const CLASSEMENT_FENETRE_MS = 45_000;
/** Lot I3 : un jour fermé est figé ; gardé 10 min en mémoire (l'effacement d'un joueur vide aussi la mémoire de l'instance). */
export const CLASSEMENT_JOUR_FERME_MS = 10 * 60_000;
/** Lot I3 : combien de jours au plus l'instance garde en mémoire. */
export const CLASSEMENT_JOURS_GARDES = 16;
/** Lot I3 : les premiers de la page de classement. */
export const CLASSEMENT_TOP = 50;
/** Lot U1 : le classement du jour entre amis de l'accueil rend les 3 premiers (et ta ligne) ; « tes amis aujourd'hui » en montre 6 au plus. */
export const CLASSEMENT_AMIS_TOP = 3;
export const AMIS_DU_JOUR_MAX = 6;
/** Lot I3 : cache public de la page de classement du jour en cours (au plus, et jamais au-delà de minuit) ; un jour fermé : 24 h comme les autres lectures. */
export const CLASSEMENT_PUBLIC_MAX_S = 30;
export const CLASSEMENT_FERME_MAX_S = 86_400;
/** Lot I3 : la grâce après minuit pendant laquelle la veille accepte encore des temps (la même que `GRACE_MS` de DailyTrack et de DailyJump). */
export const CLASSEMENT_GRACE_MS = 10 * 60_000;

/** Un jeu du registre vu par le portail : son code et son crochet. */
export interface JeuPortail {
  code: string;
  portail: PortailDuJeu;
}

/**
 * Lot F2 : ce que le portail partage avec les classements filtrés « Amis » (`classementAmis.ts`) : le classement du jour gardé par fenêtre, les jeux qui comptent, les états exacts d'un joueur. Les
 * amis se calculent sur **le même classement gardé** que « Tous » : aucune requête par ami.
 */
export interface VuePartagee {
  jeux: readonly JeuPortail[];
  premierJour: number;
  comptes(day: number): JeuPortail[];
  jourOuvert(day: number): boolean;
  estHauteur(j: JeuPortail): boolean;
  /** Lot A3 : le jeu est-il d'arcade ce jour-là ? (Son onglet vient après le séparateur « Arcade ».) */
  estArcade(j: JeuPortail, day: number): boolean;
  classementDe(day: number): Promise<ClassementDuJour>;
  etatsDe(id: string, day: number, ouverts: readonly JeuPortail[], c?: ClassementDuJour): Promise<EtatPortail[]>;
  bilanDe(id: string, etats: readonly EtatPortail[], ouverts: readonly JeuPortail[], toutJeu?: boolean): LigneDuJour | null;
  resultatsCorps(jeuxDuJour: readonly string[], resultats: readonly (ResultatJeu | null)[]): Record<string, unknown>;
  charger(): Promise<void>;
}

/** Un jeu du jour dans la réponse publique. */
export interface JeuDuJour extends JourPortail {
  jeu: string;
  /** Lot I3 : le dossier du jeu sur le site et son nom (« Jeu suivant du jour : Jump » sans connaître le jeu d'avance). */
  site: string;
  nom: string;
  /** Le premier jour du jeu (`AAAA-MM-JJ`). */
  premierJour: string;
  /**
   * Lot P : ce jeu **compte-t-il dans la journée d'aujourd'hui** (journée parfaite, série, ligne de partage, classement du jour) ? Faux le jour même de son activation : il compte à
   * partir du premier jour entier où il est `on`. Il est quand même présent à l'accueil (jouable) ; un client qui compte « combien de jeux finis sur combien » ne compte que ceux-là.
   */
  compte: boolean;
  /** Lot F1 : présent (et vrai) pendant les 7 jours qui suivent l'ouverture du jeu (`estNouveau`) : la pastille « Nouveau » de l'accueil. Absent pour un jeu d'avant l'interrupteur. */
  nouveau?: true;
  /** Lot P : présent (et vrai) seulement sur un aperçu de PR, pour un jeu qui n'est pas encore `on` : le portail le montre avec le badge « Brouillon ». */
  brouillon?: true;
}

/** Série et journées parfaites (voir l'en-tête du fichier). */
export interface Serie {
  serie: number;
  aProlonger: boolean;
  journeesParfaites: number;
  aujourdhuiParfaite: boolean;
}

/**
 * La série tous jeux confondus et les journées parfaites, à partir des jours finis de chaque jeu (numéros de jours de Paris). Pure (testée sur
 * les changements d'heure : un numéro de jour est un jour, quelle que soit sa durée).
 */
type JeuxFinis = readonly { premierJour: number; finis: ReadonlySet<number>; compte?: (jour: number) => boolean }[];

/** Un jour est-il « fini » (au moins un jeu qui compte ce jour-là) ou « parfait » (tous les jeux qui comptent ce jour-là) ? Lot P : un jeu ne compte dans une journée que les jours où l'interrupteur le compte. */
function jugerLesJours(jeux: JeuxFinis) {
  // Lot P : un jeu ne compte dans une journée que les jours où l'interrupteur le compte (`compte` : à partir du premier jour entier où il est `on`, plus après sa désactivation) ;
  // un résultat d'un jour où il ne compte pas n'est ni un jour fini ni une journée parfaite. Sans `compte`, il compte dès son premier jour.
  const compte = (j: (typeof jeux)[number], d: number) => j.premierJour <= d && (j.compte ? j.compte(d) : true);
  const fini = (d: number) => jeux.some((j) => compte(j, d) && j.finis.has(d));
  const parfaite = (d: number) => {
    const existants = jeux.filter((j) => compte(j, d));
    return existants.length > 0 && existants.every((j) => j.finis.has(d));
  };
  return { compte, fini, parfaite };
}

/** Lot U1 : un jour de la semaine en lampes de l'accueil. */
export interface JourDeSemaine {
  /** AAAA-MM-JJ. */
  date: string;
  /** `parfaite` : tous les jeux de la journée finis ; `jouee` : au moins un ; `rien` : aucun (et tout jour à venir). */
  etat: "parfaite" | "jouee" | "rien";
}

/**
 * Lot U1 — la semaine en lampes : les 7 jours de la semaine de Paris qui contient `today`, du lundi au dimanche, chacun « parfaite », « jouée » ou « rien » (un jour à venir est « rien »). Pure ; les mêmes jours finis
 * et la même règle de journée parfaite que la série (un numéro de jour est un jour, quelle qu'en soit la durée : testé sur les changements d'heure).
 */
export function semaineDe(today: number, jeux: JeuxFinis): JourDeSemaine[] {
  const { fini, parfaite } = jugerLesJours(jeux);
  const jourDeSemaine = (((today + 4) % 7) + 7) % 7; // 1970-01-01 était un jeudi ; 0 = dimanche
  const lundi = today - ((jourDeSemaine + 6) % 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = lundi + i;
    return { date: formatDay(d), etat: d > today || !fini(d) ? ("rien" as const) : parfaite(d) ? ("parfaite" as const) : ("jouee" as const) };
  });
}

export function serieEtParfaites(today: number, jeux: JeuxFinis): Serie {
  const { compte, fini, parfaite } = jugerLesJours(jeux);
  const finiAujourdhui = fini(today);
  let serie = 0;
  for (let d = finiAujourdhui ? today : today - 1; fini(d); d--) serie++;
  const jours = new Set<number>();
  for (const j of jeux) for (const d of j.finis) if (d <= today && compte(j, d)) jours.add(d);
  let journeesParfaites = 0;
  for (const d of jours) if (parfaite(d)) journeesParfaites++;
  return { serie, aProlonger: !finiAujourdhui && serie > 0, journeesParfaites, aujourdhuiParfaite: parfaite(today) };
}

export function createPortailRoutes(platform: Platform, jeux: readonly JeuPortail[], premierJour: number = PREMIER_JOUR_DU_JOUR, diffusion?: Diffusion, etats?: Jeux, amis?: AmisPourPortail, retours?: RetoursPourPortail, groupes?: GroupePourPortail) {
  const { now, log, today, players, hashKey, readHit, playerIdOf } = platform;

  // --- Lot P : l'interrupteur des jeux ---------------------------------------------------------------------------------------------
  // Deux questions distinctes : un jeu est-il **présent** à l'accueil (état `on`) et **compte-t-il** dans la journée à ce jour (`compteLe`, les périodes de `jeux.ts`) ? Sans interrupteur
  // (outils, tests anciens), tout jeu est présent et compte dès son premier jour.
  const surLeSite = (j: JeuPortail): boolean => (etats ? etats.etat(j.portail.site) === "on" : true);
  const compte = (j: JeuPortail, day: number): boolean => j.portail.premierJour <= day && (etats ? etats.compteLe(j.portail.site, day) : true);
  /** Les jeux qui comptent ce jour-là : ceux du cumul, du classement du jour, de la journée parfaite. */
  const comptes = (day: number): JeuPortail[] => jeux.filter((j) => compte(j, day));
  // Lot A3 : la catégorie. Un jeu d'arcade a son niveau du jour et son classement (il reste dans `comptes`, donc dans les vues du classement) mais **ne compte pas dans la journée** : ni journée
  // parfaite, ni « n fini sur m », ni série, ni ligne de partage — qu'il soit épinglé ou non. La catégorie se lit ce jour-là (`categorieLe`) : un changement compte à partir du lendemain.
  const categorieDe = (j: JeuPortail, day: number): CategorieJeu => categorieLe(j.portail.categorie ?? "jour", j.portail.categorieDepuis, day);
  /** Le jeu compte-t-il dans la journée (série, journée parfaite, partage) ce jour-là ? L'interrupteur (`compte`) ET la catégorie `jour`. */
  const compteJournee = (j: JeuPortail, day: number): boolean => compte(j, day) && categorieDe(j, day) === "jour";
  const estArcade = (j: JeuPortail, day: number): boolean => categorieDe(j, day) === "arcade";
  const comptesJournee = (day: number): JeuPortail[] => jeux.filter((j) => compteJournee(j, day));
  /** Lot TP : un jeu classé à la hauteur (Tower) a sa vue ; il n'entre jamais dans le cumul au temps. */
  const estHauteur = (j: JeuPortail): boolean => j.portail.classement === "hauteur";
  /** Un jeu au temps que la fiche tient hors du cumul (`classement.cumul: false`, Rush en arcade) : sa vue existe (`parJeu`), mais ni le cumul, ni « tout fini » ne le comptent. */
  const horsCumul = (j: JeuPortail): boolean => j.portail.cumul === false;
  const charger = async (): Promise<void> => {
    await etats?.charger();
  };

  /** L'identifiant de l'en-tête `X-Player-Id` (jamais dans l'adresse), ou `null` sans en-tête. */
  function joueurDe(req: Request): string | null {
    const raw = req.headers.get("x-player-id");
    return raw === null || raw === "" ? null : playerIdOf(raw);
  }

  async function limiter(info: RequestInfo, id: string | null): Promise<void> {
    await platform.readHitAddress(info, "ptl", PORTAIL_READS_PER_CLIENT);
    if (id) readHit(await hashKey("ptlp", id), PORTAIL_READS_PER_PLAYER);
  }

  /**
   * Les jeux que l'accueil montre ce jour-là : ceux qui sont `on` (lot P) et qui existent. `toutVoir` (aperçu de PR) montre aussi les jeux `off` et `preview`, marqués `brouillon`.
   * Un jeu dont le niveau du jour est indisponible garde son numéro, sans thème ni seuils (rien de bloquant).
   */
  async function jeuxDuJour(day: number, toutVoir = false): Promise<JeuDuJour[]> {
    const ouverts = jeux.filter((j) => j.portail.premierJour <= day && (toutVoir || surLeSite(j)));
    return Promise.all(
      ouverts.map(async (j) => {
        let jour: JourPortail;
        try {
          jour = await j.portail.jour(day);
        } catch (e) {
          log("WARNING", "portail : jour d'un jeu indisponible", { jeu: j.code, error: e instanceof HttpError ? e.code : "inconnue" });
          jour = { numero: day - j.portail.premierJour + 1, theme: null, seuils: null };
        }
        return { jeu: j.code, site: j.portail.site, nom: j.portail.nom, premierJour: formatDay(j.portail.premierJour), compte: compteJournee(j, day), ...(estArcade(j, day) ? { categorie: "arcade" as const } : {}), ...(estNouveau(etats?.liveFrom(j.portail.site) ?? null, day) ? { nouveau: true as const } : {}), ...(surLeSite(j) ? {} : { brouillon: true as const }), ...jour };
      }),
    );
  }

  /** La partie publique : les jeux du jour, l'heure du serveur, le prochain minuit de Paris (ISO, UTC). */
  async function partiePublique(day: number, toutVoir = false) {
    const t = now();
    return {
      date: formatDay(day),
      journee: numeroDeJournee(day, premierJour),
      /** Lot R8 : le jour de la journée n° 1 (AAAA-MM-JJ) : la source unique, vérifiée par le workflow de remise à zéro de la production. */
      lancement: formatDay(premierJour),
      /** Lot R8 : la génération de données (remise à zéro du lancement) : un navigateur qui en garde une plus ancienne efface ses données de jeu. */
      generation: await platform.generation(),
      maintenant: new Date(t).toISOString(),
      prochainJour: new Date(parisDayStart(day + 1)).toISOString(),
      jeux: await jeuxDuJour(day, toutVoir),
      // Lot N2 : la dernière nouveauté publiée (la ligne de l'accueil) et le message en direct : **dans la même réponse** (la règle du lot I3 : une seule requête au chargement).
      ...(diffusion ? await diffusion.pourLAccueil() : { nouveaute: null, annonce: null }),
    };
  }

  // --- Lot F1 : Mes jeux ------------------------------------------------------------------------------------------------------------
  /** L'historique des jeux épinglés d'un joueur (une requête sur la clé : une ligne par changement), du plus ancien au plus récent. Aucune ligne : il n'a jamais rien choisi. */
  async function favorisDe(id: string): Promise<PeriodeFavoris[]> {
    const rows = await platform.db.all<{ du: number; jeux: string }>("SELECT du, jeux FROM favoris_jeux WHERE player_id = ? ORDER BY du", [id]);
    return rows.map((r) => [r.du, jeuxDeLaBase(r.jeux)] as const);
  }
  /** Les jeux de la journée de ce joueur ce jour-là (les `JeuPortail`) : ses favoris parmi les jeux qui comptent, sinon tous ceux qui comptent. */
  const jeuxDe = (periodes: readonly PeriodeFavoris[], day: number): JeuPortail[] => {
    const comptent = comptesJournee(day);
    const choisis = new Set(mesJeuxDuJour(comptent.map((j) => j.portail.site), favorisLe(periodes, day)));
    return comptent.filter((j) => choisis.has(j.portail.site));
  };

  /** Les jours finis de chaque jeu pour ce joueur (un parcours d'index par jeu) et la règle qui dit si le jeu compte ce jour-là pour lui. */
  async function finisDe(id: string, periodes?: readonly PeriodeFavoris[]) {
    const mes = periodes ?? (await favorisDe(id));
    // Chaque jour est jugé avec la liste qui était la sienne : un jeu compte ce jour-là s'il compte pour la plateforme ET s'il est dans les jeux du joueur.
    const dansMesJeux = (j: JeuPortail, d: number) => mes.length === 0 || jeuxDe(mes, d).includes(j);
    return Promise.all(jeux.map(async (j) => ({ premierJour: j.portail.premierJour, finis: new Set(await j.portail.joursFinis(id)), compte: (d: number) => compteJournee(j, d) && dansMesJeux(j, d) })));
  }
  async function serieDe(id: string, day: number, periodes?: readonly PeriodeFavoris[]): Promise<Serie> {
    return serieEtParfaites(day, await finisDe(id, periodes));
  }

  /** Ce que le portail sait des jeux épinglés d'un joueur : sa liste (`null` : jamais choisie) et les jeux qui comptent pour lui aujourd'hui (les jeux visibles, dans l'ordre de la plateforme). */
  function etatFavoris(periodes: readonly PeriodeFavoris[], day: number, visibles: (j: JeuPortail) => boolean) {
    return { favoris: periodes.length > 0 ? [...periodes[periodes.length - 1]![1]] : null, jeuxDuJour: jeuxDe(periodes, day).filter(visibles).map((j) => j.portail.site) };
  }

  /**
   * Le joueur doit exister (un résultat classé dans un jeu) et son code être valide ; sinon le refus porte quand même la partie publique (`jour`)
   * : le portail n'a qu'une requête au chargement, il affiche le jour même pour un joueur que le serveur ne connaît pas.
   */
  async function joueurConnu(id: string, publique?: Record<string, unknown>): Promise<{ name: string; rename_required: number; avatar: string | null }> {
    try {
      await players.assertActive(id);
    } catch (e) {
      if (e instanceof HttpError && e.code === "code_revoked" && publique) throw new HttpError(410, "code_revoked", e.message, {}, publique);
      throw e;
    }
    const row = await players.find(id);
    if (!row) throw new HttpError(404, "unknown_player", "Ce profil n'existe pas sur le serveur : joue une partie pour l'ouvrir", {}, publique ?? {});
    return row;
  }

  // --- Lot I3, refait au lot A1 : le classement du jour au chrono ---------------------------------------------------------------
  /** Le jour accepte-t-il encore des temps (aujourd'hui, ou hier pendant la grâce) ? Sinon son classement est figé. */
  const jourOuvert = (day: number): boolean => day >= today() || (day === today() - 1 && platform.sinceMidnight() < CLASSEMENT_GRACE_MS);

  /** Une entrée gardée : le classement, et les pseudos du haut de chaque vue (lus au premier besoin, gardés avec lui : la page ne relit rien tant que la fenêtre dure). */
  interface Gardee {
    at: number;
    pending: Promise<ClassementDuJour>;
    noms: Map<string, Promise<Map<string, { name: string; ref: string; avatar: string | null }>>>;
    /** Lot « manques de Blocks » : le calcul est fini et n'a trouvé aucun classé (dans aucune vue). Un classement vide d'un jour ouvert n'est pas gardé : il ne coûte aucune ligne à refaire. */
    vide?: boolean;
  }
  const classements = new Map<number, Gardee>();
  let calculs = 0;

  /**
   * Le classement du jour, calculé **au plus une fois par fenêtre et par instance** (un seul calcul même si deux requêtes arrivent ensemble) : une
   * ligne lue par classé et par jeu. Un jour fermé est figé : gardé `CLASSEMENT_JOUR_FERME_MS`.
   */
  function gardeeDe(day: number): Gardee {
    const kept = classements.get(day);
    const duree = jourOuvert(day) ? CLASSEMENT_FENETRE_MS : CLASSEMENT_JOUR_FERME_MS;
    // Lot « manques de Blocks » : un classement **vide** d'un jour ouvert n'est pas gardé — sinon la première lecture (avant que personne ait joué) figeait le portail 45 s, et le premier classé n'apparaissait qu'à la fenêtre suivante. Le refaire ne lit aucune ligne.
    if (kept && now() - kept.at < duree && !(kept.vide && jourOuvert(day))) return kept;
    calculs++;
    const ouverts = comptes(day);
    // Lot TP : le cumul au temps ne lit que les jeux au temps ; un jeu classé à la hauteur rend ses classés à part (sa vue).
    const pending = Promise.all(ouverts.map(async (j) => ({ jeu: j.code, hauteur: estHauteur(j), horsCumul: horsCumul(j), classes: await j.portail.classes(day) }))).then((tous) => {
      const c = classerLaJournee(tous.filter((t) => !t.hauteur));
      const hauteurs = tous.filter((t) => t.hauteur);
      if (hauteurs.length > 0) c.hauteurs = hauteurs.map((t) => ({ jeu: t.jeu, classes: t.classes, index: new Map(t.classes.map((x, i) => [x.playerId, i] as const)) }));
      return c;
    });
    if (classements.size >= CLASSEMENT_JOURS_GARDES) for (const [d] of classements) if (d !== day) { classements.delete(d); break; }
    const neuve: Gardee = { at: now(), pending, noms: new Map() };
    classements.set(day, neuve);
    void pending.then((c) => {
      neuve.vide = c.cumul.length === 0 && (c.hauteurs ?? []).every((h) => h.classes.length === 0) && c.parJeu.every((l) => l.length === 0);
    }, () => undefined);
    // Un calcul qui échoue n'est pas gardé : la requête suivante réessaie.
    pending.catch(() => {
      if (classements.get(day) === neuve) classements.delete(day);
    });
    return neuve;
  }
  const classementDe = (day: number): Promise<ClassementDuJour> => gardeeDe(day).pending;

  /** Ce que le joueur a fait ce jour-là, à partir de ses états exacts dans chaque jeu du jour (`null` : rien fini). Son `at` ne sert à rien (`placer` le fait passer après les égaux). */
  function bilanDe(id: string, etats: readonly EtatPortail[], ouverts: readonly JeuPortail[], toutJeu = false): LigneDuJour | null {
    // Lot TP : seuls les jeux au temps entrent dans le cumul.
    const auTemps = ouverts.filter((j) => !estHauteur(j));
    const resultats = etats
      .filter((_, i) => !estHauteur(ouverts[i]!))
      .map<ResultatJeu | null>((e) => (e.statut === "fini" ? { rang: e.rang, tempsMs: e.tempsMs, medaille: e.medaille, at: 0 } : null));
    const hors = auTemps.map(horsCumul);
    // Un joueur qui n'a fini que des jeux hors cumul n'a pas de bilan au cumul (pas de rang) ; `toutJeu` : la vue d'**un** jeu, qui lit sa ligne même si ce jeu est hors cumul.
    return resultats.some((r, g) => r !== null && (toutJeu || !hors[g])) ? ligneDe(id, resultats, hors) : null;
  }

  /**
   * Les états d'un joueur dans chaque jeu du jour. Lot I3 : avec le classement du jour gardé (`c`), un jeu déjà fini par ce joueur dans ce classement donne sa
   * place et ses classés sans les recompter (le coût d'une visite ne croît plus avec le nombre de joueurs) ; absent du classement (il vient de finir) : le jeu compte.
   */
  const etatsDe = (id: string, day: number, ouverts: readonly JeuPortail[], c?: ClassementDuJour) => {
    const ligne = c?.lignes.get(id) ?? null;
    return Promise.all(
      ouverts.map((j) => {
        // Lot TP : un jeu à la hauteur prend sa place dans la liste gardée de sa vue ; un jeu au temps, dans le cumul gardé (par son code : `jeux` du classement ne compte que les jeux au temps).
        if (estHauteur(j)) {
          const h = c?.hauteurs?.find((x) => x.jeu === j.code);
          const i = h?.index.get(id);
          return j.portail.etat(id, day, h && i !== undefined ? { rang: i + 1, classes: h.classes.length } : undefined);
        }
        const g = c ? c.jeux.indexOf(j.code) : -1;
        return j.portail.etat(id, day, ligne && g >= 0 && ligne.resultats[g] ? { rang: ligne.resultats[g]!.rang, classes: c!.classesParJeu[g]! } : undefined);
      }),
    );
  };

  /** `{ jeu: { rang, tempsMs, medaille } | null }` : le résultat de chaque jeu du jour (`null` : pas fini). Jamais un identifiant. */
  const resultatsCorps = (jeuxDuJour: readonly string[], resultats: readonly (ResultatJeu | null)[]) =>
    Object.fromEntries(jeuxDuJour.map((code, g) => [code, resultats[g] ? { rang: resultats[g]!.rang, tempsMs: resultats[g]!.tempsMs, medaille: resultats[g]!.medaille } : null]));

  /**
   * Lot U1 — la colonne de droite de l'accueil, **dans la même réponse** (une seule requête au chargement) : le classement du jour entre amis (les 3 premiers et ta ligne), « tes amis aujourd'hui » (6 au plus) et
   * le résumé de ton groupe. Tout vient du classement gardé et de la liste des amis : aucune requête par ami ; le groupe ne coûte que trois lectures indexées (et son rang du jour est celui que la page des groupes garde).
   */
  async function colonneDeDroite(id: string, row: { name: string; avatar: string | null }, day: number, c: ClassementDuJour, bilan: LigneDuJour | null, listeAmis: readonly AmiPortail[], presents: readonly string[]) {
    const duJour = comptesJournee(day).filter((j) => presents.includes(j.code));
    const sites = duJour.map((j) => c.jeux.indexOf(j.code));
    /** Les jeux de la journée que cette ligne a finis, et l'instant du dernier. */
    const faitsDe = (l: LigneDuJour | null | undefined) => {
      const faits = duJour.flatMap((j, i) => (l && sites[i]! >= 0 && l.resultats[sites[i]!] ? [{ site: j.portail.site, at: l.resultats[sites[i]!]!.at }] : []));
      return { faits, dernier: faits.reduce<{ site: string; at: number } | null>((m, f) => (!m || f.at > m.at ? f : m), null) };
    };
    let classementAmis: unknown = null;
    if (listeAmis.length > 0) {
      const qui = new Map(listeAmis.map((a) => [a.id, a] as const));
      const ordre = classerEntreAmis(c, id, bilan, listeAmis.map((a) => a.id));
      const maRef = await refOfPlayer(id);
      const corps = (x: { id: string; rang: number | null; ligne: LigneDuJour | null }) => {
        const a = x.id === id ? { name: row.name, ref: maRef, avatar: row.avatar } : qui.get(x.id)!;
        return { rang: x.rang, pseudo: a.name, ref: a.ref, ...(a.avatar ? { avatar: a.avatar } : {}), tempsMs: x.ligne?.complet ? x.ligne.cumulMs : null, faits: faitsDe(x.ligne).faits.length, ...(x.id === id ? { moi: true as const } : {}) };
      };
      classementAmis = { sur: ordre.length, top: ordre.filter((x) => x.rang !== null).slice(0, CLASSEMENT_AMIS_TOP).map(corps), moi: corps(ordre.find((x) => x.id === id)!) };
    }
    // Tes amis aujourd'hui : ceux qui ont joué d'abord (le plus récent en tête), puis les autres dans l'ordre du pseudo.
    const amisDuJour = listeAmis
      .map((a, i) => ({ a, i, ...faitsDe(c.lignes.get(a.id)) }))
      .sort((x, y) => (y.dernier?.at ?? -1) - (x.dernier?.at ?? -1) || x.i - y.i)
      .slice(0, AMIS_DU_JOUR_MAX)
      .map(({ a, faits, dernier }) => ({ pseudo: a.name, ref: a.ref, ...(a.avatar ? { avatar: a.avatar } : {}), faits: faits.map((f) => f.site), parfaite: duJour.length > 0 && faits.length === duJour.length, ...(dernier ? { dernier } : {}) }));
    const groupe = groupes ? await groupes.resume(id, day) : null;
    return { classementAmis, amisDuJour, nbAmis: listeAmis.length, groupe };
  }

  async function jour(req: Request, info: RequestInfo): Promise<WithHeaders> {
    const id = joueurDe(req);
    await limiter(info, id);
    await charger();
    const day = today();
    // Lot P : un aperçu de PR (recette seulement) voit aussi les jeux qui ne sont pas encore `on`, marqués « Brouillon » ; sa réponse n'est jamais gardée par un cache partagé.
    const toutVoir = etats?.apercuDePr(req) ?? false;
    const publique = await partiePublique(day, toutVoir);
    if (!id) {
      // Publique : au plus 60 s, jamais au-delà du prochain minuit de Paris (le jour suivant n'est pas servi d'avance, l'ancien pas après).
      const restant = Math.floor((parisDayStart(day + 1) - now()) / 1000);
      const maxAge = Math.max(0, Math.min(PORTAIL_PUBLIC_MAX_S, restant));
      return new WithHeaders(publique, { "Cache-Control": toutVoir ? "no-store" : `public, max-age=${maxAge}`, Vary: "X-Player-Id" });
    }
    const row = await joueurConnu(id, publique);
    const ouverts = comptes(day);
    // Lot I3 : le classement du jour gardé (calculé au plus une fois par fenêtre et par instance : jamais à chaque visite) donne sa place et ses classés ;
    // son cumul est exact (ses états à l'instant). Aucun jeu fini aujourd'hui : pas de rang.
    const c = await classementDe(day);
    const periodes = await favorisDe(id);
    const [etatsJoueur, finis] = await Promise.all([etatsDe(id, day, ouverts, c), finisDe(id, periodes)]);
    const serie = serieEtParfaites(day, finis);
    const etatDe = new Map<string, EtatPortail>(ouverts.map((j, i) => [j.code, etatsJoueur[i]!] as const));
    // Un jeu présent à l'accueil mais qui ne compte pas encore (activé aujourd'hui) a quand même son état : le joueur peut y jouer.
    await Promise.all(
      jeux.filter((j) => !etatDe.has(j.code) && publique.jeux.some((p) => p.jeu === j.code)).map(async (j) => etatDe.set(j.code, await j.portail.etat(id, day))),
    );
    let cumulMs: number | null = null;
    let rangDuJour: number | null = null;
    let classesDuJour: number | null = null;
    let entreAmis: { rang: number; sur: number } | null = null;
    const bilan = bilanDe(id, etatsJoueur, ouverts);
    // Lot U1 : tes amis (une lecture indexée) — « 3e entre amis », le classement du jour entre amis, « tes amis aujourd'hui » : tout se lit dans le classement gardé, aucune requête par ami.
    const listeAmis = amis ? await amis.liste(id) : [];
    // Lot C1 : les réponses de l'éditeur qui attendent (« Mes messages »), une lecture indexée — la pastille de l'avatar, sans requête de plus.
    const messagesNonLus = retours ? await retours.nonLus(id) : 0;
    if (bilan) {
      cumulMs = bilan.cumulMs;
      ({ rang: rangDuJour, classes: classesDuJour } = placer(c, bilan));
      // Lot F2 : « 3e entre amis » — une seule lecture (la liste des amis, indexée) et le classement gardé ; rien tant que le joueur n'a rien fini.
      if (listeAmis.length > 0) entreAmis = rangEntreAmis(c, bilan, listeAmis.map((a) => a.id));
    }
    const colonne = await colonneDeDroite(id, row, day, c, bilan, listeAmis, publique.jeux.map((p) => p.jeu));
    const body = {
      ...publique,
      jeux: publique.jeux.map((j) => ({ ...j, etat: etatDe.get(j.jeu) ?? { statut: "pas_joue" } })),
      joueur: { pseudo: row.name, ...(row.avatar ? { avatar: row.avatar } : {}), ...serie, cumulMs, rangDuJour, classesDuJour, rangEntreAmis: entreAmis, messagesNonLus, semaine: semaineDe(day, finis), ...colonne, ...etatFavoris(periodes, day, (j) => toutVoir || surLeSite(j)) },
    };
    return new WithHeaders(body, { "Cache-Control": "private, no-cache", Vary: "X-Player-Id" });
  }

  /** Les pseudos et références publiques des joueurs (une requête, jamais l'identifiant dans la réponse). Lot F2 : `ref` = `players.ref`, de quoi ajouter un joueur en ami depuis le classement. */
  async function pseudosDe(ids: readonly string[]): Promise<Map<string, { name: string; ref: string; avatar: string | null }>> {
    if (ids.length === 0) return new Map();
    const rows = await platform.db.all<{ id: string; name: string; ref: string | null; avatar: string | null }>(`SELECT id, name, ref, avatar FROM players WHERE id IN (${ids.map(() => "?").join(",")})`, [...ids]);
    return new Map(await Promise.all(rows.map(async (r) => [r.id, { name: r.name, ref: r.ref ?? (await refOfPlayer(r.id)), avatar: r.avatar }] as const)));
  }

  /** `GET /api/portail/classement?date=&vue=` : les 50 premiers de la vue (le cumul, ou un jeu) et, avec `X-Player-Id`, ta ligne (exacte). */
  async function classement(req: Request, url: URL, info: RequestInfo): Promise<WithHeaders> {
    const id = joueurDe(req);
    await limiter(info, id);
    await charger();
    const aujourdhui = today();
    const brut = url.searchParams.get("date");
    const day = brut === null ? aujourdhui : parseDay(brut);
    if (day === null) throw new HttpError(400, "invalid_date", "Date attendue au format AAAA-MM-JJ");
    const ouverts = comptes(day);
    // Lot R8 : depuis le lancement, les jours d'avant la journée n° 1 ne sont plus lisibles ; avant lui, rien n'est refusé (période d'essai).
    const avantLancement = premierJour <= aujourdhui && day < premierJour;
    if (day > aujourdhui || avantLancement || ouverts.length === 0) throw new HttpError(404, "unknown_day", "Ce classement n'existe pas (encore)");
    // Lot A1 : la vue — le cumul (par défaut) ou un jeu qui existe ce jour-là, nommé par son dossier sur le site.
    // Lot TP : un jeu classé à la hauteur a sa vue (`hauteurs`), un jeu au temps la sienne (`parJeu`) ; le cumul ne compte que les jeux au temps.
    const vue = url.searchParams.get("vue") ?? "cumul";
    const jeuVue = vue === "cumul" ? undefined : ouverts.find((j) => j.portail.site === vue);
    if (vue !== "cumul" && !jeuVue) throw new HttpError(400, "invalid_view", "Vue attendue : cumul ou le dossier d'un jeu de ce jour");
    const gardee = gardeeDe(day);
    const c = await gardee.pending;
    const hauteur = jeuVue && estHauteur(jeuVue) ? c.hauteurs?.find((h) => h.jeu === jeuVue.code) : undefined;
    const g = vue === "cumul" || hauteur ? -1 : c.jeux.indexOf(jeuVue!.code);
    // Les ids du haut de la vue : une ligne de classement au temps, ou un classé à la hauteur.
    const liste = hauteur ? hauteur.classes : g < 0 ? c.cumul : c.parJeu[g]!;
    const gardes = liste.slice(0, CLASSEMENT_TOP);
    const idDe = (x: LigneDuJour | ClasseDuJour): string => ("playerId" in x ? x.playerId : x.id);
    // Les pseudos du haut de la vue sont lus une fois avec le classement (un changement de pseudo se voit à la fenêtre suivante, 45 s au plus).
    let nomsVue = gardee.noms.get(vue);
    if (!nomsVue) {
      nomsVue = pseudosDe(gardes.map(idDe)).catch((e) => {
        gardee.noms.delete(vue);
        throw e;
      });
      gardee.noms.set(vue, nomsVue);
    }
    const noms = await nomsVue;
    /** Une ligne : le temps de la vue (le cumul, ou le temps du jeu), si le joueur a tout fini (`complet` : toujours vrai dans la vue d'un jeu), et le résultat de chaque jeu. */
    const ligneCorps = (l: LigneDuJour, rang: number, pseudo: string, ref?: string, avatar?: string | null) => ({
      rang,
      pseudo,
      ...(ref ? { ref } : {}),
      ...(avatar ? { avatar } : {}), // lot C1 : l'empreinte de son image (l'adresse immuable `/api/avatars/<empreinte>`) ; absente : ses initiales
      tempsMs: g < 0 ? l.cumulMs : l.resultats[g]!.tempsMs,
      complet: g < 0 ? l.complet : true,
      resultats: resultatsCorps(c.jeux, l.resultats),
    });
    /** Lot TP : une ligne de la vue d'un jeu à la hauteur — son score (hauteur et vies) à côté de la durée de la partie. */
    const ligneHauteur = (x: { tempsMs: number; medaille: MedaillePortail | null; score?: ScorePortail }, rang: number, pseudo: string, ref?: string, avatar?: string | null) => ({
      rang,
      pseudo,
      ...(ref ? { ref } : {}),
      ...(avatar ? { avatar } : {}),
      tempsMs: x.tempsMs,
      complet: true,
      score: x.score ?? null,
      resultats: { [jeuVue!.code]: { rang, tempsMs: x.tempsMs, medaille: x.medaille, score: x.score ?? null } },
    });
    const ouvert = jourOuvert(day);
    const publique = {
      date: formatDay(day),
      journee: numeroDeJournee(day, premierJour),
      ouvert,
      vue,
      jeux: ouverts.map((j) => ({ jeu: j.code, site: j.portail.site, nom: j.portail.nom, ...(estHauteur(j) ? { unite: j.portail.unite ?? ("mm" as const) } : {}), ...(estArcade(j, day) ? { categorie: "arcade" as const } : {}) })),
      classes: liste.length,
      top: hauteur ? hauteur.classes.slice(0, CLASSEMENT_TOP).map((x, i) => ligneHauteur(x, i + 1, noms.get(x.playerId)?.name ?? "?", noms.get(x.playerId)?.ref, noms.get(x.playerId)?.avatar)) : (gardes as LigneDuJour[]).map((l, i) => ligneCorps(l, i + 1, noms.get(l.id)?.name ?? "?", noms.get(l.id)?.ref, noms.get(l.id)?.avatar)),
      ...(hauteur ? { unite: jeuVue!.portail.unite ?? ("mm" as const) } : {}),
    };
    if (!id) {
      const restant = Math.floor((parisDayStart(aujourdhui + 1) - now()) / 1000);
      const maxAge = ouvert ? Math.max(0, Math.min(CLASSEMENT_PUBLIC_MAX_S, restant)) : CLASSEMENT_FERME_MAX_S;
      return new WithHeaders(publique, { "Cache-Control": `public, max-age=${maxAge}`, Vary: "X-Player-Id" });
    }
    const row = await joueurConnu(id, publique);
    const maRef = await refOfPlayer(id); // lot F2 : sa propre référence publique, comme les autres lignes
    // Ses états à l'instant (une ligne par jeu avec le classement gardé : rien à compter) donnent sa ligne exacte et sa place, même juste après son essai.
    const etatsMoi = await etatsDe(id, day, ouverts, c);
    let moi: Record<string, unknown> | null = null;
    if (hauteur) {
      const e = etatsMoi[ouverts.indexOf(jeuVue!)]!;
      if (e.statut === "fini") moi = { ...ligneHauteur(e, e.rang, row.name, maRef, row.avatar), classes: Math.max(hauteur.classes.length + (hauteur.index.has(id) ? 0 : 1), e.rang) };
    } else {
      const bilan = bilanDe(id, etatsMoi, ouverts, g >= 0);
      if (bilan && (g < 0 || bilan.resultats[g])) {
        const place = g < 0 ? placer(c, bilan) : { rang: bilan.resultats[g]!.rang, classes: Math.max(liste.length + (c.lignes.get(id)?.resultats[g] ? 0 : 1), bilan.resultats[g]!.rang) };
        moi = { ...ligneCorps(bilan, place.rang, row.name, maRef, row.avatar), classes: place.classes };
      }
    }
    const body = { ...publique, top: publique.top.map((r, i) => (idDe(gardes[i]!) === id ? { ...r, moi: true } : r)), moi };
    return new WithHeaders(body, { "Cache-Control": "private, no-cache", Vary: "X-Player-Id" });
  }

  /**
   * `PUT /api/portail/favoris` (lot F1) : la liste entière des jeux épinglés (`{ favoris: ["track", …] }`), pour un joueur connu. Un jeu qui n'est pas ouvert (`on`) ne s'épingle pas
   * (écarté ; celui qui l'était déjà reste dans la liste : il revient avec le jeu). Le choix compte **à partir de demain**, sauf pour un profil créé aujourd'hui (`jourDEffet`). Un choix qui
   * rend la liste déjà en vigueur la veille n'écrit rien de plus qu'un effacement (basculer une étoile puis la remettre ne laisse aucune ligne). Réponse : ce que le portail a besoin de redessiner.
   */
  async function ecrireFavoris(req: Request, info: RequestInfo): Promise<WithHeaders> {
    const id = joueurDe(req);
    if (!id) throw new HttpError(400, "invalid_player", "Identifiant de joueur manquant (en-tête X-Player-Id)");
    await platform.hitAddress(info, "pfv", FAVORIS_PER_CLIENT);
    await platform.hit(await hashKey("pfvp", id), FAVORIS_PER_PLAYER);
    const corps = await platform.readJson(req);
    const demandes = listeDeFavoris(corps.favoris);
    const connus = new Set(jeux.map((j) => j.portail.site));
    if (!demandes || demandes.some((j) => !connus.has(j))) throw new HttpError(400, "invalid_json", "Liste de jeux illisible ou jeu inconnu");
    await charger();
    await joueurConnu(id);
    const toutVoir = etats?.apercuDePr(req) ?? false;
    const visible = (j: JeuPortail) => toutVoir || surLeSite(j);
    const jour = today();
    const [periodes, ligne] = await Promise.all([favorisDe(id), platform.db.first<{ created_at: number }>("SELECT created_at FROM players WHERE id = ?", [id])]);
    const actuels = periodes.length > 0 ? periodes[periodes.length - 1]![1] : [];
    const liste = listeApresChoix(demandes, actuels, new Set(jeux.filter(visible).map((j) => j.portail.site)));
    const du = jourDEffet(jour, ligne ? parisDay(ligne.created_at) === jour : false);
    // La liste en vigueur juste avant ce jour-là (sans la ligne qu'on va écrire) : si le choix la rétablit, la ligne en attente disparaît.
    const sans = periodes.filter(([d]) => d !== du);
    const avant = favorisLe(sans, du) ?? [];
    const identique = avant.length === liste.length && liste.every((j) => avant.includes(j));
    const ecriture = identique
      ? { sql: "DELETE FROM favoris_jeux WHERE player_id = ? AND du = ?", params: [id, du] }
      : { sql: "INSERT INTO favoris_jeux (player_id, du, jeux) VALUES (?, ?, ?) ON CONFLICT (player_id, du) DO UPDATE SET jeux = excluded.jeux", params: [id, du, JSON.stringify(liste)] };
    await platform.db.run(ecriture.sql, ecriture.params);
    const apres: PeriodeFavoris[] = identique ? sans : [...sans, [du, liste] as const].sort((a, b) => a[0] - b[0]);
    // Les caches de ce joueur : la réponse du jour est `private, no-cache` et se recalcule à chaque requête (série et jeux du jour lus ici dans la même foulée) ; le classement du jour
    // gardé en mémoire ne dépend pas de ses favoris (il suit les jeux du classement général) : rien à vider.
    const serie = await serieDe(id, jour, apres);
    return new WithHeaders({ ...etatFavoris(apres, jour, visible), ...serie, effetLe: formatDay(du) }, { "Cache-Control": "no-store", Vary: "X-Player-Id" });
  }

  async function profil(req: Request, info: RequestInfo): Promise<WithHeaders> {
    const id = joueurDe(req);
    if (!id) throw new HttpError(400, "invalid_player", "Identifiant de joueur manquant (en-tête X-Player-Id)");
    await limiter(info, id);
    await charger();
    const row = await joueurConnu(id);
    const day = today();
    // Lot P : le profil commun ne liste que les jeux ouverts (`on`) ; un jeu désactivé y revient, résultats compris, à sa réactivation. La série, elle, suit les périodes de chaque jeu.
    const [serie, parJeu] = await Promise.all([serieDe(id, day), Promise.all(jeux.filter(surLeSite).map(async (j) => ({ jeu: j.code, ...(await j.portail.profil(id)) })))]);
    // Lot C1 : « Mes messages » du profil dit si une réponse de l'éditeur attend.
    const messagesNonLus = retours ? await retours.nonLus(id) : 0;
    const body = { pseudo: row.name, ...(row.avatar ? { avatar: row.avatar } : {}), renameRequired: row.rename_required === 1, date: formatDay(day), ...serie, messagesNonLus, jeux: parJeu };
    return new WithHeaders(body, { "Cache-Control": "private, no-cache", Vary: "X-Player-Id" });
  }

  /** Les routes du portail ; `undefined` : ce chemin n'est pas au portail. */
  async function route(path: string, req: Request, _url: URL, info: RequestInfo): Promise<unknown> {
    if (path !== "/api/portail" && !path.startsWith("/api/portail/")) return undefined;
    if (path === "/api/portail/jour") {
      if (req.method !== "GET") throw new HttpError(405, "method_not_allowed", "GET attendu");
      return await jour(req, info);
    }
    if (path === "/api/portail/profil") {
      if (req.method !== "GET") throw new HttpError(405, "method_not_allowed", "GET attendu");
      return await profil(req, info);
    }
    if (path === "/api/portail/favoris") {
      if (req.method !== "PUT") throw new HttpError(405, "method_not_allowed", "PUT attendu");
      return await ecrireFavoris(req, info);
    }
    if (path === "/api/portail/classement") {
      if (req.method !== "GET") throw new HttpError(405, "method_not_allowed", "GET attendu");
      return await classement(req, _url, info);
    }
    throw new HttpError(404, "not_found", "Route inconnue");
  }

  /** Lot F2 : ce que les classements filtrés « Amis » lisent du portail. */
  const vue: VuePartagee = { jeux, premierJour, comptes, jourOuvert, estHauteur, estArcade, classementDe, etatsDe, bilanDe, resultatsCorps, charger };

  return {
    route,
    vue,
    /** Vide la mémoire de l'instance (effacement d'un joueur : il ne doit plus figurer dans un classement gardé). */
    oublier: () => classements.clear(),
    /** Combien de classements du jour cette instance a calculés (mesures et tests). */
    calculs: () => calculs,
  };
}
