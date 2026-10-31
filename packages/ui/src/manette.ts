import { CATALOGUE_MANETTE } from "./catalogue.manette";
import {
  BOUTON,
  Repetiteur,
  SuiviBoutons,
  boutonVisiblePourLeJeu,
  directionDe,
  etatDe,
  genreDeManette,
  voisin,
  type Direction,
  type Genre,
  type Rect,
} from "./manetteLogique";
import feuille from "./manette.css?url";

// Lot M1 (plateforme) : **les menus à la manette — la seule logique de toute la plateforme** (portail, Track, Jump, Tower). Un module **à la demande** : il n'est
// chargé qu'à la première manette (`activerManette`, `manetteLien.ts`), donc zéro octet et zéro lecture sans manette. Il n'importe rien du reste du socle (ni `dom`,
// ni `i18n`) : un module à la demande qui importe le premier chargement le fait éclater en fichiers de plus (lot 53).
//
// Quand la manette pilote le menu : un écran ouvert (un `[role=dialog]` visible : l'accueil, la pause, les réglages…) ou, sur une page sans partie (le portail),
// la page elle-même. En partie, le menu n'écoute rien : la manette est celle du jeu (ses commandes, sa pause sur Start).
//  - croix / stick gauche : le focus va à l'élément le plus proche dans la direction (`voisin`), sans sortir du dialogue ; un curseur (`input[type=range]`) se règle ;
//    quand rien n'est plus loin, la direction haut / bas fait défiler l'écran ;
//  - A active ; B revient (ferme l'écran) ; LB / RB changent d'onglet ; Start reste au jeu (la pause) ;
//  - **un appui ne sert jamais deux fois** : tout bouton pressé pendant un menu est « consommé » (`SuiviBoutons`), le jeu le lit levé jusqu'à son relâchement ;
//  - la bande d'aide (bas à droite) n'existe que si la dernière entrée vient d'une manette et qu'un menu est ouvert.
// Chaque écran déclare son action principale (où le focus se pose à son ouverture) et, si besoin, son retour : `OptionsManette.ecrans`, une ligne par écran.

/** Un écran (la racine d'un dialogue, ou `:root` pour la page) : où se pose le focus à son ouverture, et ce que B active. */
export interface EcranManette {
  /** Sélecteur de la racine du dialogue (`#home`, `#pause`…) ; `:root` pour la page entière. */
  ecran: string;
  /** L'action principale : le focus s'y pose à l'ouverture (premier élément visible qui correspond). */
  principal: string;
  /** Ce que B active (premier élément visible qui correspond). Sans retour déclaré, B active la flèche « ‹ » de la barre quand c'est une fermeture. */
  retour?: string;
}

export interface OptionsManette {
  /** Page sans partie (le portail) : sans dialogue ouvert, le menu pilote la page entière. */
  page?: boolean;
  /** Des surimpressions qui ne sont pas des dialogues mais se pilotent comme eux tant qu'elles sont visibles (la barre du carnage de Jump) : sélecteurs. */
  surimpressions?: readonly string[];
  ecrans?: readonly EcranManette[];
}

type Branchement = (filtre: ((pad: Gamepad) => Gamepad) | null) => void;

const FOCALISABLES = 'a[href], button, input, select, textarea, summary, [tabindex], [role="tab"], [role="radio"], [role="slider"]';
const TEXTES_SAISIE = new Set(["text", "search", "email", "url", "tel", "password", "number", ""]);

const visible = (e: Element): boolean => {
  if (!e.isConnected) return false;
  const v = (e as HTMLElement & { checkVisibility?: (o: { visibilityProperty: boolean }) => boolean }).checkVisibility;
  if (typeof v === "function" && !v.call(e, { visibilityProperty: true })) return false;
  return e.getClientRects().length > 0;
};

