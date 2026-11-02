import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { formatDay } from "@cdj/core";
import { JEUX_PUBLICS } from "@cdj/core/jeux";
import { OU_MESSAGE, ZONES_NOUVEAUTES } from "@cdj/core/nouveautes";
import { JUMP_THEME_NAMES, MAX_ATTEMPT_TICKS, PREMIER_JOUR_JUMP } from "@cdj/jump-sim";
import { MAX_REPLAY_TICKS, MEDAL_FACTORS_G1, PREMIER_JOUR, THEME_NAMES } from "@cdj/sim";
import { MAX_TICKS_REJEU, PREMIER_JOUR_TOWER, THEMES_TOWER } from "@cdj/tower-sim";
import { SCHEMA } from "../src/db";
import { GAMES } from "../src/registry";
import { REPLAY_TICKS_PER_UNIT } from "../src/replayCost";
import { TABLES_GARDEES, TABLES_VIDEES } from "../src/remiseAZero";
import { TOWER_SCHEMA } from "../src/tower";
import { UNITES_REJEU_TOWER } from "../src/towerRejeu";

// Lot K1 : la fiche d'un jeu (`config/jeux/<id>.json`, projection `serveur`) dit la même chose que le code du jeu qu'elle décrit. Ce test ne change rien au serveur (lot K2) : il garde la fiche honnête. Une fiche
// qui dérive du code — un seuil, une table, une colonne de tri, un thème — fait échouer ici, avant que la plateforme qui la lit ne présente autre chose que ce que le jeu fait.
const RACINE = resolve(__dirname, "..", "..", "..");
const serveur = (JSON.parse(readFileSync(join(RACINE, "config/jeux/projections/serveur.json"), "utf8")) as { jeux: Array<Record<string, any>> }).jeux;
const tower = serveur.find((j) => j.id === "tower")!;
const source = (chemin: string) => readFileSync(join(RACINE, chemin), "utf8");

describe("la fiche de Tower dit ce que fait le code", () => {
  it("son code est celui du registre du serveur, et son état de départ est `off` (absent des jeux publics)", () => {
    expect(GAMES.map((g) => g.code)).toContain(tower.code);
    expect(tower.etatDepart).toBe("off");
    expect(JEUX_PUBLICS).not.toContain("tower");
  });

  it("ses tables sont celles de la remise à zéro du lancement (vidée / gardée) et du schéma du jeu", () => {
    for (const t of tower.tables as { nom: string; sort: string }[]) {
      expect(Object.keys(t.sort === "videe" ? TABLES_VIDEES : TABLES_GARDEES), t.nom).toContain(t.nom);
      expect(TOWER_SCHEMA.join("\n"), t.nom).toContain(`CREATE TABLE IF NOT EXISTS ${t.nom}`);
    }
    // Aucune table `tower_*` du schéma n'échappe à la fiche.
    const duSchema = [...TOWER_SCHEMA.join("\n").matchAll(/CREATE TABLE IF NOT EXISTS (tower_\w+)/g)].map((m) => m[1]);
    expect(duSchema.sort()).toEqual((tower.tables as { nom: string }[]).map((t) => t.nom).sort());
  });

  it("son critère de classement est l'ordre de l'index du classement (colonne, sens)", () => {
    const index = /tower_results_by_rank ON tower_results \(day, hidden, ([^)]*)\)/.exec(TOWER_SCHEMA.join("\n"))![1]!;
    const attendu = (tower.classement.colonnes as { nom: string; sens: string }[]).map((c) => (c.sens === "desc" ? `${c.nom} DESC` : c.nom));
    expect(index.split(", ")).toEqual(attendu);
  });

  it("son premier jour, ses thèmes, ses scènes de musique, son rejeu et ses versions sont ceux du jeu", () => {
    expect(tower.premierJour).toBe(formatDay(PREMIER_JOUR_TOWER));
    const fiche = JSON.parse(source("config/jeux/tower.json")) as Record<string, any>;
    expect(fiche.themes).toEqual([...THEMES_TOWER]);
    expect(fiche.musique.scenes).toEqual(["menu", ...THEMES_TOWER.map((t) => `theme:${t}`)]);
    expect(tower.rejeu.unitesServeur).toBe(UNITES_REJEU_TOWER);
    expect(tower.rejeu.maxTicks).toBe(MAX_TICKS_REJEU);
    for (const v of Object.values(tower.versions) as string[]) {
      const [fichier, constante] = v.split(":") as [string, string];
      expect(source(fichier), v).toMatch(new RegExp(`export const ${constante}\\b`));
    }
  });

  it("sa destination du message en direct, sa zone de nouveautés et son dossier de jours existent", () => {
    expect(OU_MESSAGE).toContain(tower.messageOu);
    expect(ZONES_NOUVEAUTES).toContain(tower.zoneNouveautes);
    expect(existsSync(join(RACINE, tower.jours.dossier))).toBe(true);
    expect(tower.prefixe).toBe("tower:");
  });
});

