import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { formatDay, parseDay } from "@cdj/core";

// Lot R8 : le lancement public. La date (une seule source), le workflow « Lancement : remise à zéro » (ses gardes, simulés sans secrets : l'étape « Gardes »
// est extraite du fichier et lancée par bash), et la liste de contrôle de Nathan.

const ROOT = join(__dirname, "../../..");
const DIR = join(ROOT, ".github/workflows");
const FICHIER = "lancement-remise-a-zero.yml";
const yml = (name: string) => readFileSync(join(DIR, name), "utf8");

/** Le script `run: |` de l'étape « Gardes (avant tout) ». */
function gardes(): string {
  const lines = yml(FICHIER).split("\n");
  const i = lines.findIndex((l) => l.trim() === "- name: Gardes (avant tout)");
  const run = lines.findIndex((l, k) => k > i && /^\s+run: \|\s*$/.test(l));
  const indent = lines[run + 1]!.match(/^\s*/)![0].length;
  const body: string[] = [];
  for (let k = run + 1; k < lines.length; k++) {
    if (lines[k]!.trim() && lines[k]!.match(/^\s*/)![0].length < indent) break;
    body.push(lines[k]!.slice(indent));
  }
  return body.join("\n");
}

const BON = {
  CIBLE: "recette",
  BASE_SAISIE: "dailytrack-recette",
  PHRASE: "tout le monde repart de zéro",
  SAUVEGARDE: "false",
  REF: "refs/heads/une-branche",
  GCP_PROJECT_ID: "projet",
  PROD_DB: "libsql://dailytrack-misterzcool-nathan.turso.io",
  RECETTE_DB: "libsql://dailytrack-recette-nathan.turso.io",
  WIF_PROVIDER: "x",
  WIF_SERVICE_ACCOUNT: "y",
  HAS_SA_KEY: "false",
};

