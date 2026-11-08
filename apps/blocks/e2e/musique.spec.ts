import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { lancer } from "./appareil";

// « Blocks » — la musique (lot B6) : aucun son ni aucune requête avant un premier geste ; le menu et chaque thème jouent leur morceau ; « Couper la musique » met la sortie à zéro ; la couche du combo se synthétise à ×3. Le son n'est pas
// entendu ici : on regarde ce que la page demande au réseau et à Web Audio (un espion posé avant la page sur `AudioContext`, voir `espion`).
// Lot S2 : la musique se joue par Web Audio (morceau téléchargé, décodé, lu par un `AudioBufferSourceNode`), **jamais par un élément média** (il couperait la vidéo ou la musique du joueur) : l'espion compte
// les décodages et les lectures d'éléments média, et le premier test vérifie qu'il n'y en a aucun.

interface Espion {
  contextes: number;
  /** Les lectures d'un élément `<audio>` ou `<video>` (`play()`) : doit rester à zéro. */
  lecturesMedia: number;
  musique: { gains: { gain: { value: number } }[]; oscillateurs: number; state: string; decodes: number; sources: number } | null;
}
declare global {
  interface Window {
    __audio: Espion;
  }
}

/** Pose l'espion avant la page : les contextes créés, et celui de la musique (le seul qui décode un fichier) avec ses gains, ses oscillateurs, ses décodages et ses lectures de morceaux. */
async function espion(context: import("@playwright/test").BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const w = window as unknown as Window & Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    w.__audio = { contextes: 0, lecturesMedia: 0, musique: null };
    const jouerMedia = w.HTMLMediaElement?.prototype.play;
    if (jouerMedia)
      w.HTMLMediaElement.prototype.play = function (this: unknown) {
        w.__audio.lecturesMedia++;
        return jouerMedia.call(this);
      };
    const Base = w.BaseAudioContext?.prototype;
    if (!Base) return;
    const gain = Base.createGain;
    Base.createGain = function (this: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      const g = gain.call(this);
      (this.__gains ??= []).push(g);
      return g;
    };
    const source = Base.createBufferSource;
    Base.createBufferSource = function (this: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      this.__sources = (this.__sources ?? 0) + 1;
      return source.call(this);
    };
    const osc = Base.createOscillator;
    Base.createOscillator = function (this: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      this.__oscs = (this.__oscs ?? 0) + 1;
      return osc.call(this);
    };
    const Ctx = w.AudioContext;
    const decoder = Ctx.prototype.decodeAudioData;
    Ctx.prototype.decodeAudioData = function (this: any, ...a: unknown[]) { // eslint-disable-line @typescript-eslint/no-explicit-any
      const ctx = this;
      ctx.__decodes = (ctx.__decodes ?? 0) + 1;
      w.__audio.musique ??= { get gains() { return ctx.__gains ?? []; }, get oscillateurs() { return ctx.__oscs ?? 0; }, get state() { return ctx.state; }, get decodes() { return ctx.__decodes ?? 0; }, get sources() { return ctx.__sources ?? 0; } };
      return decoder.apply(this, a);
    };
    class Espionne extends Ctx {
      constructor(...a: unknown[]) {
        super(...a);
        w.__audio.contextes++;
      }
    }
    w.AudioContext = Espionne;
  });
}

const demandes = (page: Page): string[] => {
  const urls: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/musique/")) urls.push(new URL(r.url()).pathname.split("/").pop()!);
  });
  return urls;
};

