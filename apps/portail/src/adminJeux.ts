import { bouton, el } from "@cdj/ui";
import {
  DELAI_ANNULER_S,
  GROUPES_JEUX,
  NOMS_ETAT_JEU,
  blocageDuJeu,
  categoriesDesJeux,
  consequenceEtat,
  couleurValide,
  filtrerJeux,
  filtreCategorie,
  infoEtat,
  lienApercu,
  nomCategorie,
  retireAuxJoueurs,
  siglePourJeu,
  texteBlocage,
  texteSurCouleur,
  type EtatJeuAdmin,
  type JeuAdmin,
} from "./adminDonnees";
import type { Contexte } from "./adminDiffusion";
import { entetePage } from "./adminEntete";

// Lot P (plateforme) puis lot N3 — la rubrique « Jeux » du panneau : **une ligne par jeu**, rangées par état (En ligne, En aperçu, Fermés), avec l'interrupteur Off · Aperçu · On sur la ligne.
// Un clic change l'état, **sans fenêtre** : ouvrir un jeu ou le passer en aperçu agit tout de suite et un bandeau « Annuler » (8 secondes) remet l'état d'avant ; **retirer un jeu aux joueurs**
// (de On vers Aperçu ou Off) garde sa confirmation, qui dit combien de joueurs y ont joué aujourd'hui. Chaque changement et chaque annulation sont au journal (le serveur). Ce qui bloque une position
// est écrit sur la ligne et la position est grisée (`aria-disabled`, raison lue par `aria-describedby`) ; le serveur reste le juge (un refus s'affiche sur la ligne, `ctx.refuser`, lot K5b).
// Le lien d'aperçu : le serveur ne garde que l'empreinte de la clé, un lien existant ne se recopie pas — « Nouveau lien d'aperçu » crée la clé et copie le lien en un geste (l'ancien cesse de marcher).
// Rien n'est interprété comme du HTML (`textContent`) ; la couleur de la vignette passe par le CSSOM (`style.setProperty`, jamais un attribut `style`), après contrôle du format `#RRGGBB`.
// Serveur : apps/api/CLAUDE.md, « Publication des jeux (lot P) ».

const p = (texte: string, classe?: string) => el("p", { classe, texte });

