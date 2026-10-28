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

  it("trois modes : la production, l'essai (tout contre la recette) et la répétition seule (heure simulée, jamais interpolée dans un script)", () => {
    expect(prod).toMatch(/mode:\n(?:.*\n)*?\s+options: \[production, essai, repetition\]/);
    expect(prod).toContain("heure_simulee:");
    // Lot R12 : la répétition sur la recette est faite à chaque mise en production (à l'heure réelle), et seule elle touche la recette.
    expect(job("recette-serveur")).toContain("target: recette");
    expect(job("recette-site")).toContain("cible: recette");
    expect(job("serveur")).toContain("target: production");
    expect(job("site")).toContain("cible: production");
    // Seule la production déploie et étiquette ; jamais un essai ni une répétition.
    for (const j of ["serveur", "etiquette"]) expect(job(j), j).toContain("inputs.mode == 'production'");
    // Les jours figés ne sont versés dans main que par la production, ou par un essai lancé sur main.
    expect(job("depot")).toContain("inputs.mode == 'essai' && github.ref == 'refs/heads/main'");
    // Le jour de bascule se re-vérifie au déploiement de la production seulement (la recette n'a pas de jour à protéger).
    expect(job("serveur")).toContain("bascule_le: ${{ needs.verifier.outputs.bascule_le }}");
    expect(job("recette-serveur")).not.toContain("bascule_le");
    expect(job("recette-verification")).toContain("smoke -w @cdj/api -- \"${url%/}\" --origin \"$origine\""); // le smoke complet, recette seulement
    expect(job("verification")).not.toMatch(/smoke -w @cdj\/api -- "\$\{url%\/\}" --origin/);
  });

  it("avant tout déploiement : jours servis, jours figés jusqu'à la veille de la bascule, empreintes comparées, ancien code sur la base migrée ; puis répétition et sauvegarde", () => {
    const figer = job("figer");
    const ordre = ["jours-servis", "freeze:days -w @cdj/jump -- \"$VEILLE\"", "mise-en-production.mjs empreintes prod", "mise-en-production.mjs empreintes cible", "mise-en-production.mjs comparer", "base-migree.mjs cible prod"].map((x) => figer.indexOf(x));
    expect(ordre.every((i) => i > 0), JSON.stringify(ordre)).toBe(true);
    expect([...ordre].sort((a, b) => a - b)).toEqual(ordre);
    expect(figer).not.toContain("freeze:days -w @cdj/jump -- demain");
    expect(figer).toContain("exit 1"); // la comparaison arrête le run
    expect(job("recette-serveur")).toContain("needs: [verifier, figer]");
    expect(job("serveur")).toContain("needs: [verifier, figer, sauvegarde]");
    expect(job("verifier")).toContain("mise-en-production.mjs bascule \"${args[@]}\" --sortie \"$GITHUB_OUTPUT\"");
    expect(job("verifier")).toContain("mise-en-production.mjs inventaire");
  });

  // 28/10/2026 : la répétition lançait le smoke complet depuis le dernier main, sans les jours figés ni le registre que « figer » venait de calculer.
  // Le smoke recalcule le circuit et le niveau du jour : il refaisait un jour figé avec le nouveau générateur, et tout envoi était refusé (21 vérifications).
  it("tout smoke complet tourne sur ce que le serveur visé a reçu : le commit déployé, ses jours figés et son registre, appliqués avant le smoke", () => {
    const complets = (texte: string) => texte.split("\n").filter((l) => /npm run smoke -w @cdj\/api -- /.test(l) && !l.includes("--lecture-seule"));
    const avec = ["jours-figes", "registre-track"];
    // Les jobs, coupés à chaque nom de job (tirets compris) : `job()` ne coupe qu'aux noms sans tiret.
    const debuts = [...prod.matchAll(/\n {2}([a-z-]+):\n/g)].map((m) => ({ nom: m[1]!, i: m.index! }));
    const blocs = new Map(debuts.map((d, k) => [d.nom, prod.slice(d.i, debuts[k + 1]?.i)]));
    const concernes = [...blocs.keys()].filter((n) => complets(blocs.get(n)!).length > 0);
    expect(concernes).toEqual(["recette-verification"]);
    for (const nom of concernes) {
      const j = blocs.get(nom)!;
      expect(j, nom).toContain("ref: ${{ needs.verifier.outputs.sha }}");
      const smoke = j.indexOf(complets(j)[0]!);
      for (const a of avec) expect(j.indexOf(`name: ${a}`), `${nom} : artefact ${a}`).toBeGreaterThan(0);
      const figes = j.indexOf("mise-en-production.mjs jours-figes");
      const registre = j.indexOf("mise-en-production.mjs registre-fusion");
      expect(figes, `${nom} : jours figés appliqués avant le smoke`).toBeGreaterThan(0);
      expect(registre, `${nom} : registre appliqué avant le smoke`).toBeGreaterThan(0);
      expect(Math.max(figes, registre)).toBeLessThan(smoke);
    }
    // Le serveur de la recette (deploy-api.yml) : ses artefacts entrent dans l'image avant son propre smoke complet.
    const deploy = yml("deploy-api.yml");
    const smokeDeploy = deploy.indexOf(complets(deploy)[0]!);
    expect(deploy.indexOf("mise-en-production.mjs jours-figes")).toBeLessThan(smokeDeploy);
    expect(deploy.indexOf("mise-en-production.mjs registre-fusion")).toBeLessThan(smokeDeploy);
    // La vérification de la production lit aussi le commit déployé (et non le dernier main).
    expect(blocs.get("verification")).toContain("ref: ${{ needs.verifier.outputs.sha }}");
    // La PR « Jours figés » refait la démonstration de Jump quand des niveaux s'y ajoutent (elle rejoue les jours figés : sinon sa CI échoue), et la verse.
    const depot = blocs.get("depot")!;
    expect(depot.indexOf("npm run jump:seed -w @cdj/api")).toBeGreaterThan(depot.indexOf("mise-en-production.mjs jours-figes"));
    expect(depot).toContain("git add apps/jump/public/levels apps/jump/public/demo");
  });

  it("lot R12 : la sauvegarde lit la base en lecture seule par un compte et un environnement à elle, et ne laisse ni artefact ni journal", () => {
    const s = job("sauvegarde");
    expect(s).toContain("environment: sauvegarde");
    expect(s).toContain("service_account: ${{ steps.cfg.outputs.sa }}");
    expect(s).toContain("cdj-turso-lecture");
    expect(s).toContain("::add-mask::$token");
    expect(s).toContain("npm run -s base:sauvegarde");
    expect(s).toContain("gcloud storage cp");
    expect(s).not.toMatch(/upload-artifact|cdj-turso-token\b|GCP_SERVICE_ACCOUNT|GCP_SA_KEY/);
  });

  it("lot R12 : plus de validation à attendre, mais la production n'est lancée que par le propriétaire du dépôt, sur main", () => {
    const v = job("verifier");
    expect(v).toContain("ACTEUR: ${{ github.triggering_actor }}");
    expect(v).toContain('[ "$MODE" != essai ] && [ "$GITHUB_REF" != refs/heads/main ]');
    // L'environnement `production` (limité à main, S-07) reste celui du déploiement du serveur.
    expect(yml("deploy-api.yml")).toContain("name: ${{ inputs.target == 'production' && 'production' || 'recette' }}");
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
