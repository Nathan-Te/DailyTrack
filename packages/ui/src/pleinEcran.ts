// Lot I7 (plateforme) : **la seule logique de plein écran de la plateforme** — Track et Jump, leurs pauses, leurs accueils et leurs boutons en partie s'en
// servent, plus aucune copie dans un jeu. Ce module ne garde rien et n'écrit nulle part : il lit la page (`document`, `screen`, `matchMedia`, `navigator`) ;
// les tests la remplacent (`vi.stubGlobal`).

/** Le site est ouvert comme une application (icône « Ajouter à l'écran d'accueil ») : il n'a déjà ni barre d'adresse ni besoin du plein écran. */
export function modeApplication(): boolean {
  // `navigator.standalone` : Safari sur iPhone, qui l'a avant `display-mode` (toujours les deux : l'un ou l'autre suffit).
  return matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
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

/**
 * **Lot 53** : le plein écran passe-t-il ici par « Sur l'écran d'accueil » ? Oui sur un écran tactile **sans plein écran de page** (l'API Fullscreen n'est ouverte
 * qu'aux vidéos sur iPhone) quand le site n'est pas déjà une application. Détecté par la fonction (pas d'API, écran tactile), jamais par le nom de l'appareil :
 * l'iPad, qui a l'API, garde son plein écran ; Android et l'ordinateur aussi.
 */
export function pleinEcranParEcranAccueil(): boolean {
  return !modeApplication() && !document.fullscreenEnabled && (matchMedia("(pointer: coarse)").matches || (navigator.maxTouchPoints ?? 0) > 0);
}

/** Le bouton « Plein écran » est-il à montrer ? Oui s'il bascule le plein écran, oui aussi s'il ouvre l'aide de l'écran d'accueil (iPhone). */
export function pleinEcranBoutonVisible(): boolean {
  return pleinEcranPossible() || pleinEcranParEcranAccueil();
}

/** L'astuce « Partager › Sur l'écran d'accueil » (la pastille d'une fois) a-t-elle lieu d'être ? Là où le plein écran passe par l'écran d'accueil. */
export function astuceIphoneAPropos(): boolean {
  return pleinEcranParEcranAccueil();
}

/** Ce que l'application sait du profil, pour l'aide (le paquet ne lit pas le stockage). */
export interface ReglagesAideIphone {
  /** L'adresse de la page du profil (le code de transfert y est affiché et copiable), relative à la page courante. */
  lienCode: () => string;
  /** Le code de transfert de ce navigateur, ou `null` s'il n'a pas encore de profil (asynchrone : l'application le calcule à la demande, hors de son premier chargement). */
  code: () => Promise<string | null>;
}
let reglages: ReglagesAideIphone | null = null;

/** L'application dit où est son profil (une fois, au démarrage) : l'aide du plein écran en dépend. */
export function reglerAideIphone(r: ReglagesAideIphone | null): void {
  reglages = r;
}

/** Ce que l'application a dit de son profil (`reglerAideIphone`), ou `null`. */
export function reglagesAideIphone(): ReglagesAideIphone | null {
  return reglages;
}
