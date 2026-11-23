import type { Enveloppe } from "@cdj/core/enveloppe";
import { formatDay, parseDay } from "@cdj/core";
import type { GameDefinition, GameInstance, MedaillePortail, Platform } from "../games";
import { adaptateurResultatsJeu, CLES_RESULTATS_JEU } from "./adaptateur";
import { type ContratJeu, type LigneBrute, type NiveauCalcule, RefusJeu } from "./contrat";
import { creerJeu, type FicheServeur } from "./module";

// Lot K4c — **les réglages par défaut d'un jeu neuf**. Un jeu qui se classe sur la table commune `resultats_jeu` n'écrit que le **contrat minimal** ci-dessous (le niveau du jour, le décodage de sa
// rediffusion, son rejeu, son score, les seuils de ses médailles, l'empreinte de ses entrées) ; tout le reste d'un `ContratJeu` — la forme des réponses, le jour du portail, les journaux, l'état d'un
// joueur, l'écriture d'une partie — est **dérivé de sa fiche** (`config/jeux/<id>.json`). **Aucun point d'extension n'est obligatoire** ; chacun reste permis (`surcharges`).
// Ce que les formateurs par défaut rendent : voir `docs/plateforme/lots/lot-K4c-jeu-neuf-generateur-et-temoin.md` et `apps/api/CLAUDE.md`, « Un jeu neuf sur le module ».

/** Ce que le décodage d'une rediffusion rend : l'enveloppe commune (`@cdj/core/enveloppe`) ; le jeu y ajoute ce qu'il lit dans la charge. */
export type RejeuNeuf = Pick<Enveloppe, "sim" | "g" | "contenu">;

export interface SeuilsMedailles {
  /** La valeur du Diamant (la partie de l'auteur) puis de l'or, de l'argent et du bronze, **dans l'unité de la première colonne de classement de la fiche**. */
  author: number;
  gold: number;
  silver: number;
  bronze: number;
}

/** **Le contrat minimal d'un jeu neuf.** */
export interface ContratMinimal<Niveau, Rejeu extends RejeuNeuf, Mesure> {
  /** `{ simVersion, generatorVersion }` : la simulation qui rejoue et le générateur du contenu du jour (une rediffusion d'un autre générateur est refusée : « recharge la page »). */
  versions(): { simVersion: number; generatorVersion: number } & Record<string, number>;
  /** Le niveau du jour : **pure et déterministe** (le module le garde en mémoire de l'instance, jamais en base). */
  niveauDuJour(jour: number): Niveau | Promise<Niveau>;
  /** Le texte envoyé, décodé et contrôlé (taille, format, versions connues) ; lève `RefusJeu` (`decoderEnveloppe` de `@cdj/core/enveloppe` + `refusDEnveloppe`). */
  decoder(texte: unknown): Rejeu;
  /** Le rejeu, **la seule source du résultat** ; lève `RefusJeu` pour une partie refusée (inachevée, d'un autre contenu…). */
  rejouer(niveau: Niveau, texte: string): Mesure | Promise<Mesure>;
  /** Les colonnes de classement de la fiche (sans les deux départages ultimes), telles que ce rejeu les donne. */
  score(mesure: Mesure): Record<string, number>;
  /** Les seuils des médailles de ce niveau (celui du Diamant, d'ordinaire la partie d'un bot ou d'un solveur), ou `null` : aucune médaille. */
  seuils(niveau: Niveau): SeuilsMedailles | null;
  /** Les entrées effectivement jouées, en texte canonique : le module en prend l'empreinte pour refuser les copies. */
  entrees(rejeu: Rejeu): string;
  /** Lot PA1c : la partie n'a joué aucune entrée (jeu Party) : elle n'est jamais comparée aux autres (voir `ContratJeu.sansEntree`). Facultatif. */
  sansEntree?(rejeu: Rejeu): boolean;

