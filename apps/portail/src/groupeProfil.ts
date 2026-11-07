import "./groupesPortail.css";
import { baseApi } from "./jour"; // la feuille est importée par les modules à la demande (jamais par une page d'entrée qui l'embarquerait dans le premier chargement de l'accueil)
import { adresseAvatar, type Langue } from "@cdj/profile";
import { adresseGroupe, adresseInvitationGroupe, clientGroupes, GROUPE_DESCRIPTION_MAX, GROUPE_NOM_MAX, type MonGroupe } from "@cdj/profile/src/groupes";
import { avatar, bouton, el } from "@cdj/ui";
import { initiales } from "@cdj/ui/src/avatar";
import { emblemeDeGroupe } from "./salle";
import { CATALOGUE_AMIS } from "@cdj/ui/src/catalogue.amis";

// Lot C1, partie C — « Profil › Mon groupe » (`/profil/`), chargé **à la demande** par la page du profil : créer un groupe, voir le sien (membres, lien d'invitation que tout membre peut montrer et partager) et,
// pour le chef, gérer (retirer un membre, passer le chef, renouveler le lien — l'ancien meurt —, renommer une fois par semaine, la description, l'emblème, dissoudre) ; chacun peut quitter. Une action qui défait
// quelque chose demande une seconde pression (« Confirmer : … »). Tout texte du serveur est posé en `textContent`. Serveur : `apps/api/CLAUDE.md`, « Groupes (lot C1) ».

type Dire = (cle: string, params?: Record<string, string | number>) => string;
export interface OptionsGroupeProfil {
  /** Le traducteur de la page (les composants du socle le prennent tel quel). */
  tr: Parameters<typeof avatar>[0] & { t: (cle: never, params?: never) => string };
  langue: Langue;
  base: string;
  id: string;
  /** Lot U3 : ton groupe déjà lu par la page (`null` : aucun) — le module ne le relit pas au montage (l'en-tête du profil l'a demandé). Absent : il le lit. */
  initial?: MonGroupe | null;
  /** Lot U3 : ton groupe a changé (créé, renommé, quitté…) : la page remet à jour son en-tête. */
  surChangement?: (groupe: MonGroupe | null) => void;
}

let etat: { genre: "chargement" } | { genre: "erreur"; code: string } | { genre: "ok"; groupe: MonGroupe | null } = { genre: "chargement" };
let confirmation: string | null = null;
let message: { texte: string; echec: boolean } | null = null;
let lien: string | null = null;
let occupe = false;

const erreurDe = (t: Dire, code: string): string => {
  const cle = `erreur.${code}`;
  return cle in CATALOGUE_AMIS.fr ? t(cle) : t("portail.horsLigne");
};

