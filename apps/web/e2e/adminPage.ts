import type { Page } from "@playwright/test";

/**
 * Ouvre la page d'admin et attend qu'elle ait FINI DE SE CONSTRUIRE (lot R3). Le planning (Aujourd'hui, 14 cartes, Historique) est au-dessus
 * des outils et se remplit après coup : chaque carte passe de « Circuit : en préparation… » à 8 ou 9 lignes quand son circuit arrive du fil
 * de travail, puis l'historique s'affiche. Mesuré dans Chromium : la section des outils descend de 680 à 5 856 px en 3,5 s, par 8 sauts.
 * Chromium compense (ancrage du défilement), WebKit non : un clic de test tombait sur ce qui avait pris la place (« Clicking the checkbox did
 * not change its state », « <button> from <div id="presets"> intercepts pointer events », un lien « Lancer le jeu » jamais suivi).
 * On attend donc un ÉTAT : toutes les cartes et le jour en cours ont leur fiche (ou « circuit indisponible »), l'historique est là, et la
 * position des outils n'a plus bougé pendant 5 images de suite.
 */
export async function adminSettled(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const w = window as unknown as { __adminTop?: number; __adminSame?: number };
      const filled = (box: Element | null) => !!box && (!box.textContent?.includes("en préparation…") || box.closest(".card, .daycard")?.querySelector<HTMLElement>(".thumb")?.dataset.state === "none");
      const cards = [...document.querySelectorAll("#planning .card")];
      const today = document.querySelector("#daynow");
      const done =
        cards.length === 14 &&
        cards.every((c) => filled(c.querySelector(".statbox"))) &&
        !!today && !today.textContent?.includes("Chargement…") &&
        (!!today.querySelector(".stats") || today.querySelector<HTMLElement>(".thumb")?.dataset.state === "none") &&
        (document.querySelector("#history")?.childElementCount ?? 0) > 0;
      const launch = document.getElementById("launch");
      const top = launch ? launch.getBoundingClientRect().top + scrollY : -1;
      w.__adminSame = done && top === w.__adminTop ? (w.__adminSame ?? 0) + 1 : 0;
      w.__adminTop = top;
      return w.__adminSame >= 5;
    },
    undefined,
    { polling: "raf", timeout: 60_000 },
  );
}

/** `page.goto` puis `adminSettled`. */
export async function openAdmin(page: Page, url = "/admin/"): Promise<void> {
  await page.goto(url);
  await adminSettled(page);
}
