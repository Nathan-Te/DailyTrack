import "./avatar.css";
import "./avatar-liste.css";
import "./amis.css";
import type { CleAmis } from "./catalogue.amis";
import type { CleCommune } from "./catalogue";
import { bouton, medaille, type Jeu, type TypeMedaille } from "./composants";
import { avatar } from "./avatar";
import { suivreDialogue } from "./dialogue";
import { el, svg } from "./dom";
import { formatHauteur, formatNombre, formatRang, formatTemps } from "./formats";
import type { Traducteur } from "./i18n";

// Lot F2 (plateforme) : les composants des amis, communs au portail et aux trois jeux — le sélecteur « Tous / Amis » des classements, la feuille d'un joueur (planche C de la maquette), la ligne d'un
// ami, la liste « Mes amis », l'ajout par pseudo, ton lien d'invitation et la carte de la personne invitée (planche D). Charte : `docs/plateforme/identite.md` § 9, 10 ; maquette `favoris-et-amis.html`.
// **À la demande** (`import("@cdj/ui/src/amis")`, jamais dans `index.ts`) avec sa feuille (`amis.css`) et son vocabulaire (`catalogue.amis.ts`, fr + en) : rien au premier chargement d'un jeu.
// **Aucun appel réseau ici** : l'application parle au serveur (`clientAmis` de `@cdj/profile`) et passe des callbacks qui rendent un résultat (`ResultatAction`). Tout texte venu du serveur (un pseudo)
// est posé en `textContent`, jamais interprété. Le traducteur `t` réunit le catalogue commun et `CATALOGUE_AMIS`.

/** Le traducteur des composants : le catalogue commun (médailles, `erreur.<code>`) et `CATALOGUE_AMIS`. */
export type TraducteurAmis = Traducteur<CleAmis | CleCommune>;
/** Le filtre d'un classement. Le même type que `FiltreAmis` de `@cdj/profile` (ce paquet ne l'importe pas). */
export type FiltreClassement = "tous" | "amis" | "groupe";
/**
 * Ce qu'un callback rend : `ok`, ou l'échec avec le `code` du serveur (`friends_full`, `network`…). Un `ApiResult` de `@cdj/profile` convient tel quel ;
 * `suggestions` : les pseudos libres que rend `name_taken`.
 */
export type ResultatAction = { ok: true; data?: unknown } | { ok: false; code: string; suggestions?: string[] };

/** Les lettres qu'il faut pour chercher un pseudo (comme `SUGGESTION_MIN` de `@cdj/profile`). */
export const LETTRES_MIN_SUGGESTION = 3;

/** Ce que la manette doit savoir de la feuille d'un joueur (`ECRANS_MANETTE` de l'application : une ligne). A valide, B ferme. */
export const ECRAN_MANETTE_FEUILLE = { ecran: ".dj-feuille", principal: ".dj-feuille__principal, .dj-feuille__fermer", retour: ".dj-feuille__fermer" } as const;

// --- Petits outils --------------------------------------------------------------------------------------------------------------------------------------------------------------

/** Le texte à montrer pour un échec : hors ligne, la traduction du code du serveur (`erreur.<code>`), sinon une phrase générale. */
export function messageErreur(t: TraducteurAmis, code: string): string {
  if (code === "network" || code === "timeout") return t.t("amis.horsLigne");
  const cle = `erreur.${code}` as CleCommune;
  const texte = t.t(cle);
  return texte === cle ? t.t("amis.erreur.generique") : texte;
}

/** La médaille d'une donnée du serveur (`auteur` / `author` → Diamant ; `gold` →`or`…) ; `null` : pas de médaille. */
export function medailleDeDonnee(m: string | null | undefined): TypeMedaille | null {
  switch (m) {
    case "diamant":
    case "auteur":
    case "author":
      return "diamant";
    case "or":
    case "gold":
      return "or";
    case "argent":
    case "silver":
      return "argent";
    case "bronze":
      return "bronze";
    default:
      return null;
  }
}

/** Quelques phrases partagées que les applications posent dans leurs propres lignes de classement. */
export function textesAmis(t: TraducteurAmis) {
  return {
    /** « 3e entre amis » (rang du joueur parmi ses amis). */
    rangEntreAmis: (rang: number): string => t.t("amis.rangEntreAmis", { rang: formatRang(rang, t.langue) }),
    /** « pas encore joué » : la valeur d'un ami qui n'a rien fini ce jour-là. */
    pasJoue: (): string => t.t("amis.pasJoue"),
    /** Le titre de la liste des amis sans résultat. */
    absents: (): string => t.t("amis.absents"),
    reciproque: (): string => t.t("amis.reciproque"),
    ajouteParToi: (): string => t.t("amis.ajouteParToi"),
  };
}

let compteur = 0;
const nouvelId = (prefixe: string): string => `${prefixe}-${++compteur}`;

function croix(): SVGSVGElement {
  return svg("svg", { attrs: { viewBox: "0 0 24 24", width: 18, height: 18, fill: "none", stroke: "currentColor", "stroke-width": 2.5, "stroke-linecap": "square", focusable: "false", "aria-hidden": "true" } }, svg("path", { attrs: { d: "M5 5l14 14M19 5 5 19" } }));
}

