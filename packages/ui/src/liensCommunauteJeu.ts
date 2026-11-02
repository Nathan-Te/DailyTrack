import "./liensCommunauteJeu.css";
import { CATALOGUE_COMMUNAUTE } from "./catalogue.communaute";
import { el, svg } from "./dom";
import { ADRESSES_COMMUNAUTE, type LienCommunaute } from "./liensCommunaute";

// Lot S1 puis S1b : le groupe des deux liens d'un écran d'accueil de jeu (le portail n'importe que `liensCommunaute.ts` : il ne paie pas la mise en place). À la demande.
// **Lot S1b (charte § 5 et § 9) : deux plaques de 44 px, l'icône seule** (fond papier, bordure de 2 px, ombre nette : pas les couleurs des marques, pas de pilule ; le nom reste lu : `aria-label`),
// **en bas à gauche, hors du flux** — elles ne prennent aucune hauteur à l'étiquette. Si elles toucheraient quelque chose (petit écran, étiquette haute), elles passent **sous l'étiquette, dans
// le défilement** (`dj-communaute--flux`) et ne la recouvrent jamais : `placer` le décide d'après la géométrie, sans rien réserver. Les adresses sont celles de `liensCommunaute.ts`.

const DISCORD = "M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z";

/** Le glyphe d'un lien : Discord (la bulle de la marque, tracée en `currentColor`) ou la tasse de Ko-fi (au trait, comme les icônes de la charte). */
function glyphe(type: LienCommunaute): SVGSVGElement {
  const racine = svg("svg", { attrs: { viewBox: "0 0 24 24", width: 24, height: 24, "aria-hidden": "true", focusable: "false" } });
  if (type === "discord") racine.append(svg("path", { attrs: { d: DISCORD, fill: "currentColor" } }));
  else
    racine.append(
      svg("path", { attrs: { d: "M3.5 8.5h13v5.5a4.5 4.5 0 0 1-4.5 4.5H8A4.5 4.5 0 0 1 3.5 14z", fill: "none", stroke: "currentColor", "stroke-width": 2.25, "stroke-linejoin": "miter" } }),
      svg("path", { attrs: { d: "M16.5 10.5h1.2a2.4 2.4 0 0 1 0 4.8h-1.2M3 21h14", fill: "none", stroke: "currentColor", "stroke-width": 2.25, "stroke-linecap": "square" } }),
    );
  return racine;
}

/** Une plaque : un lien de 44 px, l'icône seule ; nouvel onglet sans transmettre la page d'origine, aucun paramètre qui identifie le joueur. */
function plaque(type: LienCommunaute, nom: string): HTMLAnchorElement {
  return el("a", { classe: `dj-communaute__plaque dj-communaute__plaque--${type}`, attrs: { id: `communaute-${type}`, href: ADRESSES_COMMUNAUTE[type], target: "_blank", rel: "noopener noreferrer", "aria-label": nom, title: nom } }, glyphe(type));
}

/** Les deux plaques d'un écran d'accueil : l'appelant les pose dans l'écran (`append`), elles disparaissent avec lui. Les noms lus suivent `<html lang>` ; au changement de langue le jeu refait le groupe. */
export function liensCommunaute(): HTMLElement {
  const t = CATALOGUE_COMMUNAUTE[document.documentElement.lang.startsWith("en") ? "en" : "fr"] as unknown as Readonly<Record<string, string>>;
  const groupe = el("div", { classe: "dj-communaute dj-sombre", attrs: { id: "communaute", role: "group", "aria-label": t["communaute.groupe"] } }, plaque("discord", t["communaute.discord"]!), plaque("kofi", t["communaute.kofi"]!));
  suivrePlace(groupe);
  return groupe;
}

/** Ce que l'accueil fait défiler : la colonne du cadre commun (`creerCadre`), ou celle de l'accueil de Tower. */
const DEFILE = ".cadre__defile, .accueil__defile";
const ECART = 8;

/**
 * Place le groupe : **fixe en bas à gauche** quand rien n'est dessous, sinon **à la fin du défilement** de l'écran. Décidé d'après le bas de ce qui défile (la hauteur de son contenu, groupe
 * retiré : le résultat ne dépend pas de l'endroit où il est, donc il ne bascule pas sans cesse) et le bord gauche de ce contenu ; refait quand la fenêtre ou le contenu change de taille.
 */
function suivrePlace(groupe: HTMLElement): void {
  let racine: HTMLElement | null = null;
  const placer = (): void => {
    racine ??= groupe.parentElement;
    const defile = racine?.querySelector<HTMLElement>(DEFILE);
    if (!racine || !defile || !groupe.isConnected) return;
    const enFlux = groupe.parentElement === defile;
    if (enFlux) racine.append(groupe); // mesure hors du défilement : le contenu seul
    const r = defile.getBoundingClientRect();
    const g = groupe.getBoundingClientRect();
    const bas = r.top - defile.scrollTop + defile.scrollHeight;
    const gauche = Math.min(...[...defile.children].map((c) => c.getBoundingClientRect().left));
    const libre = bas + ECART <= g.top || gauche >= g.right + ECART;
    groupe.classList.toggle("dj-communaute--flux", !libre);
    if (!libre) defile.append(groupe);
  };
  const observateur = new ResizeObserver(placer);
  const demarrer = (): void => {
    racine = groupe.parentElement;
    if (!racine) return;
    placer();
    observateur.observe(racine);
    const defile = racine.querySelector(DEFILE);
    if (defile) observateur.observe(defile);
  };
  requestAnimationFrame(demarrer);
  addEventListener("resize", placer);
  addEventListener("orientationchange", placer);
}
