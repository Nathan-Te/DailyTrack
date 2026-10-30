import { bouton, el } from "@cdj/ui";
import { ErreurAdmin, NOMS_ETAT_JEU, consequenceEtat, lienApercu, texteErreur, type JeuAdmin } from "./adminDonnees";
import type { Contexte } from "./adminDiffusion";

// Lot P (plateforme) — la rubrique « Jeux » du panneau : l'interrupteur à trois positions de chaque jeu (Off · Aperçu · On, avec confirmation) et sa clé d'aperçu (générer, copier le lien, révoquer).
// Rien n'est interprété comme du HTML (`textContent`). La clé n'est montrée qu'**une fois**, à la génération : le serveur n'en garde que l'empreinte, rien n'est gardé dans le navigateur.
// Serveur : apps/api/CLAUDE.md, « Publication des jeux (lot P) ».

const p = (texte: string, classe?: string) => el("p", { classe, texte });
const titreCarte = (texte: string, id: string) => el("h2", { classe: "admin-titre-section admin-titre-carte", attrs: { id }, texte });

export async function vueJeux(ctx: Contexte): Promise<Node[]> {
  const { jeux } = await ctx.client.jeux();
  const retour = el("div", { attrs: { id: "jeux-retour" } });
  const dire = (kind: "erreur" | "info", texte: string) =>
    retour.replaceChildren(el("p", { classe: ["admin-message", `admin-message--${kind}`], attrs: { role: kind === "erreur" ? "alert" : "status" }, texte }));
  const erreur = async (e: unknown) => {
    if (e instanceof ErreurAdmin && e.statut === 401) await ctx.sessionExpiree();
    else dire("erreur", texteErreur(e));
  };

  const carte = (j: JeuAdmin): HTMLElement => {
    const zoneCle = el("div", { classe: "admin-jeu__cle", attrs: { "data-cle-zone": j.jeu } });
    const etatCle = el("p", { classe: "admin-aide", attrs: { "data-cle-etat": j.jeu }, texte: j.cle.presente ? "Une clé d'aperçu existe (le serveur n'en garde que l'empreinte)." : "Aucune clé d'aperçu." });
    const positions = (["off", "preview", "on"] as const).map((e) =>
      el("button", {
        classe: ["dj-bouton", j.etat === e ? "dj-bouton--marque" : "dj-bouton--secondaire", "admin-jeu__position"],
        attrs: { type: "button", "data-etat": e, "aria-pressed": String(j.etat === e), disabled: j.etat === e },
        texte: NOMS_ETAT_JEU[e],
      }),
    );
    positions.forEach((b) =>
      b.addEventListener("click", async () => {
        const vers = b.getAttribute("data-etat") as JeuAdmin["etat"];
        const v = await ctx.confirmer({ titre: `${j.nom} : passer à « ${NOMS_ETAT_JEU[vers]} »`, texte: consequenceEtat(j.nom, j.etat, vers, null), action: `Passer à ${NOMS_ETAT_JEU[vers]}` });
        if (!v) return;
        try {
          await ctx.client.changerEtatJeu(j.jeu, vers);
          await ctx.recharger(`${j.nom} : ${NOMS_ETAT_JEU[vers]}.`);
        } catch (e) {
          await erreur(e);
        }
      }),
    );
    const generer = bouton({
      texte: j.cle.presente ? "Générer une nouvelle clé" : "Générer une clé",
      variante: "secondaire",
      onClick: async () => {
        const v = await ctx.confirmer({ titre: `Clé d'aperçu de ${j.nom}`, texte: `Une nouvelle clé remplace l'ancienne (qui cesse de marcher). Elle ne sera montrée qu'une fois : copie le lien tout de suite.`, action: "Générer" });
        if (!v) return;
        try {
          const { cle } = await ctx.client.genererCleApercu(j.jeu);
          const lien = lienApercu(location.origin, j.jeu, cle);
          const champ = el("input", { attrs: { type: "text", readonly: true, value: lien, "aria-label": `Lien d'aperçu de ${j.nom}`, "data-lien-apercu": j.jeu, size: 40 } });
          zoneCle.replaceChildren(
            p("Voici le lien d'aperçu. Il n'est montré qu'une fois. Ouvre-le sur ton téléphone : la clé est rangée sur l'appareil, puis retirée de l'adresse.", "admin-aide"),
            champ,
            bouton({
              texte: "Copier le lien",
              variante: "secondaire",
              onClick: async () => {
                try {
                  await navigator.clipboard.writeText(lien);
                  dire("info", "Lien copié.");
                } catch {
                  champ.select();
                  dire("info", "Copie impossible ici : le lien est sélectionné, copie-le à la main.");
                }
              },
            }),
          );
          etatCle.textContent = "Une clé d'aperçu existe (le serveur n'en garde que l'empreinte).";
        } catch (e) {
          await erreur(e);
        }
      },
    });
    const revoquer = j.cle.presente
      ? bouton({
          texte: "Révoquer la clé",
          variante: "secondaire",
          onClick: async () => {
            const v = await ctx.confirmer({ titre: `Révoquer la clé de ${j.nom}`, texte: "Le lien d'aperçu cesse de marcher tout de suite sur tous les appareils.", action: "Révoquer" });
            if (!v) return;
            try {
              await ctx.client.revoquerCleApercu(j.jeu);
              await ctx.recharger("Clé révoquée.");
            } catch (e) {
              await erreur(e);
            }
          },
        })
      : null;
    return el(
      "section",
      { classe: "admin-carte admin-jeu", attrs: { "aria-labelledby": `jeu-${j.jeu}`, "data-jeu-admin": j.jeu } },
      titreCarte(j.nom, `jeu-${j.jeu}`),
      el("div", { classe: "admin-actions", attrs: { role: "group", "aria-label": `État de ${j.nom}` } }, ...positions),
      p(
        j.etat === "on"
          ? `Ouvert à tous.${j.liveFrom ? ` Compte dans la journée depuis le ${j.liveFrom}.` : ""}`
          : j.etat === "preview"
            ? "Aperçu : jouable avec la clé seulement, absent de l'accueil et de la journée."
            : "Fermé : « Bientôt » pour les joueurs, l'API refuse.",
        "admin-aide",
      ),
      etatCle,
      zoneCle,
      el("div", { classe: "admin-actions" }, generer, revoquer),
    );
  };

  return [
    el("h1", { classe: "admin-titre-section", texte: "Jeux" }),
    p("Qui voit quoi : Off (rien), Aperçu (la clé seulement), On (tout le monde). Un nouveau jeu naît Off. Un jeu n'entre dans la journée (série, journée parfaite, classement du jour, partage) qu'à partir du premier jour entier où il est On ; le désactiver l'en retire dès le lendemain, sans rien supprimer. « On » n'ajoute pas le jeu au classement cumulé : c'est un réglage à part.", "admin-aide"),
    retour,
    ...jeux.map(carte),
  ];
}
