import "./ecrans.css"; // lot « écrans du kit » : la feuille des écrans à la demande (« Comment jouer », Réglages, classement, pause, fin, scène), dans le morceau de la partie : hors du premier chargement. **Elle n'est importée qu'ici** — importée par deux morceaux, elle ferait un morceau à part, compté dans le premier chargement (`budget.aLaDemande`)
import { readPlayerId, type OuAnnonce } from "@cdj/profile";
import { barreJeu, bouton, boutonFantome, boutonPleinEcran, cheminMentions, creerCadre, el, medaille as medailleUi, type Jeu, type TraducteurCommun, type TypeMedaille } from "@cdj/ui";
import { padPourLeJeu } from "@cdj/ui/src/manetteLien";
import { liaisonTenue } from "@cdj/ui/src/commandes";
import { suivantDisponible } from "../fantome";
import { ligneParDefaut, textePartage, adresseDePartage } from "../partage";
import { commandesDuJeu } from "./commandes";
import { creerFondFin } from "./fondFin";
import { creerVibreur, creerVolumeEffets, lireReglages } from "./reglagesJoueur";
import type { CodeMedaille, ContextePartie, PartieDuJeu } from "./types";

// La partie d'un jeu neuf (à la demande, préchargée par l'accueil) : la boucle à pas fixe, le HUD compact, la pause, l'arrivée, l'envoi (la file hors ligne du kit), les records, le classement, la ligne à partager,
// « Jeu suivant du jour », le fantôme. Le jeu ne fournit que sa simulation et son rendu (`DefinitionJeu`) : il n'ouvre ni réseau ni stockage, il ne lit aucune touche en dur (règle M2) et ne sait rien des écrans.
// **Rien d'ici n'est dans le premier chargement.** Aucune simulation n'est liée à l'horloge : le kit appelle `avancer()` `ticksParSeconde` fois par seconde, la pause arrête tout.

const TYPE: Record<CodeMedaille, TypeMedaille> = { author: "diamant", gold: "or", silver: "argent", bronze: "bronze" };
// Les émojis de la ligne à partager ne vivent que dans ce fichier, écrits par leur code (charte § 6).
const EMOJI: Record<CodeMedaille, string> = { author: "\u{1F48E}", gold: "\u{1F947}", silver: "\u{1F948}", bronze: "\u{1F949}" };
type EtatFantome = "aucun" | "meilleure" | "diamant";
const ORDRE_FANTOME: readonly EtatFantome[] = ["aucun", "meilleure", "diamant"];

/** La porte des tests de navigateur (`?debug`, hors production seulement) : `window.__jeu`. */
export interface PorteDeTest {
  manuel(oui?: boolean): void;
  avancer(n: number): void;
  action(id: string): void;
  phase(): "jeu" | "pause" | "fin";
  envoi(): { statut: string; code: string; rang: number | null };
  score(): number[] | null;
  rediffusion(): string | null;
}

