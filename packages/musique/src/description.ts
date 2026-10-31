import { FORMAT_SCENE, SCENES, sceneConnue } from "./scenes";
import { JEUX_DE_TOUS, JEUX_MUSIQUE, LICENCES, type Description, type JeuMusique, type Licence, type PisteDescription } from "./types";

// La vérification de `musique/musiques.json` : pure, sans accès au disque (la commande lui prête `fichierExiste`). Elle refuse un morceau sans licence, avec un jeu
// inconnu, un identifiant mal formé ou en double, un champ qu'elle ne connaît pas (une faute de frappe ne passe pas en silence). Les messages sont en français :
// c'est Nathan qui les lit.

export const EXTENSIONS_SOURCE = ["mp3", "wav", "flac", "ogg", "m4a", "aac", "opus"] as const;
export const ID_VALIDE = /^[a-z0-9][a-z0-9-]{1,39}$/;
const CHAMPS = ["id", "titre", "artiste", "fichier", "jeux", "scenes", "licence", "credit", "source", "poids", "volumeDb"];
/** Les licences qui exigent de dire d'où vient le morceau. */
const SOURCE_EXIGEE: readonly Licence[] = ["CC0", "CC-BY-4.0", "achetee"];

export const POIDS_MAX = 10;
export const VOLUME_DB_MAX = 12;

const texte = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";

/** Les jeux d'un morceau, `tous` développé, sans doublon, dans l'ordre de `JEUX_MUSIQUE`. */
export function resoudreJeux(jeux: readonly string[]): JeuMusique[] {
  const out = new Set<JeuMusique>();
  for (const j of jeux) {
    if (j === "tous") for (const x of JEUX_DE_TOUS) out.add(x);
    else if ((JEUX_MUSIQUE as readonly string[]).includes(j)) out.add(j as JeuMusique);
  }
  return JEUX_MUSIQUE.filter((j) => out.has(j));
}

/** Le crédit écrit pour un morceau : celui de Nathan, sinon « Titre — Artiste » (avec « CC0 » pour un morceau du domaine public). */
export function creditDe(p: Pick<PisteDescription, "titre" | "artiste" | "licence" | "credit">): string {
  if (texte(p.credit)) return p.credit.trim();
  return p.licence === "CC0" ? `« ${p.titre} » — ${p.artiste} (CC0)` : `« ${p.titre} » — ${p.artiste}`;
}

export interface Verification {
  erreurs: string[];
  /** Les morceaux lus (même ceux qui ont une erreur, pour le message), dans l'ordre du fichier. */
  pistes: PisteDescription[];
}

export interface OptionsVerification {
  /** Le fichier source existe (chemin relatif à `musique/pistes/`), ou, les sources n'étant pas commitées, le morceau `id` a déjà son fichier préparé. */
  fichierExiste(chemin: string, id: string): boolean;
}

