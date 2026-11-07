import "@cdj/ui/src/styles.css";
import "@cdj/ui/src/avatar.css";
import "@cdj/ui/src/avatar-liste.css";
import "@cdj/ui/src/avatar-grand.css"; // lot U3 : la photo de 128 px
import "@cdj/ui/src/polices/archivo-black-400.css";
import "@cdj/ui/src/polices/archivo-400.css";
import "@cdj/ui/src/polices/archivo-600.css";
import "@cdj/ui/src/polices/archivo-700.css";
import "@cdj/ui/src/polices/jetbrains-mono-700.css";
import "@cdj/ui/src/polices/barlow-condensed-800-italique.css";
import "@cdj/ui/src/polices/lilita-one-400.css";
// Lot K5 : la voix des jeux hors de leur page — la découpe « profil » (capitales, chiffres : 3 à 4 Ko) de la police de chaque jeu qui a une carte pilotée par sa fiche, et le motif de son étiquette (feuille du portail, `jeux.generated.css`).
import "@cdj/ui/src/polices-profil/rubik-mono-one-400.css";
import "@cdj/ui/src/polices-profil/bungee-400.css";
import "./portail.css";
import "./salle.css"; // lot U3 : la barre, le fronton et la barre d'onglets de la salle de jeux
import "./classementSalle.css";
import "./profilSalle.css";
import { parisDay } from "@cdj/clock";
import { parseDay } from "@cdj/core";
import {
  NAME_KEY,
  ProfileClient,
  adresseAvatar,
  call,
  clientAmis,
  clientAvatar,
  decodeTransfer,
  ecrireLangue,
  encodeTransfer,
  isValidName,
  lireLangue,
  noteIdentityChange,
  normalizeName,
  readIdentity,
  readPlayerId,
  writeIdentity,
  type ApiResult,
  type Langue,
} from "@cdj/profile";
import { CATALOGUE_COMMUN, avatar, MEDAILLES, bouton, choixLangue, el, etiquetteDe, formatDateCourte, formatNombre, formatRang, icone, medaille, svg, traducteur, tuile, cheminMentions } from "@cdj/ui";
import { initiales } from "@cdj/ui/src/avatar";
import { adresseGroupe, clientGroupes, type MonGroupe } from "@cdj/profile/src/groupes";
import { CATALOGUE_PORTAIL } from "./catalogue";
import { CATALOGUE_AMIS } from "@cdj/ui/src/catalogue.amis";
import { CATALOGUE_PAGES } from "./cataloguePages";
import { categorieDuJeu, ficheDuJeu, titreDeCarte } from "./jeuxFiches";
import { medaillesTotales, rangerLesJeux } from "./profilDonnees";
import { barreDePage, battre, frontonDeLaPage, ongletsDuBas } from "./salleDePage";
import { emblemeDeGroupe } from "./salle";
import { lienRetours } from "./retoursLien";
import { baseApi } from "./jour";
import { cartes } from "./jours";
import { lireRetour } from "./retour";
import { stockageDuPortail } from "./stockage";
import { activerManette } from "@cdj/ui/src/manetteLien";

// Lot M1 : cette page se pilote à la manette (son action principale : une ligne de `manette.ts`, chargée avec le menu).
activerManette(() => import("./manette").then((m) => m.pour("profil")));

// Lot I2 : le profil commun (`/profil/`), ouvert par l'avatar du portail. **Le même profil** que Réglages › Profil des jeux : même stockage
// (`cdj:player`, `cdj:name`, même origine), mêmes routes et mêmes refus (`PUT /api/player` pour le pseudo ; un code chargé est lu sur le
// serveur et confirmé avant de remplacer l'identité), et la révision d'identité du lot P4 (un code chargé ici avance `cdj:identite:code` :
// chaque jeu vide son cache de l'ancienne identité à son prochain démarrage). Une requête au chargement : `GET /api/portail/profil` (pseudo,
// série tous jeux, journées parfaites, et par jeu jours finis, médailles, meilleure place). Jamais de requête sans identité.

