import { REGLAGES, type Reglages } from "@cdj/pinball-sim";
import { BORNES, BORNES_VUE, VUE_DEFAUT, type Vue } from "./bornes";

// Le panneau des réglages de Pinball (`?debug&tune`, lot PB2, jamais en production) : sur le modèle de celui de Rush.
//  · des curseurs pour `reglages.ts` (pente, rebonds, coups, batteurs, lanceur, trou, bille sauvée…) — **changer l'un relance la partie, qui n'est alors pas classable** ;
//  · des curseurs pour la VUE (angle, distance et champ de la caméra, lumière, taille des étiquettes), réglés en direct, qui n'entrent jamais dans la simulation (rendu haute qualité seulement) ;
//  · « Exporter » écrit les réglages en JSON, que Nathan colle dans un lot ; « Copier le lien » met le même JSON dans l'adresse (`&reglages=`), qui le recharge.
// **À la demande** (chargé par la scène seulement avec `?debug&tune`) : les textes sont écrits ici, en français et en anglais, et ne pèsent rien dans les catalogues du premier chargement.
export interface EtatTune {
  langue: "fr" | "en";
  reglages: Reglages;
  vue: Vue;
  /** Un réglage de la simulation a changé : la partie repart. */
  surReglages(r: Reglages): void;
  /** La vue a changé : tout de suite, sans relancer. */
  surVue(v: Vue): void;
  /** Le rendu haute qualité est-il celui de l'écran ? (les curseurs de la vue n'ont pas d'effet sur le rendu de secours) */
  estHaute(): boolean;
}
export interface Tune {
  detruire(): void;
}

