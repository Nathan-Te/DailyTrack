import "@cdj/ui/src/styles.css";
import "@cdj/ui/src/polices/archivo-black-400.css";
import "@cdj/ui/src/polices/archivo-400.css";
import "@cdj/ui/src/polices/archivo-600.css";
import "@cdj/ui/src/polices/archivo-700.css";
import "@cdj/ui/src/polices/jetbrains-mono-700.css";
import "@cdj/ui/src/polices/barlow-condensed-800-italique.css";
import "@cdj/ui/src/polices/lilita-one-400.css";
import "./portail.css";
import "./messagesPortail.css";
import { parisDay } from "@cdj/clock";
import { ecrireLangue, lireLangue, readPlayerId, type Langue } from "@cdj/profile";
import { clientRetours, RETOUR_TEXTE_MAX, type FilDetail, type FilResume } from "@cdj/profile/src/retours";
import { CATALOGUE_COMMUN, barreJeu, bouton, cheminMentions, choixLangue, el, formatDateCourte, traducteur } from "@cdj/ui";
import { CATALOGUE_RETOURS } from "@cdj/ui/src/catalogue.retours";
import { CATALOGUE_PORTAIL } from "./catalogue";
import { CATALOGUE_PAGES } from "./cataloguePages";
import { baseApi } from "./jour";
import { numeroDeJournee } from "./jours";
import { lienRetours } from "./retoursLien";
import { stockageDuPortail } from "./stockage";
import { activerManette } from "@cdj/ui/src/manetteLien";

// Lot M1 : cette page se pilote à la manette (son action principale : une ligne de `manette.ts`, chargée avec le menu).
activerManette(() => import("./manette").then((m) => m.pour("messages")));

// Lot C1, partie A : « Mes messages » (`/messages/`, ouverte depuis le profil) — les fils que le joueur a ouverts avec « Un bug ? Une idée ? », les réponses de l'éditeur, et la réponse du joueur dans le fil.
//   - une liste (les plus récents d'abord) avec une pastille sur les fils qui ont une réponse à lire ; ouvrir un fil (`#<n>` dans l'adresse) le montre en entier et le marque lu **après l'affichage**
//     (`POST /api/retours/<n>/lu` : une lecture ne modifie jamais rien) ;
//   - **un message est un texte** : posé en `textContent`, jamais interprété ; l'identifiant secret part en `X-Player-Id`, jamais dans l'adresse.

const stockage = stockageDuPortail();
let langue: Langue = lireLangue(stockage, navigator.languages).langue;
const traduire = (l: Langue) => traducteur(l, CATALOGUE_PORTAIL, CATALOGUE_PAGES, CATALOGUE_COMMUN, CATALOGUE_RETOURS);
type T = ReturnType<typeof traduire>;
const id = stockage ? readPlayerId(stockage) : null;
const client = clientRetours({ base: baseApi(), playerId: id });

let liste: { etat: "chargement" } | { etat: "ok"; fils: FilResume[] } | { etat: "erreur"; code: string } = { etat: "chargement" };
let fil: { etat: "chargement" } | { etat: "ok"; detail: FilDetail } | { etat: "erreur"; code: string } | null = null;
let ouvert: number | null = null;
let envoi: { occupe: boolean; message: string | null } = { occupe: false, message: null };
/** Le texte de la réponse en cours d'écriture : il survit à un changement de langue. */
let brouillon = "";