/** Un lien vers la page « Mes amis » : « Inviter un ami » (sous le classement). */
export function lienAmis(t: TraducteurAmis, o: { href: string; pleineLargeur?: boolean }): HTMLAnchorElement {
  return bouton({ texte: t.t("amis.inviter"), variante: "secondaire", href: o.href, pleineLargeur: o.pleineLargeur ?? true }) as HTMLAnchorElement;
}

/** Le « Amis » d'un classement sans ami : une phrase et le lien vers la page « Mes amis ». */
export function classementAmisVide(t: TraducteurAmis, o: { href: string }): HTMLElement {
  return el("div", { classe: "dj-amis-vide" }, el("p", { texte: t.t("amis.classementVide") }), lienAmis(t, { href: o.href }));
}

/** Pose un message d'état (`role="status"`, poli) ou d'échec (`role="alert"`) ; vide quand il n'y a rien à dire. */
function messagerie(): { racine: HTMLElement; dire(texte: string): void; echec(texte: string): void; vider(): void } {
  const racine = el("p", { classe: "dj-amis-message", attrs: { role: "status", "aria-live": "polite" } });
  return {
    racine,
    dire: (texte) => {
      racine.setAttribute("role", "status");
      racine.setAttribute("aria-live", "polite");
      racine.classList.remove("dj-amis-message--echec");
      racine.textContent = texte;
    },
    echec: (texte) => {
      racine.setAttribute("role", "alert");
      racine.removeAttribute("aria-live");
      racine.classList.add("dj-amis-message--echec");
      racine.textContent = texte;
    },
    vider: () => {
      racine.textContent = "";
    },
  };
}

async function executer(f: () => Promise<ResultatAction>): Promise<ResultatAction> {
  try {
    return await f();
  } catch {
    return { ok: false, code: "network" };
  }
}

// --- Le sélecteur Tous / Amis ---------------------------------------------------------------------------------------------------------------------------------------------

export interface OptionsSelecteurAmis {
  t: TraducteurAmis;
  filtre: FiltreClassement;
  /** Le nombre de joueurs du classement « Tous » ; `null` / absent : pas encore connu, le nombre n'est pas écrit. */
  total?: number | null;
  /** Le nombre d'amis ; `null` / absent : pas encore connu. */
  amis?: number | null;
  /** Lot C1, partie C : le nombre de membres de mon groupe ; absent (`undefined`) : pas de groupe, l'option « Mon groupe » n'existe pas ; `null` : un groupe dont le nombre n'est pas encore connu. */
  groupe?: number | null;
  /** Appelé quand le joueur choisit l'autre filtre (jamais pour le filtre déjà choisi). */
  onChange: (filtre: FiltreClassement) => void;
  /** Le jeu dont le classement est montré : Track (asphalte), Jump (jaune) ou Tower (menthe) en reprennent les couleurs ; absent : le crème du portail. */
  jeu?: Jeu;
  id?: string;
}
export interface SelecteurAmis {
  racine: HTMLElement;
  /** Met à jour le choix et les nombres (ce qui n'est pas donné ne change pas). N'appelle pas `onChange`. */
  maj(o: { filtre?: FiltreClassement; total?: number | null; amis?: number | null; groupe?: number | null }): void;
}


/**
 * Le sélecteur segmenté « Tous · 412 » / « Amis · 6 » (planche B), sous les onglets de vue d'un classement. **Un groupe de boutons radio** (`role="radiogroup"` + `role="radio"`, un seul arrêt de tabulation,
 * flèches / Début / Fin) plutôt qu'une seconde barre d'onglets : c'est un filtre qui change le contenu d'un même classement, pas une vue de plus, et surtout LB / RB de la manette changent
 * l'onglet de vue (`role="tab"`) — un deuxième `tablist` dans l'écran leur ferait choisir la mauvaise barre. Cibles de 44 px, focus visible. Un choix par flèche s'applique tout de suite.
 */
