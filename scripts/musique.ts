// `npm run musique` (lot « musique » de la plateforme) : vérifie les morceaux décrits dans `musique/musiques.json`, prépare les fichiers servis (AAC, volume harmonisé), écrit la liste
// servie au jeu (`musique/servi/liste.json`) et les crédits des deux pages de mentions légales. Mode d'emploi : docs/plateforme/musique.md.
//   npm run musique              vérifie, prépare ce qui a changé, écrit la liste et les crédits
//   npm run musique -- --essai      ajoute d'abord le morceau d'essai (généré par le code, CC0) pour Track
//   npm run musique -- --verifier   vérifie seulement (aucun ffmpeg) : échoue si la description est fausse ou si ce qui est préparé n'est pas à jour — c'est ce que fait la CI
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { verifierDescription } from "../packages/musique/src/description";
import { ESSAI, wavEssai } from "../packages/musique/outils/essai";
import { lireListe } from "../packages/musique/src/liste";
import {
  argsEncodage,
  argsMesure,
  blocCredits,
  construireListe,
  ecartsAvecLaListe,
  empreinte,
  injecterCredits,
  lireMesure,
  nomServi,
  texteListe,
  type InfoPreparee,
} from "../packages/musique/outils/preparation";

const RACINE = process.cwd(); // `npm run musique` se lance toujours à la racine du dépôt
const DOSSIER = join(RACINE, "musique");
const PISTES = join(DOSSIER, "pistes");
const SERVI = join(DOSSIER, "servi");
const DESCRIPTION = join(DOSSIER, "musiques.json");
const verifierSeulement = process.argv.includes("--verifier");
const MENTIONS = { fr: join(RACINE, "apps/portail/mentions-legales/index.html"), en: join(RACINE, "apps/portail/legal/index.html") } as const;

const echec = (lignes: string[]): never => {
  console.error(lignes.join("\n"));
  process.exit(1);
};

// `--essai` : le morceau d'essai généré par le code (CC0), ajouté pour Track s'il n'y est pas : voir tout le chemin sans avoir de morceau à soi. Pour le retirer, effacer son entrée de musiques.json.
if (process.argv.includes("--essai") && !verifierSeulement) {
  mkdirSync(PISTES, { recursive: true });
  writeFileSync(join(PISTES, ESSAI.fichier), wavEssai());
  const d = JSON.parse(readFileSync(DESCRIPTION, "utf8")) as { pistes: { id: string }[] };
  if (!d.pistes.some((p) => p.id === ESSAI.id)) {
    d.pistes.push({ ...ESSAI, jeux: [...ESSAI.jeux] } as never);
    writeFileSync(DESCRIPTION, `${JSON.stringify(d, null, 2)}\n`);
    console.log("musique : le morceau d'essai est ajouté à musiques.json (Track seulement).");
  }
}

const brut = JSON.parse(readFileSync(DESCRIPTION, "utf8")) as unknown;
const v = verifierDescription(brut, { fichierExiste: (f) => existsSync(join(PISTES, f)) });
if (v.erreurs.length > 0) echec(["musiques.json : à corriger avant de continuer.", ...v.erreurs.map((e) => `  • ${e}`)]);
const description = { pistes: v.pistes };

const empreintes = new Map<string, string>();
const empreinteDe = (fichier: string): string => {
  let e = empreintes.get(fichier);
  if (!e) empreintes.set(fichier, (e = empreinte(readFileSync(join(PISTES, fichier)))));
  return e;
};
const listeActuelle = existsSync(join(SERVI, "liste.json")) ? lireListe(JSON.parse(readFileSync(join(SERVI, "liste.json"), "utf8"))) : null;
const servis = new Set(existsSync(SERVI) ? readdirSync(SERVI).filter((f) => f.endsWith(".m4a")) : []);

if (verifierSeulement) {
  const ecarts = ecartsAvecLaListe(description, listeActuelle, empreinteDe, servis);
  if (ecarts.length > 0) echec(["Les morceaux préparés ne sont pas à jour : lance `npm run musique` puis ajoute le résultat au commit.", ...ecarts.map((e) => `  • ${e}`)]);
  console.log(`musique : ${description.pistes.length} morceau(x) vérifié(s), tout est à jour.`);
  process.exit(0);
}

function ffmpeg(args: string[]): { ok: boolean; erreur: string } {
  const r = spawnSync("ffmpeg", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.error && (r.error as NodeJS.ErrnoException).code === "ENOENT") {
    echec([
      "ffmpeg n'est pas installé : c'est l'outil qui convertit les morceaux. Installe-le en une ligne, puis relance `npm run musique` :",
      "  Windows : winget install Gyan.FFmpeg      Mac : brew install ffmpeg      Linux : sudo apt install ffmpeg",
      "(ou, sans rien installer, demande à un agent de lancer la commande dans une session : ffmpeg y est.)",
    ]);
  }
  return { ok: r.status === 0, erreur: `${r.stderr ?? ""}` };
}

function duree(fichier: string): number {
  const r = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", fichier], { encoding: "utf8" });
  const d = Number(`${r.stdout ?? ""}`.trim());
  return Number.isFinite(d) && d > 0 ? d : 0;
}

mkdirSync(SERVI, { recursive: true });
const infos = new Map<string, InfoPreparee>();
for (const p of description.pistes) {
  const nom = nomServi(p.id, empreinteDe(p.fichier));
  const sortie = join(SERVI, nom);
  if (!existsSync(sortie)) {
    const source = join(PISTES, p.fichier);
    console.log(`musique : préparation de « ${p.id} »…`);
    const mesure = ffmpeg(argsMesure(source));
    const m = mesure.ok ? lireMesure(mesure.erreur) : null;
    if (!m) echec([`« ${p.id} » : ffmpeg n'a pas pu mesurer le volume (le fichier est-il un vrai morceau ?).`, mesure.erreur.split("\n").slice(-6).join("\n")]);
    const enc = ffmpeg(argsEncodage(source, sortie, m!));
    if (!enc.ok) {
      rmSync(sortie, { force: true });
      echec([`« ${p.id} » : la conversion a échoué.`, enc.erreur.split("\n").slice(-6).join("\n")]);
    }
  }
  infos.set(p.id, { fichier: nom, duree: duree(sortie) });
}
// Les fichiers préparés d'un morceau retiré ou changé ne restent pas.
const voulus = new Set([...infos.values()].map((i) => i.fichier));
for (const f of servis) if (!voulus.has(f)) rmSync(join(SERVI, f));

const liste = construireListe(description, infos);
writeFileSync(join(SERVI, "liste.json"), texteListe(liste));
for (const langue of ["fr", "en"] as const) writeFileSync(MENTIONS[langue], injecterCredits(readFileSync(MENTIONS[langue], "utf8"), blocCredits(liste, langue)));
const octets = [...voulus].reduce((s, f) => s + (existsSync(join(SERVI, f)) ? readFileSync(join(SERVI, f)).length : 0), 0);
console.log(`musique : ${liste.pistes.length} morceau(x) prêt(s), ${(octets / 1024 / 1024).toFixed(2)} Mo en tout. Liste, crédits des mentions légales (fr et en) à jour : ajoute-les au commit.`);
