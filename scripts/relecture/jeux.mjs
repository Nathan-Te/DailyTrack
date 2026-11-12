// Lot QA1 : les écrans des jeux que `npm run relecture` photographie — pour chaque jeu : l'accueil, une partie en cours (HUD, commandes tactiles), la pause, l'arrivée, le classement et les réglages.
// Chaque écran s'atteint par les options d'essai du jeu (`?debug`, `?scenario=`, crochets `window.__cdj`, `__jump`, `__tower`, `__jeu`), ouvertes hors production : le site photographié est celui de la recette.
// Un écran s'ouvre une fois par genre d'appareil (ordinateur, tactile), puis la fenêtre change de taille (`relecture.mjs`). **Ajouter un jeu = ajouter son entrée à `JEUX`.**
// Vertige et Cibles n'y sont pas (pas encore en aperçu : hors du lot QA1).
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** Les jeux nés `off` que la relecture passe `on` sur sa base locale (Track et Jump le sont déjà). */
export const JEUX_PHOTOGRAPHIES = ["tower", "blocks", "rush"];

/** Les clés du navigateur qui évitent « Comment jouer » au premier lancement et le « Nouveau départ » (une identité posée sans génération). */
export const STOCKAGE_DES_JEUX = { "cdj:generation": "neuf", "cdj:howto": "1", "jump:aide": "1", "tower:aide:vu": "1", "blocks:aide:vu": "1", "rush:aide:vu": "1" };

let courses = null;
/** Des courses valides et jamais copiées (`apps/web/e2e/courses.ts`, empaqueté à la volée) : l'arrivée de Track et de Jump est une vraie partie classée par le serveur local. */
async function chargerCourses() {
  if (courses) return courses;
  const source = join(RACINE, "apps/web/e2e/courses.ts");
  const sortie = join(RACINE, "node_modules/.cache/cdj/relecture-courses.mjs");
  mkdirSync(dirname(sortie), { recursive: true });
  execFileSync(join(RACINE, "node_modules/.bin/esbuild"), [source, "--bundle", "--platform=node", "--format=esm", "--target=node22", `--outfile=${sortie}`, "--log-level=error", `--define:import.meta.url=${JSON.stringify(pathToFileURL(source).href)}`], { cwd: RACINE });
  courses = await import(`${pathToFileURL(sortie).href}?t=${Date.now()}`);
  return courses;
}
const jourDeParis = () => new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const numeroDuJour = () => Math.floor(Date.parse(`${jourDeParis()}T00:00:00Z`) / 86_400_000);

const tactile = (ctx) => ctx.taille.tactile;
const visible = (page, selecteur, delai = 30_000) => page.locator(selecteur).first().waitFor({ state: "visible", timeout: delai });
const images = (page, ms = 500) => page.waitForTimeout(ms);
/** Ouvre une adresse d'un jeu ; échoue clairement si la page dit « Bientôt » (jeu resté `off`). */
async function aller(page, ctx, chemin, pret) {
  await page.goto(`${ctx.origine}${chemin}`, { waitUntil: "load", timeout: 60_000 });
  await page.locator(`${pret}, .dj-bientot`).first().waitFor({ state: "attached", timeout: 90_000 });
  if (await page.locator(".dj-bientot").count()) throw new Error("le jeu dit « Bientôt » (resté off sur la base locale)");
}

