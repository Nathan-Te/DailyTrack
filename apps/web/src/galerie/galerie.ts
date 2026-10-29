// Lot V2 — **la galerie des circuits à venir** (`/track/?debug&galerie=30`, recette et aperçus seulement : `main.ts` ne la charge jamais en production, comme le banc).
// Chargée à la demande, elle prend la page (le jeu ne démarre pas). Pour chacun des N prochains jours : le plan du circuit vu de dessus, le biome, le rythme, le temps
// du pilote et de l'auteur, et les motifs repérés (« boost → longue ligne droite → virage serré », suites de trois éléments partagées avec la veille) ; un interrupteur
// passe de la version actuelle du générateur (la dernière moins un) à la nouvelle. Les circuits se calculent sur le fil principal, un par un entre deux images.
// Outil interne en français, exempté du test des chaînes en dur (`packages/ui/test/applications.ts`).
import { GENERATOR_VERSION, formatDay, type Element } from "@cdj/sim";
import { MOTIF_BOOST_SERRE, carteDuJour, type CarteGalerie, type CellulePlan } from "./galerieLogique";
// La feuille par son adresse (pas `import "./galerie.css"`) : le chargeur du premier chargement n'a pas à la connaître (budget de Track, quelques dizaines d'octets).
import feuille from "./galerie.css?url";

/** Ce que la galerie montre aux essais et aux captures (`window.__galerie`). */
interface EtatGalerie {
  version: number;
  prets: Record<number, number>;
  total: number;
  cartes: Record<number, Omit<CarteGalerie, "plan" | "suites">[]>;
}

/** Couleur (jeton de la charte) de chaque élément du plan. */
const COULEUR: Record<Element | "depart" | "arrivee", string> = {
  depart: "--dj-encre",
  arrivee: "--dj-encre",
  droite: "--track-route",
  longue: "--track-route",
  boost: "--dj-moutarde",
  serré: "--dj-terre",
  large: "--track-texte-doux",
  ample: "--dj-diamant",
  relevé: "--dj-bronze",
  montée: "--dj-argent",
  descente: "--dj-argent",
  saut: "--dj-ambre",
  cuve: "--track-livree",
  bosse: "--dj-argent",
  coupé: "--dj-encre-douce",
};

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, classe?: string, texte?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texte !== undefined) e.textContent = texte;
  return e;
};
const secondes = (ms: number) => `${(ms / 1000).toFixed(2)} s`;
const prochaineImage = () => new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)));

/** Le plan du circuit vu de dessus, cellule par cellule ; le motif cerclé. */
function dessiner(canvas: HTMLCanvasElement, plan: readonly CellulePlan[]): void {
  const ctx = canvas.getContext("2d");
  if (!ctx || plan.length === 0) return;
  const style = getComputedStyle(document.documentElement);
  const couleur = (jeton: string) => style.getPropertyValue(jeton).trim() || style.getPropertyValue("--dj-encre").trim();
  const xs = plan.map((c) => c.x);
  const zs = plan.map((c) => c.z);
  const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
  const taille = Math.min((canvas.width - 8) / (x1 - x0 + 1), (canvas.height - 8) / (z1 - z0 + 1));
  const ox = (canvas.width - taille * (x1 - x0 + 1)) / 2;
  const oz = (canvas.height - taille * (z1 - z0 + 1)) / 2;
  ctx.fillStyle = couleur("--track-piste");
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const c of plan) {
    const px = ox + (x1 - c.x) * taille;
    const pz = oz + (c.z - z0) * taille;
    ctx.fillStyle = couleur(COULEUR[c.element]);
    ctx.fillRect(px + 1, pz + 1, taille - 2, taille - 2);
    if (c.motif) {
      ctx.strokeStyle = couleur("--dj-terre");
      ctx.lineWidth = 2;
      ctx.strokeRect(px, pz, taille, taille);
    }
  }
}

