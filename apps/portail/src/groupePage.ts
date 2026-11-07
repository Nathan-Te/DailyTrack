import "@cdj/ui/src/styles.css";
import "@cdj/ui/src/avatar.css";
import "@cdj/ui/src/avatar-liste.css";
import "@cdj/ui/src/avatar-grand.css"; // lot U5 : les photos de 52 px des membres
import "@cdj/ui/src/polices/archivo-black-400.css";
import "@cdj/ui/src/polices/archivo-400.css";
import "@cdj/ui/src/polices/archivo-600.css";
import "@cdj/ui/src/polices/archivo-700.css";
import "@cdj/ui/src/polices/jetbrains-mono-700.css";
import "@cdj/ui/src/polices/barlow-condensed-800-italique.css";
import "@cdj/ui/src/polices/lilita-one-400.css";
import "./portail.css";
import "./amisPortail.css";
import "./salle.css"; // lot U5 : la barre, le fronton et la barre d'onglets de la salle de jeux
import "./classementSalle.css";
import "./groupesPortail.css";
import "./pagesSalle.css";
import { parisDay } from "@cdj/clock";
import { parseDay } from "@cdj/core";
import { adresseAvatar, clientAvatar, ecrireLangue, lireLangue, readPlayerId, type Langue } from "@cdj/profile";
import { adresseInvitationGroupe, clientGroupes, nomDansLeChemin, retirerInvitationDeLAdresse, type Invitation, type MonGroupe, type PageGroupe } from "@cdj/profile/src/groupes";
import { CATALOGUE_COMMUN, avatar, bouton, cheminMentions, el, formatDate, formatNombre, formatRang, formatScore, traducteur } from "@cdj/ui";
import { initiales } from "@cdj/ui/src/avatar";
import { formatDeVue } from "./formatDeVue";
import { CATALOGUE_AMIS } from "@cdj/ui/src/catalogue.amis";
import { CATALOGUE_PORTAIL } from "./catalogue";
import { CATALOGUE_PAGES } from "./cataloguePages";
import { barreDePage, battre, frontonDeLaPage, ongletsDuBas, traducteurDePage } from "./salleDePage";
import { emblemeDeGroupe, panneau } from "./salle";
import { baseApi } from "./jour";
import { lienRetours } from "./retoursLien";
import { stockageDuPortail } from "./stockage";
import { activerManette } from "@cdj/ui/src/manetteLien";

// Lot M1 : cette page se pilote à la manette (son action principale : une ligne de `manette.ts`, chargée avec le menu).
activerManette(() => import("./manette").then((m) => m.pour("groupe")));

// Lot C1, partie C : la page publique d'un groupe (`/groupe/<nom>`, servie à toute adresse de ce dossier par Hosting). Elle montre son emblème, sa description, ses membres, son rang du jour dans chaque vue
// (Cumulé, un jeu : « 4e sur 12 », ou « Moins de 3 classés » sans rang) et, quand l'adresse porte `?invitation=<jeton>`, la carte « Rejoindre ce groupe ». **Le jeton quitte l'adresse tout de suite**
// (`history.replaceState`) et ne vit qu'en mémoire : rouvrir le lien le redonne. Un membre peut partager le lien du groupe ; « Signaler l'image » est toujours là quand il y a un emblème. Les chemins sont absolus
// (la page est servie à n'importe quelle profondeur) ; tout texte du serveur est posé en `textContent`.

const nom = nomDansLeChemin(location.pathname);
const { jeton, adresse } = retirerInvitationDeLAdresse(location.href);
if (location.search.includes("invitation")) history.replaceState(null, "", adresse);

const stockage = stockageDuPortail();
let langue: Langue = lireLangue(stockage, navigator.languages).langue;
const traduire = (l: Langue) => traducteur(l, CATALOGUE_PORTAIL, CATALOGUE_PAGES, CATALOGUE_AMIS, CATALOGUE_COMMUN);
const identifiant = (): string | null => (stockage ? readPlayerId(stockage) : null);
const client = clientGroupes({ base: baseApi(), playerId: identifiant });
const signalement = clientAvatar({ base: baseApi(), playerId: identifiant });

let page: PageGroupe | null = null;
let erreur: string | null = null;
let chargement = true;
let moi: MonGroupe | null = null;
let invitation: Invitation | null = null;
let messageInvitation: { texte: string; echec: boolean } | null = null;
let messageEmbleme: string | null = null;
let occupe = false;

const nomDeVue = (t: ReturnType<typeof traduire>, vue: string): string => {
  if (vue === "cumul") return t.t("classement.vue.cumul");
  const cle = `jeu.${vue}.nom`; // le dossier d'un jeu est l'identifiant de sa fiche (`jeu.<id>.nom` du catalogue commun)
  return cle in CATALOGUE_COMMUN.fr ? t.t(cle as never) : vue;
};
const valeurDeVue = (r: { vue: string; sens: "temps" | "hauteur"; score: number }): string => formatScore(formatDeVue(r.vue, r.sens), r.score, langue);

