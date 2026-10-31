import { CATALOGUE_COMMANDES } from "./catalogue.commandes";
import { BOUTON_FIXE, TOUCHE_FIXE, boutonLiaison, nomLiaison, nomTouche, type Commandes } from "./commandes";
import { definirLiaison, definirTouche, liaisonPoussee, retablir } from "./commandesEdition";
import feuille from "./commandes.css?url";
import { el } from "./dom";

// Lot M2 (plateforme) : l'écran Réglages › Commandes — UNE seule construction pour tous les jeux (maquette manette-et-commandes.html, planches 2 et 3 ; charte § 10).
// **Un module à la demande** : chargé à la première ouverture de l'onglet « Commandes » d'un jeu (`import("@cdj/ui/src/commandesEcran")`). Trois onglets : Clavier (deux touches par
// action, `event.code`, nom lu selon la disposition du clavier), Manette (un bouton par action), Tactile (le morceau que le jeu donne : ses réglages tactiles existants, rien de neuf).
// Une case attend la nouvelle touche (« Appuie sur une touche… »), Échap annule ; une touche déjà prise est échangée, la ligne qui la perd le montre. Se pilote au doigt, à la souris,
// au clavier et à la manette (M1 : `role=tab`, boutons ; pendant l'attente d'un bouton `data-capture="commande"` met le moteur des menus en veille). Textes : `catalogue.commandes.ts`
// (la langue de `<html lang>`), noms d'actions : le catalogue du jeu (`t`).

export interface LigneFixe {
  /** Texte déjà traduit de la ligne (« Pause et retour »). */
  nom: string;
  /** Nom de la touche ou du bouton fixe. */
  touche: string;
}
export interface OptionsEcranCommandes {
  commandes: Commandes;
  /** Traduit une clé du catalogue du jeu (le nom d'une action). */
  t: (cle: string) => string;
  /** La clé du catalogue du jeu qui nomme une action (`commandes.action.<id>`, écrite par le jeu : une clé jamais lue est refusée). */
  cleAction: (id: string) => string;
  /** Lignes de la manette qui ne se changent pas et que le jeu ajoute (« Stick ou croix : courir »). Relues à chaque dessin. */
  fixesManette?: () => readonly LigneFixe[];
  /** L'onglet Tactile : les réglages tactiles existants du jeu, ou `null` hors appareil tactile. */
  tactile?: () => HTMLElement | null;
  /** L'onglet montré à l'ouverture : « tactile » sur un appareil tactile, « clavier » sinon. */
  ongletInitial?: "clavier" | "manette" | "tactile";
  /** Appelé après chaque changement (les aides du jeu se redessinent). */
  surChangement?: () => void;
}
export interface EcranCommandes {
  racine: HTMLElement;
  /** Redessine (langue changée, réglage venu d'ailleurs). */
  maj(): void;
  /** Annule une attente en cours (l'écran se ferme). */
  annuler(): void;
  /** L'écran est jeté (le jeu le reconstruit) : plus d'abonnement ni d'attente. */
  detruire(): void;
}

type Onglet = "clavier" | "manette" | "tactile";
const ONGLETS: readonly Onglet[] = ["clavier", "manette", "tactile"];

const langue = (): "fr" | "en" => (document.documentElement.lang.toLowerCase().startsWith("en") ? "en" : "fr");
const txt = (cle: keyof typeof CATALOGUE_COMMANDES.fr, params: Record<string, string> = {}): string =>
  CATALOGUE_COMMANDES[langue()][cle].replace(/\{(\w+)\}/g, (m, k: string) => params[k] ?? m);

