// Lot I7 (plateforme) : **la seule logique de plein écran de la plateforme** — Track et Jump, leurs pauses, leurs accueils et leurs boutons en partie s'en
// servent, plus aucune copie dans un jeu. Ce module ne garde rien et n'écrit nulle part : la page (`document`, `screen`, `matchMedia`, `navigator`) est
// injectable (`Environnement`) pour les tests ; par défaut, celle du navigateur.

type DocumentPleinEcran = Pick<Document, "fullscreenEnabled" | "fullscreenElement" | "documentElement" | "addEventListener" | "removeEventListener"> & {
  exitFullscreen?: () => Promise<void> | void;
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type ElementPleinEcran = Pick<HTMLElement, "requestFullscreen"> & { webkitRequestFullscreen?: () => Promise<void> | void };

export interface Environnement {
  doc: DocumentPleinEcran & { documentElement: ElementPleinEcran };
  /** `screen.orientation` : le verrou du paysage. */
  orientation?: { lock?: (orientation: string) => Promise<void> } | null;
  matchMedia?: (requete: string) => { matches: boolean };
  navigator?: { standalone?: boolean; userAgent?: string };
}

/** Le navigateur courant. */
export function environnementNavigateur(): Environnement {
  return {
    doc: document as unknown as Environnement["doc"],
    orientation: typeof screen === "undefined" ? null : (screen.orientation as Environnement["orientation"]),
    matchMedia: typeof matchMedia === "function" ? (q) => matchMedia(q) : undefined,
    navigator: typeof navigator === "undefined" ? undefined : (navigator as Environnement["navigator"]),
  };
}

/** Le site est ouvert comme une application (icône « Ajouter à l'écran d'accueil ») : il n'a déjà ni barre d'adresse ni besoin du plein écran. */
export function modeApplication(env: Environnement = environnementNavigateur()): boolean {
  return env.matchMedia?.("(display-mode: standalone)").matches === true || env.navigator?.standalone === true;
}

/** Le plein écran est-il à proposer ici ? Non si l'API n'existe pas (iPhone) ou si le site est déjà une application. */
export function pleinEcranPossible(env: Environnement = environnementNavigateur()): boolean {
  if (modeApplication(env)) return false;
  const { doc } = env;
  if (!(doc.fullscreenEnabled || doc.webkitFullscreenEnabled)) return false;
  return typeof doc.documentElement.requestFullscreen === "function" || typeof doc.documentElement.webkitRequestFullscreen === "function";
}

/** Le plein écran est-il en cours ? */
export function pleinEcranActif(env: Environnement = environnementNavigateur()): boolean {
  return !!(env.doc.fullscreenElement || env.doc.webkitFullscreenElement);
}

/**
 * Entre en plein écran (et essaie de verrouiller le paysage : les deux jeux s'y jouent) ou en sort. Ne lève jamais : un refus du navigateur laisse
 * le jeu tel quel, sans message ; un verrou refusé (presque partout hors Android) est ignoré.
 */
export async function basculerPleinEcran(env: Environnement = environnementNavigateur()): Promise<void> {
  const { doc } = env;
  try {
    if (pleinEcranActif(env)) {
      await (doc.exitFullscreen?.() ?? doc.webkitExitFullscreen?.());
      return;
    }
    const racine = doc.documentElement;
    await (racine.requestFullscreen?.({ navigationUI: "hide" }) ?? racine.webkitRequestFullscreen?.());
  } catch {
    return;
  }
  try {
    await env.orientation?.lock?.("landscape");
  } catch {
    /* verrou refusé : ignoré */
  }
}

/** Appelle `cb` à chaque entrée ou sortie du plein écran ; rend la fonction qui se désabonne. */
export function surChangementPleinEcran(cb: () => void, env: Environnement = environnementNavigateur()): () => void {
  const noms = ["fullscreenchange", "webkitfullscreenchange"];
  for (const n of noms) env.doc.addEventListener(n, cb);
  return () => {
    for (const n of noms) env.doc.removeEventListener(n, cb);
  };
}

/** Un iPhone (ou un iPod) : pas de plein écran de page, mais l'écran d'accueil. */
export function estIphone(env: Environnement = environnementNavigateur()): boolean {
  return /iPhone|iPod/.test(env.navigator?.userAgent ?? "");
}

/** L'astuce « Partager › Sur l'écran d'accueil » a-t-elle lieu d'être ? Sur un iPhone qui n'a pas de plein écran, hors du mode application. */
export function astuceIphoneAPropos(env: Environnement = environnementNavigateur()): boolean {
  return estIphone(env) && !pleinEcranPossible(env) && !modeApplication(env);
}
