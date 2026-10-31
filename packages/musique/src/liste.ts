import { JEUX_MUSIQUE, type JeuMusique, type ListeServie, type PisteServie } from "./types";

// La lecture prudente de `liste.json` côté navigateur : un fichier qui n'est pas ce qu'on attend (une page d'erreur qu'un serveur rend à la place, un JSON d'une autre
// version) donne `null`, jamais une exception. Les adresses de fichier ne sortent jamais du dossier de la musique.

const FICHIER = /^[a-z0-9][a-z0-9-]*\.m4a$/;

function piste(p: unknown): PisteServie | null {
  const o = (p ?? {}) as Record<string, unknown>;
  const jeux = Array.isArray(o.jeux) ? o.jeux.filter((j): j is JeuMusique => (JEUX_MUSIQUE as readonly string[]).includes(j as string)) : [];
  if (typeof o.id !== "string" || typeof o.titre !== "string" || typeof o.artiste !== "string" || typeof o.credit !== "string") return null;
  if (typeof o.fichier !== "string" || !FICHIER.test(o.fichier) || jeux.length === 0) return null;
  const scenes = Array.isArray(o.scenes) ? o.scenes.filter((s): s is string => typeof s === "string" && /^[a-z0-9]+(:[a-z0-9-]+)?$/.test(s)) : [];
  const nombre = (v: unknown, defaut: number) => (typeof v === "number" && Number.isFinite(v) ? v : defaut);
  const poids = nombre(o.poids, 1);
  return { id: o.id, titre: o.titre, artiste: o.artiste, credit: o.credit, fichier: o.fichier, jeux, scenes, sha: typeof o.sha === "string" ? o.sha : "", poids: poids > 0 ? poids : 1, volumeDb: nombre(o.volumeDb, 0), duree: nombre(o.duree, 0) };
}

/** La liste servie, ou `null` si ce n'en est pas une. Les morceaux illisibles sont écartés. */
export function lireListe(brut: unknown): ListeServie | null {
  const o = brut as { version?: unknown; debit?: unknown; pistes?: unknown } | null;
  if (!o || o.version !== 1 || !Array.isArray(o.pistes)) return null;
  const pistes = o.pistes.map(piste).filter((p): p is PisteServie => p !== null);
  return { version: 1, debit: typeof o.debit === "string" ? o.debit : "", pistes };
}

/** Les morceaux d'un jeu, dans l'ordre de la liste. */
export function pistesDuJeu(liste: ListeServie, jeu: JeuMusique): PisteServie[] {
  return liste.pistes.filter((p) => p.jeux.includes(jeu));
}

/** « Titre — Artiste », ce que les réglages montrent sous « En écoute ». */
export function titreAffiche(p: Pick<PisteServie, "titre" | "artiste">): string {
  return `${p.titre} — ${p.artiste}`;
}
