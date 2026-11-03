import { parseDay, formatDay } from "@cdj/core";
import { WithHeaders } from "./cache";
import { HttpError } from "./errors";
import type { Platform, RequestInfo, Statement } from "./games";
import { ImageRefusee, controlerImage, octetsDeBase64 } from "./imagesAvatar";
import type { Avatars, ProprietaireImage } from "./avatars";
import { departDuJoueur, dissoudreStatements, plusAncien } from "./groupesDepart";
import { CLASSES_MIN, classerLesGroupes, scoreDuGroupe, type ResultatMembre, type ScoreGroupe, type Sens } from "./groupesScore";
import { ecrireJournal } from "./journaux";
import { refOfPlayer } from "./players";
import type { VuePartagee } from "./portail";
import { isForbidden, nameKey } from "./pseudos";
import { parisDayStart } from "@cdj/clock";

// Lot C1, partie C (plateforme) — les groupes. README : `docs/plateforme/lots/lot-C1-retours-avatars-groupes.md` ; règles : `apps/api/CLAUDE.md`, « Groupes (lot C1) ».
//
//   GET    /api/groupes/moi                       (X-Player-Id) mon groupe (ou `null`) : membres, lien d'invitation, ce que je peux faire
//   POST   /api/groupes { nom, description }      crée un groupe dont je suis le chef (un seul groupe par joueur)
//   GET    /api/groupes/nom/<nom>                 la page publique d'un groupe : description, emblème, membres, son rang du jour dans chaque vue
//   GET    /api/groupes/classement?date=&vue=     le classement des groupes d'un jour (Cumulé, ou un jeu) : les classés, puis « Moins de 3 classés »
//   GET    /api/groupes/invitation/<jeton>        la carte d'invitation (sans identité)
//   POST   /api/groupes/rejoindre { jeton }       rejoint le groupe ; il compte à partir du lendemain
//   POST   /api/groupes/quitter                   quitte le groupe (le plus ancien devient chef, ou le groupe est dissous)
//   chef : POST renouveler · retirer { ref } · chef { ref } · renommer { nom } (une fois par semaine) · decrire { description } · dissoudre · emblem { image } · DELETE emblem
//   Administration : GET /api/admin/groupes?q=&page=, GET …/<id>, POST …/<id>/renommer | emblem-retirer | retirer | chef | masquer | dissoudre
//
// **Le score d'un groupe** (`groupesScore.ts`) : la moyenne des 3 meilleurs résultats de ses membres ce jour-là dans la vue ; 3 classés au moins, sinon « Moins de 3 classés ». Un membre compte à partir du
// **lendemain** de son arrivée ; un membre parti ne compte plus tout de suite ; un joueur masqué (N1) ne compte jamais (le classement du jour l'écarte déjà). Le calcul lit le classement du jour que le portail
// garde en mémoire et **les seuls joueurs classés ce jour-là** (une recherche par clé primaire chacun), jamais toute la table des membres.

export const GROUPE_MEMBRES_MAX = 30;
export const GROUPE_NOM_MIN = 3;
export const GROUPE_NOM_MAX = 24;
export const GROUPE_DESCRIPTION_MAX = 140;
export const GROUPE_RENOMMER_JOURS = 7;
export const GROUPES_ADMIN_PAR_PAGE = 50;
/** Combien de temps une instance garde le classement des groupes d'un jour (comme le classement du jour du portail). */
const GARDE_MS = 45_000;
const PAR_LOT = 400;

