// Lot I6 (plateforme) : un écran en surimpression est un **dialogue** pour un lecteur d'écran (`role="dialog"`, un nom) : à son ouverture le focus
// entre dedans, à sa fermeture il est rendu. `suivreDialogue` le fait pour n'importe quel écran, sans que le jeu appelle quoi que ce soit : il
// observe ce qui l'ouvre (l'attribut `hidden` de l'écran, ou une classe de `body` pour une pause) et réagit au changement.
//   - Ouverture : si le focus n'est pas déjà dedans (l'écran a pu le poser lui-même sur son bouton principal), il va sur `focusInitial()` ou sur
//     l'écran lui-même (`tabindex="-1"` : le lecteur annonce son nom, Tab mène au premier bouton) — sauf si l'écran s'ouvre sous un autre dialogue
//     qui a le focus (rien ne le recouvre).
//   - Fermeture : si le focus était dedans, il revient à **ce qui avait le focus avant**, quand c'est un élément encore visible d'un autre écran
//     (Réglages ouverts depuis l'accueil ou la pause → le bouton « Réglages »), sinon à l'écran resté ouvert dessous (l'accueil sous « Comment
//     jouer »). Sans écran (l'écran rend la main à la partie : arrivée, pause), le focus est rendu à la page : le clavier commande de nouveau le
//     jeu (un bouton du HUD qui garderait le focus serait pressé par Espace).

/** Un élément visible (dans la page, affiché). */
const visible = (e: Element | null): e is HTMLElement => !!e && e.isConnected && e.getClientRects().length > 0;

export interface OptionsDialogue {
  /** L'écran est-il ouvert ? Par défaut : affiché (`hidden` absent). */
  ouvert?: () => boolean;
  /** Les éléments dont les attributs `hidden` et `class` ouvrent ou ferment l'écran (par défaut : l'écran). */
  observer?: Element[];
  /** L'élément qui reçoit le focus à l'ouverture (par défaut : l'écran). */
  focusInitial?: () => HTMLElement | null | undefined;
}

/** Suit un écran en surimpression : focus mis dedans à l'ouverture, rendu à la fermeture. Rend la fonction qui arrête le suivi. */
export function suivreDialogue(ecran: HTMLElement, o: OptionsDialogue = {}): () => void {
  const estOuvert = o.ouvert ?? (() => ecran.isConnected && !ecran.hidden);
  let ouvert = false;
  let avant: HTMLElement | null = null;
  // Ce qui avait le focus hors de l'écran en dernier (l'écran a pu prendre le focus avant que l'observateur ne voie son ouverture).
  let dernierHors: HTMLElement | null = null;
  const surFocus = (e: FocusEvent) => {
    const cible = e.target;
    if (cible instanceof HTMLElement && !ecran.contains(cible)) dernierHors = cible;
  };
  const surPerte = (e: FocusEvent) => {
    if (e.target === dernierHors && e.relatedTarget === null) queueMicrotask(() => document.activeElement === document.body && (dernierHors = null));
  };
  const maj = () => {
    const maintenant = estOuvert();
    if (maintenant === ouvert) return;
    ouvert = maintenant;
    const actif = document.activeElement;
    if (ouvert) {
      avant = dernierHors;
      if (actif && ecran.contains(actif)) return;
      // Un écran qui s'ouvre **sous** un autre (l'accueil sous « Comment jouer ») ne lui prend pas le focus : seul l'écran posé dessus le prend.
      if (actif instanceof HTMLElement && actif.closest('[role="dialog"]') && visible(actif)) {
        const r = actif.getBoundingClientRect();
        const dessus = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        if (dessus && !ecran.contains(dessus)) return;
      }
      const cible = o.focusInitial?.() ?? ecran;
      if (cible === ecran && !ecran.hasAttribute("tabindex")) ecran.tabIndex = -1;
      cible.focus({ preventScroll: true });
    } else {
      if (actif && actif !== document.body && !ecran.contains(actif)) return; // le focus est déjà ailleurs : n'y touche pas
      // Sinon, un autre écran resté ouvert dessous (l'accueil sous « Comment jouer ») reçoit le focus ; sans écran, la page (la partie).
      const dessous = [...document.querySelectorAll<HTMLElement>('[role="dialog"]')].reverse().find((d) => d !== ecran && !ecran.contains(d) && visible(d));
      if (visible(avant) && avant.closest('[role="dialog"]')) avant.focus({ preventScroll: true });
      else if (dessous) {
        if (!dessous.hasAttribute("tabindex")) dessous.tabIndex = -1;
        dessous.focus({ preventScroll: true });
      } else (actif as HTMLElement | null)?.blur?.();
      avant = null;
    }
  };
  document.addEventListener("focusin", surFocus);
  document.addEventListener("focusout", surPerte);
  const observateur = new MutationObserver(maj);
  for (const e of o.observer ?? [ecran]) observateur.observe(e, { attributes: true, attributeFilter: ["hidden", "class"] });
  maj();
  return () => {
    observateur.disconnect();
    document.removeEventListener("focusin", surFocus);
    document.removeEventListener("focusout", surPerte);
  };
}