export async function demarrerPartie<C>(c: ContextePartie<C>): Promise<void> {
  const { t } = c.i18n;
  const { def, fiche, donnees: d } = c;
  const commandes = commandesDuJeu(fiche, def, c.i18n);
  const reglages = lireReglages(c, d.stockage);
  const reduit = reglages.mouvement === "reduit" || (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const classable = !c.archive && !c.essai;
  const sansFantome = def.sansFantome === true; // lot « manques de Blocks » : ni bouton, ni commande, ni rediffusion du Diamant
  const volumeEffets = creerVolumeEffets(() => lireReglages(c, d.stockage));
  const vibrer = creerVibreur(() => lireReglages(c, d.stockage), typeof navigator === "undefined" ? null : navigator, d.tactile);
  c.musique.scene(`theme:${c.theme}`);
  c.musique.baisser(0.6);
  const fondFin = creerFondFin(c.musique, (ms, fn) => void setTimeout(fn, ms)); // lot B6 : la musique retombe à la fin de la partie et remonte à l'écran de fin

  // --- La scène et le HUD compact ---
  const plateau = el("div", { classe: "jeu-plateau" });
  const principal = el("span", { classe: "jeu-hud__principal", attrs: { id: "jeu-hud-score" } });
  const secondaire = el("span", { classe: "jeu-hud__secondaire", attrs: { id: "jeu-hud-temps" } });
  const nomFantome = (e: EtatFantome): string => t(`kit.fantome.${e}`);
  const fantomeBtn = sansFantome ? null : boutonFantome({ id: "jeu-hud-fantome", classe: "jeu-hud__bouton", onClick: () => changerFantome() });
  const pauseBtn = el("button", { classe: "jeu-hud__bouton jeu-hud__pause", attrs: { type: "button", id: "jeu-hud-pause", "aria-label": t("kit.hud.pause") }, texte: "II" });
  pauseBtn.addEventListener("click", () => ouvrirPause());
  pauseBtn.addEventListener("pointerup", () => pauseBtn.blur());
  const scene = el("div", { classe: "jeu-scene", attrs: { id: "jeu-scene" } }, el("div", { classe: "jeu-hud" }, el("div", { classe: "jeu-hud__gauche" }, principal), el("div", { classe: "jeu-hud__centre" }, secondaire), el("div", { classe: "jeu-hud__droite" }, ...(fantomeBtn ? [fantomeBtn] : []), pauseBtn)), plateau);
  c.o.racine.append(scene);

  // --- Le fantôme : Aucun → Ma meilleure → Diamant ---
  const records = () => d.records.lire(d.stockage);
  const meilleure = (): string | null => records()[c.date]?.rediffusion ?? null;
  let fantome: EtatFantome = !sansFantome && reglages.fantome === "meilleure" && meilleure() ? "meilleure" : "aucun";
  const rediffusionDe = (e: EtatFantome): string | null => (sansFantome ? null : e === "meilleure" ? meilleure() : e === "diamant" ? c.def.rediffusionDiamant(c.contenu) : null);
  const disponible = (e: EtatFantome): boolean => e === "aucun" || (e === "meilleure" && meilleure() !== null) || (e === "diamant" && meilleure() !== null && classable); // le Diamant se débloque en jouant le jour
  function majFantomeBtn(): void {
    if (!fantomeBtn) return;
    fantomeBtn.setAttribute("aria-label", t("kit.hud.fantome", { nom: nomFantome(fantome) }));
    fantomeBtn.dataset.etat = fantome;
  }
  function changerFantome(): void {
    if (sansFantome) return;
    fantome = suivantDisponible(ORDRE_FANTOME, fantome, disponible, "aucun");
    majFantomeBtn();
    partie.fantome(rediffusionDe(fantome));
  }

  // --- La partie ---
  let partie: PartieDuJeu = nouvelle();
  function nouvelle(): PartieDuJeu {
    plateau.replaceChildren();
    return def.nouvellePartie(c.contenu, plateau, { theme: c.theme, reduit, tactile: d.tactile, libelle: t("scene.aria"), fantome: rediffusionDe(fantome), langue: c.i18n.langue, t: (cle, params) => c.i18n.t(cle, params), vibrer, volumeEffets });
  }
  majFantomeBtn();
  let phase: "jeu" | "pause" | "fin" = "jeu";
  let manuel = c.options.manuel;
  let acc = 0;
  let dernier = performance.now();
  let resultat: { score: number[]; rediffusion: string } | null = null;
  const pas = 1000 / def.ticksParSeconde;
  const majHud = (): void => {
    const h = partie.hud();
    principal.textContent = h.principal;
    secondaire.textContent = h.secondaire;
  };
  function image(now: number): void {
    requestAnimationFrame(image);
    lirePad();
    if (phase === "jeu" && !manuel) {
      acc += Math.min(now - dernier, 250);
      while (acc >= pas && !partie.finie()) {
        partie.avancer();
        acc -= pas;
      }
    }
    dernier = now;
    partie.dessiner();
    majHud();
    if (phase === "jeu" && partie.finEnCours?.()) fondFin.retomber(); // la partie est jouée, sa fin se montre encore : la musique retombe
    if (phase === "jeu" && partie.finie()) terminer();
  }
  requestAnimationFrame(image);

  // --- Les entrées : clavier et manette, par les actions (règle M2) ---
  const ids = new Set(def.actions.map((a) => a.id));
  function declencher(id: string): void {
    if (phase === "fin") return void (id === "recommencer" && recommencer());
    if (id === "pause") return phase === "pause" ? fermerPause() : ouvrirPause();
    if (phase === "pause") return;
    if (id === "recommencer") return recommencer();
    if (id === "fantome") return changerFantome();
    if (ids.has(id)) partie.action(id);
  }
  const surTouche = (e: KeyboardEvent): void => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === "Escape" && !document.documentElement.dataset.capture) return declencher("pause");
    if ((e.target as HTMLElement | null)?.closest?.("input, textarea, [role=dialog] button, [role=dialog] a")) return; // un menu a son propre clavier
    const id = commandes.actionDeTouche(e.code);
    if (id) {
      e.preventDefault();
      declencher(id);
    }
  };
  addEventListener("keydown", surTouche);
  let tenues = new Set<string>();
  let startTenu = false;
  function lirePad(): void {
    const brut = navigator.getGamepads?.()[0] ?? undefined;
    if (brut?.buttons[9]?.pressed && !startTenu) declencher("pause");
    startTenu = !!brut?.buttons[9]?.pressed;
    const pad = padPourLeJeu(brut ?? undefined);
    const maintenant = new Set<string>();
    if (pad) {
      for (const a of [...def.actions, ...(sansFantome ? [{ id: "recommencer" }] : [{ id: "recommencer" }, { id: "fantome" }])]) {
        const l = commandes.liaison(a.id);
        if (l && liaisonTenue(l, pad)) maintenant.add(a.id);
      }
      // La croix et le stick déplacent (fixes), comme les flèches : les actions `gauche`, `droite`, `haut` et `bas` du jeu, si elles existent.
      const dirs: [string, boolean][] = [["gauche", (pad.axes[0] ?? 0) < -0.5 || !!pad.buttons[14]?.pressed], ["droite", (pad.axes[0] ?? 0) > 0.5 || !!pad.buttons[15]?.pressed], ["haut", (pad.axes[1] ?? 0) < -0.5 || !!pad.buttons[12]?.pressed], ["bas", (pad.axes[1] ?? 0) > 0.5 || !!pad.buttons[13]?.pressed]];
      for (const [id, tenue] of dirs) if (tenue && ids.has(id)) maintenant.add(id);
    }
    for (const id of maintenant) if (!tenues.has(id)) declencher(id);
    tenues = maintenant;
  }
  const surVisibilite = (): void => {
    if (document.hidden && phase === "jeu") ouvrirPause();
  };
  document.addEventListener("visibilitychange", surVisibilite);

  // --- La pause ---
  const bouton1 = (id: string, cle: string, fn: () => void, variante: "marque" | "secondaire" = "secondaire"): HTMLButtonElement => {
    const b = bouton({ texte: t(cle), variante }) as HTMLButtonElement;
    b.id = id;
    if (variante === "marque") b.classList.add("jeu-jouer", "jeu-jouer--petit"); // lot « écrans du kit » : le bouton principal de l'écran, à la façon de JOUER
    b.addEventListener("click", fn);
    return b;
  };
  const pauseCadre = creerCadre({
    id: "jeu-pause",
    haut: true,
    etiquette: "jeu-ecran",
    barre: () => barreJeu(c.i18n.socle() as unknown as TraducteurCommun, { href: "../", jour: c.jour, retour: { texte: t(`jeu.${fiche.id}.nom`).toUpperCase(), ariaLabel: t("kit.pause.reprendre"), onClick: () => fermerPause() } }),
    aria: () => t("kit.pause.aria"),
  });
  let aideMontee: { ouvrir(): void } | null = null;
  const etatPause = el("p", { classe: "jeu-message" });
  const placeMusique = el("div", { classe: "jeu-reglages__musique" });
  const hoteMessagePause = el("div", { classe: "message-direct message-direct--pause" });
  pauseCadre.corps.append(
    hoteMessagePause,
    el("h2", { classe: "jeu-ecran__titre", texte: t("kit.pause.titre") }),
    etatPause,
    bouton1("jeu-reprendre", "kit.pause.reprendre", () => fermerPause(), "marque"),
    el(
      "div",
      { classe: "jeu-secondaires" },
      bouton1("jeu-pause-recommencer", "kit.pause.recommencer", () => recommencer()),
      bouton1("jeu-pause-aide", "kit.pause.aide", () => void import("./aide").then((m) => (aideMontee ??= m.monterAide(c)).ouvrir())),
      bouton1("jeu-pause-reglages", "kit.pause.reglages", () => void import("./reglages").then((m) => m.monterReglages(c).ouvrir())),
      boutonPleinEcran({ t: (cle) => c.i18n.socle().t(cle as never), id: "jeu-pause-plein-ecran", classe: ["dj-bouton", "dj-bouton--secondaire"], texte: true }),
      bouton1("jeu-pause-accueil", "kit.pause.accueil", () => c.retour()),
    ),
    placeMusique,
    el("p", { classe: "jeu-reglages__liens" }, el("a", { classe: "jeu-lien", attrs: { id: "jeu-pause-mentions", href: cheminMentions(c.i18n.langue, "../") }, texte: t("kit.pause.mentions") }), bouton1("jeu-pause-retours", "kit.pause.retours", () => void import("./retours").then((m) => m.ouvrirRetours(fiche.id, d.base, d.stockage)))),
  );
  pauseCadre.racine.hidden = true;
  void import("@cdj/ui/src/panneauMusique").then((m) => m.monterPanneau(() => c.musique.lecteur() as never, placeMusique), () => undefined);
  void (d.base ? import("../message").then((m) => m.monterMessageEnDirect({ base: d.base!, stockage: d.stockage, ou: fiche.id as OuAnnonce, hotes: { accueil: el("div"), arrivee: el("div"), pause: hoteMessagePause }, langue: () => c.i18n.langue, traducteur: () => c.i18n.socle() }).montrer("pause")) : undefined);
  function ouvrirPause(): void {
    if (phase !== "jeu") return;
    phase = "pause";
    etatPause.textContent = t("kit.pause.etat", { score: partie.hud().principal });
    pauseCadre.majBarre();
    pauseCadre.racine.hidden = false;
    c.musique.baisser(1);
    (document.getElementById("jeu-reprendre") as HTMLElement | null)?.focus();
  }
  function fermerPause(): void {
    if (phase !== "pause") return;
    phase = "jeu";
    pauseCadre.racine.hidden = true;
    dernier = performance.now();
    acc = 0;
    c.musique.baisser(0.6);
  }

  // --- La fin : l'arrivée, l'envoi, le classement, le partage ---
  const finCadre = creerCadre({
    id: "jeu-fin",
    haut: true,
    etiquette: "jeu-ecran",
    barre: () => barreJeu(c.i18n.socle() as unknown as TraducteurCommun, { href: "../", jour: c.jour, retour: { texte: t(`jeu.${fiche.id}.nom`).toUpperCase(), ariaLabel: t("kit.fin.accueil"), onClick: () => c.retour() } }),
    aria: () => t("kit.fin.aria"),
  });
  finCadre.racine.hidden = true;
  let desabonner: (() => void) | null = null;
  function terminer(): void {
    phase = "fin";
    resultat = partie.resultat();
    fondFin.remonter();
    const med = def.sansMedaille ? null : def.medaille(resultat.score, def.seuils(c.contenu)); // lot B1 : un jeu sans médaille n'appelle ni l'un ni l'autre
    let nouveau = false;
    if (classable) {
      const r = d.records.proposer(d.stockage, c.date, { score: resultat.score, medaille: med, rediffusion: resultat.rediffusion });
      nouveau = r.nouveau;
      if (nouveau) d.envoi.offrir();
    }
    dessinerFin(med, nouveau);
    desabonner = d.envoi.surChangement(() => dessinerFin(med, nouveau));
    finCadre.majBarre();
    finCadre.racine.hidden = false;
    (document.getElementById("jeu-rejouer") as HTMLElement | null)?.focus();
    // Le classement après l'envoi : déjà dans la réponse du serveur ; à l'accueil de la partie suivante, `suite` se relit.
  }
  function messageEnvoi(): string {
    const e = d.envoi.state;
    switch (e.statut) {
      case "off":
        return t("kit.fin.horsLigne");
      case "sending":
        return t("kit.envoi.enCours");
      case "offline":
        return t(e.code === "en_cours" ? "kit.envoi.attente" : "kit.fin.horsLigne");
      case "version":
        return t("kit.envoi.version");
      case "refused":
        return t("kit.envoi.refuse");
      case "revoked":
        return t("kit.envoi.revoque");
      default:
        return "";
    }
  }
  function dessinerFin(med: CodeMedaille | null, nouveau: boolean): void {
    if (!resultat) return;
    const lu = d.envoi.resultats.get(c.date);
    const e = d.envoi.state;
    const score = def.formatScore(resultat.score, c.i18n.langue, t);
    const s = def.sansMedaille ? null : def.seuils(c.contenu);
    const reste = s ? el("div", { classe: "jeu-medailles" }, el("h3", { texte: t("kit.fin.medailles") })) : null;
    if (s && reste) {
      for (const m of ["author", "gold", "silver", "bronze"] as const) reste.append(medailleUi(c.i18n.socle() as unknown as TraducteurCommun, { type: TYPE[m], obtenue: med !== null && ["author", "gold", "silver", "bronze"].indexOf(m) >= ["author", "gold", "silver", "bronze"].indexOf(med), forme: "case", jeu: fiche.id as Jeu, valeur: String(s[m]) }));
    }
    const sens = fiche.colonnes[0]!.sens;
    const premier = resultat.score[0] ?? 0;
    const suivante = s ? (["bronze", "silver", "gold", "author"] as const).find((m) => (sens === "desc" ? s[m] > premier : s[m] < premier)) : undefined;
    const encore = s && suivante ? el("p", { classe: "jeu-message", attrs: { id: "jeu-fin-encore" }, texte: t("kit.fin.medaille.encore", { medaille: c.i18n.t(`medaille.${TYPE[suivante]}`), reste: Math.abs(s[suivante] - premier) }) }) : null;
    const rang = el("p", { classe: "jeu-fin__rang", attrs: { id: "jeu-fin-rang", role: "status" }, texte: lu ? t("kit.fin.rang", { rang: lu.rank, n: lu.participants }) + (lu.improved ? ` · ${t("kit.fin.record.nouveau")}` : lu.deja ? "" : ` · ${t("kit.fin.record.pasMieux")}`) : classable ? (messageEnvoi() || t("kit.fin.rang.attente")) : t(c.archive ? "kit.fin.archive" : "kit.fin.essai") });
    const pseudo = e.statut === "name" ? formulairePseudo(e.code, e.suggestions) : null;
    const partager = bouton1("jeu-partager", "kit.fin.partager", () => void partagerLigne(med, lu?.rank, lu?.participants));
    const etatPartage = el("p", { classe: "jeu-message", attrs: { id: "jeu-partage-etat", role: "status" } });
    partagerEtat = etatPartage;
    const hoteSuite = el("div", { classe: "suite-du-jour", attrs: { hidden: true, id: "jeu-fin-suite" } });
    finCadre.corps.replaceChildren(
      el("h2", { classe: "jeu-ecran__titre", texte: t("kit.fin.titre") }),
      // Lot « écrans du kit » : le score, la médaille et le rang dans une tuile (papier bordé d'encre), puis le reste.
      el("section", { classe: "jeu-tuile jeu-resume" }, el("p", { classe: "jeu-fin__score", attrs: { id: "jeu-fin-score" }, texte: score }), ...(med ? [medailleUi(c.i18n.socle() as unknown as TraducteurCommun, { type: TYPE[med], obtenue: true, jeu: fiche.id as Jeu })] : []), rang),
      ...(pseudo ? [pseudo] : []),
      ...(nouveau && !lu ? [el("p", { classe: "jeu-message", texte: t("kit.fin.record.nouveau") })] : []),
      ...(encore ? [encore] : []),
      ...(reste ? [reste] : []),
      bouton1("jeu-rejouer", "kit.fin.rejouer", () => recommencer(), "marque"),
      el("div", { classe: "jeu-secondaires" }, partager, bouton1("jeu-fin-classement", "kit.fin.classement", () => void ouvrirClassement()), bouton1("jeu-fin-accueil", "kit.fin.accueil", () => c.retour())),
      etatPartage,
    );
    finCadre.pied.replaceChildren(hoteSuite);
    if (lu && readPlayerId(d.stockage ?? { getItem: () => null })) void chargerSuite(hoteSuite);
  }
  let partagerEtat: HTMLElement | null = null;
  let suiteChargee = false;
  async function chargerSuite(hote: HTMLElement): Promise<void> {
    const m = await import("../suite");
    const id = readPlayerId(d.stockage ?? { getItem: () => null });
    if (!id) return;
    const s = suiteChargee ? null : await m.chargerSuite(d.base, id, fiche.id);
    suiteChargee = true;
    if (s) {
      hote.hidden = false;
      hote.replaceChildren(...m.elementsDeSuite(s, c.i18n.t, ["suite-jeu-suivant", "suite-parfaite", "suite-portail"], ["legende", "suite-du-jour__parfaite"], "kit.suite.legende"));
    }
  }
  function formulairePseudo(code: string, suggestions: readonly string[]): HTMLElement {
    const champ = el("input", { classe: "jeu-pseudo__champ", attrs: { type: "text", id: "jeu-pseudo", maxlength: "20", autocomplete: "off", "aria-label": t("kit.fin.pseudo.label") } }) as HTMLInputElement;
    const ok = bouton1("jeu-pseudo-ok", "kit.fin.pseudo.valider", () => void d.envoi.choisirPseudo(champ.value), "marque");
    const erreur = code ? el("p", { classe: "jeu-message", attrs: { role: "alert" }, texte: t(`erreur.${code}` as never) }) : null;
    const libres = suggestions.length > 0 ? el("p", { classe: "jeu-message" }, `${t("kit.fin.pseudo.suggestions")} `, ...suggestions.map((n) => { const b = el("button", { classe: "jeu-lien", attrs: { type: "button" }, texte: n }); b.addEventListener("click", () => (champ.value = n)); return b; })) : null;
    return el("form", { classe: "jeu-pseudo", attrs: { id: "jeu-pseudo-form" } }, el("label", { texte: t("kit.fin.pseudo.label") }, champ), erreur, libres, ok);
  }
  async function ouvrirClassement(): Promise<void> {
    const m = await import("./classement");
    const lu = d.envoi.resultats.get(c.date);
    m.monterClassement(c, () => readPlayerId(d.stockage ?? { getItem: () => null })).ouvrir(lu?.board ?? null);
  }
  async function partagerLigne(med: CodeMedaille | null, rang?: number, participants?: number): Promise<void> {
    if (!resultat) return;
    const ligne = ligneParDefaut({ nom: t(`jeu.${fiche.id}.nom`), numero: def.numero(c.jour), date: c.date, score: def.scorePartage(resultat.score, c.i18n.langue, t), extras: def.extrasPartage?.(resultat.score, c.i18n.langue, t) ?? [], medaille: med ? EMOJI[med] : null, rang: rang ? t("kit.fin.rang", { rang, n: participants ?? rang }) : null });
    const texte = textePartage(ligne, adresseDePartage(location));
    const natif = d.tactile && typeof navigator.share === "function";
    let r = "echec";
    try {
      if (natif) {
        await navigator.share({ text: texte });
        r = "partage";
      } else {
        await navigator.clipboard.writeText(texte);
        r = "copie";
      }
    } catch (e) {
      r = e instanceof DOMException && e.name === "AbortError" ? "annule" : "echec";
    }
    if (partagerEtat) partagerEtat.textContent = r === "copie" ? t("kit.fin.partage.copie") : r === "echec" ? t("kit.fin.partage.echec") : "";
  }

  function recommencer(): void {
    desabonner?.();
    desabonner = null;
    partie.detruire();
    finCadre.racine.hidden = true;
    pauseCadre.racine.hidden = true;
    resultat = null;
    partie = nouvelle();
    phase = "jeu";
    acc = 0;
    dernier = performance.now();
    fondFin.reinitialiser();
    c.musique.baisser(0.6);
  }

  if (c.options.debug) {
    const porte: PorteDeTest = {
      manuel: (oui = true) => void (manuel = oui),
      avancer(n) {
        for (let i = 0; i < n && !partie.finie(); i++) partie.avancer();
        partie.dessiner();
        majHud();
        if (phase === "jeu" && partie.finie()) terminer();
      },
      action: (id) => partie.action(id),
      phase: () => phase,
      envoi: () => ({ statut: d.envoi.state.statut, code: d.envoi.state.code, rang: d.envoi.resultats.get(c.date)?.rank ?? null }),
      score: () => resultat?.score ?? null,
      rediffusion: () => resultat?.rediffusion ?? null,
    };
    (window as unknown as { __jeu: PorteDeTest }).__jeu = porte;
  }
}
