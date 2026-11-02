import { expect, type Page } from "@playwright/test";

// Lot S1b (charte rév. 16, § 9 et § 10) : ce qu'un accueil de jeu doit tenir sur un téléphone en portrait (390 × 844, 360 × 640) comme en paysage — l'étiquette n'est jamais coupée (si la hauteur
// manque, l'écran défile), Discord et Ko-fi sont deux plaques de 44 px qui ne la recouvrent jamais, et le toucher ne montre aucun anneau de focus. Une copie par application (`apps/<jeu>/e2e`) :
// seuls les sélecteurs changent. Aides pures du navigateur : `page.evaluate`, aucune attente en temps réel.

export interface AccueilTelephone {
  /** L'étiquette du jeu (`.etiquette`). */
  etiquette: string;
  /** Ce qui défile (le cadre commun : `.cadre__defile`). */
  defile: string;
  /** Les blocs de l'étiquette qui ne doivent jamais être écrasés ni coupés. */
  blocs: string[];
  /** L'action principale (Courir, Jouer). */
  principal: string;
  /** La barre des jeux (« ‹ DU JOUR », la date) : elle reste en haut quand l'écran défile. */
  barre: string;
}

interface Mesure {
  coupes: string[];
  nuls: string[];
  atteignable: boolean;
  principalVu: boolean;
  barre: { y: number; h: number };
  plaques: { id: string; x: number; y: number; w: number; h: number; nom: string | null }[];
  etiquette: { x: number; y: number; w: number; h: number };
  principalBoite: { x: number; y: number; w: number; h: number };
  vue: { w: number; h: number };
}

/** L'accueil complet : étiquette non coupée, défilement jusqu'au bout, plaques de 44 px dehors. À appeler quand l'accueil est affiché. */
export async function verifierAccueilTelephone(page: Page, o: AccueilTelephone): Promise<void> {
  const m: Mesure = await page.evaluate((o) => {
    const e = document.querySelector<HTMLElement>(o.etiquette)!;
    const d = document.querySelector<HTMLElement>(o.defile)!;
    d.scrollTo(0, 1e5); // jusqu'au bout : c'est là que tout doit se voir
    const nom = (el: Element) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${typeof el.className === "string" && el.className ? `.${el.className.trim().split(/\s+/)[0]}` : ""}`;
    const coupes: string[] = []; // (la livrée de l'étiquette déborde exprès de son bord droit et y est rognée : seule la hauteur de l'étiquette elle-même compte)
    for (const el of [e, ...e.querySelectorAll<HTMLElement>("*")]) {
      if (!el.getClientRects().length || el.clientWidth <= 1 || el.clientHeight <= 1) continue; // invisible ou « sr-only »
      const cs = getComputedStyle(el);
      if (cs.display === "inline" || cs.display === "contents") continue;
      if (cs.overflowY !== "visible" && el.scrollHeight > el.clientHeight + 1) coupes.push(`${nom(el)} (hauteur : ${el.scrollHeight} > ${el.clientHeight})`);
      if (el !== e && cs.overflowX !== "visible" && el.scrollWidth > el.clientWidth + 1) coupes.push(`${nom(el)} (largeur : ${el.scrollWidth} > ${el.clientWidth})`);
    }
    const nuls: string[] = [];
    for (const sel of o.blocs) for (const el of document.querySelectorAll<HTMLElement>(sel)) if (el.offsetParent && el.getBoundingClientRect().height < 8) nuls.push(sel);
    const r = (x: Element) => {
      const b = x.getBoundingClientRect();
      return { x: b.x, y: b.y, w: b.width, h: b.height };
    };
    const p = document.querySelector<HTMLElement>(o.principal)!;
    const pb = r(p);
    return {
      coupes,
      nuls,
      atteignable: d.scrollHeight - d.clientHeight - d.scrollTop <= 1,
      barre: (({ y, height }) => ({ y, h: height }))(document.querySelector(o.barre)!.getBoundingClientRect()),
      principalVu: pb.y >= -1 && pb.y + pb.h <= innerHeight + 1,
      plaques: ["discord", "kofi"].map((id) => ({ id, ...r(document.querySelector(`#communaute-${id}`)!), nom: document.querySelector(`#communaute-${id}`)!.getAttribute("aria-label") })),
      etiquette: r(e),
      principalBoite: pb,
      vue: { w: innerWidth, h: innerHeight },
    };
  }, o);
  expect(m.coupes, "un bloc de l'étiquette est coupé").toEqual([]);
  expect(m.nuls, "un bloc de l'étiquette est écrasé").toEqual([]);
  expect(m.atteignable, "le défilement va jusqu'au bout").toBe(true);
  expect(m.principalVu, "l'action principale se voit au bas du défilement").toBe(true);
  expect(m.barre.y >= -1 && m.barre.h > 20 && m.barre.y + m.barre.h < m.vue.h / 2, "la barre des jeux reste en haut, visible, au bas du défilement").toBe(true);
  const [a, b] = m.plaques;
  for (const p of m.plaques) {
    expect(p.w, `${p.id} : largeur`).toBe(44);
    expect(p.h, `${p.id} : hauteur`).toBe(44);
    expect(p.nom, `${p.id} : nom lu par les lecteurs d'écran`).toBeTruthy();
    expect(p.x).toBeGreaterThanOrEqual(-1);
    expect(p.y).toBeGreaterThanOrEqual(-1);
    expect(p.x + p.w).toBeLessThanOrEqual(m.vue.w + 1);
    expect(p.y + p.h, `${p.id} : dans l'écran`).toBeLessThanOrEqual(m.vue.h + 1);
    for (const [nom, c] of [["l'étiquette", m.etiquette], ["l'action principale", m.principalBoite]] as const) {
      const ox = Math.min(p.x + p.w, c.x + c.w) - Math.max(p.x, c.x);
      const oy = Math.min(p.y + p.h, c.y + c.h) - Math.max(p.y, c.y);
      expect(ox > 2 && oy > 2, `${p.id} recouvre ${nom}`).toBe(false);
    }
  }
  expect(Math.min(a!.x + a!.w, b!.x + b!.w) - Math.max(a!.x, b!.x) > 2 && Math.min(a!.y + a!.h, b!.y + b!.h) - Math.max(a!.y, b!.y) > 2, "Discord et Ko-fi se chevauchent").toBe(false);
}

/** L'anneau de focus (lot S1b) : posé sur l'action principale au toucher, rien ne se voit (le clavier d'un appareil sans souris n'est pas couvert : voir `socle.css`). */
export async function verifierFocusTactile(page: Page, ecran: string, o: { focusAttendu?: boolean } = {}): Promise<void> {
  const anneau = () =>
    page.evaluate((ecran) => {
      const a = document.activeElement as HTMLElement | null;
      if (!a || !document.querySelector(ecran)?.contains(a)) return null;
      const cs = getComputedStyle(a);
      return { style: cs.outlineStyle, largeur: parseFloat(cs.outlineWidth) };
    }, ecran);
  const initial = await anneau();
  if (o.focusAttendu ?? true) expect(initial, "l'action principale a le focus à l'ouverture").not.toBeNull(); // Tower ne pose aucun focus à l'accueil : `focusAttendu: false`
  if (initial) expect(initial.style === "none" || initial.largeur === 0, "aucun anneau au toucher (focus posé par le jeu)").toBe(true);
  const vue = page.viewportSize()!;
  await page.touchscreen.tap(vue.width / 2, 2); // un toucher sur le voile, loin de tout bouton
  const apres = await anneau();
  if (apres) expect(apres.style === "none" || apres.largeur === 0, "aucun anneau après un toucher").toBe(true);
}
