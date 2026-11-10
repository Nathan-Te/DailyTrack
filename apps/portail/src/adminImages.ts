import { bouton, el } from "@cdj/ui";
import { type ActionImage, type ImageAdmin } from "./adminDonnees";
import type { Contexte } from "./adminDiffusion";

// Lot C1, partie B (plateforme) — la rubrique « Images » du panneau : d'abord les images signalées ou masquées, puis les nouvelles à regarder, en galerie. Pour chacune : garder, retirer, interdire l'envoi
// (ou le lever) — chaque action est confirmée et inscrite au journal par le serveur. L'image vient du serveur en octets (adresse `data:` : la CSP de /admin/ n'autorise pas `blob:`) ; le nom est un texte.
// Serveur : `apps/api/CLAUDE.md`, « Avatars (lot C1) ».

const p = (texte: string, classe?: string) => el("p", { classe, texte });
const NOMS_STATUT: Record<string, string> = { visible: "Visible", masque: "Masquée (signalée)", retire: "Retirée" };
const quand = (iso: string): string => new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" });

function carte(ctx: Contexte, i: ImageAdmin): HTMLElement {
  const cadre = el("div", { classe: "admin-image__cadre", attrs: { "data-image": i.hash } });
  void ctx.client.octetsImage(i.kind, i.ref).then((src) => {
    cadre.replaceChildren(src ? el("img", { attrs: { src, alt: "", width: 96, height: 96 } }) : el("span", { classe: "admin-aide", texte: "Pas d'image" }));
  });
  const agir = (action: ActionImage, titre: string, texte: string, libelle: string) =>
    bouton({
      texte: libelle,
      variante: action === "garder" ? "secondaire" : "marque",
      onClick: async () => {
        const v = await ctx.confirmer({ titre, texte, action: libelle, irreversible: action === "retirer" });
        if (!v) return;
        try {
          await ctx.client.actionImage(i.kind, i.ref, action);
          await ctx.recharger(`${libelle} : fait.`);
        } catch (e) {
          await ctx.refuser(e);
        }
      },
    });
  const nom = i.nom ?? i.ref;
  const lien = i.kind === "joueur" ? el("a", { attrs: { href: `#/joueurs/${encodeURIComponent(i.ref)}` }, texte: nom }) : el("a", { attrs: { href: `#/groupes/${encodeURIComponent(i.ref)}` }, texte: nom });
  return el(
    "li",
    { classe: "admin-image", attrs: { "data-kind": i.kind, "data-ref": i.ref } },
    cadre,
    el("div", { classe: "admin-image__corps" }, el("p", { classe: "admin-image__nom" }, i.kind === "joueur" ? "Joueur : " : "Groupe : ", lien), p(`${NOMS_STATUT[i.statut] ?? i.statut} · ${i.signalements} signalement${i.signalements > 1 ? "s" : ""} · ${quand(i.majLe)}${i.interdit ? " · envoi interdit" : ""}`, "admin-aide")),
    el(
      "div",
      { classe: "admin-actions" },
      agir("garder", `Garder l'image de ${nom}`, "Elle reste (ou redevient) visible ; ses signalements ne comptent plus.", "Garder"),
      agir("retirer", `Retirer l'image de ${nom}`, "L'image est supprimée du serveur et ses initiales reviennent. Le joueur peut en envoyer une autre demain.", "Retirer"),
      i.interdit ? agir("autoriser", `Lever l'interdiction pour ${nom}`, "Le joueur pourra de nouveau envoyer une image.", "Lever l'interdiction") : agir("interdire", `Interdire l'envoi d'images à ${nom}`, "L'image est retirée et il ne pourra plus en envoyer.", "Interdire l'envoi"),
    ),
  );
}

export async function vueImages(ctx: Contexte): Promise<Node[]> {
  const liste = await ctx.client.images();
  const galerie = (id: string, images: ImageAdmin[], vide: string) => (images.length === 0 ? p(vide, "admin-aide") : el("ul", { classe: "admin-images", attrs: { id } }, ...images.map((i) => carte(ctx, i))));
  return [
    el("h1", { classe: "admin-titre-section", texte: "Images" }),
    p(`Les images de profil et de groupe. Une image signalée par 3 joueurs différents est masquée tout de suite ; tu décides ici (${liste.max} par liste au plus).`, "admin-aide"),
    el("h2", { classe: "admin-titre-section", texte: `Signalées (${liste.signalees.length})` }),
    galerie("images-signalees", liste.signalees, "Aucune image signalée."),
    el("h2", { classe: "admin-titre-section", texte: `Nouvelles (${liste.nouvelles.length})` }),
    galerie("images-nouvelles", liste.nouvelles, "Aucune nouvelle image à regarder. « Garder » marque une image comme vue."),
  ];
}
