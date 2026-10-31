import { NOM_DE_ZONE, ZONES_NOUVEAUTES, MESSAGE_MAX, OU_MESSAGE, cleDeNouveaute, exporterNouveautes, lireExport, longueur, nettoyerMessage, nettoyerNouveaute, problemesDeMessage, texteProblemeImport, problemesDePublication, texteProbleme, texteProblemeMessage, type MessageContenu, type OuMessage, type TonMessage, type ZoneNouveaute } from "@cdj/core/nouveautes";
import { bouton, el } from "@cdj/ui";
import {
  ErreurAdmin,
  aujourdhuiParis,
  finDuMessage,
  heure,
  jourCourt,
  jourLong,
  texteErreur,
  type AnnonceAdmin,
  type ClientAdmin,
  type FinDuMessage,
  type LigneAdmin,
  type MessagesAdmin,
  type NouveauteAdmin,
} from "./adminDonnees";
import { compterPrDepuis, instantDeEtiquette, lirePrs, texteErreurGithub, type LecturePr, type PrLue } from "./adminGithub";

// Lot N2 (plateforme) — les deux rubriques du panneau qui étaient éteintes : **Nouveautés** (rédiger à partir des PR fusionnées depuis la dernière mise en production, aperçu, brouillon,
// publier ; gérer ce qui est publié) et **Message en direct** (une phrase à tous les joueurs, un seul message actif, il s'éteint seul). Maquette : docs/plateforme/maquettes/admin-et-nouveautes.html
// (planches 4 et 5 : non fournie à ce lot, voir le README). Rien n'est interprété comme du HTML : tout texte (GitHub, serveur, saisie) se pose en `textContent`. Rien n'est gardé dans le navigateur :
// le brouillon en cours vit dans la mémoire de la page (il survit au changement de rubrique, pas au rechargement ; « Garder en brouillon » l'enregistre sur le serveur).

type Confirmer = (o: { titre: string; texte: string; champs?: { nom: string; libelle: string; valeur?: string; max?: number; aide?: string }[]; action: string; irreversible?: boolean; verifier?: (v: Record<string, string>) => string | null }) => Promise<Record<string, string> | null>;

export interface Contexte {
  client: ClientAdmin;
  confirmer: Confirmer;
  /** Redessine la vue courante (après une action) ; `texte` : le message de réussite à montrer. */
  recharger: (texte?: string) => Promise<void>;
  /** Un 401 : retour à l'écran de connexion. */
  sessionExpiree: () => Promise<void>;
  /** L'étiquette `prod-…` du serveur (tableau de bord), `null` si inconnue. */
  etiquette: () => Promise<string | null>;
}

const p = (texte: string, classe?: string) => el("p", { classe, texte });
const message = (kind: "erreur" | "info", texte: string) => el("p", { classe: ["admin-message", `admin-message--${kind}`], attrs: { role: kind === "erreur" ? "alert" : "status" }, texte });
const titreCarte = (texte: string, id: string) => el("h2", { classe: "admin-titre-section admin-titre-carte", attrs: { id }, texte });
const boutonEnvoi = (texte: string) => el("button", { classe: "dj-bouton dj-bouton--marque", attrs: { type: "submit" }, texte });
const champ = (id: string, libelle: string, entree: HTMLElement, aide?: string) =>
  el("div", { classe: "admin-champ" }, el("label", { attrs: { for: id }, texte: libelle }), entree, aide ? el("p", { classe: "admin-aide", attrs: { id: `${id}-aide` }, texte: aide }) : null);

/** Fait télécharger `texte` comme un fichier (lien temporaire vers un objet local : rien ne part sur le réseau). */
function telecharger(nom: string, texte: string): void {
  const url = URL.createObjectURL(new Blob([texte], { type: "application/json" }));
  const a = el("a", { attrs: { href: url, download: nom } });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5_000);
}

/** Un 401 ramène à la connexion ; le reste se dit. */
async function surErreur(ctx: Contexte, e: unknown, dire: (texte: string) => void): Promise<void> {
  if (e instanceof ErreurAdmin && e.statut === 401) await ctx.sessionExpiree();
  else if (e instanceof ErreurAdmin && (e.code === "invalid_news" || e.code === "invalid_message") && Array.isArray(e.details.problemes)) {
    const lignes = (e.details.problemes as { code: string; n?: number; langue?: "fr" | "en" }[]).map((x) => (e.code === "invalid_news" ? texteProbleme(x as Parameters<typeof texteProbleme>[0]) : texteProblemeMessage(x as Parameters<typeof texteProblemeMessage>[0])));
    dire(lignes.join(" "));
  } else dire(texteErreur(e));
}

// =================================================================================================================================================
// Nouveautés
// =================================================================================================================================================
interface Brouillon {
  id: number | null;
  /** Était publiée quand on l'a ouverte : l'enregistrer la garde publiée. */
  publiee: boolean;
  titreFr: string;
  titreEn: string;
  date: string;
  lignes: LigneAdmin[];
}

const brouillonNeuf = (): Brouillon => ({ id: null, publiee: false, titreFr: "", titreEn: "", date: aujourdhuiParis(Date.now()), lignes: [] });
let brouillon: Brouillon = brouillonNeuf();
let afficherRien = false;
let apercu = false;
/** Les PR lues, gardées en mémoire de la page (l'API publique de GitHub laisse 60 lectures par heure : une visite en coûte 3, jamais davantage). */
let prsGardees: { courante: string | null; valeur: Promise<LecturePr> } | null = null;

const contenuDe = (b: Brouillon) => nettoyerNouveaute({ titre: { fr: b.titreFr, en: b.titreEn }, date: b.date, lignes: b.lignes });
const problemes = (b: Brouillon) => problemesDePublication(contenuDe(b)).map(texteProbleme);

