// Migration depuis GitHub Pages (lot R4 de la plateforme) : l'identité d'un joueur passe de l'ancienne origine (`nathan-te.github.io`) à la
// nouvelle (`playdujour.com`) **dans le fragment de l'adresse** (`#dujour=…`), jamais en paramètre : le fragment n'est jamais envoyé au serveur
// (ni à GitHub Pages, ni à Firebase Hosting, ni dans l'en-tête `Referer`).
//
//   ancienne origine (page de redirection)  : `collectMigration(stockage)` → `migrationFragment(…)` → `#dujour=1.<base64url>.<CRC-32>`
//   nouvelle origine (au démarrage d'un jeu) : `consumeMigrationFragment(page, remplacer)` efface le fragment de l'adresse AUSSITÔT
//                                               (`history.replaceState`, fait par le jeu), puis `importMigration(stockage, lu, crochets)`.
//
// Ce qui est transmis : l'identité de la plateforme (`cdj:player`, sous forme de code de transfert `CDJ2`, et `cdj:name`) et, si la taille le
// permet (`MIGRATION_MAX_CHARS`), les données locales utiles de DailyJump qui n'existent nulle part ailleurs (`MIGRATION_KEY_PATTERNS`, dans
// l'ordre de priorité). Le reste (records, historique, profils) est reconstruit par la synchronisation du serveur (lot P2).
//
// Règles de l'arrivée : pas d'identité → import automatique (une création, rien n'appartenait à une autre identité) ; même identité → seules les
// données absentes sont ajoutées ; **autre** identité → le joueur choisit (`choose`) ; s'il prend celle de l'ancienne adresse, c'est la règle
// d'un **code chargé** (`adopt` : le jeu vide son cache de l'ancienne identité, `writeIdentity`, `noteIdentityChange("code")`). Un même fragment
// n'est importé qu'une fois (`MIGRATION_SEEN_KEY`) ; une donnée locale existante n'est jamais écrasée. Aucun accès direct au stockage ni à
// l'adresse : tout est injecté (règle du module).
import { NAME_KEY, PLAYER_ID, isValidName, noteIdentityChange, readPlayerId, writeIdentity, type ListableStore } from "./identity";
import { crc32, decodeTransfer, encodeTransfer, fromBase64Url } from "./transfer";

/** Nom du fragment : `#dujour=<valeur>`. */
export const MIGRATION_PARAM = "dujour";
/** Version du format de la valeur (`1.<base64url du JSON>.<CRC-32 du JSON>`). */
export const MIGRATION_VERSION = 1;
/** Le dernier fragment importé (son CRC-32) : le même fragment, revenu par un vieux favori, n'est ni réimporté ni redemandé. */
export const MIGRATION_SEEN_KEY = "cdj:migration:vue";
/**
 * Taille maximale du fragment entier (caractères). Les navigateurs acceptent bien plus (Chrome ≈ 2 Mo) ; 16 000 laisse une marge large pour
 * Safari, les messageries et les copies d'adresse, et suffit à l'identité plus les envois en attente du jour.
 */
export const MIGRATION_MAX_CHARS = 16_000;

/**
 * Les clés locales transmises, **dans l'ordre de priorité** (la première qui ne tient plus dans la taille est sautée, les suivantes sont
 * essayées) : l'envoi en attente du classement de DailyJump (un meilleur essai pas encore classé), les vies en attente d'envoi, puis la mémoire
 * du jour (méta, meilleur essai, taches, vies). Ce sont les seules données de DailyJump qui n'existent qu'en local ; le serveur rend le reste.
 */
export const MIGRATION_KEY_PATTERNS: readonly RegExp[] = [
  /^jump:classement:attente$/,
  /^jump:vies:envoi$/,
  /^jump:jour:[^:]+$/,
  /^jump:meilleur:[^:]+$/,
  /^jump:morts:[^:]+$/,
  /^jump:vies:(?!envoi$)[^:]+$/,
];

/** Ce que transporte le fragment. */
export interface MigrationPayload {
  /** L'identifiant secret (32 hexadécimaux). */
  id: string;
  name: string | null;
  /** Clés locales transmises (de `MIGRATION_KEY_PATTERNS`), avec leur valeur. */
  keys: Record<string, string>;
}

const allowedKey = (k: string): boolean => MIGRATION_KEY_PATTERNS.some((re) => re.test(k));