export function ecranCommandes(o: OptionsEcranCommandes): EcranCommandes {
  const { commandes } = o;
  if (!document.head.querySelector("link[data-commandes]")) {
    const lien = document.createElement("link");
    lien.rel = "stylesheet";
    lien.href = feuille;
    lien.dataset.commandes = "";
    document.head.append(lien);
  }

  let onglet: Onglet = o.ongletInitial ?? "clavier";
  let attente: { type: "clavier"; id: string; emplacement: number } | { type: "manette"; id: string } | null = null;
  let perdue: string | null = null; // l'action qui vient de perdre sa touche
  let message = "";
  let focus: string | null = null;
  let arretCapture: (() => void) | null = null;

  const racine = el("div", { classe: "dj-commandes" });
  const nomDe = (id: string) => o.t(o.cleAction(id));
  const nom = (code: string) => nomTouche(code, langue(), commandes.disposition);

  function annuler(): void {
    arretCapture?.();
    arretCapture = null;
    attente = null;
    delete document.documentElement.dataset.capture;
  }

  function finir(texte: string, cible: string | null): void {
    annuler();
    message = texte;
    focus = cible;
    dessiner();
    o.surChangement?.();
  }

  function attendreTouche(id: string, emplacement: number): void {
    annuler();
    attente = { type: "clavier", id, emplacement };
    message = "";
    focus = `k:${id}:${emplacement}`;
    document.documentElement.dataset.capture = "commande"; // les écrans qui ferment sur Échap ne le font pas pendant l'attente
    const bas = (e: KeyboardEvent): void => {
      e.preventDefault();
      e.stopImmediatePropagation(); // Échap annule ici et ne ferme ni l'écran ni la pause ; aucune touche ne commande le jeu pendant l'attente
      if (e.repeat) return;
      if (e.code === TOUCHE_FIXE) return finir("", `k:${id}:${emplacement}`);
      const r = definirTouche(commandes, id, emplacement, e.code);
      if (!r.ok) {
        message = r.raison === "fixe" ? txt("commandes.refus.fixe", { touche: nom(e.code) }) : txt("commandes.refus.invalide");
        return void dessiner();
      }
      perdue = r.echange?.action ?? null;
      finir(r.echange ? txt("commandes.echange", { touche: nom(e.code), action: nomDe(r.echange.action) }) : txt("commandes.change", { action: nomDe(id), touche: nom(e.code) }), `k:${id}:${emplacement}`);
    };
    const perte = (): void => finir("", focus);
    window.addEventListener("keydown", bas, true);
    window.addEventListener("blur", perte);
    arretCapture = () => {
      window.removeEventListener("keydown", bas, true);
      window.removeEventListener("blur", perte);
    };
    dessiner();
  }

  function attendreBouton(id: string): void {
    annuler();
    attente = { type: "manette", id };
    message = "";
    focus = `m:${id}`;
    document.documentElement.dataset.capture = "commande"; // le moteur des menus ne lit rien (ni B, ni A)
    const bas = (e: KeyboardEvent): void => {
      if (e.code !== TOUCHE_FIXE) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      finir("", `m:${id}`);
    };
    window.addEventListener("keydown", bas, true);
    let raf = 0;
    let deja: Set<string> | null = null; // ce qui était tenu au départ (le A qui a ouvert l'attente) ne compte qu'une fois relâché
    const lire = (): void => {
      raf = requestAnimationFrame(lire);
      const pad = navigator.getGamepads?.().find((p): p is Gamepad => !!p && p.connected);
      if (!pad) return;
      const tenus = new Set<string>();
      for (let i = 0; i < Math.min(pad.buttons.length, 16); i++) if (pad.buttons[i]?.pressed) tenus.add(boutonLiaison(i));
      if (!deja) deja = tenus;
      for (const l of [...deja]) if (!tenus.has(l)) deja.delete(l);
      const l = liaisonPoussee(pad, deja);
      if (!l) return;
      const r = definirLiaison(commandes, id, l);
      if (!r.ok) {
        message = r.raison === "fixe" ? txt("commandes.refus.fixe", { touche: nomLiaison(l, langue()) }) : txt("commandes.refus.invalide");
        deja.add(l);
        return void dessiner();
      }
      perdue = r.echange;
      finir(r.echange ? txt("commandes.echange.manette", { touche: nomLiaison(l, langue()), action: nomDe(r.echange) }) : txt("commandes.change", { action: nomDe(id), touche: nomLiaison(l, langue()) }), `m:${id}`);
    };
    raf = requestAnimationFrame(lire);
    arretCapture = () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", bas, true);
    };
    dessiner();
  }

  const ligneFixe = (f: LigneFixe): HTMLElement =>
    el(
      "li",
      { classe: ["dj-commande", "dj-commande--fixe"] },
      el("span", { classe: "dj-commande__nom" }, el("span", { texte: f.nom }), el("span", { classe: "dj-commande__note", texte: txt("commandes.fixe.label") })),
      el("span", { classe: "dj-commande__touches" }, el("span", { classe: ["dj-commande__touche", "dj-commande__touche--fixe"], texte: f.touche })),
    );

  function panneauClavier(): HTMLElement {
    const liste = el("ul", { classe: "dj-commandes__liste" });
    for (const a of commandes.actions) {
      const emplacements = commandes.emplacementsDe(a.id);
      const boutons = emplacements.map((code, i) => {
        const enAttente = attente?.type === "clavier" && attente.id === a.id && attente.emplacement === i;
        const texte = enAttente ? txt("commandes.attente") : code ? nom(code) : txt("commandes.touche.vide");
        const b = el("button", {
          classe: ["dj-commande__touche", enAttente && "dj-commande__touche--attente"],
          texte,
          attrs: { type: "button", "data-focus": `k:${a.id}:${i}`, "aria-label": txt("commandes.touche.changer", { action: nomDe(a.id), numero: String(i + 1), touche: code ? nom(code) : txt("commandes.touche.vide") }) },
        });
        b.addEventListener("click", () => (enAttente ? finir("", `k:${a.id}:${i}`) : attendreTouche(a.id, i)));
        return b;
      });
      liste.append(
        el(
          "li",
          { classe: ["dj-commande", perdue === a.id && "dj-commande--perdue"], attrs: { "data-action": a.id } },
          el("span", { classe: "dj-commande__nom" }, el("span", { texte: nomDe(a.id) }), perdue === a.id && el("span", { classe: "dj-commande__note", texte: txt("commandes.perdue") })),
          el("span", { classe: "dj-commande__touches" }, ...boutons),
        ),
      );
    }
    liste.append(ligneFixe({ nom: txt("commandes.fixe.echap"), touche: txt("commandes.touche.echap") }));
    return liste;
  }

  function panneauManette(): HTMLElement {
    const liste = el("ul", { classe: "dj-commandes__liste" });
    for (const a of commandes.actions) {
      if (a.manette === null) continue; // pas de bouton d'origine (courir : stick et croix ; pause : Start) : rien à régler, la ligne fixe est donnée par le jeu
      const enAttente = attente?.type === "manette" && attente.id === a.id;
      const l = commandes.liaison(a.id);
      const b = el("button", {
        classe: ["dj-commande__touche", enAttente && "dj-commande__touche--attente"],
        texte: enAttente ? txt("commandes.attente.manette") : nomLiaison(l, langue()),
        attrs: { type: "button", "data-focus": `m:${a.id}`, "aria-label": txt("commandes.liaison.changer", { action: nomDe(a.id), touche: nomLiaison(l, langue()) }) },
      });
      b.addEventListener("click", () => (enAttente ? finir("", `m:${a.id}`) : attendreBouton(a.id)));
      liste.append(
        el(
          "li",
          { classe: ["dj-commande", perdue === a.id && "dj-commande--perdue"], attrs: { "data-action": a.id } },
          el("span", { classe: "dj-commande__nom" }, el("span", { texte: nomDe(a.id) }), perdue === a.id && el("span", { classe: "dj-commande__note", texte: txt("commandes.perdue") })),
          el("span", { classe: "dj-commande__touches" }, b),
        ),
      );
    }
    for (const f of o.fixesManette?.() ?? []) liste.append(ligneFixe(f));
    liste.append(ligneFixe({ nom: txt("commandes.fixe.start"), touche: nomLiaison(boutonLiaison(BOUTON_FIXE), langue()) }), ligneFixe({ nom: txt("commandes.fixe.b"), touche: nomLiaison(boutonLiaison(1), langue()) }));
    return liste;
  }

  function dessiner(): void {
    const onglets = el("div", { classe: "dj-commandes__onglets", attrs: { role: "tablist", "aria-label": txt("commandes.onglets") } });
    for (const id of ONGLETS) {
      const b = el("button", {
        classe: "dj-commandes__onglet",
        texte: txt(`commandes.onglet.${id}`),
        attrs: { type: "button", role: "tab", "aria-selected": id === onglet, "data-onglet": id },
      });
      b.addEventListener("click", () => {
        if (onglet === id) return;
        annuler();
        onglet = id;
        message = "";
        perdue = null;
        focus = `o:${id}`;
        dessiner();
      });
      onglets.append(b);
    }
    let corps: HTMLElement;
    if (onglet === "clavier") corps = panneauClavier();
    else if (onglet === "manette") corps = panneauManette();
    else corps = o.tactile?.() ?? el("p", { classe: "dj-commandes__etat", texte: txt("commandes.tactile.absent") });
    const boutonRetablir = el("button", { classe: ["dj-bouton", "dj-bouton--secondaire"], texte: txt("commandes.retablir"), attrs: { type: "button", id: "commandes-retablir", "data-focus": "retablir" } });
    boutonRetablir.addEventListener("click", () => {
      retablir(commandes);
      perdue = null;
      finir(txt("commandes.retabli"), "retablir");
    });
    const etat = el("p", { classe: "dj-commandes__etat", attrs: { role: "status", "aria-live": "polite" }, texte: attente ? (attente.type === "clavier" ? `${txt("commandes.attente")} ${txt("commandes.attente.aide")}` : `${txt("commandes.attente.manette")} ${txt("commandes.attente.aide")}`) : message });
    const pied = onglet === "tactile" ? null : el("div", { classe: "dj-commandes__pied" }, boutonRetablir);
    racine.replaceChildren(...[onglets, corps, etat, pied].filter((n): n is HTMLElement => n !== null));
    if (focus) {
      const cible = focus.startsWith("o:") ? racine.querySelector<HTMLElement>(`[data-onglet="${focus.slice(2)}"]`) : racine.querySelector<HTMLElement>(`[data-focus="${focus}"]`);
      cible?.focus({ preventScroll: true });
    }
  }

  dessiner();
  const desabonner = commandes.surChangement(() => {
    if (!attente) dessiner(); // la disposition du clavier est arrivée, ou un choix vient d'ailleurs
  });
  return {
    racine,
    maj: dessiner,
    annuler,
    detruire() {
      annuler();
      desabonner();
    },
  };
}