const stockage = stockageDuPortail();
let langue: Langue = lireLangue(stockage, navigator.languages).langue;
const traduire = (l: Langue) => traducteur(l, CATALOGUE_PORTAIL, CATALOGUE_PAGES, CATALOGUE_AMIS, CATALOGUE_COMMUN);
type T = ReturnType<typeof traduire>;
type Cle = Parameters<T["t"]>[0];
const cleConnue = (cle: string): Cle | null => (cle in CATALOGUE_PORTAIL.fr || cle in CATALOGUE_COMMUN.fr ? (cle as Cle) : null);
const API = baseApi();
const client = new ProfileClient(API);

/** Lot I4 : `?retour=/track/` (Réglages › « Mon profil Du Jour › » d'un jeu) : la barre ramène au jeu d'où l'on vient, par un chemin du site seulement (`retour.ts`). */
const retour = lireRetour(location.search);
function retourAuJeu(t: ReturnType<typeof traduire>): { href?: string; retour?: { texte: string; ariaLabel: string } } {
  if (!retour) return {};
  const nom = t.t(`jeu.${retour.jeu}.nom`);
  return { href: retour.chemin, retour: { texte: t.t(`jeu.${retour.jeu}.titre`), ariaLabel: t.t("profil.retour.aria", { jeu: nom }) } };
}

interface ProfilJeu {
  jeu: string;
  joursFinis: number;
  medailles: Record<"author" | "gold" | "silver" | "bronze", number>;
  meilleurRang: { date: string; rang: number; classes: number } | null;
}
interface Profil {
  pseudo: string;
  renameRequired: boolean;
  date: string;
  serie: number;
  aProlonger: boolean;
  journeesParfaites: number;
  aujourdhuiParfaite: boolean;
  /** Lot C1 : les réponses de l'éditeur qui attendent (« Mes messages »). */
  messagesNonLus?: number;
  /** Lot C1, partie B : l'empreinte de son image d'avatar (absente : ses initiales). */
  avatar?: string;
  jeux: ProfilJeu[];
}

const lireProfil = (id: string) => call<Profil>(API, "GET", "/api/portail/profil", undefined, 8000, { "X-Player-Id": id });

/** L'état de la page. */
let profil: ApiResult<Profil> | null = null;
let messagePseudo: { texte: string; suggestions?: string[] } | null = null;
let messageCode: string | null = null;
let apercu: { id: string; profil: Profil } | null = null;
/** Lot C1, partie B : le dernier message de la section Avatar. */
let messageAvatar: string | null = null;
/** Lot U3 : ce que l'en-tête dit en plus de la réponse du profil — combien d'amis, et ton groupe (`undefined` : pas encore lu ; `null` : aucun). */
let nbAmis: number | null = null;
let groupe: MonGroupe | null | undefined;
/** Lot U3 : l'en-tête (amis, groupe) est lu — le module « Mon groupe » ne relit pas ce qu'il sait déjà. */
let enTeteLu = false;
/** Lot U3 : « Changer de pseudo » ouvre le formulaire du pseudo sous l'en-tête. */
let pseudoOuvert = false;

/** Choisir et recadrer une image (module à la demande), l'envoyer, puis redessiner ; chaque refus du serveur a sa phrase. */
async function changerAvatar(): Promise<void> {
  const id = stockage ? readPlayerId(stockage) : null;
  if (!id || !profil?.ok) return;
  const t = traduire(langue);
  const dire = (cle: string, params?: Record<string, string | number>) => t.t(cle as never, params as never);
  const r = await (await import("./avatarEdition")).choisirImage(dire);
  if (!r.ok) {
    messageAvatar = r.code === "annule" ? null : t.t(r.code === "trop_lourde" ? "profil.avatar.lourde" : "profil.avatar.illisible");
    return rendre();
  }
  const envoi = await clientAvatar({ base: API, playerId: id }).envoyer(r.base64);
  if (envoi.ok) {
    profil.data.avatar = envoi.data.avatar;
    messageAvatar = t.t("profil.avatar.fait");
  } else {
    messageAvatar = t.t(envoi.code === "avatar_limit" ? "profil.avatar.limite" : envoi.code === "avatar_banned" ? "profil.avatar.interdit" : envoi.code === "invalid_image" ? "profil.avatar.refus" : "portail.horsLigne");
  }
  rendre();
}
async function retirerAvatar(): Promise<void> {
  const id = stockage ? readPlayerId(stockage) : null;
  if (!id || !profil?.ok) return;
  const t = traduire(langue);
  const r = await clientAvatar({ base: API, playerId: id }).retirer();
  if (r.ok) {
    delete profil.data.avatar;
    messageAvatar = t.t("profil.avatar.retiree");
  } else messageAvatar = t.t("portail.horsLigne");
  rendre();
}

