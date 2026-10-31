import { describe, expect, it } from "vitest";
import { SERVER_PATHS } from "../../../scripts/recette.mjs";
import { CATEGORIES, RULES, categoriesOf, scopeOf, toOutputs } from "../../../scripts/ci-scope.mjs";

// Lot R2 (plateforme) : portée d'une PR pour la CI. Un fichier propre à un jeu ne lance que les e2e de ce jeu ; une zone partagée ou un doute
// lance tout ; le serveur touché (SERVER_PATHS) lance l'image de l'API.
const ALL = [...CATEGORIES].sort();
const cats = (p: string) => categoriesOf(p).sort();

describe("catégorie d'un fichier", () => {
  it("DailyTrack seul", () => {
    for (const p of ["apps/web/src/main.ts", "apps/web/e2e/salon.spec.ts", "apps/web/CLAUDE.md", "packages/sim/src/car.ts", "packages/sim/CLAUDE.md", "docs/lots/lot-31-futur-finale.md", "docs/orchestration.md", "docs/seed.md", "docs/guide-technique.md"])
      expect(cats(p), p).toEqual(["track"]);
  });

  it("DailyJump seul", () => {
    for (const p of ["apps/jump/src/main.ts", "apps/jump/e2e/smoke.spec.ts", "apps/jump/CLAUDE.md", "packages/jump-sim/src/level.ts", "packages/jump-sim/modules/solutions.json", "docs/jump/synthese.md", "docs/jump/lots/lot-13-foret.md"])
      expect(cats(p), p).toEqual(["jump"]);
  });

  it("plateforme seule : la documentation de la plateforme", () => {
    for (const p of ["docs/plateforme/recette.md", "docs/plateforme/lots/lot-R2-hygiene.md", "docs/mise-en-ligne.md", "docs/securite-facturation.md"]) expect(cats(p), p).toEqual(["plateforme"]);
  });

  it("les niveaux figés de DailyJump (lus par le serveur) : DailyJump et plateforme", () => {
    expect(cats("apps/jump/public/levels/2026-10-16.json")).toEqual(["jump", "plateforme"]);
  });

  it("zone partagée = les trois catégories à la fois", () => {
    const shared = [
      "apps/api/src/api.ts", "apps/api/Dockerfile", "apps/api/CLAUDE.md", "packages/core/src/index.ts", "packages/clock/src/index.ts", "packages/profile/src/index.ts",
      ".github/workflows/ci.yml", ".github/workflows/pages.yml", ".github/workflows/recette.yml", "scripts/e2e-parts.mjs", "scripts/ci-scope.mjs",
      "package.json", "package-lock.json", "tsconfig.base.json", "tsconfig.json", "vitest.config.ts", "CLAUDE.md",
    ];
    for (const p of shared) expect(cats(p), p).toEqual(ALL);
  });

  it("lot R3 — serveur de DailyJump (jump*.ts, leurs tests, leurs scripts) : DailyJump et plateforme", () => {
    for (const p of ["apps/api/src/jump.ts", "apps/api/src/jumpHistory.ts", "apps/api/src/jumpLives.ts", "apps/api/test/jump.test.ts", "apps/api/test/jumpBundle.test.ts", "apps/api/test/jumpLives.test.ts", "apps/api/scripts/jump-seed.ts", "apps/api/scripts/measure-jump.ts"])
      expect(cats(p), p).toEqual(["jump", "plateforme"]);
  });

  it("lot R3 — serveur de DailyTrack (cdj.ts, Salon, leurs tests, ses outils) : DailyTrack et plateforme", () => {
    for (const p of ["apps/api/src/cdj.ts", "apps/api/src/salon.ts", "apps/api/test/salon.test.ts", "apps/api/test/planning.test.ts", "apps/api/scripts/measure-salon.ts", "apps/api/scripts/measure-generator.ts", "apps/api/scripts/measure-budget.ts", "apps/api/scripts/history-seed.ts", "apps/api/src/garage.ts", "apps/api/test/garage.test.ts"])
      expect(cats(p), p).toEqual(["plateforme", "track"]);
  });

  it("lot R3 — cœur de la plateforme (registre, identité, configuration, serveur, base, Dockerfile) et tout le reste d'apps/api : les trois", () => {
    const core = [
      "apps/api/src/registry.ts", "apps/api/src/identity.ts", "apps/api/src/config.ts", "apps/api/src/server.ts", "apps/api/src/node-server.ts", "apps/api/src/api.ts",
      "apps/api/src/db.ts", "apps/api/src/games.ts", "apps/api/src/platform.ts", "apps/api/src/players.ts", "apps/api/src/history.ts", "apps/api/Dockerfile",
      "apps/api/package.json", "apps/api/CLAUDE.md", "apps/api/test/api.test.ts", "apps/api/test/helpers.ts", "apps/api/scripts/smoke.ts", "apps/api/src/nouveau.ts",
    ];
    for (const p of core) expect(cats(p), p).toEqual(ALL);
  });

  it("lot R3 — un faux ami de nom dans apps/api n'est pas reconnu comme propre à un jeu", () => {
    for (const p of ["apps/api/src/sub/jump.ts", "apps/api/jump.ts", "apps/api/src/cdj.ts.bak", "apps/api/test/jump.ts", "apps/api/scripts/jump-seed.mjs"]) expect(cats(p), p).toEqual(ALL);
  });

  it("le doute compte pour les trois : fichier inconnu, racine, chemin étrange", () => {
    for (const p of ["docs/credits.md", "README.md", "nouveau-dossier/x.ts", "apps/nouveau/src/x.ts", "packages/autre/x.ts", ".gitignore", "", "../apps/web/x.ts", "apps/web/../api/x.ts"])
      expect(cats(p), JSON.stringify(p)).toEqual(ALL);
  });

  it("un nom qui ressemble à une zone sans en être une n'est pas reconnu", () => {
    for (const p of ["apps/webhook/x.ts", "apps/jumper/x.ts", "packages/sim-extra/x.ts", "packages/jump-sim2/x.ts", "docs/jumpy/x.md"]) expect(cats(p), p).toEqual(ALL);
  });

  it("normalise ./ et les séparateurs Windows", () => {
    expect(cats("./apps/jump/src/main.ts")).toEqual(["jump"]);
    expect(cats("apps\\web\\src\\main.ts")).toEqual(["track"]);
  });

  it("chaque fichier a au moins une catégorie, toutes valides", () => {
    for (const p of ["a", "apps/web/x", "apps/jump/public/levels/x.json", "docs/lots/x"]) {
      const c = categoriesOf(p);
      expect(c.length).toBeGreaterThan(0);
      for (const x of c) expect(CATEGORIES).toContain(x);
    }
  });

  it("toute zone partagée de SERVER_PATHS est classée par une règle sans la réduire à un seul jeu, sauf les dossiers propres à un jeu", () => {
    // apps/api, core, clock, profile, package.json… : les trois. packages/sim et jump-sim sont propres à un jeu MAIS touchent le serveur (voir `server`).
    for (const p of ["apps/api/x.ts", "packages/core/x.ts", "packages/clock/x.ts", "packages/profile/x.ts", "package.json", "package-lock.json", "tsconfig.base.json"]) expect(cats(p), p).toEqual(ALL);
    expect(RULES.every((r) => r.cats.length > 0)).toBe(true);
    expect(SERVER_PATHS.length).toBeGreaterThan(0);
  });
});

