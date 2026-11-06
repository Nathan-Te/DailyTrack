import { formatDay, parseDay } from "@cdj/core";
import { numeroDeJournee } from "@cdj/core/lancement";
import { WithHeaders } from "./cache";
import { comparer, ligneDeTri, placer, type ClassementDuJour, type LigneDuJour } from "./classementDuJour";
import type { AmiLu, AmisLecture } from "./amis";
import { HttpError } from "./errors";
import type { MedaillePortail, Platform, RequestInfo, ScorePortail } from "./games";
import { refOfPlayer, type PlayerRow } from "./players";
import type { JeuPortail, VuePartagee } from "./portail";

// Lot F2 — le filtre `filtre=amis` des quatre classements (portail et ses trois vues, Track, Jump, Tower) et la feuille d'un joueur (`GET /api/amis/fiche/<ref>`).
//
// **Aucune requête par ami.** Les rangs viennent du classement du jour que le portail garde déjà en mémoire par fenêtre (45 s ; `classes(day)` des crochets `portail` de chaque jeu, au temps ou à
// la hauteur) : c'est lui qui donne le rang général de chacun et le rang entre amis, sans la limite de 50 du classement « Tous ». Ne sont lus en base que la liste des amis (une requête indexée, avec
// leurs pseudos et références), les états exacts du joueur qui regarde (ce qu'il vient de finir se voit tout de suite, comme dans « Tous ») et, pour Jump, les morts des seuls amis classés.
//
// Une réponse filtrée dépend du joueur : `Cache-Control: private, no-cache` et `Vary: X-Player-Id`. Un classement « Tous » ne change pas (cache public intact, `ref` en plus sur chaque ligne).
// Les amis masqués n'y figurent pas (la liste les écarte, et le classement du jour écarte `hidden = 1`).

export type FormatClassement = "portail" | "cdj" | "jump" | "tower" | "neuf";

export interface DepsClassementAmis {
  platform: Platform;
  vue: () => VuePartagee;
  amis: AmisLecture;
  /** Lot C1, partie C : les membres de mon groupe (hors moi) qui comptent ce jour-là : la liste de `filtre=groupe` à la place de celle des amis. */
  groupe?: (id: string, day: number) => Promise<AmiLu[]>;
  joueurActif(id: string): Promise<PlayerRow>;
  idDe(req: Request): string;
  limiter(info: RequestInfo, id: string): Promise<void>;
  limiterFiche(info: RequestInfo, id: string): Promise<void>;
  parRef(ref: string): Promise<{ id: string; name: string; ref: string; avatar?: string | null } | null>;
  refValide(x: unknown): string;
  origineDe(joueur: string, ami: string): Promise<"ajout" | "invitation" | null>;
  /** Lot K4d : les lignes d'un jeu au format neuf pour ces joueurs (`GameInstance.lignesAmies`). */
  lignesDe?(code: string, day: number, ids: readonly string[]): Promise<Map<string, (rang: number, pseudo: string, ref: string) => Record<string, unknown>>>;
}

/** Le résultat d'un joueur dans un jeu, tel que les lignes le montrent. */
interface Res {
  tempsMs: number;
  medaille: MedaillePortail | null;
  score?: ScorePortail;
  ticks?: number;
}

/** Une ligne du classement filtré avant sa mise en forme. */
interface Entree {
  id: string;
  ref: string;
  pseudo: string;
  avatar?: string | null;
  moi: boolean;
  /** Le rang dans le classement « Tous » de cette vue. */
  rangGeneral: number;
  /** Cumul : la ligne du classement du jour (ses résultats par jeu). Vue d'un jeu au temps : la ligne aussi (la mise en forme du portail la montre). */
  ligne: LigneDuJour | null;
  /** La ligne qui sert à ordonner (cumul seulement). */
  tri: LigneDuJour | null;
  /** Vue d'un jeu : son résultat. */
  res: Res | null;
}