/** Un échec du serveur ou du réseau, traduit (code d'erreur du catalogue commun). */
function erreur(t: T, r: { code: string }): string {
  if (r.code === "timeout") return t.t("portail.delai");
  return t.t(cleConnue(`erreur.${r.code}`) ?? "portail.horsLigne");
}

const MED = { author: "diamant", gold: "or", silver: "argent", bronze: "bronze" } as const;

function blocJeu(t: T, j: ProfilJeu): HTMLElement | null {
  const carte = cartes(0).find((c) => c.jeu === j.jeu);
  if (!carte) return null;
  const numero = t.t("profil.jours", { n: j.joursFinis });
  const rang = j.meilleurRang
    ? t.t("profil.meilleurRang", { rang: formatRang(j.meilleurRang.rang, langue), classes: formatNombre(j.meilleurRang.classes, langue), date: formatDateCourte(parseDay(j.meilleurRang.date) ?? 0, langue) })
    : t.t("profil.pasClasse");
  const medailles = el(
    "div",
    { classe: "profil-medailles", attrs: { role: "group", "aria-label": t.t("profil.medailles") } },
    ...MEDAILLES.map((type) => {
      const cle = (Object.keys(MED) as (keyof typeof MED)[]).find((k) => MED[k] === type)!;
      const n = j.medailles[cle] ?? 0;
      return medaille(t, { type, obtenue: n > 0, forme: "case", jeu: carte.code, valeur: formatNombre(n, langue) });
    }),
  );
  // Lots K1 à K1c : la fiche d'un jeu donne son titre (à défaut, son nom en capitales : Tower n'a pas de `jeu.tower.titre`, comme sur l'accueil, `portail.ts`).
  const fiche = ficheDuJeu(carte.code)!;
  // Lot K5 : un jeu qui a un fichier d'illustration (Tower, Blocks, Rush…) a une carte tirée de sa fiche — sa police, son motif, son illustration (charte rév. 18 § 9) ; Track et Jump gardent leurs cartes faites à la main.
  if (fiche.illustration) return carteDuProfil(carte.code, titreDeCarte(fiche, t, t.t(`jeu.${carte.code}.nom` as const)), numero, rang, medailles);
  const titre = titreDeCarte(fiche, t, t.t(`jeu.${carte.code}.nom` as const));
  const o = { titre, numero, texte: rang, suite: medailles, niveau: "h3" as const };
  const e = etiquetteDe(carte.code, o);
  e.setAttribute("data-jeu", carte.code);
  return e;
}

/** Lot K5 : la carte d'un jeu au profil (planche 2 de `jeux-du-kit-au-niveau.html`) — le nom dans la police du jeu, le motif de son étiquette, ses médailles en cases pleines, son illustration à gauche (lot U3 : la cartouche est horizontale ; l'image est décorative). */
function carteDuProfil(code: string, titre: string, numero: string, rang: string, medailles: HTMLElement): HTMLElement {
  return el(
    "article",
    { classe: ["profil-jeu", `jeu-etiquette--${code}`], attrs: { "data-jeu": code, "aria-label": titre } },
    el("img", { classe: "profil-jeu__dessin", attrs: { src: `../${code}/illustration.svg`, alt: "", "aria-hidden": "true", decoding: "async" } }),
    el("div", { classe: "profil-jeu__corps" }, el("div", { classe: "profil-jeu__tete" }, el("h3", { classe: "profil-jeu__titre", texte: titre }), el("span", { classe: "profil-jeu__numero", texte: numero })), el("p", { classe: "profil-jeu__rang", texte: rang }), medailles),
  );
}

