import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  CLES_GARDEES,
  GENERATION_KEY,
  NAVIGATEUR_NEUF,
  NOUVEAU_DEPART_KEY,
  appliquerGeneration,
  clesDeDonnees,
  generationDeReponse,
  initialiserGeneration,
  lireNouveauDepart,
  type ListableStore,
} from "../src/index";

// Lot R8 — un navigateur qui garde une génération de données plus ancienne que celle du serveur repart de zéro, en gardant ses réglages.

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

/** Un navigateur qui a joué avant la remise à zéro : identité, pseudo, records, séries, envois en attente, mémoire de Jump… et ses réglages. */
function joueurDAvant(): MemStore {
  const s = new MemStore();
  for (const [k, v] of Object.entries({
    "cdj:player": "a".repeat(32),
    "cdj:name": "Nowy",
    "cdj:identite:rev": "3",
    "cdj:identite:vue": "3",
    "cdj:best:jour-2026-10-20-g18": '{"ms":40000}',
    "cdj:rank:2026-10-20": '{"rank":2}',
    "cdj:sub:jour-2026-10-20-g18": "1",
    "cdj:notice:rename": "1",
    "cdj:howto": "1",
    "cdj:track:garage": '{"voiture":"rallye"}',
    "jump:historique": "[1,2]",
    "jump:classement:attente": "[]",
    "jump:classement:rangs": "{}",
    "jump:vies:envoi": "[]",
    "jump:meilleur:x": "1",
    "jump:aide": "1",
    "cdj:langue": "en",
    "cdj:audio": '{"volume":0.2}',
    "cdj:touch": "{}",
    "cdj:camera": "cockpit",
    "cdj:qualite": "{}",
    "cdj:settings": '{"unit":"mph"}',
    "jump:settings": "{}",
    "jump:camera": "x",
    "unrelated:cle": "reste",
  })) s.setItem(k, v);
  return s;
}

describe("génération de données : l'effacement", () => {
  it("un navigateur d'avant (aucune génération, des données) est effacé dès que le serveur annonce une génération, ses réglages gardés", () => {
    const s = joueurDAvant();
    initialiserGeneration(s); // des données : pas marqué neuf
    expect(s.getItem(GENERATION_KEY)).toBeNull();
    expect(appliquerGeneration(s, 1_800_000_000_000)).toBe("efface");
    expect([...s.data.keys()].sort()).toEqual(
      ["cdj:audio", "cdj:camera", "cdj:generation", "cdj:langue", "cdj:nouveau-depart", "cdj:qualite", "cdj:settings", "cdj:touch", "jump:camera", "jump:settings", "unrelated:cle"].sort(),
    );
    expect(s.getItem("cdj:langue")).toBe("en");
    expect(s.getItem(GENERATION_KEY)).toBe("1800000000000");
  });

  it("une génération plus ancienne efface ; la même, une plus récente que celle du serveur, ou 0, jamais", () => {
    const s = joueurDAvant();
    s.setItem(GENERATION_KEY, "1000");
    expect(appliquerGeneration(s, 1000)).toBe("inchangee");
    expect(appliquerGeneration(s, 999)).toBe("inchangee"); // un cache qui rend une vieille réponse ne vide pas un joueur
    expect(appliquerGeneration(s, 0)).toBe("inchangee");
    expect(appliquerGeneration(s, null)).toBe("inchangee"); // réponse sans génération
    expect(s.getItem("cdj:player")).not.toBeNull();
    expect(appliquerGeneration(s, 2000)).toBe("efface");
    expect(s.getItem("cdj:player")).toBeNull();
    expect(s.getItem(GENERATION_KEY)).toBe("2000");
    // Ensuite, plus rien à faire : pas de boucle de rechargement.
    expect(appliquerGeneration(s, 2000)).toBe("inchangee");
  });

  it("un navigateur d'avant sans génération, tant que le serveur n'a jamais été remis à zéro (0) : adoptée, rien d'effacé ; la remise à zéro l'efface ensuite", () => {
    const s = joueurDAvant();
    expect(appliquerGeneration(s, 0)).toBe("adoptee");
    expect(s.getItem(GENERATION_KEY)).toBe("0");
    expect(s.getItem("cdj:player")).not.toBeNull();
    expect(appliquerGeneration(s, 5)).toBe("efface");
    expect(clesDeDonnees(s)).toEqual([]);
  });

  it("le message « Nouveau départ » n'est lu qu'une fois", () => {
    const s = joueurDAvant();
    appliquerGeneration(s, 7);
    expect(lireNouveauDepart(s)).toBe(true);
    expect(s.getItem(NOUVEAU_DEPART_KEY)).toBeNull();
    expect(lireNouveauDepart(s)).toBe(false);
  });
});

