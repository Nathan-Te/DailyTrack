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

/** Lot BR2 : une carte du choix d'amélioration, déjà écrite (les textes viennent du catalogue) : son identifiant, son nom, son effet en une ligne, son palier (« 2 / 3 »), le tracé de son icône et sa famille (la couleur de l'icône). */
export interface CarteVue {
  id: string;
  nom: string;
  effet: string;
  palier: string;
  icone: string;
  famille: string;
}

export interface Interface {
  racine: HTMLElement;
  zone3d: HTMLElement;
  /** Les cœurs : `n` pleins sur `max` (3, et « Cœur en plus »). */
  coeurs(n: number, max?: number): void;
  /** Lot BR2 : la pastille « Nv 4 » et sa barre d'XP (`xp` points dans le niveau sur `total`). */
  niveau(nv: number | null, xp: number, total: number): void;
  /** Lot BR2 : le voile à rayures et les trois cartes ; `choisir(i)` est appelé au toucher / clic d'une carte. */
  ouvrirChoix(nv: number, cartes: readonly CarteVue[], choisir: (i: number) => void): void;
  fermerChoix(): void;
  /** La carte en surbrillance (clavier, manette), 0 à 2. */
  selection(i: number): void;
  choixOuvert(): boolean;
  boss(fraction: number | null, phase: number): void;
  /** Lot BR1 : la pastille « BOSS → 38 m » (la flèche tourne vers l'arène, `angle` en radians sur l'écran, 0 : vers la droite, π/2 : vers le bas) ; `null` : cachée. */
  cible(metres: number | null, angle?: number): void;
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
  // Les cœurs (lot BR2 : « Cœur en plus » en ajoute).
  const bloc = document.createElement("div");
  bloc.className = "rush-coeurs";
  bloc.setAttribute("role", "img");
  const coeurs: SVGSVGElement[] = [];
  const garnir = (max: number): void => {
    while (coeurs.length < max) {
      const c = svg(CHEMIN_COEUR, "rush-coeur");
      bloc.append(c);
      coeurs.push(c);
    }
  };
  garnir(COEURS);
  // Lot BR2 : le niveau et la barre d'XP, sous les cœurs.
  const pastille = document.createElement("div");
  pastille.className = "rush-niveau";
  const nvTexte = document.createElement("span");
  nvTexte.className = "rush-niveau__nv";
  const piste2 = document.createElement("div");
  piste2.className = "rush-niveau__piste";
  piste2.setAttribute("role", "progressbar");
  piste2.setAttribute("aria-valuemin", "0");
  const xpBarre = document.createElement("div");
  xpBarre.className = "rush-niveau__xp";
  piste2.append(xpBarre);
  pastille.append(nvTexte, piste2);
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
  // La pastille de l'arène (lot BR1) : une flèche qui tourne et la distance.
  const cible = document.createElement("div");
  cible.className = "rush-cible";
  cible.hidden = true;
  const fleche = svg("M3 12 L19 12 M13 5 L20 12 L13 19", "rush-cible__fleche");
  const distanceTexte = document.createElement("span");
  distanceTexte.className = "rush-cible__texte";
  cible.append(fleche, distanceTexte);
  const vignette = document.createElement("div");
  vignette.className = "rush-vignette";
  const fps = document.createElement("div");
  fps.className = "rush-fps";
  fps.hidden = true;
  hud.append(bloc, pastille, boss, cible, vignette, fps);
  racine.append(zone3d, hud);
  // Lot BR2 : le choix d'une amélioration — un voile à rayures, un titre, trois cartes (des boutons : le doigt, la souris, le clavier et la manette les atteignent), une ligne d'aide.
  const choix = document.createElement("div");
  choix.className = "rush-choix";
  choix.hidden = true;
  choix.setAttribute("role", "group"); // pas « dialog » : le kit laisse alors les touches du jeu agir sur les cartes
  const choixTitre = document.createElement("h2");
  choixTitre.className = "rush-choix__titre";
  const choixRang = document.createElement("div");
  choixRang.className = "rush-choix__cartes";
  const choixAide = document.createElement("p");
  choixAide.className = "rush-choix__aide";
  choixAide.textContent = t("choix.aide");
  choix.append(choixTitre, choixRang, choixAide);
  racine.append(choix);
  let boutonsCartes: HTMLButtonElement[] = [];
  let ouvert = false;
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

