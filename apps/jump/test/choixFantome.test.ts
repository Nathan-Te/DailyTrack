import { describe, expect, it } from "vitest";
import { GHOST_CHOICES, loadGhostChoice, nextChoice, parseChoice, saveGhostChoice, serializeChoice, shown, startChoice, type GhostChoice } from "../src/ghostChoice";
import type { KeyValue } from "../src/memory";
import "./francais";

// Lot G1 (plateforme) : le choix du fantôme de Jump — il tourne (et saute ce qui n'existe pas) et se mémorise sous la clé d'avant (`jump:fantome`).

class MemStore implements KeyValue {
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
  key(i: number) {
    return [...this.data.keys()][i] ?? null;
  }
  get length() {
    return this.data.size;
  }
}
const BROKEN: KeyValue = {
  getItem: () => {
    throw new Error("indisponible");
  },
  setItem: () => {
    throw new Error("indisponible");
  },
  removeItem: () => {
    throw new Error("indisponible");
  },
  key: () => {
    throw new Error("indisponible");
  },
  length: 0,
};

const ALL = { premier: true };
const NONE = { premier: false };

describe("le choix du fantôme tourne et saute ce qui n'existe pas", () => {
  it("l'ordre : le tien → le premier → aucun → le tien", () => {
    expect(GHOST_CHOICES).toEqual(["mien", "premier", "aucun"]);
    let c: GhostChoice = "mien";
    const seen: GhostChoice[] = [];
    for (let i = 0; i < 4; i++) seen.push((c = nextChoice(c, ALL)));
    expect(seen).toEqual(["premier", "aucun", "mien", "premier"]);
  });
  it("le premier n'est pas dans le cycle quand personne n'est lu ou que c'est toi", () => {
    expect(nextChoice("mien", NONE)).toBe("aucun");
    expect(nextChoice("aucun", NONE)).toBe("mien");
  });
  it("un choix courant qui n'existe plus mène au suivant possible ; « le tien » et « aucun » existent toujours", () => {
    expect(nextChoice("premier", NONE)).toBe("aucun");
    for (const c of GHOST_CHOICES) expect(["mien", "aucun"]).toContain(nextChoice(c, NONE));
  });
  it("ce que chaque choix montre : le tien avec le premier à côté (réglage), le premier seul, rien", () => {
    expect(shown("mien", true)).toEqual({ own: true, first: true });
    expect(shown("mien", false)).toEqual({ own: true, first: false });
    expect(shown("premier", false)).toEqual({ own: false, first: true });
    expect(shown("aucun", true)).toEqual({ own: false, first: false });
  });
});

describe("mémorisé sous `jump:fantome`, la clé d'avant le lot", () => {
  it("les valeurs d'avant se lisent : « 1 » le tien, « 0 » aucun ; la nouvelle : premier ; le reste (dont l'ancien « diamant ») : le tien", () => {
    expect(parseChoice("1")).toBe("mien");
    expect(parseChoice("0")).toBe("aucun");
    expect(parseChoice("premier")).toBe("premier");
    expect(parseChoice("diamant")).toBe("mien");
    expect(parseChoice(null)).toBe("mien");
    expect(parseChoice("n'importe quoi")).toBe("mien");
    for (const c of GHOST_CHOICES) expect(parseChoice(serializeChoice(c))).toBe(c);
    expect(serializeChoice("mien")).toBe("1");
    expect(serializeChoice("aucun")).toBe("0");
  });
  it("écrit et relu dans la même clé, sans clé nouvelle", () => {
    const store = new MemStore();
    expect(loadGhostChoice(store)).toBe("mien");
    saveGhostChoice(store, "premier");
    expect([...store.data.keys()]).toEqual(["jump:fantome"]);
    expect(loadGhostChoice(store)).toBe("premier");
    store.setItem("jump:fantome", "0"); // un joueur d'avant le lot qui l'avait caché
    expect(loadGhostChoice(store)).toBe("aucun");
  });
  it("marche sans stockage et avec un stockage qui lève", () => {
    for (const store of [null, BROKEN]) {
      expect(loadGhostChoice(store)).toBe("mien");
      expect(() => saveGhostChoice(store, "premier")).not.toThrow();
    }
  });
  it("?ghost= impose le choix de départ sans toucher à ce qui est mémorisé", () => {
    expect(startChoice(null, "premier")).toBe("premier");
    expect(startChoice("off", "premier")).toBe("aucun");
    expect(startChoice("first", "mien")).toBe("premier");
    expect(startChoice("best", "aucun")).toBe("mien");
  });
});