// ---------------------------------------------------------------- Track
const T = (q) => `/track/?api=/&fps=0${q}`;
async function trackPret(page) {
  await page.waitForSelector("#splash", { state: "detached", timeout: 120_000 });
  await page.waitForFunction(() => !!window.__cdj, undefined, { timeout: 60_000 });
}
async function trackAccueil(page, ctx) {
  await aller(page, ctx, T("&debug&home=1"), "#home-daily");
  await trackPret(page);
  await page.waitForFunction(() => window.__cdj.ui.home === true, undefined, { timeout: 60_000 });
  await visible(page, "#home-daily");
  await images(page, 1500);
}
async function trackEnCourse(page, ctx) {
  const { code } = (await chargerCourses()).courseTrack(numeroDuJour());
  await aller(page, ctx, T("&debug&home=0&ghost=off"), "canvas");
  await trackPret(page);
  await page.evaluate((c) => { window.__cdj.manual(true); window.__cdj.autoplay(c); return window.__cdj.advance(3 * 120 + 720); }, code);
  await page.waitForFunction(() => window.__cdj.phase === "racing", undefined, { timeout: 60_000 });
  await page.evaluate(() => window.__cdj.manual(false));
  await images(page, 900);
}
const TRACK = {
  accueil: trackAccueil,
  partie: trackEnCourse,
  async pause(page, ctx) {
    await trackEnCourse(page, ctx);
    await page.keyboard.press("p");
    await page.waitForFunction(() => window.__cdj.paused, undefined, { timeout: 15_000 });
    await images(page);
  },
  async arrivee(page, ctx) {
    const { code, ms } = (await chargerCourses()).courseTrack(numeroDuJour());
    await aller(page, ctx, T("&debug&home=0&ghost=off"), "canvas");
    await trackPret(page);
    await page.evaluate((c) => { window.__cdj.manual(true); window.__cdj.autoplay(c); }, code);
    // Pas à pas, par paquets, jusqu'à l'arrivée (le décompte et la fin de course ne se comptent pas d'avance).
    for (let i = 0; i < 40 && (await page.evaluate(() => window.__cdj.phase)) !== "finished"; i++) await page.evaluate((n) => window.__cdj.advance(n), i ? 300 : Math.ceil(ms * 0.12));
    if ((await page.evaluate(() => window.__cdj.phase)) !== "finished") throw new Error("la course calculée ne finit pas le circuit du jour");
    await page.evaluate(() => window.__cdj.manual(false));
    await visible(page, "#finish");
    await visible(page, "#finish .online .rank", 30_000).catch(() => {}); // sans rang (serveur lent) : l'arrivée est photographiée telle quelle
    await images(page, 1800);
  },
  async classement(page, ctx) {
    await trackAccueil(page, ctx);
    await visible(page, "#home-board-all");
    await page.locator("#home-board-all").click();
    await visible(page, "#board-screen .row");
    await images(page);
  },
  async reglages(page, ctx) {
    await trackAccueil(page, ctx);
    await page.locator("#home-settings").click();
    await visible(page, "#settings");
    await images(page);
  },
};

// ---------------------------------------------------------------- Jump
const J = (ctx, q = "") => `/jump/?api=/&debug&pieces=off${q}${tactile(ctx) ? "&touch=1" : ""}`;
const jumpSansDebug = (page) => page.addStyleTag({ content: "#debug, #stamp, #tuned { display: none !important; }" });
async function jumpAccueil(page, ctx) {
  await aller(page, ctx, J(ctx), "#home-play");
  await page.waitForFunction(() => window.__jump?.home.ready === true, undefined, { timeout: 120_000 });
  await jumpSansDebug(page);
  await visible(page, "#home-play");
  await images(page, 1000);
}
async function jumpEnPartie(page, ctx) {
  await aller(page, ctx, J(ctx, "&accueil=0"), "canvas");
  await page.waitForFunction(() => window.__jump?.phase === "ready", undefined, { timeout: 120_000 });
  await jumpSansDebug(page);
  await page.evaluate(() => { const j = window.__jump; j.manual(true); j.input(2); j.advance(150); j.input(0); j.advance(2); });
  await page.waitForFunction(() => document.getElementById("dayline")?.hidden !== false, undefined, { timeout: 15_000 }).catch(() => {});
  await images(page, 700);
}
const JUMP = {
  accueil: jumpAccueil,
  partie: jumpEnPartie,
  async pause(page, ctx) {
    await jumpEnPartie(page, ctx);
    await page.evaluate(() => window.__jump.setMenu(true));
    await visible(page, "#menu");
    await images(page);
  },
  async arrivee(page, ctx) {
    const { code } = (await chargerCourses()).courseJump(jourDeParis());
    await aller(page, ctx, J(ctx, "&accueil=0"), "canvas");
    await page.waitForFunction(() => window.__jump?.phase === "ready", undefined, { timeout: 120_000 });
    await page.evaluate((c) => {
      const j = window.__jump;
      j.manual(true);
      const n = j.autoplay(c);
      for (let t = 1; t <= n + 10; t++) { j.advance(1); if (j.phase === "carnage" || j.phase === "finished") break; }
      j.input(0); j.advance(1); j.input(2); j.advance(1); j.input(null);
    }, code);
    await visible(page, "#arrival");
    await page.waitForFunction(() => window.__jump.rank.state.status === "ranked", undefined, { timeout: 30_000 }).catch(() => {});
    await jumpSansDebug(page);
    await images(page, 1200);
  },
  async classement(page, ctx) {
    await jumpAccueil(page, ctx);
    await page.evaluate(() => window.__jump.openBoard());
    await visible(page, "#leaderboard");
    await images(page, 900);
  },
  async reglages(page, ctx) {
    await jumpAccueil(page, ctx);
    await page.locator("#home-settings").click();
    await visible(page, "#settings");
    await images(page);
  },
};

