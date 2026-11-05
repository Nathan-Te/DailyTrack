import { COEURS } from "@cdj/rush-sim";
import type { Controles } from "./controles";

// L'interface de la partie, posée sur la scène 3D : les cœurs, la barre de vie du golem, le joystick et les deux boutons des doigts. **Aucun texte écrit ici** : le traducteur de la partie (`OptionsPartie.t`) les donne.
// Charte (révision 17) : joystick virtuel à gauche, « Coup » et « Esquive » en boutons à droite, aux bords, marges de sécurité de l'iPhone ; le centre de l'écran reste libre.

type Traduire = (cle: string, params?: Readonly<Record<string, string | number>>) => string;

const NS = "http://www.w3.org/2000/svg";
function svg(chemin: string, classe: string): SVGSVGElement {
  const s = document.createElementNS(NS, "svg");
  s.setAttribute("viewBox", "0 0 24 24");
  s.setAttribute("aria-hidden", "true");
  s.setAttribute("class", classe);
  const p = document.createElementNS(NS, "path");
  p.setAttribute("d", chemin);
  s.append(p);
  return s;
}
const CHEMIN_COEUR = "M12 21 C5 15 2.5 11.5 2.5 8 C2.5 5 4.8 3 7.4 3 C9.3 3 11 4 12 5.8 C13 4 14.7 3 16.6 3 C19.2 3 21.5 5 21.5 8 C21.5 11.5 19 15 12 21 Z";
// Une épée en diagonale (la lame, la garde, la poignée) et un coureur (la tête, le buste penché, les bras et les jambes en foulée) : des traits, comme tous les pictogrammes du jeu.
const CHEMIN_EPEE = "M20 4 L20.4 9.6 L12 18 L6 12 L14.4 3.6 Z M5 19 L9 15 M3 21 L6 18";
const CHEMIN_ESQUIVE = "M15.4 4.4 A1.7 1.7 0 1 1 15.39 4.4 M13.6 8.2 L11.4 13 M13.6 8.2 L17.6 10.6 M13 9 L8.6 10.4 M11.4 13 L15 15.6 L13.4 20.4 M11.4 13 L8 16.6 L4.4 15.6";

export interface Interface {
  racine: HTMLElement;
  zone3d: HTMLElement;
  coeurs(n: number): void;
  boss(fraction: number | null, phase: number): void;
  degats(): void;
  fps(texte: string): void;
  detruire(): void;
}

function bouton(classe: string, chemin: string, libelle: string, quand: (tenu: boolean) => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `rush-bouton ${classe}`;
  b.setAttribute("aria-label", libelle);
  // Un pictogramme et son nom dessous (la cible : « Coup » et « Esquive » côte à côte, chacun avec son icône).
  const nom = document.createElement("span");
  nom.className = "rush-bouton__nom";
  nom.textContent = libelle;
  nom.setAttribute("aria-hidden", "true");
  b.append(svg(chemin, "rush-bouton__icone"), nom);
  const tenir = (e: PointerEvent): void => {
    e.preventDefault();
    try {
      b.setPointerCapture(e.pointerId);
    } catch {
      /* idem */
    }
    b.dataset.tenu = "1";
    quand(true);
  };
  const lacher = (): void => {
    delete b.dataset.tenu;
    quand(false);
  };
  b.addEventListener("pointerdown", tenir);
  for (const n of ["pointerup", "pointercancel", "lostpointercapture"] as const) b.addEventListener(n, lacher);
  b.addEventListener("contextmenu", (e) => e.preventDefault());
  return b;
}

