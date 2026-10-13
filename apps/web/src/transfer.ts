// Code de transfert : emporter son identité (identifiant secret + pseudo) et ses records locaux sur un autre navigateur ou un autre appareil,
// sans compte. Tout se passe dans le navigateur : le code est un texte que le joueur copie et colle lui-même, rien n'est envoyé au serveur.
// Le code contient l'identifiant secret : il se garde comme un mot de passe (quiconque le colle devient ce joueur).
//
// Forme : `CDJ1.<charge utile en base64url>.<somme de contrôle sur 8 hexadécimaux>`. La charge est un JSON ; la somme de contrôle (CRC-32 des
// octets de la charge) détecte une copie tronquée ou une faute de frappe avant qu'on remplace quoi que ce soit.
import { decodeReplay } from "@cdj/sim";
import { RANK_PREFIX, clearRanks, loadRanks, parseRank, type RankMark } from "./profile";

export const TRANSFER_PREFIX = "CDJ1";
const ID_KEY = "cdj:player";
const NAME_KEY = "cdj:name";
const BEST = "cdj:best:";
const SUB = "cdj:sub:";
/** Seuls les circuits du jour voyagent (identifiant `jour-AAAA-MM-JJ-g<G>[-v<n>][-<thème>]`) ; les essais et scénarios restent sur l'appareil. */
const DAY_TRACK = /^jour-\d{4}-\d{2}-\d{2}-g\d{1,3}(-v\d{1,2})?(-[a-z]{3,12})?$/;
const MEDALS = new Set(["gold", "silver", "bronze", "author"]);
/** Rediffusions emportées : celles des derniers jours (le fantôme de « ton record ») et toute course pas encore confirmée par le serveur. */
export const KEEP_REPLAYS = 3;
/** Taille maximale d'un code accepté (anti-abus : une rediffusion fait ~6 ko, il y en a peu). */
export const MAX_CODE_LENGTH = 400_000;

export interface TransferRecord {
  ms: number;
  splits: number[];
  medal?: string | null;
  simVersion?: number;
  replay?: string;
}

export interface TransferData {
  id: string;
  name: string | null;
  /** Records locaux par identifiant de circuit. */
  best: Record<string, TransferRecord>;
  /** Meilleur temps confirmé par le serveur, par identifiant de circuit (évite de renvoyer ce qui est déjà classé). */
  sub: Record<string, number>;
  /** Places vues au classement, par jour (lot 29 : pour « meilleure place » du profil). Facultatif : un code plus ancien n'en a pas. */
  ranks?: Record<string, RankMark>;
}

type ReadStorage = Pick<Storage, "length" | "key" | "getItem">;
type WriteStorage = ReadStorage & Pick<Storage, "setItem" | "removeItem">;

// --- Somme de contrôle ---------------------------------------------------------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/** CRC-32 (zlib) des octets, sur 8 hexadécimaux. */
export function crc32(bytes: Uint8Array): string {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return ((c ^ 0xffffffff) >>> 0).toString(16).padStart(8, "0");
}

const toBase64Url = (bytes: Uint8Array): string => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const fromBase64Url = (text: string): Uint8Array => {
  const b = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
};

