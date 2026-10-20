import { describe, expect, it } from "vitest";
import {
  IDENTITY_CODE_REV_KEY,
  IDENTITY_REV_KEY,
  MIGRATION_MAX_CHARS,
  MIGRATION_SEEN_KEY,
  NAME_KEY,
  PLAYER_KEY,
  collectMigration,
  consumeMigrationFragment,
  migrationQuestion,
  importMigration,
  migrationFragment,
  noteIdentityChange,
  readMigrationFragment,
  writeIdentity,
  type ListableStore,
  type MigrationHooks,
} from "../src/index";

// Lot R4 (plateforme) : l'identité passe de l'ancienne origine (GitHub Pages) à la nouvelle (playdujour.com) dans le fragment de l'adresse.

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

const ID_A = "0123456789abcdef0123456789abcdef";
const ID_B = "fedcba9876543210fedcba9876543210";

function oldOrigin(id = ID_A, name: string | null = "Pilote"): MemStore {
  const s = new MemStore();
  s.setItem(PLAYER_KEY, id);
  if (name) s.setItem(NAME_KEY, name);
  s.setItem("cdj:best:2026-10-19", "{}"); // un record de DailyTrack : jamais transmis (le serveur le rend)
  s.setItem("jump:classement:attente", '{"date":"2026-10-20","ticks":1234}');
  s.setItem("jump:jour:jour-2026-10-20-g9", '{"day":"2026-10-20","essais":3}');
  s.setItem("jump:morts:jour-2026-10-20-g9", "[[1,2,0]]");
  s.setItem("jump:settings", '{"son":false}'); // réglages : pas transmis
  return s;
}

/** Des crochets qui notent ce qu'on leur demande. */
function hooks(answer: boolean, store?: MemStore): MigrationHooks & { asked: Array<[string | null, string | null]>; adopted: string[] } {
  const h = {
    asked: [] as Array<[string | null, string | null]>,
    adopted: [] as string[],
    choose(current: string | null, incoming: string | null) {
      h.asked.push([current, incoming]);
      return answer;
    },
    adopt(identity: { id: string; name: string | null }) {
      h.adopted.push(identity.id);
      if (store) {
        writeIdentity(identity, store);
        noteIdentityChange(store, "code", "track:identite:vue");
      }
      return true;
    },
  };
  return h;
}

const fragmentOf = (s: MemStore) => migrationFragment(collectMigration(s)!);

describe("fragment de migration : ce qui part de l'ancienne origine", () => {
  it("transmet l'identité (code CDJ2), le pseudo et les données locales utiles de DailyJump, rien d'autre", () => {
    const p = collectMigration(oldOrigin())!;
    expect(p.id).toBe(ID_A);
    expect(p.name).toBe("Pilote");
    expect(Object.keys(p.keys).sort()).toEqual(["jump:classement:attente", "jump:jour:jour-2026-10-20-g9", "jump:morts:jour-2026-10-20-g9"]);
    const f = migrationFragment(p);
    expect(f.startsWith("#dujour=1.")).toBe(true);
    expect(f).not.toContain(ID_A); // l'identifiant n'apparaît pas en clair dans l'adresse (base64url)
  });

  it("sans identité, rien n'est transmis", () => {
    const s = oldOrigin();
    s.removeItem(PLAYER_KEY);
    expect(collectMigration(s)).toBeNull();
  });

  it("respecte la taille : une clé trop grosse est sautée, les suivantes (plus petites) passent, l'identité toujours", () => {
    const s = oldOrigin();
    s.setItem("jump:vies:envoi", "x".repeat(MIGRATION_MAX_CHARS)); // deuxième priorité, trop grosse
    const p = collectMigration(s)!;
    expect(p.keys["jump:vies:envoi"]).toBeUndefined();
    expect(p.keys["jump:classement:attente"]).toBeDefined();
    expect(p.keys["jump:morts:jour-2026-10-20-g9"]).toBeDefined();
    expect(migrationFragment(p).length).toBeLessThanOrEqual(MIGRATION_MAX_CHARS);
  });

  it("aller-retour exact, accents compris", () => {
    const s = oldOrigin(ID_A, "Élodie");
    const read = readMigrationFragment(fragmentOf(s));
    expect(read).toMatchObject({ present: true, ok: true, payload: { id: ID_A, name: "Élodie" } });
  });
});