/** Un titre de section : un filet d'encre, le titre en Archivo Black et, à droite, un petit texte. */
function titreDeSection(id: string, titre: string, droite?: string): HTMLElement {
  return el("div", { classe: "profil-titre-s" }, el("h2", { attrs: { id }, texte: titre }), droite ? el("span", { texte: droite }) : null);
}

/** Un panneau de la colonne de droite (cadre papier, ombre nette). */
function panneauDeDroite(id: string, titre: string, ...enfants: (Node | null)[]): HTMLElement {
  return el("section", { classe: "salle-panneau profil-panneau", attrs: { id, "aria-labelledby": `${id}-titre` } }, el("h2", { classe: "salle-panneau__titre", attrs: { id: `${id}-titre` }, texte: titre }), ...enfants);
}

/** La photo en grand (128 px) avec le crayon moutarde : il ouvre le recadrage (choisir une image, la recadrer en carré, l'envoyer). */
function photoDuProfil(t: T, pseudo: string, image: string | undefined): HTMLElement {
  const crayon = el("button", { classe: "profil-crayon", attrs: { type: "button", "aria-label": t.t("profil.avatar.choisir"), title: t.t("profil.avatar.aide"), "data-cle": "avatar-choisir" } }, crayonDessin());
  crayon.addEventListener("click", () => void changerAvatar());
  return el("div", { classe: "profil-photo", attrs: { id: "photo-profil" } }, avatar(t, { pseudo, image, taille: 128, decoratif: true }), crayon);
}
/** Le crayon (grille de 24, trait de 2,4 px, encre) : le dessin du bouton qui change la photo. */
const crayonDessin = (): SVGSVGElement =>
  svg("svg", { attrs: { viewBox: "0 0 24 24", width: 18, height: 18, fill: "none", stroke: "currentColor", "stroke-width": 2.4, "stroke-linecap": "round", "stroke-linejoin": "round", focusable: "false", "aria-hidden": "true" } }, svg("path", { attrs: { d: "M4 20l1-5L16 4l4 4L9 19z" } }));

/** L'en-tête : la photo, le pseudo, l'emblème de ton groupe, le nombre d'amis, « Changer de pseudo ». */
function entete(t: T, pseudo: string, p: Profil | null): HTMLElement {
  const lien = el("button", { classe: "profil-lien", attrs: { type: "button", id: "pseudo-lien", "aria-expanded": String(pseudoOuvert), "aria-controls": "pseudo", "data-cle": "pseudo-lien" }, texte: t.t("profil.pseudo.lien") });
  lien.addEventListener("click", () => {
    pseudoOuvert = !pseudoOuvert;
    rendre();
    if (pseudoOuvert) document.getElementById("pseudo-champ")?.focus();
  });
  const meta: (Node | string | null)[] = [];
  const separe = () => (meta.length > 0 ? el("span", { attrs: { "aria-hidden": "true" }, texte: "·" }) : null);
  if (groupe) {
    meta.push(
      emblemeDeGroupe({ initiales: initiales(groupe.nom, langue), image: adresseAvatar(API, groupe.avatar), taille: 48 }),
      el("a", { classe: "profil-groupe-nom", attrs: { href: adresseGroupe("", groupe.nom), id: "profil-groupe-nom" } }, groupe.nom),
    );
  }
  if (nbAmis !== null) meta.push(separe(), el("a", { classe: "profil-amis", attrs: { href: "../amis/", id: "profil-amis" }, texte: t.t("amisPage.mes.nombre", { n: nbAmis }) }));
  meta.push(separe(), lien);
  return el(
    "div",
    { classe: "profil-identite" },
    photoDuProfil(t, pseudo, p ? adresseAvatar(API, p.avatar) : undefined),
    el("div", { classe: "profil-identite__texte" }, el("h2", { classe: "profil-identite__pseudo", attrs: { id: "pseudo-actuel" }, texte: pseudo }), el("div", { classe: "profil-meta" }, ...meta.filter((m): m is Node | string => m !== null))),
  );
}

