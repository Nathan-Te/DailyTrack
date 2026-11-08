// **Le contexte audio d'un jeu, ouvert d'une seule façon pour toute la plateforme** (lot S2).
//
// Règle : **le son d'un jeu se mêle à celui du téléphone, il ne le coupe pas.** La session audio est `ambient` (iPhone : la vidéo ou la musique du joueur continue ; l'interrupteur
// « silence » coupe aussi le jeu, comme dans la plupart des jeux mobiles). Tous les sons des jeux (Track, Jump, Tower, Blocks, Rush, la musique commune) ouvrent leur contexte par
// `ouvrirContexteAudio` : aucun ne pose lui-même `navigator.audioSession`, aucun ne joue par un élément `<audio>` ou `<video>` (un élément média qui joue prend la main sur l'audio
// du téléphone, Android compris) et aucun ne déclare de Media Session. Un test (`packages/core/test/sonMelange.test.ts`) refuse leur retour dans le code des jeux.
//
// Pur de tout accès direct au navigateur : l'environnement (`globalThis` par défaut) est un paramètre, donc testé sous Node. Sans `AudioContext`, tout rend `null`.

/** La session audio du navigateur (iPhone, Safari 16.4 et suivants) : seul `type` nous sert. */
export interface SessionAudio {
  type: string;
}

/** Ce que la fonction lit de l'environnement (la fenêtre du navigateur) ; `AudioContext` et son ancien nom `webkitAudioContext` (Safari avant 14.1). */
export interface EnvAudio {
  AudioContext?: new () => unknown;
  webkitAudioContext?: new () => unknown;
  navigator?: { audioSession?: SessionAudio };
}

/** Le type de session audio de tous les jeux : se mêle aux autres sons du téléphone. */
export const SESSION_AUDIO = "ambient";

const env = (e?: EnvAudio): EnvAudio => e ?? (globalThis as EnvAudio);
const constructeur = (e: EnvAudio) => e.AudioContext ?? e.webkitAudioContext;

/** Web Audio existe sur cet appareil (sans rien créer ni toucher à la session audio). */
export function audioDisponible(e?: EnvAudio): boolean {
  return !!constructeur(env(e));
}

/** Pose la session audio `ambient` quand l'API existe ; rend `true` si elle a été posée. Un navigateur sans l'API (la plupart) ne change rien. */
export function poserSessionAmbiante(e?: EnvAudio): boolean {
  const session = env(e).navigator?.audioSession;
  if (!session) return false;
  try {
    session.type = SESSION_AUDIO;
    return true;
  } catch {
    return false;
  }
}

/**
 * Ouvre le contexte audio d'un jeu : la session `ambient` est posée **avant** (c'est elle qui décide si le téléphone coupe ou non les autres sons), puis le contexte est créé.
 * `null` si Web Audio manque ou si le navigateur refuse. **À appeler pendant un geste du joueur** (le contexte est alors réveillable : `resume()`).
 */
export function ouvrirContexteAudio<C = unknown>(e?: EnvAudio): C | null {
  const environnement = env(e);
  const Ctor = constructeur(environnement);
  if (!Ctor) return null;
  poserSessionAmbiante(environnement);
  try {
    return new Ctor() as C;
  } catch {
    return null;
  }
}
