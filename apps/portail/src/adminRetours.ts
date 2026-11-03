import { bouton, el } from "@cdj/ui";
import { ErreurAdmin, STATUTS_RETOUR_ADMIN, TYPES_RETOUR_ADMIN, texteErreur, type FiltresRetours, type RetourDetail, type RetourResume, type StatutRetourAdmin } from "./adminDonnees";
import type { Contexte } from "./adminDiffusion";

// Lot C1, partie A (plateforme) — la rubrique « Retours » du panneau : la liste (filtres type, jeu, statut ; le nombre de non lus), le détail d'un retour (le fil, le contexte joint, le joueur avec le lien vers sa
// fiche), répondre et changer le statut. Chaque action est inscrite au journal par le serveur. **Un message est un texte** : tout est posé en `textContent`. Serveur : `apps/api/CLAUDE.md`, « Retours (lot C1) ».

const p = (texte: string, classe?: string) => el("p", { classe, texte });
const message = (kind: "erreur" | "info", texte: string) => el("p", { classe: ["admin-message", `admin-message--${kind}`], attrs: { role: kind === "erreur" ? "alert" : "status" }, texte });
const JEUX = ["portail", "track", "jump", "tower"] as const;
const quand = (iso: string): string => new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" });

/** L'adresse de la liste avec ses filtres (`#/retours?type=&jeu=&statut=&page=`). */
export function adresseRetours(f: FiltresRetours): string {
  const params = new URLSearchParams();
  if (f.type) params.set("type", f.type);
  if (f.jeu) params.set("jeu", f.jeu);
  if (f.statut) params.set("statut", f.statut);
  if (f.page && f.page > 1) params.set("page", String(f.page));
  const s = params.toString();
  return `#/retours${s ? `?${s}` : ""}`;
}

export async function vueRetours(ctx: Contexte, f: FiltresRetours): Promise<Node[]> {
  const liste = await ctx.client.retours(f);
  const choix = (nom: "type" | "jeu" | "statut", libelle: string, valeurs: Record<string, string>): HTMLElement => {
    const select = el("select", { attrs: { id: `retours-${nom}`, name: nom, "data-filtre": nom } }, el("option", { attrs: { value: "" }, texte: "Tous" }), ...Object.entries(valeurs).map(([v, t]) => el("option", { attrs: { value: v, selected: f[nom] === v }, texte: t })));
    return el("div", { classe: "admin-champ" }, el("label", { attrs: { for: `retours-${nom}` }, texte: libelle }), select);
  };
  const forme = el(
    "form",
    { classe: "admin-recherche", attrs: { id: "retours-filtres" } },
    choix("type", "Type", TYPES_RETOUR_ADMIN),
    choix("jeu", "Jeu", Object.fromEntries(JEUX.map((j) => [j, j === "portail" ? "Portail" : j.charAt(0).toUpperCase() + j.slice(1)]))),
    choix("statut", "Statut", STATUTS_RETOUR_ADMIN),
    bouton({ texte: "Filtrer", variante: "secondaire" }),
  );
  forme.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const d = new FormData(forme as HTMLFormElement);
    location.hash = adresseRetours({ type: String(d.get("type") ?? ""), jeu: String(d.get("jeu") ?? ""), statut: String(d.get("statut") ?? "") });
  });
  const ligne = (r: RetourResume): HTMLElement =>
    el(
      "tr",
      { attrs: { "data-retour": String(r.id) } },
      el("td", {}, el("a", { attrs: { href: `#/retours/${r.id}` }, texte: `n° ${r.id}` }), r.nonLu ? el("span", { classe: "admin-pastille admin-pastille--probleme", texte: "non lu" }) : null),
      el("td", { texte: TYPES_RETOUR_ADMIN[r.type] }),
      el("td", { texte: r.jeu }),
      el("td", { texte: STATUTS_RETOUR_ADMIN[r.statut] }),
      el("td", { texte: r.pseudo ?? (r.ref ? r.ref : "sans profil") }),
      el("td", { classe: "admin-retour__apercu", texte: r.apercu }),
      el("td", { texte: quand(r.majLe) }),
    );
  const pagination = el(
    "div",
    { classe: "admin-actions" },
    liste.page > 1 ? el("a", { classe: "dj-bouton dj-bouton--secondaire", attrs: { href: adresseRetours({ ...f, page: liste.page - 1 }) }, texte: "‹ Précédente" }) : null,
    liste.suivante ? el("a", { classe: "dj-bouton dj-bouton--secondaire", attrs: { href: adresseRetours({ ...f, page: liste.page + 1 }) }, texte: "Suivante ›" }) : null,
  );
  return [
    el("h1", { classe: "admin-titre-section", texte: "Retours" }),
    p(`${liste.nonLus} retour${liste.nonLus > 1 ? "s" : ""} à lire. Les messages des joueurs (« Un bug ? Une idée ? ») : tu réponds ici, ils lisent la réponse dans « Mes messages », sans e-mail.`, "admin-aide"),
    forme,
    liste.retours.length === 0
      ? p("Aucun retour.", "admin-aide")
      : el(
          "table",
          { classe: "admin-table", attrs: { id: "retours-liste" } },
          el("thead", {}, el("tr", {}, ...["Retour", "Type", "Jeu", "Statut", "Joueur", "Message", "Dernière activité"].map((t) => el("th", { attrs: { scope: "col" }, texte: t })))),
          el("tbody", {}, ...liste.retours.map(ligne)),
        ),
    pagination,
  ];
}

