import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Les accès de la sauvegarde (scripts/sauvegarde-acces.mjs), lancés avec un faux `gcloud` : chaque refus est nommé avec la commande qui le règle, et la
// valeur du secret n'apparaît jamais (ni dans la sortie, ni dans le résumé). Le 28/10/2026, le bouton ne disait que « PERMISSION_DENIED ».

const SCRIPT = join(__dirname, "../../../scripts/sauvegarde-acces.mjs");
const SECRET_VALEUR = "jeton-turso-tres-secret-0123456789";

/** Lance le script avec un faux `gcloud` : `refus` = la sous-commande qui échoue (`auth`, `secrets`, `storage`), ou rien. */
function lancer(refus?: "auth" | "secrets" | "storage" | "absent") {
  const dir = mkdtempSync(join(tmpdir(), "cdj-gcloud-"));
  const faux = join(dir, "gcloud");
  writeFileSync(
    faux,
    [
      "#!/bin/sh",
      `case "$1" in`,
      `  auth) ${refus === "auth" ? `echo "ERROR: (gcloud.auth.print-access-token) PERMISSION_DENIED: Permission 'iam.serviceAccounts.getAccessToken' denied on resource (or it may not exist)." >&2; exit 1` : "echo ya29.jeton-d-acces"} ;;`,
      `  secrets) ${refus === "secrets" ? `echo "ERROR: (gcloud.secrets.versions.access) PERMISSION_DENIED: Permission 'secretmanager.versions.access' denied" >&2; exit 1` : refus === "absent" ? `echo "ERROR: NOT_FOUND: Secret [x] not found or has no versions." >&2; exit 1` : `printf '${SECRET_VALEUR}'`} ;;`,
      `  storage) ${refus === "storage" ? `echo "ERROR: 403 does not have storage.objects.list access" >&2; exit 1` : "echo gs://b/production/"} ;;`,
      "esac",
      "",
    ].join("\n"),
  );
  chmodSync(faux, 0o755);
  const resume = join(dir, "resume.md");
  const r = spawnSync(process.execPath, [SCRIPT, "--projet", "p", "--sa", "cdj-sauvegarde@p.iam.gserviceaccount.com", "--secret", "cdj-turso-lecture", "--bucket", "p-sauvegardes", "--resume", resume], {
    encoding: "utf8",
    env: { PATH: `${dir}:${process.env.PATH ?? ""}`, WIF_PROVIDER: "projects/123/locations/global/workloadIdentityPools/github/providers/github-repo" },
  });
  return { code: r.status, sortie: `${r.stdout}${r.stderr}`, resume: readFileSync(resume, "utf8") };
}

describe("les accès de la sauvegarde (diagnostic)", () => {
  it("tout est en place : vert, et la valeur du secret n'est jamais affichée", () => {
    const r = lancer();
    expect(r.code).toBe(0);
    expect(r.resume).toContain("Tous les accès de la sauvegarde sont en place");
    expect(r.sortie + r.resume).not.toContain(SECRET_VALEUR);
    expect(r.sortie + r.resume).not.toContain("ya29.");
  });

  it("la fédération refuse le compte : rouge, le refus et la liaison workloadIdentityUser à lancer (sans le numéro du projet)", () => {
    const r = lancer("auth");
    expect(r.code).toBe(1);
    expect(r.resume).toContain("La fédération ne prend pas le compte");
    expect(r.resume).toContain("iam.serviceAccounts.getAccessToken");
    expect(r.resume).toContain("roles/iam.workloadIdentityUser");
    expect(r.resume).toContain("workloadIdentityPools/github/subject/repo:Nathan-Te@61011485/DailyTrack@1407318739:environment:sauvegarde");
    expect(r.resume).not.toContain("projects/123/");
  });

  it("le secret est refusé, ou absent : rouge, et la commande qui le règle", () => {
    const refus = lancer("secrets");
    expect(refus.code).toBe(1);
    expect(refus.resume).toContain("roles/secretmanager.secretAccessor");
    const absent = lancer("absent");
    expect(absent.code).toBe(1);
    expect(absent.resume).toContain("gcloud secrets create cdj-turso-lecture");
  });

  it("le bucket est refusé : rouge, et les deux rôles du bucket", () => {
    const r = lancer("storage");
    expect(r.code).toBe(1);
    expect(r.resume).toContain("roles/storage.$r");
    expect(r.resume).not.toContain(SECRET_VALEUR);
  });
});
