import { expect, test, type Page } from "@playwright/test";

// Lot 19 : l'outil de la variété (`?semaine=`) — 7 niveaux du jour côte à côte, leurs morceaux de base, ceux qui reviennent surlignés ; et la même
// semaine en g13 (fichier `outils/semaine-g13.json`). Aucun rendu WebGL : l'outil dessine ses miniatures sur un canevas 2D.

interface SemaineDebug {
  phase: string;
  semaine: { from: string; generator: number; ready: boolean; days: { date: string; pieces: { id: string }[] }[]; repeated: Record<string, string[]> };
}
const view = (page: Page) => page.evaluate(() => (window as unknown as { __jump: SemaineDebug }).__jump.semaine);
const ready = (page: Page) => page.waitForFunction(() => (window as unknown as { __jump?: SemaineDebug }).__jump?.semaine?.ready === true, undefined, { timeout: 90_000 });

test("première semaine g14 : 7 jours, miniatures, aucun morceau de base à moins de 3 jours ; la même semaine en g13 en a", async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto("/?semaine=2026-10-27&debug");
  await ready(page);
  const g14 = await view(page);
  expect(g14.from).toBe("2026-10-27");
  expect(g14.days.map((d) => d.date)).toEqual(["2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
  await expect(page.locator("#semaine .jour")).toHaveCount(7);
  await expect(page.locator("#semaine .jour canvas.mini")).toHaveCount(7);
  for (const dates of Object.values(g14.repeated)) {
    const days = dates.map((d) => Date.parse(`${d}T00:00:00Z`) / 86_400_000);
    for (let i = 1; i < days.length; i++) expect(days[i]! - days[i - 1]!).toBeGreaterThanOrEqual(3);
  }
  // Chaque morceau surligné l'est dans chaque jour où il apparaît.
  const marked = await page.locator("#semaine .morceaux li.repete").evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.id));
  expect(new Set(marked)).toEqual(new Set(Object.keys(g14.repeated)));

  await page.getByRole("link", { name: "Comparer avec le générateur g13" }).click();
  await ready(page);
  const g13 = await view(page);
  expect(g13.generator).toBe(13);
  expect(g13.days).toHaveLength(7);
  await expect(page.locator("#semaine h1")).toContainText("g13");
  // En g13, des morceaux de base reviennent à 1 ou 2 jours (le retour de Nathan) : l'outil les surligne.
  const close = Object.values(g13.repeated).some((dates) => dates.some((d, i) => i > 0 && Date.parse(d) - Date.parse(dates[i - 1]!) < 3 * 86_400_000));
  expect(close).toBe(true);
  await expect(page.locator("#semaine .morceaux li.repete").first()).toBeVisible();
});
