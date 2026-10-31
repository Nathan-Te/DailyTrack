import { createHash } from "node:crypto";
import { creditDe, resoudreJeux } from "../src/description";
import type { Description, ListeServie, PisteServie } from "../src/types";

// La préparation des morceaux (Node, lot « musique ») : la logique pure de `npm run musique` — nom du fichier préparé, arguments de ffmpeg, lecture de la mesure de volume,
// liste servie, bloc des crédits des mentions légales. Les accès au disque et à ffmpeg sont dans `scripts/musique.ts` ; tout ce qui se calcule est ici, donc testé.

/** Ce qui change le fichier préparé : si la préparation change (débit, volume visé), cette marque change et tout est refait. */
export const PREPARATION = "aac-96k-44100-stereo-i18-v1";
export const DEBIT = "96k";
/** Le volume perçu visé (LUFS) : assez bas pour que la musique passe sous les moteurs et les effets des jeux. */
export const LUFS_VISE = -18;
export const PIC_VRAI_MAX = -1.5;

/** L'empreinte d'un fichier source (SHA-256, hexadécimal). */
export function empreinte(octets: Uint8Array): string {
  return createHash("sha256").update(octets).digest("hex");
}

/** Le nom du fichier préparé : `<id>-<8 premiers caractères de l'empreinte de (source + préparation)>.m4a`. Changer la source ou la préparation change le nom : le cache peut être sans fin. */
export function nomServi(id: string, empreinteSource: string): string {
  const h = createHash("sha256").update(`${empreinteSource}|${PREPARATION}`).digest("hex").slice(0, 8);
  return `${id}-${h}.m4a`;
}

/** Première passe de ffmpeg : mesurer le volume du morceau (rien n'est écrit). */
export function argsMesure(source: string): string[] {
  return ["-hide_banner", "-nostdin", "-i", source, "-vn", "-af", `loudnorm=I=${LUFS_VISE}:TP=${PIC_VRAI_MAX}:LRA=11:print_format=json`, "-f", "null", "-"];
}

export interface MesureVolume {
  input_i: string;
  input_tp: string;
  input_lra: string;
  input_thresh: string;
  target_offset: string;
}

/** La mesure de volume que ffmpeg écrit en fin de sortie (un objet JSON) ; `null` si elle manque ou est incomplète. */
export function lireMesure(sortieErreur: string): MesureVolume | null {
  const debut = sortieErreur.lastIndexOf("{");
  const fin = sortieErreur.lastIndexOf("}");
  if (debut < 0 || fin < debut) return null;
  try {
    const o = JSON.parse(sortieErreur.slice(debut, fin + 1)) as Record<string, unknown>;
    const champs = ["input_i", "input_tp", "input_lra", "input_thresh", "target_offset"] as const;
    for (const c of champs) if (typeof o[c] !== "string" || !Number.isFinite(Number(o[c]))) return null;
    return o as unknown as MesureVolume;
  } catch {
    return null;
  }
}

/**
 * Deuxième passe : le morceau converti en AAC (dans un conteneur MP4, `.m4a` : lu partout, iPhone compris), 96 kbit/s en stéréo à 44,1 kHz, volume ramené à `LUFS_VISE` d'après
 * la mesure, métadonnées retirées, début du fichier prêt pour la lecture en flux (`faststart`).
 */