export function monterInterface(hote: HTMLElement, t: Traduire, tactile: boolean, controles: Controles, libelleScene: string): Interface {
  const racine = document.createElement("div");
  racine.className = "rush-monde";
  const zone3d = document.createElement("div");
  zone3d.className = "rush-monde__scene";
  zone3d.setAttribute("role", "img");
  zone3d.setAttribute("aria-label", libelleScene);
  const hud = document.createElement("div");
  hud.className = "rush-hud";
  // Les cœurs.
  const bloc = document.createElement("div");
  bloc.className = "rush-coeurs";
  bloc.setAttribute("role", "img");
  const coeurs = Array.from({ length: COEURS }, () => {
    const c = svg(CHEMIN_COEUR, "rush-coeur");
    bloc.append(c);
    return c;
  });
  // La barre de vie du golem.
  const boss = document.createElement("div");
  boss.className = "rush-boss";
  boss.hidden = true;
  const nom = document.createElement("span");
  nom.className = "rush-boss__nom";
  nom.textContent = t("golem.nom");
  const phase = document.createElement("span");
  phase.className = "rush-boss__phase";
  phase.textContent = t("hud.phase", { n: 1 });
  const piste = document.createElement("div");
  piste.className = "rush-boss__piste";
  piste.setAttribute("role", "progressbar");
  piste.setAttribute("aria-valuemin", "0");
  piste.setAttribute("aria-valuemax", "100");
  piste.setAttribute("aria-label", t("golem.nom"));
  const vie = document.createElement("div");
  vie.className = "rush-boss__vie";
  const marque = document.createElement("div");
  marque.className = "rush-boss__moitie";
  piste.append(vie, marque);
  boss.append(nom, piste, phase);
  const vignette = document.createElement("div");
  vignette.className = "rush-vignette";
  const fps = document.createElement("div");
  fps.className = "rush-fps";
  fps.hidden = true;
  hud.append(bloc, boss, vignette, fps);
  racine.append(zone3d, hud);
  // Les doigts.
  let tactileRacine: HTMLElement | null = null;
  if (tactile) {
    tactileRacine = document.createElement("div");
    tactileRacine.className = "rush-tactile";
    const zone = document.createElement("div");
    zone.className = "rush-stick";
    zone.setAttribute("role", "group");
    zone.setAttribute("aria-label", t("tactile.stick"));
    const base = document.createElement("div");
    base.className = "rush-stick__base";
    const pouce = document.createElement("div");
    pouce.className = "rush-stick__pouce";
    base.append(pouce);
    zone.append(base);
    let actif: number | null = null;
    const bouger = (e: PointerEvent): void => {
      const r = base.getBoundingClientRect();
      const rayon = r.width / 2;
      let x = (e.clientX - (r.left + rayon)) / rayon;
      let y = (e.clientY - (r.top + rayon)) / rayon;
      const n = Math.hypot(x, y);
      if (n > 1) {
        x /= n;
        y /= n;
      }
      controles.stick = { x, y };
      pouce.style.transform = `translate(${x * rayon * 0.62}px, ${y * rayon * 0.62}px)`;
    };
    zone.addEventListener("pointerdown", (e) => {
      if (actif !== null) return;
      e.preventDefault();
      actif = e.pointerId;
      try {
        zone.setPointerCapture(e.pointerId);
      } catch {
        /* un appui qui n'existe plus : le geste se lit quand même */
      }
      bouger(e);
    });
    zone.addEventListener("pointermove", (e) => {
      if (e.pointerId === actif) bouger(e);
    });
    const fin = (e: PointerEvent): void => {
      if (e.pointerId !== actif) return;
      actif = null;
      controles.stick = { x: 0, y: 0 };
      pouce.style.transform = "";
    };
    for (const n of ["pointerup", "pointercancel"] as const) zone.addEventListener(n, fin);
    zone.addEventListener("contextmenu", (e) => e.preventDefault());
    const droite = document.createElement("div");
    droite.className = "rush-actions";
    droite.append(
      bouton("rush-bouton--esquive", CHEMIN_ESQUIVE, t("commandes.action.esquive"), (v) => {
        controles.boutonEsquive = v;
        if (v) controles.action("esquive");
      }),
      bouton("rush-bouton--coup", CHEMIN_EPEE, t("commandes.action.coup"), (v) => {
        controles.boutonCoup = v;
        if (v) controles.action("coup");
      }),
    );
    tactileRacine.append(zone, droite);
    racine.append(tactileRacine);
  }
  hote.append(racine);

  let derniersCoeurs = -1;
  return {
    racine,
    zone3d,
    coeurs(n) {
      if (n === derniersCoeurs) return;
      derniersCoeurs = n;
      coeurs.forEach((c, i) => c.classList.toggle("rush-coeur--vide", i >= n));
      bloc.setAttribute("aria-label", t("hud.coeurs", { n, total: COEURS }));
    },
    boss(fraction, numero) {
      if (fraction === null) {
        boss.hidden = true;
        return;
      }
      boss.hidden = false;
      if (boss.dataset.phase !== String(numero)) {
        boss.dataset.phase = String(numero);
        phase.textContent = t("hud.phase", { n: numero });
      }
      vie.style.transform = `scaleX(${Math.max(0, Math.min(1, fraction))})`;
      piste.setAttribute("aria-valuenow", String(Math.round(fraction * 100)));
    },
    degats() {
      vignette.classList.remove("rush-vignette--coup");
      void vignette.offsetWidth;
      vignette.classList.add("rush-vignette--coup");
    },
    fps(texte) {
      fps.hidden = false;
      fps.textContent = texte;
    },
    detruire() {
      racine.remove();
    },
  };
}
