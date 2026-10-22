import { SALON_SESSION_MS } from "@cdj/sim";

// Les adresses du Salon (lot 26), dans leur propre fichier (lot 36) : l'accueil et la pause y mènent dès le premier écran, alors que le reste de la logique du Salon
// (`salon.ts`) n'est chargé que dans le Salon.

/** Durée d'une session d'après `?salonMinutes=N` (essais et démo seulement) ; la durée normale sinon. */
export function sessionMsFromParams(search: string): number {
  const raw = new URLSearchParams(search).get("salonMinutes");
  const minutes = raw === null ? NaN : Number(raw);
  return Number.isFinite(minutes) && minutes >= 0.5 && minutes <= 60 ? Math.round(minutes * 60_000) : SALON_SESSION_MS;
}

/**
 * Adresse pour passer au Salon (`salon = true`) ou revenir au circuit du jour : on garde les réglages d'affichage et de test (`api`,
 * `debug`, `touch`, `quality`, `salonMinutes`…), jamais le choix d'un circuit (date, thème, scénario).
 */
export function modeHref(search: string, salon: boolean): string {
  const p = new URLSearchParams(search);
  for (const k of ["mode", "scenario", "seed", "day", "theme", "variant", "spec", "f", "v", "m", "today", "salonAt", "home"]) p.delete(k);
  if (salon) p.set("mode", "salon");
  const q = p.toString().replace(/=(?=&|$)/g, "");
  return q ? `?${q}` : "?";
}