function lancer(env: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), "wf-lancement-"));
  const sortie = join(dir, "output");
  const resume = join(dir, "summary");
  writeFileSync(sortie, "");
  writeFileSync(resume, "");
  writeFileSync(join(dir, "step.sh"), gardes());
  let code = 0;
  let stdout = "";
  try {
    stdout = execFileSync("bash", ["-e", join(dir, "step.sh")], { cwd: ROOT, env: { PATH: process.env.PATH!, GITHUB_OUTPUT: sortie, GITHUB_STEP_SUMMARY: resume, ...BON, ...env }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    const err = e as { status: number; stdout: string };
    code = err.status;
    stdout = err.stdout;
  }
  return { code, stdout, output: readFileSync(sortie, "utf8"), summary: readFileSync(resume, "utf8") };
}

describe("la date du lancement", () => {
  it("config/lancement.json : une seule clé, une date valide (la source unique : sa valeur n'est écrite dans aucun test)", () => {
    const json = JSON.parse(readFileSync(join(ROOT, "config/lancement.json"), "utf8")) as Record<string, unknown>;
    expect(Object.keys(json)).toEqual(["premierJour"]);
    expect(String(json.premierJour)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(formatDay(parseDay(String(json.premierJour))!)).toBe(json.premierJour); // une date du calendrier, pas « 2026-02-30 »
  });

  it("le serveur la reçoit dans l'image et dans les chemins qui déclenchent la recette", () => {
    expect(readFileSync(join(ROOT, "apps/api/Dockerfile"), "utf8")).toContain("COPY config config");
    expect(yml("recette.yml")).toContain('"config/**"');
  });

  it("la production ne reçoit jamais la date de la recette : ni variable du serveur, ni variable de construction", () => {
    const api = yml("deploy-api.yml");
    expect(api).toContain("RECETTE_PREMIER_JOUR");
    // La variable n'est posée que dans la branche « recette » du déploiement (le déploiement de production a sa liste de variables, sans elle).
    const production = api.slice(api.indexOf("Déployer sur Cloud Run (production)"), api.indexOf("Déployer sur Cloud Run (recette)"));
    expect(production).not.toContain("LANCEMENT_PREMIER_JOUR");
    expect(yml("deploy-site.yml")).toMatch(/VITE_LANCEMENT_PREMIER_JOUR: \$\{\{ inputs\.cible == 'recette' && vars\.RECETTE_PREMIER_JOUR \|\| '' \}\}/);
  });
});

describe("workflow « Lancement : remise à zéro »", () => {
  const texte = yml(FICHIER);

  it("ne se lance qu'à la main (workflow_dispatch) : ni cron, ni push, ni pull_request, ni appel d'un autre workflow", () => {
    const on = texte.split(/\njobs:\n/)[0]!.split(/\non:\n/)[1]!;
    expect(on.trim().split("\n")[0]).toBe("workflow_dispatch:");
    for (const interdit of ["schedule:", "push:", "pull_request:", "workflow_call:", "workflow_run:"]) expect(on).not.toContain(interdit);
    // Aucun autre workflow ne le lance, ni ne lance le script.
    for (const f of readdirSync(DIR).filter((n) => n !== FICHIER)) {
      expect(yml(f), f).not.toContain("lancement:remise-a-zero");
      expect(yml(f), f).not.toContain("lancement-remise-a-zero");
    }
  });

  it("deux confirmations saisies, la sauvegarde, la production seulement depuis main avec la validation de Nathan, rien en artefact", () => {
    for (const entree of ["cible:", "base:", "phrase:", "sauvegarde_faite:", "essai_a_blanc:"]) expect(texte).toContain(`      ${entree}`);
    expect(texte).toContain("tout le monde repart de zéro");
    expect(texte).toContain("environment: ${{ inputs.cible == 'production' && 'production' || 'recette' }}");
    expect(texte).toContain('"$REF" != "refs/heads/main"');
    expect(texte).toContain("--lancement-url https://playdujour.com");
    expect(texte).not.toMatch(/upload-artifact|actions\/cache|download-artifact/);
    // Le jeton de la base : Secret Manager, masqué, jamais écrit ni passé en argument.
    expect(texte).toContain("::add-mask::$token");
    expect(texte).toContain('TURSO_AUTH_TOKEN="$token"');
    expect(texte).not.toMatch(/echo(?![^\n]*add-mask)[^\n]*\$token|--token/);
    // Les saisies passent par l'environnement, jamais dans le texte du script (pas d'injection).
    const scripts = texte.split("\n").filter((l) => /^\s+run:|^\s{10,}\S/.test(l)).join("\n");
    expect(scripts).not.toMatch(/\$\{\{\s*inputs\./);
  });

  it("vérifie la base vide sur le service lui-même, après avoir laissé aux instances le temps de voir la nouvelle génération", () => {
    expect(texte).toContain("--lecture-seule --vide");
    expect(texte).toMatch(/sleep 40/);
    expect(texte).toContain("gcloud run services describe");
  });

  describe("l'étape « Gardes » (bash, sans secrets)", () => {
    it("recette, tout en ordre : accepté, le service et le jeton sont ceux de la recette", () => {
      const r = lancer({});
      expect(r.code, r.summary).toBe(0);
      expect(r.output).toContain("dbname=dailytrack-recette");
      expect(r.output).toContain("secret=cdj-recette-turso-token");
      expect(r.output).toContain("service=cdj-api-recette");
    });

    it("refuse la mauvaise phrase, le mauvais nom de base, une cible inconnue", () => {
      expect(lancer({ PHRASE: "tout le monde repart de zero" }).code).not.toBe(0);
      expect(lancer({ PHRASE: "" }).code).not.toBe(0);
      const autre = lancer({ BASE_SAISIE: "dailytrack-misterzcool" });
      expect(autre.code).not.toBe(0);
      expect(autre.summary).toContain("REFUSÉE");
      expect(lancer({ BASE_SAISIE: "" }).code).not.toBe(0);
      expect(lancer({ CIBLE: "local" }).code).not.toBe(0);
    });

    it("accepte le nom de la base en majuscules ou avec des espaces autour, avec ou sans l'organisation de l'adresse ; pas un préfixe qui coupe un mot", () => {
      expect(lancer({ BASE_SAISIE: " DailyTrack-Recette " }).code).toBe(0);
      expect(lancer({ BASE_SAISIE: "dailytrack-recette-nathan" }).code).toBe(0);
      expect(lancer({ BASE_SAISIE: "dailytrack-rec" }).code).not.toBe(0);
      expect(lancer({ BASE_SAISIE: "daily" }).code).not.toBe(0);
    });

    it("production : la sauvegarde confirmée et main sont exigées ; le nom de la base de production, jamais celui de la recette", () => {
      const prod = { CIBLE: "production", BASE_SAISIE: "dailytrack-misterzcool", REF: "refs/heads/main", SAUVEGARDE: "true" };
      const bon = lancer(prod);
      expect(bon.code, bon.summary).toBe(0);
      expect(bon.output).toContain("secret=cdj-turso-token");
      expect(bon.output).toContain("service=cdj-api");
      expect(lancer({ ...prod, SAUVEGARDE: "false" }).summary).toContain("sauvegarde");
      expect(lancer({ ...prod, SAUVEGARDE: "false" }).code).not.toBe(0);
      expect(lancer({ ...prod, REF: "refs/heads/claude/autre" }).code).not.toBe(0);
      expect(lancer({ ...prod, BASE_SAISIE: "dailytrack-recette" }).code).not.toBe(0);
    });

    it("refuse une base mal branchée : la recette sur une base sans « recette », la production sur une base de recette, les deux sur la même", () => {
      expect(lancer({ RECETTE_DB: "libsql://dailytrack-misterzcool-nathan.turso.io", BASE_SAISIE: "dailytrack-misterzcool" }).code).not.toBe(0);
      expect(lancer({ CIBLE: "production", REF: "refs/heads/main", SAUVEGARDE: "true", PROD_DB: "libsql://dailytrack-recette-nathan.turso.io", BASE_SAISIE: "dailytrack-recette" }).code).not.toBe(0);
      expect(lancer({ PROD_DB: BON.RECETTE_DB }).code).not.toBe(0);
    });

    it("sans configuration : refuse (rien n'est vidé), et le dit", () => {
      const sans = lancer({ GCP_PROJECT_ID: "" });
      expect(sans.code).not.toBe(0);
      expect(sans.summary).toContain("rien n'a été vidé");
      expect(lancer({ WIF_PROVIDER: "", WIF_SERVICE_ACCOUNT: "" }).code).not.toBe(0);
    });
  });
});