export function selecteurAmis(o: OptionsSelecteurAmis): SelecteurAmis {
  const { t } = o;
  let filtre = o.filtre;
  let total = o.total ?? null;
  let amis = o.amis ?? null;
  let groupe: number | null | undefined = o.groupe;
  const FILTRES: FiltreClassement[] = ["tous", "amis", "groupe"]; // « Mon groupe » n'est montré qu'à un joueur qui a un groupe (le nombre arrive avec `maj`)
  const visibles = (): FiltreClassement[] => FILTRES.filter((f) => f !== "groupe" || groupe !== undefined);
  const racine = el("div", { classe: ["dj-amis-selecteur", o.jeu && `dj-amis-selecteur--${o.jeu}`, o.jeu === "track" && "dj-sombre"], attrs: { id: o.id, role: "radiogroup", "aria-label": t.t("amis.selecteur.groupe") } });
  const boutons = FILTRES.map((f) => el("button", { classe: "dj-amis-selecteur__option", attrs: { type: "button", role: "radio", "data-filtre": f } }));
  racine.append(...boutons);
  const nom = (f: FiltreClassement): string => {
    if (f === "groupe") return groupe === null || groupe === undefined ? t.t("amis.selecteur.monGroupe") : t.t("amis.selecteur.monGroupeN", { n: groupe });
    const n = f === "tous" ? total : amis;
    return n === null ? t.t(f === "tous" ? "amis.selecteur.tous" : "amis.selecteur.amis") : t.t(f === "tous" ? "amis.selecteur.tousN" : "amis.selecteur.amisN", { n });
  };
  const rendre = () => {
    boutons.forEach((b, i) => {
      const f = FILTRES[i]!;
      b.textContent = nom(f);
      b.hidden = f === "groupe" && groupe === undefined;
      b.setAttribute("aria-checked", String(f === filtre));
      b.tabIndex = f === filtre ? 0 : -1;
    });
  };
  const choisir = (f: FiltreClassement, focus: boolean) => {
    if (f === filtre) return;
    filtre = f;
    rendre();
    if (focus) boutons[FILTRES.indexOf(f)]!.focus();
    o.onChange(f);
  };
  boutons.forEach((b, i) => {
    b.addEventListener("click", () => choisir(FILTRES[i]!, false));
    b.addEventListener("keydown", (e) => {
            const liste = visibles();
      const place = liste.indexOf(FILTRES[i]!);
      const suivant = e.key === "ArrowRight" || e.key === "ArrowDown" ? place + 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? place - 1 : e.key === "Home" ? 0 : e.key === "End" ? liste.length - 1 : null;
      if (suivant === null) return;
      e.preventDefault();
      const f = liste[(suivant + liste.length) % liste.length]!;
      if (f === filtre) boutons[FILTRES.indexOf(f)]!.focus();
      else choisir(f, true);
    });
  });
  rendre();
  return {
    racine,
    maj(n) {
      if (n.filtre !== undefined) filtre = n.filtre;
      if (n.total !== undefined) total = n.total;
      if (n.amis !== undefined) amis = n.amis;
      if (n.groupe !== undefined) groupe = n.groupe;
      rendre();
    },
  };
}

// --- La feuille d'un joueur -----------------------------------------------------------------------------------------------------------------------------------------------

/** Une ligne de la feuille : un jeu du jour. `valeur` en millisecondes (`temps`) ou en millimètres (`hauteur`, Tower) ; `null` : pas fini. */
export interface JeuDeFiche {
  nom: string;
  unite: "temps" | "hauteur";
  valeur: number | null;
  /** La médaille telle que la donne le serveur (`auteur`, `or`…) : voir `medailleDeDonnee`. */
  medaille: string | null;
}
/** Ce que la feuille montre d'un joueur (la fiche de `clientAmis().ficheJoueur`) : **rien d'autre**. */
export interface FicheAffichee {
  pseudo: string;
  /** Lot C1 : l'adresse de son image (déjà contrôlée par le serveur) et sa référence publique (la couleur des initiales). */
  image?: string;
  ref?: string;
  ami: boolean;
  reciproque: boolean;
  rang: number | null;
  classes: number | null;
  jeux: readonly JeuDeFiche[];
}

export interface OptionsFeuilleJoueur {
  t: TraducteurAmis;
  /** Le pseudo de la ligne touchée (déjà connu : il titre la feuille pendant le chargement). */
  pseudo: string;
  /** Le jeu dont le classement est ouvert (couleur de l'habillage des boutons) ; absent : le portail. */
  jeu?: Jeu;
  /** « Ajouter en ami » : l'application appelle le serveur. */
  onAjouter: () => Promise<ResultatAction>;
  /** « Retirer ». */
  onRetirer: () => Promise<ResultatAction>;
  /** Lot C1 : « Signaler l'image » (montré seulement quand la fiche a une image) ; absent : pas de bouton. */
  onSignaler?: () => Promise<ResultatAction>;
  /** La feuille s'est fermée (Échap, bouton, voile ou `fermer()`). */
  onFermer?: () => void;
  /** Où la poser (par défaut `document.body`) ; elle couvre l'écran en bas (`position: fixed`). */
  parent?: HTMLElement;
}
export interface FeuilleJoueur {
  racine: HTMLElement;
  dialogue: HTMLElement;
  /** Montre la fiche (le serveur a répondu). */
  afficher(fiche: FicheAffichee): void;
  /** Le serveur n'a pas pu répondre : un message (hors ligne, ou `erreur.<code>`) et « Réessayer » si `reessayer` est donné. */
  erreur(code: string, reessayer?: () => void): void;
  chargement(): void;
  fermer(): void;
  readonly ouverte: boolean;
}

type EtatFeuille = { genre: "chargement" } | { genre: "erreur"; code: string; reessayer?: () => void } | { genre: "fiche"; fiche: FicheAffichee };

/**
 * La feuille d'un joueur (planche C) : un dialogue en bas de l'écran, qui s'ouvre au toucher d'une ligne d'un classement « Tous ». Son pseudo, son rang général du jour (« 8e sur 412 »), un tableau
 * « jeu · résultat · médaille », « Ajouter en ami » (ou « Retirer » pour un ami) et la phrase qui dit que l'autre n'est pas prévenu. **Aucune autre donnée du joueur.** Dialogue nommé
 * (`suivreDialogue` : le focus entre, il revient à la ligne touchée à la fermeture), fermable par Échap, le bouton « Fermer » ou un appui sur le voile ; Tab reste dedans.
 * Manette : A valide, B ferme (`ECRAN_MANETTE_FEUILLE`).
 */