/** Le nom d'un groupe : 3 à 24 caractères, lettres, chiffres, espace, point, tiret, tiret bas, apostrophe ; commence par une lettre ou un chiffre. `null` s'il est refusé. */
export function nomDeGroupe(brut: unknown): string | null {
  if (typeof brut !== "string") return null;
  const nom = brut.normalize("NFC").replace(/\s+/g, " ").trim();
  const longueur = [...nom].length;
  if (longueur < GROUPE_NOM_MIN || longueur > GROUPE_NOM_MAX) return null;
  if (!/^[\p{L}\p{N}][\p{L}\p{N} ._'’-]*$/u.test(nom)) return null;
  return nom;
}
/** La description : 0 à 140 caractères de texte (jamais interprété), sans retour à la ligne ni caractère de contrôle. `null` si refusée. */
export function descriptionDeGroupe(brut: unknown): string | null {
  if (brut === undefined || brut === null) return "";
  if (typeof brut !== "string") return null;
  const d = brut.normalize("NFC").replace(/\s+/g, " ").trim();
  if ([...d].length > GROUPE_DESCRIPTION_MAX || /[\p{Cc}\p{Cf}]/u.test(d)) return null;
  return d;
}

/** Le propriétaire « groupe » des images : `ref` = l'identifiant public du groupe (12 hexadécimaux, tiré au hasard, pas un secret). */
export const proprietaireGroupe: ProprietaireImage = {
  async trouver(base, ref) {
    const r = await base.first<{ id: string; name: string }>("SELECT id, name FROM groupes WHERE id = ?", [ref.toLowerCase()]);
    return r ? { owner: r.id, nom: r.name, ref: r.id } : null;
  },
  copier: (owner, hash) => ({ sql: "UPDATE groupes SET avatar = ? WHERE id = ?", params: [hash, owner] }),
};

interface LigneGroupe {
  id: string;
  name: string;
  name_key: string;
  description: string;
  chef: string;
  avatar: string | null;
  invitation: string;
  renomme_le: number | null;
  classement_masque: number;
  cree_le: number;
}
interface LigneMembre {
  player_id: string;
  rejoint_le: number;
  arrivee: number;
  name: string;
  ref: string | null;
  avatar: string | null;
  hidden: number;
}
/** Une vue du classement des groupes : `cumul` ou le dossier d'un jeu (`site`). */
interface VueGroupes {
  vue: string;
  sens: Sens;
  classes: { id: string; nom: string; avatar: string | null; rang: number; score: number; classesN: number }[];
  moins: { id: string; nom: string; avatar: string | null; classesN: number }[];
}

export function createGroupes(platform: Platform, vue: () => VuePartagee, avatars: Avatars) {
  const { db, now, players, hashKey, hit, hitAddress, readHitAddress, readJson, playerIdOf } = platform;
  const idDe = (req: Request): string => playerIdOf(req.headers.get("x-player-id"));
  const ecrire = async (instructions: Statement[]) => {
    if (db.batch) await db.batch(instructions);
    else for (const s of instructions) await db.run(s.sql, s.params);
  };
  const hasard = (octets: number): string => [...crypto.getRandomValues(new Uint8Array(octets))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const cacheGroupes = new Map<number, { jusque: number; vues: Promise<{ jours: VueGroupes[] }> }>();

  // --- Lectures de base --------------------------------------------------------------------------------------------------------
  const groupeParId = (id: string) => db.first<LigneGroupe>("SELECT * FROM groupes WHERE id = ?", [id]);
  const groupeDe = async (joueur: string): Promise<{ groupe: LigneGroupe; rejoint_le: number; arrivee: number } | null> => {
    const m = await db.first<{ groupe: string; rejoint_le: number; arrivee: number }>("SELECT groupe, rejoint_le, arrivee FROM groupe_membres WHERE player_id = ?", [joueur]);
    if (!m) return null;
    const g = await groupeParId(m.groupe);
    return g ? { groupe: g, rejoint_le: m.rejoint_le, arrivee: m.arrivee } : null;
  };
  const membresDe = (groupe: string) =>
    db.all<LigneMembre>(
      "SELECT m.player_id, m.rejoint_le, m.arrivee, p.name, p.ref, p.avatar, p.hidden FROM groupe_membres m JOIN players p ON p.id = m.player_id WHERE m.groupe = ? ORDER BY m.rejoint_le, m.player_id",
      [groupe],
    );
  const publicMembre = async (m: LigneMembre, chef: string) => ({
    ref: m.ref ?? (await refOfPlayer(m.player_id)),
    pseudo: m.name,
    ...(m.avatar ? { avatar: m.avatar } : {}),
    chef: m.player_id === chef,
    depuis: new Date(m.rejoint_le).toISOString().slice(0, 10),
  });
  const nombreDeMembres = async (groupe: string): Promise<number> => (await db.first<{ n: number }>("SELECT COUNT(*) AS n FROM groupe_membres WHERE groupe = ?", [groupe]))?.n ?? 0;

  async function exiger(req: Request, info: RequestInfo, ecriture: boolean): Promise<string> {
    const id = idDe(req);
    if (ecriture) {
      await hitAddress(info, "grwip", 40);
      await hit(await hashKey("grw", id), platform.limits.perPlayer);
    } else await readHitAddress(info, "grlip", 600);
    await players.assertActive(id);
    if (!(await players.find(id))) throw new HttpError(404, "unknown_player", "Ce profil n'existe pas sur le serveur : joue une partie pour l'ouvrir");
    return id;
  }
  async function exigerChef(req: Request, info: RequestInfo): Promise<{ id: string; groupe: LigneGroupe }> {
    const id = await exiger(req, info, true);
    const g = await groupeDe(id);
    if (!g) throw new HttpError(404, "unknown_group", "Tu n'es dans aucun groupe");
    if (g.groupe.chef !== id) throw new HttpError(403, "not_group_chief", "Seul le chef du groupe peut faire cela");
    return { id, groupe: g.groupe };
  }
  function nomLibre(brut: unknown): string {
    const nom = nomDeGroupe(brut);
    if (nom === null || isForbidden(nom)) throw new HttpError(400, "invalid_group", `Nom de groupe invalide (${GROUPE_NOM_MIN} à ${GROUPE_NOM_MAX} caractères : lettres, chiffres, espace, point, tiret, apostrophe)`);
    return nom;
  }
  async function verifierNomLibre(nom: string, sauf: string | null): Promise<void> {
    const autre = await db.first<{ id: string }>("SELECT id FROM groupes WHERE name_key = ?", [nameKey(nom)]);
    if (autre && autre.id !== sauf) throw new HttpError(409, "group_name_taken", "Ce nom de groupe est déjà pris");
  }

  // --- Mon groupe ----------------------------------------------------------------------------------------------------------------
  async function fiche(g: LigneGroupe, moi: string | null): Promise<Record<string, unknown>> {
    const membres = (await membresDe(g.id)).filter((m) => m.hidden === 0);
    return {
      id: g.id,
      nom: g.name,
      description: g.description,
      ...(g.avatar ? { avatar: g.avatar } : {}),
      membres: await Promise.all(membres.map((m) => publicMembre(m, g.chef))),
      max: GROUPE_MEMBRES_MAX,
      ...(moi !== null ? { moi: true, chef: g.chef === moi } : {}),
    };
  }
  async function moi(req: Request, info: RequestInfo): Promise<WithHeaders> {
    await readHitAddress(info, "grlip", 600);
    // Sans identifiant (un visiteur) : pas de groupe, ce n'est pas une erreur.
    if (!req.headers.get("x-player-id")) return new WithHeaders({ groupe: null }, { "Cache-Control": "private, no-cache", Vary: "X-Player-Id" });
    const id = idDe(req);
    await players.assertActive(id);
    const g = id && (await players.find(id)) ? await groupeDe(id) : null;
    if (!g) return new WithHeaders({ groupe: null }, { "Cache-Control": "private, no-cache", Vary: "X-Player-Id" });
    const base = await fiche(g.groupe, id);
    const chef = g.groupe.chef === id;
    const corps = {
      groupe: {
        ...base,
        invitation: g.groupe.invitation, // tout membre peut montrer et partager le lien ; seul le chef le renouvelle
        arrivee: formatDay(g.arrivee),
        ...(chef ? { renommerDans: Math.max(0, (g.groupe.renomme_le ?? 0) + GROUPE_RENOMMER_JOURS * 86_400_000 - now()) } : {}),
      },
    };
    return new WithHeaders(corps, { "Cache-Control": "private, no-cache", Vary: "X-Player-Id" });
  }

  async function creer(req: Request, info: RequestInfo): Promise<unknown> {
    const id = await exiger(req, info, true);
    const corps = await readJson(req);
    const nom = nomLibre(corps.nom);
    const description = descriptionDeGroupe(corps.description);
    if (description === null) throw new HttpError(400, "invalid_group", `Description invalide (${GROUPE_DESCRIPTION_MAX} caractères au plus, du texte)`);
    if (await db.first("SELECT 1 AS x FROM groupe_membres WHERE player_id = ?", [id])) throw new HttpError(409, "already_in_group", "Tu es déjà dans un groupe");
    await verifierNomLibre(nom, null);
    const gid = hasard(6);
    const t = now();
    try {
      await ecrire([
        { sql: "INSERT INTO groupes (id, name, name_key, description, chef, avatar, invitation, renomme_le, classement_masque, cree_le) VALUES (?, ?, ?, ?, ?, NULL, ?, NULL, 0, ?)", params: [gid, nom, nameKey(nom), description, id, hasard(16), t] },
        { sql: "INSERT INTO groupe_membres (player_id, groupe, rejoint_le, arrivee) VALUES (?, ?, ?, ?)", params: [id, gid, t, platform.today() + 1] },
      ]);
    } catch (e) {
      if (String((e as Error)?.message ?? e).includes("UNIQUE") || String((e as Error)?.message ?? e).includes("constraint")) throw new HttpError(409, "group_name_taken", "Ce nom de groupe est déjà pris");
      throw e;
    }
    cacheGroupes.clear();
    return { id: gid, nom };
  }

  // --- Invitation, rejoindre, quitter --------------------------------------------------------------------------------------------
  const jetonValide = (x: unknown): string => {
    if (typeof x !== "string" || !/^[0-9a-f]{32}$/.test(x)) throw new HttpError(404, "unknown_group", "Ce lien d'invitation n'est plus valable");
    return x;
  };
  async function voirInvitation(info: RequestInfo, jeton: string): Promise<WithHeaders> {
    await readHitAddress(info, "grinv", 120);
    const g = await db.first<LigneGroupe>("SELECT * FROM groupes WHERE invitation = ?", [jetonValide(jeton)]);
    if (!g) throw new HttpError(404, "unknown_group", "Ce lien d'invitation n'est plus valable");
    const n = await nombreDeMembres(g.id);
    return new WithHeaders({ id: g.id, nom: g.name, description: g.description, ...(g.avatar ? { avatar: g.avatar } : {}), membres: n, max: GROUPE_MEMBRES_MAX, plein: n >= GROUPE_MEMBRES_MAX }, { "Cache-Control": "no-store" });
  }
  async function rejoindre(req: Request, info: RequestInfo): Promise<unknown> {
    const id = await exiger(req, info, true);
    await hitAddress(info, "grjoin", 20);
    const g = await db.first<LigneGroupe>("SELECT * FROM groupes WHERE invitation = ?", [jetonValide((await readJson(req)).jeton)]);
    if (!g) throw new HttpError(404, "unknown_group", "Ce lien d'invitation n'est plus valable");
    if (await db.first("SELECT 1 AS x FROM groupe_membres WHERE player_id = ?", [id])) throw new HttpError(409, "already_in_group", "Tu es déjà dans un groupe");
    // Le plafond est vérifié **à l'écriture** : deux arrivées en même temps ne dépassent pas 30.
    const t = now();
    await db.run("INSERT INTO groupe_membres (player_id, groupe, rejoint_le, arrivee) SELECT ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM groupe_membres WHERE groupe = ?) < ?", [id, g.id, t, platform.today() + 1, g.id, GROUPE_MEMBRES_MAX]);
    if (!(await db.first("SELECT 1 AS x FROM groupe_membres WHERE player_id = ?", [id]))) throw new HttpError(409, "group_full", "Ce groupe est complet");
    cacheGroupes.clear();
    return { id: g.id, nom: g.name, arrivee: formatDay(platform.today() + 1) };
  }
  async function quitter(req: Request, info: RequestInfo): Promise<unknown> {
    const id = await exiger(req, info, true);
    const d = await departDuJoueur(db, id);
    if (!d.groupe) throw new HttpError(404, "unknown_group", "Tu n'es dans aucun groupe");
    await ecrire(d.statements);
    cacheGroupes.clear();
    return { quitte: true, dissous: d.dissous };
  }

  // --- Le chef -----------------------------------------------------------------------------------------------------------------------
  async function renouveler(req: Request, info: RequestInfo): Promise<unknown> {
    const { groupe } = await exigerChef(req, info);
    const jeton = hasard(16);
    await db.run("UPDATE groupes SET invitation = ? WHERE id = ?", [jeton, groupe.id]); // l'ancien lien ne mène plus nulle part
    return { invitation: jeton };
  }
  async function membreParRef(groupe: string, ref: unknown): Promise<LigneMembre> {
    if (typeof ref !== "string" || !/^[0-9a-f]{12}$/i.test(ref)) throw new HttpError(404, "unknown_member", "Ce joueur n'est pas dans le groupe");
    const m = (await membresDe(groupe)).find((x) => (x.ref ?? "").toLowerCase() === ref.toLowerCase());
    if (!m) throw new HttpError(404, "unknown_member", "Ce joueur n'est pas dans le groupe");
    return m;
  }
  async function retirer(req: Request, info: RequestInfo): Promise<unknown> {
    const { id, groupe } = await exigerChef(req, info);
    const m = await membreParRef(groupe.id, (await readJson(req)).ref);
    if (m.player_id === id) throw new HttpError(400, "invalid_group", "Pour partir, utilise « Quitter le groupe »");
    await db.run("DELETE FROM groupe_membres WHERE player_id = ? AND groupe = ?", [m.player_id, groupe.id]);
    cacheGroupes.clear();
    return { retire: true };
  }
  async function passerLeChef(req: Request, info: RequestInfo): Promise<unknown> {
    const { id, groupe } = await exigerChef(req, info);
    const m = await membreParRef(groupe.id, (await readJson(req)).ref);
    if (m.player_id === id) throw new HttpError(400, "invalid_group", "Tu es déjà le chef");
    await db.run("UPDATE groupes SET chef = ? WHERE id = ?", [m.player_id, groupe.id]);
    return { chef: true };
  }
  async function renommer(req: Request, info: RequestInfo): Promise<unknown> {
    const { groupe } = await exigerChef(req, info);
    const nom = nomLibre((await readJson(req)).nom);
    if (nameKey(nom) === groupe.name_key && nom === groupe.name) return { nom };
    const t = now();
    if (groupe.renomme_le !== null && t - groupe.renomme_le < GROUPE_RENOMMER_JOURS * 86_400_000) {
      throw new HttpError(429, "group_rename_limit", "Un groupe se renomme une fois par semaine", { "Retry-After": String(Math.ceil((groupe.renomme_le + GROUPE_RENOMMER_JOURS * 86_400_000 - t) / 1000)) });
    }
    await verifierNomLibre(nom, groupe.id);
    try {
      await db.run("UPDATE groupes SET name = ?, name_key = ?, renomme_le = ? WHERE id = ?", [nom, nameKey(nom), t, groupe.id]);
    } catch (e) {
      if (String((e as Error)?.message ?? e).includes("UNIQUE") || String((e as Error)?.message ?? e).includes("constraint")) throw new HttpError(409, "group_name_taken", "Ce nom de groupe est déjà pris");
      throw e;
    }
    cacheGroupes.clear();
    return { nom };
  }
  async function decrire(req: Request, info: RequestInfo): Promise<unknown> {
    const { groupe } = await exigerChef(req, info);
    const d = descriptionDeGroupe((await readJson(req)).description);
    if (d === null) throw new HttpError(400, "invalid_group", `Description invalide (${GROUPE_DESCRIPTION_MAX} caractères au plus, du texte)`);
    await db.run("UPDATE groupes SET description = ? WHERE id = ?", [d, groupe.id]);
    return { description: d };
  }
  async function dissoudre(req: Request, info: RequestInfo): Promise<unknown> {
    const { groupe } = await exigerChef(req, info);
    await ecrire(dissoudreStatements(groupe.id));
    cacheGroupes.clear();
    return { dissous: true };
  }
  async function emblemePoser(req: Request, info: RequestInfo): Promise<unknown> {
    const { groupe } = await exigerChef(req, info);
    const octets = octetsDeBase64((await readJson(req)).image);
    let controle;
    try {
      if (!octets) throw new ImageRefusee("format");
      controle = controlerImage(octets);
    } catch (e) {
      if (e instanceof ImageRefusee) throw new HttpError(400, "invalid_image", e.message, {}, { raison: e.raison });
      throw e;
    }
    const hash = await avatars.poser("groupe", groupe.id, octets!, controle.mime);
    cacheGroupes.clear();
    return { avatar: hash };
  }
  async function emblemeRetirer(req: Request, info: RequestInfo): Promise<unknown> {
    const { groupe } = await exigerChef(req, info);
    await ecrire([{ sql: "DELETE FROM avatars WHERE kind = 'groupe' AND owner = ?", params: [groupe.id] }, proprietaireGroupe.copier(groupe.id, null)]);
    cacheGroupes.clear();
    return { avatar: null };
  }

  // --- Le classement des groupes -----------------------------------------------------------------------------------------------------
  const jourDemande = (brut: string | null): number => {
    if (brut === null) return platform.today();
    const d = parseDay(brut);
    if (d === null) throw new HttpError(400, "invalid_date", "Date attendue au format AAAA-MM-JJ");
    return d;
  };

  /** Les vues de tous les groupes d'un jour (Cumulé, puis chaque jeu), à partir du classement du jour gardé par le portail. */
  async function calculerVues(day: number): Promise<{ jours: VueGroupes[] }> {
    const v = vue();
    await v.charger();
    const ouverts = v.comptes(day);
    const c = await v.classementDe(day);
    // Les joueurs classés ce jour-là (au moins un jeu) : eux seuls peuvent faire compter un groupe.
    const classes = new Set<string>([...c.cumul.map((l) => l.id), ...(c.hauteurs ?? []).flatMap((h) => h.classes.map((x) => x.playerId))]);
    const ids = [...classes];
    const appartenance = new Map<string, string>(); // joueur → groupe, s'il compte ce jour-là
    for (let i = 0; i < ids.length; i += PAR_LOT) {
      const lot = ids.slice(i, i + PAR_LOT);
      const rows = await db.all<{ player_id: string; groupe: string; arrivee: number }>(`SELECT player_id, groupe, arrivee FROM groupe_membres WHERE player_id IN (${lot.map(() => "?").join(",")})`, lot);
      for (const r of rows) if (r.arrivee <= day) appartenance.set(r.player_id, r.groupe);
    }
    const groupesIds = [...new Set(appartenance.values())];
    const meta = new Map<string, { nom: string; avatar: string | null }>();
    for (let i = 0; i < groupesIds.length; i += PAR_LOT) {
      const lot = groupesIds.slice(i, i + PAR_LOT);
      const rows = await db.all<{ id: string; name: string; avatar: string | null; classement_masque: number }>(`SELECT id, name, avatar, classement_masque FROM groupes WHERE id IN (${lot.map(() => "?").join(",")})`, lot);
      for (const r of rows) if (r.classement_masque === 0) meta.set(r.id, { nom: r.name, avatar: r.avatar });
    }
    const parGroupe = (resultats: Iterable<ResultatMembre>): Map<string, ResultatMembre[]> => {
      const m = new Map<string, ResultatMembre[]>();
      for (const r of resultats) {
        const g = appartenance.get(r.id);
        if (!g || !meta.has(g)) continue;
        (m.get(g) ?? m.set(g, []).get(g)!).push(r);
      }
      return m;
    };
    const vueDe = (nom: string, sens: Sens, resultats: Iterable<ResultatMembre>): VueGroupes => {
      const lignes = [...parGroupe(resultats)].map(([id, r]) => ({ id, score: scoreDuGroupe(r, sens) }));
      const { classes: cl, moins } = classerLesGroupes(lignes, sens);
      return {
        vue: nom,
        sens,
        classes: cl.map((g) => ({ id: g.id, nom: meta.get(g.id)!.nom, avatar: meta.get(g.id)!.avatar, rang: g.rang, score: g.score.score!, classesN: g.score.classes })),
        moins: moins.map((g) => ({ id: g.id, nom: meta.get(g.id)!.nom, avatar: meta.get(g.id)!.avatar, classesN: g.score.classes })),
      };
    };
    const jours: VueGroupes[] = [];
    // Cumulé : ceux qui ont fini tous les jeux du jour au temps (la somme de leurs temps), comme le classement du jour.
    jours.push(vueDe("cumul", "temps", c.cumul.filter((l) => l.complet && l.cumulMs !== null).map((l) => ({ id: l.id, valeur: l.cumulMs as number, at: l.at }))));
    for (const j of ouverts) {
      if (v.estHauteur(j)) {
        const h = c.hauteurs?.find((x) => x.jeu === j.code);
        jours.push(vueDe(j.portail.site, "hauteur", (h?.classes ?? []).map((x) => ({ id: x.playerId, valeur: x.score?.valeur ?? 0, at: x.at }))));
      } else {
        const g = c.jeux.indexOf(j.code);
        jours.push(vueDe(j.portail.site, "temps", g < 0 ? [] : c.parJeu[g]!.map((l) => ({ id: l.id, valeur: l.resultats[g]!.tempsMs, at: l.resultats[g]!.at }))));
      }
    }
    return { jours };
  }
  async function vuesDuJour(day: number): Promise<{ jours: VueGroupes[] }> {
    const v = vue();
    await v.charger();
    const t = now();
    const gardee = cacheGroupes.get(day);
    if (gardee && gardee.jusque > t) return gardee.vues;
    const vues = calculerVues(day);
    cacheGroupes.set(day, { jusque: t + GARDE_MS, vues });
    vues.catch(() => cacheGroupes.delete(day));
    return vues;
  }
  async function jourClassable(day: number): Promise<void> {
    const v = vue();
    await v.charger();
    const avantLancement = v.premierJour <= platform.today() && day < v.premierJour;
    if (avantLancement || v.comptes(day).length === 0) throw new HttpError(404, "unknown_day", "Ce classement n'existe pas (encore)");
  }

  async function classement(info: RequestInfo, url: URL): Promise<WithHeaders> {
    await readHitAddress(info, "grcip", 600);
    const day = jourDemande(url.searchParams.get("date"));
    await jourClassable(day);
    const { jours } = await vuesDuJour(day);
    const demande = url.searchParams.get("vue") ?? "cumul";
    const un = jours.find((x) => x.vue === demande);
    if (!un) throw new HttpError(400, "invalid_view", "Vue attendue : cumul ou le dossier d'un jeu de ce jour");
    const ouvert = vue().jourOuvert(day);
    return new WithHeaders(
      { date: formatDay(day), ouvert, vue: un.vue, sens: un.sens, vues: jours.map((x) => x.vue), min: CLASSES_MIN, groupes: un.classes.map((g) => ({ rang: g.rang, id: g.id, nom: g.nom, ...(g.avatar ? { avatar: g.avatar } : {}), score: g.score, classes: g.classesN })), moins: un.moins.map((g) => ({ id: g.id, nom: g.nom, ...(g.avatar ? { avatar: g.avatar } : {}), classes: g.classesN })) },
      { "Cache-Control": "public, max-age=15, s-maxage=30" },
    );
  }

  /** La page publique d'un groupe : sa fiche et son rang du jour dans chaque vue. */
  async function page(info: RequestInfo, nomBrut: string, url: URL): Promise<WithHeaders> {
    await readHitAddress(info, "grpip", 600);
    let nom: string;
    try {
      nom = decodeURIComponent(nomBrut);
    } catch {
      throw new HttpError(404, "unknown_group", "Ce groupe n'existe pas");
    }
    const g = await db.first<LigneGroupe>("SELECT * FROM groupes WHERE name_key = ?", [nameKey(nom)]);
    if (!g) throw new HttpError(404, "unknown_group", "Ce groupe n'existe pas");
    const base = await fiche(g, null);
    let rangs: { vue: string; sens: Sens; rang: number | null; score: number | null; classes: number; sur: number }[] = [];
    let date: string | null = null;
    let ouvert = false;
    const day = jourDemande(url.searchParams.get("date"));
    try {
      await jourClassable(day);
      const { jours } = await vuesDuJour(day);
      date = formatDay(day);
      ouvert = vue().jourOuvert(day);
      if (g.classement_masque === 0) {
        rangs = jours.map((x) => {
          const i = x.classes.find((c) => c.id === g.id);
          const m = x.moins.find((c) => c.id === g.id);
          return { vue: x.vue, sens: x.sens, rang: i?.rang ?? null, score: i?.score ?? null, classes: i?.classesN ?? m?.classesN ?? 0, sur: x.classes.length };
        });
      }
    } catch (e) {
      if (!(e instanceof HttpError) || e.code !== "unknown_day") throw e;
    }
    // Le navigateur relit toujours (un joueur qui vient de rejoindre doit se voir tout de suite) ; Hosting garde la réponse 30 s, comme les classements.
    return new WithHeaders({ ...base, date, ouvert, classement: rangs, min: CLASSES_MIN }, { "Cache-Control": "public, max-age=0, s-maxage=30" });
  }

  // --- Le filtre « Mon groupe » des classements ---------------------------------------------------------------------------------------
  /** Les membres de mon groupe (hors moi) qui comptent ce jour-là, non masqués, avec leur pseudo : la liste que « Mon groupe » met à la place des amis. */
  async function membresPourClassement(id: string, day: number): Promise<{ id: string; name: string; ref: string; avatar?: string | null }[]> {
    const m = await db.first<{ groupe: string }>("SELECT groupe FROM groupe_membres WHERE player_id = ?", [id]);
    if (!m) return [];
    const rows = (await membresDe(m.groupe)).filter((x) => x.player_id !== id && x.hidden === 0 && x.arrivee <= day);
    return Promise.all(rows.map(async (x) => ({ id: x.player_id, name: x.name, ref: x.ref ?? (await refOfPlayer(x.player_id)), avatar: x.avatar })));
  }

  // --- Administration -----------------------------------------------------------------------------------------------------------------
  const confirme = (corps: Record<string, unknown>) => {
    if (corps.confirmer !== true) throw new HttpError(400, "invalid_action", "Confirmation attendue");
  };
  const iso = (t: number) => new Date(t).toISOString();

  async function listerAdmin(url: URL): Promise<unknown> {
    const q = nameKey(url.searchParams.get("q") ?? "").slice(0, 40);
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const decalage = (page - 1) * GROUPES_ADMIN_PAR_PAGE;
    const colonnes = "g.id AS id, g.name AS name, g.chef AS chef, g.classement_masque AS masque, g.cree_le AS cree_le, (SELECT COUNT(*) FROM groupe_membres m WHERE m.groupe = g.id) AS membres";
    type Ligne = { id: string; name: string; chef: string; masque: number; cree_le: number; membres: number };
    const rows = q
      ? await db.all<Ligne>(`SELECT ${colonnes} FROM groupes g WHERE g.name_key >= ? AND g.name_key < ? ORDER BY g.name_key LIMIT ? OFFSET ?`, [q, q + "￿", GROUPES_ADMIN_PAR_PAGE + 1, decalage])
      : await db.all<Ligne>(`SELECT ${colonnes} FROM groupes g ORDER BY g.cree_le DESC LIMIT ? OFFSET ?`, [GROUPES_ADMIN_PAR_PAGE + 1, decalage]);
    return { page, suivante: rows.length > GROUPES_ADMIN_PAR_PAGE, groupes: rows.slice(0, GROUPES_ADMIN_PAR_PAGE).map((r) => ({ id: r.id, nom: r.name, membres: r.membres, masque: r.masque === 1, creeLe: iso(r.cree_le) })) };
  }
  async function ficheAdmin(id: string): Promise<unknown> {
    const g = await groupeParId(id.toLowerCase());
    if (!g) throw new HttpError(404, "unknown_group", "Ce groupe n'existe pas");
    const membres = await membresDe(g.id);
    const emblem = await db.first<{ statut: string; hash: string }>("SELECT statut, hash FROM avatars WHERE kind = 'groupe' AND owner = ?", [g.id]);
    return {
      id: g.id,
      nom: g.name,
      description: g.description,
      creeLe: iso(g.cree_le),
      renommeLe: g.renomme_le === null ? null : iso(g.renomme_le),
      masque: g.classement_masque === 1,
      emblem: emblem ? { statut: emblem.statut, hash: emblem.hash } : null,
      membres: await Promise.all(membres.map(async (m) => ({ ...(await publicMembre(m, g.chef)), masque: m.hidden === 1 }))),
    };
  }
  async function agirAdmin(action: string, id: string, admin: string, corps: Record<string, unknown>): Promise<unknown> {
    confirme(corps);
    const g = await groupeParId(id.toLowerCase());
    if (!g) throw new HttpError(404, "unknown_group", "Ce groupe n'existe pas");
    const t = now();
    const cible = `groupe · ${g.name} · ${g.id}`;
    cacheGroupes.clear();
    if (action === "renommer") {
      const nom = nomLibre(corps.nom);
      await verifierNomLibre(nom, g.id);
      await ecrire([{ sql: "UPDATE groupes SET name = ?, name_key = ? WHERE id = ?", params: [nom, nameKey(nom), g.id] }, ecrireJournal({ at: t, admin, action: "renommer un groupe", cible, avant: { nom: g.name }, apres: { nom } })]);
      return { nom };
    }
    if (action === "emblem-retirer") {
      await ecrire([
        { sql: "UPDATE avatars SET statut = 'retire', data = '', revu = 1, maj_le = ? WHERE kind = 'groupe' AND owner = ?", params: [t, g.id] },
        proprietaireGroupe.copier(g.id, null),
        ecrireJournal({ at: t, admin, action: "retirer l'emblème d'un groupe", cible }),
      ]);
      return { emblem: null };
    }
    if (action === "masquer") {
      const masque = corps.masque === true;
      await ecrire([{ sql: "UPDATE groupes SET classement_masque = ? WHERE id = ?", params: [masque ? 1 : 0, g.id] }, ecrireJournal({ at: t, admin, action: masque ? "masquer un groupe des classements" : "remontrer un groupe dans les classements", cible })]);
      return { masque };
    }
    if (action === "retirer" || action === "chef") {
      const m = await membreParRef(g.id, corps.ref);
      if (action === "chef") {
        await ecrire([{ sql: "UPDATE groupes SET chef = ? WHERE id = ?", params: [m.player_id, g.id] }, ecrireJournal({ at: t, admin, action: "changer le chef d'un groupe", cible, apres: { pseudo: m.name } })]);
        return { chef: true };
      }
      const instructions: Statement[] = [{ sql: "DELETE FROM groupe_membres WHERE player_id = ? AND groupe = ?", params: [m.player_id, g.id] }];
      if (g.chef === m.player_id) {
        const suivant = await plusAncien(db, g.id, m.player_id);
        instructions.push(...(suivant ? [{ sql: "UPDATE groupes SET chef = ? WHERE id = ?", params: [suivant, g.id] }] : dissoudreStatements(g.id)));
      }
      await ecrire([...instructions, ecrireJournal({ at: t, admin, action: "retirer un membre d'un groupe", cible, apres: { pseudo: m.name } })]);
      return { retire: true };
    }
    if (action === "dissoudre") {
      if (corps.nom !== g.name) throw new HttpError(400, "invalid_action", "Retape le nom du groupe pour le dissoudre");
      await ecrire([...dissoudreStatements(g.id), ecrireJournal({ at: t, admin, action: "dissoudre un groupe", cible })]);
      return { dissous: true };
    }
    throw new HttpError(404, "not_found", "Route inconnue");
  }

  /** `reste` : ce qui suit `/api/admin/` ; `undefined` : pas aux groupes. */
  async function routeAdmin(reste: string, req: Request, admin: string, url: URL, lire: () => Promise<Record<string, unknown>>): Promise<unknown> {
    if (reste === "groupes") {
      if (req.method !== "GET") throw new HttpError(405, "method_not_allowed", "GET attendu");
      return await listerAdmin(url);
    }
    const m = /^groupes\/([0-9a-f]{12})(?:\/(renommer|emblem-retirer|retirer|chef|masquer|dissoudre))?$/.exec(reste);
    if (!m) return undefined;
    if (!m[2]) {
      if (req.method !== "GET") throw new HttpError(405, "method_not_allowed", "GET attendu");
      return await ficheAdmin(m[1]!);
    }
    if (req.method !== "POST") throw new HttpError(405, "method_not_allowed", "POST attendu");
    return await agirAdmin(m[2], m[1]!, admin, await lire());
  }

  // --- Aiguillage ----------------------------------------------------------------------------------------------------------------------
  async function route(path: string, req: Request, url: URL, info: RequestInfo): Promise<unknown> {
    if (!path.startsWith("/api/groupes")) return undefined;
    const sous = path.slice("/api/groupes".length);
    const get = () => {
      if (req.method !== "GET") throw new HttpError(405, "method_not_allowed", "GET attendu");
    };
    const post = () => {
      if (req.method !== "POST") throw new HttpError(405, "method_not_allowed", "POST attendu");
    };
    if (sous === "") {
      post();
      return await creer(req, info);
    }
    if (sous === "/moi") {
      get();
      return await moi(req, info);
    }
    if (sous === "/classement") {
      get();
      return await classement(info, url);
    }
    let m = /^\/nom\/([^/]+)$/.exec(sous);
    if (m) {
      get();
      return await page(info, m[1]!, url);
    }
    m = /^\/invitation\/([^/]+)$/.exec(sous);
    if (m) {
      get();
      return await voirInvitation(info, m[1]!);
    }
    if (sous === "/emblem") {
      if (req.method === "POST") return await emblemePoser(req, info);
      if (req.method === "DELETE") return await emblemeRetirer(req, info);
      throw new HttpError(405, "method_not_allowed", "POST ou DELETE attendu");
    }
    const actions: Record<string, (r: Request, i: RequestInfo) => Promise<unknown>> = { "/rejoindre": rejoindre, "/quitter": quitter, "/renouveler": renouveler, "/retirer": retirer, "/chef": passerLeChef, "/renommer": renommer, "/decrire": decrire, "/dissoudre": dissoudre };
    const action = actions[sous];
    if (action) {
      post();
      return await action(req, info);
    }
    throw new HttpError(404, "not_found", "Route inconnue");
  }

  /** Le nombre de membres de mon groupe (`null` : je n'en ai pas) : deux lectures indexées (clé primaire, puis `groupe_membres_by_groupe`). */
  async function tailleDuGroupe(id: string): Promise<number | null> {
    const m = await db.first<{ groupe: string }>("SELECT groupe FROM groupe_membres WHERE player_id = ?", [id]);
    return m ? await nombreDeMembres(m.groupe) : null;
  }

  return { route, routeAdmin, membresPourClassement, tailleDuGroupe, oublier: () => cacheGroupes.clear(), aujourdhuiDebut: () => parisDayStart(platform.today()) };
}

export type Groupes = ReturnType<typeof createGroupes>;