describe("arrivée sur le nouveau domaine", () => {
  it("pas d'identité : import automatique, sans rien demander ; une création (aucun autre jeu ne vide son cache)", () => {
    const here = new MemStore();
    const h = hooks(false);
    const r = importMigration(here, readMigrationFragment(fragmentOf(oldOrigin())), h);
    expect(r).toEqual({ outcome: "importe", keys: 3 });
    expect(here.getItem(PLAYER_KEY)).toBe(ID_A);
    expect(here.getItem(NAME_KEY)).toBe("Pilote");
    expect(here.getItem("jump:classement:attente")).toContain("1234");
    expect(here.getItem("cdj:best:2026-10-19")).toBeNull();
    expect(h.asked).toEqual([]);
    expect(here.getItem(IDENTITY_REV_KEY)).toBe("1");
    expect(here.getItem(IDENTITY_CODE_REV_KEY)).toBeNull();
  });

  it("même identité : rien ne change d'identité ; seules les données absentes sont ajoutées, jamais écrasées", () => {
    const here = new MemStore();
    here.setItem(PLAYER_KEY, ID_A);
    here.setItem("jump:classement:attente", "local");
    const h = hooks(false);
    const r = importMigration(here, readMigrationFragment(fragmentOf(oldOrigin())), h);
    expect(r).toEqual({ outcome: "meme", keys: 2 });
    expect(here.getItem("jump:classement:attente")).toBe("local");
    expect(here.getItem(NAME_KEY)).toBe("Pilote"); // pseudo manquant ici : complété
    expect(h.asked).toEqual([]);
    expect(here.getItem(IDENTITY_REV_KEY)).toBeNull();
  });

  it("autre identité, le joueur garde la sienne : rien n'est écrit (sauf la trace du fragment vu)", () => {
    const here = new MemStore();
    here.setItem(PLAYER_KEY, ID_B);
    here.setItem(NAME_KEY, "Ici");
    const h = hooks(false, here);
    const r = importMigration(here, readMigrationFragment(fragmentOf(oldOrigin())), h);
    expect(r.outcome).toBe("garde");
    expect(h.asked).toEqual([["Ici", "Pilote"]]);
    expect(h.adopted).toEqual([]);
    expect(here.getItem(PLAYER_KEY)).toBe(ID_B);
    expect(here.getItem("jump:classement:attente")).toBeNull();
    expect(here.getItem(MIGRATION_SEEN_KEY)).toMatch(/^[0-9a-f]{8}$/);
  });

  it("autre identité, le joueur prend celle de l'ancienne adresse : la règle d'un code chargé (crochet du jeu)", () => {
    const here = new MemStore();
    here.setItem(PLAYER_KEY, ID_B);
    const h = hooks(true, here);
    const r = importMigration(here, readMigrationFragment(fragmentOf(oldOrigin())), h);
    expect(r.outcome).toBe("importe");
    expect(h.adopted).toEqual([ID_A]);
    expect(here.getItem(PLAYER_KEY)).toBe(ID_A);
    expect(here.getItem(IDENTITY_CODE_REV_KEY)).toBe("1"); // les autres jeux videront leur cache de l'ancienne identité
  });

  it("un seul import : le même fragment revenu (vieux favori) n'est ni réimporté ni redemandé", () => {
    const here = new MemStore();
    here.setItem(PLAYER_KEY, ID_B);
    const fragment = fragmentOf(oldOrigin());
    const h = hooks(false, here);
    expect(importMigration(here, readMigrationFragment(fragment), h).outcome).toBe("garde");
    expect(importMigration(here, readMigrationFragment(fragment), h).outcome).toBe("deja-vu");
    expect(h.asked).toHaveLength(1);
  });

  it("fragment abîmé : rien n'est importé, et la raison est dite", () => {
    const good = fragmentOf(oldOrigin());
    const value = good.slice("#dujour=".length);
    const [v, body, crc] = value.split(".");
    const cases = [
      `#dujour=${v}.${body!.slice(0, -4)}.${crc}`, // adresse coupée
      `#dujour=${v}.${body}.00000000`, // somme fausse
      `#dujour=9.${body}.${crc}`, // version inconnue
      "#dujour=1.%%%.12345678", // illisible
      "#dujour=",
    ];
    for (const hash of cases) {
      const read = readMigrationFragment(hash);
      expect(read.present, hash).toBe(true);
      expect(read.present && read.ok, hash).toBe(false);
      const here = new MemStore();
      expect(importMigration(here, read, hooks(true)).outcome).toBe("abime");
      expect(here.length).toBe(0);
    }
  });

  it("une clé hors de la liste ou une identité invalide glissée dans un fragment bien formé est refusée", () => {
    const json = JSON.stringify({ c: "CDJ2.zz.00000000", k: {} });
    const b64 = btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const crc = readMigrationFragment(`#dujour=1.${b64}.0`);
    expect(crc.present && !crc.ok).toBe(true);
    const p = collectMigration(oldOrigin())!;
    const read = readMigrationFragment(migrationFragment({ ...p, keys: { ...p.keys, "cdj:player": ID_B, "jump:settings": "x" } }));
    expect(read.present && read.ok && Object.keys(read.payload.keys)).not.toContain("cdj:player");
    expect(read.present && read.ok && Object.keys(read.payload.keys)).not.toContain("jump:settings");
  });

  it("pas de fragment : rien", () => {
    expect(readMigrationFragment("")).toEqual({ present: false });
    expect(readMigrationFragment("#autre=1")).toEqual({ present: false });
    expect(importMigration(new MemStore(), { present: false }, hooks(true)).outcome).toBe("absent");
  });
});

describe("effacement du fragment après lecture", () => {
  it("efface l'adresse aussitôt (chemin et paramètres gardés), même un fragment abîmé, avant tout import", () => {
    const replaced: string[] = [];
    const read = consumeMigrationFragment({ pathname: "/jump/", search: "?seed=2026-10-20", hash: fragmentOf(oldOrigin()) }, (u) => replaced.push(u));
    expect(read.present).toBe(true);
    expect(replaced).toEqual(["/jump/?seed=2026-10-20"]);
    consumeMigrationFragment({ pathname: "/track/", search: "", hash: "#dujour=abime" }, (u) => replaced.push(u));
    expect(replaced).toEqual(["/jump/?seed=2026-10-20", "/track/"]);
  });

  it("sans fragment de migration, l'adresse n'est pas touchée", () => {
    const replaced: string[] = [];
    consumeMigrationFragment({ pathname: "/track/", search: "?debug", hash: "#x" }, (u) => replaced.push(u));
    expect(replaced).toEqual([]);
  });
});

describe("la question du choix", () => {
  it("nomme les deux profils, en français, et dit ce que font OK et Annuler", () => {
    const q = migrationQuestion("Ici", "Pilote");
    expect(q).toContain("« Pilote »");
    expect(q).toContain("« Ici »");
    expect(q).toMatch(/OK : prendre/);
    expect(q).toMatch(/Annuler : garder/);
    expect(migrationQuestion(null, null)).toContain("sans pseudo");
  });
});