describe("portée d'une PR", () => {
  it("DailyJump seul : e2e de DailyJump seulement, pas ceux de DailyTrack", () => {
    const s = scopeOf(["apps/jump/src/main.ts", "apps/jump/test/figes.test.ts", "docs/jump/synthese.md"]);
    expect(s).toMatchObject({ track: false, jump: true, plateforme: false, full: false, server: false });
  });

  it("lot R15 — Tower seul : ses e2e seulement, pas ceux de DailyTrack ni de DailyJump, ni l'image du serveur ; une zone partagée le lance aussi", () => {
    const s = scopeOf(["apps/tower/src/jeu.ts", "docs/tower/consignes.md"]);
    expect(s).toMatchObject({ track: false, jump: false, tower: true, plateforme: false, full: false, server: false });
    // Lot TP : la simulation de Tower (et ses jours préparés) entrent dans l'image du serveur, qui rejoue les parties : une PR qui y touche reconstruit l'image.
    expect(scopeOf(["packages/tower-sim/src/partie.ts"])).toMatchObject({ track: false, jump: false, tower: true, plateforme: false, server: true });
    expect(cats("apps/api/src/tower.ts")).toEqual(["plateforme", "tower"]);
    expect(cats("apps/api/test/towerBoard.test.ts")).toEqual(["plateforme", "tower"]);
    expect(scopeOf(["apps/web/src/hud.ts"])).toMatchObject({ tower: false });
    expect(scopeOf(["apps/jump/src/hud.ts"])).toMatchObject({ tower: false });
    expect(scopeOf(["packages/ui/src/socle.css"])).toMatchObject({ track: true, jump: true, tower: true });
    expect(scopeOf([], {})).toMatchObject({ tower: true });
  });

  it("DailyTrack seul : e2e de DailyTrack seulement", () => {
    expect(scopeOf(["apps/web/src/hud.ts"])).toMatchObject({ track: true, jump: false, server: false });
  });

  it("deux jeux : les deux suites", () => {
    expect(scopeOf(["apps/web/src/hud.ts", "packages/jump-sim/src/level.ts"])).toMatchObject({ track: true, jump: true });
  });

  it("le moteur d'un jeu touche le serveur (il rejoue les courses) : image de l'API", () => {
    expect(scopeOf(["packages/jump-sim/src/level.ts"])).toMatchObject({ track: false, jump: true, server: true });
    expect(scopeOf(["packages/sim/src/car.ts"])).toMatchObject({ track: true, jump: false, server: true });
  });

  it("lot I1 : le socle de l'interface lance tout ; le portail lance la suite DailyTrack (ses e2e), sans l'image du serveur", () => {
    expect(scopeOf(["packages/ui/src/composants.ts"])).toMatchObject({ track: true, jump: true, plateforme: true });
    expect(scopeOf(["apps/portail/src/portail.ts", "apps/portail/index.html"])).toMatchObject({ track: true, jump: false, plateforme: true, server: false });
  });

  it("une zone partagée lance tout", () => {
    for (const f of ["apps/api/src/api.ts", "packages/core/src/index.ts", ".github/workflows/ci.yml", "package-lock.json", "CLAUDE.md"])
      expect(scopeOf([f, "apps/jump/src/main.ts"]), f).toMatchObject({ track: true, jump: true, plateforme: true, server: expect.anything() });
  });

  it("une zone partagée hors SERVER_PATHS (workflow de CI, script) touche aussi l'image de l'API : on teste ce qu'on change", () => {
    expect(scopeOf([".github/workflows/ci.yml"])).toMatchObject({ server: true });
    expect(scopeOf(["scripts/ci-scope.mjs"])).toMatchObject({ server: true });
    expect(scopeOf(["docs/credits.md"])).toMatchObject({ server: true });
  });

  it("lot R3 — une PR du serveur de DailyJump : e2e de DailyJump et image de l'API, pas les e2e de DailyTrack", () => {
    expect(scopeOf(["apps/api/src/jumpLives.ts", "apps/api/test/jumpLives.test.ts", "apps/jump/src/main.ts"])).toMatchObject({ track: false, jump: true, plateforme: true, server: true });
  });

  it("lot R3 — une PR du serveur de DailyTrack : e2e de DailyTrack et image de l'API, pas les e2e de DailyJump", () => {
    expect(scopeOf(["apps/api/src/salon.ts", "apps/api/test/salon.test.ts"])).toMatchObject({ track: true, jump: false, plateforme: true, server: true });
  });

  it("lot R3 — un fichier du cœur dans la même PR qu'un fichier de DailyJump : tout", () => {
    expect(scopeOf(["apps/api/src/jump.ts", "apps/api/src/registry.ts"])).toMatchObject({ track: true, jump: true, plateforme: true, server: true });
  });

  it("documentation de la plateforme seule : aucune suite de jeu, pas d'image", () => {
    expect(scopeOf(["docs/plateforme/recette.md"])).toMatchObject({ track: false, jump: false, plateforme: true, server: false });
  });

  it("le doute lance tout : liste vide, fichier inconnu", () => {
    expect(scopeOf([])).toMatchObject({ full: true, track: true, jump: true, plateforme: true, server: true });
    expect(scopeOf(["", "  "])).toMatchObject({ full: true });
    expect(scopeOf(["apps/jump/src/main.ts", "truc-inconnu.bin"])).toMatchObject({ track: true, jump: true, plateforme: true });
  });

  it("`full` (nuit, lancement manuel, main) lance tout, même pour un petit changement", () => {
    expect(scopeOf(["apps/jump/src/main.ts"], { full: true })).toMatchObject({ full: true, track: true, jump: true, plateforme: true, server: true });
  });

  it("les sorties pour GitHub Actions sont des lignes clé=valeur", () => {
    const out = toOutputs(scopeOf(["apps/jump/src/main.ts"]));
    expect(out).toContain("jump=true\n");
    expect(out).toContain("track=false\n");
    expect(out).toContain("server=false\n");
  });
});
