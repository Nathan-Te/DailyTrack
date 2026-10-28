import { describe, expect, it } from "vitest";
import { IDENTITY_CODE_REV_KEY, NAME_KEY, PLAYER_KEY, readIdentityRevision, type ListableStore } from "../src/index";
import { RETROUVER_VU_KEY, adopterProfil, extraireCode, lireCodeSaisi, marquerRetrouverVu, retrouverAPropos, trouverProfil, verifierRetrouver } from "../src/retrouver";
import { encodeTransfer } from "../src/transfer";

// Lot 53 : « Retrouver mon profil » — l'application ajoutée à l'écran d'accueil de l'iPhone a son propre stockage : au premier lancement, sans profil,
// on propose de le retrouver par le code de transfert. Ce qui se décide ici est pur : stockage et réseau sont injectés.

class MemStore implements ListableStore {
  data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

const ID = "0123456789abcdef0123456789abcdef";
const AUTRE = "fedcba9876543210fedcba9876543210";

describe("retrouverAPropos", () => {
  it("seulement en mode application, sans profil, tant que la carte n'est pas passée", () => {
    const s = new MemStore();
    expect(retrouverAPropos(s, true)).toBe(true);
    expect(retrouverAPropos(s, false)).toBe(false); // dans Safari : le profil est là, rien à retrouver
    s.setItem(PLAYER_KEY, ID);
    expect(retrouverAPropos(s, true)).toBe(false); // un profil existe déjà
  });
  it("passée une fois, elle ne revient pas ; un stockage illisible ou absent ne la propose pas", () => {
    const s = new MemStore();
    marquerRetrouverVu(s);
    expect(s.getItem(RETROUVER_VU_KEY)).toBe("1");
    expect(retrouverAPropos(s, true)).toBe(false);
    expect(retrouverAPropos(null, true)).toBe(false);
    const casse = { getItem: () => { throw new Error("refusé"); } };
    expect(retrouverAPropos(casse, true)).toBe(false);
    expect(() => marquerRetrouverVu({ setItem: () => { throw new Error("refusé"); } })).not.toThrow();
  });
});

describe("lireCodeSaisi", () => {
  it("lit un code CDJ2 collé, même entouré d'autres mots ou coupé par des retours à la ligne", () => {
    const code = encodeTransfer(ID);
    expect(extraireCode(`Mon code : ${code} (à garder)`)).toBe(code);
    expect(lireCodeSaisi(`  ${code}\n`, new MemStore())).toEqual({ ok: true, id: ID });
    expect(lireCodeSaisi(`Mon code : ${code} (à garder)`, new MemStore())).toEqual({ ok: true, id: ID });
    expect(lireCodeSaisi(code.replace(".", "\n."), new MemStore())).toEqual({ ok: true, id: ID });
  });
  it("refuse le vide, un texte quelconque, une somme de contrôle fausse et un ancien code CDJ1", () => {
    expect(lireCodeSaisi("   ", null)).toEqual({ ok: false, erreur: "vide" });
    expect(lireCodeSaisi("bonjour", null)).toEqual({ ok: false, erreur: "illisible" });
    expect(lireCodeSaisi(`CDJ2.${ID}.00000000`, null)).toEqual({ ok: false, erreur: "illisible" });
    expect(lireCodeSaisi("CDJ1.abcdef.12345678", null)).toEqual({ ok: false, erreur: "illisible" });
  });
  it("reconnaît le code de ce navigateur", () => {
    const s = new MemStore();
    s.setItem(PLAYER_KEY, ID);
    expect(lireCodeSaisi(encodeTransfer(ID), s)).toEqual({ ok: false, erreur: "deja" });
    expect(lireCodeSaisi(encodeTransfer(AUTRE), s)).toEqual({ ok: true, id: AUTRE });
  });
});

describe("trouverProfil", () => {
  it("rend le pseudo et le plus grand nombre de jours finis ; une erreur du serveur est rendue telle quelle", async () => {
    const ok = await trouverProfil(ID, async () => ({ ok: true, data: { pseudo: "Zoé", jeux: [{ joursFinis: 3 }, { joursFinis: 12 }] } }));
    expect(ok).toEqual({ ok: true, data: { pseudo: "Zoé", jours: 12 } });
    const ko = { ok: false as const, code: "unknown_player", message: "", status: 404 };
    expect(await trouverProfil(ID, async () => ko)).toBe(ko);
  });
});

describe("adopterProfil", () => {
  it("écrit l'identité, avance la révision de code (les jeux videront leur cache) et passe la carte", () => {
    const s = new MemStore();
    expect(adopterProfil(s, ID, "Zoé")).toBe(true);
    expect(s.getItem(PLAYER_KEY)).toBe(ID);
    expect(s.getItem(NAME_KEY)).toBe("Zoé");
    expect(readIdentityRevision(s)).toEqual({ rev: 1, code: 1 });
    expect(s.getItem(IDENTITY_CODE_REV_KEY)).toBe("1");
    expect(retrouverAPropos(s, true)).toBe(false);
  });
  it("un stockage qui refuse d'écrire n'adopte rien", () => {
    const s = new MemStore();
    s.setItem = () => {};
    expect(adopterProfil(s, ID, "Zoé")).toBe(false);
  });
});

describe("verifierRetrouver", () => {
  const profil = { pseudo: "Zoé", renameRequired: false, jeux: [{ jeu: "cdj", joursFinis: 5 }, { jeu: "jump", joursFinis: 2 }] };
  const reponse = (corps: unknown, status = 200) => async () => new Response(JSON.stringify(corps), { status });

  it("demande le profil à /api/portail/profil avec l'identifiant en en-tête (jamais dans l'adresse) et n'écrit rien avant la confirmation", async () => {
    const s = new MemStore();
    const appels: { url: string; init: RequestInit }[] = [];
    const r = await verifierRetrouver({
      saisi: encodeTransfer(ID),
      base: "",
      stockage: s,
      fetchImpl: async (url, init) => (appels.push({ url, init }), new Response(JSON.stringify(profil), { status: 200 })),
    });
    expect(appels).toHaveLength(1);
    expect(appels[0]!.url).toBe("/api/portail/profil");
    expect(appels[0]!.url).not.toContain(ID);
    expect((appels[0]!.init.headers as Record<string, string>)["X-Player-Id"]).toBe(ID);
    expect(r).toMatchObject({ ok: true, pseudo: "Zoé", jours: 5 });
    expect(s.getItem(PLAYER_KEY)).toBeNull(); // rien n'est adopté tant que le joueur n'a pas confirmé
    if (r.ok) expect(r.adopter()).toBe(true);
    expect(s.getItem(PLAYER_KEY)).toBe(ID);
    expect(s.getItem(NAME_KEY)).toBe("Zoé");
  });
  it("refuse sans réseau ce qui n'est pas un code (aucune requête) ; rend le code d'erreur du serveur", async () => {
    let n = 0;
    const f = async () => (n++, new Response("{}", { status: 200 }));
    expect(await verifierRetrouver({ saisi: "n'importe quoi", base: "", stockage: new MemStore(), fetchImpl: f })).toEqual({ ok: false, erreur: "illisible" });
    expect(n).toBe(0);
    const inconnu = await verifierRetrouver({ saisi: encodeTransfer(ID), base: "", stockage: new MemStore(), fetchImpl: reponse({ error: "unknown_player" }, 404) });
    expect(inconnu).toEqual({ ok: false, erreur: { code: "unknown_player" } });
    const panne = await verifierRetrouver({ saisi: encodeTransfer(ID), base: "", stockage: new MemStore(), fetchImpl: async () => { throw new TypeError("réseau"); } });
    expect(panne).toEqual({ ok: false, erreur: { code: "network" } });
  });
});
