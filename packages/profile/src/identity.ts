// Identité de la plateforme (lot P0) : un identifiant secret et un pseudo, gardés dans le navigateur, **les mêmes pour tous les jeux**. Pas de
// compte, pas d'e-mail. Extrait d'`apps/web/src/identity.ts` (lot 30 de DailyTrack) sans rien changer : mêmes clés, mêmes formats.
//
// Les clés `cdj:*` sont celles de la plateforme (DailyTrack les écrit depuis le lot 5 ; DailyJump les lit). Ce module ne touche jamais
// `localStorage` : le stockage est **injecté** (le point d'accès `gameStorage()` de chaque jeu, avec son préfixe physique d'aperçu `apercu:`),
// ce qui le rend testable sans navigateur.

/** Préfixe de la plateforme : toutes les clés de l'identité commune commencent par lui. */
export const PLATFORM_PREFIX = "cdj:";
/** L'identifiant secret (32 hexadécimaux) : le code de transfert n'est que lui. */
export const PLAYER_KEY = "cdj:player";
export const NAME_KEY = "cdj:name";
/** Nouvel identifiant d'un « Changer mon code » en cours (gardé jusqu'à la réponse du serveur). */
export const NEXT_KEY = "cdj:player:next";
/** Avis montrés une fois (« Garder ce pseudo » après la migration des doublons : `cdj:notice:rename`). */
export const NOTICE_PREFIX = "cdj:notice:";
/** Identifiant de joueur : 128 bits, en hexadécimal minuscule. */
export const PLAYER_ID = /^[0-9a-f]{32}$/;
/**
 * Lot P4 : le **compteur de révision d'identité de la plateforme**. Tout jeu qui change l'identité de ce navigateur l'avance : un code chargé
 * (`noteIdentityChange(…, "code")`, appelé par le jeu qui le charge), une rotation (« Changer mon code ») et la première création de
 * l'identifiant (faites ici, par `createIdentity`). Chaque jeu retient la dernière révision qu'il a vue (sa propre clé) et la compare au
 * démarrage (`identityRevisionSeen`) : un code chargé **dans un autre jeu** depuis sa dernière visite = vider son cache de l'ancienne identité.
 */
export const IDENTITY_REV_KEY = "cdj:identite:rev";
/** La révision du dernier **code chargé** (seul changement qui fait vider le cache d'un jeu : une rotation garde le même profil). */
export const IDENTITY_CODE_REV_KEY = "cdj:identite:code";
export type IdentityChange = "code" | "rotation" | "creation";

/** Ce que le module demande d'un stockage (`Storage` du navigateur, ou un faux en mémoire dans les tests). */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Un stockage dont on peut parcourir les clés. */
export interface ListableStore extends KeyValueStore {
  readonly length: number;
  key(index: number): string | null;
}

