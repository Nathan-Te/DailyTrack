// Le seul accès du portail au stockage du navigateur (lot I1, comme `gameStorage()` des jeux) : `localStorage`, ou `null` s'il est refusé
// (navigation privée stricte, réglages). Le portail y lit le pseudo du profil commun et y écrit la langue choisie (`cdj:langue`) ; il est sur
// la même origine que les jeux, donc la langue et le profil sont communs. Rien d'autre.
export function stockageDuPortail(): Storage | null {
  try {
    const s = globalThis.localStorage;
    s.getItem("cdj:langue");
    return s;
  } catch {
    return null;
  }
}