test.describe("Blocks : la musique", () => {
  test("aucune musique avant un premier geste : ni requête, ni contexte audio ; au premier geste, la liste puis le morceau du menu", async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: "http://localhost:4179", locale: "fr-FR" });
    await espion(ctx);
    const p = await ctx.newPage();
    const vus = demandes(p);
    await p.addInitScript(() => localStorage.setItem("blocks:aide:vu", "1"));
    await p.goto("/?debug&manuel&tactile=0");
    await p.waitForSelector("#jeu-jouer", { state: "attached" });
    await p.waitForTimeout(1500);
    expect(vus, "aucune requête de musique avant un geste").toEqual([]);
    expect(await p.evaluate(() => window.__audio.contextes), "aucun contexte audio avant un geste").toBe(0);
    // Un premier geste (un clic hors des boutons) : la liste, puis le morceau du menu.
    await p.mouse.click(5, 5);
    await expect.poll(() => vus.includes("liste.json"), { timeout: 10_000 }).toBe(true);
    await expect.poll(() => vus.some((u) => u.startsWith("blocks-menu-") && u.endsWith(".m4a")), { timeout: 10_000 }).toBe(true);
    // Lot S2 : le morceau est décodé puis lu par Web Audio ; aucun élément `<audio>` ni `<video>` n'existe ni ne joue (il couperait la vidéo ou la musique du joueur).
    await expect.poll(() => p.evaluate(() => window.__audio.musique?.decodes ?? 0), { timeout: 10_000 }).toBeGreaterThan(0);
    await expect.poll(() => p.evaluate(() => window.__audio.musique?.sources ?? 0), { timeout: 10_000 }).toBeGreaterThan(0);
    expect(await p.evaluate(() => document.querySelectorAll("audio, video").length), "aucun élément média dans la page").toBe(0);
    expect(await p.evaluate(() => window.__audio.lecturesMedia), "aucune lecture d'élément média").toBe(0);
    await ctx.close();
  });

  for (const theme of ["port", "chantier", "canyon", "banquise", "jungle", "nuit"]) {
    test(`?theme=${theme} : la partie joue le morceau du thème (blocks-${theme})`, async ({ browser }) => {
      const ctx = await browser.newContext({ baseURL: "http://localhost:4179", locale: "fr-FR" });
      await espion(ctx);
      const p = await ctx.newPage();
      const vus = demandes(p);
      await p.addInitScript(() => localStorage.setItem("blocks:aide:vu", "1"));
      await p.goto(`/?debug&manuel&tactile=0&theme=${theme}`);
      await p.waitForSelector("#jeu-jouer", { state: "attached" });
      await lancer(p);
      await expect.poll(() => vus.some((u) => u.startsWith(`blocks-${theme}-`) && u.endsWith(".m4a")), { timeout: 10_000 }).toBe(true);
      await ctx.close();
    });
  }

  test("« Couper la musique » (Réglages › Son) met la sortie de la musique à zéro ; la rallumer la rend", async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: "http://localhost:4179", locale: "fr-FR" });
    await espion(ctx);
    const p = await ctx.newPage();
    await p.addInitScript(() => localStorage.setItem("blocks:aide:vu", "1"));
    await p.goto("/?debug&manuel&tactile=0");
    await p.waitForSelector("#jeu-jouer", { state: "attached" });
    await p.mouse.click(5, 5);
    const sortie = () => p.evaluate(() => window.__audio.musique?.gains[0]?.gain.value ?? -1);
    await expect.poll(sortie, { timeout: 10_000 }).toBeGreaterThan(0.1); // la musique du menu joue, au volume par défaut
    await p.locator("#jeu-bouton-reglages").click();
    const couper = p.locator('[id$="-couper"]').first();
    await couper.click();
    await expect.poll(sortie, { timeout: 5_000 }).toBe(0);
    await couper.click();
    await expect.poll(sortie, { timeout: 5_000 }).toBeGreaterThan(0.1);
    await ctx.close();
  });

  test("la couche du combo : rien à ×1 et ×2, une couche synthétisée dès ×3, qui reste à ×4", async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: "http://localhost:4179", locale: "fr-FR" });
    await espion(ctx);
    const p = await ctx.newPage();
    await p.addInitScript(() => localStorage.setItem("blocks:aide:vu", "1"));
    await p.goto("/?debug&manuel&tactile=0&scenario=combo&theme=port");
    await p.waitForSelector("#jeu-jouer", { state: "attached" });
    await lancer(p);
    const oscillateurs = () => p.evaluate(() => window.__audio.musique?.oscillateurs ?? 0);
    await expect.poll(() => p.evaluate(() => window.__audio.musique?.state), { timeout: 10_000 }).toBe("running");
    const poses = [[6, 4], [6, 5], [6, 6], [6, 7]] as const;
    for (const [i, [c, l]] of poses.entries()) {
      await p.evaluate(([e, c, l]) => window.__jeu.action(`pose:${e}:${c}:${l}`), [i % 3, c, l]); // trois dominos dans la première série, le quatrième ouvre la suivante
      expect(await p.evaluate(() => window.__blocks.etat().combo)).toBe(i + 1);
      expect(await p.evaluate(() => window.__blocks.couche()), `couche au combo ×${i + 1}`).toBe(i + 1 >= 3);
    }
    // Dès ×3, la musique synthétise la couche (arpège ou nappe) : des oscillateurs apparaissent sur le contexte de la musique.
    await expect.poll(oscillateurs, { timeout: 10_000 }).toBeGreaterThan(0);
    await ctx.close();
  });

  test("la couche ne joue pas quand la musique est coupée", async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: "http://localhost:4179", locale: "fr-FR" });
    await espion(ctx);
    const p = await ctx.newPage();
    await p.addInitScript(() => {
      localStorage.setItem("blocks:aide:vu", "1");
      localStorage.setItem("cdj:musique", JSON.stringify({ v: 1, volume: 0.8, coupee: true }));
    });
    await p.goto("/?debug&manuel&tactile=0&scenario=combo&theme=port");
    await p.waitForSelector("#jeu-jouer", { state: "attached" });
    await lancer(p);
    await expect.poll(() => p.evaluate(() => window.__audio.musique?.state), { timeout: 10_000 }).toBe("running");
    for (const [e, [c, l]] of ([[6, 4], [6, 5], [6, 6]] as const).entries()) await p.evaluate(([e, c, l]) => window.__jeu.action(`pose:${e}:${c}:${l}`), [e, c, l]);
    expect(await p.evaluate(() => window.__blocks.couche())).toBe(true); // la couche est demandée…
    await p.waitForTimeout(800);
    expect(await p.evaluate(() => window.__audio.musique?.oscillateurs ?? 0)).toBe(0); // …mais rien n'est synthétisé : la musique est coupée
    expect(await p.evaluate(() => window.__audio.musique?.gains[0]?.gain.value ?? -1)).toBe(0);
    await ctx.close();
  });
});
