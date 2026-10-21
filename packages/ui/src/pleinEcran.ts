// Lot I7 (plateforme) : **la seule logique de plein écran de la plateforme** — Track et Jump, leurs pauses, leurs accueils et leurs boutons en partie s'en
// servent, plus aucune copie dans un jeu. Ce module ne garde rien et n'écrit nulle part : il lit la page (`document`, `screen`, `matchMedia`, `navigator`) ;
// les tests la remplacent (`vi.stubGlobal`).

/** Le site est ouvert comme une application (icône « Ajouter à l'écran d'accueil ») : il n'a déjà ni barre d'adresse ni besoin du plein écran. */
export function modeApplication(): boolean {
  return matchMedia("(display-mode: standalone)").matches;
}

/** Le plein écran est-il à proposer ici ? Non si l'API n'existe pas (iPhone) ou si le site est déjà une application. */
export function pleinEcranPossible(): boolean {
  return !modeApplication() && document.fullscreenEnabled;
}

/** Le plein écran est-il en cours ? */
export function pleinEcranActif(): boolean {
  return !!document.fullscreenElement;
}

/**
 * Entre en plein écran (et essaie de verrouiller le paysage : les deux jeux s'y jouent) ou en sort. Ne lève jamais : un refus du navigateur laisse
 * le jeu tel quel, sans message ; un verrou refusé (presque partout hors Android) est ignoré.
 */
export async function basculerPleinEcran(): Promise<void> {
  try {
    if (pleinEcranActif()) return void (await document.exitFullscreen());
    await document.documentElement.requestFullscreen({ navigationUI: "hide" });
  } catch {
    return;
  }
  try {
    await (screen.orientation as { lock?: (o: string) => Promise<void> } | undefined)?.lock?.("landscape");
  } catch {
    /* verrou refusé : ignoré */
  }
}

/** Appelle `cb` à chaque entrée ou sortie du plein écran. */
export function surChangementPleinEcran(cb: () => void): void {
  document.addEventListener("fullscreenchange", cb);
}

/** L'astuce « Partager › Sur l'écran d'accueil » a-t-elle lieu d'être ? Sur un iPhone qui n'a pas de plein écran, hors du mode application. */
export function astuceIphoneAPropos(): boolean {
  return /iPhone|iPod/.test(navigator.userAgent) && !pleinEcranPossible() && !modeApplication();
}
