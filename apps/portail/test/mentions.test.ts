import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SALON_SESSION_MS } from "@cdj/sim";
import { LANGUE_KEY } from "@cdj/profile";
import { PAGES_MENTIONS, cheminMentions } from "@cdj/ui";
import { GRACE_MS } from "../../api/src/cdj";
import { CACHE_CLOSED_S } from "../../api/src/cache";
import { SCHEMA } from "../../api/src/db";
import { JUMP_LIVES_PER_DAY, JUMP_SAMPLE_PER_PLAYER, JUMP_SAMPLE_SIZE } from "../../api/src/jumpLives";
import { CLOSED_GHOST_TTL_MS } from "../../api/src/jump";
import { DEFAULT_LIMITS, RATE_KEEP_WINDOWS } from "../../api/src/platform";
import { PRESENCE_KEEP_MS, SALON_SERVE_MS, THROTTLE_KEEP_MS } from "../../api/src/salon";

// Lot R5 (plateforme) : la page « Mentions légales et confidentialité » ne promet rien que le code ne fait pas. Chaque nombre ou durée tiré du
// code porte `data-constante` et `data-valeur` : ils doivent être les constantes du serveur, et le texte affiché doit dire la même chose.
// Chaque table de la base est décrite (une nouvelle donnée gardée = la page à mettre à jour, `apps/api/CLAUDE.md`).
// Lot I6 : la même page en anglais (`/legal/`, traduction fidèle ; la française fait foi) : mêmes constantes, mêmes rubriques, mêmes tables, aucune
// ressource extérieure, chacune renvoie à l'autre.
const ROOT = join(__dirname, "../../..");
const PAGE = readFileSync(join(ROOT, "apps/portail/mentions-legales/index.html"), "utf8");
const PAGE_EN = readFileSync(join(ROOT, "apps/portail/legal/index.html"), "utf8");
const EFFACEMENT = readFileSync(join(ROOT, "docs/plateforme/effacement.md"), "utf8");

/** Les valeurs du code, par nom (durées en millisecondes). */
const CONSTANTES: Record<string, number> = {
  SALON_SERVE_MS,
  SALON_SESSION_MS,
  JUMP_LIVES_PER_DAY,
  GRACE_MS,
  JUMP_SAMPLE_SIZE,
  JUMP_SAMPLE_PER_PLAYER,
  RATE_KEEP_MS: (RATE_KEEP_WINDOWS + 1) * DEFAULT_LIMITS.windowMs,
  PRESENCE_KEEP_MS,
  THROTTLE_KEEP_MS,
};

/** Ce qu'une valeur doit afficher : un nombre, ou une durée en mots (« 20 secondes », « 10 minutes », « 1 heure » ; en anglais « 20 seconds »…). */
function affichage(nom: string, valeur: number, langue: "fr" | "en" = "fr"): string {
  if (!nom.endsWith("_MS")) return String(valeur);
  const parts: [number, string, string][] =
    langue === "fr"
      ? [[3_600_000, "heure", "heures"], [60_000, "minute", "minutes"], [1000, "seconde", "secondes"]]
      : [[3_600_000, "hour", "hours"], [60_000, "minute", "minutes"], [1000, "second", "seconds"]];
  for (const [unit, one, many] of parts) if (valeur % unit === 0) return `${valeur / unit} ${valeur / unit === 1 ? one : many}`;
  return `${valeur} ms`;
}

const spansDe = (page: string) => [...page.matchAll(/<span data-constante="([A-Z_]+)" data-valeur="(\d+)">([^<]*)<\/span>/g)].map((m) => ({ nom: m[1]!, valeur: Number(m[2]), texte: m[3]! }));
const spans = spansDe(PAGE);
/** Les rubriques (identifiants des titres) et les tables décrites, dans l'ordre de la page. */
const rubriques = (page: string) => [...page.matchAll(/<h[1-3] id="([a-z-]+)"/g)].map((m) => m[1]);
const tablesDecrites = (page: string) => [...page.matchAll(/data-tables="([^"]+)"/g)].map((m) => m[1]);