  // --- Facultatifs : jamais obligatoires -------------------------------------------------------------------------------------------------
  /**
   * Lot PG2 — **la version du générateur qui a produit ce niveau** (facultatif, défaut : `versions().generatorVersion`, le générateur courant). **À donner dès qu'un jeu garde d'anciennes versions** : un jour figé sous
   * l'ancien générateur (le fichier du jour porte son `g`) est servi tel quel après une montée de version, et sa rediffusion nomme **ce** générateur-là ; sans ce champ, `memeContenu` la compare au seul générateur courant
   * et refuse `409 version` un jour figé qui se rejoue pourtant très bien. Le décodage (`decoder`) doit connaître les deux versions ; le jour qui n'est pas figé rend le générateur courant.
   */
  generateurDuNiveau?(niveau: Niveau): number;
  /** Le thème du jour (un code traduit par le portail), défaut : aucun. */
  theme?(niveau: Niveau): string | null;
  /**
   * Lot D4 — **le thème d'un jour d'après le calendrier du jeu, sans calculer le niveau** (facultatif ; le même que `theme(niveau)`). L'accueil le montre pendant que le niveau d'un jour se calcule dans le fil de calcul
   * (`jourSansNiveau`) : sans lui, le jeu y apparaît sans thème jusqu'à ce que son niveau soit prêt. Pure.
   */
  themeDuJour?(jour: number): string | null;
  /** L'empreinte des entrées de la partie de l'auteur (refus de la copie), défaut : aucune. */
  empreinteAuteur?(niveau: Niveau): string | null;
  /** Ce que `GET /api/<jeu>/day/<date>` rend en plus (jamais la preuve de l'auteur). */
  contenuPublic?(niveau: Niveau): unknown;
  /** Ce que la partie veut garder de plus (JSON dans `mesures`). */
  mesures?(mesure: Mesure): Record<string, number>;
  /** Pas par seconde de la simulation, si la première colonne est en `ticks` (défaut 60). */
  ticksParSeconde?: number;
  /** Le fantôme réservé aux classés. */
  fantome?: ContratJeu<Niveau, Rejeu, Mesure>["fantome"];
  premier?: boolean;
  /** Le jour que cette image sert (fichiers figés), défaut : aucun. */
  joursFiges?: readonly string[];
}

const MEDAILLES: readonly MedaillePortail[] = ["author", "gold", "silver", "bronze"];

/** Une enveloppe refusée → un refus du jeu (le code de l'API est celui de la liste unique). */
export function refusDEnveloppe(e: { code: "format_illisible" | "version_inconnue" | "trop_longue"; message: string }): RefusJeu {
  if (e.code === "version_inconnue") return new RefusJeu("version", "Une nouvelle version du jeu est disponible : recharge la page");
  return new RefusJeu("invalid_replay", e.message);
}

/** La médaille la plus haute dont le score atteint le seuil, dans le sens de la première colonne (le plus petit d'abord pour `asc`, le plus grand pour `desc`). */
export function medailleParSeuils(valeur: number, sens: "asc" | "desc", s: SeuilsMedailles | null): MedaillePortail | null {
  if (!s) return null;
  for (const m of MEDAILLES) if (sens === "desc" ? valeur >= s[m] : valeur <= s[m]) return m;
  return null;
}

/**
 * Lot D4 — **le calcul du niveau hors du fil principal.** Présent, le niveau d'un jour se calcule dans le fil de calcul (`calculer`), se garde en base (`meta`, par le module) et l'accueil ne l'attend jamais
 * (`jourSansNiveau`). Absent (tests, outils, développement) : `niveauDuJour` sur place, comme avant le lot D4.
 */
export interface NiveauHorsDuFil<Niveau> {
  /** Le niveau d'un jour et les seuils de ses médailles, calculés par le fil. */
  calculer(jour: number): Promise<{ niveau: Niveau; seuils: SeuilsMedailles | null }>;
}

/** Au-delà, un niveau n'est pas gardé en base : un niveau de seuils pèse quelques centaines d'octets (mesuré, README du lot D4), celui d'un jeu dont le contenu est une grille ou une piste se recalcule (Rush : 300 à 417 Ko). */
export const NIVEAU_GARDE_OCTETS_MAX = 16_384;