/** « Tous les jeux » : la série en cours (tuile d'encre), les journées parfaites et les médailles de tous les jeux en cases pleines. */
function tousLesJeux(t: T, p: Profil): HTMLElement {
  const total = medaillesTotales(p.jeux);
  const serie = tuile({ legende: t.t("portail.serie.legende"), valeur: t.t("portail.serie.valeur", { n: p.serie }), sousTexte: p.aProlonger ? t.t("portail.serie.aProlonger") : undefined, icone: icone("flamme", { taille: 22 }) });
  serie.classList.add("profil-tuile--encre");
  const cases = el(
    "div",
    { classe: "profil-medailles profil-medailles--tous", attrs: { role: "group", "aria-label": t.t("profil.medailles") } },
    ...MEDAILLES.map((type) => {
      const cle = (Object.keys(MED) as (keyof typeof MED)[]).find((k) => MED[k] === type)!;
      return medaille(t, { type, obtenue: total[cle] > 0, forme: "case", valeur: formatNombre(total[cle], langue) });
    }),
  );
  return el(
    "section",
    { classe: "profil-tous", attrs: { "aria-labelledby": "titre-serie" } },
    titreDeSection("titre-serie", t.t("profil.serie.titre")),
    el(
      "div",
      { classe: "profil-tuiles" },
      serie,
      tuile({ legende: t.t("profil.parfaites.legende"), valeur: formatNombre(p.journeesParfaites, langue), sousTexte: p.aujourdhuiParfaite ? t.t("portail.serie.parfaiteAujourdhui") : undefined }),
      el("div", { classe: "profil-tuile-medailles" }, cases),
    ),
  );
}

/** « Par jeu » : une cartouche par jeu, ceux du jour d'abord, puis l'arcade. */
function parJeu(t: T, p: Profil, day: number): HTMLElement {
  const rangs = rangerLesJeux(p.jeux, (j) => {
    const c = cartes(0).find((x) => x.jeu === j.jeu);
    return c && categorieDuJeu(c.code, day) === "arcade" ? "arcade" : "jour";
  });
  const groupeDe = (id: string, titre: string, jeux: ProfilJeu[]): (HTMLElement | null)[] =>
    jeux.length === 0 ? [] : [el("p", { classe: "profil-cat", texte: titre }), el("div", { classe: "profil-jeux", attrs: { id } }, ...jeux.map((j) => blocJeu(t, j)))];
  return el(
    "section",
    { classe: "profil-par-jeu", attrs: { "aria-labelledby": "titre-jeux" } },
    titreDeSection("titre-jeux", t.t("profil.jeux.titre"), t.t("profil.jeux.nombre", { n: p.jeux.length })),
    ...groupeDe("profil-jeux-jour", t.t("profil.jeux.jour"), rangs.jour),
    ...groupeDe("profil-jeux-arcade", t.t("profil.jeux.arcade"), rangs.arcade),
  );
}