export function feuilleJoueur(o: OptionsFeuilleJoueur): FeuilleJoueur {
  const { t } = o;
  const titreId = nouvelId("dj-feuille-titre");
  const avant = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const fermerBouton = el("button", { classe: "dj-feuille__fermer", attrs: { type: "button", "aria-label": t.t("amis.fermer") } }, croix());
  const titre = el("h2", { classe: "dj-feuille__titre", attrs: { id: titreId }, texte: o.pseudo });
  const rang = el("p", { classe: "dj-feuille__rang dj-chiffres" });
  const portrait = el("span", { classe: "dj-feuille__portrait" });
  const entete = el("div", { classe: "dj-feuille__entete" }, portrait, el("div", { classe: "dj-feuille__nom" }, titre, rang), fermerBouton);
  const corps = el("div", { classe: "dj-feuille__corps" });
  const dialogue = el("div", { classe: "dj-feuille", attrs: { role: "dialog", "aria-modal": "true", "aria-labelledby": titreId, tabindex: "-1" } }, entete, corps);
  const racine = el("div", { classe: ["dj-feuille-voile", o.jeu && `dj-feuille-voile--${o.jeu}`] }, dialogue);
  let etat: EtatFeuille = { genre: "chargement" };
  let occupe = false;
  let ouverte = true;
  let message: { texte: string; echec: boolean } | null = null;
  let signale = false;

  const tableau = (f: FicheAffichee): HTMLElement => {
    if (f.jeux.length === 0) return el("p", { classe: "dj-feuille__aucun", texte: t.t("amis.feuille.aucun") });
    const ligne = (j: JeuDeFiche): HTMLElement => {
      const type = medailleDeDonnee(j.medaille);
      const valeur = j.valeur === null ? textesAmis(t).pasJoue() : j.unite === "hauteur" ? formatHauteur(j.valeur, t.langue) : formatTemps(j.valeur, t.langue);
      return el(
        "tr",
        {},
        el("th", { attrs: { scope: "row" }, texte: j.nom }),
        el("td", { classe: j.valeur === null ? "dj-feuille__vide" : "dj-chiffres", texte: valeur }),
        el("td", {}, type ? medaille(t, { type, obtenue: true, jeu: o.jeu }) : el("span", { classe: "dj-feuille__vide" }, el("span", { attrs: { "aria-hidden": "true" }, texte: "—" }))),
      );
    };
    return el(
      "table",
      { classe: "dj-feuille__tableau" },
      el("thead", { classe: "dj-cache" }, el("tr", {}, el("th", { attrs: { scope: "col" }, texte: t.t("amis.feuille.jeu") }), el("th", { attrs: { scope: "col" }, texte: t.t("amis.feuille.resultat") }), el("th", { attrs: { scope: "col" }, texte: t.t("amis.feuille.medaille") }))),
      el("tbody", {}, ...f.jeux.map(ligne)),
    );
  };

  const lancer = async (f: () => Promise<ResultatAction>, apres: (fiche: FicheAffichee) => string) => {
    if (occupe || etat.genre !== "fiche") return;
    occupe = true;
    message = null;
    rendre();
    const r = await executer(f);
    occupe = false;
    if (!ouverte) return;
    if (r.ok && etat.genre === "fiche") message = { texte: apres(etat.fiche), echec: false };
    else if (!r.ok) message = { texte: messageErreur(t, r.code), echec: true };
    rendre();
    dialogue.querySelector<HTMLElement>(".dj-feuille__principal")?.focus({ preventScroll: true });
  };

  function rendre(): void {
    const enfants: (Node | null)[] = [];
    rang.textContent = "";
    if (etat.genre === "chargement") enfants.push(el("p", { classe: "dj-feuille__etat", attrs: { role: "status" }, texte: t.t("amis.chargement") }));
    else if (etat.genre === "erreur") {
      enfants.push(el("p", { classe: "dj-feuille__etat dj-feuille__etat--echec", attrs: { role: "alert" }, texte: messageErreur(t, etat.code) }));
      if (etat.reessayer) {
        const encore = etat.reessayer;
        const b = bouton({ texte: t.t("amis.reessayer"), variante: "secondaire", pleineLargeur: true, onClick: () => encore() });
        b.classList.add("dj-feuille__principal");
        enfants.push(b);
      }
    } else {
      const f = etat.fiche;
      titre.textContent = f.pseudo;
      portrait.replaceChildren(avatar(t, { pseudo: f.pseudo, ref: f.ref, image: f.image, taille: 44, decoratif: true }));
      if (f.rang !== null && f.classes !== null) rang.textContent = t.t("amis.feuille.rang", { rang: formatRang(f.rang, t.langue), classes: formatNombre(f.classes, t.langue) });
      enfants.push(tableau(f));
      if (f.ami) enfants.push(el("p", { classe: "dj-feuille__relation", texte: f.reciproque ? t.t("amis.reciproque") : t.t("amis.ajouteParToi") }));
      const principal = bouton({
        texte: f.ami ? t.t("amis.retirer") : t.t("amis.ajouter"),
        variante: f.ami ? "secondaire" : "marque",
        pleineLargeur: true,
        desactive: occupe,
        ariaLabel: f.ami ? t.t("amis.retirer.aria", { pseudo: f.pseudo }) : undefined,
        onClick: () =>
          void (f.ami
            ? lancer(o.onRetirer, (x) => {
                x.ami = false;
                x.reciproque = false;
                return t.t("amis.feuille.retire", { pseudo: x.pseudo });
              })
            : lancer(o.onAjouter, (x) => {
                x.ami = true;
                return t.t("amis.ajout.fait", { pseudo: x.pseudo });
              })),
      });
      principal.classList.add("dj-feuille__principal");
      enfants.push(principal);
      if (message) {
        const m = el("p", { classe: ["dj-amis-message", message.echec && "dj-amis-message--echec"], attrs: { role: message.echec ? "alert" : "status" }, texte: message.texte });
        enfants.push(m);
      }
      if (!f.ami) enfants.push(el("p", { classe: "dj-feuille__prevenu", texte: t.t("amis.prevenu", { pseudo: f.pseudo }) }));
      if (f.image && o.onSignaler) {
        const signaler = o.onSignaler;
        const b = bouton({
          texte: signale ? t.t("amis.signale") : t.t("amis.signaler"),
          variante: "secondaire",
          pleineLargeur: true,
          desactive: signale || occupe,
          onClick: () =>
            void (async () => {
              if (signale || occupe) return;
              occupe = true;
              rendre();
              const r = await executer(signaler);
              occupe = false;
              if (!ouverte) return;
              if (r.ok) signale = true;
              else message = { texte: messageErreur(t, r.code), echec: true };
              rendre();
            })(),
        });
        b.classList.add("dj-feuille__signaler");
        enfants.push(b);
      }
    }
    corps.replaceChildren(...enfants.filter((e): e is Node => e !== null));
  }

  // --- Ouverture, fermeture, clavier ---
  let arreterSuivi: () => void = () => undefined;
  const fermer = () => {
    if (!ouverte) return;
    ouverte = false;
    document.removeEventListener("keydown", surTouche, true);
    arreterSuivi();
    racine.remove();
    if (avant?.isConnected) avant.focus({ preventScroll: true });
    o.onFermer?.();
  };
  const surTouche = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      fermer();
      return;
    }
    if (e.key !== "Tab") return;
    // Le focus reste dans la feuille.
    const cibles = [...dialogue.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], [tabindex='0']")];
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
  };
  fermerBouton.addEventListener("click", fermer);
  racine.addEventListener("pointerdown", (e) => {
    if (e.target === racine) fermer();
  });
  document.addEventListener("keydown", surTouche, true);
  rendre();
  (o.parent ?? document.body).append(racine);
  // Le dialogue est dans la page : le focus y entre (sur l'action principale, sinon « Fermer »).
  arreterSuivi = suivreDialogue(dialogue, { focusInitial: () => dialogue.querySelector<HTMLElement>(".dj-feuille__principal") ?? fermerBouton });

  return {
    racine,
    dialogue,
    get ouverte() {
      return ouverte;
    },
    chargement() {
      etat = { genre: "chargement" };
      rendre();
    },
    erreur(code, reessayer) {
      etat = { genre: "erreur", code, reessayer };
      rendre();
    },
    afficher(fiche) {
      if (!ouverte) return;
      const surFermer = document.activeElement === fermerBouton || document.activeElement === dialogue;
      etat = { genre: "fiche", fiche: { ...fiche, jeux: [...fiche.jeux] } };
      message = null;
      rendre();
      // Le focus était sur « Fermer » le temps du chargement : il va à l'action principale (A la valide à la manette).
      if (surFermer) dialogue.querySelector<HTMLElement>(".dj-feuille__principal")?.focus({ preventScroll: true });
    },
    fermer,
  };
}