function erreurLisible(t: ReturnType<typeof traduire>, code: string): string {
  const cle = `erreur.${code}`;
  return cle in CATALOGUE_AMIS.fr || cle in CATALOGUE_COMMUN.fr ? t.t(cle as never) : t.t("portail.horsLigne");
}

function carteInvitation(t: ReturnType<typeof traduire>): HTMLElement | null {
  if (!jeton || !invitation) return null;
  const dejaMembre = moi !== null;
  const rejoindre = bouton({
    texte: t.t("groupePage.rejoindre"),
    variante: "marque",
    pleineLargeur: true,
    desactive: occupe || invitation.plein || dejaMembre || identifiant() === null,
    onClick: async () => {
      if (!jeton || occupe) return;
      occupe = true;
      messageInvitation = null;
      construire();
      const r = await client.rejoindre(jeton);
      occupe = false;
      if (r.ok) {
        messageInvitation = { texte: t.t("groupePage.rejoint"), echec: false };
        invitation = null;
        await lire();
      } else messageInvitation = { texte: r.code === "unknown_group" ? t.t("groupePage.invitationMorte") : erreurLisible(t, r.code), echec: true };
      construire();
    },
  });
  rejoindre.id = "groupe-rejoindre";
  return el(
    "section",
    { classe: "groupe-invitation", attrs: { "aria-labelledby": "groupe-invitation-titre" } },
    el("h2", { classe: "profil-section__titre", attrs: { id: "groupe-invitation-titre" }, texte: t.t("groupePage.invite", { nom: invitation.nom }) }),
    el("p", { classe: "profil-aide", texte: invitation.plein ? t.t("groupePage.plein") : dejaMembre ? t.t("groupePage.dejaMembre") : identifiant() === null ? t.t("groupePage.sansProfil") : t.t("groupePage.rejoindre.aide") }),
    rejoindre,
  );
}

function sectionClassement(t: ReturnType<typeof traduire>, p: PageGroupe): HTMLElement | null {
  if (!p.date) return null;
  const lignes = p.classement.map((r) => {
    const rang = r.rang !== null && r.score !== null ? `${t.t("groupePage.rang", { rang: formatRang(r.rang, langue), sur: formatNombre(r.sur, langue) })} · ${valeurDeVue({ vue: r.vue, sens: r.sens, score: r.score })}` : t.t("groupePage.moins", { min: p.min });
    return el("li", { classe: "groupe-rang", attrs: { "data-vue": r.vue } }, el("span", { classe: "groupe-rang__vue", texte: nomDeVue(t, r.vue) }), el("span", { classe: "groupe-rang__valeur dj-chiffres", texte: rang }));
  });
  return panneau(
    { id: "groupe-classement", titre: t.t("groupePage.classement", { date: formatDate(parseDay(p.date) ?? parisDay(Date.now()), langue) }) },
    lignes.length ? el("ul", { classe: "groupe-rangs", attrs: { id: "groupe-rangs" } }, ...lignes) : el("p", { classe: "profil-aide", texte: t.t("groupePage.aucunRang") }),
    el("p", { classe: "profil-aide", texte: t.t("groupePage.regle", { min: p.min }) }),
  );
}