const NOMS_CONTEXTE: Record<string, string> = { jeu: "Jeu", page: "Page", jour: "Jour", version: "Version", navigateur: "Navigateur", systeme: "Système", ecran: "Écran", langue: "Langue" };

export async function vueRetour(ctx: Contexte, id: number): Promise<Node[]> {
  let d: RetourDetail = await ctx.client.retour(id);
  const retour = el("div", { attrs: { id: "retour-retour" } });
  const dire = (kind: "erreur" | "info", texte: string) => retour.replaceChildren(message(kind, texte));
  const erreur = async (e: unknown) => {
    if (e instanceof ErreurAdmin && e.statut === 401) await ctx.sessionExpiree();
    else dire("erreur", texteErreur(e));
  };
  // Ouvrir un retour le marque lu (nouveau → lu) : une action inscrite au journal, une seule fois.
  if (d.nonLu || d.statut === "nouveau") {
    try {
      const r = await ctx.client.lireRetour(id);
      d = { ...d, statut: r.statut, nonLu: false };
    } catch {
      /* il reste non lu : sans importance pour l'affichage */
    }
  }
  const bulles = d.messages.map((m) =>
    el(
      "li",
      { classe: ["admin-bulle", `admin-bulle--${m.auteur}`], attrs: { "data-auteur": m.auteur } },
      el("p", { classe: "admin-aide", texte: `${m.auteur === "admin" ? "Toi" : (d.pseudo ?? "Visiteur")} · ${quand(m.creeLe)}` }),
      el("p", { classe: "admin-bulle__texte", texte: m.texte }),
    ),
  );
  const contexte = el(
    "dl",
    { classe: "admin-etat", attrs: { id: "retour-contexte" } },
    ...Object.entries(NOMS_CONTEXTE).map(([k, nom]) => el("div", { classe: "admin-etat__ligne" }, el("dt", { texte: nom }), el("dd", { texte: String(d.contexte?.[k] ?? "—") }))),
  );
  const statut = el("select", { attrs: { id: "retour-statut", "aria-label": "Statut" } }, ...Object.entries(STATUTS_RETOUR_ADMIN).map(([v, t]) => el("option", { attrs: { value: v, selected: d.statut === v }, texte: t })));
  const changer = bouton({
    texte: "Changer le statut",
    variante: "secondaire",
    onClick: async () => {
      const vers = (statut as HTMLSelectElement).value as StatutRetourAdmin;
      if (vers === d.statut) return dire("info", "Le statut est déjà celui-là.");
      try {
        await ctx.client.statutRetour(id, vers);
        await ctx.recharger(`Statut : ${STATUTS_RETOUR_ADMIN[vers]}.`);
      } catch (e) {
        await erreur(e);
      }
    },
  });
  const champ = el("textarea", { attrs: { id: "retour-reponse", rows: 5, maxlength: 1000, autocomplete: "off", "aria-label": "Ta réponse" } }) as HTMLTextAreaElement;
  const envoyer = el("button", { classe: "dj-bouton dj-bouton--marque", attrs: { type: "submit", id: "retour-envoyer" }, texte: "Envoyer la réponse" });
  const reponse = el("form", { classe: "admin-champ", attrs: { id: "retour-form" } }, champ, envoyer);
  reponse.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const texte = champ.value.trim();
    if (!texte) return dire("erreur", "Écris une réponse d'abord.");
    try {
      await ctx.client.repondreRetour(id, texte);
      await ctx.recharger("Réponse envoyée.");
    } catch (e) {
      await erreur(e);
    }
  });
  return [
    el("a", { classe: "admin-retour-lien", attrs: { href: "#/retours" }, texte: "‹ Retours" }),
    el("h1", { classe: "admin-titre-section", texte: `Retour n° ${d.id} · ${TYPES_RETOUR_ADMIN[d.type]}` }),
    el(
      "p",
      { classe: "admin-aide" },
      `${STATUTS_RETOUR_ADMIN[d.statut]} · ${d.jeu} · ${quand(d.creeLe)} · `,
      d.ref ? el("a", { attrs: { href: `#/joueurs/${encodeURIComponent(d.ref)}` }, texte: d.pseudo ? `${d.pseudo} (${d.ref})` : d.ref }) : "visiteur sans profil",
    ),
    retour,
    el("ul", { classe: "admin-bulles", attrs: { id: "retour-fil" } }, ...bulles),
    d.reponsePossible ? reponse : p("Ce retour vient d'un visiteur sans profil : aucune réponse ne peut lui parvenir.", "admin-aide"),
    el("div", { classe: "admin-actions" }, statut, changer),
    el("h2", { classe: "admin-titre-section", texte: "Contexte joint" }),
    contexte,
  ];
}