describe("page des mentions légales et de la confidentialité", () => {
  it("chaque durée ou nombre affiché est la constante du code, et le texte dit la même chose", () => {
    expect(spans.length).toBeGreaterThanOrEqual(Object.keys(CONSTANTES).length);
    for (const s of spans) {
      expect(CONSTANTES[s.nom], `constante inconnue : ${s.nom}`).toBeDefined();
      expect(s.valeur, s.nom).toBe(CONSTANTES[s.nom]);
      expect(s.texte, s.nom).toBe(affichage(s.nom, CONSTANTES[s.nom]!));
    }
    for (const nom of Object.keys(CONSTANTES)) expect(spans.map((s) => s.nom), nom).toContain(nom);
    // Aucune durée « en dur » ailleurs dans l'inventaire du serveur (tout chiffre de durée passe par une constante, sauf les 30 jours de Google).
    const inventaire = PAGE.slice(PAGE.indexOf('id="serveur"'), PAGE.indexOf('id="hebergeurs-voient"')).replace(/<span data-constante[^>]*>[^<]*<\/span>/g, "");
    expect(inventaire.match(/\d+\s*(secondes?|minutes?|heures?|jours?)\b/g) ?? []).toEqual(["30 jours"]);
  });

  it("chaque table de la base est décrite dans l'inventaire de ce que le serveur garde", () => {
    const tables = SCHEMA.map((sql) => /CREATE TABLE IF NOT EXISTS (\w+)/.exec(sql)?.[1]).filter((t): t is string => !!t);
    const decrites = new Set([...PAGE.matchAll(/data-tables="([^"]+)"/g)].flatMap((m) => m[1]!.split(/\s+/)));
    expect(tables.length).toBeGreaterThan(10);
    for (const t of [...tables, "meta"]) expect(decrites.has(t), `table non décrite : ${t}`).toBe(true);
  });

  it("éditeur, contact, hébergeurs, droits, CNIL ; aucun cookie, aucun script, aucune ressource extérieure", () => {
    for (const texte of ["MZC Studios", "particulier", "mzc.studios.gamedev@gmail.com", "Google Cloud France", "8 rue de Londres", "01 42 68 53 00", "ChiselStrike Inc.", "Claymont", "code de transfert", "www.cnil.fr/fr/plaintes", "article 82", "aucun cookie"]) {
      expect(PAGE, texte).toContain(texte);
    }
    expect(PAGE).not.toMatch(/<script\b/i);
    expect(PAGE).not.toMatch(/<(link|img|iframe)\b[^>]*\b(href|src)="https?:/i);
    expect(PAGE).toContain('lang="fr"');
  });

  it("le code des jeux ne pose aucun cookie, et ne garde rien que sous cdj:, jump: (stockage local) et la base des miniatures", () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|html)$/.test(f)) files.push(p);
      }
    };
    for (const d of ["apps/web/src", "apps/jump/src", "packages/profile/src", "apps/portail/src"]) walk(join(ROOT, d));
    for (const f of [...files, join(ROOT, "apps/web/index.html"), join(ROOT, "apps/jump/index.html"), join(ROOT, "apps/portail/index.html")]) {
      const text = readFileSync(f, "utf8");
      expect(text, f).not.toMatch(/document\.cookie/);
      expect(text, f).not.toMatch(/<script[^>]+src="https?:/);
    }
    const idb = files.filter((f) => /indexedDB\.open/.test(readFileSync(f, "utf8")));
    expect(idb.map((f) => f.slice(ROOT.length + 1))).toEqual(["apps/web/src/thumbnails.ts"]);
    expect(PAGE).toContain("miniatures");
    expect(PAGE).toContain("<code>cdj:…</code>");
    // Lot I1 : la langue commune (`cdj:langue`, écrite par le portail) est une donnée gardée : la page le dit.
    expect(LANGUE_KEY.startsWith("cdj:")).toBe(true);
    expect(PAGE).toContain("ta langue (français ou anglais");
    expect(PAGE).toContain("<code>jump:…</code>");
  });

  // Suites de Track 2 : les deux clés que le Garage (lot 41) et la règle de qualité (lot 45) écrivent sont nommées, dans les deux langues. Les clés sont lues dans le source du jeu :
  // une clé renommée sans la page échoue ici.
  it("le Garage et la qualité graphique sont nommés (cdj:track:garage, cdj:qualite), avec ce qu'ils gardent", () => {
    const cle = (fichier: string, nom: string) => new RegExp(`export const ${nom} = "([^"]+)"`).exec(readFileSync(join(ROOT, fichier), "utf8"))?.[1];
    const garage = cle("apps/web/src/voiture/choix.ts", "CLE_GARAGE");
    const qualite = cle("apps/web/src/qualite.ts", "QUALITE_KEY");
    expect([garage, qualite]).toEqual(["cdj:track:garage", "cdj:qualite"]);
    for (const [page, textes] of [
      [PAGE, ["ta voiture de DailyTrack", "la couleur du motif", "les voitures débloquées", "le palier graphique", "la date de la dernière mesure"]],
      [PAGE_EN, ["your DailyTrack car", "the pattern colour", "the cars you have unlocked", "the graphics tier", "the date of the last"]],
    ] as const) {
      expect(page).toContain(`<code>${garage}</code>`);
      expect(page).toContain(`<code>${qualite}</code>`);
      for (const t of textes) expect(page, t).toContain(t);
    }
  });

  it("la procédure d'effacement donne les délais du code (mémoire, cache)", () => {
    expect(CLOSED_GHOST_TTL_MS).toBe(10 * 60_000);
    expect(EFFACEMENT).toContain("jusqu'à 10 minutes");
    expect(CACHE_CLOSED_S).toBe(86_400);
    expect(EFFACEMENT).toContain("jusqu'à 24 heures");
  });

  it("liée depuis le portail, le menu ⏸ et Réglages › Profil des deux jeux (adresse relative au site)", () => {
    expect(readFileSync(join(ROOT, "apps/portail/index.html"), "utf8")).toContain('href="mentions-legales/"');
    expect(readFileSync(join(ROOT, "apps/web/index.html"), "utf8")).toMatch(/id="pause-mentions"[^>]*href="\.\.\/mentions-legales\/"/);
    expect(readFileSync(join(ROOT, "apps/web/src/settingsUi.ts"), "utf8")).toContain("lierMentions(mentions)"); // lot I6 : la page de la langue (test suivant)
    expect(readFileSync(join(ROOT, "apps/jump/src/pauseMenu.ts"), "utf8")).toContain('"../mentions-legales/"');
    // Lot I5 : plus de profil dans Jump (le profil commun du portail) : le lien est dans ses Réglages, comme Track.
    expect(readFileSync(join(ROOT, "apps/jump/src/settingsUi.ts"), "utf8")).toContain('"../mentions-legales/"');
    expect(readFileSync(join(ROOT, "apps/portail/vite.config.ts"), "utf8")).toContain("mentions-legales/index.html");
  });
});