// --- Ta liste d'amis ------------------------------------------------------------------------------------------------------------------------------------------------------

/** Un ami de ta liste (`Ami` de `@cdj/profile`). */
export interface AmiAffiche {
  ref: string;
  pseudo: string;
  /** Lot C1 : l'adresse de son image, absente : ses initiales. */
  image?: string;
  /** Il t'a aussi parmi ses amis : « vous deux » ; sinon « ajouté par toi ». */
  reciproque: boolean;
}

export interface OptionsLigneAmi {
  t: TraducteurAmis;
  ami: AmiAffiche;
  /** « Retirer » : l'application appelle le serveur. Pendant l'appel le bouton est éteint ; un échec s'écrit sous la ligne. */
  onRetirer: (ami: AmiAffiche) => Promise<ResultatAction>;
  /** Le retrait a réussi (la liste enlève la ligne). */
  apresRetrait?: (ami: AmiAffiche) => void;
}

/** Une ligne de « Mes amis » (planche D) : le pseudo, « vous deux » / « ajouté par toi », « Retirer » (44 px, nommé « Retirer {pseudo} de mes amis »). */
export function ligneAmi(o: OptionsLigneAmi): HTMLLIElement {
  const { t, ami } = o;
  const retirer = el("button", { classe: "dj-ligne-ami__retirer", attrs: { type: "button", "aria-label": t.t("amis.retirer.aria", { pseudo: ami.pseudo }) }, texte: t.t("amis.retirer") });
  const message = messagerie();
  message.racine.classList.add("dj-ligne-ami__message");
  const racine = el(
    "li",
    { classe: "dj-ligne-ami", attrs: { "data-ref": ami.ref } },
    avatar(t, { pseudo: ami.pseudo, ref: ami.ref, image: ami.image, taille: 32, decoratif: true }),
    el("span", { classe: "dj-ligne-ami__pseudo", texte: ami.pseudo }),
    el("span", { classe: "dj-ligne-ami__etat", texte: ami.reciproque ? t.t("amis.reciproque") : t.t("amis.ajouteParToi") }),
    retirer,
    message.racine,
  );
  retirer.addEventListener("click", () => {
    void (async () => {
      if (retirer.disabled) return;
      retirer.disabled = true;
      message.vider();
      const r = await executer(() => o.onRetirer(ami));
      if (r.ok) o.apresRetrait?.(ami);
      else {
        retirer.disabled = false;
        message.echec(messageErreur(t, r.code));
      }
    })();
  });
  return racine;
}

