import { describe, expect, it } from "vitest";
import {
  IDENTITY_CODE_REV_KEY,
  IDENTITY_REV_KEY,
  PLAYER_KEY,
  createIdentity,
  identityRevisionSeen,
  noteIdentityChange,
  readIdentityRevision,
  type KeyValueStore,
} from "../src/index";

// Lot P4 (plateforme) : le compteur de révision d'identité de la plateforme. Tout jeu qui change l'identité l'avance (code chargé, rotation,
// première création) ; chaque jeu compare au démarrage la révision à la dernière qu'il a vue : un code chargé ailleurs depuis = vider son cache.

class MemStore implements KeyValueStore {
  data = new Map<string, string>();
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
const SEEN_A = "a:identite:vue";
const SEEN_B = "b:identite:vue";

describe("révision d'identité de la plateforme", () => {
  it("vaut 0 tant que rien n'a changé ; chaque changement l'avance ; un code chargé note sa révision", () => {
    const s = new MemStore();
    expect(readIdentityRevision(s)).toEqual({ rev: 0, code: 0 });
    expect(noteIdentityChange(s, "creation")).toBe(1);
    expect(noteIdentityChange(s, "code")).toBe(2);
    expect(noteIdentityChange(s, "rotation")).toBe(3);
    expect(readIdentityRevision(s)).toEqual({ rev: 3, code: 2 });
    expect([s.getItem(IDENTITY_REV_KEY), s.getItem(IDENTITY_CODE_REV_KEY)]).toEqual(["3", "2"]);
    // Une valeur abîmée compte pour 0.
    s.setItem(IDENTITY_REV_KEY, "abc");
    expect(readIdentityRevision(s).rev).toBe(0);
  });

  it("au démarrage : première visite = rien (notée) ; un code chargé dans un autre jeu = « code », une seule fois ; une rotation ou une création = rien", () => {
    const s = new MemStore();
    noteIdentityChange(s, "code"); // avant la première visite du jeu A : on ne sait pas, rien n'est effacé
    expect(identityRevisionSeen(s, SEEN_A)).toBe("aucun");
    expect(s.getItem(SEEN_A)).toBe("1");
    expect(identityRevisionSeen(s, SEEN_A)).toBe("aucun");
    // Le jeu B charge un code : le jeu A le voit à son prochain démarrage, une fois.
    noteIdentityChange(s, "code", SEEN_B);
    expect(identityRevisionSeen(s, SEEN_A)).toBe("code");
    expect(identityRevisionSeen(s, SEEN_A)).toBe("aucun");
    // Le jeu qui a chargé le code a déjà vidé son cache : rien à refaire chez lui.
    expect(identityRevisionSeen(s, SEEN_B)).toBe("aucun");
    // Rotation, création : même profil, rien n'est effacé.
    noteIdentityChange(s, "rotation");
    noteIdentityChange(s, "creation");
    expect(identityRevisionSeen(s, SEEN_A)).toBe("aucun");
    expect(s.getItem(SEEN_A)).toBe(s.getItem(IDENTITY_REV_KEY));
    // Un code puis une rotation depuis la dernière visite : le code compte.
    noteIdentityChange(s, "code", SEEN_B);
    noteIdentityChange(s, "rotation");
    expect(identityRevisionSeen(s, SEEN_A)).toBe("code");
  });

  it("aucun aller-retour : la réaction d'un jeu au démarrage n'avance pas la révision", () => {
    const s = new MemStore();
    identityRevisionSeen(s, SEEN_A);
    identityRevisionSeen(s, SEEN_B);
    noteIdentityChange(s, "code", SEEN_B);
    const reactions: string[] = [];
    for (let i = 0; i < 3; i++) reactions.push(identityRevisionSeen(s, SEEN_A), identityRevisionSeen(s, SEEN_B));
    expect(reactions).toEqual(["code", "aucun", "aucun", "aucun", "aucun", "aucun"]);
  });

  it("createIdentity : la première création avance la révision, pas la relecture ; un identifiant adopté (rotation) aussi, pas le même", () => {
    const s = new MemStore();
    const identity = createIdentity(() => s);
    const id = identity.getPlayerId();
    expect(readIdentityRevision(s)).toEqual({ rev: 1, code: 0 });
    expect(identity.getPlayerId()).toBe(id);
    expect(readIdentityRevision(s).rev).toBe(1);
    identity.setPlayerId(id);
    expect(readIdentityRevision(s).rev).toBe(1);
    identity.setPlayerId("f".repeat(32));
    expect(readIdentityRevision(s)).toEqual({ rev: 2, code: 0 });
    expect(s.getItem(PLAYER_KEY)).toBe("f".repeat(32));
  });

  it("un stockage qui refuse ne casse rien : rien n'est signalé, rien n'est effacé", () => {
    const broken: KeyValueStore = {
      getItem: () => {
        throw new Error("refusé");
      },
      setItem: () => {
        throw new Error("refusé");
      },
      removeItem: () => {},
    };
    expect(readIdentityRevision(broken)).toEqual({ rev: 0, code: 0 });
    expect(noteIdentityChange(broken, "code", SEEN_A)).toBe(0);
    expect(identityRevisionSeen(broken, SEEN_A)).toBe("aucun");
    expect(() => createIdentity(() => broken).getPlayerId()).not.toThrow();
  });
});