interface Curseur {
  cle: string;
  groupe: "sim" | "vue";
  section: string;
  fr: string;
  en: string;
  /** Le pas du curseur (1 par défaut ; plus grand pour une plage très large). */
  pas?: number;
}
const sim = (cle: keyof Reglages, section: string, fr: string, en: string, pas = 1): Curseur => ({ cle, groupe: "sim", section, fr, en, pas });
const CURSEURS: readonly Curseur[] = [
  sim("pente", "Table", "Pente (px/s²)", "Slope (px/s²)"),
  sim("vitesseMax", "Table", "Vitesse maximale de la bille (px/s)", "Ball top speed (px/s)"),
  sim("rebondMur", "Rebonds (‰)", "Rebond des murs", "Wall bounce"),
  sim("rebondGuide", "Rebonds (‰)", "Rebond des couloirs de retour", "Return lane bounce"),
  sim("rebondFond", "Rebonds (‰)", "Rebond du fond du lanceur", "Launcher floor bounce"),
  sim("rebondPoteau", "Rebonds (‰)", "Rebond des poteaux", "Post bounce"),
  sim("rebondBumper", "Rebonds (‰)", "Rebond des bumpers", "Bumper bounce"),
  sim("rebondCible", "Rebonds (‰)", "Rebond des cibles", "Target bounce"),
  sim("rebondBatteur", "Rebonds (‰)", "Rebond des batteurs", "Flipper bounce"),
  sim("frottementMur", "Rebonds (‰)", "Vitesse gardée à chaque contact", "Speed kept per contact"),
  sim("kickBumper", "Coups (px/s)", "Coup du trio de bumpers", "Bumper trio kick"),
  sim("kickMini", "Coups (px/s)", "Coup des mini-bumpers", "Mini-bumper kick"),
  sim("kickSling", "Coups (px/s)", "Coup des lance-pierres", "Slingshot kick"),
  sim("seuilSling", "Coups (px/s)", "Vitesse minimale pour un lance-pierre", "Slingshot minimum speed"),
  sim("batteurRepos", "Batteurs", "Angle de repos (mrad)", "Rest angle (mrad)"),
  sim("batteurHaut", "Batteurs", "Angle levé (mrad)", "Raised angle (mrad)"),
  sim("batteurVitesseHaut", "Batteurs", "Force en montant (mrad/s)", "Flip-up speed (mrad/s)"),
  sim("batteurVitesseBas", "Batteurs", "Vitesse en redescendant (mrad/s)", "Flip-down speed (mrad/s)"),
  sim("lanceurBase", "Lanceur", "Vitesse de départ (px/s)", "Launch base speed (px/s)"),
  sim("lanceurPlus", "Lanceur", "Supplément à pleine charge (px/s)", "Full-charge bonus (px/s)"),
  sim("lanceurCharge", "Lanceur", "Charge (‰/s)", "Charge rate (‰/s)"),
  sim("trouGarde", "Trou", "Garde la bille (pas)", "Holds the ball (steps)"),
  sim("trouVitesse", "Trou", "Vitesse de relance (px/s)", "Release speed (px/s)"),
  sim("trouPause", "Trou", "Pause avant de reprendre (pas)", "Pause before catching again (steps)"),
  sim("trouVitesseMax", "Trou", "Vitesse maximale pour tomber dedans (px/s)", "Top speed to fall in (px/s)"),
  sim("sauvee", "Bille sauvée", "Délai (pas, 0 = supprimée)", "Window (steps, 0 = off)"),
  sim("banqueRelevee", "Cibles et couloirs", "Banque relevée après (pas)", "Bank resets after (steps)"),
  sim("voiesRelevees", "Cibles et couloirs", "Lampes éteintes après (pas)", "Lamps off after (steps)"),
  // lot PB3 : les éléments des thèmes, puis les buts des missions
  sim("kickBulles", "Océan", "Coup des Bulles : le trio (px/s)", "Bubbles kick: trio (px/s)"),
  sim("kickMiniBulles", "Océan", "Coup des Bulles : la paire (px/s)", "Bubbles kick: pair (px/s)"),
  sim("tourbillonForce", "Océan", "Tourbillon : attraction (px/s²)", "Whirlpool: pull (px/s²)", 10),
  sim("tourbillonSpirale", "Océan", "Tourbillon : spirale (px/s²)", "Whirlpool: swirl (px/s²)", 10),
  sim("tourbillonGarde", "Océan", "Tourbillon : garde la bille (pas)", "Whirlpool: holds the ball (steps)"),
  sim("tourbillonPause", "Océan", "Tourbillon : pause avant de reprendre (pas)", "Whirlpool: pause before catching again (steps)"),
  sim("tourbillonVitesse", "Océan", "Tourbillon : vitesse de sortie (px/s)", "Whirlpool: release speed (px/s)"),
  sim("manegeVitesse", "Fête foraine", "Manège : vitesse (6 = la maquette)", "Carousel: speed (6 = the mockup)"),
  sim("trouNoirForce", "Espace", "Trou noir : force (attraction = force / distance², au plus 1 400 px/s²)", "Black hole: strength (pull = strength / distance², up to 1,400 px/s²)", 1000),
  sim("portailPause", "Espace", "Portails : pause après un passage (pas)", "Portals: pause after a pass (steps)"),
  sim("geyserVitesse", "Volcan", "Geyser : poussée vers le haut (px/s)", "Geyser: upward push (px/s)"),
  sim("geyserPause", "Volcan", "Geyser : pause entre deux jets (pas)", "Geyser: pause between jets (steps)"),
  sim("geyserDevie", "Volcan", "Geyser : poussée de côté (px/s)", "Geyser: sideways push (px/s)"),
  sim("geyserParBille", "Volcan", "Geyser : jets au plus par bille", "Geyser: most jets per ball"),
  sim("couleeForce", "Volcan", "Coulée : accélération (px/s²)", "Lava flow: acceleration (px/s²)", 10),
  sim("butManege", "Missions (buts)", "Fête foraine : tours de manège", "Funfair: carousel laps"),
  sim("butTourbillon", "Missions (buts)", "Océan : plongées dans le tourbillon", "Ocean: whirlpool dives"),
  sim("butPortail", "Missions (buts)", "Espace : passages par un portail", "Space: portal passes"),
  sim("butGeyser", "Missions (buts)", "Volcan : geysers déclenchés", "Volcano: geysers set off"),
  { cle: "angle", groupe: "vue", section: "Vue", fr: "Caméra : angle (°)", en: "Camera: angle (°)" },
  { cle: "distance", groupe: "vue", section: "Vue", fr: "Caméra : distance (% du cadrage)", en: "Camera: distance (% of framing)" },
  { cle: "champ", groupe: "vue", section: "Vue", fr: "Caméra : champ (°)", en: "Camera: field of view (°)" },
  { cle: "lumiere", groupe: "vue", section: "Vue", fr: "Lumière (%)", en: "Light (%)" },
  { cle: "etiquettes", groupe: "vue", section: "Vue", fr: "Étiquettes : taille (%)", en: "Labels: size (%)" },
];
const SECTIONS_EN: Record<string, string> = { Table: "Table", "Rebonds (‰)": "Bounces (‰)", "Coups (px/s)": "Kicks (px/s)", Batteurs: "Flippers", Lanceur: "Launcher", Trou: "Hole", "Bille sauvée": "Ball save", "Cibles et couloirs": "Targets and lanes", "Océan": "Ocean", "Fête foraine": "Funfair", Espace: "Space", Volcan: "Volcano", "Missions (buts)": "Missions (goals)", Vue: "View" };
const TEXTES = {
  fr: { ouvrir: "Réglages d'essai", titre: "Réglages d'essai", note: "Un curseur de la simulation relance la partie (non classée) ; ceux de la vue agissent en direct (rendu haute qualité).", exporter: "Exporter", copie: "Copié", lien: "Copier le lien", retablir: "Rétablir", fermer: "Fermer", json: "Les réglages, en JSON", sansTrois: "Le rendu de secours est affiché : la vue n'a pas d'effet." },
  en: { ouvrir: "Tuning", titre: "Tuning", note: "A simulation slider restarts the game (not ranked); the view sliders apply live (high quality render).", exporter: "Export", copie: "Copied", lien: "Copy link", retablir: "Reset", fermer: "Close", json: "The settings, as JSON", sansTrois: "The fallback render is showing: the view has no effect." },
};