export interface OptionsListeAmis {
  t: TraducteurAmis;
  amis: readonly AmiAffiche[];
  /** Le plafond (100 au plus ; `max` du serveur). */
  max: number;
  onRetirer: (ami: AmiAffiche) => Promise<ResultatAction>;
  /** La liste a changé (un ami retiré) : le nouveau nombre, pour les compteurs ailleurs dans la page. */
  onChange?: (amis: readonly AmiAffiche[]) => void;
  /** Le niveau du titre (« 6 amis · 100 au plus ») ; `h2` par défaut. */
  niveau?: "h2" | "h3";
}
export interface ListeAmis {
  racine: HTMLElement;
  /** Remplace la liste (après un ajout ou une relecture). */
  maj(amis: readonly AmiAffiche[], max?: number): void;
  /** Les amis montrés. */
  amis(): readonly AmiAffiche[];
}

/** La liste « Mes amis » : le compteur « 6 amis » avec « 100 au plus », les lignes (`ligneAmi`), ou la phrase « Pas encore d'ami ». Retirer un ami l'enlève de la liste et rend le focus au titre. */
export function listeAmis(o: OptionsListeAmis): ListeAmis {
  const { t } = o;
  let amis = [...o.amis];
  let max = o.max;
  const titre = el(o.niveau ?? "h2", { classe: "dj-liste-amis__titre", attrs: { tabindex: "-1" } });
  const plafond = el("span", { classe: "dj-liste-amis__max" });
  const liste = el("ul", { classe: "dj-liste-amis__liste" });
  const vide = el("p", { classe: "dj-liste-amis__vide", texte: t.t("amis.vide") });
  const racine = el("section", { classe: "dj-liste-amis" }, el("div", { classe: "dj-liste-amis__entete" }, titre, plafond), vide, liste);
  const rendre = () => {
    titre.textContent = t.t("amis.compteur", { n: amis.length });
    plafond.textContent = t.t("amis.max", { max });
    vide.hidden = amis.length > 0;
    liste.hidden = amis.length === 0;
    liste.replaceChildren(
      ...amis.map((ami) =>
        ligneAmi({
          t,
          ami,
          onRetirer: o.onRetirer,
          apresRetrait: (a) => {
            amis = amis.filter((x) => x.ref !== a.ref);
            rendre();
            titre.focus({ preventScroll: true });
            o.onChange?.(amis);
          },
        }),
      ),
    );
  };
  rendre();
  return {
    racine,
    maj(nouveaux, plafondNouveau) {
      amis = [...nouveaux];
      if (plafondNouveau !== undefined) max = plafondNouveau;
      rendre();
    },
    amis: () => amis,
  };
}

// --- Ajouter par pseudo ---------------------------------------------------------------------------------------------------------------------------------------------------

export interface OptionsAjoutAmi {
  t: TraducteurAmis;
  /** Ajoute par la référence d'une suggestion touchée, ou par le pseudo écrit (exact, sans casse ni accents). */
  onAjouter: (qui: { ref: string } | { pseudo: string }) => Promise<ResultatAction>;
  /** Cherche des pseudos qui commencent comme `q` (3 lettres au moins, appelé après une courte pause de frappe, la réponse en retard est ignorée) ; `null` : pas de réponse, aucune suggestion. */
  onSuggestions: (q: string) => Promise<readonly { ref: string; pseudo: string }[] | null>;
  /** L'ajout a réussi (la page relit sa liste). */
  apresAjout?: () => void;
  /** La pause de frappe avant de chercher, en millisecondes (250 par défaut). */
  pause?: number;
}