/** Vérifie une description lue (le JSON de `musiques.json`). Une description sans erreur peut être préparée. */
export function verifierDescription(brut: unknown, opts: OptionsVerification): Verification {
  const erreurs: string[] = [];
  const liste = (brut as { pistes?: unknown } | null)?.pistes;
  if (!Array.isArray(liste)) return { erreurs: ["musiques.json : il faut un objet { \"pistes\": [ … ] }"], pistes: [] };
  const vus = new Set<string>();
  const pistes: PisteDescription[] = [];
  liste.forEach((p: unknown, i) => {
    const o = (p ?? {}) as Record<string, unknown>;
    const nom = texte(o.id) ? `« ${o.id} »` : `n° ${i + 1}`;
    const err = (m: string) => erreurs.push(`Morceau ${nom} : ${m}`);
    for (const k of Object.keys(o)) if (!CHAMPS.includes(k)) err(`champ inconnu « ${k} » (champs permis : ${CHAMPS.join(", ")})`);
    if (!texte(o.id) || !ID_VALIDE.test(o.id)) err("« id » manquant ou mal formé (2 à 40 caractères : a-z, 0-9 et « - », sans espace ni majuscule)");
    else if (vus.has(o.id)) err("« id » déjà utilisé par un autre morceau");
    else vus.add(o.id);
    if (!texte(o.titre)) err("« titre » manquant");
    if (!texte(o.artiste)) err("« artiste » manquant");
    if (!texte(o.fichier)) err("« fichier » manquant");
    else {
      const f = o.fichier.trim();
      const ext = f.split(".").pop()?.toLowerCase() ?? "";
      if (f.startsWith("/") || f.includes("..") || f.includes("\\")) err("« fichier » doit être un nom de fichier de musique/pistes/ (sans « .. », sans « / » au début)");
      else if (!(EXTENSIONS_SOURCE as readonly string[]).includes(ext)) err(`« fichier » : format « .${ext} » non lu (permis : ${EXTENSIONS_SOURCE.join(", ")})`);
      else if (!opts.fichierExiste(f, texte(o.id) ? o.id : "")) err(`le fichier « musique/pistes/${f} » n'existe pas (les sources restent sur ton ordinateur : dépose-le dans ce dossier avant de lancer la commande)`);
    }
    if (!Array.isArray(o.jeux) || o.jeux.length === 0) err("« jeux » : au moins un jeu (track, jump, tower, portail) ou « tous »");
    else
      for (const j of o.jeux)
        if (typeof j !== "string" || (j !== "tous" && !(JEUX_MUSIQUE as readonly string[]).includes(j))) err(`« jeux » : le jeu « ${String(j)} » est inconnu (permis : ${JEUX_MUSIQUE.join(", ")}, tous)`);
    if (o.scenes !== undefined) {
      const jeuxDuMorceau = Array.isArray(o.jeux) ? resoudreJeux(o.jeux.filter((j): j is string => typeof j === "string")) : [];
      if (!Array.isArray(o.scenes) || o.scenes.length === 0) err("« scenes » : une liste d'au moins une scène (menu, theme:nuit…), ou rien pour « partout »");
      else
        for (const s of o.scenes) {
          if (typeof s !== "string" || !FORMAT_SCENE.test(s)) err(`« scenes » : « ${String(s)} » n'est pas une scène (menu, ou theme:<code>)`);
          else if (jeuxDuMorceau.length > 0 && !sceneConnue(s, jeuxDuMorceau)) err(`« scenes » : « ${s} » n'existe dans aucun de ses jeux (${jeuxDuMorceau.map((j) => `${j} : ${SCENES[j].join(", ")}`).join(" · ")})`);
        }
    }
    if (!texte(o.licence)) err(`« licence » manquante : sans licence, un morceau n'est jamais publié (permis : ${LICENCES.join(", ")})`);
    else if (!(LICENCES as readonly string[]).includes(o.licence)) err(`« licence » : « ${o.licence} » n'est pas admise (permis : ${LICENCES.join(", ")})`);
    else {
      if (o.licence === "CC-BY-4.0" && !texte(o.credit)) err("« credit » obligatoire en CC-BY-4.0 : le texte exact que l'auteur exige");
      if (SOURCE_EXIGEE.includes(o.licence as Licence) && !texte(o.source)) err(`« source » obligatoire en ${o.licence} : l'adresse du morceau (ou la référence de l'achat)`);
    }
    if (o.credit !== undefined && !texte(o.credit)) err("« credit » ne peut pas être vide");
    if (o.poids !== undefined && !(typeof o.poids === "number" && Number.isFinite(o.poids) && o.poids > 0 && o.poids <= POIDS_MAX)) err(`« poids » : un nombre de 0 (exclu) à ${POIDS_MAX}`);
    if (o.volumeDb !== undefined && !(typeof o.volumeDb === "number" && Number.isFinite(o.volumeDb) && Math.abs(o.volumeDb) <= VOLUME_DB_MAX)) err(`« volumeDb » : un nombre de décibels entre −${VOLUME_DB_MAX} et ${VOLUME_DB_MAX}`);
    pistes.push(o as unknown as PisteDescription);
  });
  return { erreurs, pistes };
}

/** `Description` typée d'une description sans erreur. */
export function descriptionValide(brut: unknown, opts: OptionsVerification): Description {
  const v = verifierDescription(brut, opts);
  if (v.erreurs.length > 0) throw new Error(v.erreurs.join("\n"));
  return { pistes: v.pistes };
}