  const selectionner = (i: number): void => boutonsCartes.forEach((b, k) => b.classList.toggle("rush-option--sel", k === i));
  let derniersCoeurs = -1;
  let dernierMax = COEURS;
  let dernierNiveau = "";
  return {
    racine,
    zone3d,
    coeurs(n, max = COEURS) {
      if (n === derniersCoeurs && max === dernierMax) return;
      derniersCoeurs = n;
      dernierMax = max;
      garnir(max);
      coeurs.forEach((c, i) => c.classList.toggle("rush-coeur--vide", i >= n));
      bloc.setAttribute("aria-label", t("hud.coeurs", { n, total: max }));
    },
    niveau(nv, xp, total) {
      pastille.hidden = nv === null; // les scénarios d'essai sans niveau du jour n'ont pas d'XP
      if (nv === null) return;
      const cle = `${nv}|${xp}|${total}`;
      if (cle === dernierNiveau) return;
      dernierNiveau = cle;
      nvTexte.textContent = t("hud.niveau", { n: nv });
      xpBarre.style.transform = `scaleX(${Math.max(0, Math.min(1, xp / Math.max(1, total)))})`;
      piste2.setAttribute("aria-valuemax", String(total));
      piste2.setAttribute("aria-valuenow", String(xp));
      piste2.setAttribute("aria-label", t("hud.xp", { n: xp, total }));
    },
    ouvrirChoix(nv, cartes, choisir) {
      choixTitre.textContent = t("choix.titre", { n: nv });
      choix.setAttribute("aria-label", t("choix.aria", { n: nv }));
      choixRang.replaceChildren();
      boutonsCartes = cartes.map((c, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.tabIndex = -1;
        b.className = "rush-option";
        b.dataset.famille = c.famille;
        b.dataset.carte = c.id;
        const touche = document.createElement("span");
        touche.className = "rush-option__touche";
        touche.textContent = String(i + 1);
        touche.setAttribute("aria-hidden", "true");
        const ico = document.createElement("span");
        ico.className = "rush-option__icone";
        ico.append(svg(c.icone, "rush-option__dessin"));
        const nom = document.createElement("b");
        nom.className = "rush-option__nom";
        nom.textContent = c.nom;
        const effet = document.createElement("span");
        effet.className = "rush-option__effet";
        effet.textContent = c.effet;
        const palier = document.createElement("span");
        palier.className = "rush-option__palier";
        palier.textContent = c.palier;
        b.append(touche, ico, nom, effet, palier);
        // Un toucher / un clic choisit ; le focus ne reste pas sur la carte (Espace et Entrée sont aux commandes du jeu, pas au bouton).
        b.addEventListener("click", (e) => {
          e.preventDefault();
          choisir(i);
        });
        b.addEventListener("pointerenter", (e) => {
          if (e.pointerType === "mouse") selectionner(i);
        });
        choixRang.append(b);
        return b;
      });
      choix.hidden = false;
      ouvert = true;
      selectionner(0);
    },
    fermerChoix() {
      choix.hidden = true;
      ouvert = false;
      boutonsCartes = [];
      choixRang.replaceChildren();
    },
    selection: selectionner,
    choixOuvert() {
      return ouvert;
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
    cible(metres, angle = 0) {
      if (metres === null) {
        cible.hidden = true;
        return;
      }
      cible.hidden = false;
      const texte = t("hud.bossDistance", { m: metres });
      if (distanceTexte.textContent !== texte) {
        distanceTexte.textContent = texte;
        cible.setAttribute("aria-label", texte);
      }
      fleche.style.transform = `rotate(${angle.toFixed(3)}rad)`;
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