// ---------------------------------------------------------------- Tower
const W = (ctx, q = "") => `/tower/?api=/&tactile=${tactile(ctx) ? 1 : 0}${q}`;
async function towerAccueil(page, ctx) {
  await aller(page, ctx, W(ctx), "#accueil-jouer");
  await visible(page, "#accueil-jouer");
  await page.locator("#accueil-paliers li").first().waitFor({ timeout: 30_000 }).catch(() => {});
  await images(page, 1200);
}
async function towerEnPartie(page, ctx) {
  await aller(page, ctx, W(ctx, "&scenario=essai"), "html[data-ready=true] .tower__scene");
  await page.waitForFunction(() => !!window.__tower, undefined, { timeout: 60_000 });
  await page.evaluate(() => { const t = window.__tower; t.manuel(true); for (let i = 0; i < 3000 && t.vue().numero < 3; i++) t.avancer(1, 8); });
  await images(page, 800);
}
const TOWER = {
  accueil: towerAccueil,
  partie: towerEnPartie,
  async pause(page, ctx) {
    await towerEnPartie(page, ctx);
    await page.keyboard.press("Escape");
    await visible(page, "#pause-ecran");
    await images(page);
  },
  // Une vraie partie du jour, perdue au plus vite (chaque pièce poussée dans le vide) : l'écran de fin est celui d'une partie classée par le serveur local.
  async arrivee(page, ctx) {
    await towerAccueil(page, ctx);
    await page.locator("#accueil-jouer").click();
    await page.waitForSelector("html[data-ready=true] .tower__scene", { timeout: 60_000 });
    await page.waitForFunction(() => !!window.__tower, undefined, { timeout: 60_000 });
    await page.evaluate(() => {
      const t = window.__tower;
      t.manuel(true);
      let id = -1, k = 0;
      for (let i = 0; i < 60_000 && t.vue().phase !== "fini"; i++) { const a = t.vue().active; if (a !== id) { id = a; k = 0; } t.avancer(1, k++ < 20 ? 1 : 8); }
    });
    await visible(page, "#fin-ecran", 60_000);
    await images(page, 2500);
  },
  async classement(page, ctx) {
    await towerAccueil(page, ctx);
    await visible(page, "#accueil-tout-le-classement");
    await page.locator("#accueil-tout-le-classement").click();
    await visible(page, "#classement-ecran");
    await images(page, 800);
  },
  async reglages(page, ctx) {
    await towerAccueil(page, ctx);
    await page.locator("#accueil-reglages").click();
    await visible(page, "#reglages-ecran");
    await images(page);
  },
};

