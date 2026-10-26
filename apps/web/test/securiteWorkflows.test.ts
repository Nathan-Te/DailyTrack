import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ECRITURES_PERMISES, auditerDossier, auditerWorkflow, scriptsRun } from "../../../scripts/securite-workflows.mjs";

// Lot R7 (audit de sécurité) : les règles de sécurité des workflows GitHub (permissions minimales, actions épinglées, pas de `pull_request_target`,
// pas d'entrée non fiable dans un `run:`). `node scripts/securite-workflows.mjs` les applique à `.github/workflows/` ; ce test, en CI, les tient.
const SHA = "11d5960a326750d5838078e36cf38b85af677262";
const ok = (corps: string, tete = "on: push\npermissions:\n  contents: read\n") => `name: x\n${tete}jobs:\n  a:\n    runs-on: ubuntu-latest\n${corps}`;

describe("les workflows du dépôt respectent les règles de l'audit", () => {
  const { fichiers, problemes } = auditerDossier(join(__dirname, "..", "..", "..", ".github", "workflows"));

  it("il y a des workflows à vérifier", () => {
    expect(fichiers.length).toBeGreaterThanOrEqual(9);
  });

  it("aucun écart", () => {
    expect(problemes).toEqual([]);
  });

  it("seuls les workflows qui déploient ou commentent ont un droit d'écriture prévu", () => {
    for (const f of ["ci.yml", "stabilite.yml"]) expect(ECRITURES_PERMISES[f], f).toBeUndefined();
  });
});

describe("la vérification elle-même (elle refuse ce qu'elle doit refuser)", () => {
  it("un workflow sans permissions au niveau du workflow", () => {
    expect(auditerWorkflow("x.yml", ok("    steps: []\n", "on: push\n")).join("\n")).toContain("pas de bloc `permissions:`");
    expect(auditerWorkflow("x.yml", ok("    steps: []\n", "on: push\npermissions: write-all\n")).join("\n")).toContain("write-all");
  });

  it("pull_request_target", () => {
    expect(auditerWorkflow("x.yml", ok("    steps: []\n", "on:\n  pull_request_target:\npermissions:\n  contents: read\n")).join("\n")).toContain("pull_request_target");
  });

  it("une action par étiquette, ou sans commentaire de version, est refusée ; épinglée avec version, acceptée ; locale, acceptée", () => {
    const step = (u: string) => ok(`    steps:\n      - uses: ${u}\n`);
    expect(auditerWorkflow("x.yml", step("actions/checkout@v4")).join()).toContain("non épinglée");
    expect(auditerWorkflow("x.yml", step("actions/checkout@main")).join()).toContain("non épinglée");
    expect(auditerWorkflow("x.yml", step(`actions/checkout@${SHA}`)).join()).toContain("sans commentaire de version");
    expect(auditerWorkflow("x.yml", step(`actions/checkout@${SHA} # v4.4.0`))).toEqual([]);
    expect(auditerWorkflow("x.yml", step("./.github/workflows/deploy-site.yml"))).toEqual([]);
    expect(auditerWorkflow("x.yml", step(`google-github-actions/auth@${SHA.slice(0, 39)} # v3`)).join()).toContain("non épinglée");
  });

  it("un droit d'écriture imprévu pour ce workflow", () => {
    const corps = "    permissions:\n      contents: write\n    steps: []\n";
    expect(auditerWorkflow("ci.yml", ok(corps)).join()).toContain("contents: write");
    expect(auditerWorkflow("retour-arriere.yml", ok(corps))).toEqual([]);
  });

  it("une donnée contrôlée par un tiers dans un script `run:` (inline ou en bloc) ; par `env:` c'est permis", () => {
    const mauvais1 = ok("    steps:\n      - run: echo ${{ github.head_ref }}\n");
    const mauvais2 = ok("    steps:\n      - name: a\n        run: |\n          echo ok\n          echo \"${{ github.event.pull_request.title }}\"\n");
    const mauvais3 = ok("    steps:\n      - run: |\n          echo ${{ inputs.commit }}\n");
    const bon = ok("    steps:\n      - name: a\n        env:\n          BRANCHE: ${{ github.head_ref }}\n        run: |\n          echo \"$BRANCHE\"\n");
    for (const m of [mauvais1, mauvais2, mauvais3]) expect(auditerWorkflow("x.yml", m).join(), m).toContain("interpolé dans un `run:`");
    expect(auditerWorkflow("x.yml", bon)).toEqual([]);
    // une comparaison à des constantes ne transporte rien d'un tiers ; une valeur seule ou avec repli, si
    expect(auditerWorkflow("x.yml", ok("    steps:\n      - run: echo ${{ inputs.cible == 'production' && '--production' || '' }}\n"))).toEqual([]);
    expect(auditerWorkflow("x.yml", ok("    steps:\n      - run: echo ${{ inputs.ref || github.sha }}\n")).join()).toContain("inputs.");
  });

  it("scriptsRun lit les blocs et les lignes simples", () => {
    const s = scriptsRun("steps:\n  - run: a\n  - name: b\n    run: |\n      b1\n      b2\n  - uses: c\n");
    expect(s.map((x) => x.texte.trim())).toEqual(["a", "b1\n      b2"]);
  });
});