const jourDe = (iso: string): number => parisDay(Date.parse(iso) || Date.now());
const lireAdresse = (): number | null => (/^#(\d{1,9})$/.exec(location.hash)?.[1] ? Number(location.hash.slice(1)) : null);

function messageErreur(t: T, code: string): string {
  if (code === "network" || code === "timeout") return t.t("portail.horsLigne");
  const cle = `erreur.${code}` as Parameters<T["t"]>[0];
  const texte = t.t(cle);
  return texte === cle ? t.t("messages.erreur") : texte;
}

function ligneDeFil(t: T, f: FilResume): HTMLElement {
  const lien = el(
    "a",
    { classe: "messages-fil__ouvrir", attrs: { href: `#${f.id}`, "aria-label": t.t("messages.fil.aria", { extrait: f.apercu }) } },
    el(
      "span",
      { classe: "messages-fil__tete" },
      el("span", { classe: "messages-fil__type", texte: t.t(`retours.type.${f.type}` as Parameters<T["t"]>[0]) }),
      el("span", { classe: "messages-fil__statut", texte: t.t(`messages.statut.${f.statut}` as Parameters<T["t"]>[0]) }),
      f.nonLu ? el("span", { classe: "messages-fil__nonlu", texte: t.t("messages.nonLu") }) : null,
    ),
    el("span", { classe: "messages-fil__apercu", texte: f.apercu }),
    el("span", { classe: "messages-fil__pied dj-chiffres", texte: `${formatDateCourte(jourDe(f.majLe), langue)} · ${t.t("messages.nombre", { n: f.messages })}` }),
  );
  return el("li", { classe: ["messages-fil", f.nonLu && "messages-fil--nonlu"] }, lien);
}

function vueListe(t: T): Node[] {
  if (liste.etat === "chargement") return [el("p", { classe: "profil-etat", attrs: { role: "status" }, texte: t.t("messagesPage.chargement") })];
  if (liste.etat === "erreur") {
    return [
      el("p", { classe: "profil-etat", attrs: { role: "alert" }, texte: messageErreur(t, liste.code) }),
      bouton({ texte: t.t("messages.reessayer"), variante: "secondaire", onClick: () => void chargerListe() }),
    ];
  }
  if (liste.fils.length === 0) return [el("p", { classe: "profil-etat", texte: t.t("messages.vide") })];
  return [el("ul", { classe: "messages-liste", attrs: { id: "messages-liste" } }, ...liste.fils.map((f) => ligneDeFil(t, f)))];
}

function bulle(t: T, auteur: "joueur" | "admin", texte: string, creeLe: string): HTMLElement {
  return el(
    "li",
    { classe: ["messages-bulle", `messages-bulle--${auteur}`] },
    el("p", { classe: "messages-bulle__auteur", texte: `${auteur === "admin" ? t.t("messages.editeur") : t.t("messages.toi")} · ${formatDateCourte(jourDe(creeLe), langue)}` }),
    el("p", { classe: "messages-bulle__texte", texte }), // un message est un texte
  );
}

function vueFil(t: T): Node[] {
  const retour = el("a", { classe: "messages-retour", attrs: { href: "#", id: "messages-retour" }, texte: t.t("messages.fil.retour") });
  if (!fil || fil.etat === "chargement") return [retour, el("p", { classe: "profil-etat", attrs: { role: "status" }, texte: t.t("messagesPage.chargement") })];
  if (fil.etat === "erreur") return [retour, el("p", { classe: "profil-etat", attrs: { role: "alert" }, texte: messageErreur(t, fil.code) })];
  const d = fil.detail;
  const champ = el("textarea", { classe: "messages-reponse__champ", attrs: { id: "messages-reponse", rows: 4, autocomplete: "off", spellcheck: "true", maxlength: RETOUR_TEXTE_MAX } }) as HTMLTextAreaElement;
  champ.value = brouillon;
  champ.addEventListener("input", () => (brouillon = champ.value));
  const envoyer = bouton({ texte: t.t("messages.envoyer"), variante: "marque", desactive: envoi.occupe, onClick: () => void repondre() });
  return [
    retour,
    el("p", { classe: "messages-fil__entete" }, el("span", { texte: t.t(`retours.type.${d.type}` as Parameters<T["t"]>[0]) }), el("span", { texte: t.t(`messages.statut.${d.statut}` as Parameters<T["t"]>[0]) })),
    el("ul", { classe: "messages-bulles", attrs: { id: "messages-bulles" } }, ...d.messages.map((m) => bulle(t, m.auteur, m.texte, m.creeLe))),
    d.peutRepondre
      ? el(
          "form",
          { classe: "messages-reponse", attrs: { id: "messages-form" } },
          el("label", { classe: "profil-etiquette-champ", attrs: { for: "messages-reponse" }, texte: t.t("messages.repondre.aide", { max: RETOUR_TEXTE_MAX }) }),
          champ,
          envoyer,
          envoi.message ? el("p", { classe: "profil-message", attrs: { id: "messages-message", role: "alert" }, texte: envoi.message }) : null,
        )
      : el("p", { classe: "profil-etat", texte: t.t("messages.plein") }),
  ];
}

function rendre(): void {
  const racine = document.getElementById("messages");
  if (!racine) return;
  const t = traduire(langue);
  const jour = parisDay(Date.now());
  document.documentElement.lang = langue;
  document.title = t.t("messagesPage.titre");
  document.querySelector('meta[name="description"]')?.setAttribute("content", t.t("messagesPage.description"));
  const corps = id === null ? [el("p", { classe: "profil-etat", attrs: { id: "messages-sans-profil" }, texte: t.t("messagesPage.sansProfil") })] : ouvert === null ? vueListe(t) : vueFil(t);
  const foyer = (document.activeElement as HTMLElement | null)?.id;
  racine.replaceChildren(
    barreJeu(t, { href: "../profil/", jour, numero: numeroDeJournee(jour) ?? undefined, retour: { texte: t.t("messagesPage.retour"), ariaLabel: t.t("messagesPage.retour.aria") } }),
    el("h1", { classe: "profil-titre", texte: t.t("messagesPage.titre") }),
    ...corps,
    el("section", { classe: "profil-section", attrs: { "aria-labelledby": "titre-langue" } }, el("h2", { classe: "profil-section__titre", attrs: { id: "titre-langue" }, texte: t.t("profil.langue.titre") }), choixLangue(t, { langue, onChange: changerLangue })),
    el(
      "footer",
      { classe: "portail-pied" },
      el("a", { classe: "portail-pied__lien", attrs: { id: "mentions", href: cheminMentions(langue, "../"), hreflang: langue }, texte: t.t("portail.mentions") }),
      lienRetours(t.t("portail.retours.lien"), langue, "../"),
    ),
  );
  if (foyer === "messages-reponse") document.getElementById("messages-reponse")?.focus();
}

function changerLangue(l: Langue): void {
  langue = l;
  ecrireLangue(stockage, l);
  rendre();
  document.querySelector<HTMLElement>(`.dj-choix-langue [data-langue="${l}"]`)?.focus();
}

async function chargerListe(): Promise<void> {
  if (id === null) return rendre();
  liste = { etat: "chargement" };
  rendre();
  const r = await client.lireFils();
  liste = r.ok ? { etat: "ok", fils: r.data.fils } : { etat: "erreur", code: r.code };
  rendre();
}

async function chargerFil(n: number): Promise<void> {
  fil = { etat: "chargement" };
  envoi = { occupe: false, message: null };
  brouillon = "";
  rendre();
  const r = await client.lireFil(n);
  if (ouvert !== n) return; // l'adresse a changé pendant la lecture
  fil = r.ok ? { etat: "ok", detail: r.data } : { etat: "erreur", code: r.code };
  rendre();
  // Marqué lu **après** l'affichage : la lecture elle-même ne modifie rien.
  if (r.ok && r.data.nonLu) void client.marquerLu(n);
}

async function repondre(): Promise<void> {
  if (!fil || fil.etat !== "ok" || envoi.occupe) return;
  const texte = brouillon.trim();
  const t = traduire(langue);
  if (texte === "" || [...texte].length > RETOUR_TEXTE_MAX) {
    envoi = { occupe: false, message: t.t("erreur.invalid_feedback") };
    return rendre();
  }
  envoi = { occupe: true, message: null };
  rendre();
  const n = fil.detail.id;
  const r = await client.repondre(n, texte);
  if (!r.ok) {
    envoi = { occupe: false, message: messageErreur(traduire(langue), r.code) };
    return rendre();
  }
  brouillon = "";
  envoi = { occupe: false, message: null };
  await chargerFil(n);
  document.getElementById("messages-reponse")?.focus();
}

function surAdresse(): void {
  const n = lireAdresse();
  if (n === ouvert) return;
  ouvert = n;
  if (n === null) {
    fil = null;
    void chargerListe(); // la liste se relit : un fil lu n'a plus sa pastille
  } else void chargerFil(n);
}

window.addEventListener("hashchange", surAdresse);
ouvert = lireAdresse();
if (ouvert === null) void chargerListe();
else void chargerFil(ouvert);
rendre();
