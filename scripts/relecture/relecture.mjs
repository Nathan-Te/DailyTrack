#!/usr/bin/env node
// Lot QA1 (plateforme) : `npm run relecture` — photographier tout le site et le contrôler, en local, **hors de la CI**.
//
//   npm run relecture                                   tout : portail et jeux, 7 tailles d'écran, français et anglais
//   npm run relecture -- --seulement portail            une zone (`portail`, `track`, `jump`, `tower`, `blocks`, `rush`) ou une expression régulière sur l'identifiant d'un sujet (`^accueil`)
//   npm run relecture -- --langues fr --tailles 1440x900,390x844
//   npm run relecture -- --sans-preparation             réutilise le site et la base du passage précédent (après une première fois)
//   npm run relecture -- --sortie <dossier> --paralleles 4 --port 4290 --densite 2
//
// Il assemble le site comme la recette (`node scripts/site.mjs site`, vitrine et lien de démonstration compris ; les jeux doivent être construits : il lance `npm run build` s'il en manque un), lance le vrai
// serveur sur une base SQLite locale remplie par le vrai `recette:seed` (joueur « Démo », classements, amis, groupes, retours, nouveautés), passe en `on` les jeux en aperçu de la liste `JEUX_PHOTOGRAPHIES`,
// puis photographie chaque sujet (une page ou un écran de jeu, dans un état) à chaque taille et dans chaque langue. Sortie (dossier `relecture/`, hors du dépôt : `.gitignore`) :
//   index.html            les planches (toutes les tailles côte à côte) et le tableau des contrôles, page par page
//   planches/<langue>/    une planche par sujet ; captures/<langue>/<sujet>/<taille>.jpg : chaque capture seule
//   controles.json, controles.md   le tableau des contrôles (contraste AA, cibles de moins de 44 px, défilement horizontal, texte coupé, textes interdits, focus, images sans alt, console)
// Rien n'est écrit dans une base distante ; aucun contrôle ne fait échouer la commande (ce sont des signaux à lire) — elle n'échoue que si une page ne s'ouvre pas du tout.
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { CONTROLES, contraste, controlesDuDom, ecouterConsole, focusVisible } from "./controles.mjs";
import { JEUX_PHOTOGRAPHIES, sujetsDesJeux } from "./jeux.mjs";
import { sujetsDuPortail } from "./pages.mjs";
import { ecrireIndex, ecrirePlanche } from "./planches.mjs";
import { etatDuJeu, joueursDesEtats, ouvrirDepuisToujours, jourDeParis, lancerApi, lancerSite, semer, sessionAdmin } from "./serveurs.mjs";

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** Les tailles d'écran. `tactile` : contexte de téléphone ou de tablette (doigt, `isMobile`) ; `marges` : les marges de sécurité de l'iPhone (encoche, barre du bas). */
export const TAILLES = [
  { id: "1440x900", l: 1440, h: 900, nom: "Ordinateur 1440 × 900", tactile: false },
  { id: "1280x800", l: 1280, h: 800, nom: "Ordinateur 1280 × 800", tactile: false },
  { id: "1024x768", l: 1024, h: 768, nom: "Tablette paysage 1024 × 768", tactile: true },
  { id: "820x1180", l: 820, h: 1180, nom: "Tablette portrait 820 × 1180", tactile: true },
  { id: "390x844", l: 390, h: 844, nom: "iPhone portrait 390 × 844", tactile: true, marges: { top: 47, bottom: 34, left: 0, right: 0 } },
  { id: "844x390", l: 844, h: 390, nom: "iPhone paysage 844 × 390", tactile: true, marges: { top: 0, bottom: 21, left: 47, right: 47 } },
  { id: "360x740", l: 360, h: 740, nom: "Petit Android 360 × 740", tactile: true },
];
const LANGUES = ["fr", "en"];