function rendre(): void {
  const racine = document.getElementById("profil");
  if (!racine) return;
  const t = traduire(langue);
  const focus = (document.activeElement as HTMLElement | null)?.getAttribute("data-cle");
  document.documentElement.lang = langue;
  document.title = t.t("profil.titre");
  document.querySelector('meta[name="description"]')?.setAttribute("content", t.t("profil.description"));
  const id = stockage ? readPlayerId(stockage) : null;
  const identite = readIdentity(stockage);
  const p = profil?.ok ? profil.data : null;
  const day = (p && parseDay(p.date)) ?? parisDay(Date.now());

  let etat: string | null = null;
  if (!id) etat = t.t("profil.sansProfil");
  else if (!profil) etat = t.t("profil.chargement");
  else if (!profil.ok) etat = profil.code === "unknown_player" ? t.t("profil.inconnu") : erreur(t, profil);

  // Le pseudo : celui du serveur (il fait foi), sinon celui de cet appareil.
  const pseudo = p?.pseudo ?? identite.name;
  const champ = el("input", { classe: "profil-champ", attrs: { id: "pseudo-champ", name: "pseudo", type: "text", maxlength: 20, autocomplete: "nickname", value: pseudo ?? "", "data-cle": "pseudo-champ" } });
  const formPseudo =
    p && pseudoOuvert
      ? el(
          "form",
          { classe: "profil-formulaire", attrs: { id: "pseudo" } },
          el("label", { classe: "profil-etiquette-champ", attrs: { for: "pseudo-champ" }, texte: t.t("profil.pseudo.champ") }),
          el("div", { classe: "profil-ligne" }, champ, bouton({ texte: t.t("profil.pseudo.changer"), variante: "secondaire" })),
          el("p", { classe: "profil-aide", texte: t.t("profil.pseudo.regle") }),
        )
      : null;
  formPseudo?.querySelector("button")?.setAttribute("type", "submit");
  formPseudo?.addEventListener("submit", (e) => {
    e.preventDefault();
    void renommer((champ as HTMLInputElement).value);
  });

  // Le code de transfert : affiché, copié ; charger un code (lu sur le serveur, confirmé).
  const code = id ? encodeTransfer(id) : null;
  const champCode = el("input", { classe: "profil-champ profil-champ--code", attrs: { id: "code-champ", name: "code", type: "text", autocomplete: "off", spellcheck: "false", "data-cle": "code-champ" } });
  const formCode = el(
    "form",
    { classe: "profil-formulaire", attrs: { id: "charger" } },
    el("label", { classe: "profil-etiquette-champ", attrs: { for: "code-champ" }, texte: t.t("profil.code.champ") }),
    el("div", { classe: "profil-ligne" }, champCode, bouton({ texte: t.t("profil.code.verifier"), variante: "secondaire" })),
  );
  formCode.querySelector("button")?.setAttribute("type", "submit");
  formCode.addEventListener("submit", (e) => {
    e.preventDefault();
    void verifierCode((champCode as HTMLInputElement).value);
  });

  const nonLus = p?.messagesNonLus ?? 0;
  const gauche: (HTMLElement | null)[] = [
    etat ? el("p", { classe: "profil-etat", attrs: { id: "profil-etat", role: "status" }, texte: etat }) : null,
    id && p ? entete(t, pseudo ?? "—", p) : id ? el("h2", { classe: "profil-identite__pseudo", attrs: { id: "pseudo-actuel" }, texte: pseudo ?? "—" }) : null,
    p ? el("p", { classe: "profil-aide", texte: t.t("profil.avatar.regles") }) : null,
    messageAvatar ? el("p", { classe: "profil-message", attrs: { id: "avatar-message", role: "status" }, texte: messageAvatar }) : null,
    p && p.avatar ? bouton({ texte: t.t("profil.avatar.retirer"), variante: "secondaire", onClick: () => void retirerAvatar() }) : null,
    formPseudo,
    messagePseudo ? el("p", { classe: "profil-message", attrs: { id: "pseudo-message", role: "status" }, texte: messagePseudo.texte }) : null,
    messagePseudo?.suggestions?.length
      ? el("div", { classe: "profil-ligne", attrs: { role: "group", "aria-label": t.t("profil.pseudo.libres") } }, ...messagePseudo.suggestions.map((s) => bouton({ texte: s, variante: "secondaire", onClick: () => void renommer(s) })))
      : null,
    p ? tousLesJeux(t, p) : null,
    p ? parJeu(t, p, day) : null,
  ];
  const droite: (HTMLElement | null)[] = [
    // Lot C1 : « Mes messages » (la page `/messages/`) : les réponses de l'éditeur, avec le nombre de celles qui attendent.
    id
      ? panneauDeDroite(
          "profil-messages",
          t.t("profil.messages.titre"),
          el("p", { classe: "profil-aide", texte: t.t("profil.messages.aide") }),
          nonLus > 0 ? el("p", { classe: "profil-message profil-messages-nonlu", attrs: { id: "messages-non-lus", role: "status" } }, el("span", { classe: "profil-pastille", attrs: { "aria-hidden": "true" }, texte: formatNombre(nonLus, langue) }), t.t("profil.messages.nonLu", { n: nonLus })) : null,
          bouton({ texte: t.t("profil.messages.lien"), variante: "marque", href: "../messages/" }),
        )
      : null,
    panneauDeDroite(
      "profil-code",
      t.t("profil.code.titre"),
      el("p", { classe: "profil-aide", texte: t.t("profil.code.aide") }),
      code ? el("code", { classe: "profil-code", attrs: { id: "code" }, texte: code }) : null,
      code ? bouton({ texte: t.t("profil.code.copier"), variante: "secondaire", onClick: () => void copier(code) }) : null,
      el("h3", { classe: "profil-sous-titre", texte: t.t("profil.code.charger") }),
      formCode,
      apercu
        ? el(
            "div",
            { classe: "profil-apercu", attrs: { id: "apercu", role: "group", "aria-labelledby": "apercu-texte" } },
            el("p", { attrs: { id: "apercu-texte" }, texte: t.t("profil.code.apercu", { nom: apercu.profil.pseudo, n: apercu.profil.jeux.reduce((s, j) => Math.max(s, j.joursFinis), 0) }) }),
            el("div", { classe: "profil-ligne" }, bouton({ texte: t.t("profil.code.confirmer"), variante: "marque", onClick: () => chargerCode() }), bouton({ texte: t.t("profil.code.annuler"), variante: "secondaire", onClick: () => ((apercu = null), rendre()) })),
          )
        : null,
      messageCode ? el("p", { classe: "profil-message", attrs: { id: "code-message", role: "status" }, texte: messageCode }) : null,
    ),
    panneauDeDroite("profil-langue", t.t("profil.langue.titre"), choixLangue(t, { langue, onChange: changerLangue })),
    // Lot C1, partie C : « Mon groupe » (créer, inviter, gérer, quitter), dessiné à la demande dans la zone ci-dessous (`groupeProfil.ts`) ; la gestion du chef reste ici (lot U3).
    id ? panneauDeDroite("groupe", t.t("profil.groupe.titre"), el("p", { classe: "profil-aide", texte: t.t("profil.groupe.aide") }), el("div", { attrs: { id: "groupe-zone" } })) : null,
  ];
  const retourJeu = retourAuJeu(t);
  const pieces: (Node | null)[] = [
    barreDePage({ t, langue, ici: "profil", stockage, identifie: id !== null, avatar: p?.avatar, onLangue: changerLangue }),
    frontonDeLaPage({ t, langue, titre: t.t("profil.titre"), jour: day }),
    retourJeu.retour ? el("a", { classe: "dj-barre-jeu__retour profil-retour", attrs: { href: retourJeu.href ?? "../", "aria-label": retourJeu.retour.ariaLabel } }, `‹ ${retourJeu.retour.texte}`) : null,
    el("div", { classe: "salle-page profil-page" }, el("div", { classe: "profil-gauche" }, ...gauche.filter((e): e is HTMLElement => e !== null)), el("aside", { classe: "profil-droite" }, ...droite.filter((e): e is HTMLElement => e !== null))),
    el(
      "footer",
      { classe: "portail-pied salle-pied" },
      el("a", { classe: "portail-pied__lien", attrs: { id: "mentions", href: cheminMentions(langue, "../"), hreflang: langue }, texte: t.t("portail.mentions") }),
      lienRetours(t.t("portail.retours.lien"), langue, "../"),
    ),
    ongletsDuBas(t, "profil"),
  ];
  racine.replaceChildren(...pieces.filter((e): e is Node => e !== null));
  if (focus) racine.querySelector<HTMLElement>(`[data-cle="${focus}"]`)?.focus();
  const zoneGroupe = racine.querySelector<HTMLElement>("#groupe-zone");
  const idGroupe = stockage ? readPlayerId(stockage) : null;
  if (zoneGroupe && idGroupe && enTeteLu) {
    void import("./groupeProfil").then((m) =>
      m.monterGroupe(zoneGroupe, {
        tr: t,
        langue,
        base: API,
        id: idGroupe,
        // Le groupe est déjà lu pour l'en-tête : le module ne le relit pas ; un changement (créé, renommé, quitté) remet l'en-tête à jour.
        ...(groupe !== undefined ? { initial: groupe } : {}),
        surChangement: (g) => {
          const avant = groupe;
          groupe = g;
          if (avant === undefined || avant?.nom !== g?.nom || avant?.avatar !== g?.avatar) rendre();
        },
      }),
    );
  }
}

