import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Lot R4 : les workflows, simulés sans secrets. Les étapes « Configuration présente ? » (et leurs garde-fous) sont extraites des fichiers et
// lancées par bash avec un environnement vide : rien ne casse tant que Firebase n'est pas configuré, le message est clair, et les garde-fous
// (un aperçu ne vise jamais la production) refusent. Plus la forme des déclencheurs : plus aucun déploiement automatique de production.

const DIR = join(__dirname, "../../../.github/workflows");
const yml = (name: string) => readFileSync(join(DIR, name), "utf8");

/** Le script `run: |` de l'étape nommée `name` (première trouvée après `after`, s'il est donné). */
function stepScript(file: string, name: string, after?: string): string {
  const lines = yml(file).split("\n");
  let i = after ? lines.findIndex((l) => l.includes(after)) : 0;
  i = lines.findIndex((l, k) => k >= i && l.trim() === `- name: ${name}`);
  if (i < 0) throw new Error(`${file} : étape « ${name} » introuvable`);
  const run = lines.findIndex((l, k) => k > i && /^\s+run: \|\s*$/.test(l));
  const indent = lines[run + 1]!.match(/^\s*/)![0].length;
  const body: string[] = [];
  for (let k = run + 1; k < lines.length; k++) {
    const l = lines[k]!;
    if (l.trim() && l.match(/^\s*/)![0].length < indent) break;
    body.push(l.slice(indent));
  }
  return body.join("\n");
}