// --- Lecture du stockage ---------------------------------------------------------------------------------------------------
function keysWith(storage: ReadStorage, prefix: string): string[] {
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

const dayOfTrack = (trackId: string): string => /^jour-(\d{4}-\d{2}-\d{2})/.exec(trackId)?.[1] ?? "";

/** Rassemble ce qui voyage : identité, records des circuits du jour, temps confirmés. `null` si le joueur n'a pas encore d'identité. */
export function collectTransfer(storage: ReadStorage): TransferData | null {
  const id = storage.getItem(ID_KEY);
  if (!id || !/^[0-9a-f]{32}$/.test(id)) return null;
  const best: Record<string, TransferRecord> = {};
  for (const trackId of keysWith(storage, BEST)) {
    if (!DAY_TRACK.test(trackId)) continue;
    try {
      const r = JSON.parse(storage.getItem(BEST + trackId) ?? "null") as TransferRecord | null;
      if (r && Number.isFinite(r.ms) && Array.isArray(r.splits)) best[trackId] = r;
    } catch {
      /* record illisible : ignoré */
    }
  }
  const sub: Record<string, number> = {};
  for (const trackId of keysWith(storage, SUB)) {
    const ms = Number(storage.getItem(SUB + trackId));
    if (DAY_TRACK.test(trackId) && Number.isFinite(ms) && ms > 0) sub[trackId] = ms;
  }
  // Les rediffusions pèsent (~6 ko chacune) : on garde celles des derniers jours et celles que le serveur n'a pas encore confirmées.
  const recent = new Set(Object.keys(best).sort((a, b) => (dayOfTrack(b) + b).localeCompare(dayOfTrack(a) + a)).slice(0, KEEP_REPLAYS));
  for (const [trackId, r] of Object.entries(best)) {
    const pending = (sub[trackId] ?? Infinity) > r.ms;
    if (r.replay && !recent.has(trackId) && !pending) best[trackId] = { ...r, replay: undefined };
  }
  const name = storage.getItem(NAME_KEY);
  const ranks = Object.fromEntries(loadRanks(storage));
  return { id, name: name && name.length ? name : null, best, sub, ...(Object.keys(ranks).length ? { ranks } : {}) };
}

// --- Encodage ---------------------------------------------------------------------------------------------------------------------
export function encodeTransfer(data: TransferData): string {
  const payload = new TextEncoder().encode(JSON.stringify({ v: 1, ...data }));
  return `${TRANSFER_PREFIX}.${toBase64Url(payload)}.${crc32(payload)}`;
}

export type DecodeResult = { ok: true; data: TransferData } | { ok: false; reason: string };

const finiteInt = (n: unknown, min: number, max: number): n is number => typeof n === "number" && Number.isInteger(n) && n >= min && n <= max;

/** Lit un code collé : espaces et retours à la ligne ignorés, somme de contrôle vérifiée, contenu validé champ par champ (rien n'est pris sur parole). */
export function decodeTransfer(input: string): DecodeResult {
  const code = input.replace(/\s+/g, "");
  if (!code) return { ok: false, reason: "Le code est vide." };
  if (code.length > MAX_CODE_LENGTH) return { ok: false, reason: "Ce code est trop long pour être un code de transfert." };
  const parts = code.split(".");
  if (parts.length !== 3 || parts[0] !== TRANSFER_PREFIX) return { ok: false, reason: "Ce n'est pas un code de transfert de Circuit du Jour." };
  let bytes: Uint8Array;
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(parts[1]!)) throw new Error("caractères");
    bytes = fromBase64Url(parts[1]!);
  } catch {
    return { ok: false, reason: "Le code est abîmé (caractères illisibles). Copie-le en entier, sans rien ajouter." };
  }
  if (crc32(bytes) !== parts[2]!.toLowerCase()) return { ok: false, reason: "Le code est incomplet ou abîmé (la somme de contrôle ne correspond pas). Copie-le de nouveau, en entier." };
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as Record<string, unknown>;
  } catch {
    return { ok: false, reason: "Le contenu du code est illisible." };
  }
  if (!raw || typeof raw !== "object" || raw.v !== 1) return { ok: false, reason: "Ce code vient d'une autre version du jeu." };
  if (typeof raw.id !== "string" || !/^[0-9a-f]{32}$/.test(raw.id)) return { ok: false, reason: "Le code ne contient pas d'identifiant de joueur valide." };
  const name = typeof raw.name === "string" && raw.name.length <= 40 ? raw.name : null;

  const best: Record<string, TransferRecord> = {};
  for (const [trackId, value] of Object.entries((raw.best ?? {}) as Record<string, unknown>)) {
    if (!DAY_TRACK.test(trackId) || !value || typeof value !== "object") continue;
    const r = value as Record<string, unknown>;
    if (!finiteInt(r.ms, 1, 3_600_000) || !Array.isArray(r.splits) || r.splits.length > 64 || !r.splits.every((s) => typeof s === "number" && Number.isFinite(s))) continue;
    const rec: TransferRecord = { ms: r.ms, splits: r.splits as number[] };
    if (typeof r.medal === "string" && MEDALS.has(r.medal)) rec.medal = r.medal;
    if (finiteInt(r.simVersion, 0, 100_000)) rec.simVersion = r.simVersion;
    if (typeof r.replay === "string" && /^[A-Za-z0-9_-]{1,400000}$/.test(r.replay)) {
      try {
        decodeReplay(r.replay); // une rediffusion illisible ferait échouer le fantôme : on la laisse de côté, le temps reste
        rec.replay = r.replay;
      } catch {
        /* abandonnée */
      }
    }
    best[trackId] = rec;
  }
  const sub: Record<string, number> = {};
  for (const [trackId, ms] of Object.entries((raw.sub ?? {}) as Record<string, unknown>)) {
    if (DAY_TRACK.test(trackId) && finiteInt(ms, 1, 3_600_000)) sub[trackId] = ms;
  }
  const ranks: Record<string, RankMark> = {};
  for (const [date, value] of Object.entries((raw.ranks ?? {}) as Record<string, unknown>)) {
    const mark = /^\d{4}-\d{2}-\d{2}$/.test(date) ? parseRank(value) : null;
    if (mark) ranks[date] = mark;
  }
  return { ok: true, data: { id: raw.id, name, best, sub, ...(Object.keys(ranks).length ? { ranks } : {}) } };
}

// --- Application -------------------------------------------------------------------------------------------------------------------
/**
 * Remplace l'identité locale par celle du code : identifiant, pseudo, records et temps confirmés des circuits du jour de ce navigateur
 * sont effacés puis remplacés (les temps confirmés appartiennent à l'ancien identifiant : les garder ferait croire au jeu qu'ils sont
 * déjà classés pour le nouveau). Les réglages (son, caméra, commandes tactiles) et les essais ne bougent pas.
 * Rend `false` si le stockage refuse l'écriture.
 */
export function applyTransfer(data: TransferData, storage: WriteStorage): boolean {
  try {
    for (const k of keysWith(storage, BEST)) if (DAY_TRACK.test(k)) storage.removeItem(BEST + k);
    for (const k of keysWith(storage, SUB)) if (DAY_TRACK.test(k)) storage.removeItem(SUB + k);
    clearRanks(storage);
    storage.setItem(ID_KEY, data.id);
    if (data.name) storage.setItem(NAME_KEY, data.name);
    else storage.removeItem(NAME_KEY);
    for (const [trackId, r] of Object.entries(data.best)) storage.setItem(BEST + trackId, JSON.stringify(r));
    for (const [trackId, ms] of Object.entries(data.sub)) storage.setItem(SUB + trackId, String(ms));
    for (const [date, mark] of Object.entries(data.ranks ?? {})) storage.setItem(RANK_PREFIX + date, JSON.stringify(mark));
    return true;
  } catch {
    return false;
  }
}

/** Résumé pour la confirmation : « 12 records, pseudo Alice ». */
export function describeTransfer(data: TransferData): string {
  const n = Object.keys(data.best).length;
  return `${data.name ? `pseudo « ${data.name} »` : "sans pseudo"}, ${n} record${n > 1 ? "s" : ""}`;
}
