import { expect, test, type Browser, type Page } from "@playwright/test";
import { hasWebGL } from "./phone";

// Lot 8b : l'essai d'élan progressif (`?debug&tune&sprint=1`, pas à pas : la vitesse dépasse la course après le délai, la partie est
// `tuned` et rien n'est enregistré) et l'animation du personnage (le cycle des pieds avance avec la distance ; le mouvement réduit coupe le
// rebond et le penché, pas les pieds). Tout se lit dans `__jump`, jamais sur une durée.

const RIGHT = 2;
const RUN = (375 * 120) / 4096; // tuiles/s : la course (375 unités/pas, ≈ 11)

interface Look {
  pose: string;
  stride: number;
  phase: number;
  feet: number[];
  bob: number;
  lean: number;
  breath: number;
  body: number;
}
interface J {
  phase: string;
  player: { x: number; vx: number; ground: boolean };
  params: { runSpeed: number; sprintMode?: number; sprintSpeed?: number; sprintDelay?: number; sprintAccel?: number };
  tuned: boolean;
  look: Look;
  replays: { list(): unknown[] };
  storage: { clear(): number; readonly memory: { best: number | null; lives: number; deaths: number } };
  manual(on: boolean): void;
  advance(n: number): { x: number; vx: number };
  input(bits: number | null): void;
  restart(): void;
}
const get = <T>(page: Page, f: (j: J) => T): Promise<T> => page.evaluate(`(${f.toString()})(window.__jump)`) as Promise<T>;

async function open(page: Page, query: string): Promise<boolean> {
  await page.goto(`/?${query}`);
  if (!(await hasWebGL(page))) return false;
  await page.waitForFunction(() => (window as unknown as { __jump?: { phase: string } }).__jump?.phase === "ready");
  await page.evaluate(() => (window as unknown as { __jump: J }).__jump.manual(true));
  return true;
}

/** Joue `n` pas avec la commande `bits` ; rend la vitesse (tuiles/s) après chaque pas. */
function speeds(page: Page, bits: number, n: number): Promise<number[]> {
  return page.evaluate(
    ([b, count]) => {
      const j = (window as unknown as { __jump: J }).__jump;
      j.input(b);
      const out: number[] = [];
      for (let t = 0; t < count; t++) out.push(j.advance(1).vx);
      return out;
    },
    [bits, n] as const,
  );
}

test("?scenario=bac-a-sable&debug&tune&sprint=1 : la vitesse dépasse la course après le délai, jusqu'à 15 tuiles/s ; partie `tuned`", async ({ page }) => {
  test.skip(!(await open(page, "scenario=bac-a-sable&debug&tune&sprint=1")), "WebGL indisponible dans ce navigateur : la scène ne peut pas se construire");
  expect(await get(page, (j) => j.params)).toMatchObject({ sprintMode: 1, sprintSpeed: 512, sprintDelay: 48, sprintAccel: 2 });
  await expect(page.locator('#tune .switch[data-key="sprintMode"]')).toHaveText("Élan : activé");
  await expect(page.locator('#tune input[data-key="sprintSpeed"]')).toBeEnabled();
  const v = await speeds(page, RIGHT, 200);
  const first = v.findIndex((x) => x >= RUN - 1e-9);
  const over = v.findIndex((x) => x > RUN + 1e-9);
  expect(first).toBeGreaterThan(0);
  expect(over - first).toBe(48); // 0,4 s à pleine vitesse au sol, puis l'élan
  expect(v.slice(first, over).every((x) => Math.abs(x - RUN) < 1e-9)).toBe(true);
  expect(v[v.length - 1]).toBeCloseTo(15, 9);
  expect(await get(page, (j) => j.tuned)).toBe(true);
  await expect(page.locator("#tuned")).toHaveText("réglages modifiés : rien n'est enregistré");
  // L'interrupteur éteint l'élan : la course seulement (après un lâcher, l'élan est perdu).
  await page.locator('#tune .switch[data-key="sprintMode"]').click();
  await expect(page.locator('#tune .switch[data-key="sprintMode"]')).toHaveText("Élan : désactivé");
  await speeds(page, 0, 30);
  const off = await speeds(page, RIGHT, 200);
  expect(Math.max(...off)).toBeCloseTo(RUN, 9);
});

/** Ouvre le bac à sable dans un contexte à mouvement réduit (ou non), court, et lit l'animation de plusieurs images. */
async function runLooks(browser: Browser, reducedMotion: "reduce" | "no-preference"): Promise<Look[] | null> {
  const context = await browser.newContext({ reducedMotion });
  const page = await context.newPage();
  try {
    if (!(await open(page, "scenario=bac-a-sable&debug"))) return null;
    await speeds(page, RIGHT, 70);
    // Plusieurs images dessinées à cet état (la simulation ne bouge pas en pas à pas : l'animation, si).
    return await page.evaluate(
      () =>
        new Promise<Look[]>((resolve) => {
          const out: Look[] = [];
          const frame = () => {
            out.push((window as unknown as { __jump: J }).__jump.look);
            if (out.length >= 12) resolve(out);
            else requestAnimationFrame(frame);
          };
          requestAnimationFrame(frame);
        }),
    );
  } finally {
    await context.close();
  }
}