// Lot K1b : la même garde pour Jump. Il n'y a pas de seconde copie de la liste de ses tables ni de son tri : la fiche est comparée au schéma réel et au code.
describe("la fiche de Jump dit ce que fait le code", () => {
  const jump = serveur.find((j) => j.id === "jump")!;
  const schema = SCHEMA.join("\n");

  it("son code est celui du registre ; il est public d'emblée (les jeux publics de la plateforme)", () => {
    expect(GAMES.map((g) => g.code)).toContain(jump.code);
    expect(jump.etatDepart).toBe("on");
    expect(JEUX_PUBLICS).toContain("jump");
  });

  it("ses tables sont celles du schéma `jump_*` : chacune vidée ou gardée comme la remise à zéro du lancement le dit, aucune n'échappe à la fiche", () => {
    for (const t of jump.tables as { nom: string; sort: string }[]) expect(Object.keys(t.sort === "videe" ? TABLES_VIDEES : TABLES_GARDEES), t.nom).toContain(t.nom);
    const duSchema = [...schema.matchAll(/CREATE TABLE IF NOT EXISTS (jump_\w+)/g)].map((m) => m[1]);
    expect(duSchema.sort()).toEqual((jump.tables as { nom: string }[]).map((t) => t.nom).sort());
  });

  it("son critère de classement est l'ordre de l'index du classement visible (colonne, sens)", () => {
    // L'index du classement visible est une migration (lot N1), dans `db.ts`.
    const index = /jump_results_by_visible ON jump_results \(day, hidden, ([^)]*)\)/.exec(source("apps/api/src/db.ts"))![1]!;
    expect(index.split(", ")).toEqual((jump.classement.colonnes as { nom: string; sens: string }[]).map((c) => (c.sens === "desc" ? `${c.nom} DESC` : c.nom)));
  });

  it("son premier jour, ses thèmes, ses scènes de musique, son coût de rejeu et ses versions sont ceux du jeu", () => {
    expect(jump.premierJour).toBe(formatDay(PREMIER_JOUR_JUMP));
    const fiche = JSON.parse(source("config/jeux/jump.json")) as Record<string, any>;
    expect(fiche.themes).toEqual([...JUMP_THEME_NAMES]);
    expect(fiche.musique.scenes).toEqual(["menu", ...JUMP_THEME_NAMES.map((t) => `theme:${t}`)]);
    expect(jump.rejeu).toMatchObject({ unitesServeur: 1, ticksParUnite: REPLAY_TICKS_PER_UNIT, maxTicks: MAX_ATTEMPT_TICKS });
    for (const v of Object.values(jump.versions) as string[]) {
      const [fichier, constante] = v.split(":") as [string, string];
      expect(source(fichier), v).toMatch(new RegExp(`export const ${constante}\\b`));
    }
  });

  it("sa destination du message, sa zone de nouveautés, son dossier de niveaux figés et son préfixe de stockage existent", () => {
    expect(OU_MESSAGE).toContain(jump.messageOu);
    expect(ZONES_NOUVEAUTES).toContain(jump.zoneNouveautes);
    expect(existsSync(join(RACINE, jump.jours.dossier))).toBe(true);
    expect(jump.prefixe).toBe("jump:");
  });
});