/** « Ajouter par pseudo » : un champ, « Ajouter », et les pseudos qui ressemblent (un toucher ajoute). Le champ est à 16 px (iOS ne zoome pas la page à la saisie). */
export function formulaireAjoutAmi(o: OptionsAjoutAmi): HTMLElement {
  const { t } = o;
  const id = nouvelId("dj-ajout-ami");
  const champ = el("input", { classe: "dj-ajout-ami__champ", attrs: { id, type: "text", name: "pseudo", autocomplete: "off", autocapitalize: "off", spellcheck: "false", enterkeyhint: "done" } });
  const envoyer = el("button", { classe: "dj-bouton dj-bouton--secondaire", attrs: { type: "submit" }, texte: t.t("amis.ajout.bouton") });
  const suggestions = el("ul", { classe: "dj-ajout-ami__suggestions", attrs: { "aria-label": t.t("amis.ajout.suggestions") } });
  suggestions.hidden = true;
  const message = messagerie();
  const formulaire = el(
    "form",
    { classe: "dj-ajout-ami", attrs: { novalidate: true } },
    el("label", { classe: "dj-ajout-ami__etiquette", attrs: { for: id }, texte: t.t("amis.ajout.titre") }),
    el("div", { classe: "dj-ajout-ami__rangee" }, champ, envoyer),
    suggestions,
    message.racine,
  );
  let minuteur: ReturnType<typeof setTimeout> | undefined;
  let sequence = 0;
  const effacerSuggestions = () => {
    sequence++;
    suggestions.hidden = true;
    suggestions.replaceChildren();
  };
  let occupe = false;
  const ajouter = async (qui: { ref: string; pseudo: string } | { pseudo: string }) => {
    if (occupe) return;
    occupe = true;
    envoyer.disabled = true;
    message.vider();
    const r = await executer(() => o.onAjouter("ref" in qui ? { ref: qui.ref } : qui));
    occupe = false;
    envoyer.disabled = false;
    if (r.ok) {
      const ami = (r.data as { ami?: { pseudo?: unknown } } | undefined)?.ami;
      message.dire(t.t("amis.ajout.fait", { pseudo: typeof ami?.pseudo === "string" ? ami.pseudo : qui.pseudo }));
      champ.value = "";
      effacerSuggestions();
      o.apresAjout?.();
    } else message.echec(messageErreur(t, r.code));
  };
  formulaire.addEventListener("submit", (e) => {
    e.preventDefault();
    const pseudo = champ.value.trim();
    if (pseudo) void ajouter({ pseudo });
  });
  champ.addEventListener("input", () => {
    clearTimeout(minuteur);
    const q = champ.value.trim();
    message.vider();
    if ([...q].length < LETTRES_MIN_SUGGESTION) return effacerSuggestions();
    minuteur = setTimeout(() => {
      const mien = ++sequence;
      void (async () => {
        const trouvees = await o.onSuggestions(q).catch(() => null);
        if (mien !== sequence) return; // une frappe plus récente a repris la main
        suggestions.replaceChildren(
          ...(trouvees ?? []).map((s) => {
            const b = el("button", { classe: "dj-ajout-ami__suggestion", attrs: { type: "button" }, texte: t.t("amis.ajout.suggestion", { pseudo: s.pseudo }) });
            b.addEventListener("click", () => void ajouter({ ref: s.ref, pseudo: s.pseudo }));
            return el("li", {}, b);
          }),
        );
        suggestions.hidden = suggestions.childElementCount === 0;
      })();
    }, o.pause ?? 250);
  });
  return formulaire;
}

// --- Ton lien d'invitation ------------------------------------------------------------------------------------------------------------------------------------------------

export interface OptionsInvitation {
  t: TraducteurAmis;
  /** Un lien est déjà actif (`invitation.active` de la liste) : le jeton ne se relit jamais, on ne peut qu'en créer un nouveau. */
  active: boolean;
  /** Crée (ou renouvelle) le lien et rend l'adresse complète (`adresseInvitation(origine, jeton)` de `@cdj/profile`). */
  creer: () => Promise<{ ok: true; lien: string } | { ok: false; code: string }>;
}

/**
 * « Inviter un ami (lien) » : crée le lien, le montre **une seule fois** avec « Copier le lien » et « Partager » (si le navigateur sait partager), « Nouveau lien » le renouvelle (l'ancien meurt : la phrase est
 * toujours écrite). Réciproque : celui qui accepte devient ton ami et toi le sien.
 */