function carte(c: CarteGalerie): HTMLElement {
  const art = el("article", c.motif > 0 ? "gal-carte gal-motif" : "gal-carte");
  const canvas = el("canvas", "gal-plan");
  canvas.width = 320;
  canvas.height = 200;
  art.append(canvas);
  dessiner(canvas, c.plan);
  art.append(el("h2", "gal-date", c.date));
  const dl = el("dl", "gal-infos");
  const ligne = (k: string, v: string) => dl.append(el("dt", undefined, k), el("dd", undefined, v));
  ligne("Biome", c.biome);
  ligne("Rythme", c.rythme === "aerien" ? "aérien" : (c.rythme ?? "— (pas de rythme avant la v21)"));
  ligne("Temps du pilote", secondes(c.pilotMs));
  ligne("Temps de l'auteur", secondes(c.auteurMs));
  ligne(`« ${MOTIF_BOOST_SERRE} »`, c.motif === 0 ? "aucun" : `${c.motif} fois`);
  ligne("Suites partagées avec la veille", c.communsVeille.length === 0 ? "aucune" : c.communsVeille.join(" ; "));
  if (c.secours) ligne("Attention", "circuit de secours (aucune tentative valide)");
  art.append(dl);
  if (c.version === GENERATOR_VERSION) {
    const a = el("a", "gal-lien", "Courir ce circuit");
    a.href = `?seed=${c.date}`;
    art.append(a);
  }
  return art;
}

/**
 * Monte la galerie à la place de la page : `?galerie=30` circuits (30 par défaut, 60 au plus) à partir d'aujourd'hui (le jour de Paris : `parisDay`, que le jeu prête — l'importer
 * d'ici ferait sortir `@cdj/clock` du morceau principal).
 */
export async function lancerGalerie(params: URLSearchParams, parisDay: (ms: number) => number, racine: HTMLElement = document.body): Promise<void> {
  const n = Math.max(1, Math.min(60, Math.round(Number(params.get("galerie"))) || 30));
  const depuis = parisDay(Date.now());
  const versions = [GENERATOR_VERSION - 1, GENERATOR_VERSION];
  const lien = document.createElement("link");
  lien.rel = "stylesheet";
  lien.href = feuille;
  document.head.append(lien);
  racine.replaceChildren();
  racine.classList.add("gal-page");
  const tete = el("header", "gal-tete");
  tete.append(el("h1", undefined, `Galerie des circuits · ${n} jours à partir du ${formatDay(depuis)}`));
  const choix = el("div", "gal-choix");
  choix.setAttribute("role", "group");
  choix.setAttribute("aria-label", "Version du générateur");
  const boutons = versions.map((v, i) => {
    const b = el("button", "gal-bouton", `${i === 0 ? "Version actuelle" : "Nouvelle version"} (v${v})`);
    b.type = "button";
    b.dataset.version = String(v);
    choix.append(b);
    return b;
  });
  const etatTexte = el("p", "gal-etat");
  etatTexte.setAttribute("aria-live", "polite");
  tete.append(choix, etatTexte, el("p", "gal-legende", "Plan : jaune = plaque ou super turbo, rouge = virage serré, clair = virage large, bleu = virage ample, bronze = relevé, gris = pente, ambre = saut, orange = cuve ; cadre rouge = le motif « boost → longue ligne droite → virage serré »."));
  const grille = el("main", "gal-grille");
  racine.append(tete, grille);

  const etat: EtatGalerie = { version: GENERATOR_VERSION, prets: {}, total: n, cartes: {} };
  (window as unknown as { __galerie: EtatGalerie }).__galerie = etat;
  const calculees = new Map<number, CarteGalerie[]>();
  let affichee = GENERATOR_VERSION;
  let tour = 0;

  const montrer = async (v: number) => {
    affichee = v;
    etat.version = v;
    const moi = ++tour;
    for (const b of boutons) b.setAttribute("aria-pressed", String(Number(b.dataset.version) === v));
    grille.replaceChildren();
    const liste = calculees.get(v) ?? [];
    calculees.set(v, liste);
    for (const c of liste) grille.append(carte(c));
    for (let i = liste.length; i < n; i++) {
      etatTexte.textContent = `v${v} : ${i} / ${n} circuits…`;
      await prochaineImage();
      if (moi !== tour) return; // l'interrupteur a changé de version : celle-ci reprendra où elle en était
      const c = carteDuJour(depuis + i, v, liste[i - 1] ?? null);
      liste.push(c);
      etat.prets[v] = liste.length;
      (etat.cartes[v] ??= []).push({ ...c, plan: undefined, suites: undefined } as unknown as Omit<CarteGalerie, "plan" | "suites">);
      if (affichee === v) grille.append(carte(c));
    }
    const avec = liste.filter((c) => c.motif > 0).length;
    const suite = liste.filter((c, i) => i > 0 && c.motif > 0 && liste[i - 1]!.motif > 0).length;
    etatTexte.textContent = `v${v} : ${n} circuits — « ${MOTIF_BOOST_SERRE} » dans ${avec}, deux jours de suite : ${suite}.`;
  };
  for (const b of boutons) b.addEventListener("click", () => void montrer(Number(b.dataset.version)));
  await montrer(GENERATOR_VERSION);
}
