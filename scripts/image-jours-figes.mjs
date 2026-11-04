// Lot K4f — le contrôle de l'image du serveur (job `api-image` de `ci.yml`) : **les jours figés de chaque jeu, selon sa fiche** (`config/jeux/projections/ci.json` : `jours.dossier`). Avant : le contrôle de
// Jump, dans le YAML, au format des niveaux de Jump. Maintenant, pour chaque jeu qui a un dossier de jours figés :
//   - `GET /api/<jeu>/info` liste exactement les fichiers du dossier (`frozenDays`) ;
//   - un jeu témoin est absent d'un serveur de production (404) : c'est ce qu'on vérifie contre une image en production ;
//   - un jour figé À VENIR n'est pas encore servi (404) ; un jour passé ou présent l'est (200) ;
//   - les fichiers au format des niveaux figés de Jump (`id`, `hash`, `auteur`) sont rendus tels quels par `GET /api/<jeu>/day/<date>` (`source: "fige"`, même identifiant, même empreinte, même temps de l'auteur).
// Hors production, les jeux fermés (`off`) s'ouvrent comme un aperçu de PR (l'hôte d'un canal d'aperçu), comme le fait `smoke`.
//
//   node scripts/image-jours-figes.mjs <adresse du serveur> [--environnement production|recette|local] [--racine <dépôt>]
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE_DEPOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATE = /^(\d{4}-\d{2}-\d{2})\.json$/;

/** Les fichiers de jours figés d'un dossier (date → contenu), triés. */
export function joursDuDossier(dossier) {
  if (!existsSync(dossier)) return [];
  return readdirSync(dossier)
    .map((f) => DATE.exec(f)?.[1])
    .filter(Boolean)
    .sort()
    .map((date) => ({ date, contenu: JSON.parse(readFileSync(join(dossier, `${date}.json`), "utf8")) }));
}

/**
 * Contrôle un jeu. `appel(chemin)` rend `{ status, body }` (le serveur, vu du jeu : l'aperçu est déjà géré par l'appelant). Rend la liste des écarts (vide : tout est bon) et une phrase de rapport.
 */
export async function controlerJeu({ jeu, jours, appel, environnement }) {
  const ecarts = [];
  const info = await appel(`/api/${jeu.id}/info`);
  if (info.status === 404) {
    if (jeu.temoin && environnement === "production") return { ecarts, rapport: `${jeu.id} : jeu témoin, absent du serveur de production (404) comme attendu` };
    if (info.body?.error === "game_unavailable") return { ecarts, rapport: `${jeu.id} : fermé (\`off\`), ses jours ne sont pas contrôlables ici` };
    return { ecarts: [`${jeu.id} : /info répond 404 (${String(info.body?.error)})`], rapport: "" };
  }
  if (info.status !== 200) return { ecarts: [`${jeu.id} : /info répond ${info.status}`], rapport: "" };
  if (jeu.temoin && environnement === "production") ecarts.push(`${jeu.id} : un jeu témoin répond sur un serveur de production`);
  const attendus = jours.map((j) => j.date);
  const listes = JSON.stringify(info.body.frozenDays ?? []);
  if (listes !== JSON.stringify(attendus)) ecarts.push(`${jeu.id} : jours figés de /info ${listes}, attendus ${JSON.stringify(attendus)}`);
  const aujourdhui = info.body.today;
  for (const { date, contenu } of jours) {
    const r = await appel(`/api/${jeu.id}/day/${date}`);
    if (date > aujourdhui) {
      if (r.status !== 404) ecarts.push(`${jeu.id} ${date} : jour à venir servi (${r.status})`);
      continue;
    }
    if (r.status !== 200) {
      ecarts.push(`${jeu.id} ${date} : jour figé non servi (${r.status})`);
      continue;
    }
    // Le format des niveaux figés de Jump : la réponse reprend l'identifiant, l'empreinte et le temps de l'auteur du fichier.
    if (typeof contenu.id === "string" && typeof contenu.hash === "string" && typeof contenu.auteur === "number" && !(r.body.source === "fige" && r.body.id === contenu.id && r.body.hash === contenu.hash && r.body.authorTicks === contenu.auteur))
      ecarts.push(`${jeu.id} ${date} : réponse différente du fichier figé`);
  }
  return { ecarts, rapport: `${jeu.id} : ${attendus.length} jour(s) figé(s) contrôlé(s)` };
}

export function jeuxAControler(racine = RACINE_DEPOT) {
  const ci = JSON.parse(readFileSync(join(racine, "config/jeux/projections/ci.json"), "utf8"));
  return ci.jeux.filter((j) => j.jours.dossier).map((j) => ({ jeu: j, jours: joursDuDossier(join(racine, j.jours.dossier)) }));
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const base = args.find((a) => /^https?:\/\//.test(a));
  const option = (nom) => (args.includes(nom) ? args[args.indexOf(nom) + 1] : undefined);
  const environnement = option("--environnement") ?? "local";
  const racine = option("--racine") ?? RACINE_DEPOT;
  if (!base) {
    console.error("usage : node scripts/image-jours-figes.mjs <adresse> [--environnement production|recette|local]");
    process.exit(2);
  }
  const entetes = environnement === "production" ? {} : { "X-Forwarded-Host": "recette--pr-1-abcdef0.web.app" };
  const appel = async (chemin) => {
    const res = await fetch(base + chemin, { headers: entetes });
    const texte = await res.text();
    let body = null;
    try {
      body = JSON.parse(texte);
    } catch {
      /* pas du JSON */
    }
    return { status: res.status, body };
  };
  let ko = 0;
  for (const { jeu, jours } of jeuxAControler(racine)) {
    const { ecarts, rapport } = await controlerJeu({ jeu, jours, appel, environnement });
    if (rapport) console.log(rapport);
    for (const e of ecarts) {
      console.log(`ÉCART : ${e}`);
      ko++;
    }
  }
  if (ko) process.exit(1);
  console.log("jours figés de l'image : conformes aux fichiers");
}
