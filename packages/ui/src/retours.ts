import "./retours.css";
import type { CleRetours } from "./catalogue.retours";
import { bouton } from "./composants";
import { suivreDialogue } from "./dialogue";
import { el, svg } from "./dom";
import type { Traducteur } from "./i18n";

// Lot C1, partie A (plateforme) : le dialogue « Un bug ? Une idée ? » (charte § 9, révision 17), commun au portail, à Track, à Jump et à Tower : le type (Bug · Idée · Autre), le message (du texte seul, 1 000
// caractères au plus), **tout le contexte joint, montré avant l'envoi** (rien de caché), puis l'envoi. **À la demande** (`import("@cdj/ui/src/retours")`, jamais dans `index.ts`) avec sa feuille (`retours.css`)
// et son vocabulaire (`catalogue.retours.ts`, fr + en) : rien au premier chargement d'un jeu. **Aucun appel réseau ici** : l'application passe un callback `envoyer` (le client est `clientRetours` de
// `@cdj/profile/src/retours`). Tout est posé en `textContent`, jamais en HTML ; un message est un texte.

export type TraducteurRetours = Traducteur<CleRetours>;
export type TypeDeRetour = "bug" | "suggestion" | "autre";
const TYPES: readonly TypeDeRetour[] = ["bug", "suggestion", "autre"];
/** Caractères d'un message (le même que le serveur : `RETOUR_TEXTE_MAX`). */
export const TEXTE_MAX = 1000;

/** Ce que la manette doit savoir du dialogue (`ECRANS_MANETTE` de l'application : une ligne). A valide, B ferme. */
export const ECRAN_MANETTE_RETOUR = { ecran: ".dj-retour", principal: ".dj-retour__texte", retour: ".dj-retour__fermer" } as const;

/** Le contexte tel qu'on le montre : ce qui partira avec le message. `version` et `reference` sont `null` tant qu'ils ne sont pas connus. */
export interface ContexteAffiche {
  /** `portail`, `track`, `jump` ou `tower`. */
  jeu: string;
  page: string;
  /** Le jour (AAAA-MM-JJ) : celui du serveur, connu quand il répond. */
  jour: string | null;
  version: string | null;
  navigateur: string;
  systeme: string;
  ecran: string;
  langue: "fr" | "en";
  /** La référence publique du joueur (jamais l'identifiant secret), ou `null` sans profil. */
  reference: string | null;
}

export type ResultatEnvoi = { ok: true; reponsePossible: boolean } | { ok: false; code: string };

export interface OptionsDialogueRetour {
  t: TraducteurRetours;
  contexte: ContexteAffiche;
  /** Pas de profil : le dialogue le dit, aucune réponse ne pourra parvenir. */
  sansProfil: boolean;
  /** Envoie le message (le réseau est à l'application). */
  envoyer(m: { type: TypeDeRetour; texte: string }): Promise<ResultatEnvoi>;
  /** Où mène « Mes messages » après l'envoi (absent : pas de lien). */
  hrefMessages?: string;
  /** La couleur du jeu : `track`, `jump`, `tower`, sinon crème. */
  jeu?: "track" | "jump" | "tower";
  parent?: HTMLElement;
  onFermer?: () => void;
}

export interface DialogueRetour {
  racine: HTMLElement;
  dialogue: HTMLElement;
  fermer(): void;
  /** Complète le contexte montré (la version du site et la référence arrivent du serveur après l'ouverture). */
  majContexte(c: ContexteAffiche): void;
  readonly ouvert: boolean;
}

// Les noms propres des navigateurs et des systèmes (aucune traduction : ce sont des marques).
const NOMS: Record<string, string> = {
  chrome: "Chrome", // i18n-ok: nom d'un navigateur
  firefox: "Firefox", // i18n-ok: nom d'un navigateur
  safari: "Safari", // i18n-ok: nom d'un navigateur
  edge: "Edge", // i18n-ok: nom d'un navigateur
  opera: "Opera", // i18n-ok: nom d'un navigateur
  windows: "Windows", // i18n-ok: nom d'un système
  macos: "macOS", // i18n-ok: nom d'un système
  linux: "Linux", // i18n-ok: nom d'un système
  android: "Android", // i18n-ok: nom d'un système
  ios: "iOS", // i18n-ok: nom d'un système
};

let compteur = 0;
const nouvelId = (prefixe: string) => `${prefixe}-${++compteur}`;

function croix(): SVGSVGElement {
  return svg("svg", { attrs: { viewBox: "0 0 24 24", width: 18, height: 18, fill: "none", stroke: "currentColor", "stroke-width": 2.5, "stroke-linecap": "square", focusable: "false", "aria-hidden": "true" } }, svg("path", { attrs: { d: "M5 5l14 14M19 5 5 19" } }));
}

/** Le texte d'un envoi, avant le serveur : `null` s'il est vide ; la longueur se compte en caractères (un émoji compte pour un). */
export function texteEnvoye(brut: string): string | null {
  const t = brut.trim();
  return t.length > 0 && [...t].length <= TEXTE_MAX ? t : null;
}