function lirePrsGardees(courante: string | null): Promise<LecturePr> {
  if (!prsGardees || prsGardees.courante !== courante) {
    const valeur = lirePrs((...a) => fetch(...a), courante);
    prsGardees = { courante, valeur };
    valeur.catch(() => {
      if (prsGardees?.valeur === valeur) prsGardees = null; // une lecture qui échoue n'est pas gardée : « Relire » réessaie
    });
  }
  return prsGardees.valeur;
}

/** Les lignes d'une PR, prêtes pour l'éditeur : une ligne mal formée est reprise telle quelle (zone à choisir, texte à retoucher). */
const lignesDeLaPr = (pr: PrLue): LigneAdmin[] => pr.section.lignes.map((l) => ({ zone: l.zone, fr: l.malformee ? l.brut : l.fr, en: l.malformee ? "" : l.en, pr: pr.numero }));

export async function vueNouveautes(ctx: Contexte): Promise<Node[]> {
  const liste = await ctx.client.nouveautes();
  const publiees = liste.nouveautes.filter((n) => n.statut === "publiee");
  /** Numéro de PR → la nouveauté publiée qui en a déjà repris des lignes. */
  const dejaPubliees = new Map<number, NouveauteAdmin>();
  for (const n of publiees) for (const l of n.lignes) if (l.pr !== undefined && !dejaPubliees.has(l.pr)) dejaPubliees.set(l.pr, n);

  const zoneMessage = el("div", { attrs: { id: "nouveautes-message" } });
  const dire = (kind: "erreur" | "info", texte: string) => zoneMessage.replaceChildren(message(kind, texte));

  // --- À gauche : les PR ---------------------------------------------------------------------------------------------------------------------
  const colonnePrs = el("section", { classe: "admin-colonne", attrs: { "aria-labelledby": "titre-prs", id: "colonne-prs" } }, el("h3", { classe: "admin-sous-titre", attrs: { id: "titre-prs" }, texte: "PR fusionnées depuis la dernière mise en production" }));
  const zonePrs = el("div", { attrs: { id: "liste-prs" } }, message("info", "Lecture de GitHub…"));
  colonnePrs.append(zonePrs);

  // --- À droite : l'éditeur ------------------------------------------------------------------------------------------------------------------
  const colonneEditeur = el("section", { classe: "admin-colonne", attrs: { "aria-labelledby": "titre-editeur", id: "colonne-editeur" } });

  const majVerification = () => {
    const pb = problemes(brouillon);
    const zone = document.getElementById("nouveautes-problemes");
    zone?.replaceChildren(...(pb.length ? [el("ul", { classe: "admin-problemes" }, ...pb.map((x) => el("li", { texte: x })))] : [p("Prête à publier.", "admin-aide")]));
    const publier = document.getElementById("nouveautes-publier");
    if (publier) {
      publier.toggleAttribute("disabled", pb.length > 0);
      publier.setAttribute("aria-disabled", String(pb.length > 0));
    }
    majApercu();
  };

  function majApercu(): void {
    const zone = document.getElementById("nouveautes-apercu");
    if (!zone) return;
    zone.hidden = !apercu;
    if (!apercu) return;
    const c = contenuDe(brouillon);
    const carte = (langue: "fr" | "en") =>
      el(
        "div",
        { classe: "admin-apercu__carte", attrs: { lang: langue, "data-langue": langue } },
        el("p", { classe: "admin-apercu__ligne-accueil", texte: `${langue === "fr" ? "Nouveautés" : "What's new"} · ${jourCourt(c.date || aujourdhuiParis(Date.now()))}` }),
        el("p", { classe: "admin-apercu__titre", texte: (langue === "fr" ? c.titre.fr : c.titre.en) || "—" }),
        el(
          "ul",
          { classe: "admin-apercu__lignes" },
          ...c.lignes.map((l) => el("li", {}, el("span", { classe: ["admin-zone", l.zone && `admin-zone--${l.zone}`], texte: l.zone ? NOM_DE_ZONE[l.zone] : "?" }), el("span", { texte: (langue === "fr" ? l.fr : l.en) || "—" }))),
        ),
      );
    zone.replaceChildren(el("h3", { classe: "admin-sous-titre", texte: "Aperçu, tel que les joueurs le voient" }), el("div", { classe: "admin-apercu__langues" }, carte("fr"), carte("en")));
  }

  function majLignes(): void {
    const ul = document.getElementById("nouveautes-lignes");
    if (!ul) return;
    ul.replaceChildren(
      ...brouillon.lignes.map((l, i) => {
        const zone = el("select", { attrs: { "aria-label": `Zone de la ligne ${i + 1}`, "data-champ": "zone" } }, el("option", { attrs: { value: "" }, texte: "Zone ?" }), ...ZONES_NOUVEAUTES.map((z) => el("option", { attrs: { value: z, selected: l.zone === z }, texte: NOM_DE_ZONE[z] })));
        zone.addEventListener("change", () => {
          l.zone = (zone.value || null) as ZoneNouveaute | null;
          majVerification();
        });
        // Des zones de texte (plusieurs lignes visibles) : une ligne de nouveauté est une phrase, pas un mot. Entrée n'ajoute pas de retour à la ligne.
        const fr = el("textarea", { attrs: { rows: 3, maxlength: 400, "aria-label": `Français, ligne ${i + 1}`, "data-champ": "fr" } });
        fr.value = l.fr;
        fr.addEventListener("input", () => {
          fr.value = fr.value.replace(/[\r\n]+/g, " ");
          l.fr = fr.value;
          majVerification();
        });
        const en = el("textarea", { attrs: { rows: 3, maxlength: 400, "aria-label": `Anglais, ligne ${i + 1}`, "data-champ": "en", lang: "en" } });
        en.value = l.en;
        en.addEventListener("input", () => {
          en.value = en.value.replace(/[\r\n]+/g, " ");
          l.en = en.value;
          en.classList.toggle("admin-manque", l.fr.trim() !== "" && en.value.trim() === "");
          majVerification();
        });
        en.classList.toggle("admin-manque", l.fr.trim() !== "" && l.en.trim() === "");
        const retirer = bouton({
          texte: "Retirer",
          variante: "secondaire",
          ariaLabel: `Retirer la ligne ${i + 1}`,
          onClick: () => {
            brouillon.lignes.splice(i, 1);
            majLignes();
            majVerification();
            majPrs();
          },
        });
        return el("li", { classe: "admin-ligne", attrs: { "data-index": String(i), ...(l.pr !== undefined ? { "data-pr": String(l.pr) } : {}) } }, el("div", { classe: "admin-ligne__entete" }, zone, retirer), fr, en, l.pr !== undefined ? el("span", { classe: "admin-aide", texte: `PR ${l.pr}` }) : null);
      }),
    );
    if (brouillon.lignes.length === 0) ul.append(el("li", { classe: "admin-aide", texte: "Aucune ligne : coche une PR à gauche ou ajoute une ligne." }));
  }

  async function enregistrer(publier: boolean): Promise<void> {
    const c = contenuDe(brouillon);
    try {
      const r = await ctx.client.enregistrerNouveaute({ ...(brouillon.id !== null ? { id: brouillon.id } : {}), titre: c.titre, date: c.date, lignes: brouillon.lignes.map((l, i) => ({ ...l, ...c.lignes[i]! })), publier });
      brouillon = brouillonNeuf();
      apercu = false;
      await ctx.recharger(publier ? `Nouveauté « ${r.nouveaute.titre.fr} » publiée : elle est sur l'accueil et sur la page Nouveautés.` : `Brouillon « ${r.nouveaute.titre.fr || "(sans titre)"} » enregistré.`);
    } catch (e) {
      await surErreur(ctx, e, (t) => dire("erreur", t));
    }
  }

  function dessinerEditeur(): void {
    const titreFr = el("input", { attrs: { id: "nouveaute-titre-fr", type: "text", maxlength: 80, value: brouillon.titreFr, autocomplete: "off" } });
    const titreEn = el("input", { attrs: { id: "nouveaute-titre-en", type: "text", maxlength: 80, value: brouillon.titreEn, autocomplete: "off", lang: "en" } });
    const date = el("input", { attrs: { id: "nouveaute-date", type: "date", value: brouillon.date } });
    titreFr.addEventListener("input", () => {
      brouillon.titreFr = titreFr.value;
      majVerification();
    });
    titreEn.addEventListener("input", () => {
      brouillon.titreEn = titreEn.value;
      majVerification();
    });
    date.addEventListener("input", () => {
      brouillon.date = date.value;
      majVerification();
    });
    const publier = el("button", { classe: "dj-bouton dj-bouton--marque", attrs: { type: "button", id: "nouveautes-publier" }, texte: brouillon.publiee ? "Enregistrer les modifications" : "Publier" });
    publier.addEventListener("click", async () => {
      if (problemes(brouillon).length) return;
      const v = await ctx.confirmer({
        titre: brouillon.publiee ? "Modifier la nouveauté publiée" : "Publier la nouveauté",
        texte: `« ${brouillon.titreFr} » ${brouillon.publiee ? "est modifiée" : "apparaît tout de suite"} sur l'accueil du portail et sur la page Nouveautés, en français et en anglais.`,
        action: brouillon.publiee ? "Enregistrer" : "Publier",
      });
      if (v) await enregistrer(true);
    });
    const brouillonBouton = bouton({ texte: "Garder en brouillon", variante: "secondaire", onClick: () => void enregistrer(false) });
    brouillonBouton.id = "nouveautes-brouillon";
    if (brouillon.publiee) brouillonBouton.hidden = true; // une publiée se dépublie depuis la liste (confirmée), pas d'ici
    const apercuBouton = bouton({
      texte: "Aperçu",
      variante: "secondaire",
      onClick: () => {
        apercu = !apercu;
        apercuBouton.setAttribute("aria-pressed", String(apercu));
        majApercu();
      },
    });
    apercuBouton.id = "nouveautes-apercu-bouton";
    apercuBouton.setAttribute("aria-pressed", String(apercu));
    const ajouter = bouton({
      texte: "Ajouter une ligne",
      variante: "secondaire",
      onClick: () => {
        brouillon.lignes.push({ zone: null, fr: "", en: "" });
        majLignes();
        majVerification();
        document.querySelector<HTMLTextAreaElement>("#nouveautes-lignes li:last-child [data-champ=fr]")?.focus();
      },
    });
    const vider = brouillon.id !== null || brouillon.lignes.length || brouillon.titreFr
      ? bouton({
          texte: brouillon.id !== null ? "Annuler la modification" : "Tout effacer",
          variante: "secondaire",
          onClick: () => {
            brouillon = brouillonNeuf();
            apercu = false;
            void ctx.recharger();
          },
        })
      : null;
    colonneEditeur.replaceChildren(
      el("h3", { classe: "admin-sous-titre", attrs: { id: "titre-editeur" }, texte: brouillon.id !== null ? `Nouveauté n° ${brouillon.id}${brouillon.publiee ? " (publiée)" : " (brouillon)"}` : "Nouvelle nouveauté" }),
      champ("nouveaute-titre-fr", "Titre court (français) : la ligne de l'accueil", titreFr),
      champ("nouveaute-titre-en", "Short title (English)", titreEn),
      champ("nouveaute-date", "Date affichée", date),
      el("h4", { classe: "admin-sous-titre", texte: "Lignes : une par changement visible" }),
      el("ul", { classe: "admin-lignes", attrs: { id: "nouveautes-lignes" } }),
      el("div", { classe: "admin-actions" }, ajouter),
      el("div", { classe: "admin-problemes-zone", attrs: { id: "nouveautes-problemes", role: "status", "aria-live": "polite" } }),
      el("div", { classe: "admin-actions" }, apercuBouton, brouillonBouton, publier, vider),
      el("div", { classe: "admin-apercu", attrs: { id: "nouveautes-apercu", hidden: true } }),
    );
    majLignes();
    majVerification();
  }

  // --- La liste des PR ---------------------------------------------------------------------------------------------------------------------------
  let lecture: LecturePr | null = null;
  function majPrs(): void {
    if (!lecture) return;
    const l = lecture;
    const visibles = l.prs.filter((x) => afficherRien || !x.section.rien);
    const cachees = l.prs.length - visibles.length;
    const entete = l.courante
      ? `Depuis la mise en production ${l.precedente ?? "précédente"}${l.precedente ? ` (${heure(new Date(l.depuis).toISOString())})` : ""} ; en production : ${l.courante}.`
      : "Étiquette de mise en production inconnue : les 14 derniers jours.";
    const enfants: (HTMLElement | null)[] = [
      p(entete, "admin-aide"),
      l.tronquee ? message("info", "Plus de 200 PR : la liste est tronquée.") : null,
      visibles.length ? el("ul", { classe: "admin-prs", attrs: { id: "prs" } }, ...visibles.map(ligneDePr)) : p("Aucune PR à montrer.", "admin-aide"),
      cachees || afficherRien
        ? el(
            "label",
            { classe: "admin-case" },
            (() => {
              const c = el("input", { attrs: { type: "checkbox", id: "afficher-rien", checked: afficherRien } });
              c.addEventListener("change", () => {
                afficherRien = c.checked;
                majPrs();
              });
              return c;
            })(),
            el("span", { texte: afficherRien ? "Afficher aussi les PR « rien »" : `Afficher les PR « rien » (${cachees} cachée${cachees > 1 ? "s" : ""})` }),
          )
        : null,
      bouton({
        texte: "Relire GitHub",
        variante: "secondaire",
        onClick: () => {
          prsGardees = null;
          void chargerPrs();
        },
      }),
    ];
    zonePrs.replaceChildren(...enfants.filter((x): x is HTMLElement => x !== null));
  }

  function ligneDePr(pr: PrLue): HTMLElement {
    const cochee = brouillon.lignes.some((x) => x.pr === pr.numero);
    const deja = dejaPubliees.get(pr.numero);
    const sansLigne = pr.section.rien || !pr.section.presente || pr.section.lignes.length === 0;
    const case_ = el("input", { attrs: { type: "checkbox", checked: cochee, disabled: sansLigne && !cochee, "data-pr": String(pr.numero), "aria-label": `Ajouter les lignes de la PR ${pr.numero}` } });
    case_.addEventListener("change", () => {
      if (case_.checked) brouillon.lignes.push(...lignesDeLaPr(pr));
      else brouillon.lignes = brouillon.lignes.filter((x) => x.pr !== pr.numero);
      majLignes();
      majVerification();
      majPrs();
    });
    return el(
      "li",
      { classe: ["admin-pr", pr.pasEncoreEnProduction && "admin-pr--attente"], attrs: { "data-pr": String(pr.numero) } },
      el(
        "div",
        { classe: "admin-pr__tete" },
        case_,
        el("a", { classe: "admin-lien admin-pr__titre", attrs: { href: pr.url, target: "_blank", rel: "noopener noreferrer" }, texte: `#${pr.numero} ${pr.titre}` }),
      ),
      el(
        "div",
        { classe: "admin-pr__marques" },
        el("span", { classe: "admin-pastille", texte: pr.zone }),
        pr.pasEncoreEnProduction ? el("span", { classe: "admin-pastille admin-pastille--attente", texte: "pas encore en production" }) : null,
        deja ? el("span", { classe: "admin-pastille admin-pastille--masque", texte: `déjà dans la nouveauté du ${jourCourt(deja.date)}` }) : null,
        pr.section.rien ? el("span", { classe: "admin-pastille", texte: "rien" }) : null,
        pr.section.presente && !pr.section.rien && pr.section.lignes.length === 0 ? el("span", { classe: "admin-pastille admin-pastille--probleme", texte: "section vide" }) : null,
        !pr.section.presente ? el("span", { classe: "admin-pastille admin-pastille--probleme", texte: "section « Pour les joueurs » absente" }) : null,
      ),
      pr.section.lignes.length
        ? el(
            "ul",
            { classe: "admin-pr__lignes" },
            ...pr.section.lignes.map((x) =>
              el(
                "li",
                {},
                x.malformee ? el("span", { classe: "admin-pastille admin-pastille--probleme", texte: "à retoucher" }) : el("span", { classe: ["admin-zone", x.zone && `admin-zone--${x.zone}`], texte: x.zone ? NOM_DE_ZONE[x.zone] : "?" }),
                el("span", { texte: x.malformee ? x.brut : `${x.fr} // ${x.en || "…"}` }),
              ),
            ),
          )
        : null,
    );
  }

  async function chargerPrs(): Promise<void> {
    zonePrs.replaceChildren(message("info", "Lecture de GitHub…"));
    try {
      lecture = await lirePrsGardees(await ctx.etiquette());
      majPrs();
    } catch (e) {
      lecture = null;
      zonePrs.replaceChildren(
        message("erreur", texteErreurGithub(e)),
        bouton({
          texte: "Réessayer",
          variante: "secondaire",
          onClick: () => {
            prsGardees = null;
            void chargerPrs();
          },
        }),
      );
    }
  }

  // --- Gérer : les nouveautés publiées et les brouillons -------------------------------------------------------------------------------------
  const gestion = el(
    "section",
    { classe: "admin-carte", attrs: { "aria-labelledby": "titre-gestion", id: "nouveautes-gestion" } },
    titreCarte("Publiées et brouillons", "titre-gestion"),
    liste.nouveautes.length
      ? el(
          "ul",
          { classe: "admin-gestion" },
          ...liste.nouveautes.map((n) =>
            el(
              "li",
              { classe: "admin-gestion__ligne", attrs: { "data-id": String(n.id), "data-statut": n.statut } },
              el("span", { classe: "admin-gestion__date admin-mono", texte: jourCourt(n.date) }),
              el("span", { classe: "admin-gestion__titre", texte: n.titre.fr || "(sans titre)" }),
              el("span", { classe: ["admin-pastille", n.statut === "publiee" ? "admin-pastille--ok" : "admin-pastille--masque"], texte: n.statut === "publiee" ? "Publiée" : "Brouillon" }),
              el(
                "span",
                { classe: "admin-gestion__actions" },
                bouton({
                  texte: "Modifier",
                  variante: "secondaire",
                  ariaLabel: `Modifier « ${n.titre.fr} »`,
                  onClick: () => {
                    brouillon = { id: n.id, publiee: n.statut === "publiee", titreFr: n.titre.fr, titreEn: n.titre.en, date: n.date, lignes: n.lignes.map((l) => ({ ...l })) };
                    dessinerEditeur();
                    document.getElementById("colonne-editeur")?.scrollIntoView({ block: "start" });
                    document.getElementById("nouveaute-titre-fr")?.focus();
                  },
                }),
                n.statut === "publiee"
                  ? bouton({
                      texte: "Dépublier",
                      variante: "secondaire",
                      ariaLabel: `Dépublier « ${n.titre.fr} »`,
                      onClick: async () => {
                        const v = await ctx.confirmer({ titre: "Dépublier la nouveauté", texte: `« ${n.titre.fr} » disparaît de l'accueil et de la page Nouveautés ; elle reste ici en brouillon.`, action: "Dépublier" });
                        if (!v) return;
                        try {
                          await ctx.client.depublierNouveaute(n.id);
                          await ctx.recharger("Nouveauté dépubliée : elle est redevenue un brouillon.");
                        } catch (e) {
                          await surErreur(ctx, e, (t) => dire("erreur", t));
                        }
                      },
                    })
                  : null,
                bouton({
                  texte: "Supprimer",
                  variante: "secondaire",
                  ariaLabel: `Supprimer « ${n.titre.fr} »`,
                  onClick: async () => {
                    const v = await ctx.confirmer({ titre: "Supprimer la nouveauté", texte: `« ${n.titre.fr} » est supprimée${n.statut === "publiee" ? " et disparaît de l'accueil et de la page Nouveautés" : ""}. L'action est inscrite au journal.`, action: "Supprimer", irreversible: true });
                    if (!v) return;
                    try {
                      await ctx.client.supprimerNouveaute(n.id);
                      if (brouillon.id === n.id) brouillon = brouillonNeuf();
                      await ctx.recharger("Nouveauté supprimée.");
                    } catch (e) {
                      await surErreur(ctx, e, (t) => dire("erreur", t));
                    }
                  },
                }),
              ),
            ),
          ),
        )
      : p("Aucune nouveauté pour l'instant.", "admin-aide"),
  );

  // --- Échanger un changelog : exporter, importer (préparer sur la recette, reprendre en production) ------------------------------------------------
  const exportTexte = el("textarea", { attrs: { id: "export-texte", rows: 6, readonly: true, "aria-label": "Contenu de l'export", spellcheck: "false" } });
  const exportActions = el("div", { classe: "admin-actions", attrs: { hidden: true } });
  const montrerExport = (texte: string, nom: string, combien: string): void => {
    exportTexte.value = texte;
    exportTexte.hidden = false;
    exportActions.hidden = false;
    exportActions.replaceChildren(
      bouton({ texte: "Télécharger le fichier", variante: "secondaire", onClick: () => telecharger(nom, texte) }),
      bouton({
        texte: "Copier",
        variante: "secondaire",
        onClick: () =>
          navigator.clipboard.writeText(texte).then(
            () => dire("info", "Export copié : colle-le dans « Importer » de l'autre panneau (recette ou production)."),
            () => dire("erreur", "Copie refusée par le navigateur : sélectionne le texte et copie-le à la main."),
          ),
      }),
    );
    dire("info", `${combien} exportée${combien.startsWith("1 ") ? "" : "s"} (${texte.length} caractères). Rien n'est modifié ici.`);
  };
  const maintenantIso = () => new Date().toISOString();
  const nomDeFichier = () => `nouveautes-${aujourdhuiParis(Date.now())}.json`;
  const exporterEditeur = bouton({
    texte: "Exporter le brouillon en cours",
    variante: "secondaire",
    onClick: () => {
      const c = contenuDe(brouillon);
      if (!c.titre.fr && !c.titre.en && c.lignes.length === 0) return dire("erreur", "L'éditeur est vide : rien à exporter.");
      montrerExport(exporterNouveautes([{ ...c, lignes: brouillon.lignes.map((l, i) => ({ ...l, ...c.lignes[i]! })), statut: brouillon.publiee ? "publiee" : "brouillon" }], maintenantIso()), nomDeFichier(), "1 nouveauté");
    },
  });
  exporterEditeur.id = "export-editeur";
  const exporterTout = bouton({
    texte: `Tout exporter (${liste.nouveautes.length})`,
    variante: "secondaire",
    desactive: liste.nouveautes.length === 0,
    onClick: () => {
      if (liste.nouveautes.length === 0) return;
      montrerExport(exporterNouveautes(liste.nouveautes.map((n) => ({ titre: n.titre, date: n.date, lignes: n.lignes, statut: n.statut })), maintenantIso()), nomDeFichier(), `${liste.nouveautes.length} nouveauté${liste.nouveautes.length > 1 ? "s" : ""}`);
    },
  });
  exporterTout.id = "export-tout";
  const importTexte = el("textarea", { attrs: { id: "import-texte", rows: 6, "aria-label": "Export à importer (colle le texte ou choisis un fichier)", spellcheck: "false" } });
  const fichier = el("input", { attrs: { id: "import-fichier", type: "file", accept: "application/json,.json", "aria-label": "Choisir un fichier d'export" } });
  fichier.addEventListener("change", async () => {
    const f = fichier.files?.[0];
    if (!f) return;
    if (f.size > 400_000) return dire("erreur", "Ce fichier est trop gros pour être un changelog.");
    importTexte.value = await f.text();
    dire("info", `Fichier « ${f.name} » chargé : vérifie-le puis clique sur « Importer en brouillons ».`);
  });
  const importer = bouton({
    texte: "Importer en brouillons",
    variante: "marque",
    onClick: async () => {
      const lu = lireExport(importTexte.value, aujourdhuiParis(Date.now()));
      if (!lu.ok) return dire("erreur", texteProblemeImport(lu.probleme));
      const connues = new Set(liste.nouveautes.map(cleDeNouveaute));
      const nouvelles = lu.nouveautes.filter((n, i, tous) => !connues.has(cleDeNouveaute(n)) && tous.findIndex((x) => cleDeNouveaute(x) === cleDeNouveaute(n)) === i);
      const dejaLa = lu.nouveautes.length - nouvelles.length;
      if (nouvelles.length === 0) return dire("info", `Rien à importer : ${dejaLa === 1 ? "cette nouveauté est déjà" : `ces ${dejaLa} nouveautés sont déjà`} dans la liste (même date, même titre).`);
      const v = await ctx.confirmer({
        titre: "Importer des nouveautés",
        texte: `${nouvelles.length} nouveauté${nouvelles.length > 1 ? "s" : ""} arrivent en brouillon : ${nouvelles.map((n) => `« ${n.titre.fr || "(sans titre)"} »`).join(", ")}.${dejaLa ? ` ${dejaLa} déjà présente${dejaLa > 1 ? "s" : ""} (ignorée${dejaLa > 1 ? "s" : ""}).` : ""} Rien n'est publié : tu les relis puis tu publies.`,
        action: "Importer",
      });
      if (!v) return;
      try {
        for (const n of nouvelles) await ctx.client.enregistrerNouveaute({ titre: n.titre, date: n.date, lignes: n.lignes, publier: false });
        importTexte.value = "";
        await ctx.recharger(`${nouvelles.length} nouveauté${nouvelles.length > 1 ? "s" : ""} importée${nouvelles.length > 1 ? "s" : ""} en brouillon${dejaLa ? ` (${dejaLa} déjà présente${dejaLa > 1 ? "s" : ""})` : ""}${lu.ignorees ? `, ${lu.ignorees} entrée${lu.ignorees > 1 ? "s" : ""} illisible${lu.ignorees > 1 ? "s" : ""} ignorée${lu.ignorees > 1 ? "s" : ""}` : ""}. Relis-les ci-dessous, puis publie.`);
      } catch (e) {
        await surErreur(ctx, e, (t) => dire("erreur", t));
      }
    },
  });
  importer.id = "import-valider";
  const echange = el(
    "section",
    { classe: "admin-carte", attrs: { "aria-labelledby": "titre-echange", id: "nouveautes-echange" } },
    titreCarte("Échanger un changelog", "titre-echange"),
    p("Prépare les nouveautés sur la recette (ou chez toi), exporte-les, puis importe-les ici en production : elles arrivent en brouillon, jamais publiées toutes seules. Le fichier est du texte (JSON) : relis-le avant de l'importer.", "admin-aide"),
    el("h3", { classe: "admin-sous-titre", texte: "Exporter" }),
    el("div", { classe: "admin-actions" }, exporterEditeur, exporterTout),
    exportTexte,
    exportActions,
    el("h3", { classe: "admin-sous-titre", texte: "Importer" }),
    champ("import-fichier", "Un fichier d'export", fichier),
    champ("import-texte", "… ou colle son contenu", importTexte),
    el("div", { classe: "admin-actions" }, importer),
  );
  exportTexte.hidden = true;

  dessinerEditeur();
  void chargerPrs();
  return [
    el("h1", { classe: "admin-titre-section", texte: "Nouveautés" }),
    p("Ce que les joueurs lisent sur l'accueil et sur la page Nouveautés. Les PR de gauche viennent de GitHub : coche-les pour reprendre leurs lignes « Pour les joueurs », retouche, relis l'aperçu, publie.", "admin-aide"),
    zoneMessage,
    el("section", { classe: "admin-carte", attrs: { "aria-labelledby": "titre-redaction", id: "nouveautes-redaction" } }, titreCarte("Rédiger", "titre-redaction"), el("div", { classe: "admin-deux-colonnes" }, colonnePrs, colonneEditeur)),
    gestion,
    echange,
  ];
}