/**
 * L'ordre de deux résultats dans la vue d'un jeu : au temps, le plus court d'abord ; à la hauteur, la plus haute, puis le plus de vies, puis la partie la plus courte (l'ordre du classement de Tower).
 * Sert à placer le joueur qui regarde parmi ses amis ; entre deux amis, l'ordre du classement gardé fait foi (il règle aussi les égalités par l'heure d'envoi).
 */
function comparerResultats(a: Res, b: Res): number {
  if (a.score || b.score) return (b.score?.valeur ?? 0) - (a.score?.valeur ?? 0) || (b.score?.vies ?? 0) - (a.score?.vies ?? 0) || a.tempsMs - b.tempsMs;
  return a.tempsMs - b.tempsMs;
}

export function creerClassementAmis(d: DepsClassementAmis) {
  const { platform } = d;
  const db = platform.db;

  /** Le jour demandé : `date` ou aujourd'hui ; illisible 400, futur 404. */
  function jourDemande(brut: string | null): number {
    const aujourdhui = platform.today();
    const day = brut === null ? aujourdhui : parseDay(brut);
    if (day === null) throw new HttpError(400, "invalid_date", "Date attendue au format AAAA-MM-JJ");
    if (day > aujourdhui) throw new HttpError(404, "unknown_day", "Ce classement n'existe pas (encore)");
    return day;
  }

  /** Les morts de Jump et les pas exacts, pour les seuls joueurs de la ligne (une requête, clé primaire du jour). */
  async function jumpDe(day: number, ids: readonly string[]): Promise<Map<string, { ticks: number; deaths: number }>> {
    if (ids.length === 0) return new Map();
    const rows = await db.all<{ player_id: string; ticks: number; deaths: number }>(`SELECT player_id, ticks, deaths FROM jump_results WHERE day = ? AND player_id IN (${ids.map(() => "?").join(",")})`, [day, ...ids]);
    return new Map(rows.map((r) => [r.player_id, { ticks: r.ticks, deaths: r.deaths }]));
  }

  /** Les pas exacts de la partie de Tower d'un joueur (le sien : le classement gardé peut dater de quelques secondes). */
  async function towerTicksDe(day: number, id: string): Promise<number | null> {
    return (await db.first<{ ticks: number }>("SELECT ticks FROM tower_results WHERE day = ? AND player_id = ?", [day, id]))?.ticks ?? null;
  }

  // --- Le classement filtré ------------------------------------------------------------------------------------------------------
  /**
   * `options` : pour un classement de jeu (`code` du jeu, `date` de l'adresse) ; absent pour le portail (`date` et `vue` en paramètres).
   */
  async function classement(format: FormatClassement, req: Request, url: URL, info: RequestInfo, options?: { code: string; date: string }, filtre: "amis" | "groupe" = "amis"): Promise<WithHeaders> {
    const v = d.vue();
    const id = d.idDe(req);
    await d.limiter(info, id);
    await v.charger();
    const aujourdhui = platform.today();
    const day = jourDemande(options ? options.date : url.searchParams.get("date"));
    const ouverts = v.comptes(day);
    let jeuVue: JeuPortail | undefined;
    let vueNom = "cumul";
    if (format === "portail") {
      // Comme « Tous » : depuis le lancement, les jours d'avant la journée n° 1 ne sont plus lisibles ; un jour sans aucun jeu n'existe pas.
      const avantLancement = v.premierJour <= aujourdhui && day < v.premierJour;
      if (avantLancement || ouverts.length === 0) throw new HttpError(404, "unknown_day", "Ce classement n'existe pas (encore)");
      vueNom = url.searchParams.get("vue") ?? "cumul";
      jeuVue = vueNom === "cumul" ? undefined : ouverts.find((j) => j.portail.site === vueNom);
      if (vueNom !== "cumul" && !jeuVue) throw new HttpError(400, "invalid_view", "Vue attendue : cumul ou le dossier d'un jeu de ce jour");
    } else {
      const jeu = v.jeux.find((j) => j.code === options!.code);
      if (jeu && day < jeu.portail.premierJour) throw new HttpError(404, "unknown_day", "Ce classement n'existe pas (encore)");
      jeuVue = ouverts.find((j) => j.code === options!.code); // `undefined` : le jeu ne compte pas ce jour-là, personne n'y est classé
      vueNom = jeu?.portail.site ?? options!.code;
    }
    const row = await d.joueurActif(id);
    const [amis, c] = await Promise.all([filtre === "groupe" ? (d.groupe ? d.groupe(id, day) : Promise.resolve([])) : d.amis.liste(id), v.classementDe(day)]);
    const maRef = await refOfPlayer(id);

    // Ce que le joueur a fait à l'instant (ses états exacts, une lecture par jeu) : ce qu'il vient de finir figure tout de suite dans sa liste.
    const etatsMoi = ouverts.length ? await v.etatsDe(id, day, ouverts, c) : [];
    // Vue d'un jeu : sa ligne est lue même si ce jeu est hors cumul (Rush) ; vue du cumul : seulement s'il a fini un jeu du cumul.
    const bilan = v.bilanDe(id, etatsMoi, ouverts, jeuVue !== undefined);

    const hauteur = jeuVue && v.estHauteur(jeuVue) ? c.hauteurs?.find((h) => h.jeu === jeuVue!.code) : undefined;
    const g = jeuVue && !hauteur ? c.jeux.indexOf(jeuVue.code) : -1;
    const cumul = format === "portail" && vueNom === "cumul";

    const entrees: Entree[] = [];
    const absents: { ref: string; pseudo: string }[] = [];
    const commun = (a: AmiLu) => ({ id: a.id, ref: a.ref, pseudo: a.name, avatar: a.avatar, moi: false });

    if (cumul) {
      for (const a of amis) {
        const i = c.index.get(a.id);
        if (i === undefined) absents.push({ ref: a.ref, pseudo: a.name });
        else entrees.push({ ...commun(a), rangGeneral: i + 1, ligne: c.cumul[i]!, tri: c.cumul[i]!, res: null });
      }
      if (bilan) entrees.push({ id, ref: maRef, pseudo: row.name, avatar: row.avatar, moi: true, rangGeneral: placer(c, bilan).rang, ligne: bilan, tri: ligneDeTri(c, bilan), res: null });
      entrees.sort((x, y) => comparer(x.tri!, y.tri!));
    } else if (jeuVue) {
      for (const a of amis) {
        let res: Res | null = null;
        let rangGeneral = 0;
        let ligne: LigneDuJour | null = null;
        if (hauteur) {
          const i = hauteur.index.get(a.id);
          if (i !== undefined) {
            const x = hauteur.classes[i]!;
            res = { tempsMs: x.tempsMs, medaille: x.medaille, score: x.score, ticks: x.ticks };
            rangGeneral = i + 1;
          }
        } else {
          ligne = c.lignes.get(a.id) ?? null;
          const r = ligne?.resultats[g];
          if (r) {
            res = { tempsMs: r.tempsMs, medaille: r.medaille, score: r.score, ticks: r.ticks };
            rangGeneral = r.rang;
          }
        }
        if (res) entrees.push({ ...commun(a), rangGeneral, ligne, tri: null, res });
        else absents.push({ ref: a.ref, pseudo: a.name });
      }
      const e = etatsMoi[ouverts.indexOf(jeuVue)];
      if (e && e.statut === "fini") {
        entrees.push({ id, ref: maRef, pseudo: row.name, avatar: row.avatar, moi: true, rangGeneral: e.rang, ligne: hauteur ? null : bilan, tri: null, res: { tempsMs: e.tempsMs, medaille: e.medaille, score: e.score } });
      }
      // Dans l'ordre du classement de la vue. Les amis gardent leur rang du classement gardé ; le joueur qui regarde est placé par son résultat exact (ce qu'il vient de finir peut devancer un ami que
      // le classement gardé n'avait pas encore dépassé), et passe après ceux qui font le même résultat.
      entrees.sort((x, y) => comparerResultats(x.res!, y.res!) || (x.moi || y.moi ? Number(x.moi) - Number(y.moi) : x.rangGeneral - y.rangGeneral));
    } else {
      for (const a of amis) absents.push({ ref: a.ref, pseudo: a.name }); // le jeu ne compte pas ce jour-là : personne n'y est classé
    }

    // Jump : les morts (et les pas exacts) des seuls joueurs de la liste, en une requête ; Tower : les pas exacts du joueur qui regarde.
    const jump = format === "jump" ? await jumpDe(day, entrees.map((x) => x.id)) : new Map<string, { ticks: number; deaths: number }>();
    const neuves = format === "neuf" && d.lignesDe && options ? await d.lignesDe(options.code, day, entrees.map((x) => x.id)) : new Map<string, (rang: number, pseudo: string, ref: string) => Record<string, unknown>>();
    const monTowerTicks = format === "tower" && entrees.some((x) => x.moi) ? await towerTicksDe(day, id) : null;

    const participants = hauteur ? Math.max(hauteur.classes.length, ...entrees.filter((x) => x.moi).map((x) => x.rangGeneral)) : g >= 0 ? Math.max(c.parJeu[g]!.length, ...entrees.filter((x) => x.moi).map((x) => x.rangGeneral)) : c.cumul.length;
    const classes = entrees.length;
    const ouvert = v.jourOuvert(day);

    // --- La mise en forme : « mêmes lignes qu'en Tous », plus le rang entre amis (`rang`), le rang général (`rangGeneral`) et `ref` ---
    const lignes = entrees.map((x, i) => {
      const rang = i + 1;
      const base = { rang, rangGeneral: x.rangGeneral, ref: x.ref, ...(x.avatar ? { avatar: x.avatar } : {}), ...(x.moi ? { moi: true } : {}) };
      switch (format) {
        case "portail": {
          if (cumul) return { ...base, pseudo: x.pseudo, tempsMs: x.ligne!.cumulMs, complet: x.ligne!.complet, resultats: v.resultatsCorps(c.jeux, x.ligne!.resultats) };
          if (hauteur) return { ...base, pseudo: x.pseudo, tempsMs: x.res!.tempsMs, complet: true, score: x.res!.score ?? null, resultats: { [jeuVue!.code]: { rang: x.rangGeneral, tempsMs: x.res!.tempsMs, medaille: x.res!.medaille, score: x.res!.score ?? null } } };
          return { ...base, pseudo: x.pseudo, tempsMs: x.res!.tempsMs, complet: true, resultats: v.resultatsCorps(c.jeux, x.ligne!.resultats) };
        }
        case "cdj":
          return { rank: rang, ...base, name: x.pseudo, ms: x.res!.tempsMs, medal: x.res!.medaille };
        case "jump": {
          const j = jump.get(x.id);
          return { rank: rang, ...base, name: x.pseudo, ticks: j?.ticks ?? x.res!.ticks ?? 0, deaths: j?.deaths ?? 0, medal: x.res!.medaille };
        }
        case "neuf": {
          // Lot K4d : les colonnes de la fiche, mises en forme par le jeu comme son classement « Tous » ; sans ligne (partie masquée entre-temps) : le minimum.
          const ligne = neuves.get(x.id)?.(rang, x.pseudo, x.ref) ?? { rank: rang, name: x.pseudo, medal: x.res!.medaille };
          return { ...ligne, ...base };
        }
        case "tower":
          return { rank: rang, ...base, name: x.pseudo, hauteurMm: x.res!.score?.valeur ?? 0, vies: x.res!.score?.vies ?? 0, ticks: (x.moi ? monTowerTicks : null) ?? x.res!.ticks ?? 0, medal: x.res!.medaille };
      }
    });
    const moi = lignes.find((l) => "moi" in l && l.moi === true) ?? null;
    const commune = { filtre, date: formatDay(day), classes, amis: amis.length, absents, top: lignes };

    let corps: Record<string, unknown>;
    if (format === "portail") {
      corps = {
        date: formatDay(day),
        journee: numeroDeJournee(day, v.premierJour),
        ouvert,
        vue: vueNom,
        jeux: ouverts.map((j) => ({ jeu: j.code, site: j.portail.site, nom: j.portail.nom, ...(v.estHauteur(j) ? { unite: j.portail.unite ?? ("mm" as const) } : {}), ...(v.estArcade(j, day) ? { categorie: "arcade" as const } : {}) })),
        filtre,
        classes,
        amis: amis.length,
        top: lignes,
        absents,
        moi: moi ? { ...moi, classes } : null,
        ...(hauteur ? { unite: jeuVue!.portail.unite ?? ("mm" as const) } : {}),
      };
    } else if (format === "cdj") {
      corps = { ...commune, participants, me: moi };
    } else if (format === "jump") {
      corps = { ...commune, open: ouvert, participants, me: moi };
    } else {
      corps = { ...commune, open: ouvert, participants, me: moi, generation: await platform.generation() };
    }
    return new WithHeaders(corps, { "Cache-Control": "private, no-cache", Vary: "X-Player-Id" });
  }

  // --- La feuille d'un joueur (planche C) ---------------------------------------------------------------------------------------
  /**
   * `GET /api/amis/fiche/<ref>?date=` : les temps d'un joueur ce jour-là, lus dans le classement du jour gardé (aucune requête par jeu), son rang au cumul, et deux drapeaux — est-il ton ami, t'a-t-il pour ami.
   * **Rien d'autre sur lui** (ni identifiant, ni historique). Inconnu ou masqué : 404 `unknown_friend`.
   */
  async function fiche(req: Request, refBrute: string, url: URL, info: RequestInfo): Promise<unknown> {
    const v = d.vue();
    const id = d.idDe(req);
    await d.limiterFiche(info, id);
    const ref = d.refValide(refBrute);
    await v.charger();
    const day = jourDemande(url.searchParams.get("date"));
    const ouverts = v.comptes(day);
    if ((v.premierJour <= platform.today() && day < v.premierJour) || ouverts.length === 0) throw new HttpError(404, "unknown_day", "Ce classement n'existe pas (encore)");
    await d.joueurActif(id);
    const cible = await d.parRef(ref);
    if (!cible) throw new HttpError(404, "unknown_friend", "Aucun joueur pour cette référence");
    const [c, monLien, sonLien] = await Promise.all([v.classementDe(day), d.origineDe(id, cible.id), d.origineDe(cible.id, id)]);
    const i = c.index.get(cible.id);
    const sa = c.lignes.get(cible.id); // toutes ses lignes : ses jeux hors cumul y sont aussi
    const jeux: { jeu: string; site: string; nom: string; unite: "temps" | "hauteur" | "entier"; valeur: number; medaille: MedaillePortail | null; rang: number }[] = [];
    for (const j of ouverts) {
      const entete = { jeu: j.code, site: j.portail.site, nom: j.portail.nom };
      if (v.estHauteur(j)) {
        const h = c.hauteurs?.find((x) => x.jeu === j.code);
        const k = h?.index.get(cible.id);
        if (h && k !== undefined) jeux.push({ ...entete, unite: j.portail.unite === "points" ? "entier" : "hauteur", valeur: h.classes[k]!.score?.valeur ?? 0, medaille: h.classes[k]!.medaille, rang: k + 1 });
      } else {
        const r = sa?.resultats[c.jeux.indexOf(j.code)];
        if (r) jeux.push({ ...entete, unite: "temps", valeur: r.tempsMs, medaille: r.medaille, rang: r.rang });
      }
    }
    return {
      date: formatDay(day),
      ref: cible.ref,
      pseudo: cible.name,
      ...(cible.avatar ? { avatar: cible.avatar } : {}), // lot C1
      ami: monLien !== null,
      reciproque: monLien !== null && sonLien !== null,
      rang: i === undefined ? null : i + 1,
      classes: c.cumul.length,
      jeux,
    };
  }

  return { classement, fiche };
}
