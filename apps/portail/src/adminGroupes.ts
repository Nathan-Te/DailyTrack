import { bouton, el } from "@cdj/ui";
import { type ActionGroupe, type FicheGroupeAdmin, type GroupeResume } from "./adminDonnees";
import type { Contexte } from "./adminDiffusion";

// Lot C1, partie C (plateforme) — la rubrique « Groupes » du panneau : chercher un groupe par son nom, ouvrir sa fiche (description, membres, emblème), puis renommer, retirer l'emblème, retirer un membre, changer
// le chef, masquer le groupe des classements, le dissoudre. Chaque action est confirmée (la dissolution demande de retaper le nom) et inscrite au journal par le serveur. Tout texte est posé en `textContent`.
// Serveur : `apps/api/CLAUDE.md`, « Groupes (lot C1) ».

const p = (texte: string, classe?: string) => el("p", { classe, texte });
const quand = (iso: string): string => new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeZone: "Europe/Paris" });

export async function vueGroupes(ctx: Contexte, o: { q: string; page: number }): Promise<Node[]> {
  const liste = await ctx.client.groupes(o);
  const champ = el("input", { attrs: { type: "search", id: "groupes-recherche", value: o.q, placeholder: "Nom du groupe", "aria-label": "Chercher un groupe" } }) as HTMLInputElement;
  const forme = el("form", { classe: "admin-recherche", attrs: { id: "groupes-filtres" } }, champ, bouton({ texte: "Chercher", variante: "secondaire" }));
  forme.addEventListener("submit", (ev) => {
    ev.preventDefault();
    location.hash = `#/groupes${champ.value.trim() ? `?q=${encodeURIComponent(champ.value.trim())}` : ""}`;
  });
  const ligne = (g: GroupeResume): HTMLElement =>
    el("tr", { attrs: { "data-groupe": g.id } }, el("td", {}, el("a", { attrs: { href: `#/groupes/${g.id}` }, texte: g.nom })), el("td", { texte: String(g.membres) }), el("td", { texte: g.masque ? "masqué des classements" : "—" }), el("td", { texte: quand(g.creeLe) }));
  return [
    el("h1", { classe: "admin-titre-section", texte: "Groupes" }),
    p("Les groupes des joueurs : tu peux renommer, retirer un emblème ou un membre, changer le chef, masquer un groupe des classements ou le dissoudre.", "admin-aide"),
    forme,
    liste.groupes.length === 0
      ? p("Aucun groupe.", "admin-aide")
      : el("table", { classe: "admin-table", attrs: { id: "groupes-liste" } }, el("thead", {}, el("tr", {}, ...["Groupe", "Membres", "Classements", "Créé le"].map((t) => el("th", { attrs: { scope: "col" }, texte: t })))), el("tbody", {}, ...liste.groupes.map(ligne))),
    el(
      "div",
      { classe: "admin-actions" },
      liste.page > 1 ? el("a", { classe: "dj-bouton dj-bouton--secondaire", attrs: { href: `#/groupes?${o.q ? `q=${encodeURIComponent(o.q)}&` : ""}page=${liste.page - 1}` }, texte: "‹ Précédente" }) : null,
      liste.suivante ? el("a", { classe: "dj-bouton dj-bouton--secondaire", attrs: { href: `#/groupes?${o.q ? `q=${encodeURIComponent(o.q)}&` : ""}page=${liste.page + 1}` }, texte: "Suivante ›" }) : null,
    ),
  ];
}

export async function vueGroupe(ctx: Contexte, id: string): Promise<Node[]> {
  return (await fiche(ctx, id)).filter((n): n is Node => n !== null);
}

async function fiche(ctx: Contexte, id: string): Promise<(Node | null)[]> {
  const g: FicheGroupeAdmin = await ctx.client.groupe(id);
  const agir = (action: ActionGroupe, libelle: string, texte: string, corps: Record<string, unknown> = {}, champs?: { nom: string; libelle: string; valeur?: string; max?: number }[], verifier?: (v: Record<string, string>) => string | null) =>
    bouton({
      texte: libelle,
      variante: action === "dissoudre" ? "marque" : "secondaire",
      onClick: async () => {
        const v = await ctx.confirmer({ titre: `${libelle} · ${g.nom}`, texte, action: libelle, irreversible: action === "dissoudre" || action === "retirer", champs, verifier });
        if (!v) return;
        try {
          await ctx.client.actionGroupe(g.id, action, { ...corps, ...(action === "renommer" ? { nom: v.nom } : {}), ...(action === "dissoudre" ? { nom: g.nom } : {}) });
          await ctx.recharger(`${libelle} : fait.`);
        } catch (e) {
          await ctx.refuser(e);
        }
      },
    });
  const membres = g.membres.map((m) =>
    el(
      "li",
      { classe: "admin-image", attrs: { "data-ref": m.ref } },
      el("p", { classe: "admin-image__nom", texte: `${m.pseudo}${m.chef ? " · chef" : ""}${m.masque ? " · masqué" : ""}` }),
      p(`Depuis le ${quand(m.depuis)}`, "admin-aide"),
      el("div", { classe: "admin-actions" }, el("a", { attrs: { href: `#/joueurs/${encodeURIComponent(m.ref)}` }, texte: "Fiche du joueur" }), m.chef ? null : agir("chef", "Nommer chef", `${m.pseudo} devient le chef du groupe.`, { ref: m.ref }), agir("retirer", "Retirer du groupe", `${m.pseudo} quitte le groupe${m.chef ? " (le membre le plus ancien devient chef, ou le groupe est dissous)" : ""}.`, { ref: m.ref })),
    ),
  );
  return [
    el("a", { classe: "admin-retour-lien", attrs: { href: "#/groupes" }, texte: "‹ Groupes" }),
    el("h1", { classe: "admin-titre-section", attrs: { id: "groupe-titre" }, texte: g.nom }),
    p(`${g.masque ? "Masqué des classements · " : ""}Créé le ${quand(g.creeLe)}${g.renommeLe ? ` · renommé le ${quand(g.renommeLe)}` : ""} · emblème : ${g.emblem ? g.emblem.statut : "aucun"}`, "admin-aide"),
    g.description ? p(g.description, "groupe-description") : null,
    el(
      "div",
      { classe: "admin-actions" },
      agir("renommer", "Renommer", "Le groupe prend le nouveau nom (le nom doit rester libre).", {}, [{ nom: "nom", libelle: "Nouveau nom", valeur: g.nom, max: 24 }], (v) => ((v.nom ?? "").trim().length < 3 ? "3 caractères au moins" : null)),
      g.emblem && g.emblem.statut !== "retire" ? agir("emblem-retirer", "Retirer l'emblème", "L'emblème est supprimé du serveur ; les initiales reviennent.") : null,
      agir("masquer", g.masque ? "Remontrer dans les classements" : "Masquer des classements", g.masque ? "Le groupe revient dans les classements des groupes." : "Le groupe n'apparaît plus dans les classements des groupes ni dans son rang.", { masque: !g.masque }),
      agir("dissoudre", "Dissoudre le groupe", "Le groupe, ses membres (ils restent des joueurs) et son emblème sont supprimés. Irréversible."),
    ),
    el("h2", { classe: "admin-titre-section", texte: `Membres (${g.membres.length})` }),
    el("ul", { classe: "admin-images", attrs: { id: "groupe-membres-admin" } }, ...membres),
  ];
}