/** Lance un script d'étape comme GitHub Actions (bash -e), avec `env` seulement ; rend le code, la sortie, $GITHUB_OUTPUT et le résumé. */
function runStep(script: string, env: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), "wf-"));
  const out = join(dir, "output");
  const summary = join(dir, "summary");
  writeFileSync(out, "");
  writeFileSync(summary, "");
  writeFileSync(join(dir, "step.sh"), script);
  let code = 0;
  let stdout = "";
  try {
    stdout = execFileSync("bash", ["-e", join(dir, "step.sh")], {
      cwd: join(__dirname, "../../.."),
      env: { PATH: process.env.PATH!, GITHUB_OUTPUT: out, GITHUB_STEP_SUMMARY: summary, ...env },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (e) {
    const err = e as { status: number; stdout: string };
    code = err.status;
    stdout = err.stdout;
  }
  return { code, stdout, output: readFileSync(out, "utf8"), summary: readFileSync(summary, "utf8") };
}

describe("sans Firebase configuré, rien ne casse : sauté avec un message clair", () => {
  it("deploy-site : production, recette, canal d'aperçu", () => {
    const script = stepScript("deploy-site.yml", "Configuration présente ?");
    for (const env of [{ CIBLE: "production", API: "/" }, { CIBLE: "recette", API: "/" }, { CIBLE: "recette", CANAL: "pr-12", API: "/" }]) {
      const r = runStep(script, env);
      expect(r.code, JSON.stringify(env)).toBe(0);
      expect(r.output).toContain("enabled=false");
      expect(r.stdout).toContain("Firebase non configuré : voir docs/plateforme/domaine.md");
      expect(r.summary).toContain("FIREBASE_SITE_");
    }
  });

  it("recette.yml (canal), apercu.yml (suppression du canal) : sautés, verts", () => {
    for (const [file, after] of [["recette.yml", "  canal:"], ["apercu.yml", "  cleanup:"]] as const) {
      const r = runStep(stepScript(file, "Configuration présente ?", after), {});
      expect(r.code, file).toBe(0);
      expect(r.output, file).toContain("enabled=false");
      expect(r.summary, file).toContain("Firebase non configuré");
    }
  });

  it("deploy-api (serveur) et retour-arriere : sautés, verts", () => {
    const api = runStep(stepScript("deploy-api.yml", "Configuration présente ?"), { TARGET: "production" });
    expect(api.code).toBe(0);
    expect(api.output).toContain("enabled=false");
    const rec = runStep(stepScript("deploy-api.yml", "Configuration présente ?"), { TARGET: "recette" });
    expect(rec.stdout).toContain("recette non configurée");
    const back = runStep(stepScript("retour-arriere.yml", "Configuration présente ?"), {});
    expect(back.code).toBe(0);
    expect(back.output).toContain("enabled=false");
  });
});

describe("garde-fous, avant toute configuration", () => {
  const script = () => stepScript("deploy-site.yml", "Configuration présente ?");
  it("jamais de canal d'aperçu sur le site de production ; la production appelle /api/ sur sa propre origine", () => {
    expect(runStep(script(), { CIBLE: "production", CANAL: "pr-1", API: "/" }).code).toBe(1);
    expect(runStep(script(), { CIBLE: "production", API: "https://cdj-api-recette-x-ew.a.run.app" }).code).toBe(1);
  });

  it("un aperçu ne vise jamais le serveur de production (adresse du service, d'une révision, ou playdujour.com)", () => {
    const prod = "https://cdj-api-5qi6aa4qqa-ew.a.run.app";
    for (const API of [prod, "https://b-x-123456---cdj-api-5qi6aa4qqa-ew.a.run.app", "https://playdujour.com"]) {
      const r = runStep(script(), { CIBLE: "recette", CANAL: "pr-3", API, PROD_API_URL: prod });
      expect(r.code, API).toBe(1);
      expect(r.stdout, API).toContain("Aperçu branché sur la production");
    }
    expect(runStep(script(), { CIBLE: "recette", CANAL: "pr-3", API: "https://b-x-123456---cdj-api-recette-x-ew.a.run.app", PROD_API_URL: prod }).code).toBe(0);
    expect(runStep(script(), { CIBLE: "recette", API: "https://recette.playdujour.com", PROD_API_URL: prod }).code).toBe(0);
  });

  it("le site de recette n'est jamais celui de la production", () => {
    const r = runStep(script(), { CIBLE: "recette", API: "/", GCP_PROJECT_ID: "p", SITE_RECETTE: "s", SITE_PRODUCTION: "s", HAS_SA_KEY: "true" });
    expect(r.code).toBe(1);
  });

  it("configuré : le site et le service de la cible", () => {
    const base = { API: "/", GCP_PROJECT_ID: "p", SITE_RECETTE: "playdujour-recette", SITE_PRODUCTION: "playdujour-prod", HAS_SA_KEY: "true", PROD_SERVICE: "cdj-api", RECETTE_SERVICE: "cdj-api-recette" };
    expect(runStep(script(), { ...base, CIBLE: "production" }).output).toBe("enabled=true\nsite=playdujour-prod\nservice=cdj-api\n");
    expect(runStep(script(), { ...base, CIBLE: "recette", CANAL: "pr-4" }).output).toBe("enabled=true\nsite=playdujour-recette\nservice=cdj-api-recette\n");
  });
});

describe("déclencheurs", () => {
  const on = (file: string) => yml(file).split(/\njobs:\n/)[0]!.split(/\non:\n/)[1]!;
  it("la production ne part que par le bouton (workflow_dispatch), avec la validation de Nathan (environnement production)", () => {
    expect(on("production.yml").trim().split("\n")[0]).toBe("workflow_dispatch:");
    expect(on("production.yml")).not.toMatch(/push:|pull_request|schedule|workflow_call/);
    expect(yml("production.yml")).toMatch(/serveur:\n(?:.*\n)*?\s+uses: \.\/\.github\/workflows\/deploy-api\.yml/);
    expect(yml("deploy-api.yml")).toContain("name: ${{ inputs.target == 'production' && 'production' || 'recette' }}");
    expect(yml("retour-arriere.yml")).toMatch(/retour:\n(?:.*\n)*?\s+environment: production/);
    // Aucun autre workflow ne déploie la production.
    for (const f of ["recette.yml", "apercu.yml", "ci.yml"]) expect(yml(f), f).not.toMatch(/target: production|cible: production/);
  });

  it("chaque fusion dans main met à jour la recette (serveur, joueurs fictifs, site)", () => {
    expect(on("recette.yml")).toMatch(/push:\n\s+branches: \[main\]/);
    expect(yml("recette.yml")).toMatch(/site:\n(?:.*\n)*?\s+uses: \.\/\.github\/workflows\/deploy-site\.yml\n\s+with:\n\s+cible: recette/);
  });

  it("lot I3 : après la fusion, la recette vérifie par l'adresse de Hosting que le cache respecte Vary: X-Player-Id (lecture seule, joueur de démonstration)", () => {
    const y = yml("recette.yml");
    const job = y.slice(y.indexOf("\n  hosting:"), y.indexOf("\n  apercu:"));
    expect(job).toContain("needs: [plan, deploy, seed, site]");
    expect(job).toContain("needs.plan.outputs.action == 'default'"); // la fusion dans main : la révision d'une PR n'a pas le trafic
    expect(job).toContain("needs.site.outputs.url"); // l'adresse de Firebase Hosting, jamais Cloud Run en direct
    expect(job).toMatch(/--lecture-seule --environnement recette --par-hosting \$demo/);
    expect(job).toContain("--joueur-demo");
    expect(job).not.toMatch(/target: production|cdj-api\b[^-]|run\.app/);
  });

  it("un aperçu par PR ; plus aucune publication sur GitHub Pages (lot R5) : ni workflow, ni bascule, ni redirections", () => {
    expect(on("apercu.yml")).toMatch(/pull_request:\n\s+types: \[opened, synchronize, reopened, closed\]/);
    expect(existsSync(join(DIR, "pages.yml"))).toBe(false);
    for (const f of readdirSync(DIR).filter((n) => n.endsWith(".yml"))) {
      expect(yml(f), f).not.toMatch(/gh-pages|pages\.yml|site\.mjs redirections|actions\/deploy-pages|bascule:/);
    }
  });

  it("les appels de workflows réutilisables transmettent les secrets", () => {
    for (const f of ["recette.yml", "apercu.yml", "production.yml"]) {
      const text = yml(f);
      const calls = [...text.matchAll(/uses: \.\/\.github\/workflows\/(deploy-api|deploy-site|recette-seed)\.yml\n((?:\s{4,}.*\n)*)/g)];
      expect(calls.length, f).toBeGreaterThan(0);
      for (const c of calls) expect(c[2], `${f} → ${c[1]}`).toContain("secrets: inherit");
    }
  });
});

// Lot R6 : le garde-fou des jours dans « Mettre en production » et sa répétition.
describe("le garde-fou des jours (lot R6)", () => {
  const prod = yml("production.yml");
  const job = (nom: string) => {
    const debut = prod.indexOf(`\n  ${nom}:\n`);
    const suite = prod.slice(debut + 1).search(/\n  [a-z]+:\n/);
    return prod.slice(debut, suite < 0 ? undefined : debut + 1 + suite);
  };

  it("deux modes : la production, et la répétition contre la recette avec une heure simulée (jamais interpolée dans un script)", () => {
    expect(prod).toMatch(/mode:\n(?:.*\n)*?\s+options: \[production, repetition\]/);
    expect(prod).toContain("heure_simulee:");
    expect(job("serveur")).toContain("target: ${{ inputs.mode == 'repetition' && 'recette' || 'production' }}");
    expect(job("site")).toContain("cible: ${{ inputs.mode == 'repetition' && 'recette' || 'production' }}");
    // Rien ne s'étiquette ni ne se fusionne en répétition.
    expect(job("etiquette")).toContain("inputs.mode != 'repetition'");
    expect(job("depot")).toContain("inputs.mode != 'repetition'");
    // La répétition ne passe jamais par la validation de la production : le jour de bascule se re-vérifie en production seulement.
    expect(job("serveur")).toContain("bascule_le: ${{ inputs.mode != 'repetition' && needs.verifier.outputs.bascule_le || '' }}");
    expect(job("verification")).toContain("smoke -w @cdj/api -- \"${url%/}\" --origin \"$(node scripts/domaine.mjs adresse recette)\""); // le smoke complet, recette seulement
  });

  it("avant tout déploiement : jours servis, jours figés jusqu'à la veille de la bascule, empreintes comparées, ancien code sur la base migrée", () => {
    const figer = job("figer");
    const ordre = ["jours-servis", "freeze:days -w @cdj/jump -- \"$VEILLE\"", "mise-en-production.mjs empreintes prod", "mise-en-production.mjs empreintes cible", "mise-en-production.mjs comparer", "base-migree.mjs cible prod"].map((x) => figer.indexOf(x));
    expect(ordre.every((i) => i > 0), JSON.stringify(ordre)).toBe(true);
    expect([...ordre].sort((a, b) => a - b)).toEqual(ordre);
    expect(figer).not.toContain("freeze:days -w @cdj/jump -- demain");
    expect(figer).toContain("exit 1"); // la comparaison arrête le run
    expect(job("serveur")).toContain("needs: [verifier, figer]");
    expect(job("verifier")).toContain("mise-en-production.mjs bascule \"${args[@]}\" --sortie \"$GITHUB_OUTPUT\"");
    expect(job("verifier")).toContain("mise-en-production.mjs inventaire");
  });

  it("la validation de Nathan a pu durer : le serveur et le site re-vérifient que le jour de bascule n'a pas commencé", () => {
    for (const f of ["deploy-api.yml", "deploy-site.yml"]) {
      expect(yml(f), f).toContain("mise-en-production.mjs bascule-valide \"$BASCULE\"");
      expect(yml(f), f).toContain("inputs.bascule_le != ''");
    }
  });

  it("le retour arrière est refusé après le début du jour de bascule (sauf demande explicite) ; l'étiquette note le jour de bascule", () => {
    expect(prod).toContain('echo "basculement: $BASCULE"');
    const retour = yml("retour-arriere.yml");
    expect(retour).toContain("apres_le_jour_j:");
    expect(retour).toContain("s/^basculement: *//p");
    expect(retour).toContain("mise-en-production.mjs bascule-valide \"$bascule\"");
  });
});