export function argsEncodage(source: string, sortie: string, m: MesureVolume): string[] {
  const filtre = `loudnorm=I=${LUFS_VISE}:TP=${PIC_VRAI_MAX}:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  return ["-hide_banner", "-nostdin", "-y", "-i", source, "-vn", "-map_metadata", "-1", "-af", filtre, "-ar", "44100", "-ac", "2", "-c:a", "aac", "-b:a", DEBIT, "-movflags", "+faststart", sortie];
}

export interface InfoPreparee {
  /** Le nom du fichier préparé. */
  fichier: string;
  /** Durée en secondes. */
  duree: number;
  /** L'empreinte (SHA-256) du fichier source : les sources ne sont pas dans le dépôt, la liste la garde. */
  sha: string;
}

/** La liste servie au jeu, à partir de la description (vérifiée) et de ce que la préparation a rendu pour chaque morceau (par id). */
export function construireListe(desc: Description, infos: ReadonlyMap<string, InfoPreparee>): ListeServie {
  const pistes: PisteServie[] = desc.pistes.map((p) => {
    const info = infos.get(p.id);
    if (!info) throw new Error(`morceau « ${p.id} » : pas de fichier préparé`);
    return {
      id: p.id,
      titre: p.titre.trim(),
      artiste: p.artiste.trim(),
      credit: creditDe(p),
      fichier: info.fichier,
      jeux: resoudreJeux(p.jeux),
      scenes: [...(p.scenes ?? [])],
      sha: info.sha,
      poids: p.poids ?? 1,
      volumeDb: p.volumeDb ?? 0,
      duree: Math.round(info.duree * 10) / 10,
    };
  });
  return { version: 1, debit: DEBIT, pistes };
}

/** Le texte de `liste.json` (stable : le même contenu donne le même texte, pour que le dépôt ne bouge pas pour rien). */
export function texteListe(l: ListeServie): string {
  return `${JSON.stringify(l, null, 2)}\n`;
}

const echapper = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const MARQUE_DEBUT = "<!-- musique:debut -->";
export const MARQUE_FIN = "<!-- musique:fin -->";

/** Le bloc des crédits des pages de mentions légales, entre les deux marques. Mêmes éléments de liste dans les deux langues ; le texte du crédit est celui de l'auteur. */
export function blocCredits(l: ListeServie, langue: "fr" | "en"): string {
  const corps =
    l.pistes.length === 0
      ? `<p>${langue === "fr" ? "Aucun morceau n'est publié pour l'instant." : "No track is published for now."}</p>`
      : `<ul data-credits-musique>\n${l.pistes.map((p) => `        <li data-piste="${echapper(p.id)}">${echapper(p.credit)}</li>`).join("\n")}\n      </ul>`;
  return `${MARQUE_DEBUT}\n      ${corps}\n      ${MARQUE_FIN}`;
}

/** Remplace ce qui est entre les marques d'une page ; lève si les marques manquent (la page doit les porter). */
export function injecterCredits(html: string, bloc: string): string {
  const a = html.indexOf(MARQUE_DEBUT);
  const b = html.indexOf(MARQUE_FIN);
  if (a < 0 || b < a) throw new Error("la page des mentions n'a pas les marques <!-- musique:debut --> et <!-- musique:fin -->");
  return html.slice(0, a) + bloc + html.slice(b + MARQUE_FIN.length);
}

/**
 * Dit ce qui n'est pas à jour entre la description, les fichiers préparés et la liste servie (vide : tout est à jour). `shaDe` rend l'empreinte de la source d'un morceau : celle du
 * fichier s'il est là, sinon celle que la liste a gardée (les sources ne sont pas commitées : la CI ne les a pas).
 */
export function ecartsAvecLaListe(desc: Description, listeActuelle: ListeServie | null, shaDe: (p: Description["pistes"][number]) => string | null, servis: ReadonlySet<string>): string[] {
  const ecarts: string[] = [];
  const parId = new Map((listeActuelle?.pistes ?? []).map((p) => [p.id, p] as const));
  for (const p of desc.pistes) {
    const actuel = parId.get(p.id);
    const sha = shaDe(p);
    if (!actuel) {
      ecarts.push(`« ${p.id} » n'est pas dans la liste servie`);
      continue;
    }
    if (!sha) {
      ecarts.push(`« ${p.id} » : ni la source ni son empreinte ne sont connues`);
      continue;
    }
    const attendu = nomServi(p.id, sha);
    if (actuel.fichier !== attendu) ecarts.push(`« ${p.id} » : la source ou la préparation a changé depuis la dernière préparation`);
    if (!servis.has(attendu)) ecarts.push(`« ${p.id} » : le fichier préparé ${attendu} manque`);
    const voulu = construireListe({ pistes: [p] }, new Map([[p.id, { fichier: actuel.fichier, duree: actuel.duree, sha }]])).pistes[0]!;
    const cles = ["titre", "artiste", "credit", "jeux", "scenes", "poids", "volumeDb", "sha"] as const;
    if (cles.some((k) => JSON.stringify(voulu[k]) !== JSON.stringify(actuel[k]))) ecarts.push(`« ${p.id} » : sa description (titre, jeux, scènes, licence…) n'est plus celle de la liste : relance \`npm run musique\``);
  }
  for (const id of parId.keys()) if (!desc.pistes.some((p) => p.id === id)) ecarts.push(`« ${id} » est dans la liste servie mais plus dans musiques.json`);
  return ecarts;
}
