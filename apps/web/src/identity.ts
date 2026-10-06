// Identité légère : un identifiant aléatoire et un pseudo, gardés dans le navigateur. Pas de compte, pas d'e-mail.
// Changer de navigateur, c'est devenir un autre joueur (accepté au premier jalon, voir docs/seed.md § 6).

const ID_KEY = "cdj:player";
const NAME_KEY = "cdj:name";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* navigation privée, stockage bloqué : l'identité ne survivra pas à la session */
  }
}

let memoryId: string | null = null;

/** Identifiant du joueur (32 caractères hexadécimaux, tirés avec `crypto.getRandomValues`), créé au premier appel. */
export function getPlayerId(): string {
  const stored = read(ID_KEY);
  if (stored && /^[0-9a-f]{32}$/.test(stored)) return stored;
  if (memoryId) return memoryId;
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const id = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  memoryId = id;
  write(ID_KEY, id);
  return id;
}

export function getName(): string | null {
  return read(NAME_KEY);
}

export function setName(name: string): void {
  write(NAME_KEY, name);
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

/** Dernier meilleur temps (ms) confirmé par le serveur pour ce circuit : évite de renvoyer ce qui est déjà classé. */
export function getSubmittedBest(trackId: string): number | null {
  const v = Number(read(`cdj:sub:${trackId}`));
  return Number.isFinite(v) && v > 0 ? v : null;
}

export function setSubmittedBest(trackId: string, ms: number): void {
  write(`cdj:sub:${trackId}`, String(ms));
}
