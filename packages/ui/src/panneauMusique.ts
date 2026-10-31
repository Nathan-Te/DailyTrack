import { CATALOGUE_MUSIQUE } from "./catalogue.musique";
import "./musique.css";

// Les réglages de la musique (lot « musique » de la plateforme) : **le même bloc dans Track, Jump et Tower** — volume, « Couper la musique », « Morceau suivant », et le morceau en cours
// avec son crédit. Il lit et écrit les réglages communs (`cdj:musique`) par le lecteur, **donné par l'appelant** (`ControleMusique`) : ce module ne connaît ni le lecteur ni le stockage.
//
// **À la demande, jamais dans le premier chargement** : il n'est pas dans `index.ts` ; un jeu l'importe (`import("@cdj/ui/src/panneauMusique")`) à l'ouverture de ses réglages, et il n'importe
// rien du reste du socle (ni `dom`, ni `i18n`, ni `icones` : voir `aideIphone.ts` — un module à la demande qui en importe un fait éclater le premier chargement). La langue est celle de
// `<html lang>`. Les textes de la musique (titre, artiste, crédit) sont posés en `textContent`.

/** Ce que le panneau demande au lecteur. */
export interface ControleMusique {
  reglages(): { volume: number; coupee: boolean };
  regler(patch: { volume?: number; coupee?: boolean }): void;
  suivante(): void;
  /** Il y a quelque chose à écouter dans ce jeu (la liste est chargée et n'est pas vide). */
  actif(): boolean;
  enCours(): { titre: string; artiste: string; credit: string } | null;
  /** Le lecteur a changé (morceau, réglage, liste chargée) ; rend la fonction qui se désabonne. */
  surChangement(fn: () => void): () => void;
}

type Cle = keyof typeof CATALOGUE_MUSIQUE.fr;

function texte(cle: Cle, params: Record<string, string | number> = {}): string {
  const langue = typeof document !== "undefined" && document.documentElement.lang.toLowerCase().startsWith("en") ? "en" : "fr";
  const v = CATALOGUE_MUSIQUE[langue][cle] as string;
  return v.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? ""));
}

function noeud<K extends keyof HTMLElementTagNameMap>(balise: K, classe: string, attrs: Record<string, string> = {}): HTMLElementTagNameMap[K] {
  const e = document.createElement(balise);
  e.className = classe;
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

/** Monte le bloc dans `place` : demande le lecteur (qui se charge au besoin) puis pose le panneau ; un échec (hors ligne, morceau introuvable) laisse la place vide, sans erreur. */
export function monterPanneau(obtenir: () => Promise<ControleMusique>, place: HTMLElement): Promise<void> {
  return obtenir().then((lecteur) => void place.append(panneauMusique(lecteur)), () => undefined);
}

/**
 * Le bloc des réglages de la musique. **Caché tant qu'il n'y a rien à écouter** dans ce jeu (liste vide, lecteur pas encore chargé) ; il se relit à chaque changement du lecteur.
 * `id` donne un préfixe aux identifiants (plusieurs blocs dans une page).
 */
export function panneauMusique(lecteur: ControleMusique, o: { id?: string } = {}): HTMLElement {
  const id = o.id ?? "musique";
  const racine = noeud("section", "dj-musique", { "data-musique": "reglages", "aria-labelledby": `${id}-titre` });
  const titre = noeud("h3", "dj-musique__titre", { id: `${id}-titre` });
  const curseur = noeud("input", "dj-musique__curseur", { type: "range", min: "0", max: "100", step: "5", id: `${id}-volume` });
  const nom = noeud("label", "dj-musique__nom", { for: `${id}-volume` });
  const valeur = noeud("output", "dj-musique__valeur", { for: `${id}-volume` });
  const ligneVolume = noeud("div", "dj-musique__ligne");
  ligneVolume.append(nom, curseur, valeur);
  const couper = noeud("button", "dj-bouton dj-bouton--secondaire dj-musique__bouton", { type: "button", id: `${id}-couper` });
  const suivant = noeud("button", "dj-bouton dj-bouton--secondaire dj-musique__bouton", { type: "button", id: `${id}-suivant` });
  const ligneBoutons = noeud("div", "dj-musique__ligne");
  ligneBoutons.append(couper, suivant);
  const ecoute = noeud("p", "dj-musique__ecoute", { "aria-live": "polite" });
  const credit = noeud("p", "dj-musique__credit");
  racine.append(titre, ligneVolume, ligneBoutons, ecoute, credit);

  const afficher = (): void => {
    const r = lecteur.reglages();
    racine.hidden = !lecteur.actif();
    titre.textContent = texte("musique.titre");
    nom.textContent = texte("musique.volume");
    curseur.value = String(Math.round(r.volume * 100));
    valeur.textContent = texte("musique.valeur", { n: Math.round(r.volume * 100) });
    couper.textContent = texte("musique.couper");
    couper.setAttribute("aria-pressed", r.coupee ? "true" : "false");
    suivant.textContent = texte("musique.suivant");
    suivant.disabled = r.coupee;
    const p = lecteur.enCours();
    ecoute.hidden = credit.hidden = !p;
    ecoute.textContent = p ? texte("musique.enEcoute", { titre: p.titre, artiste: p.artiste }) : "";
    credit.textContent = p ? p.credit : "";
  };
  curseur.addEventListener("input", () => {
    lecteur.regler({ volume: Number(curseur.value) / 100 });
    afficher();
  });
  couper.addEventListener("click", () => {
    lecteur.regler({ coupee: !lecteur.reglages().coupee });
    afficher();
  });
  suivant.addEventListener("click", () => lecteur.suivante());

  // Le bloc se relit à chaque changement du lecteur ; quand il a quitté la page (l'écran des réglages est redessiné), il se désabonne.
  let vu = false;
  const fin = lecteur.surChangement(() => {
    if (racine.isConnected) vu = true;
    else if (vu) return fin();
    afficher();
  });
  afficher();
  return racine;
}