export function monterGroupe(zone: HTMLElement, o: OptionsGroupeProfil): void {
  const client = clientGroupes({ base: o.base || baseApi(), playerId: o.id });
  const t: Dire = (cle, params) => (o.tr.t as (c: string, p?: Record<string, string | number>) => string)(cle, params);
  const dessiner = (): void => {
    const enfants: (Node | null)[] = [];
    if (etat.genre === "chargement") enfants.push(el("p", { classe: "profil-aide", attrs: { role: "status" }, texte: t("groupePage.chargement") }));
    else if (etat.genre === "erreur") enfants.push(el("p", { classe: "profil-message profil-message--echec", attrs: { role: "alert" }, texte: erreurDe(t, etat.code) }));
    else enfants.push(etat.groupe ? monGroupe(etat.groupe) : sansGroupe());
    if (message) enfants.push(el("p", { classe: ["profil-message", message.echec && "profil-message--echec"], attrs: { id: "groupe-profil-message", role: message.echec ? "alert" : "status" }, texte: message.texte }));
    zone.replaceChildren(...enfants.filter((e): e is Node => e !== null));
  };
  const relire = async (): Promise<void> => {
    const r = await client.moi();
    etat = r.ok ? { genre: "ok", groupe: r.data } : { genre: "erreur", code: r.code };
    dessiner();
    if (r.ok) o.surChangement?.(r.data);
  };
  /** Une action : la première pression demande confirmation (sauf `directe`), la seconde la fait ; le résultat s'écrit en message. */
  const agir = (cle: string, libelle: string, faire: () => Promise<{ ok: boolean; code?: string }>, reussite: string, directe = false): HTMLElement => {
    const attente = confirmation === cle;
    const b = bouton({
      texte: attente ? t("groupeProfil.confirmer", { action: libelle }) : libelle,
      variante: attente ? "marque" : "secondaire",
      desactive: occupe,
      onClick: async () => {
        if (!directe && confirmation !== cle) {
          confirmation = cle;
          message = null;
          dessiner();
          return;
        }
        confirmation = null;
        occupe = true;
        dessiner();
        const r = await faire();
        occupe = false;
        message = r.ok ? { texte: reussite, echec: false } : { texte: erreurDe(t, r.code ?? "network"), echec: true };
        await relire();
      },
    });
    b.dataset.action = cle;
    return b;
  };

  function sansGroupe(): HTMLElement {
    const nom = el("input", { attrs: { type: "text", id: "groupe-nom-champ", maxlength: GROUPE_NOM_MAX, autocomplete: "off", "aria-label": t("groupeProfil.nom") } }) as HTMLInputElement;
    const description = el("input", { attrs: { type: "text", id: "groupe-description-champ", maxlength: GROUPE_DESCRIPTION_MAX, autocomplete: "off", "aria-label": t("groupeProfil.description") } }) as HTMLInputElement;
    const forme = el(
      "form",
      { classe: "groupe-gestion", attrs: { id: "groupe-creer" } },
      el("label", { classe: "profil-etiquette-champ", attrs: { for: "groupe-nom-champ" }, texte: t("groupeProfil.nom") }),
      nom,
      el("label", { classe: "profil-etiquette-champ", attrs: { for: "groupe-description-champ" }, texte: t("groupeProfil.description") }),
      description,
      el("button", { classe: "dj-bouton dj-bouton--marque", attrs: { type: "submit" }, texte: t("groupeProfil.creer") }),
    );
    forme.addEventListener("submit", (e) => {
      e.preventDefault();
      void (async () => {
        if (occupe) return;
        occupe = true;
        const r = await client.creer({ nom: nom.value, description: description.value });
        occupe = false;
        message = r.ok ? { texte: t("groupeProfil.cree"), echec: false } : { texte: erreurDe(t, r.code), echec: true };
        await relire();
      })();
    });
    return el("div", { classe: "groupe-gestion" }, el("p", { classe: "profil-aide", texte: t("groupeProfil.aucun") }), el("p", { classe: "profil-aide", texte: t("groupeProfil.regles", { max: 30 }) }), forme);
  }

  function monGroupe(g: MonGroupe): HTMLElement {
    const adresse = adresseInvitationGroupe(location.origin, g.nom, g.invitation);
    const champLien = el("input", { attrs: { type: "text", readonly: true, id: "groupe-lien", value: adresse, "aria-label": t("groupeProfil.lien") } }) as HTMLInputElement;
    const copier = bouton({
      texte: t("groupeProfil.copier"),
      variante: "secondaire",
      onClick: async () => {
        try {
          await navigator.clipboard.writeText(adresse);
          lien = adresse;
          message = { texte: t("groupeProfil.lienCopie"), echec: false };
        } catch {
          champLien.select();
          message = { texte: t("groupeProfil.lienAMain"), echec: true };
        }
        dessiner();
      },
    });
    const ligneMembres = g.membres.map((m) => {
      const actions: HTMLElement[] = [];
      if (g.chef && !m.chef) actions.push(agir(`chef:${m.ref}`, t("groupeProfil.passerChef"), () => client.passerLeChef(m.ref), t("groupeProfil.chefPasse", { pseudo: m.pseudo })), agir(`retirer:${m.ref}`, t("groupeProfil.retirer"), () => client.retirer(m.ref), t("groupeProfil.retire", { pseudo: m.pseudo })));
      return el(
        "li",
        { classe: "groupe-membre groupe-membre--gestion", attrs: { "data-ref": m.ref } },
        avatar(o.tr, { pseudo: m.pseudo, ref: m.ref, image: adresseAvatar(o.base, m.avatar), taille: 32, decoratif: true }),
        el("span", { classe: "groupe-membre__pseudo", texte: m.pseudo }),
        m.chef ? el("span", { classe: "groupe-membre__chef", texte: t("groupePage.chef") }) : null,
        ...actions,
      );
    });
    const enfants: (Node | null)[] = [
      el(
        "div",
        { classe: "groupe-entete" },
        emblemeDeGroupe({ initiales: initiales(g.nom, o.langue), image: adresseAvatar(o.base, g.avatar), taille: 72 }), // lot U3 : un groupe est un carré (charte § 9)
        el("div", { classe: "groupe-entete__texte" }, el("a", { classe: "groupe-nom-lien", attrs: { id: "groupe-lien-page", href: adresseGroupe("", g.nom) }, texte: g.nom }), g.description ? el("p", { classe: "groupe-description", texte: g.description }) : null, el("p", { classe: "profil-aide", texte: t("groupePage.membres", { n: g.membres.length, max: g.max }) })),
      ),
      el("p", { classe: "profil-aide", texte: t("groupeProfil.arrivee", { date: g.arrivee }) }),
      el("h3", { classe: "profil-sous-titre", texte: t("groupeProfil.lien.titre") }),
      el("p", { classe: "profil-aide", texte: t("groupeProfil.lien.aide") }),
      el("div", { classe: "profil-ligne" }, champLien, copier),
      g.chef ? agir("renouveler", t("groupeProfil.renouveler"), () => client.renouveler(), t("groupeProfil.renouvele")) : null,
      el("h3", { classe: "profil-sous-titre", texte: t("groupePage.membres.titre") }),
      el("ul", { classe: "groupe-membres", attrs: { id: "groupe-membres-gestion" } }, ...ligneMembres),
    ];
    if (g.chef) enfants.push(gestionDuChef(g));
    enfants.push(agir("quitter", t("groupeProfil.quitter"), () => client.quitter(), t("groupeProfil.quitte")));
    void lien;
    return el("div", { classe: "groupe-gestion", attrs: { id: "groupe-mon" } }, ...enfants.filter((e): e is Node => e !== null));
  }

  function gestionDuChef(g: MonGroupe): HTMLElement {
    const nom = el("input", { attrs: { type: "text", id: "groupe-renommer-champ", maxlength: GROUPE_NOM_MAX, value: g.nom, autocomplete: "off", "aria-label": t("groupeProfil.nom") } }) as HTMLInputElement;
    const attente = (g.renommerDans ?? 0) > 0;
    const renommer = el("form", { classe: "profil-ligne", attrs: { id: "groupe-renommer" } }, nom, el("button", { classe: "dj-bouton dj-bouton--secondaire", attrs: { type: "submit" }, texte: t("groupeProfil.renommer") }));
    renommer.addEventListener("submit", (e) => {
      e.preventDefault();
      void (async () => {
        if (occupe) return;
        occupe = true;
        const r = await client.renommer(nom.value);
        occupe = false;
        message = r.ok ? { texte: t("groupeProfil.renomme"), echec: false } : { texte: erreurDe(t, r.code), echec: true };
        await relire();
      })();
    });
    const description = el("input", { attrs: { type: "text", id: "groupe-decrire-champ", maxlength: GROUPE_DESCRIPTION_MAX, value: g.description, autocomplete: "off", "aria-label": t("groupeProfil.description") } }) as HTMLInputElement;
    const decrire = el("form", { classe: "profil-ligne", attrs: { id: "groupe-decrire" } }, description, el("button", { classe: "dj-bouton dj-bouton--secondaire", attrs: { type: "submit" }, texte: t("groupeProfil.decrire") }));
    decrire.addEventListener("submit", (e) => {
      e.preventDefault();
      void (async () => {
        if (occupe) return;
        occupe = true;
        const r = await client.decrire(description.value);
        occupe = false;
        message = r.ok ? { texte: t("groupeProfil.decrit"), echec: false } : { texte: erreurDe(t, r.code), echec: true };
        await relire();
      })();
    });
    const choisir = bouton({
      texte: t("groupeProfil.emblemeChoisir"),
      variante: "secondaire",
      onClick: async () => {
        const r = await (await import("./avatarEdition")).choisirImage(t);
        if (!r.ok) {
          message = r.code === "annule" ? null : { texte: t(r.code === "trop_lourde" ? "profil.avatar.lourde" : "profil.avatar.illisible"), echec: true };
          return dessiner();
        }
        const envoi = await client.emblem(r.base64);
        message = envoi.ok ? { texte: t("groupeProfil.emblemeFait"), echec: false } : { texte: erreurDe(t, envoi.code), echec: true };
        await relire();
      },
    });
    return el(
      "div",
      { classe: "groupe-gestion", attrs: { id: "groupe-chef" } },
      el("h3", { classe: "profil-sous-titre", texte: t("groupeProfil.chef.titre") }),
      el("label", { classe: "profil-etiquette-champ", attrs: { for: "groupe-renommer-champ" }, texte: attente ? t("groupeProfil.renommer.attente") : t("groupeProfil.nom") }),
      renommer,
      el("label", { classe: "profil-etiquette-champ", attrs: { for: "groupe-decrire-champ" }, texte: t("groupeProfil.description") }),
      decrire,
      el("div", { classe: "profil-ligne" }, choisir, g.avatar ? agir("emblem-retirer", t("groupeProfil.emblemeRetirer"), () => client.retirerEmblem(), t("groupeProfil.emblemeRetire"), true) : null),
      agir("dissoudre", t("groupeProfil.dissoudre"), () => client.dissoudre(), t("groupeProfil.dissous")),
    );
  }

  if (o.initial !== undefined) etat = { genre: "ok", groupe: o.initial };
  else etat = { genre: "chargement" };
  dessiner();
  if (o.initial === undefined) void relire();
}