// ---------------------------------------------------------------- Jeux du kit (Blocks, Rush)
const K = (jeu, ctx, q = "") => `/${jeu}/?api=/&tactile=${tactile(ctx) ? 1 : 0}${q}`;
async function kitAccueil(jeu, page, ctx) {
  await aller(page, ctx, K(jeu, ctx), "#jeu-jouer");
  await visible(page, "#jeu-jouer");
  await images(page, 1500);
}
/** Les écrans communs du kit ; `partie` et `arrivee` sont propres à chaque jeu. */
const kit = (jeu, propres) => ({
  accueil: (page, ctx) => kitAccueil(jeu, page, ctx),
  partie: propres.partie,
  async pause(page, ctx) {
    await propres.partie(page, ctx);
    await page.locator("#jeu-hud-pause").click();
    await visible(page, "#jeu-pause");
    await images(page);
  },
  arrivee: propres.arrivee,
  async classement(page, ctx) {
    await kitAccueil(jeu, page, ctx);
    await visible(page, "#jeu-tout-le-classement");
    await page.locator("#jeu-tout-le-classement").click();
    await visible(page, "#jeu-classement-ecran");
    await images(page, 800);
  },
  async reglages(page, ctx) {
    await kitAccueil(jeu, page, ctx);
    await page.locator("#jeu-bouton-reglages").click();
    await visible(page, "#jeu-reglages");
    await images(page);
  },
});
const BLOCKS = kit("blocks", {
  async partie(page, ctx) {
    await aller(page, ctx, K("blocks", ctx, "&debug&manuel"), "#jeu-jouer");
    await page.locator("#jeu-jouer").click();
    await page.waitForFunction(() => !!window.__jeu && !!window.__blocks, undefined, { timeout: 60_000 });
    await page.waitForFunction(() => window.__blocks.arrivee?.() === 1, undefined, { timeout: 20_000 }).catch(() => {});
    await images(page, 600);
  },
  // Le résultat d'exemple du jeu (`?scenario=partage`, médaille d'or) : une vraie fin classée demanderait de jouer une partie entière au doigt.
  async arrivee(page, ctx) {
    await aller(page, ctx, K("blocks", ctx, "&debug&manuel&scenario=partage&medaille=or"), "#jeu-jouer");
    await page.locator("#jeu-jouer").click();
    await page.waitForFunction(() => !!window.__jeu, undefined, { timeout: 60_000 });
    await page.evaluate(() => window.__jeu.avancer(5));
    await visible(page, "#jeu-fin");
    await images(page, 900);
  },
});
const RUSH = kit("rush", {
  async partie(page, ctx) {
    await aller(page, ctx, K("rush", ctx, "&debug&manuel&qualite=haute"), "#jeu-jouer");
    await page.locator("#jeu-jouer").click();
    await page.waitForFunction(() => !!window.__jeu && !!window.__rush, undefined, { timeout: 60_000 });
    await page.evaluate(() => { const r = window.__rush; if (r.attenteDepart()) r.choisirCompetence(); });
    await page.locator(".rush-choix").waitFor({ state: "hidden", timeout: 20_000 }).catch(() => {});
    await page.waitForFunction(() => window.__rush.calls() > 5, undefined, { timeout: 60_000 }).catch(() => {});
    await page.evaluate(() => window.__jeu.avancer(180));
    await images(page, 900);
  },
  // L'écran de fin d'essai du jeu (`?scenario=fin`, 65 s) : même raison que Blocks.
  async arrivee(page, ctx) {
    await aller(page, ctx, K("rush", ctx, "&debug&manuel&scenario=fin&temps=65000"), "#jeu-jouer");
    await page.locator("#jeu-jouer").click();
    await page.waitForSelector("#jeu-fin .rush-fin", { timeout: 120_000 });
    await images(page, 900);
  },
});

const JEUX = { track: ["Track", TRACK], jump: ["Jump", JUMP], tower: ["Tower", TOWER], blocks: ["Blocks", BLOCKS], rush: ["Rush", RUSH] };
const ECRANS = [
  ["accueil", "l'accueil", "demo"],
  ["partie", "une partie en cours", "demo"],
  ["pause", "la pause", "demo"],
  ["arrivee", "l'arrivée", "photo"], // un joueur neuf à pseudo unique : sa partie est classée par le serveur local
  ["classement", "le classement du jour", "demo"],
  ["reglages", "les réglages", "demo"],
];

/** Un sujet par jeu et par écran. */
export function sujetsDesJeux() {
  return Object.entries(JEUX).flatMap(([id, [nom, ecrans]]) =>
    ECRANS.map(([ecran, titre, etat]) => ({ id: `${id}-${ecran}`, zone: id, titre: `${nom} — ${titre}`, etat, ouvrir: ecrans[ecran], stockage: STOCKAGE_DES_JEUX, sansFocus: ecran === "partie", attendues: ecran === "arrivee" ? [/\/api\/(\w+\/)?me$/] : [] })), // un joueur neuf n'a pas de profil avant sa première arrivée : ce 404 est attendu
  );
}