function construire(): void {
  const racine = document.getElementById("groupe");
  if (!racine) return;
  const t = traduire(langue);
  document.documentElement.lang = langue;
  document.title = page ? t.t("groupePage.titreNom", { nom: page.nom }) : t.t("groupePage.titre");
  const jour = parisDay(Date.now());
  const salle = traducteurDePage(langue);
  const corps: (Node | null)[] = [];
  let embleme: HTMLElement | undefined;
  if (chargement) corps.push(el("p", { classe: "profil-etat", attrs: { role: "status" }, texte: t.t("groupePage.chargement") }));
  else if (!page) corps.push(el("p", { classe: "profil-etat", attrs: { role: "alert", id: "groupe-erreur" }, texte: erreur ?? t.t("groupePage.inconnu") }));
  else {
    const p = page;
    const membre = moi !== null && moi.id === p.id;
    embleme = emblemeDeGroupe({ initiales: initiales(p.nom, langue), image: adresseAvatar(baseApi(), p.avatar), taille: 72 });
    // « Rejoindre le groupe » reste en tête, sur toute la largeur, avant les membres.
    corps.push(messageInvitation ? el("p", { classe: ["profil-message", messageInvitation.echec && "profil-message--echec"], attrs: { role: messageInvitation.echec ? "alert" : "status", id: "groupe-message" }, texte: messageInvitation.texte }) : null, carteInvitation(t));
    const actions: Node[] = [];
    if (membre && moi) actions.push(bouton({ texte: t.t("groupePage.partager"), variante: "secondaire", onClick: () => void partager(t) }), el("a", { classe: "dj-bouton dj-bouton--secondaire", attrs: { href: "/profil/#groupe" }, texte: t.t("groupePage.gerer") }));
    if (p.avatar) actions.push(bouton({ texte: t.t("amis.signaler"), variante: "secondaire", desactive: messageEmbleme !== null || identifiant() === null, onClick: () => void signaler(t) }));
    corps.push(
      el(
        "div",
        { classe: "groupe-gauche" },
        // Chaque membre en photo de 52 px (comme « Mon groupe » du lot U3).
        panneau(
          { id: "groupe-membres-panneau", titre: t.t("groupePage.membres.titre") },
          p.description ? el("p", { classe: "groupe-description", attrs: { id: "groupe-description" }, texte: p.description }) : null,
          el("p", { classe: "profil-aide" }, t.t("groupePage.membres", { n: p.membres.length, max: p.max })),
          el("ul", { classe: "groupe-membres", attrs: { id: "groupe-membres" } }, ...p.membres.map((m) => el("li", { classe: "groupe-membre", attrs: { "data-ref": m.ref } }, avatar(t, { pseudo: m.pseudo, ref: m.ref, image: adresseAvatar(baseApi(), m.avatar), taille: 52, decoratif: true }), el("span", { classe: "groupe-membre__pseudo", texte: m.pseudo }), m.chef ? el("span", { classe: "groupe-membre__chef", texte: t.t("groupePage.chef") }) : null))),
        ),
      ),
      el("div", { classe: "groupe-droite" }, sectionClassement(t, p), actions.length ? el("div", { classe: "profil-ligne groupe-actions" }, ...actions) : null, messageEmbleme ? el("p", { classe: "profil-message", attrs: { role: "status" }, texte: messageEmbleme }) : null),
    );
  }
  // Lot U5 : la barre de la salle (« Amis et groupes » ouvert), le fronton au nom du groupe, la barre d'onglets du téléphone. Chemins absolus : la page est servie à toute profondeur.
  const fronton = frontonDeLaPage({ t: salle, langue, titre: page ? page.nom : t.t("groupePage.titre"), jour, embleme });
  fronton.querySelector("h1")?.setAttribute("id", "groupe-nom");
  racine.replaceChildren(
    barreDePage({ t: salle, langue, ici: "amis", racine: "/", stockage, identifie: identifiant() !== null, onLangue: changerLangue }),
    fronton,
    el("div", { classe: "salle-page groupe-page" }, ...corps.filter((e): e is Node => e !== null)),
    el("footer", { classe: "portail-pied salle-pied" }, el("a", { classe: "portail-pied__lien", attrs: { id: "mentions", href: cheminMentions(langue, "/"), hreflang: langue }, texte: t.t("portail.mentions") }), lienRetours(t.t("portail.retours.lien"), langue, "/")),
    ongletsDuBas(salle, "amis", "/"),
  );
}

async function partager(t: ReturnType<typeof traduire>): Promise<void> {
  if (!moi) return;
  const lien = adresseInvitationGroupe(location.origin, moi.nom, moi.invitation);
  try {
    if (navigator.share) {
      await navigator.share({ title: moi.nom, url: lien });
      return;
    }
    await navigator.clipboard.writeText(lien);
    messageEmbleme = t.t("groupePage.lienCopie");
  } catch {
    messageEmbleme = t.t("groupePage.lienCopie.echec");
  }
  construire();
}
async function signaler(t: ReturnType<typeof traduire>): Promise<void> {
  if (!page) return;
  const r = await signalement.signaler({ groupe: page.id });
  messageEmbleme = r.ok ? t.t("amis.signale") : erreurLisible(t, r.code);
  construire();
}
function changerLangue(l: Langue): void {
  langue = l;
  ecrireLangue(stockage, l);
  construire();
  document.querySelector<HTMLElement>(`.dj-choix-langue [data-langue="${l}"]`)?.focus();
}

async function lire(): Promise<void> {
  if (nom === null) {
    page = null;
    chargement = false;
    return;
  }
  const [p, m, inv] = await Promise.all([client.page(nom), client.moi(), jeton ? client.invitation(jeton) : Promise.resolve(null)]);
  chargement = false;
  if (p.ok) {
    page = p.data;
    erreur = null;
  } else {
    page = null;
    erreur = erreurLisible(traduire(langue), p.code);
  }
  moi = m.ok ? m.data : null;
  invitation = inv && inv.ok ? inv.data : null;
  if (jeton && inv && !inv.ok && !messageInvitation) messageInvitation = { texte: traduire(langue).t("groupePage.invitationMorte"), echec: true };
}

construire();
battre();
void lire().then(construire);