export function blocInvitation(o: OptionsInvitation): HTMLElement {
  const { t } = o;
  const message = messagerie();
  const principal = bouton({ texte: "", variante: "marque", pleineLargeur: true, onClick: () => void creer() });
  const champ = el("input", { classe: "dj-invitation__lien dj-chiffres", attrs: { type: "text", readonly: true, "aria-label": t.t("amis.invitation.lien") } });
  const copier = bouton({ texte: t.t("amis.invitation.copier"), variante: "secondaire", onClick: () => void copierLeLien() });
  const partager = bouton({ texte: t.t("amis.invitation.partager"), variante: "secondaire", onClick: () => void partagerLeLien() });
  const actions = el("div", { classe: "dj-invitation__actions" }, copier, typeof navigator.share === "function" ? partager : null);
  const montre = el("div", { classe: "dj-invitation__montre" }, champ, actions);
  montre.hidden = true;
  const actif = el("p", { classe: "dj-invitation__texte", texte: t.t("amis.invitation.actif") });
  actif.hidden = !o.active;
  const avertissement = el("p", { classe: "dj-invitation__texte dj-invitation__avertissement", texte: t.t("amis.invitation.avertissement") });
  avertissement.hidden = !o.active;
  let lien: string | null = null;
  const libelle = () => {
    principal.textContent = lien !== null || o.active ? t.t("amis.invitation.nouveau") : t.t("amis.inviter.lien");
  };
  async function creer(): Promise<void> {
    if ((principal as HTMLButtonElement).disabled) return;
    (principal as HTMLButtonElement).disabled = true;
    message.vider();
    let r: Awaited<ReturnType<OptionsInvitation["creer"]>>;
    try {
      r = await o.creer();
    } catch {
      r = { ok: false, code: "network" };
    }
    (principal as HTMLButtonElement).disabled = false;
    if (!r.ok) return message.echec(messageErreur(t, r.code));
    lien = r.lien;
    champ.value = r.lien;
    montre.hidden = false;
    actif.hidden = true;
    avertissement.hidden = false;
    libelle();
    champ.focus({ preventScroll: true });
    champ.select();
  }
  async function copierLeLien(): Promise<void> {
    if (lien === null) return;
    try {
      await navigator.clipboard.writeText(lien);
      message.dire(t.t("amis.invitation.copie"));
    } catch {
      champ.focus();
      champ.select();
      message.echec(t.t("amis.invitation.pasDeCopie"));
    }
  }
  async function partagerLeLien(): Promise<void> {
    if (lien === null) return;
    try {
      await navigator.share({ url: lien, text: t.t("amis.invitation.partageTexte") });
    } catch (e) {
      // Une feuille de partage fermée n'est pas une erreur ; le reste se rabat sur la copie.
      if (!(e instanceof DOMException && e.name === "AbortError")) await copierLeLien();
    }
  }
  champ.addEventListener("focus", () => champ.select());
  libelle();
  return el("div", { classe: "dj-invitation" }, principal, actif, montre, avertissement, message.racine);
}

// --- Ce que voit la personne invitée --------------------------------------------------------------------------------------------------------------------------------

export interface OptionsCarteInvitation {
  t: TraducteurAmis;
  /** Le pseudo de qui invite (`voirInvitation`). */
  pseudo: string;
  /** Pas de profil sur cet appareil : la carte demande un pseudo (le profil est créé avec). */
  demanderPseudo: boolean;
  /** Accepte (le pseudo choisi, si on le demande). Un `name_taken` rend les pseudos libres dans `suggestions`. */
  onAccepter: (pseudo?: string) => Promise<ResultatAction>;
  /** L'amitié est faite (la page oublie le jeton, relit ses amis…). */
  apresAcceptation?: () => void;
}

/** La carte « {pseudo} t'invite sur Du Jour » avec « Accepter » (planche D) : bordure épaisse, ombre nette ; sans profil, un champ pour choisir son pseudo et les pseudos libres si le sien est pris. */
export function carteInvitation(o: OptionsCarteInvitation): HTMLElement {
  const { t } = o;
  const titreId = nouvelId("dj-carte-invitation");
  const message = messagerie();
  const idChamp = nouvelId("dj-carte-pseudo");
  const champ = o.demanderPseudo ? el("input", { classe: "dj-ajout-ami__champ", attrs: { id: idChamp, type: "text", name: "pseudo", autocomplete: "off", autocapitalize: "off", spellcheck: "false", enterkeyhint: "done" } }) : null;
  const libres = el("ul", { classe: "dj-ajout-ami__suggestions", attrs: { "aria-label": t.t("amis.invitation.suggestions") } });
  libres.hidden = true;
  const accepter = bouton({ texte: t.t("amis.invitation.accepter"), variante: "marque", pleineLargeur: true, onClick: () => void valider() });
  const racine = el(
    "section",
    { classe: "dj-carte-invitation", attrs: { "aria-labelledby": titreId } },
    el("h2", { classe: "dj-carte-invitation__titre", attrs: { id: titreId }, texte: t.t("amis.invitation.titre", { pseudo: o.pseudo }) }),
    el("p", { classe: "dj-carte-invitation__texte", texte: t.t("amis.invitation.texte") }),
    champ ? el("label", { classe: "dj-ajout-ami__etiquette", attrs: { for: idChamp }, texte: t.t("amis.invitation.pseudo") }) : null,
    champ,
    libres,
    accepter,
    message.racine,
  );
  async function valider(): Promise<void> {
    const btn = accepter as HTMLButtonElement;
    if (btn.disabled) return;
    const pseudo = champ?.value.trim();
    if (champ && !pseudo) {
      champ.focus();
      return;
    }
    btn.disabled = true;
    message.vider();
    libres.hidden = true;
    libres.replaceChildren();
    const r = await executer(() => o.onAccepter(pseudo));
    if (r.ok) {
      accepter.remove();
      champ?.setAttribute("disabled", "");
      message.dire(t.t("amis.invitation.fait", { pseudo: o.pseudo }));
      o.apresAcceptation?.();
      return;
    }
    btn.disabled = false;
    message.echec(messageErreur(t, r.code));
    if (champ && r.suggestions?.length) {
      libres.replaceChildren(
        ...r.suggestions.map((s) => {
          const b = el("button", { classe: "dj-ajout-ami__suggestion", attrs: { type: "button" }, texte: s });
          b.addEventListener("click", () => {
            champ.value = s;
            champ.focus();
          });
          return el("li", {}, b);
        }),
      );
      libres.hidden = false;
    }
  }
  champ?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void valider();
    }
  });
  return racine;
}