/** 128 bits tirés avec `crypto.getRandomValues`, en hexadécimal. */
export function randomPlayerId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Pseudo accepté par le serveur (miroir de `cleanName` côté API) : le formulaire le vérifie avant d'envoyer. */
export function isValidName(name: string): boolean {
  const n = name.normalize("NFC").replace(/\s+/g, " ").trim();
  const length = [...n].length;
  return length >= 1 && length <= 20 && /^[\p{L}\p{N}][\p{L}\p{N} ._'’-]*$/u.test(n);
}

export function normalizeName(name: string): string {
  return name.normalize("NFC").replace(/\s+/g, " ").trim();
}

/** L'identifiant du joueur de ce navigateur, ou `null` s'il n'en a pas encore (jamais joué). */
export function readPlayerId(storage: Pick<KeyValueStore, "getItem">): string | null {
  const id = storage.getItem(PLAYER_KEY);
  return id && PLAYER_ID.test(id) ? id : null;
}

/** Les clés (sans le préfixe demandé) d'un stockage qui commencent par `prefix`. Une entrée illisible n'empêche pas les autres. */
export function keysWith(storage: Pick<ListableStore, "length" | "key">, prefix: string): string[] {
  const out: string[] = [];
  let count = 0;
  try {
    count = storage.length;
  } catch {
    return out;
  }
  for (let i = 0; i < count; i++) {
    try {
      const k = storage.key(i);
      if (k?.startsWith(prefix)) out.push(k.slice(prefix.length));
    } catch {
      /* une entrée illisible ne doit pas empêcher les autres */
    }
  }
  return out;
}

/**
 * L'identité de la plateforme vue d'un jeu, **sans rien créer** : existe-t-il un identifiant dans ce navigateur, et quel pseudo ? (DailyJump :
 * `__jump.profile`.) Un stockage illisible ou absent répond « aucune identité ».
 */
export function readIdentity(storage: Pick<KeyValueStore, "getItem"> | null): { exists: boolean; name: string | null } {
  try {
    if (!storage) return { exists: false, name: null };
    return { exists: readPlayerId(storage) !== null, name: storage.getItem(NAME_KEY) };
  } catch {
    return { exists: false, name: null };
  }
}

/**
 * Écrit une identité (code chargé) : identifiant et pseudo remplacés, « Changer mon code » en cours et avis oubliés (ils appartenaient à
 * l'ancienne identité). Lève si le stockage refuse : l'appelant (qui efface aussi le cache de son jeu) en fait un échec.
 */
export function writeIdentity(identity: { id: string; name: string | null }, storage: ListableStore): void {
  storage.removeItem(NEXT_KEY);
  for (const k of keysWith(storage, NOTICE_PREFIX)) storage.removeItem(`${NOTICE_PREFIX}${k}`);
  storage.setItem(PLAYER_KEY, identity.id);
  if (identity.name) storage.setItem(NAME_KEY, identity.name);
  else storage.removeItem(NAME_KEY);
}

const revOf = (raw: string | null): number => {
  const n = Number(raw);
  return raw !== null && Number.isSafeInteger(n) && n >= 0 ? n : 0;
};

/** La révision d'identité de la plateforme et celle du dernier code chargé (0 si rien n'a encore changé, ou stockage illisible). */
export function readIdentityRevision(storage: Pick<KeyValueStore, "getItem">): { rev: number; code: number } {
  try {
    return { rev: revOf(storage.getItem(IDENTITY_REV_KEY)), code: revOf(storage.getItem(IDENTITY_CODE_REV_KEY)) };
  } catch {
    return { rev: 0, code: 0 };
  }
}

/**
 * Avance la révision d'identité (lot P4) : `kind` dit pourquoi. `seenKey` : la clé du jeu qui fait le changement — il a déjà mis son cache en
 * ordre, il note donc la nouvelle révision comme vue. Rend la nouvelle révision (0 si le stockage refuse : rien n'est alors signalé).
 */
export function noteIdentityChange(storage: KeyValueStore, kind: IdentityChange, seenKey?: string): number {
  try {
    const rev = readIdentityRevision(storage).rev + 1;
    storage.setItem(IDENTITY_REV_KEY, String(rev));
    if (kind === "code") storage.setItem(IDENTITY_CODE_REV_KEY, String(rev));
    if (seenKey) storage.setItem(seenKey, String(rev));
    return rev;
  } catch {
    return 0;
  }
}

/**
 * Au démarrage d'un jeu (lot P4) : la révision a-t-elle changé depuis sa dernière visite, et un **code a-t-il été chargé** entre-temps (dans
 * un autre jeu) ? `"code"` : le jeu vide son cache de l'ancienne identité (DailyTrack : `applyIdentity`). `"aucun"` sinon : rien ne change
 * (première visite depuis le lot P4, aucune révision, ou seulement une rotation ou une création : même profil). La révision courante est notée
 * comme vue dans les deux cas. Un stockage illisible répond `"aucun"`.
 */
export function identityRevisionSeen(storage: KeyValueStore, seenKey: string): "code" | "aucun" {
  try {
    const { rev, code } = readIdentityRevision(storage);
    const raw = storage.getItem(seenKey);
    if (raw === null) {
      // Première visite depuis le lot P4 : on ne sait pas ce qui précède, on n'efface rien (le comportement d'avant).
      storage.setItem(seenKey, String(rev));
      return "aucun";
    }
    const seen = revOf(raw);
    if (seen === rev) return "aucun";
    storage.setItem(seenKey, String(rev));
    return code > seen ? "code" : "aucun";
  } catch {
    return "aucun";
  }
}

/** L'identité d'un navigateur : lecture et création de l'identifiant, pseudo, « Changer mon code » en cours. */
export interface Identity {
  /** Identifiant du joueur (32 caractères hexadécimaux), créé au premier appel. C'est le secret du profil : le code de transfert n'est que lui. */
  getPlayerId(): string;
  /** Adopte un autre identifiant (« Changer mon code » réussi, code chargé). */
  setPlayerId(id: string): void;
  /**
   * Nouvel identifiant d'un « Changer mon code » en cours : tiré une fois et gardé jusqu'à la réponse du serveur. Si la réponse se perd (réseau
   * coupé après que le serveur a changé le code), la même demande rejouée réussit encore et on ne perd pas l'accès à son profil.
   */
  pendingNextId(): string | null;
  takeNextId(): string;
  clearNextId(): void;
  getName(): string | null;
  setName(name: string): void;
}

/**
 * L'identité gardée dans `storage` (relu à chaque appel : le jeu passe son `gameStorage`, qui peut lever comme `localStorage`). Sans stockage
 * (navigation privée stricte), l'identifiant vit en mémoire le temps de la page.
 */
export function createIdentity(storage: () => KeyValueStore): Identity {
  const read = (key: string): string | null => {
    try {
      return storage().getItem(key);
    } catch {
      return null;
    }
  };
  const write = (key: string, value: string): void => {
    try {
      storage().setItem(key, value);
    } catch {
      /* navigation privée, stockage bloqué : l'identité ne survivra pas à la session */
    }
  };
  let memoryId: string | null = null;
  const bump = (kind: IdentityChange): void => {
    try {
      noteIdentityChange(storage(), kind);
    } catch {
      /* stockage absent : rien à signaler aux autres jeux */
    }
  };
  const pendingNextId = (): string | null => {
    const v = read(NEXT_KEY);
    return v && PLAYER_ID.test(v) ? v : null;
  };
  return {
    getPlayerId() {
      const stored = read(PLAYER_KEY);
      if (stored && PLAYER_ID.test(stored)) return stored;
      if (memoryId) return memoryId;
      const id = randomPlayerId();
      memoryId = id;
      write(PLAYER_KEY, id);
      // Lot P4 : la première identité de ce navigateur fait avancer la révision (les autres jeux le verront, sans rien effacer).
      bump("creation");
      return id;
    },
    setPlayerId(id) {
      const before = read(PLAYER_KEY);
      memoryId = id;
      write(PLAYER_KEY, id);
      // Lot P4 : « Changer mon code » réussi (ou adopté après une réponse perdue) : une rotation, même profil.
      if (before !== id) bump("rotation");
    },
    pendingNextId,
    takeNextId() {
      const existing = pendingNextId();
      if (existing) return existing;
      const id = randomPlayerId();
      write(NEXT_KEY, id);
      return id;
    },
    clearNextId() {
      try {
        storage().removeItem(NEXT_KEY);
      } catch {
        /* tant pis */
      }
    },
    getName: () => read(NAME_KEY),
    setName: (name) => write(NAME_KEY, name),
  };
}