async function charger(): Promise<void> {
  const id = stockage ? readPlayerId(stockage) : null;
  if (!id) return;
  profil = await lireProfil(id);
  if (profil.ok && stockage) {
    try {
      if (stockage.getItem(NAME_KEY) !== profil.data.pseudo) stockage.setItem(NAME_KEY, profil.data.pseudo); // le pseudo du serveur fait foi
    } catch {
      /* stockage refusé */
    }
  }
  rendre();
  if (profil.ok) void lireEnTete(id);
}

/** Lot U3 : le nombre d'amis et ton groupe, pour l'en-tête (deux lectures, après le profil ; un échec n'ajoute simplement rien à l'en-tête). */
async function lireEnTete(id: string): Promise<void> {
  const [a, g] = await Promise.all([clientAmis({ base: API, playerId: id }).lireAmis(), clientGroupes({ base: API, playerId: id }).moi()]);
  if (a.ok) nbAmis = a.data.total;
  if (g.ok) groupe = g.data;
  enTeteLu = true;
  rendre();
}

/** Changer de pseudo : les règles et les refus du serveur (pseudo pris : pseudos libres à toucher). */
async function renommer(saisi: string): Promise<void> {
  const t = traduire(langue);
  const id = stockage ? readPlayerId(stockage) : null;
  const nom = normalizeName(saisi);
  if (!id) return;
  if (!isValidName(nom)) {
    messagePseudo = { texte: t.t("erreur.invalid_name") };
    return rendre();
  }
  const r = await client.rename(id, nom);
  if (r.ok) {
    messagePseudo = { texte: t.t("profil.pseudo.change", { nom: r.data.name }) };
    pseudoOuvert = false;
    try {
      stockage?.setItem(NAME_KEY, r.data.name);
    } catch {
      /* stockage refusé */
    }
    if (profil?.ok) profil = { ok: true, data: { ...profil.data, pseudo: r.data.name } };
  } else messagePseudo = { texte: erreur(t, r), suggestions: r.suggestions };
  rendre();
}