export async function vueJeux(ctx: Contexte): Promise<Node[]> {
  let { jeux } = await ctx.client.jeux();
  let q = "";
  let categorie = "";
  /** Ce que chaque ligne montre en plus : le message du lien d'aperçu, et le lien à copier à la main quand le presse-papiers refuse. */
  const messagesLigne = new Map<string, string>();
  const liensACopier = new Map<string, string>();
  /** Le jeu dont le menu « ⋯ » est ouvert. */
  let menuOuvert: string | null = null;

  const retour = el("div", { attrs: { id: "jeux-retour", "aria-live": "polite" } });
  const dire = (texte: string) => retour.replaceChildren(el("p", { classe: ["admin-message", "admin-message--info"], attrs: { role: "status" }, texte }));
  // Lot K5b : le refus d'une action se montre sur la ligne de l'action, en alerte (`ctx.refuser`).
  const erreur = (e: unknown) => ctx.refuser(e);
  const zone = el("div", { classe: "admin-jeux", attrs: { id: "jeux-liste" } });
  const zoneAnnuler = el("div", { classe: "admin-annuler-zone", attrs: { id: "jeux-annuler" } });

  // --- Le bandeau « Annuler » (8 secondes) --------------------------------------------------------------------------------------------------
  let minuteur: ReturnType<typeof setInterval> | undefined;
  const fermerAnnuler = () => {
    clearInterval(minuteur);
    minuteur = undefined;
    zoneAnnuler.replaceChildren();
  };
  function montrerAnnuler(j: JeuAdmin, avant: EtatJeuAdmin, vers: EtatJeuAdmin): void {
    clearInterval(minuteur);
    let reste = DELAI_ANNULER_S;
    // Le nom du bouton est « Annuler » (le décompte est décoratif : `aria-hidden`) ; le texte du bandeau le décrit (`aria-describedby`), le nom du jeu y est.
    const compte = el("span", { classe: "admin-annuler__reste", attrs: { "aria-hidden": "true" }, texte: ` · ${reste} s` });
    const annuler = el("button", { classe: "admin-annuler__bouton", attrs: { type: "button", "data-annuler": j.jeu, "aria-describedby": "jeux-annuler-texte" } }, el("span", { texte: "Annuler" }), compte);
    annuler.addEventListener("click", async () => {
      fermerAnnuler();
      try {
        jeux = (await ctx.client.changerEtatJeu(j.jeu, avant, true)).jeux;
        rendre();
        dire(`${j.nom} est revenu à « ${NOMS_ETAT_JEU[avant]} ».`);
      } catch (e) {
        await erreur(e);
      }
    });
    zoneAnnuler.replaceChildren(el("div", { classe: "admin-annuler", attrs: { role: "status" } }, el("span", { classe: "admin-annuler__texte", attrs: { id: "jeux-annuler-texte" }, texte: `${j.nom} est passé en « ${NOMS_ETAT_JEU[vers]} ».` }), annuler));
    minuteur = setInterval(() => {
      if (!annuler.isConnected) return fermerAnnuler(); // la page a changé : plus rien à annuler d'ici
      reste -= 1;
      if (reste <= 0) return fermerAnnuler();
      compte.textContent = ` · ${reste} s`;
    }, 1000);
  }

  // --- Un changement d'état -------------------------------------------------------------------------------------------------------------
  async function changer(j: JeuAdmin, vers: EtatJeuAdmin): Promise<void> {
    if (vers === j.etat || j.bloque[vers]) return;
    const retire = retireAuxJoueurs(j.etat, vers);
    if (retire) {
      const v = await ctx.confirmer({
        titre: `${j.nom} : passer à « ${NOMS_ETAT_JEU[vers]} »`,
        texte: consequenceEtat(j.nom, j.etat, vers, null, j.joueursAujourdhui),
        action: `Passer à ${NOMS_ETAT_JEU[vers]}`,
      });
      if (!v) return;
    }
    const avant = j.etat;
    try {
      jeux = (await ctx.client.changerEtatJeu(j.jeu, vers)).jeux;
      rendre();
      if (retire) {
        fermerAnnuler();
        dire(`${j.nom} : ${NOMS_ETAT_JEU[vers]}.`);
      } else montrerAnnuler(j, avant, vers); // se défait d'un clic : « Annuler » plutôt qu'une fenêtre
    } catch (e) {
      await erreur(e);
    }
  }

  // --- Le lien d'aperçu -------------------------------------------------------------------------------------------------------------------
  async function nouveauLien(j: JeuAdmin): Promise<void> {
    try {
      const { cle } = await ctx.client.genererCleApercu(j.jeu);
      const lien = lienApercu(location.origin, j.jeu, cle);
      const ancien = j.cle.presente;
      jeux = jeux.map((x) => (x.jeu === j.jeu ? { ...x, cle: { presente: true, creeeLe: new Date().toISOString() } } : x));
      try {
        await navigator.clipboard.writeText(lien);
        liensACopier.delete(j.jeu);
        messagesLigne.set(j.jeu, `Lien copié.${ancien ? " L'ancien lien ne marche plus." : ""} Ouvre-le sur ton téléphone : la clé est rangée sur l'appareil, puis retirée de l'adresse.`);
      } catch {
        liensACopier.set(j.jeu, lien); // le presse-papiers refuse (page non active, navigateur) : le lien est montré, sélectionné
        messagesLigne.set(j.jeu, `Copie impossible ici : copie le lien à la main (il n'est montré qu'une fois).${ancien ? " L'ancien lien ne marche plus." : ""}`);
      }
      rendre();
      (zone.querySelector(`[data-lien-apercu="${CSS.escape(j.jeu)}"]`) as HTMLInputElement | null)?.select();
    } catch (e) {
      await erreur(e);
    }
  }

  async function revoquer(j: JeuAdmin): Promise<void> {
    const v = await ctx.confirmer({ titre: `Révoquer le lien d'aperçu de ${j.nom}`, texte: "Le lien d'aperçu cesse de marcher tout de suite sur tous les appareils.", action: "Révoquer le lien" });
    if (!v) return;
    try {
      jeux = (await ctx.client.revoquerCleApercu(j.jeu)).jeux;
      messagesLigne.delete(j.jeu);
      liensACopier.delete(j.jeu);
      rendre();
      dire(`Lien d'aperçu de ${j.nom} révoqué.`);
    } catch (e) {
      await erreur(e);
    }
  }

  // --- Le menu « ⋯ » d'une ligne ---------------------------------------------------------------------------------------------------------
  function menuPlus(j: JeuAdmin): HTMLElement {
    const bouton = el("button", { classe: "admin-plus", attrs: { type: "button", "aria-haspopup": "menu", "aria-expanded": "false", "aria-label": `Autres actions pour ${j.nom}`, "data-plus": j.jeu }, texte: "⋯" });
    const item = el("button", {
      classe: "admin-plus__item",
      attrs: { type: "button", role: "menuitem", "aria-disabled": j.cle.presente ? null : "true", "data-action": "revoquer" },
      texte: j.cle.presente ? "Révoquer le lien" : "Révoquer le lien (aucun lien)",
    });
    const liste = el("div", { classe: "admin-plus__menu", attrs: { role: "menu", "aria-label": `Actions de ${j.nom}`, hidden: true } }, item);
    const fermer = (rendreLeFocus: boolean) => {
      menuOuvert = null;
      liste.hidden = true;
      bouton.setAttribute("aria-expanded", "false");
      document.removeEventListener("pointerdown", dehors, true);
      if (rendreLeFocus) bouton.focus();
    };
    const dehors = (ev: Event) => {
      if (!(ev.target instanceof Node) || !boite.contains(ev.target)) fermer(false);
    };
    const boite = el("div", { classe: "admin-plus__boite" }, bouton, liste);
    bouton.addEventListener("click", () => {
      if (menuOuvert === j.jeu) return fermer(false);
      zone.querySelectorAll<HTMLElement>(".admin-plus__menu").forEach((m) => (m.hidden = true));
      zone.querySelectorAll(".admin-plus").forEach((b) => b.setAttribute("aria-expanded", "false"));
      menuOuvert = j.jeu;
      liste.hidden = false;
      bouton.setAttribute("aria-expanded", "true");
      document.addEventListener("pointerdown", dehors, true);
      item.focus();
    });
    boite.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && menuOuvert === j.jeu) {
        ev.stopPropagation();
        fermer(true);
      }
    });
    boite.addEventListener("focusout", (ev) => {
      if (menuOuvert === j.jeu && ev.relatedTarget instanceof Node && !boite.contains(ev.relatedTarget)) fermer(false);
    });
    item.addEventListener("click", () => {
      if (!j.cle.presente) return;
      fermer(false);
      void revoquer(j);
    });
    return boite;
  }

  // --- Une ligne --------------------------------------------------------------------------------------------------------------------------
  function ligne(j: JeuAdmin): HTMLElement {
    const fond = couleurValide(j.couleur);
    const blocage = blocageDuJeu(j);
    const idAlerte = `jeu-alerte-${j.jeu}`;
    const vignette = el("div", { classe: "admin-jeu__vignette", attrs: { "aria-hidden": "true" }, texte: siglePourJeu(j.nom), style: fond ? { "--vignette-fond": fond, "--vignette-texte": texteSurCouleur(fond) } : {} });
    const positions = (["off", "preview", "on"] as const).map((e) => {
      const interdit = j.etat === e ? null : j.bloque[e]; // la position où le jeu est n'est pas « interdite »
      return el("button", {
        classe: ["admin-position", `admin-position--${e}`, j.etat === e && "est-actif", interdit && "est-interdit"],
        attrs: { type: "button", "data-etat": e, "aria-pressed": String(j.etat === e), "aria-disabled": interdit ? "true" : null, "aria-describedby": interdit ? idAlerte : null },
        texte: NOMS_ETAT_JEU[e],
      });
    });
    positions.forEach((b) => b.addEventListener("click", () => void changer(j, b.getAttribute("data-etat") as EtatJeuAdmin)));

    const message = messagesLigne.get(j.jeu);
    const aCopier = liensACopier.get(j.jeu);
    return el(
      "li",
      { classe: ["admin-jeu", j.etat === "off" && "est-ferme"], attrs: { "data-jeu-admin": j.jeu, "data-etat-jeu": j.etat, "aria-labelledby": `jeu-${j.jeu}` } },
      vignette,
      el(
        "div",
        { classe: "admin-jeu__corps" },
        el("h3", { classe: "admin-jeu__nom", attrs: { id: `jeu-${j.jeu}` } }, el("span", { texte: j.nom }), el("span", { classe: "admin-jeu__cat", attrs: { "data-categorie": j.categorie }, texte: nomCategorie(j.categorie) })),
        p(infoEtat(j), "admin-jeu__info"),
        blocage ? el("p", { classe: "admin-jeu__alerte", attrs: { id: idAlerte, "data-blocage": blocage.code }, texte: texteBlocage(blocage) }) : null,
        j.etat === "preview"
          ? el(
              "div",
              { classe: "admin-jeu__lien" },
              bouton({ texte: "Nouveau lien d'aperçu", variante: "secondaire", onClick: () => void nouveauLien(j) }),
              p(j.cle.presente ? "Un lien existe : en créer un nouveau fait cesser l'ancien." : "Le lien est créé et copié en un geste ; il n'est montré qu'une fois.", "admin-aide"),
            )
          : null,
        aCopier ? el("input", { attrs: { type: "text", readonly: true, value: aCopier, "aria-label": `Lien d'aperçu de ${j.nom}`, "data-lien-apercu": j.jeu, size: 40 }, classe: "admin-jeu__champ-lien" }) : null,
        message ? el("p", { classe: ["admin-message", "admin-message--info"], attrs: { role: "status", "data-lien-message": j.jeu }, texte: message }) : null,
      ),
      el("div", { classe: "admin-jeu__chiffre", attrs: { "data-joueurs": j.jeu } }, el("b", { texte: j.joueursAujourdhui === null ? "–" : String(j.joueursAujourdhui) }), el("small", { texte: j.joueursAujourdhui === null ? "" : "joueurs aujourd'hui" })),
      el("div", { classe: "admin-jeu__etat", attrs: { role: "group", "aria-label": `État de ${j.nom}` } }, ...positions),
      menuPlus(j),
    );
  }

  // --- La page ----------------------------------------------------------------------------------------------------------------------------
  const champ = el("input", { classe: "admin-champ-recherche", attrs: { type: "search", id: "jeux-recherche", placeholder: "Chercher un jeu", "aria-label": "Chercher un jeu", autocomplete: "off", spellcheck: "false" } });
  champ.addEventListener("input", () => {
    q = champ.value;
    rendre();
  });
  const filtres = el("div", { classe: "admin-filtres", attrs: { role: "group", "aria-label": "Filtrer par catégorie" } });

  function rendreFiltres(): void {
    const choix = [{ cle: "", texte: `Tous · ${jeux.length}` }, ...categoriesDesJeux(jeux).map((c) => ({ cle: c, texte: filtreCategorie(c) }))];
    filtres.replaceChildren(
      ...choix.map((c) => {
        const b = el("button", { classe: "admin-filtre", attrs: { type: "button", "aria-pressed": String(categorie === c.cle), "data-categorie": c.cle || "tous" }, texte: c.texte });
        b.addEventListener("click", () => {
          categorie = c.cle;
          rendre();
        });
        return b;
      }),
    );
  }

  function rendre(): void {
    menuOuvert = null; // un menu « ⋯ » ne survit pas à un redessin
    if (categorie && !jeux.some((j) => j.categorie === categorie)) categorie = "";
    rendreFiltres();
    const visibles = filtrerJeux(jeux, q, categorie);
    const groupes = GROUPES_JEUX.flatMap((g) => {
      const liste = visibles.filter((j) => j.etat === g.etat);
      return liste.length
        ? [
            el(
              "section",
              { classe: "admin-jeux__groupe", attrs: { "aria-labelledby": `groupe-${g.etat}`, "data-groupe": g.etat } },
              el("h2", { classe: "admin-jeux__titre-groupe", attrs: { id: `groupe-${g.etat}` } }, el("i", { classe: `admin-jeux__point admin-jeux__point--${g.couleur}`, attrs: { "aria-hidden": "true" } }), el("span", { texte: `${g.titre} · ${liste.length}` })),
              el("ul", { classe: "admin-jeux__lignes" }, ...liste.map(ligne)),
            ),
          ]
        : [];
    });
    zone.replaceChildren(...(groupes.length ? groupes : [p("Aucun jeu ne correspond.", "admin-aide")]));
  }
  rendre();

  return [
    entetePage({ titre: "Jeux", sousTitre: "Off : fermé. Aperçu : avec le lien seulement. On : tout le monde.", outils: [champ, filtres] }),
    p("Un jeu n'entre dans la journée (série, journée parfaite, classement du jour, partage) qu'à partir du premier jour entier où il est On ; le désactiver l'en retire dès le lendemain, sans rien supprimer. « On » n'ajoute pas le jeu au classement cumulé : c'est un réglage à part. Un nouveau jeu naît Off.", "admin-aide"),
    retour,
    zone,
    zoneAnnuler,
  ];
}
