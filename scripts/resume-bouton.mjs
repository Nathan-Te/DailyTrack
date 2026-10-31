// Lot R12 (plateforme) — le résumé de « Mettre en production », en haut du run, lisible au téléphone : ✅ ou ⛔, la CI (relancée ou reprise, son lien et
// sa durée), ce qui part, le jour de bascule, les jours conservés et régénérés par jeu, la sauvegarde, les liens ; en cas d'arrêt, UNE phrase qui dit quoi
// faire ; puis chaque étape avec son résultat et sa durée. Job `resume` de .github/workflows/production.yml :
//   NEEDS='${{ toJSON(needs) }}' MODE=production|essai|repetition GITHUB_TOKEN=… node scripts/resume-bouton.mjs [--resume <fichier>]
// Décision pure (`resumeDuBouton`) testée dans apps/portail/test/bouton.test.ts. Sans jeton, pas de durées (le reste ne change pas).

import { appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ADRESSES } from "./domaine.mjs";
import { api, jeton } from "./github-api.mjs";

/** Les étapes du bouton, dans l'ordre : la clé de `needs` (et le préfixe des jobs appelés, « ci / … »), le titre, les modes qui la font. */
export const ETAPES = [
  { cle: "verifier", titre: "0. Départ : commit, jour de bascule, ce qui part", modes: ["production", "essai", "repetition"] },
  { cle: "ci", titre: "1. CI complète", modes: ["production", "essai"] },
  { cle: "ci-verdict", titre: "2. Verdict de la CI complète", modes: ["production", "essai"] },
  { cle: "figer", titre: "3. Garde-fou des jours (jours figés, empreintes, ancien code sur la base migrée)", modes: ["production", "essai", "repetition"] },
  { cle: "recette-serveur", titre: "4a. Répétition : serveur de recette", modes: ["production", "essai", "repetition"] },
  { cle: "recette-site", titre: "4b. Répétition : site de recette", modes: ["production", "essai", "repetition"] },
  { cle: "recette-verification", titre: "4c. Répétition : smoke de la recette", modes: ["production", "essai", "repetition"] },
  { cle: "sauvegarde", titre: "5. Sauvegarde de la base", modes: ["production", "essai"] },
  { cle: "serveur", titre: "7a. Serveur de production", modes: ["production"] },
  { cle: "site", titre: "7b. Site playdujour.com", modes: ["production"] },
  { cle: "verification", titre: "7c. Vérification en lecture seule", modes: ["production"] },
  { cle: "etiquette", titre: "7d. Étiquette prod-…", modes: ["production"] },
  { cle: "depot", titre: "8. Jours figés versés dans main", modes: ["production", "essai"] },
];

const SYMBOLE = { success: "✅", failure: "❌", cancelled: "⏹️", skipped: "⏭️" };
const ETAPES_MAIN = ["sauvegarde", "depot"];

/** La phrase à suivre quand le bouton s'arrête à l'étape `cle`. */
export function phraseArret(cle, { needs, runUrl, origine }) {
  const o = (k) => needs[k]?.outputs ?? {};
  switch (cle) {
    case "verifier":
      return "Le départ est refusé (l'erreur est dans le job « verifier ») : relance le bouton sur `main` (et par toi : la production n'accepte que le propriétaire du dépôt).";
    case "ci":
    case "ci-verdict":
      return `Lance le lot de mise en production avec ce run : ${o("ci-verdict").url || runUrl}`;
    case "figer":
      return "Un jour protégé changerait, ou la production n'a pas pu être lue (détail dans le job « figer ») : ne corrige rien à la main ; si playdujour.com répondait mal, relance le bouton, sinon demande un lot.";
    case "recette-serveur":
    case "recette-site":
    case "recette-verification":
      return "La répétition sur la recette a échoué : rien n'est parti en production. Lance le lot de mise en production avec ce run : " + runUrl;
    case "sauvegarde":
      return "La sauvegarde a échoué, rien n'est parti en production : fais l'annexe C de docs/plateforme/mise-en-production.md (une fois), puis relance le bouton.";
    case "serveur":
    case "site":
      return `Le déploiement a échoué : ouvre ${origine}/ ; s'il répond mal, Actions › « Retour arrière » › Run workflow ; sinon relance le bouton.`;
    case "verification":
      return "La production répond mal : Actions › « Retour arrière » › Run workflow (sur main).";
    case "etiquette":
      return "La production est en ligne mais l'étiquette prod-… manque : « Re-run failed jobs » sur ce run.";
    case "depot":
      return `La production est en ligne ; les jours figés ne sont pas encore dans main : fusionne ${o("depot").pr || "la PR « Jours figés »"} quand sa CI est verte (réglage pour que le workflow le fasse seul : README du lot R12, « Jours figés sans PR »).`;
    default:
      return "Le run a été annulé : relance le bouton.";
  }
}