describe("génération de données : un navigateur neuf", () => {
  it("démarré sans donnée (la langue n'en est pas une) : marqué neuf, adopte la génération sans effacer ni rien dire", () => {
    const s = new MemStore();
    s.setItem("cdj:langue", "fr");
    initialiserGeneration(s);
    expect(s.getItem(GENERATION_KEY)).toBe(NAVIGATEUR_NEUF);
    // Il écrit ensuite ses clés de démarrage (le serveur répond après)…
    s.setItem("cdj:identite:vue", "0");
    s.setItem("cdj:howto", "1");
    expect(appliquerGeneration(s, 1_800_000_000_000)).toBe("adoptee");
    expect(s.getItem("cdj:howto")).toBe("1");
    expect(lireNouveauDepart(s)).toBe(false);
    expect(s.getItem(GENERATION_KEY)).toBe("1800000000000");
  });

  it("ne marque pas deux fois, et ne touche pas une génération déjà adoptée (par un autre jeu)", () => {
    const s = new MemStore();
    s.setItem(GENERATION_KEY, "42");
    initialiserGeneration(s);
    expect(s.getItem(GENERATION_KEY)).toBe("42");
  });

  it("une génération illisible dans le stockage n'efface rien", () => {
    const s = joueurDAvant();
    s.setItem(GENERATION_KEY, "abc");
    expect(appliquerGeneration(s, 10)).toBe("inchangee");
    expect(s.getItem("cdj:player")).not.toBeNull();
  });
});

describe("génération de données : cas limites", () => {
  it("un stockage qui refuse d'écrire n'efface rien (et ne lève pas)", () => {
    const s = joueurDAvant();
    s.setItem = () => {
      throw new Error("quota");
    };
    expect(appliquerGeneration(s, 10)).toBe("inchangee");
    expect(s.getItem("cdj:player")).not.toBeNull();
    expect(() => initialiserGeneration(s)).not.toThrow();
  });

  it("un stockage qui ne retient rien n'efface rien (pas de boucle de rechargement)", () => {
    const s = joueurDAvant();
    s.setItem = () => undefined;
    expect(appliquerGeneration(s, 10)).toBe("inchangee");
    expect(s.getItem("cdj:player")).not.toBeNull();
  });

  it("la génération d'une réponse du serveur : un entier positif, sinon null", () => {
    expect(generationDeReponse({ generation: 0 })).toBe(0);
    expect(generationDeReponse({ generation: 1800000000000 })).toBe(1800000000000);
    for (const mauvais of [{}, null, { generation: "5" }, { generation: -1 }, { generation: 1.5 }, { generation: null }]) expect(generationDeReponse(mauvais)).toBeNull();
  });
});

// La liste des réglages gardés ne doit pas rouiller : chaque clé doit exister dans le code des applications (sinon elle a été renommée).
describe("génération de données : les clés gardées existent encore", () => {
  const racine = new URL("../../..", import.meta.url).pathname;
  const sources = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) return f === "node_modules" || f === "dist" || f === "public" ? [] : sources(p);
      return /\.ts$/.test(f) && !/\.d\.ts$/.test(f) ? [readFileSync(p, "utf8")] : [];
    });
  const code = [...sources(join(racine, "apps/web/src")), ...sources(join(racine, "apps/jump/src")), ...sources(join(racine, "packages/profile/src")), ...sources(join(racine, "apps/portail/src"))].join("\n");
  it.each(CLES_GARDEES)("%s", (cle) => {
    const [prefixe, ...reste] = cle.split(":");
    const nom = reste.join(":");
    // Les clés de Jump s'écrivent `storageKey("nom")`, celles de Track en toutes lettres.
    const ecrite = code.includes(`"${cle}"`) || code.includes(`\`${cle}`) || (prefixe === "jump" && code.includes(`storageKey("${nom}")`));
    expect(ecrite, cle).toBe(true);
  });
});
