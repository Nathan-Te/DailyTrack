import { dailyCircuit } from "@cdj/sim";
import { sha, type EmpreinteJour } from "./empreintes";

// Lot R6 : l'empreinte de ce que DailyTrack SERT pour un jour : le circuit d'origine du jour (`dailyCircuit(jour)`) — identifiant (donc version du générateur du jour), texte, temps du pilote,
// médailles, palette, thème. Le planning de l'admin (variantes) vit en base et n'est pas du code : un jour joué n'est jamais remplacé (409 `day_started`). Lot K4b : le module de Track
// (`jours.fabrication.empreinte` de sa fiche).

/** L'empreinte du circuit d'origine d'un jour de Track (`dossier` : sans objet, Track n'a pas de fichier par jour). */
export function empreinteJour(day: number, _dossier?: string | null): EmpreinteJour {
  const c = dailyCircuit(day);
  return {
    id: c.track.id,
    h: sha([c.track.id, c.spec, c.authorMs, c.medals, c.palette, c.theme, c.attempt, c.figures.map((f) => [f.name, f.variant, f.from, f.to])]),
    ok: !c.fallback,
  };
}