/** Le résumé, en Markdown. `jobs` : les jobs du run (durées) ; `ref` : la branche du run (un essai hors de main ne fait ni sauvegarde ni dépôt). */
export function resumeDuBouton({ mode, needs, jobs = [], runUrl, ref = "refs/heads/main", origine }) {
  const etapes = ETAPES.filter((e) => e.modes.includes(mode) && (ref === "refs/heads/main" || !ETAPES_MAIN.includes(e.cle)));
  const res = (cle) => needs[cle]?.result ?? "skipped";
  const o = (cle) => needs[cle]?.outputs ?? {};
  const v = o("verifier");
  const reprise = v.ci_reprise === "true";
  // L'arrêt : la première étape en échec ou annulée ; la CI elle-même (`ci`) n'est jugée que par son verdict.
  const arret = etapes.find((e) => e.cle !== "ci" && ["failure", "cancelled"].includes(res(e.cle)));
  const sautees = etapes.filter((e) => !(e.cle === "ci" && reprise) && res(e.cle) === "skipped");
  const ok = !arret && sautees.length === 0;
  const sha = v.sha ? `\`${v.sha.slice(0, 7)}\`` : "";
  const titre = { production: ["Mise en production faite", "Mise en production arrêtée"], essai: ["Essai réussi (recette)", "Essai arrêté (recette)"], repetition: ["Répétition réussie (recette)", "Répétition arrêtée (recette)"] }[mode];
  const l = [`## ${ok ? "✅" : "⛔"} ${titre[ok ? 0 : 1]} ${sha}`.trim(), ""];
  if (!ok) l.push(`**À faire : ${arret ? phraseArret(arret.cle, { needs, runUrl, origine }) : phraseArret(sautees[0]?.cle === "ci-verdict" ? "ci-verdict" : "annule", { needs, runUrl, origine })}**`, "");
  if (mode !== "repetition") {
    const c = o("ci-verdict");
    const etat = c.etat === "vert" ? (reprise ? "reprise" : "relancée par le bouton") : c.etat === "rouge" ? "rouge" : "pas jugée";
    l.push(`- **CI complète** : ${etat}${c.url ? ` — [run](${c.url})` : ""}${c.duree ? ` — ${c.duree} min` : ""}`);
  } else l.push("- **CI complète** : pas en répétition");
  l.push(`- **Ce qui part** : ${v.nb_pr ?? "?"} PR${v.prs ? ` (${v.prs})` : ""} — le détail (« Ce qui part ») est dans le job « verifier »`);
  if (v.bascule_le) l.push(`- **Jour de bascule** : ${v.bascule_le} (les jours protégés d'avant restent ceux de la production)`);
  const f = o("figer");
  if (f.jours_track || f.jours_jump) l.push(`- **Jours** : Track ${f.jours_track ?? "?"} · Jump ${f.jours_jump ?? "?"}${f.jours_tower ? ` · Tower ${f.jours_tower}` : ""}`);
  // Lot TP : les jours de Tower préparés (conservés, préparés, refaits) et jusqu'où ils sont couverts.
  if (f.tower_ligne) l.push(`- **Jours de Tower** : ${f.tower_ligne}`);
  if (mode !== "repetition") {
    const s = o("sauvegarde").fichier;
    l.push(`- **Sauvegarde** : ${res("sauvegarde") === "success" && s ? `\`${s}\` (30 jours ; restauration : annexe C de docs/plateforme/mise-en-production.md)` : ref !== "refs/heads/main" ? "aucune (essai hors de main)" : "non faite"}`);
    const d = o("depot");
    const dep = { fusionnee: `versés dans main (${d.pr})`, rien: "déjà dans main", auto: `en attente de la protection de main (${d.pr})`, refusee: `refusés par la protection de main (${d.pr})`, "ci-rouge": `CI rouge (${d.pr})` }[d.etat];
    if (ref === "refs/heads/main") l.push(`- **Jours figés** : ${dep ?? "non versés"}`);
  }
  l.push(`- **Liens** : [portail](${origine}/) · [Track](${origine}/track/) · [Jump](${origine}/jump/)`, "");
  // Les étapes et leurs durées (jobs du run : un job appelé s'appelle « clé / … »).
  const duree = (cle) => {
    const js = jobs.filter((j) => j.name === cle || j.name.startsWith(`${cle} / `));
    const debut = Math.min(...js.filter((j) => j.started_at).map((j) => Date.parse(j.started_at)));
    const fin = Math.max(...js.filter((j) => j.completed_at).map((j) => Date.parse(j.completed_at)));
    return Number.isFinite(debut) && Number.isFinite(fin) && fin >= debut ? `${Math.max(1, Math.round((fin - debut) / 60_000))} min` : "—";
  };
  l.push("| étape | résultat | durée |", "|---|---|---|");
  for (const e of etapes) {
    const r = e.cle === "ci" && reprise ? "reprise" : res(e.cle);
    l.push(`| ${e.titre} | ${SYMBOLE[r] ?? "↩️"} ${r} | ${duree(e.cle)} |`);
  }
  return l.join("\n") + "\n";
}

async function main(argv) {
  const opt = (name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
  const mode = process.env.MODE || "production";
  const needs = JSON.parse(process.env.NEEDS || "{}");
  const repo = process.env.GITHUB_REPOSITORY;
  const runUrl = `${process.env.GITHUB_SERVER_URL || "https://github.com"}/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}`;
  let jobs = [];
  if (jeton() && repo) {
    try {
      jobs = (await api(`/repos/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}/jobs?filter=latest&per_page=100`, jeton())).jobs;
    } catch (e) {
      console.log(`durées illisibles : ${e.message}`);
    }
  }
  const texte = resumeDuBouton({ mode, needs, jobs, runUrl, ref: process.env.GITHUB_REF, origine: ADRESSES[mode === "production" ? "production" : "recette"] });
  if (opt("--resume")) appendFileSync(opt("--resume"), texte);
  process.stdout.write(texte);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main(process.argv.slice(2));
