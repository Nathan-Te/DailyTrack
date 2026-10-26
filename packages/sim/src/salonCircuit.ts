import { bestPilotRun } from "./autopilot";
import { createTestTrack } from "./circuits";
import { generateCircuit } from "./generator";
import { medalsFor } from "./medals";
import { SALON_SEED_BASE, salonTheme, salonTrackId, type SalonCircuit } from "./salon";
import { themeByName } from "./themes";

// Le circuit d'une session du Salon (lot 26), dans son propre fichier (lot 36) : il tire le générateur et le pilote automatique, que le jeu ne charge pas au premier
// écran (les sessions arrivent d'un fil de travail) ; le reste du Salon (numéro et horloge d'une session, thème, identifiant) est dans `salon.ts`.

/** Le circuit d'une session : même générateur, mêmes thèmes et mêmes durées que le circuit du jour, graine propre au Salon. */
export function salonCircuit(session: number): SalonCircuit {
  const theme = themeByName(salonTheme(session))!;
  const id = salonTrackId(session);
  const found = generateCircuit(SALON_SEED_BASE + session, theme, 0, id);
  // Lot R9 : la rediffusion du pilote (`authorReplay`) ne fait pas partie du circuit d'une session (elle ne sert qu'au refus des copies du circuit du jour).
  if (found) {
    const { authorReplay: _authorReplay, ...circuit } = found;
    return { session, id, ...circuit, palette: theme.palette, theme: theme.name, fallback: false };
  }
  const track = createTestTrack();
  const pilot = bestPilotRun(track);
  const authorMs = pilot ? pilot.finishMs : 40_000;
  return { session, id: track.id, spec: "", figures: [], track, authorMs, medals: medalsFor(authorMs, SALON_SEED_BASE + session), palette: theme.palette, theme: theme.name, fallback: true };
}