describe("lot I6 : les mentions en anglais (/legal/), traduction fidèle de la page française qui fait foi", () => {
  it("mêmes constantes du code, dites en anglais", () => {
    const en = spansDe(PAGE_EN);
    expect(en.map((s) => [s.nom, s.valeur])).toEqual(spans.map((s) => [s.nom, s.valeur]));
    for (const s of en) expect(s.texte, s.nom).toBe(affichage(s.nom, CONSTANTES[s.nom]!, "en"));
    const inventaire = PAGE_EN.slice(PAGE_EN.indexOf('id="serveur"'), PAGE_EN.indexOf('id="hebergeurs-voient"')).replace(/<span data-constante[^>]*>[^<]*<\/span>/g, "");
    expect(inventaire.match(/\d+\s*(seconds?|minutes?|hours?|days?)\b/g) ?? []).toEqual(["30 days"]);
  });

  it("mêmes rubriques, mêmes tables décrites, dans le même ordre", () => {
    expect(rubriques(PAGE).length).toBeGreaterThanOrEqual(8);
    expect(rubriques(PAGE_EN)).toEqual(rubriques(PAGE));
    expect(tablesDecrites(PAGE_EN)).toEqual(tablesDecrites(PAGE));
    // Mêmes listes de l'inventaire et des droits (nombre d'éléments de liste), mêmes liens extérieurs (sources citées).
    expect(PAGE_EN.match(/<li\b/g)?.length).toBe(PAGE.match(/<li\b/g)?.length);
    const liens = (page: string) => [...page.matchAll(/href="((?:https?|mailto|tel):[^"]+)"/g)].map((m) => m[1]);
    expect(liens(PAGE_EN)).toEqual(liens(PAGE));
  });

  it("éditeur, contact, hébergeurs, droits, CNIL ; aucun cookie, aucun script, aucune ressource extérieure ; en anglais", () => {
    for (const texte of ["MZC Studios", "private individual", "mzc.studios.gamedev@gmail.com", "Google Cloud France", "8 rue de Londres", "01 42 68 53 00", "ChiselStrike Inc.", "Claymont", "transfer code", "www.cnil.fr/fr/plaintes", "article 82", "no cookies", "<code>cdj:…</code>", "<code>jump:…</code>", "thumbnails"]) {
      expect(PAGE_EN, texte).toContain(texte);
    }
    expect(PAGE_EN).not.toMatch(/<script\b/i);
    expect(PAGE_EN).not.toMatch(/<(link|img|iframe)\b[^>]*\b(href|src)="https?:/i);
    expect(PAGE_EN).toContain('<html lang="en">');
  });

  it("en tête, la française fait foi ; chaque page renvoie à l'autre", () => {
    expect(PAGE).toContain("La version française fait foi");
    expect(PAGE_EN).toContain("The French version is the reference");
    expect(PAGE_EN).toContain("la version française fait foi");
    expect(PAGE).toMatch(/href="\.\.\/legal\/" hreflang="en"/);
    expect(PAGE_EN).toMatch(/href="\.\.\/mentions-legales\/" hreflang="fr"/);
    expect(PAGE).toContain('<link rel="alternate" hreflang="en" href="../legal/" vite-ignore />');
    expect(PAGE_EN).toContain('<link rel="alternate" hreflang="fr" href="../mentions-legales/" vite-ignore />');
    // Même date de mise à jour (une page changée = les deux).
    const date = (page: string) => /<time datetime="([\d-]+)">/.exec(page)?.[1];
    expect(date(PAGE_EN)).toBe(date(PAGE));
  });

  it("les liens « Mentions légales » du portail et des jeux ouvrent la page de la langue choisie", () => {
    expect(PAGES_MENTIONS).toEqual({ fr: "mentions-legales/", en: "legal/" });
    expect(cheminMentions("en", "../")).toBe("../legal/");
    for (const page of Object.values(PAGES_MENTIONS)) expect(readFileSync(join(ROOT, "apps/portail", page, "index.html"), "utf8")).toContain("<!doctype html>");
    expect(readFileSync(join(ROOT, "apps/portail/vite.config.ts"), "utf8")).toContain("legal/index.html");
    for (const f of ["apps/portail/src/portail.ts", "apps/portail/src/profil.ts", "apps/portail/src/classement.ts"]) {
      const src = readFileSync(join(ROOT, f), "utf8");
      expect(src, f).toMatch(/href: cheminMentions\(langue/);
      expect(src, f).not.toContain('"mentions-legales/"');
    }
    expect(readFileSync(join(ROOT, "apps/web/index.html"), "utf8")).toMatch(/id="pause-mentions"[^>]*data-mentions/);
    expect(readFileSync(join(ROOT, "apps/web/src/settingsUi.ts"), "utf8")).toContain("lierMentions(mentions)");
    expect(readFileSync(join(ROOT, "apps/jump/src/pauseMenu.ts"), "utf8")).toMatch(/lierMentions\(lier\(el\("a", \{ classe: "pause__lien", attrs: \{ id: "menu-mentions"/);
    expect(readFileSync(join(ROOT, "apps/jump/src/settingsUi.ts"), "utf8")).toMatch(/lierMentions\(lienFleche\("settings-mentions"/);
    for (const f of ["apps/web/src/i18n.ts", "apps/jump/src/i18n.ts"]) expect(readFileSync(join(ROOT, f), "utf8"), f).toContain('querySelectorAll<HTMLElement>("[data-mentions]")) e.setAttribute("href", cheminMentions(langue, "../"))');
  });
});

describe("lot R5 : plus aucune trace de l'import par l'adresse (#dujour=…)", () => {
  it("ni le module de profil, ni les jeux, ni le portail ne lisent le fragment de migration", () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|mjs|html)$/.test(f) && /dujour=|consumeMigrationFragment|importMigration|importFromOldAddress|migrationFragment/.test(readFileSync(p, "utf8"))) hits.push(p.slice(ROOT.length + 1));
      }
    };
    for (const d of ["apps/web/src", "apps/jump/src", "packages/profile/src", "apps/portail", "scripts"]) walk(join(ROOT, d));
    expect(hits.filter((h) => !h.includes("/test/") && !h.includes("node_modules"))).toEqual([]);
  });
});
