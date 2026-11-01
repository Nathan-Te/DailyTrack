import { el } from "@cdj/ui";
import { fNombre, fTicks, lier, t } from "./i18n";
import "./course.css";

// La course du n° 1 (lot 31) — **l'habillage de la barre du carnage** (`#carnage`, maquette `jump-carnage.html`) quand elle lit l'essai du premier du classement : le même lecteur
// (`Carnage` avec le héros seul : `main.ts`, `startCarnage`), ses boutons pause et fermer, sa barre d'avancement ; ici le pseudo, le chrono et le compteur de morts à la place du titre
// et de la vague, la vitesse ×1 / ×2, et « Retour au classement » à la place de « Fermer ». **Module chargé à la demande** (au premier « Voir la course du n° 1 ») : rien de plus au premier
// chargement. DOM seulement ; la simulation et le rendu ne savent rien de cette barre.

export interface CourseVue {
  /** Chrono du héros (pas) et durée de son essai (pas). */
  ticks: number;
  total: number;
  /** Morts du héros depuis le début de la lecture. */
  morts: number;
  paused: boolean;
  speed: 1 | 2;
}

export interface CourseUi {
  update(v: CourseVue): void;
  /** Rend la barre du carnage à ce qu'elle était (titre, boutons, aide). */
  hide(): void;
}

export interface CourseOptions {
  nom: string;
  /** L'action d'une touche selon les commandes du joueur (`commandes.actionDeTouche`, lot M2) : jamais une touche en dur. Échap (fixe) quitte, l'action `pause` met en pause. */
  actionDeTouche(code: string): string | null;
  onToggle(): void;
  onSpeed(): void;
  onQuit(): void;
}

export function montrerCourse(o: CourseOptions): CourseUi {
  const racine = document.getElementById("carnage")!;
  const titre = racine.querySelector<HTMLElement>(".carnage__titre")!;
  const compte = racine.querySelector<HTMLElement>(".carnage__tete .count")!;
  const vague = racine.querySelector<HTMLElement>(".carnage__vague")!;
  const legende = vague.querySelector<HTMLElement>(".legende")!;
  const valeur = vague.querySelector<HTMLElement>(".carnage__vague-valeur")!;
  const avance = racine.querySelector<HTMLElement>(".carnage__avancement")!;
  const plein = racine.querySelector<HTMLElement>(".carnage__avancement-plein")!;
  const aide = racine.querySelector<HTMLElement>(".carnage__aide")!;
  const pause = racine.querySelector<HTMLButtonElement>("#carnage-pause")!;
  const quitter = racine.querySelector<HTMLButtonElement>("#carnage-close")!;
  const precedente = racine.querySelector<HTMLElement>("#carnage-prev")!;
  const suivante = racine.querySelector<HTMLElement>("#carnage-next")!;

  const vitesse = el("button", { classe: ["carnage__bouton", "carnage__bouton--vitesse"], attrs: { type: "button", id: "course-vitesse", "aria-pressed": "false" } });
  vitesse.addEventListener("click", () => {
    vitesse.blur();
    o.onSpeed();
  });
  vitesse.addEventListener("pointerdown", (e) => e.stopPropagation());
  pause.after(vitesse);

  // Un titre, une aide et un bouton de sortie propres à la course ; `lier` les garde dans la langue choisie.
  lier(titre, "course.titre");
  lier(legende, "course.chrono");
  lier(aide, "aide.course");
  lier(quitter, "course.quitter");
  precedente.hidden = true;
  suivante.hidden = true;
  racine.classList.add("course");
  racine.hidden = false;
  document.body.classList.add("carnage");

  const touche = (e: KeyboardEvent) => {
    const a = e.code === "Escape" ? "quitter" : o.actionDeTouche(e.code) === "pause" ? "pause" : null;
    if (!a) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.repeat) return;
    if (a === "pause") o.onToggle();
    else o.onQuit();
  };
  window.addEventListener("keydown", touche, { capture: true });

  let dernier = "";
  let seconde = -1;
  const self: CourseUi = {
    update(v) {
      const morts = t("course.morts", { n: v.morts, total: fNombre(v.morts) });
      const joueur = t("course.joueur", { nom: o.nom, morts });
      if (joueur !== dernier) {
        dernier = joueur;
        compte.textContent = joueur;
      }
      const temps = fTicks(v.ticks);
      if (valeur.textContent !== temps) valeur.textContent = temps;
      // Le nom accessible du chrono suit la seconde, pas chaque pas (un lecteur d'écran ne doit pas être inondé).
      const s = Math.floor(v.ticks / 120);
      if (s !== seconde || v.paused) {
        seconde = s;
        vague.setAttribute("aria-label", t("course.chronoAria", { nom: o.nom, temps, morts }));
      }
      const pc = Math.min(100, Math.round((100 * v.ticks) / Math.max(1, v.total)));
      plein.style.width = `${pc}%`;
      avance.setAttribute("aria-label", t("course.avancement", { pc }));
      const etat = v.paused ? "lecture" : "pause";
      if (pause.dataset.etat !== etat) {
        pause.dataset.etat = etat;
        pause.setAttribute("aria-pressed", v.paused ? "true" : "false");
        lier(pause, v.paused ? "carnage.lecture" : "carnage.pause", undefined, "aria-label");
      }
      const x = String(v.speed);
      if (vitesse.dataset.x !== x) {
        vitesse.dataset.x = x;
        vitesse.textContent = `×${x}`;
        vitesse.setAttribute("aria-pressed", v.speed === 2 ? "true" : "false");
        lier(vitesse, "course.vitesse", { x }, "aria-label");
      }
    },
    hide() {
      window.removeEventListener("keydown", touche, { capture: true });
      vitesse.remove();
      racine.classList.remove("course");
      precedente.hidden = false;
      suivante.hidden = false;
      lier(titre, "carnage.titre");
      lier(legende, "carnage.vague");
      lier(aide, "carnage.aide");
      lier(quitter, "carnage.fermer");
      compte.textContent = "";
      valeur.textContent = "";
      plein.style.width = "0";
    },
  };
  return self;
}