export function dialogueRetour(o: OptionsDialogueRetour): DialogueRetour {
  const { t } = o;
  let contexte = o.contexte;
  const titreId = nouvelId("dj-retour-titre");
  const aideId = nouvelId("dj-retour-aide");
  const avant = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  let type: TypeDeRetour = "bug";
  let occupe = false;
  let ouvert = true;

  const fermerBouton = el("button", { classe: "dj-retour__fermer", attrs: { type: "button", "aria-label": t.t("retours.fermer") } }, croix());
  const entete = el("div", { classe: "dj-retour__entete" }, el("h2", { classe: "dj-retour__titre", attrs: { id: titreId }, texte: t.t("retours.titre") }), fermerBouton);
  const corps = el("div", { classe: "dj-retour__corps" });
  const dialogue = el("div", { classe: "dj-retour", attrs: { role: "dialog", "aria-modal": "true", "aria-labelledby": titreId, tabindex: "-1" } }, entete, corps);
  const racine = el("div", { classe: ["dj-retour-voile", o.jeu && `dj-retour-voile--${o.jeu}`] }, dialogue);

  const ligne = (cle: CleRetours, valeur: string): HTMLElement => el("div", { classe: "dj-retour__ligne" }, el("dt", { texte: t.t(cle) }), el("dd", { texte: valeur }));
  const nomDe = (famille: string): string => NOMS[famille] ?? t.t("retours.contexte.inconnue");
  const pageDe = (): string => `${t.t(`retours.page.${["track", "jump", "tower"].includes(contexte.jeu) ? contexte.jeu : "portail"}` as CleRetours)} (${contexte.page})`;

  function contexteVu(): HTMLElement {
    return el(
      "section",
      { classe: "dj-retour__contexte", attrs: { "aria-label": t.t("retours.contexte.titre") } },
      el("h3", { classe: "dj-retour__sous-titre", texte: t.t("retours.contexte.titre") }),
      el("p", { classe: "dj-retour__aide", texte: t.t("retours.contexte.aide") }),
      el(
        "dl",
        { classe: "dj-retour__liste" },
        ligne("retours.contexte.page", pageDe()),
        ligne("retours.contexte.jour", contexte.jour ?? t.t("retours.contexte.inconnue")),
        ligne("retours.contexte.version", contexte.version ?? t.t("retours.contexte.inconnue")),
        ligne("retours.contexte.navigateur", nomDe(contexte.navigateur)),
        ligne("retours.contexte.systeme", nomDe(contexte.systeme)),
        ligne("retours.contexte.ecran", contexte.ecran),
        ligne("retours.contexte.langue", contexte.langue === "en" ? "English" : "Français"), // i18n-ok: noms des langues
        ligne("retours.contexte.reference", contexte.reference ?? t.t("retours.contexte.sansReference")),
      ),
    );
  }

  /** Le contexte joint, dans sa zone : refait quand la version et la référence arrivent du serveur. */
  const zoneContexte = el("div", { classe: "dj-retour__zone" });
  function formulaire(): void {
    zoneContexte.replaceChildren(contexteVu());
    const options = TYPES.map((x) => {
      const b = el("button", { classe: "dj-retour__type", attrs: { type: "button", role: "radio", "aria-checked": x === type ? "true" : "false", tabindex: x === type ? "0" : "-1" }, texte: t.t(`retours.type.${x}` as CleRetours) });
      b.addEventListener("click", () => choisir(x));
      b.addEventListener("keydown", (e) => {
        const k = (e as KeyboardEvent).key;
        const i = TYPES.indexOf(x);
        const suivant = k === "ArrowRight" || k === "ArrowDown" ? (i + 1) % TYPES.length : k === "ArrowLeft" || k === "ArrowUp" ? (i + TYPES.length - 1) % TYPES.length : k === "Home" ? 0 : k === "End" ? TYPES.length - 1 : -1;
        if (suivant < 0) return;
        e.preventDefault();
        choisir(TYPES[suivant]!);
        groupe.querySelector<HTMLElement>("[aria-checked='true']")?.focus();
      });
      return b;
    });
    const groupe = el("div", { classe: "dj-retour__types", attrs: { role: "radiogroup", "aria-label": t.t("retours.type") } }, ...options);
    function choisir(x: TypeDeRetour): void {
      type = x;
      options.forEach((b, i) => {
        b.setAttribute("aria-checked", TYPES[i] === x ? "true" : "false");
        b.tabIndex = TYPES[i] === x ? 0 : -1;
      });
    }
    const champ = el("textarea", { classe: "dj-retour__texte", attrs: { id: nouvelId("dj-retour-texte"), rows: 5, "aria-describedby": aideId, autocomplete: "off", spellcheck: "true" } }) as HTMLTextAreaElement;
    const etiquette = el("label", { classe: "dj-retour__etiquette", attrs: { for: champ.id }, texte: t.t("retours.message") });
    const aide = el("p", { classe: "dj-retour__aide", attrs: { id: aideId }, texte: t.t("retours.message.aide", { max: TEXTE_MAX }) });
    const compteur = el("p", { classe: "dj-retour__compteur dj-chiffres", attrs: { "aria-hidden": "true" }, texte: t.t("retours.compteur", { n: 0, max: TEXTE_MAX }) });
    const message = el("p", { classe: "dj-retour__message", attrs: { role: "alert" } });
    const envoyer = bouton({ texte: t.t("retours.envoyer"), variante: "marque", pleineLargeur: true });
    const annuler = bouton({ texte: t.t("retours.annuler"), variante: "secondaire", pleineLargeur: true, onClick: () => fermer() });
    champ.addEventListener("input", () => {
      compteur.textContent = t.t("retours.compteur", { n: [...champ.value].length, max: TEXTE_MAX });
      if ([...champ.value].length > TEXTE_MAX) compteur.classList.add("dj-retour__compteur--plein");
      else compteur.classList.remove("dj-retour__compteur--plein");
      message.textContent = "";
    });
    envoyer.addEventListener("click", () => {
      if (occupe) return;
      const texte = texteEnvoye(champ.value);
      if (texte === null) {
        message.textContent = [...champ.value.trim()].length === 0 ? t.t("retours.vide") : t.t("erreur.invalid_feedback");
        champ.focus();
        return;
      }
      occupe = true;
      envoyer.setAttribute("disabled", "");
      envoyer.textContent = t.t("retours.envoi");
      void o.envoyer({ type, texte }).then((r) => {
        occupe = false;
        if (!ouvert) return;
        if (r.ok) return merci(r.reponsePossible);
        envoyer.removeAttribute("disabled");
        envoyer.textContent = t.t("retours.envoyer");
        const cle = `erreur.${r.code}` as CleRetours;
        const texteErreur = r.code === "network" || r.code === "timeout" ? t.t("retours.horsLigne") : t.t(cle);
        message.textContent = texteErreur === cle ? t.t("retours.horsLigne") : texteErreur;
      });
    });
    corps.replaceChildren(
      el("p", { classe: "dj-retour__intro", texte: t.t("retours.intro") }),
      ...(o.sansProfil ? [el("p", { classe: "dj-retour__sans-profil", attrs: { role: "note" }, texte: t.t("retours.sansProfil") })] : []),
      el("div", { classe: "dj-retour__champ" }, el("span", { classe: "dj-retour__etiquette", attrs: { id: nouvelId("dj-retour-type") }, texte: t.t("retours.type") }), groupe),
      el("div", { classe: "dj-retour__champ" }, etiquette, champ, el("div", { classe: "dj-retour__sous-champ" }, aide, compteur)),
      zoneContexte,
      message,
      el("div", { classe: "dj-retour__actions" }, envoyer, annuler),
    );
  }

  function merci(reponsePossible: boolean): void {
    const fermerB = bouton({ texte: t.t("retours.fermer"), variante: "marque", pleineLargeur: true, onClick: () => fermer() });
    fermerB.classList.add("dj-retour__principal");
    corps.replaceChildren(
      el("p", { classe: "dj-retour__merci", attrs: { role: "status" }, texte: t.t("retours.merci") }),
      el("p", { classe: "dj-retour__intro", texte: reponsePossible ? t.t("retours.merciReponse") : t.t("retours.merciSansReponse") }),
      ...(reponsePossible && o.hrefMessages ? [bouton({ texte: t.t("retours.voirMessages"), variante: "secondaire", href: o.hrefMessages, pleineLargeur: true })] : []),
      fermerB,
    );
    fermerB.focus({ preventScroll: true });
  }

  let arreterSuivi: () => void = () => undefined;
  function fermer(): void {
    if (!ouvert) return;
    ouvert = false;
    document.removeEventListener("keydown", surTouche, true);
    arreterSuivi();
    racine.remove();
    if (avant?.isConnected) avant.focus({ preventScroll: true });
    o.onFermer?.();
  }
  function surTouche(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      fermer();
      return;
    }
    if (e.key !== "Tab") return;
    const cibles = [...dialogue.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], textarea, [role='radio'][tabindex='0']")];
    if (cibles.length === 0) return;
    const premier = cibles[0]!;
    const dernier = cibles[cibles.length - 1]!;
    const actif = document.activeElement;
    if (e.shiftKey && (actif === premier || actif === dialogue)) {
      e.preventDefault();
      dernier.focus();
    } else if (!e.shiftKey && actif === dernier) {
      e.preventDefault();
      premier.focus();
    }
  }
  fermerBouton.addEventListener("click", fermer);
  racine.addEventListener("pointerdown", (e) => {
    if (e.target === racine) fermer();
  });
  document.addEventListener("keydown", surTouche, true);
  formulaire();
  (o.parent ?? document.body).append(racine);
  arreterSuivi = suivreDialogue(dialogue, { focusInitial: () => dialogue.querySelector<HTMLElement>(".dj-retour__texte") ?? fermerBouton });

  return {
    racine,
    dialogue,
    fermer,
    majContexte(c) {
      contexte = c;
      zoneContexte.replaceChildren(contexteVu());
    },
    get ouvert() {
      return ouvert;
    },
  };
}
