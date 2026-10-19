// Code de transfert : retrouver son profil sur un autre navigateur ou un autre appareil, sans compte. Le code est l'identifiant secret du
// joueur (et une somme de contrôle) : rien d'autre. Le serveur fait foi (lot 30) : charger un code récupère pseudo, records et médailles depuis le
// serveur, le stockage du navigateur n'en est qu'un cache. Le code se garde comme un mot de passe : quiconque le colle devient ce joueur ;
// « Changer mon code » (Réglages › Profil) le remplace et rend l'ancien inutilisable.
//
// Forme : `CDJ2.<identifiant : 32 hexadécimaux>.<CRC-32 sur 8 hexadécimaux>` (46 caractères, qui se tapent ou se dictent).
// Les codes du lot 28 (`CDJ1.<charge utile en base64url>.<CRC-32>`, qui emportaient aussi les records) restent acceptés : leurs rediffusions du
// jour sont envoyées au serveur pour validation, puis ignorées (le serveur ne garde que ce qu'il a rejoué).
//
// Lot P0 (plateforme) : le code `CDJ2` (forme, somme de contrôle, lecture) est celui du module de profil commun (`@cdj/profile`) ; restent ici
// ce qui ne concerne que DailyTrack : la lecture des anciens codes `CDJ1` (records de DailyTrack) et le cache des records à vider au changement
// d'identité.
import { decodeReplay } from "@cdj/sim";
import {
  NAME_KEY,
  crc32,
  decodeTransfer as decodePlatformTransfer,
  fromBase64Url,
  identityRevisionSeen,
  keysWith,
  noteIdentityChange,
  readPlayerId,
  writeIdentity,
  type DecodeResult,
  type TransferData,
  type TransferRecord,
} from "@cdj/profile";
import { clearRanks, parseRank, type RankMark } from "./profile";

export { LEGACY_PREFIX, MAX_CODE_LENGTH, TRANSFER_PREFIX, crc32, encodeTransfer, readPlayerId } from "@cdj/profile";

/**
 * Lot P4 (plateforme) : la dernière révision d'identité de la plateforme que DailyTrack a vue (`@cdj/profile`, `identityRevisionSeen`). Un code
 * chargé dans un autre jeu (DailyJump) depuis : au démarrage, DailyTrack fait ce qu'il fait quand le code est chargé chez lui (`applyIdentity`).
 */
export const SEEN_IDENTITY_KEY = "cdj:identite:vue";
export type { DecodeResult, TransferData, TransferRecord } from "@cdj/profile";

const BEST = "cdj:best:";
const SUB = "cdj:sub:";
/** Seuls les circuits du jour comptent (identifiant `jour-AAAA-MM-JJ-g<G>[-v<n>][-<thème>]`) ; les essais et scénarios restent sur l'appareil. */
const DAY_TRACK = /^jour-\d{4}-\d{2}-\d{2}-g\d{1,3}(-v\d{1,2})?(-[a-z]{3,12})?$/;
const MEDALS = new Set(["gold", "silver", "bronze", "author"]);
const PLAYER_ID = /^[0-9a-f]{32}$/;

type ReadStorage = Pick<Storage, "length" | "key" | "getItem">;
type WriteStorage = ReadStorage & Pick<Storage, "setItem" | "removeItem">;

const finiteInt = (n: unknown, min: number, max: number): n is number => typeof n === "number" && Number.isInteger(n) && n >= min && n <= max;

/** Lit un code collé (`CDJ2`, ou un ancien `CDJ1`) : voir `decodeTransfer` de `@cdj/profile`. */
export function decodeTransfer(input: string): DecodeResult {
  return decodePlatformTransfer(input, decodeLegacy);
}

/** Ancien code (lot 28) : charge utile en base64url (JSON), identifiant, pseudo et records. */
function decodeLegacy(payload: string, checksum: string): DecodeResult {
  let bytes: Uint8Array;
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(payload)) throw new Error("caractères");
    bytes = fromBase64Url(payload);
  } catch {
    return { ok: false, reason: "Le code est abîmé (caractères illisibles). Copie-le en entier, sans rien ajouter." };
  }
  if (crc32(bytes) !== checksum.toLowerCase()) return { ok: false, reason: "Le code est incomplet ou abîmé (la somme de contrôle ne correspond pas). Copie-le de nouveau, en entier." };
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as Record<string, unknown>;
  } catch {
    return { ok: false, reason: "Le contenu du code est illisible." };
  }
  if (!raw || typeof raw !== "object" || raw.v !== 1) return { ok: false, reason: "Ce code vient d'une autre version du jeu." };
  if (typeof raw.id !== "string" || !PLAYER_ID.test(raw.id)) return { ok: false, reason: "Le code ne contient pas d'identifiant de joueur valide." };
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
        decodeReplay(r.replay); // une rediffusion illisible ne servirait à rien au serveur : on la laisse de côté, le temps reste
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
  return { ok: true, data: { version: 1, id: raw.id, name, best, sub, ...(Object.keys(ranks).length ? { ranks } : {}) } };
}