// Lot K1c : la même garde pour Track. Ses noms sont ceux d'avant la règle (`cdj`, `results`, `cdj:`) : la fiche les déclare, ce test vérifie qu'ils sont ceux du code.
describe("la fiche de Track dit ce que fait le code", () => {
  const track = serveur.find((j) => j.id === "track")!;
  const schema = SCHEMA.join("\n");

  it("son code est celui du registre (`cdj`) ; il est public d'emblée ; il est le premier du registre", () => {
    expect(GAMES.map((g) => g.code)[0]).toBe(track.code);
    expect(track.code).toBe("cdj");
    expect(track.etatDepart).toBe("on");
    expect(JEUX_PUBLICS).toContain("track");
  });

  it("ses tables sont toutes les tables de DailyTrack (le reste du schéma est à la plateforme, à Jump et à Tower), chacune vidée ou gardée comme la remise à zéro du lancement le dit", () => {
    for (const t of track.tables as { nom: string; sort: string }[]) expect(Object.keys(t.sort === "videe" ? TABLES_VIDEES : TABLES_GARDEES), t.nom).toContain(t.nom);
    const cdj = GAMES.find((g) => g.code === "cdj")!;
    const duJeu = [...cdj.schema.join("\n").matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map((m) => m[1]);
    expect(duJeu.sort()).toEqual((track.tables as { nom: string }[]).map((t) => t.nom).sort());
    expect(schema).toContain("CREATE TABLE IF NOT EXISTS results");
  });

  it("son critère de classement est l'ordre de l'index du classement visible (colonne, sens)", () => {
    const index = /results_by_visible ON results \(day, hidden, ([^)]*)\)/.exec(source("apps/api/src/db.ts"))![1]!;
    expect(index.split(", ")).toEqual((track.classement.colonnes as { nom: string; sens: string }[]).map((c) => (c.sens === "desc" ? `${c.nom} DESC` : c.nom)));
  });

  it("son premier jour, ses thèmes, ses scènes de musique, ses facteurs de médailles, son coût de rejeu et ses versions sont ceux du jeu", () => {
    expect(track.premierJour).toBe(formatDay(PREMIER_JOUR));
    const fiche = JSON.parse(source("config/jeux/track.json")) as Record<string, any>;
    expect(fiche.themes).toEqual([...THEME_NAMES]);
    expect(fiche.musique.scenes).toEqual(["menu", ...THEME_NAMES.map((t) => `theme:${t}`)]);
    expect(fiche.medailles.bareme).toEqual([MEDAL_FACTORS_G1.author, MEDAL_FACTORS_G1.gold, MEDAL_FACTORS_G1.silver, MEDAL_FACTORS_G1.bronze]);
    expect(track.rejeu).toMatchObject({ unitesServeur: 1, ticksParUnite: REPLAY_TICKS_PER_UNIT, maxTicks: MAX_REPLAY_TICKS });
    for (const v of Object.values(track.versions) as string[]) {
      const [fichier, constante] = v.split(":") as [string, string];
      expect(source(fichier), v).toMatch(new RegExp(`export const ${constante}\\b`));
    }
  });

  it("sa destination du message, sa zone de nouveautés, son registre de jours et son préfixe de stockage existent", () => {
    expect(OU_MESSAGE).toContain(track.messageOu);
    expect(ZONES_NOUVEAUTES).toContain(track.zoneNouveautes);
    expect(existsSync(join(RACINE, track.jours.registre))).toBe(true);
    expect(track.jours.mode).toBe("registre");
    expect(track.prefixe).toBe("cdj:");
  });
});