function toBase64Url(text: string): string {
  let bin = "";
  for (const b of new TextEncoder().encode(text)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function encodeValue(p: MigrationPayload): string {
  const json = JSON.stringify({ c: encodeTransfer(p.id), ...(p.name ? { n: p.name } : {}), ...(Object.keys(p.keys).length ? { k: p.keys } : {}) });
  return `${MIGRATION_VERSION}.${toBase64Url(json)}.${crc32(new TextEncoder().encode(json))}`;
}

/** Le fragment complet (`#dujour=…`) d'une migration. */
export function migrationFragment(p: MigrationPayload): string {
  return `#${MIGRATION_PARAM}=${encodeValue(p)}`;
}

/**
 * Ce que l'ancienne origine transmet : l'identité (rien sans elle : `null`) et les clés de `MIGRATION_KEY_PATTERNS` présentes, par ordre de
 * priorité, tant que le fragment entier tient dans `maxChars`. Un stockage illisible rend `null`.
 */
export function collectMigration(storage: ListableStore, maxChars = MIGRATION_MAX_CHARS): MigrationPayload | null {
  try {
    const id = readPlayerId(storage);
    if (!id) return null;
    const rawName = storage.getItem(NAME_KEY);
    const payload: MigrationPayload = { id, name: rawName && isValidName(rawName) ? rawName : null, keys: {} };
    if (migrationFragment(payload).length > maxChars) return null;
    const present: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k !== null && allowedKey(k)) present.push(k);
    }
    const rank = (k: string) => MIGRATION_KEY_PATTERNS.findIndex((re) => re.test(k));
    present.sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0));
    for (const k of present) {
      const v = storage.getItem(k);
      if (v === null) continue;
      payload.keys[k] = v;
      if (migrationFragment(payload).length > maxChars) delete payload.keys[k];
    }
    return payload;
  } catch {
    return null;
  }
}

/** La lecture d'un fragment : absent, lu, ou abîmé (avec la raison, en français). */
export type MigrationRead = { present: false } | { present: true; ok: true; payload: MigrationPayload; digest: string } | { present: true; ok: false; reason: string };

/** La valeur de `dujour` dans un fragment (`#dujour=…`, éventuellement parmi d'autres `&…`), ou `null`. */
function valueOf(hash: string): string | null {
  const text = hash.startsWith("#") ? hash.slice(1) : hash;
  for (const part of text.split("&")) {
    const at = part.indexOf("=");
    if (at > 0 && part.slice(0, at) === MIGRATION_PARAM) return part.slice(at + 1);
  }
  return null;
}

/** Lit un fragment d'adresse. Tout est vérifié (version, somme de contrôle, code `CDJ2`, pseudo, clés permises) : rien n'est pris sur parole. */
export function readMigrationFragment(hash: string): MigrationRead {
  const value = valueOf(hash);
  if (value === null) return { present: false };
  const bad = (reason: string): MigrationRead => ({ present: true, ok: false, reason });
  if (value.length > MIGRATION_MAX_CHARS) return bad("trop long");
  const parts = value.split(".");
  if (parts.length !== 3 || parts[0] !== String(MIGRATION_VERSION)) return bad("format inconnu");
  let json: string;
  try {
    json = new TextDecoder("utf-8", { fatal: true }).decode(fromBase64Url(parts[1]!));
  } catch {
    return bad("illisible");
  }
  const digest = crc32(new TextEncoder().encode(json));
  if (digest !== parts[2]!.toLowerCase()) return bad("somme de contrôle fausse (adresse coupée ou modifiée)");
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return bad("illisible");
  }
  if (!raw || typeof raw !== "object") return bad("illisible");
  const o = raw as { c?: unknown; n?: unknown; k?: unknown };
  if (typeof o.c !== "string") return bad("code absent");
  const code = decodeTransfer(o.c);
  if (!code.ok || code.data.version !== 2 || !PLAYER_ID.test(code.data.id)) return bad("code de transfert abîmé");
  const name = typeof o.n === "string" && isValidName(o.n) ? o.n : null;
  const keys: Record<string, string> = {};
  if (o.k !== undefined) {
    if (!o.k || typeof o.k !== "object" || Array.isArray(o.k)) return bad("données illisibles");
    for (const [k, v] of Object.entries(o.k as Record<string, unknown>)) if (allowedKey(k) && typeof v === "string") keys[k] = v;
  }
  return { present: true, ok: true, payload: { id: code.data.id, name, keys }, digest };
}

/** L'adresse vue par le jeu (ce qu'il faut pour effacer le fragment). */
export interface PageAddress {
  pathname: string;
  search: string;
  hash: string;
}

/**
 * Lit le fragment de migration et, s'il est là (même abîmé), **l'efface aussitôt** de l'adresse : `replaceUrl(chemin + paramètres)` (le jeu
 * appelle `history.replaceState`), avant tout import. Un rechargement ou un partage de l'adresse ne le revoit donc jamais.
 */