function options(argv) {
  const lire = (nom) => {
    const i = argv.indexOf(`--${nom}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const tailles = lire("tailles")?.split(",");
  return {
    sortie: resolve(lire("sortie") ?? join(RACINE, "relecture")),
    seulement: lire("seulement") ?? null,
    langues: (lire("langues")?.split(",") ?? LANGUES).filter((l) => LANGUES.includes(l)),
    tailles: tailles ? TAILLES.filter((t) => tailles.includes(t.id)) : TAILLES,
    preparer: !argv.includes("--sans-preparation"),
    paralleles: Math.max(1, Number(lire("paralleles")) || 4),
    port: Number(lire("port")) || 4290,
    densite: Number(lire("densite")) || 1,
  };
}

const dire = (texte) => process.stdout.write(`${texte}\n`);

/** Construit ce qui manque, assemble le site, remplit la base. Rend `{ site, base }`. */
async function preparer(o, origine) {
  const travail = join(o.sortie, ".travail");
  const site = join(travail, "site");
  const base = join(travail, "relecture-recette.sqlite"); // « recette » dans le nom : le garde-fou de `recette:seed`
  if (!o.preparer && existsSync(join(site, "index.html")) && existsSync(base)) return { site, base, refus: [] };
  mkdirSync(travail, { recursive: true });
  const fiches = JSON.parse(execFileSync("node", ["-e", "import('./scripts/fiches-lecture.mjs').then(m=>console.log(JSON.stringify(m.FICHES_CI.map(f=>f.app))))"], { cwd: RACINE, encoding: "utf8" }));
  if (fiches.some((app) => !existsSync(join(RACINE, "apps", app, "dist/index.html")))) {
    dire("relecture : un jeu n'est pas construit — npm run build (quelques minutes)…");
    execFileSync("npm", ["run", "--silent", "build"], { cwd: RACINE, stdio: ["ignore", "ignore", "inherit"] });
  }
  if (!existsSync(join(RACINE, "apps/api/dist/server.mjs"))) execFileSync("npm", ["run", "--silent", "build:node", "-w", "@cdj/api"], { cwd: RACINE, stdio: ["ignore", "ignore", "inherit"] });
  dire("relecture : assemblage du site (comme la recette)…");
  execFileSync("node", ["scripts/site.mjs", "site", "--sortie", site, "--origine", origine], { cwd: RACINE, stdio: ["ignore", "ignore", "inherit"] });
  for (const ext of ["", "-wal", "-shm"]) rmSync(`${base}${ext}`, { force: true });
  // Les jeux en aperçu passent `on` d'abord (le serveur crée la base), puis le seed leur écrit un classement.
  const api = await lancerApi(RACINE, o.port + 1, base, origine);
  const serveur = await lancerSite(site, o.port, o.port + 1);
  const refus = [];
  try {
    const cookie = await sessionAdmin(origine);
    for (const jeu of JEUX_PHOTOGRAPHIES) {
      const r = await etatDuJeu(origine, cookie, jeu, "on");
      if (r && !/deja|identique|409/.test(r)) refus.push(`${jeu} : ${r}`);
    }
  } finally {
    await new Promise((r) => serveur.close(r));
    api.kill();
    await new Promise((r) => api.once("exit", r));
  }
  ouvrirDepuisToujours(base);
  dire("relecture : remplissage de la base de démonstration (recette:seed, base locale)…");
  semer(RACINE, base, jourDeParis());
  return { site, base, refus };
}

/** Pose l'identité, la langue et les marges de sécurité avant tout script de la page. */
async function contexteDe(navigateur, { taille, langue, joueur, cookie, origine, densite, stockage }) {
  const contexte = await navigateur.newContext({
    viewport: { width: taille.l, height: taille.h },
    deviceScaleFactor: densite,
    hasTouch: taille.tactile,
    isMobile: taille.tactile,
    locale: langue === "en" ? "en-US" : "fr-FR",
    timezoneId: "Europe/Paris",
  });
  await contexte.addInitScript(
    ({ langue, joueur, stockage }) => {
      try {
        if (!sessionStorage.getItem("relecture:pose")) {
          localStorage.setItem("cdj:langue", langue);
          for (const [cle, valeur] of Object.entries(stockage)) localStorage.setItem(cle, valeur);
          if (joueur) localStorage.setItem("cdj:player", joueur.id), localStorage.setItem("cdj:name", joueur.nom);
          sessionStorage.setItem("relecture:pose", "1");
        }
      } catch {
        /* page sans stockage */
      }
    },
    { langue, joueur: joueur ?? null, stockage: stockage ?? {} },
  );
  if (cookie) await contexte.addCookies([{ name: "__session", value: cookie, url: origine }]);
  return contexte;
}

/** Les marges de sécurité de l'iPhone (`env(safe-area-inset-*)`), par le protocole du navigateur ; sans effet si ce Chromium ne les connaît pas. */
async function poserMarges(page, taille) {
  const m = taille.marges ?? { top: 0, bottom: 0, left: 0, right: 0 };
  try {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: m.top, topMax: m.top, bottom: m.bottom, bottomMax: m.bottom, left: m.left, leftMax: m.left, right: m.right, rightMax: m.right } });
    await cdp.detach();
    return true;
  } catch {
    return false;
  }
}

const repos = async (page, ms = 350) => {
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  await page.waitForTimeout(ms);
};

/** Photographie un sujet dans une langue, à toutes les tailles ; rend ses captures et ses constats. */
async function photographier(navigateur, sujet, langue, o, donnees) {
  const dossier = join(o.sortie, "captures", langue, sujet.id);
  mkdirSync(dossier, { recursive: true });
  const constats = Object.fromEntries(CONTROLES.map((c) => [c.id, []]));
  const noter = (controle, liste, taille) => {
    for (const c of liste) {
      const deja = constats[controle].find((x) => x.quoi === c.quoi && x.ou === c.ou);
      if (deja) deja.tailles.includes(taille.id) || deja.tailles.push(taille.id);
      else constats[controle].push({ ...c, tailles: [taille.id] });
    }
  };
  const captures = [];
  const manques = [];
  // `photo` : un joueur neuf à pseudo unique (l'arrivée d'un jeu est une vraie partie, classée par le serveur local ; il refuse une course envoyée deux fois).
  const joueurDe = () => (sujet.etat === "demo" ? donnees.joueurs.demo : sujet.etat === "parfaite" ? donnees.joueurs.parfaite : sujet.etat === "photo" ? { id: randomBytes(16).toString("hex"), nom: `Photo ${randomBytes(2).toString("hex")}` } : null);
  const chemin = typeof sujet.chemin === "object" ? sujet.chemin[langue] : sujet.chemin;
  // Un écran de jeu s'atteint une fois par genre d'appareil (ordinateur, tactile), puis la fenêtre change de taille : la partie ne se rejoue pas sept fois. Une page du portail est rechargée à chaque taille.
  const genres = sujet.ouvrir ? [o.tailles.filter((t) => !t.tactile), o.tailles.filter((t) => t.tactile)].filter((g) => g.length) : o.tailles.map((t) => [t]);
  for (const genre of genres) {
    const contexte = await contexteDe(navigateur, { taille: genre[0], langue, joueur: joueurDe(), cookie: sujet.etat === "admin" ? donnees.cookie : null, origine: donnees.origine, densite: o.densite, stockage: sujet.stockage });
    const page = await contexte.newPage();
    const erreurs = ecouterConsole(page, sujet.attendues ?? []);
    try {
      await poserMarges(page, genre[0]);
      if (sujet.ouvrir) await sujet.ouvrir(page, { origine: donnees.origine, taille: genre[0], langue });
      else {
        await page.goto(`${donnees.origine}${chemin}`, { waitUntil: "networkidle", timeout: 30_000 });
        await repos(page);
        if (sujet.apres) await sujet.apres(page), await repos(page);
      }
      for (const taille of genre) {
        if (taille !== genre[0]) {
          await poserMarges(page, taille);
          await page.setViewportSize({ width: taille.l, height: taille.h });
          await repos(page, 600);
          if (sujet.apresTaille) await sujet.apresTaille(page, taille);
        }
        const dom = await controlesDuDom(page, { tactile: taille.tactile, zone: sujet.zoneEcran });
        for (const [k, liste] of Object.entries(dom)) noter(k, liste, taille);
        if (taille.id === "1440x900" || taille.id === "390x844" || o.tailles.length < 3) noter("contraste", await contraste(page, sujet.zoneEcran), taille);
        // Une page du portail est photographiée en entier : la fenêtre prend la hauteur de la page (une barre fixe reste ainsi au bas de la page, pas au milieu) ; la planche marque le bas du premier écran.
        // (Le portail n'a aucune règle CSS sur la hauteur ou l'orientation de la fenêtre.) Un écran de jeu est photographié tel quel.
        if (!sujet.ouvrir) {
          const hauteur = await page.evaluate(() => Math.ceil(document.documentElement.scrollHeight));
          if (hauteur > taille.h) await page.setViewportSize({ width: taille.l, height: Math.min(hauteur, 12_000) }), await repos(page, 250);
        }
        const fichier = join(dossier, `${taille.id}.jpg`);
        await page.screenshot({ path: fichier, type: "jpeg", quality: 82, animations: "disabled", caret: "hide" });
        captures.push({ taille: taille.id, fichier });
      }
      // Le focus se contrôle en dernier (il déplace le focus : aucune capture ne le montre).
      if (!genre[0].tactile && !sujet.sansFocus) noter("focus", await focusVisible(page, sujet.zoneEcran), genre.at(-1));
    } catch (e) {
      manques.push(`${genre.map((t) => t.id).join(", ")} : ${String(e.message ?? e).split("\n")[0].slice(0, 200)}`);
    } finally {
      noter("console", erreurs, genre[0]);
      await contexte.close();
    }
  }
  return { captures, constats, manques };
}

async function main() {
  const o = options(process.argv.slice(2));
  const origine = `http://localhost:${o.port}`;
  mkdirSync(o.sortie, { recursive: true });
  const { site, base, refus } = await preparer(o, origine);
  for (const r of refus) dire(`relecture : jeu non passé « on » — ${r}`);
  const api = await lancerApi(RACINE, o.port + 1, base, origine);
  const serveur = await lancerSite(site, o.port, o.port + 1);
  const navigateur = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"], executablePath: process.env.CHROMIUM_PATH || undefined });
  const debut = Date.now();
  try {
    const joueurs = joueursDesEtats(base);
    const donnees = { origine, joueurs, cookie: await sessionAdmin(origine).catch(() => null) };
    const filtre = o.seulement ? new RegExp(o.seulement) : null;
    const tous = [...sujetsDuPortail({ groupe: joueurs.groupe }), ...sujetsDesJeux()];
    const sujets = tous.filter((s) => !filtre || filtre.test(s.zone) || filtre.test(s.id));
    const taches = sujets.flatMap((sujet) => o.langues.filter((l) => !sujet.langues || sujet.langues.includes(l)).map((langue) => ({ sujet, langue })));
    dire(`relecture : ${sujets.length} sujets, ${taches.length} passages, ${o.tailles.length} tailles — ${origine}`);
    const resultats = [];
    let fait = 0;
    const file = [...taches];
    await Promise.all(
      Array.from({ length: Math.min(o.paralleles, file.length) }, async () => {
        for (let t = file.shift(); t; t = file.shift()) {
          if ((t.sujet.etat === "parfaite" && !joueurs.parfaite) || (t.sujet.etat === "admin" && !donnees.cookie)) {
            resultats.push({ ...t, captures: [], constats: Object.fromEntries(CONTROLES.map((c) => [c.id, []])), manques: [t.sujet.etat === "admin" ? "pas de session de démonstration du panneau" : "aucun joueur de démonstration n'a fini tous les jeux du jour"] });
            continue;
          }
          const r = await photographier(navigateur, t.sujet, t.langue, o, donnees);
          const planche = r.captures.length ? await ecrirePlanche(navigateur, { sortie: o.sortie, sujet: t.sujet, langue: t.langue, captures: r.captures, tailles: o.tailles, pli: !t.sujet.ouvrir }) : null;
          resultats.push({ ...t, ...r, planche });
          fait++;
          if (fait % 10 === 0) dire(`relecture : ${fait} / ${taches.length}`);
        }
      }),
    );
    const ordre = new Map(taches.map((t, i) => [`${t.sujet.id}|${t.langue}`, i]));
    resultats.sort((a, b) => ordre.get(`${a.sujet.id}|${a.langue}`) - ordre.get(`${b.sujet.id}|${b.langue}`));
    const nouvelles = resultats.map((r) => ({ id: r.sujet.id, zone: r.sujet.zone, titre: r.sujet.titre, etat: r.sujet.etat, langue: r.langue, planche: r.planche ? relative(o.sortie, r.planche) : null, captures: r.captures.map((c) => ({ taille: c.taille, fichier: relative(o.sortie, c.fichier) })), constats: r.constats, manques: r.manques }));
    // Un passage partiel (`--seulement`, `--langues`) garde les sujets du passage précédent qu'il n'a pas refaits : l'index reste entier.
    const cles = new Set(nouvelles.map((l) => `${l.id}|${l.langue}`));
    let anciennes = [];
    try {
      const avant = JSON.parse(readFileSync(join(o.sortie, "controles.json"), "utf8"));
      if (avant.tailles.join() === o.tailles.map((t) => t.id).join()) anciennes = avant.sujets.filter((l) => !cles.has(`${l.id}|${l.langue}`) && (!l.planche || existsSync(join(o.sortie, l.planche))));
    } catch {
      /* premier passage */
    }
    const rang = new Map(tous.flatMap((s) => LANGUES.map((l) => `${s.id}|${l}`)).map((k, i) => [k, i]));
    const lignes = [...anciennes, ...nouvelles].sort((a, b) => (rang.get(`${a.id}|${a.langue}`) ?? 1e9) - (rang.get(`${b.id}|${b.langue}`) ?? 1e9));
    writeFileSync(join(o.sortie, "controles.json"), `${JSON.stringify({ jour: jourDeParis(), tailles: o.tailles.map((t) => t.id), controles: CONTROLES, sujets: lignes }, null, 1)}\n`);
    ecrireIndex(o.sortie, { lignes, tailles: o.tailles, controles: CONTROLES, jour: jourDeParis(), refus });
    const manquants = nouvelles.filter((l) => l.manques.length);
    dire(`relecture : ${nouvelles.length - manquants.length} passages photographiés en ${Math.round((Date.now() - debut) / 1000)} s — ${join(o.sortie, "index.html")}`);
    for (const m of manquants) dire(`  manque : ${m.id} (${m.langue}) — ${m.manques.join(" ; ")}`);
  } finally {
    await navigateur.close();
    await new Promise((r) => serveur.close(r));
    api.kill();
  }
}

main().catch((e) => {
  process.stderr.write(`relecture : ${e.stack ?? e}\n`);
  process.exit(1);
});
