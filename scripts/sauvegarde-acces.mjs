// Lot de mise en production du 28/10/2026 — les accès de la sauvegarde (lot R12), vérifiés un par un, avec ce qu'il faut faire quand l'un manque.
//   node scripts/sauvegarde-acces.mjs --projet <id> --sa <compte> --secret <nom> --bucket <nom> [--resume <fichier>]
// Lancé après `google-github-actions/auth` (fédération + compte de la sauvegarde), dans un job de l'environnement GitHub `sauvegarde` :
//   1. ce que GitHub présente à Google (le `sub` du jeton OIDC : c'est lui que la liaison `workloadIdentityUser` doit nommer) ;
//   2. la fédération prend-elle le compte ? (`gcloud auth print-access-token`) ;
//   3. le compte lit-il le jeton Turso en lecture seule ? (Secret Manager ; **la valeur n'est jamais affichée ni gardée**) ;
//   4. le compte voit-il le bucket ?
// Un `PERMISSION_DENIED` seul ne disait pas lequel des trois (« la sauvegarde n'a jamais marché ») : chaque refus donne son message complet (sans jeton : ce sont
// des messages de Google qui nomment un droit et une ressource) et la commande à lancer dans Cloud Shell. Aucun secret n'est lu ici autrement que pour être jeté.
import { appendFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const argv = process.argv.slice(2);
const opt = (n) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : undefined);
const projet = opt("--projet");
const sa = opt("--sa");
const secret = opt("--secret");
const bucket = opt("--bucket");
const resume = opt("--resume");
if (!projet || !sa || !secret || !bucket) {
  console.error("usage : node scripts/sauvegarde-acces.mjs --projet <id> --sa <compte> --secret <nom> --bucket <nom> [--resume <fichier>]");
  process.exit(2);
}

const lignes = [];
const dire = (l) => {
  console.log(l);
  lignes.push(l);
};
let echecs = 0;

/** Une commande gcloud ; sa sortie n'est jamais affichée (elle peut être un jeton), seulement son message d'erreur. */
function gcloud(args) {
  const r = spawnSync("gcloud", args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  return { ok: r.status === 0, erreur: (r.stderr || r.error?.message || "").trim().split("\n").filter((l) => l.trim()).slice(-4).join(" ") };
}

/** Le pool de fédération, lu dans le nom complet du fournisseur (sans jamais l'afficher : c'est un secret du dépôt). */
const pool = /workloadIdentityPools\/([^/]+)\//.exec(process.env.WIF_PROVIDER ?? "")?.[1] ?? "github";

// 1. Ce que GitHub présente à Google.
let sub = "";
try {
  const url = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const jeton = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if (url && jeton) {
    const r = await fetch(`${url}&audience=cdj-diagnostic`, { headers: { Authorization: `bearer ${jeton}` } });
    const valeur = (await r.json()).value;
    const charge = JSON.parse(Buffer.from(String(valeur).split(".")[1], "base64url").toString("utf8"));
    sub = String(charge.sub ?? "");
    dire(`- Jeton présenté par GitHub : \`sub\` = \`${sub}\` (environnement \`${charge.environment ?? "aucun"}\`, branche \`${charge.ref ?? "?"}\`)`);
  } else dire("- Jeton de GitHub : indisponible (le job n'a pas `id-token: write`)");
} catch (e) {
  dire(`- Jeton de GitHub : illisible (${e instanceof Error ? e.message : String(e)})`);
}
const attendu = "repo:Nathan-Te/DailyTrack:environment:sauvegarde";
if (sub && sub !== attendu) dire(`  - ⚠️ ce n'est pas \`${attendu}\`, le sujet que la liaison de l'annexe C nomme : la liaison doit nommer celui-ci (commande ci-dessous).`);

const liaisonFederation = `gcloud iam service-accounts add-iam-policy-binding ${sa} --project=${projet} --role=roles/iam.workloadIdentityUser --member="principal://iam.googleapis.com/projects/$(gcloud projects describe ${projet} --format='value(projectNumber)')/locations/global/workloadIdentityPools/${pool}/subject/${sub || attendu}"`;

// 2. La fédération prend-elle le compte ?
const fede = gcloud(["auth", "print-access-token"]);
if (fede.ok) dire(`- ✅ La fédération prend le compte \`${sa}\``);
else {
  echecs++;
  dire(`- ❌ La fédération ne prend pas le compte \`${sa}\` : ${fede.erreur}`);
  dire(`  - À lancer dans Cloud Shell : \`${liaisonFederation}\``);
  dire("  - Une liaison toute neuve peut mettre quelques minutes à valoir : relancer ce diagnostic 5 min après.");
}

// 3. Le jeton Turso en lecture seule (jamais affiché : la sortie est jetée).
if (fede.ok) {
  const s = gcloud(["secrets", "versions", "access", "latest", `--secret=${secret}`, `--project=${projet}`]);
  if (s.ok) dire(`- ✅ Le compte lit le secret \`${secret}\``);
  else {
    echecs++;
    dire(`- ❌ Le compte ne lit pas le secret \`${secret}\` : ${s.erreur}`);
    if (/NOT_FOUND|not found/i.test(s.erreur)) dire(`  - Le secret n'existe pas : annexe C, étape 3 (\`read -rs T && printf '%s' "$T" | gcloud secrets create ${secret} --project=${projet} --data-file=- && unset T\`)`);
    else dire(`  - À lancer dans Cloud Shell : \`gcloud secrets add-iam-policy-binding ${secret} --project=${projet} --member=serviceAccount:${sa} --role=roles/secretmanager.secretAccessor\``);
  }

  // 4. Le bucket.
  const b = gcloud(["storage", "ls", `gs://${bucket}`, `--project=${projet}`]);
  if (b.ok) dire(`- ✅ Le compte voit le bucket \`gs://${bucket}\``);
  else {
    echecs++;
    dire(`- ❌ Le compte ne voit pas le bucket \`gs://${bucket}\` : ${b.erreur}`);
    dire(`  - À lancer dans Cloud Shell : \`for r in objectCreator objectViewer; do gcloud storage buckets add-iam-policy-binding gs://${bucket} --member=serviceAccount:${sa} --role=roles/storage.$r; done\` (le bucket lui-même : annexe C, étape 1)`);
  }
}

dire(echecs ? `- ⛔ ${echecs} accès manquant(s) : lancer la ou les commandes ci-dessus, puis « Sauvegarde : diagnostic » de nouveau.` : "- ✅ Tous les accès de la sauvegarde sont en place.");
if (resume) appendFileSync(resume, ["### Accès de la sauvegarde", "", ...lignes, ""].join("\n"));
if (echecs) {
  console.log("::error title=Sauvegarde : accès manquant::le détail et la commande à lancer sont dans le résumé du run");
  process.exit(1);
}
