import { describe, expect, it } from "vitest";
import { ETAPES, resumeDuBouton } from "../../../scripts/resume-bouton.mjs";

// Lot R12 : le résumé de « Mettre en production », en haut du run — ✅ ou ⛔, la CI, ce qui part, le jour de bascule, les jours, la sauvegarde, les liens ;
// en cas d'arrêt, UNE phrase qui dit quoi faire.
const SHA = "0123456789abcdef0123456789abcdef01234567";
const RUN = "https://github.com/x/y/actions/runs/7";
const OK = (outputs: Record<string, string> = {}) => ({ result: "success", outputs });
const verifier = OK({ sha: SHA, nb_pr: "2", prs: "#160 #161", bascule_le: "2026-10-28", ci_reprise: "false" });
const tout = (mode: string) =>
  Object.fromEntries(
    ETAPES.filter((e) => e.modes.includes(mode)).map((e) => [
      e.cle,
      e.cle === "verifier"
        ? verifier
        : e.cle === "ci-verdict"
          ? OK({ etat: "vert", url: "https://github.com/x/y/actions/runs/7", duree: "13", qui: "relancée" })
          : e.cle === "figer"
            ? OK({ jours_track: "2 conservés, 14 régénérés (3 changent)", jours_jump: "2 conservés, 14 régénérés (14 changent)" })
            : e.cle === "sauvegarde"
              ? OK({ fichier: "gs://p-sauvegardes/production/2026-10-27-1012-dailytrack-run7.sql.gz" })
              : e.cle === "depot"
                ? OK({ etat: "fusionnee", pr: "https://github.com/x/y/pull/170" })
                : OK(),
    ]),
  );

describe("le résumé du bouton (lot R12)", () => {
  it("production réussie : ✅, CI relancée avec lien et durée, PR, bascule, jours, sauvegarde, jours figés versés, liens de playdujour.com", () => {
    const t = resumeDuBouton({ mode: "production", needs: tout("production"), runUrl: RUN, origine: "https://playdujour.com" });
    const tete = t.split("\n|")[0]!;
    expect(t.split("\n")[0]).toBe("## ✅ Mise en production faite `0123456`");
    expect(tete).not.toContain("À faire");
    for (const x of ["relancée par le bouton — [run](https://github.com/x/y/actions/runs/7) — 13 min", "2 PR (#160 #161)", "2026-10-28", "Track 2 conservés", "gs://p-sauvegardes/production/", "versés dans main (https://github.com/x/y/pull/170)", "[Jump](https://playdujour.com/jump/)"]) expect(tete, x).toContain(x);
  });

  it("CI reprise : dite « reprise », l'étape `ci` sautée n'est pas un arrêt", () => {
    const n = tout("production");
    n.verifier = OK({ ...verifier.outputs, ci_reprise: "true" });
    n.ci = { result: "skipped", outputs: {} };
    const t = resumeDuBouton({ mode: "production", needs: n, runUrl: RUN, origine: "https://playdujour.com" });
    expect(t.startsWith("## ✅")).toBe(true);
    expect(t).toContain("**CI complète** : reprise");
    expect(t).toMatch(/\| 1\. CI complète \| ↩️ reprise \|/);
  });

  it("CI rouge : ⛔ avant tout, et la phrase « Lance le lot de mise en production avec ce run : <lien> »", () => {
    const n: Record<string, { result: string; outputs?: Record<string, string> }> = { verifier, ci: { result: "failure" }, "ci-verdict": { result: "failure", outputs: { etat: "rouge", url: "https://github.com/x/y/actions/runs/7" } } };
    for (const cle of ["figer", "recette-serveur", "recette-site", "recette-verification", "sauvegarde", "serveur", "site", "verification", "etiquette", "depot"]) n[cle] = { result: "skipped" };
    const t = resumeDuBouton({ mode: "essai", needs: n, runUrl: RUN, ref: "refs/heads/essai/ci-rouge", origine: "https://recette.playdujour.com" });
    expect(t.split("\n")[0]).toBe("## ⛔ Essai arrêté (recette) `0123456`");
    expect(t).toContain("**À faire : Lance le lot de mise en production avec ce run : https://github.com/x/y/actions/runs/7**");
    // hors de main : ni sauvegarde ni dépôt attendus
    expect(t).toContain("aucune (essai hors de main)");
    expect(t).not.toContain("8. Jours figés");
  });

  it("chaque arrêt a sa phrase : garde-fou, répétition, sauvegarde, vérification, jours figés", () => {
    const cas: [string, RegExp][] = [
      ["figer", /Un jour protégé changerait/],
      ["recette-verification", /répétition sur la recette a échoué : rien n'est parti en production/],
      ["sauvegarde", /annexe C de docs\/plateforme\/mise-en-production\.md/],
      ["verification", /Retour arrière/],
      ["depot", /fusionne https:\/\/github\.com\/x\/y\/pull\/170/],
    ];
    for (const [cle, phrase] of cas) {
      const n = tout("production");
      n[cle] = { result: "failure", outputs: n[cle]?.outputs };
      const t = resumeDuBouton({ mode: "production", needs: n, runUrl: RUN, origine: "https://playdujour.com" });
      expect(t.startsWith("## ⛔"), cle).toBe(true);
      expect(t, cle).toMatch(phrase);
    }
  });

  it("répétition : ni CI, ni sauvegarde, ni main ; les liens de la recette", () => {
    const t = resumeDuBouton({ mode: "repetition", needs: tout("repetition"), runUrl: RUN, origine: "https://recette.playdujour.com" });
    expect(t.split("\n")[0]).toBe("## ✅ Répétition réussie (recette) `0123456`");
    expect(t).not.toMatch(/Sauvegarde|Jours figés/);
    expect(t).toContain("[portail](https://recette.playdujour.com/)");
  });
});