export function consumeMigrationFragment(page: PageAddress, replaceUrl: (url: string) => void): MigrationRead {
  const read = readMigrationFragment(page.hash);
  if (read.present) {
    try {
      replaceUrl(`${page.pathname}${page.search}`);
    } catch {
      /* l'adresse ne se remplace pas (cadre isolé…) : l'import reste unique grâce à MIGRATION_SEEN_KEY */
    }
  }
  return read;
}

/** Ce que l'import a fait. */
export type MigrationOutcome = "absent" | "abime" | "deja-vu" | "importe" | "meme" | "garde" | "echec";

export interface MigrationHooks {
  /**
   * Une **autre** identité existe déjà : le joueur choisit. Vrai = prendre celle de l'ancienne adresse. `current` / `incoming` : les pseudos
   * (`null` si aucun).
   */
  choose(current: string | null, incoming: string | null): boolean;
  /**
   * Prendre l'identité de l'ancienne adresse à la place d'une autre : la règle d'un **code chargé** du jeu (il vide son cache de l'ancienne
   * identité, `writeIdentity`, puis `noteIdentityChange(…, "code", <sa clé vue>)`). Rend faux si le stockage refuse.
   */
  adopt(identity: { id: string; name: string | null }): boolean;
}

/** Les clés transmises absentes de ce stockage y sont écrites ; une donnée locale existante n'est jamais remplacée. Rend leur nombre. */
function writeMissingKeys(storage: ListableStore, keys: Record<string, string>): number {
  let n = 0;
  for (const [k, v] of Object.entries(keys)) {
    if (!allowedKey(k) || storage.getItem(k) !== null) continue;
    storage.setItem(k, v);
    n++;
  }
  return n;
}

/**
 * L'import, une seule fois par fragment. `absent` / `abime` : rien n'est fait ; `deja-vu` : ce fragment a déjà été traité ici ; `importe` :
 * l'identité de l'ancienne adresse est maintenant celle du navigateur ; `meme` : c'était déjà la sienne ; `garde` : le joueur a gardé
 * l'identité de cet appareil ; `echec` : le stockage refuse (rien n'est marqué : un prochain passage réessaiera).
 */
export function importMigration(storage: ListableStore, read: MigrationRead, hooks: MigrationHooks): { outcome: MigrationOutcome; keys: number } {
  if (!read.present) return { outcome: "absent", keys: 0 };
  if (!read.ok) return { outcome: "abime", keys: 0 };
  const { payload, digest } = read;
  try {
    if (storage.getItem(MIGRATION_SEEN_KEY) === digest) return { outcome: "deja-vu", keys: 0 };
    const current = readPlayerId(storage);
    let outcome: MigrationOutcome;
    let keys = 0;
    if (current === null) {
      // Aucune identité ici : rien n'appartenait à une autre identité, c'est une création (aucun autre jeu n'a de cache à vider).
      writeIdentity({ id: payload.id, name: payload.name }, storage);
      noteIdentityChange(storage, "creation");
      keys = writeMissingKeys(storage, payload.keys);
      outcome = "importe";
    } else if (current === payload.id) {
      if (payload.name && storage.getItem(NAME_KEY) === null) storage.setItem(NAME_KEY, payload.name);
      keys = writeMissingKeys(storage, payload.keys);
      outcome = "meme";
    } else if (hooks.choose(storage.getItem(NAME_KEY), payload.name)) {
      if (!hooks.adopt({ id: payload.id, name: payload.name })) return { outcome: "echec", keys: 0 };
      keys = writeMissingKeys(storage, payload.keys);
      outcome = "importe";
    } else {
      outcome = "garde";
    }
    storage.setItem(MIGRATION_SEEN_KEY, digest);
    return { outcome, keys };
  } catch {
    return { outcome: "echec", keys: 0 };
  }
}

/** La question posée quand une **autre** identité existe déjà (le jeu l'affiche ; OK = prendre le profil de l'ancienne adresse). */
export function migrationQuestion(current: string | null, incoming: string | null): string {
  const here = current ? `le profil « ${current} »` : "un autre profil (sans pseudo)";
  const there = incoming ? `ton profil « ${incoming} »` : "ton profil (sans pseudo)";
  return (
    `Tu arrives de l'ancienne adresse du jeu avec ${there}, mais cet appareil a déjà ${here} sur playdujour.com.\n\n` +
    `OK : prendre le profil de l'ancienne adresse (celui de cet appareil reste récupérable avec son code).\n` +
    `Annuler : garder le profil de cet appareil.`
  );
}