/** Deux valeurs sont-elles les mêmes, à l'octet près, une fois passées par JSON ? (objets et tableaux simples, nombres égaux par `Object.is` : ni `undefined`, ni tableau typé, ni `-0`, ni `Map` ne survivent.) */
export function memeValeur(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  const pa = Object.getPrototypeOf(a);
  if (pa !== Object.getPrototypeOf(b) || (pa !== Object.prototype && pa !== Array.prototype)) return false;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => Object.hasOwn(b, k) && memeValeur((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

/**
 * La ligne qui garde un niveau et ses seuils en base : leur JSON, **seulement s'il est petit et que le JSON ne perd rien** (`memeValeur`) — alors le niveau que relit une instance qui se réveille est exactement celui que le fil a
 * calculé. Sinon une ligne vide : rien n'est gardé, le niveau se recalcule (un tableau typé ou un niveau de 300 Ko ne passe pas par JSON).
 */
export function ligneDeNiveau(garde: unknown): { garde: string } | Record<string, never> {
  const texte = JSON.stringify(garde);
  return texte !== undefined && texte.length <= NIVEAU_GARDE_OCTETS_MAX && memeValeur(JSON.parse(texte), garde) ? { garde: texte } : {};
}

/** Dérive un `ContratJeu` complet d'un contrat minimal et de la fiche du jeu. */
export function contratDeFiche<Niveau, Rejeu extends RejeuNeuf, Mesure>(fiche: FicheServeur, nomJeu: string, c: ContratMinimal<Niveau, Rejeu, Mesure>, hors?: NiveauHorsDuFil<Niveau>): ContratJeu<Niveau, Rejeu, Mesure> {
  const reelles = fiche.classement.colonnes.filter((k) => k.nom !== "submitted_at" && k.nom !== "player_id");
  const premiere = reelles[0]!;
  const noms = reelles.map((k) => k.nom);
  const premierJour = parseDay(fiche.premierJour)!;
  const parTemps = fiche.classement.format === "temps";
  const unitePortail = fiche.classement.unite === "mm" ? ("mm" as const) : ("points" as const);
  const ticksParSeconde = c.ticksParSeconde ?? 60;
  /** Le temps d'une partie pour le portail (ms) : la première colonne d'un jeu au temps ; 0 pour un jeu au score. */
  const tempsMs = (valeur: number): number => (!parTemps ? 0 : fiche.classement.unite === "ticks" ? Math.round((valeur * 1000) / ticksParSeconde) : valeur);
  const scoreDe = (b: LigneBrute): Record<string, number> => Object.fromEntries(noms.map((n) => [n, Number(b[n])]));
  const seuilsPortail = (s: SeuilsMedailles | null) => (s === null ? null : parTemps ? { author: tempsMs(s.author), gold: tempsMs(s.gold), silver: tempsMs(s.silver), bronze: tempsMs(s.bronze) } : s);
  /**
   * Lot D4 : les seuils d'un niveau venu du fil de calcul sont **ceux que le fil a calculés avec lui** (le robot qui les donne peut durer des secondes, et un jeu le fait tourner dans `seuils` autant que dans
   * `niveauDuJour`) : le fil principal ne rappelle jamais `seuils` pour un tel niveau. Un niveau calculé sur place (tests, outils) garde le comportement d'avant.
   */
  const seuilsDuFil = new WeakMap<object, SeuilsMedailles | null>();
  const seuilsDe = (niveau: Niveau): SeuilsMedailles | null => (typeof niveau === "object" && niveau !== null && seuilsDuFil.has(niveau) ? seuilsDuFil.get(niveau)! : c.seuils(niveau));
  const mesuresDe = (m: Mesure) => (c.mesures ? JSON.stringify(c.mesures(m)) : null);

  return {
    nomJournal: nomJeu,
    compteEffacement: `parties${nomJeu.replace(/[^A-Za-z0-9]/g, "")}`,
    versions: () => c.versions(),
    joursFiges: c.joursFiges ?? [],

    regle: async () => Object.entries(c.versions()).map(([k, v]) => `${k}=${v}`).join(","),
    // Lot D4 : hors du fil principal, le niveau vient du fil de calcul et la ligne est son JSON quand il le garde sans perte (`ligneDeNiveau`) ; sur place, comme avant : rien n'est gardé en base.
    calculer: async (jour): Promise<NiveauCalcule<Niveau>> => {
      if (!hors) return { niveau: await c.niveauDuJour(jour), ligne: {} };
      const { niveau, seuils } = await hors.calculer(jour);
      if (typeof niveau === "object" && niveau !== null) seuilsDuFil.set(niveau, seuils);
      return { niveau, ligne: ligneDeNiveau({ niveau, seuils }) };
    },
    restaurer: (_jour, ligne) => {
      if (!hors || typeof ligne.garde !== "string") throw new Error("un jeu sur la table commune ne garde son niveau en base que hors du fil principal");
      const { niveau, seuils } = JSON.parse(ligne.garde) as { niveau: Niveau; seuils: SeuilsMedailles | null };
      if (typeof niveau === "object" && niveau !== null) seuilsDuFil.set(niveau, seuils);
      return niveau;
    },
    ...(hors
      ? {
          garderEnBase: true as const,
          jourSansNiveau: (jour: number) => ({ numero: jour - premierJour + 1, theme: c.themeDuJour?.(jour) ?? null, seuils: null, ...(parTemps ? {} : { unite: unitePortail }), provisoire: true as const }),
        }
      : {}),
    champsJournalJour: () => ({}),
    infoJour: (niveau) => {
      const s = seuilsDe(niveau);
      return { ...c.versions(), medals: s, theme: c.theme?.(niveau) ?? null, ...(c.contenuPublic ? { contenu: c.contenuPublic(niveau) } : {}) };
    },
    portailJour: (niveau, jour) => ({ numero: jour - premierJour + 1, theme: c.theme?.(niveau) ?? null, seuils: seuilsPortail(seuilsDe(niveau)), ...(parTemps ? {} : { unite: unitePortail }) }),
    empreinteAuteur: (niveau) => c.empreinteAuteur?.(niveau) ?? null,

    decoder: (texte) => c.decoder(texte),
    jourDe: (r) => ("jour" in r.contenu ? r.contenu.jour : null),
    /** La rediffusion nomme le générateur que le serveur sert ce jour-là, sinon l'onglet est resté sur une autre version : « recharge la page ». Lot PG2 : ce générateur est celui **du niveau servi** (`generateurDuNiveau`, un jour figé d'une ancienne version), à défaut le courant. */
    memeContenu(r, niveau) {
      const attendu = c.generateurDuNiveau ? c.generateurDuNiveau(niveau) : c.versions().generatorVersion;
      if (r.g !== attendu) throw new RefusJeu("version", `Une nouvelle version du jeu est disponible : recharge la page (générateur ${r.g})`);
    },
    entrees: (r) => c.entrees(r),
    ...(c.sansEntree ? { sansEntree: (r: Rejeu) => c.sansEntree!(r) } : {}),
    rejouer: async (niveau, texte) => c.rejouer(niveau, texte),
    rejouee(_niveau, r, mesure) {
      const score = { ...c.score(mesure) };
      for (let i = reelles.length + 1; i <= CLES_RESULTATS_JEU; i++) score[`cle${i}`] = 0;
      return { score, autres: { sim_version: r.sim, generator_version: r.g, mesures: mesuresDe(mesure) } };
    },
    medaille: (niveau, score) => medailleParSeuils(score[premiere.nom]!, premiere.sens, seuilsDe(niveau)),
    champsJournalPartie: (mesure, improved) => ({ improved, ...c.score(mesure) }),
    validation: (mesure) => ({ ms: tempsMs(c.score(mesure)[premiere.nom]!) }),

    ligneClassement: (rang, b) => ({ rank: rang, name: String(b.name), ...scoreDe(b), medal: (b.medal as string | null) ?? null, ...(b.ref ? { ref: String(b.ref) } : {}) }),
    reponseEnvoi: (r) => ({
      accepted: true,
      date: r.date,
      score: c.score(r.mesure as Mesure),
      medal: r.medaille,
      improved: r.improved,
      best: { ...scoreDe(r.meilleur), medal: (r.meilleur.medal as string | null) ?? null },
      rank: r.rang,
      participants: r.participants,
      board: r.board,
    }),
    jourProfil: (b, date) => ({ date, ...scoreDe(b), medal: (b.medal as string | null) ?? null }),
    versPortail: (b) => {
      const v = Number(b[premiere.nom]);
      return parTemps ? { tempsMs: tempsMs(v), ticks: fiche.classement.unite === "ticks" ? v : undefined } : { tempsMs: 0, score: { unite: unitePortail, valeur: v, vies: 0 } };
    },
    ...(c.fantome ? { fantome: c.fantome } : {}),
    ...(c.premier ? { premier: true } : {}),
  };
}

export interface OptionsJeuNeuf {
  fiche: FicheServeur;
  /** Le nom du jeu tel que le portail l'écrit (« Cibles ») : le même que `nom.fr` de la fiche. */
  nom: string;
  /** Les lectures du classement par adresse et par fenêtre (défaut 120). */
  lecturesParAdresse?: number;
}

/** La plateforme que reçoit un contrat dans le fil de calcul : il n'y en a pas, et toucher à l'une de ses propriétés lève (le fil répond par une panne, le serveur ne sert jamais un niveau qu'un contrat aurait calculé sans elle). */
const PLATEFORME_ABSENTE = new Proxy({} as Platform, {
  get(_cible, propriete) {
    throw new Error(`la plateforme n'existe pas dans le fil de calcul des niveaux (propriété « ${String(propriete)} »)`);
  },
});

/** La grâce après minuit de Paris, comme les autres jeux (`GRACE_MS`, testé). */
export const GRACE_JEU_NEUF_MS = 10 * 60_000;

/**
 * Un jeu neuf prêt pour le registre : les routes sous `/api/<code>`, la table `resultats_jeu`, le classement de la fiche, tout ce que fait le module. Le jeu écrit son contrat minimal ; **rien d'autre**.
 */
export function definirJeuNeuf<Niveau, Rejeu extends RejeuNeuf, Mesure, O = undefined>(
  options: OptionsJeuNeuf,
  contrat: (platform: Platform, o: O) => ContratMinimal<Niveau, Rejeu, Mesure>,
): GameDefinition<O> {
  const { fiche } = options;
  const adaptateur = adaptateurResultatsJeu(fiche.code, fiche.classement.colonnes);
  return {
    code: fiche.code,
    name: options.nom,
    prefix: `/api/${fiche.code}`,
    tables: ["resultats_jeu"],
    schema: [],
    versions: () => ({}),
    // Lot D4 : le niveau du jour, **sans plateforme** : le contrat est fait avec une plateforme qui refuse qu'on la touche (un contrat qui ne lit la plateforme que dans `rejouer` — Rush y dépense le plafond de rejeux —
    // s'en accommode ; un contrat qui la lirait pour son niveau le dirait tout de suite, dans le fil, par une panne, jamais par un niveau faux).
    niveauDuJour: async (o, jour) => {
      const c = contrat(PLATEFORME_ABSENTE, o as O);
      const niveau = await c.niveauDuJour(jour);
      return { niveau, seuils: c.seuils(niveau) };
    },
    create(platform: Platform, o: O): GameInstance {
      const minimal = contrat(platform, o);
      const calculerHorsDuFil = platform.niveauxKit;
      /** Les fichiers figés de l'image sont l'option `frozen` du jeu (lot K4f) : le fil reçoit **le seul fichier du jour** (le jeu les lit par date), jamais l'image entière à chaque demande. */
      const figes = (o as { frozen?: Readonly<Record<string, unknown>> } | undefined)?.frozen ?? {};
      return creerJeu(platform, {
        fiche,
        contrat: contratDeFiche(
          fiche,
          options.nom,
          minimal,
          calculerHorsDuFil
            ? {
                calculer: async (jour) => {
                  const date = formatDay(jour);
                  const r = await calculerHorsDuFil.rejouer({ jeu: "kit", code: fiche.code, day: jour, frozen: date in figes ? { [date]: figes[date] } : {} });
                  return { niveau: r.niveau as Niveau, seuils: r.seuils as SeuilsMedailles | null };
                },
              }
            : undefined,
        ),
        adaptateur,
        nom: options.nom,
        prefixe: `/api/${fiche.code}`,
        graceMs: GRACE_JEU_NEUF_MS,
        top: 50,
        lecturesParAdresse: options.lecturesParAdresse ?? 120,
        lecturesProfilParJoueur: 60,
        debit: { adresse: `${fiche.code}ip`, joueur: `${fiche.code}p`, lectures: `${fiche.code}rd`, profilAdresse: `${fiche.code}meip`, profilJoueur: `${fiche.code}me` },
      });
    },
  };
}