const bouton = (texte: string, surClic: () => void): HTMLButtonElement => {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = texte;
  Object.assign(b.style, { font: "inherit", padding: "4px 8px", minHeight: "32px", cursor: "pointer" });
  b.addEventListener("click", surClic);
  return b;
};

export function monterTune(hote: HTMLElement, e: EtatTune): Tune {
  const T = TEXTES[e.langue];
  const etat = { reglages: { ...e.reglages }, vue: { ...e.vue } };
  const racine = document.createElement("div");
  racine.className = "pinball-tune";
  Object.assign(racine.style, { position: "absolute", top: "6px", right: "6px", zIndex: "20", font: "12px/1.3 system-ui, sans-serif", color: "#fff6e0", maxHeight: "calc(100% - 12px)", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px", pointerEvents: "none" });
  const ouvrir = bouton(T.ouvrir, () => {
    panneau.hidden = false;
    ouvrir.hidden = true;
  });
  ouvrir.style.pointerEvents = "auto";
  const panneau = document.createElement("div");
  panneau.hidden = true;
  Object.assign(panneau.style, { pointerEvents: "auto", background: "rgba(28,20,14,.94)", border: "2px solid #2A1E16", borderRadius: "8px", padding: "8px", width: "min(300px, calc(100vw - 24px))", overflowY: "auto", minHeight: "0" });
  const titre = document.createElement("strong");
  titre.textContent = T.titre;
  const note = document.createElement("div");
  note.textContent = T.note;
  note.style.margin = "4px 0 6px";
  const alerte = document.createElement("div");
  alerte.textContent = T.sansTrois;
  alerte.hidden = true;
  alerte.style.color = "#E8B23A";
  panneau.append(titre, note, alerte);
  // Un curseur qu'on fait glisser change vingt fois de valeur : la partie ne repart qu'une fois la main arrêtée.
  let delai = 0;
  const relancer = (): void => {
    clearTimeout(delai);
    delai = window.setTimeout(() => e.surReglages(etat.reglages), 250);
  };
  const valeurs = new Map<string, HTMLElement>();
  const entrees = new Map<string, HTMLInputElement>();
  const lire = (c: Curseur): number => (c.groupe === "sim" ? etat.reglages[c.cle as keyof Reglages] : etat.vue[c.cle as keyof Vue]);
  let section = "";
  for (const c of CURSEURS) {
    if (c.section !== section) {
      section = c.section;
      const h = document.createElement("div");
      h.textContent = e.langue === "en" ? (SECTIONS_EN[section] ?? section) : section;
      Object.assign(h.style, { fontWeight: "700", margin: "8px 0 2px", color: "#E8B23A" });
      panneau.append(h);
    }
    const [min, max] = c.groupe === "sim" ? BORNES[c.cle as keyof Reglages] : BORNES_VUE[c.cle as keyof Vue];
    const l = document.createElement("label");
    Object.assign(l.style, { display: "grid", gridTemplateColumns: "1fr auto", gap: "0 6px" });
    const nom = document.createElement("span");
    nom.textContent = e.langue === "en" ? c.en : c.fr;
    const v = document.createElement("span");
    const r = document.createElement("input");
    r.type = "range";
    r.min = String(min);
    r.max = String(max);
    r.step = String(c.pas ?? 1);
    r.value = String(lire(c));
    r.style.gridColumn = "1 / 3";
    v.textContent = r.value;
    r.addEventListener("input", () => {
      const n = Number(r.value);
      v.textContent = r.value;
      if (c.groupe === "sim") {
        etat.reglages = { ...etat.reglages, [c.cle]: n };
        relancer();
      } else {
        etat.vue = { ...etat.vue, [c.cle]: n };
        e.surVue(etat.vue);
        alerte.hidden = e.estHaute();
      }
    });
    l.append(nom, v, r);
    panneau.append(l);
    valeurs.set(c.cle, v);
    entrees.set(c.cle, r);
  }
  const json = document.createElement("textarea");
  json.readOnly = true;
  json.hidden = true;
  json.rows = 6;
  json.setAttribute("aria-label", T.json);
  Object.assign(json.style, { width: "100%", boxSizing: "border-box", marginTop: "6px", font: "11px monospace" });
  const texte = (): string => JSON.stringify({ reglages: etat.reglages, vue: etat.vue });
  const copier = (b: HTMLButtonElement, valeur: string, avant: string): void => {
    void navigator.clipboard?.writeText(valeur).then(
      () => {
        b.textContent = T.copie;
        setTimeout(() => (b.textContent = avant), 1500);
      },
      () => undefined,
    );
  };
  const exporter: HTMLButtonElement = bouton(T.exporter, () => {
    json.value = texte();
    json.hidden = false;
    json.select();
    copier(exporter, json.value, T.exporter);
  });
  const lien: HTMLButtonElement = bouton(T.lien, () => {
    const u = new URL(location.href);
    u.searchParams.set("reglages", texte());
    copier(lien, u.toString(), T.lien);
  });
  const retablir = bouton(T.retablir, () => {
    etat.reglages = { ...REGLAGES };
    etat.vue = { ...VUE_DEFAUT };
    for (const c of CURSEURS) {
      entrees.get(c.cle)!.value = String(lire(c));
      valeurs.get(c.cle)!.textContent = String(lire(c));
    }
    clearTimeout(delai);
    e.surReglages(etat.reglages);
    e.surVue(etat.vue);
  });
  const fermer = bouton(T.fermer, () => {
    panneau.hidden = true;
    ouvrir.hidden = false;
  });
  const actions = document.createElement("div");
  Object.assign(actions.style, { display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" });
  actions.append(exporter, lien, retablir, fermer);
  panneau.append(actions, json);
  racine.append(ouvrir, panneau);
  hote.append(racine);
  return {
    detruire: () => {
      clearTimeout(delai);
      racine.remove();
    },
  };
}