/** Rediffusions d'un ancien code à envoyer au serveur pour validation (une par jour, la date vient du circuit). */
export function legacyReplays(data: TransferData): { date: string; replay: string }[] {
  const out: { date: string; replay: string }[] = [];
  for (const [trackId, r] of Object.entries(data.best)) {
    const date = /^jour-(\d{4}-\d{2}-\d{2})/.exec(trackId)?.[1];
    if (date && r.replay) out.push({ date, replay: r.replay });
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : -1));
}

// --- Application -------------------------------------------------------------------------------------------------------------------
/**
 * Circuits d'aujourd'hui dont ce navigateur a un record avec sa rediffusion que le serveur n'a pas confirmé (fait hors ligne, ou sous un pseudo
 * refusé) : ils survivent à un changement d'identité, pour être envoyés au serveur au nom du nouveau profil (qui garde le meilleur).
 */
export function pendingTrackIds(storage: ReadStorage, today: string): string[] {
  const out: string[] = [];
  for (const trackId of keysWith(storage, BEST)) {
    if (!DAY_TRACK.test(trackId) || !trackId.startsWith(`jour-${today}-`)) continue;
    try {
      const r = JSON.parse(storage.getItem(BEST + trackId) ?? "null") as TransferRecord | null;
      const confirmed = Number(storage.getItem(SUB + trackId));
      if (r?.replay && Number.isFinite(r.ms) && !(Number.isFinite(confirmed) && confirmed > 0 && confirmed <= r.ms)) out.push(trackId);
    } catch {
      /* illisible : ignoré */
    }
  }
  return out;
}

/**
 * Change l'identité de ce navigateur : identifiant (et pseudo connu) remplacés, cache des records et des places effacé — il appartenait à
 * l'ancienne identité, la synchronisation le remplira avec le profil du serveur. Les records de `keep` (voir `pendingTrackIds`) restent. Les
 * temps « confirmés » appartiennent à l'ancien identifiant : ils partent tous. Les réglages (son, caméra, commandes tactiles) et les
 * essais ne bougent pas. Rend `false` si le stockage refuse l'écriture.
 */
export function applyIdentity(identity: { id: string; name: string | null }, storage: WriteStorage, keep: readonly string[] = []): boolean {
  try {
    for (const k of keysWith(storage, BEST)) if (DAY_TRACK.test(k) && !keep.includes(k)) storage.removeItem(BEST + k);
    for (const k of keysWith(storage, SUB)) if (DAY_TRACK.test(k)) storage.removeItem(SUB + k);
    clearRanks(storage);
    writeIdentity(identity, storage); // la part de la plateforme : identifiant, pseudo, code en cours, avis
    return true;
  } catch {
    return false;
  }
}

/**
 * Lot P4 (plateforme) : un code chargé chez DailyTrack avance la révision d'identité de la plateforme (les autres jeux videront leur cache de
 * l'ancienne identité à leur prochain démarrage) et la note comme vue ici (le cache vient d'être vidé : rien à refaire au rechargement).
 */
export function noteCodeLoaded(storage: WriteStorage): void {
  noteIdentityChange(storage, "code", SEEN_IDENTITY_KEY);
}

/**
 * Lot P4 (plateforme) : au démarrage de DailyTrack. Si un code a été chargé **dans un autre jeu** de la plateforme depuis sa dernière visite
 * (le compteur de révision d'identité, `@cdj/profile`), le cache des records de l'ancienne identité est vidé exactement comme au chargement
 * d'un code ici (`applyIdentity`, avec l'identité qui est maintenant celle du navigateur ; le record d'aujourd'hui non confirmé reste,
 * `pendingTrackIds`). Sinon rien ne change. Rend vrai si le cache a été vidé.
 */
export function followIdentityRevision(storage: WriteStorage, today: string): boolean {
  try {
    if (identityRevisionSeen(storage, SEEN_IDENTITY_KEY) !== "code") return false;
    const id = readPlayerId(storage);
    if (!id) return false;
    return applyIdentity({ id, name: storage.getItem(NAME_KEY) }, storage, pendingTrackIds(storage, today));
  } catch {
    return false; // stockage illisible : le cache reste tel quel (le serveur reste la vérité)
  }
}