// =================================================================================================================================================
// Message en direct
// =================================================================================================================================================
const NOMS_OU: Record<OuMessage, string> = { portail: "Portail", track: "Track", jump: "Jump", tower: "Tower" };
const NOMS_TON: Record<TonMessage, string> = { information: "Information", important: "Important" };

/** Une ligne qui dit où et jusqu'à quand (« Portail, Track · Important · jusqu'au 28/10, 22:00 »). */
const resume = (m: Pick<AnnonceAdmin, "ou" | "ton" | "fin">) => `${m.ou.map((o) => NOMS_OU[o]).join(", ")} · ${NOMS_TON[m.ton]} · jusqu'au ${heure(new Date(m.fin).toISOString())}`;

/** L'état du formulaire, gardé en mémoire de la page. */
const saisie: { fr: string; en: string; ou: OuMessage[]; ton: TonMessage; mode: FinDuMessage["mode"]; precise: string } = { fr: "", en: "", ou: [...OU_MESSAGE], ton: "information", mode: "1h", precise: "" };

export async function vueMessage(ctx: Contexte): Promise<Node[]> {
  const etat: MessagesAdmin = await ctx.client.message();
  const zoneMessage = el("div", { attrs: { id: "message-retour" } });
  const dire = (kind: "erreur" | "info", texte: string) => zoneMessage.replaceChildren(message(kind, texte));

  const actif = etat.actif
    ? el(
        "section",
        { classe: "admin-carte", attrs: { "aria-labelledby": "titre-actif", id: "message-actif" } },
        titreCarte("Message actif", "titre-actif"),
        el("p", { classe: "admin-message admin-message--info", attrs: { "data-langue": "fr" }, texte: etat.actif.fr }),
        el("p", { classe: "admin-message admin-message--info", attrs: { "data-langue": "en", lang: "en" }, texte: etat.actif.en }),
        p(resume(etat.actif), "admin-aide"),
        bouton({
          texte: "Retirer maintenant",
          variante: "secondaire",
          onClick: async () => {
            const v = await ctx.confirmer({ titre: "Retirer le message", texte: "Le message disparaît pour tous les joueurs dans la minute qui suit (le cache de l'hébergeur le garde 30 s au plus, chaque page le relit toutes les 60 s).", action: "Retirer maintenant" });
            if (!v) return;
            try {
              await ctx.client.retirerMessage();
              await ctx.recharger("Message retiré.");
            } catch (e) {
              await surErreur(ctx, e, (t) => dire("erreur", t));
            }
          },
        }),
      )
    : el("section", { classe: "admin-carte", attrs: { id: "message-actif" } }, titreCarte("Message actif", "titre-actif"), p("Aucun message actif.", "admin-aide"));

  // --- Le formulaire --------------------------------------------------------------------------------------------------------------------------
  const fr = el("textarea", { attrs: { id: "message-fr", rows: 3, maxlength: MESSAGE_MAX + 40, "aria-describedby": "message-fr-compte" } });
  const en = el("textarea", { attrs: { id: "message-en", rows: 3, maxlength: MESSAGE_MAX + 40, lang: "en", "aria-describedby": "message-en-compte" } });
  fr.value = saisie.fr;
  en.value = saisie.en;
  const compteFr = el("p", { classe: "admin-aide", attrs: { id: "message-fr-compte" } });
  const compteEn = el("p", { classe: "admin-aide", attrs: { id: "message-en-compte" } });
  const problemesZone = el("div", { attrs: { id: "message-problemes", role: "status", "aria-live": "polite" } });

  const ouCases = OU_MESSAGE.map((o) => {
    const c = el("input", { attrs: { type: "checkbox", id: `message-ou-${o}`, checked: saisie.ou.includes(o), "data-ou": o } });
    c.addEventListener("change", () => {
      saisie.ou = OU_MESSAGE.filter((x) => (x === o ? c.checked : saisie.ou.includes(x)));
      verifier();
    });
    return el("label", { classe: "admin-case" }, c, el("span", { texte: NOMS_OU[o] }));
  });
  const tonCases = (["information", "important"] as const).map((t) => {
    const r = el("input", { attrs: { type: "radio", name: "message-ton", id: `message-ton-${t}`, value: t, checked: saisie.ton === t } });
    r.addEventListener("change", () => {
      saisie.ton = t;
      verifier();
    });
    return el("label", { classe: "admin-case" }, r, el("span", { texte: NOMS_TON[t] }));
  });
  const precise = el("input", { attrs: { type: "datetime-local", id: "message-precise", value: saisie.precise, "aria-label": "Heure de fin précise (heure de Paris)" } });
  precise.addEventListener("input", () => {
    saisie.precise = precise.value;
    verifier();
  });
  const finCases = ([["1h", "1 heure"], ["minuit", "Minuit (Paris)"], ["precise", "Heure précise (Paris)"]] as const).map(([mode, texte]) => {
    const r = el("input", { attrs: { type: "radio", name: "message-fin", id: `message-fin-${mode}`, value: mode, checked: saisie.mode === mode } });
    r.addEventListener("change", () => {
      saisie.mode = mode;
      precise.disabled = mode !== "precise";
      verifier();
    });
    return el("label", { classe: "admin-case" }, r, el("span", { texte }));
  });
  precise.disabled = saisie.mode !== "precise";

  const courant = (): MessageContenu => {
    const fin = finDuMessage(saisie.mode === "precise" ? { mode: "precise", valeur: saisie.precise } : ({ mode: saisie.mode } as FinDuMessage), Date.now());
    return nettoyerMessage({ fr: saisie.fr, en: saisie.en, ou: saisie.ou, ton: saisie.ton, fin: fin ?? Number.NaN });
  };
  const envoyer = el("button", { classe: "dj-bouton dj-bouton--marque", attrs: { type: "submit", id: "message-envoyer" }, texte: "Mettre à jour" });

  function verifier(): void {
    const c = courant();
    compteFr.textContent = `${longueur(c.fr)} / ${MESSAGE_MAX}`;
    compteEn.textContent = `${longueur(c.en)} / ${MESSAGE_MAX}`;
    const pb = c.fr === "" && c.en === "" ? [] : problemesDeMessage(c, Date.now()).map(texteProblemeMessage);
    problemesZone.replaceChildren(...(pb.length ? [el("ul", { classe: "admin-problemes" }, ...pb.map((x) => el("li", { texte: x })))] : []));
    const complet = problemesDeMessage(c, Date.now()).length === 0;
    envoyer.toggleAttribute("disabled", !complet);
    envoyer.setAttribute("aria-disabled", String(!complet));
  }
  fr.addEventListener("input", () => {
    saisie.fr = fr.value;
    verifier();
  });
  en.addEventListener("input", () => {
    saisie.en = en.value;
    verifier();
  });

  const formulaire = el(
    "form",
    { classe: "admin-formulaire", attrs: { id: "message-form" } },
    champ("message-fr", "Texte (français)", fr),
    compteFr,
    champ("message-en", "Text (English)", en),
    compteEn,
    p("Texte seul : ni lien ni HTML. 160 caractères au plus par langue.", "admin-aide"),
    el("fieldset", { classe: "admin-groupe" }, el("legend", { texte: "Où" }), ...ouCases),
    el("fieldset", { classe: "admin-groupe" }, el("legend", { texte: "Ton" }), ...tonCases, p("« Important » ne se ferme qu'après 10 secondes.", "admin-aide")),
    el("fieldset", { classe: "admin-groupe" }, el("legend", { texte: "Jusqu'à" }), ...finCases, precise),
    problemesZone,
    el("div", { classe: "admin-actions" }, envoyer),
  );
  formulaire.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const c = courant();
    if (problemesDeMessage(c, Date.now()).length) return;
    const v = await ctx.confirmer({
      titre: etat.actif ? "Mettre à jour le message" : "Diffuser le message",
      texte: `« ${c.fr} » — ${resume({ ou: c.ou, ton: c.ton, fin: c.fin })}.${etat.actif ? " Il remplace le message actif." : ""} Les joueurs le voient dans la minute qui suit (cache de l'hébergeur 30 s, relecture des pages toutes les 60 s).`,
      action: etat.actif ? "Mettre à jour" : "Diffuser",
    });
    if (!v) return;
    try {
      await ctx.client.mettreAJourMessage({ fr: c.fr, en: c.en, ou: c.ou, ton: c.ton, fin: c.fin });
      saisie.fr = "";
      saisie.en = "";
      await ctx.recharger("Message diffusé : les joueurs le voient dans la minute qui suit.");
    } catch (e) {
      await surErreur(ctx, e, (t) => dire("erreur", t));
    }
  });
  verifier();

  const passes = etat.passes.length
    ? el(
        "ul",
        { classe: "admin-gestion", attrs: { id: "messages-passes" } },
        ...etat.passes.map((m) =>
          el(
            "li",
            { classe: "admin-gestion__ligne", attrs: { "data-id": String(m.id) } },
            el("span", { classe: "admin-gestion__date admin-mono", texte: jourLong(new Date(m.debut).toISOString()) }),
            el("span", { classe: "admin-gestion__titre", texte: m.fr }),
            el("span", { classe: "admin-aide", texte: `${resume(m)}${m.retireLe !== null && m.retireLe < m.fin ? " · retiré" : ""}` }),
            bouton({
              texte: "Réutiliser",
              variante: "secondaire",
              ariaLabel: `Réutiliser le message « ${m.fr} »`,
              onClick: () => {
                saisie.fr = m.fr;
                saisie.en = m.en;
                saisie.ou = [...m.ou];
                saisie.ton = m.ton;
                void ctx.recharger();
              },
            }),
          ),
        ),
      )
    : p("Aucun message passé.", "admin-aide");

  return [
    el("h1", { classe: "admin-titre-section", texte: "Message en direct" }),
    p("Une phrase pour tous les joueurs, tout de suite : un bandeau sur le portail, à l'accueil, à l'arrivée et en pause des jeux (jamais pendant une partie). Un seul message actif ; il s'éteint seul à l'heure de fin.", "admin-aide"),
    zoneMessage,
    actif,
    el("section", { classe: "admin-carte", attrs: { "aria-labelledby": "titre-ecrire", id: "message-ecrire" } }, titreCarte(etat.actif ? "Mettre à jour le message" : "Écrire un message", "titre-ecrire"), formulaire),
    el("section", { classe: "admin-carte", attrs: { "aria-labelledby": "titre-passes", id: "message-passes" } }, titreCarte("Messages passés", "titre-passes"), passes),
  ];
}

// =================================================================================================================================================
// Tableau de bord : « PR depuis la dernière mise en production »
// =================================================================================================================================================
/** Remplit la ligne du tableau de bord : le nombre de PR fusionnées depuis la mise en production en cours, lu comme dans « Nouveautés » (GitHub, depuis le navigateur). Jamais bloquant. */
export async function remplirPrDuTableau(valeur: HTMLElement, etiquette: string | null): Promise<void> {
  const instant = etiquette ? instantDeEtiquette(etiquette) : null;
  if (instant === null) {
    valeur.textContent = "— (étiquette de mise en production inconnue)";
    return;
  }
  try {
    const n = await compterPrDepuis((...a) => fetch(...a), instant);
    valeur.textContent = String(n);
    valeur.setAttribute("data-nombre", String(n));
  } catch (e) {
    valeur.textContent = `— (${texteErreurGithub(e).split(".")[0]})`;
  }
}