async function copier(code: string): Promise<void> {
  const t = traduire(langue);
  try {
    await navigator.clipboard.writeText(code);
    messageCode = t.t("profil.code.copie");
  } catch {
    messageCode = t.t("profil.code.pasDeCopie");
  }
  rendre();
}

/** Charger un code : lu, puis le profil du serveur montré ; rien ne change avant la confirmation. */
async function verifierCode(saisi: string): Promise<void> {
  const t = traduire(langue);
  apercu = null;
  const d = decodeTransfer(saisi);
  if (!d.ok || d.data.version !== 2) {
    messageCode = t.t("profil.code.illisible");
    return rendre();
  }
  if (stockage && readPlayerId(stockage) === d.data.id) {
    messageCode = t.t("profil.code.deja");
    return rendre();
  }
  const r = await lireProfil(d.data.id);
  if (!r.ok) messageCode = erreur(t, r);
  else {
    messageCode = null;
    apercu = { id: d.data.id, profil: r.data };
  }
  rendre();
}

function chargerCode(): void {
  if (!apercu || !stockage) return;
  const t = traduire(langue);
  writeIdentity({ id: apercu.id, name: apercu.profil.pseudo }, stockage);
  // Un code chargé (lot P4) : chaque jeu vide son cache de l'ancienne identité à son prochain démarrage.
  noteIdentityChange(stockage, "code");
  profil = { ok: true, data: apercu.profil };
  messageCode = t.t("profil.code.charge", { nom: apercu.profil.pseudo });
  apercu = null;
  messagePseudo = null;
  rendre();
}

function changerLangue(l: Langue): void {
  langue = l;
  ecrireLangue(stockage, l);
  rendre();
  document.querySelector<HTMLElement>(`.dj-choix-langue [data-langue="${l}"]`)?.focus();
}

async function demarrer(): Promise<void> {
  // Recette et aperçus seulement : `/profil/?demo=joueur` installe le joueur de démonstration (absent de la construction de production), comme l'accueil.
  if (__PORTAIL_DEMO__ && new URLSearchParams(location.search).has("demo")) {
    const racine = document.getElementById("profil");
    const { lienDemo } = await import("./demo");
    if (racine) await lienDemo(stockage, langue, racine);
  }
  rendre();
  void charger();
  battre();
}

void demarrer();