const focalisable = (e: Element): e is HTMLElement => {
  if (!(e instanceof HTMLElement) || !visible(e)) return false;
  if ((e as HTMLButtonElement).disabled || e.getAttribute("aria-disabled") === "true" || e.closest("[inert]")) return false;
  if (e instanceof HTMLInputElement && e.type === "hidden") return false;
  const role = e.getAttribute("role");
  if (e.tabIndex < 0 && role !== "tab" && role !== "radio") return false; // `tabindex="-1"` : l'écran lui-même, pas une cible
  return true;
};

const rectDe = (e: Element): Rect => {
  const r = e.getBoundingClientRect();
  return { gauche: r.left, haut: r.top, droite: r.right, bas: r.bottom };
};

/** `brancher` : où poser le filtre que les jeux appliquent à la manette qu'ils lisent (absent : Tower, qui ne lit pas la manette en partie). */
export function demarrerManette(options: OptionsManette, brancher?: Branchement): void {
  // La feuille est un fichier du site (jamais de style en ligne) posé par le module : l'`import()` du premier chargement n'a ainsi aucune dépendance à précharger (quelques octets de moins).
  const lien = document.createElement("link");
  lien.rel = "stylesheet";
  lien.href = feuille;
  document.head.append(lien);
  const suivi = new SuiviBoutons();
  const repetiteur = new Repetiteur();
  const racine = document.documentElement;
  let manettes = 0;
  let boucle = 0;
  let genre: Genre = "xbox";
  let entreeManette = false;
  let menuAvant = false;
  let porteeAvant: Element | null = null;
  let bande: HTMLElement | null = null;
  let cleBande = "";

  // --- Où est le menu ---------------------------------------------------------------------------------------------------------------------------

  /** L'écran que pilote la manette : le dialogue du dessus, ou la page ; `null` en partie. */
  const portee = (): HTMLElement | null => {
    const selecteur = ['[role="dialog"]', ...(options.surimpressions ?? [])].join(",");
    const dialogues = [...document.querySelectorAll<HTMLElement>(selecteur)].filter((d) => !d.closest("[aria-hidden='true']") && visible(d));
    if (dialogues.length) {
      for (let i = dialogues.length - 1; i >= 0; i--) {
        const d = dialogues[i]!;
        const r = d.getBoundingClientRect();
        const dessus = document.elementFromPoint(Math.min(Math.max(r.left + r.width / 2, 0), innerWidth - 1), Math.min(Math.max(r.top + r.height / 2, 0), innerHeight - 1));
        if (dessus && d.contains(dessus)) return d;
      }
      return dialogues[dialogues.length - 1]!;
    }
    return options.page ? racine : null;
  };

  const declaration = (p: Element) => options.ecrans?.find((e) => p.matches(e.ecran));
  const premierVisible = (p: Element, selecteur: string | undefined): HTMLElement | null => {
    if (!selecteur) return null;
    // Les sélecteurs listés (séparés par une virgule) sont essayés dans l'ordre : le premier qui a un élément visible l'emporte.
    for (const un of selecteur.split(",")) for (const e of p.querySelectorAll<HTMLElement>(un.trim())) if (focalisable(e)) return e;
    return null;
  };
  const cibles = (p: Element): HTMLElement[] => [...p.querySelectorAll(FOCALISABLES)].filter(focalisable);
  const focusDans = (p: Element): boolean => {
    const a = document.activeElement;
    return !!a && a !== p && a !== document.body && a !== racine && p.contains(a) && visible(a);
  };

  // --- Focus -----------------------------------------------------------------------------------------------------------------------------------

  const poser = (e: HTMLElement) => {
    e.focus({ preventScroll: true });
    e.scrollIntoView({ block: "nearest", inline: "nearest" }); // le défilement suit le focus
  };
  const placerFocus = (p: HTMLElement) => {
    const cible = premierVisible(p, declaration(p)?.principal) ?? cibles(p)[0];
    if (cible) poser(cible);
  };

  const defilable = (depuis: Element | null): Element => {
    for (let e = depuis; e && e !== document.body; e = e.parentElement) {
      const s = getComputedStyle(e);
      if ((s.overflowY === "auto" || s.overflowY === "scroll") && e.scrollHeight > e.clientHeight) return e;
    }
    return document.scrollingElement ?? racine;
  };

  const deplacer = (p: HTMLElement, direction: Direction) => {
    if (!focusDans(p)) return placerFocus(p);
    const courant = document.activeElement as HTMLElement;
    if (courant instanceof HTMLInputElement && courant.type === "range" && (direction === "gauche" || direction === "droite")) {
      if (direction === "gauche") courant.stepDown();
      else courant.stepUp();
      courant.dispatchEvent(new Event("input", { bubbles: true }));
      courant.dispatchEvent(new Event("change", { bubbles: true }));
      // Un écran peut lâcher le focus au `change` (Track : `input.blur()` pour rendre le clavier au jeu) : le curseur réglé à la manette le garde.
      if (courant.isConnected && document.activeElement !== courant) courant.focus({ preventScroll: true });
      return;
    }
    const autres = cibles(p).filter((c) => c !== courant && !courant.contains(c) && !c.contains(courant));
    const i = voisin(rectDe(courant), autres.map(rectDe), direction);
    if (i >= 0) return poser(autres[i]!);
    if (direction === "haut" || direction === "bas") {
      const z = defilable(courant);
      z.scrollBy({ top: (direction === "bas" ? 1 : -1) * Math.max(80, z.clientHeight * 0.6) });
    }
  };

  // --- Boutons ---------------------------------------------------------------------------------------------------------------------------------

  const valider = (p: HTMLElement) => {
    if (!focusDans(p)) return placerFocus(p);
    const e = document.activeElement as HTMLElement;
    if (e instanceof HTMLTextAreaElement || (e instanceof HTMLInputElement && TEXTES_SAISIE.has(e.type))) {
      // Un champ de texte : A ouvre la saisie (le clavier virtuel du système, quand il existe ; sinon on tape au clavier). Aucun clavier n'est dessiné ici.
      e.focus();
      e.select?.();
      return;
    }
    if (e instanceof HTMLSelectElement) {
      const choix = e as HTMLSelectElement & { showPicker?: () => void };
      if (typeof choix.showPicker === "function") choix.showPicker();
      else e.click();
      return;
    }
    e.click();
  };

  const retour = (p: HTMLElement) => {
    const declare = premierVisible(p, declaration(p)?.retour);
    if (declare) return declare.click();
    // Par défaut : la flèche « ‹ » de la barre quand elle ferme l'écran ; sur une page (pas un dialogue), aussi celle qui mène au portail.
    const fleche = premierVisible(p, p === racine ? ".dj-barre-jeu__retour" : "button.dj-barre-jeu__retour");
    fleche?.click();
  };

  const listeOnglets = (p: HTMLElement): HTMLElement[] => {
    const barres = [...p.querySelectorAll<HTMLElement>('[role="tablist"]')].filter(visible);
    const barre = barres.find((b) => document.activeElement && b.contains(document.activeElement)) ?? barres[0];
    return barre ? [...barre.querySelectorAll<HTMLElement>('[role="tab"]')].filter(visible) : [];
  };
  const onglet = (p: HTMLElement, delta: number) => {
    const tous = listeOnglets(p);
    if (tous.length < 2) return;
    const i = tous.findIndex((t) => t.getAttribute("aria-selected") === "true");
    const suivant = tous[(i < 0 ? 0 : i) + delta];
    if (!suivant) return;
    const avait = tous.some((t) => t === document.activeElement);
    suivant.click();
    // L'écran peut redessiner ses onglets : le focus suit l'onglet choisi s'il était sur les onglets.
    setTimeout(() => {
      if (!avait && document.activeElement && document.activeElement !== document.body) return;
      const choisi = p.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
      if (choisi && focalisable(choisi)) choisi.focus({ preventScroll: true });
    }, 0);
  };

  // --- Entrée et bande d'aide ------------------------------------------------------------------------------------------------------------------

  const noterEntree = (manette: boolean) => {
    if (manette === entreeManette) return;
    entreeManette = manette;
    racine.dataset.entree = manette ? "manette" : "autre";
  };

  const textes = () => CATALOGUE_MANETTE[racine.lang.toLowerCase().startsWith("en") ? "en" : "fr"];
  const touche = (classe: string, contenu: string | SVGElement): HTMLElement => {
    const s = document.createElement("span");
    s.className = `dj-manette-aide__touche ${classe}`;
    if (typeof contenu === "string") s.textContent = contenu;
    else s.append(contenu);
    return s;
  };
  const symbole = (rond: boolean): SVGElement => {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 12 12");
    svg.setAttribute("width", "12");
    svg.setAttribute("height", "12");
    svg.setAttribute("aria-hidden", "true");
    const trace = document.createElementNS(ns, rond ? "circle" : "path");
    if (rond) {
      trace.setAttribute("cx", "6");
      trace.setAttribute("cy", "6");
      trace.setAttribute("r", "4");
    } else trace.setAttribute("d", "M2 2l8 8M10 2l-8 8");
    trace.setAttribute("fill", "none");
    trace.setAttribute("stroke", "currentColor");
    trace.setAttribute("stroke-width", "2");
    svg.append(trace);
    return svg;
  };

  const majBande = (p: HTMLElement | null) => {
    const montrer = entreeManette && p !== null;
    if (!montrer) {
      if (bande) bande.hidden = true;
      return;
    }
    const onglets = listeOnglets(p).length > 1;
    const t = textes();
    const cle = `${racine.lang}|${genre}|${onglets}`;
    if (!bande) {
      bande = document.createElement("div");
      bande.className = "dj-manette-aide dj-sombre";
      bande.setAttribute("role", "note");
      document.body.append(bande);
    }
    if (cle !== cleBande) {
      cleBande = cle;
      const ps = genre === "playstation";
      const groupe = (touches: HTMLElement[], texte: string) => {
        const g = document.createElement("span");
        g.className = "dj-manette-aide__groupe";
        const l = document.createElement("span");
        l.textContent = texte;
        g.append(...touches, l);
        return g;
      };
      const sep = () => {
        const s = document.createElement("span");
        s.className = "dj-manette-aide__sep";
        s.setAttribute("aria-hidden", "true");
        s.textContent = "·";
        return s;
      };
      const parties = [
        groupe([touche("dj-manette-aide__rond", ps ? symbole(false) : "A")], t["manette.valider"]),
        groupe([touche("dj-manette-aide__rond", ps ? symbole(true) : "B")], t["manette.retour"]),
      ];
      if (onglets) parties.push(groupe([touche("dj-manette-aide__pilule", ps ? "L1" : "LB"), touche("dj-manette-aide__pilule", ps ? "R1" : "RB")], t["manette.onglets"]));
      bande.replaceChildren(...parties.flatMap((x, i) => (i ? [sep(), x] : [x])));
      bande.setAttribute("aria-label", onglets ? t["manette.aide.aria"] : t["manette.aide.aria.sans"]);
    }
    bande.hidden = false;
  };

  // --- Un pas de lecture -----------------------------------------------------------------------------------------------------------------------

  const tick = (pad: Gamepad, maintenant: number): void => {
    genre = genreDeManette(pad.id);
    const etat = etatDe(pad);
    const presses = suivi.mettreAJour(etat.boutons);
    // Lot M2 : l'écran des commandes attend un bouton à choisir : le menu n'écoute rien (ni B qui revient, ni A qui valide) et le jeu ne le lira pas non plus.
    if (racine.dataset.capture === "commande") {
      etat.boutons.forEach((e, i) => e && i !== BOUTON.START && suivi.consommer(i));
      return;
    }
    const direction = directionDe(etat);
    const actif = presses.length > 0 || direction !== null;
    const premiere = actif && !entreeManette;
    if (actif) noterEntree(true);

    const p = portee();
    const menu = p !== null;
    if (menu && !menuAvant) repetiteur.ignorer(direction); // une direction déjà tenue à l'ouverture n'est pas un appui du menu
    menuAvant = menu;
    if (!p) {
      repetiteur.pas(null, maintenant);
      porteeAvant = null;
      majBande(null);
      return;
    }

    // Tout ce qui est tenu pendant un menu est « consommé » : le jeu le lira levé jusqu'à son relâchement (sauf Start, la pause, qui reste au jeu).
    etat.boutons.forEach((e, i) => e && i !== BOUTON.START && suivi.consommer(i));

    // L'écran vient de s'ouvrir (ou la première entrée vient de la manette) : le focus se pose sur l'action principale ; ce premier appui ne fait que cela.
    const changee = p !== porteeAvant;
    porteeAvant = p;
    if ((changee || premiere) && entreeManette && !focusDans(p)) {
      placerFocus(p);
      majBande(p);
      return;
    }

    for (const b of presses) {
      if (b === BOUTON.A) valider(p);
      else if (b === BOUTON.B) retour(p);
      else if (b === BOUTON.LB) onglet(p, -1);
      else if (b === BOUTON.RB) onglet(p, 1);
    }
    const pas = repetiteur.pas(direction, maintenant);
    if (pas) deplacer(p, pas);
    majBande(p);
  };

  // --- Lecture : seulement une manette branchée, seulement page visible ------------------------------------------------------------------------

  const trouver = (): Gamepad | null => {
    const liste = navigator.getGamepads?.();
    if (!liste) return null;
    for (const p of liste) if (p && p.connected && p.mapping === "standard") return p;
    return null;
  };
  const lire = (t: number) => {
    boucle = 0;
    if (manettes <= 0 || document.hidden) return;
    const pad = trouver();
    if (pad) tick(pad, t);
    boucle = requestAnimationFrame(lire);
  };
  const demarrerBoucle = () => {
    if (!boucle && manettes > 0 && !document.hidden) boucle = requestAnimationFrame(lire);
  };

  addEventListener("gamepadconnected", () => {
    manettes++;
    noterEntree(true);
    demarrerBoucle();
  });
  addEventListener("gamepaddisconnected", () => {
    manettes = Math.max(0, manettes - 1);
    if (manettes === 0) {
      cancelAnimationFrame(boucle);
      boucle = 0;
      noterEntree(false);
      majBande(null);
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      cancelAnimationFrame(boucle);
      boucle = 0;
    } else demarrerBoucle();
  });
  // Le premier toucher, la souris ou une touche : la dernière entrée n'est plus la manette, la bande disparaît (les événements de la page seulement).
  for (const type of ["pointerdown", "pointermove", "keydown", "touchstart"] as const)
    addEventListener(
      type,
      (e) => {
        // Le navigateur envoie un faux mouvement de souris après un défilement : seul un vrai déplacement compte.
        const faux = e.type === "pointermove" && !(e as PointerEvent).movementX && !(e as PointerEvent).movementY;
        if (e.isTrusted && !faux && entreeManette) {
          noterEntree(false);
          majBande(null);
        }
      },
      { capture: true, passive: true },
    );

  // Ce que les jeux lisent : la manette, sans ce que le menu a pris (voir `manetteLien.ts`).
  brancher?.((pad) => {
    manettes = Math.max(manettes, 1);
    tick(pad, performance.now());
    demarrerBoucle();
    const menuOuvert = menuAvant;
    const boutons = Array.from(pad.buttons, (b, i) => (boutonVisiblePourLeJeu(i, menuOuvert, suivi) ? b : { pressed: false, touched: false, value: 0 }));
    return { id: pad.id, index: pad.index, connected: pad.connected, mapping: pad.mapping, timestamp: pad.timestamp, axes: menuOuvert ? pad.axes.map(() => 0) : pad.axes, buttons: boutons } as unknown as Gamepad;
  });

  // Le module est chargé par un événement de manette : c'est déjà une entrée de manette.
  manettes = Math.max(manettes, 1);
  noterEntree(true);
  demarrerBoucle();
}
