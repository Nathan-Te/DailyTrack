import { describe, expect, it } from "vitest";
import { noteIdentityChange, writeIdentity } from "@cdj/profile";
import { SEEN_IDENTITY_KEY, followIdentityRevision, noteCodeLoaded } from "../src/transfer";

// Lot P4 (plateforme) : DailyTrack lit au démarrage le compteur de révision d'identité de la plateforme (`@cdj/profile`). Un code chargé dans
// DailyJump depuis sa dernière visite : il vide le cache des records de l'ancienne identité, exactement comme quand le code est chargé chez lui
// (`applyIdentity`). Sans changement d'identité : aucun effet. (DailyJump est simulé par ce qu'il écrit : `writeIdentity` + la révision.)

/** Un `localStorage` en mémoire. */
function memory(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial));
  return {
    get length() {
      return m.size;
    },
    key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    dump: () => Object.fromEntries(m),
  };
}

const OLD = "0123456789abcdef0123456789abcdef";
const NEW = "ffffffffffffffffffffffffffffffff";
const TODAY = "2026-10-20";
const rec = (ms: number, extra: object = {}) => JSON.stringify({ ms, splits: [10_000, 20_000], simVersion: 14, medal: "silver", ...extra });

/** Un appareil où DailyTrack a déjà tourné depuis le lot P4 (révision vue), avec les records de son identité. */
function device() {
  const t = memory({
    "cdj:player": OLD,
    "cdj:name": "Ancien",
    "cdj:best:jour-2026-10-13-g15": rec(60_000),
    "cdj:best:jour-2026-10-20-g15": rec(61_000, { replay: "AAAA" }), // record d'aujourd'hui pas encore confirmé : il suit le joueur
    "cdj:sub:jour-2026-10-19-g15": "59000",
    "cdj:rank:2026-10-13": JSON.stringify({ rank: 1, participants: 2 }),
    "cdj:best:essai": rec(7_000),
    "cdj:audio": "{}",
  });
  expect(followIdentityRevision(t, TODAY)).toBe(false); // première visite depuis le lot P4 : rien
  return t;
}

/** Ce que DailyJump écrit quand on y charge un code (`applyJumpIdentity`). */
const loadCodeInJump = (t: ReturnType<typeof memory>, id: string, name: string) => {
  writeIdentity({ id, name }, t);
  noteIdentityChange(t, "code", "jump:identite:vue");
};

describe("DailyTrack suit l'identité de la plateforme (lot P4)", () => {
  it("un code chargé dans DailyJump, puis DailyTrack ouvert : cache des records vidé, nouveau profil ; le record du jour non confirmé reste", () => {
    const t = device();
    loadCodeInJump(t, NEW, "Nouveau");
    expect(followIdentityRevision(t, TODAY)).toBe(true);
    const after = t.dump();
    expect([after["cdj:player"], after["cdj:name"]]).toEqual([NEW, "Nouveau"]);
    expect(after["cdj:best:jour-2026-10-13-g15"]).toBeUndefined();
    expect(after["cdj:sub:jour-2026-10-19-g15"]).toBeUndefined();
    expect(after["cdj:rank:2026-10-13"]).toBeUndefined();
    expect(after["cdj:best:jour-2026-10-20-g15"]).toBeDefined(); // envoyé au nom du profil chargé, comme au chargement chez DailyTrack
    expect(after["cdj:best:essai"]).toBeDefined();
    expect(after["cdj:audio"]).toBe("{}");
    expect(after[SEEN_IDENTITY_KEY]).toBe(after["cdj:identite:rev"]);
    // Une seule fois : les ouvertures suivantes ne touchent plus à rien (le cache se remplit avec le profil du serveur).
    t.setItem("cdj:best:jour-2026-10-14-g15", rec(58_000));
    expect(followIdentityRevision(t, TODAY)).toBe(false);
    expect(t.getItem("cdj:best:jour-2026-10-14-g15")).not.toBeNull();
  });

  it("sans changement d'identité : aucun effet (ouvertures répétées, une rotation ou la première création faites ailleurs)", () => {
    const t = device();
    const before = t.dump();
    expect(followIdentityRevision(t, TODAY)).toBe(false);
    expect(followIdentityRevision(t, TODAY)).toBe(false);
    expect(t.dump()).toEqual(before);
    noteIdentityChange(t, "rotation"); // « Changer mon code » dans DailyJump : même profil
    noteIdentityChange(t, "creation");
    expect(followIdentityRevision(t, TODAY)).toBe(false);
    const { [SEEN_IDENTITY_KEY]: _seen, ...rest } = t.dump();
    const { [SEEN_IDENTITY_KEY]: _before, ...restBefore } = before;
    expect(Object.fromEntries(Object.entries(rest).filter(([k]) => !k.startsWith("cdj:identite:")))).toEqual(
      Object.fromEntries(Object.entries(restBefore).filter(([k]) => !k.startsWith("cdj:identite:"))),
    );
  });

  it("un code chargé dans DailyTrack lui-même : la révision avance (pour DailyJump) mais DailyTrack ne revide rien au rechargement", () => {
    const t = device();
    writeIdentity({ id: NEW, name: "Nouveau" }, t); // ce que fait `applyIdentity` (le cache a déjà été vidé)
    noteCodeLoaded(t);
    expect(t.getItem("cdj:identite:code")).toBe("1");
    t.setItem("cdj:best:jour-2026-10-14-g15", rec(58_000)); // rempli par la synchronisation
    expect(followIdentityRevision(t, TODAY)).toBe(false);
    expect(t.getItem("cdj:best:jour-2026-10-14-g15")).not.toBeNull();
  });

  it("première visite de DailyTrack depuis le lot P4 : rien n'est effacé, même si un code a été chargé avant (on ne sait pas d'où vient le cache)", () => {
    const t = memory({ "cdj:player": NEW, "cdj:best:jour-2026-10-13-g15": rec(60_000) });
    noteIdentityChange(t, "code", "jump:identite:vue");
    expect(followIdentityRevision(t, TODAY)).toBe(false);
    expect(t.getItem("cdj:best:jour-2026-10-13-g15")).not.toBeNull();
  });

  it("un stockage illisible : rien ne casse, rien n'est effacé", () => {
    const broken = { ...memory(), getItem: () => { throw new Error("refusé"); } };
    expect(followIdentityRevision(broken, TODAY)).toBe(false);
  });
});
