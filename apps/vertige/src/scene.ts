import { M, Partie, REGLAGES_DEFAUT, TANGAGE_MAX, TOUR, VARIANTE, YEUX, chargeDe, ecrireTemps, enregistrer, enregistrerScenario, niveau, type Commande, type Contenu, type Reglages } from "@cdj/vertige-sim";
import { commandesDuJeu } from "@cdj/kit/jeu/commandes";
import type { OptionsPartie, PartieDuJeu } from "@cdj/kit/jeu/types";
import { BUILD_RESTRICTED, gameStorage } from "@cdj/kit/stockage";
import { Controles } from "./controles";
import { BORNES_CONFORT, confortDe, ecrireConfort, lireConfort, type Confort, type StyleVertige } from "./confort";
import { lireEssai } from "./essai";
import { FICHE } from "./fiche";
import { creerMains } from "./mains";
import { Monde } from "./monde";

// La partie de Vertige, côté jeu : la simulation (`Partie` de `@cdj/vertige-sim`, entière, 120 pas par seconde), le monde que l'on voit (`monde.ts`), les commandes (`controles.ts`), la caméra, les mains. **De
// l'affichage seulement** autour de la simulation : à chaque pas on lit les commandes, la simulation avance, et cette suite de commandes est la rediffusion. La caméra lit l'état de la simulation (position, lacet,
// tangage) et y ajoute le mouvement de souris pas encore joué, pour que la vue suive la main sans attendre le pas suivant.
const NEUTRE: Commande = { k: 0, dl: 0, dt: 0 };
const RAD = (2 * Math.PI) / TOUR;

/** Une partie qui ne fait rien : l'écran tactile n'a pas de partie (le message dit où jouer). */
function partieInerte(hote: HTMLElement, message: string): PartieDuJeu {
  const p = document.createElement("p");
  p.className = "vertige-tactile";
  p.textContent = message;
  hote.append(p);
  return { avancer: () => undefined, dessiner: () => undefined, finie: () => false, action: () => undefined, hud: () => ({ principal: "—", secondaire: "" }), resultat: () => ({ score: [], rediffusion: "" }), fantome: () => undefined, detruire: () => p.remove() };
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, classe: string, texte?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = classe;
  if (texte !== undefined) e.textContent = texte;
  return e;
}

export function nouvellePartieVertige(contenu: Contenu, hote: HTMLElement, o: OptionsPartie): PartieDuJeu {
  if (o.tactile) return partieInerte(hote, o.t("scene.tactile"));
  const essai = lireEssai(location.search, BUILD_RESTRICTED);
  const nomNiveau = essai.scenario ?? contenu.niveau;
  const niv = niveau(nomNiveau);
  const stockage = gameStorage();
  const confort: Confort = { ...confortDe(essai.confort, lireConfort(stockage)), ...(essai.style ? { style: essai.style } : {}) };
  let reglages: Reglages = essai.reglages ?? { ...REGLAGES_DEFAUT };

  const racine = el("div", "vertige-scene");
  racine.setAttribute("role", "img");
  racine.setAttribute("aria-label", o.libelle);
  hote.append(racine);
  const monde = new Monde(racine, niv, { style: confort.style, bloom: essai.bloom, ombres: essai.ombres, champ: confort.champ });
  const mains = creerMains(monde.hab, monde.mains);
  const canevas = monde.renderer.domElement;
  const commandes = (() => {
    try {
      return commandesDuJeu(FICHE, null as never, null as never); // l'instance du kit (une par jeu) : les touches choisies dans Réglages › Commandes
    } catch {
      return null;
    }
  })();
  const controles = new Controles(commandes, canevas);
  controles.sensibilite = confort.sensibilite;

  // --- La simulation et sa rediffusion ---
  let sim = new Partie(niv, reglages);
  let enregistre: Commande[] = [];
  const redemarrer = (r: Reglages = reglages): void => {
    reglages = r;
    sim = new Partie(niv, reglages);
    enregistre = [];
    controles.effacer();
    roulis = 0;
  };

  // --- Les surimpressions ---
  const viseur = el("div", "vertige-viseur");
  const etat = el("div", "vertige-etat");
  etat.hidden = true;
  const verrou = el("button", "vertige-verrou", o.t("scene.verrou"));
  verrou.type = "button";
  const ouvrirConfort = el("button", "vertige-bouton", o.t("confort.ouvrir"));
  ouvrirConfort.type = "button";
  racine.append(viseur, etat, verrou, ouvrirConfort);
  let confortOuvert = false;
  let sortieVoulue = false;
  let termine = false;
  let dejaVerrouille = false;
  const demanderVerrou = (): void => {
    try {
      const r = canevas.requestPointerLock() as unknown as Promise<void> | undefined;
      void r?.catch?.(() => undefined);
    } catch {
      /* le navigateur refuse : un second clic */
    }
  };
  verrou.addEventListener("click", demanderVerrou);
  canevas.addEventListener("click", () => {
    if (!controles.verrouille && !confortOuvert && !termine) demanderVerrou();
  });
  const rendreLaSouris = (): void => {
    sortieVoulue = true;
    if (document.pointerLockElement) document.exitPointerLock();
  };
  // Échap rend la souris au navigateur SANS envoyer la touche : le jeu se met alors en pause, comme avec le kit.
  const surVerrou = (): void => {
    if (document.pointerLockElement === canevas) {
      sortieVoulue = false;
      dejaVerrouille = true;
      return;
    }
    if (!sortieVoulue && !termine && !confortOuvert) window.dispatchEvent(new KeyboardEvent("keydown", { code: "Escape", key: "Escape", bubbles: true }));
    sortieVoulue = false;
  };
  document.addEventListener("pointerlockchange", surVerrou);

  // --- Le confort : sensibilité, champ de vision, roulis, style ---
  const panneau = el("div", "vertige-confort");
  panneau.hidden = true;
  const sauver = (): void => ecrireConfort(stockage, confort);
  const ligne = (cle: string, min: number, max: number, pas: number, valeur: number, surChange: (v: number) => void, unite: string): HTMLElement => {
    const l = el("label", "vertige-confort__ligne");
    const nom = el("span", "", o.t(cle));
    const sortie = el("output", "", `${valeur}${unite}`);
    const champ = el("input", "");
    champ.type = "range";
    champ.min = String(min);
    champ.max = String(max);
    champ.step = String(pas);
    champ.value = String(valeur);
    champ.addEventListener("input", () => {
      const v = Number(champ.value);
      sortie.textContent = `${v}${unite}`;
      surChange(v);
      sauver();
    });
    l.append(nom, sortie, champ);
    return l;
  };
  const boutonsStyle = (["doux", "cartouche"] as const).map((s) => {
    const b = el("button", "vertige-bouton", o.t(`confort.style.${s}`));
    b.type = "button";
    b.dataset.style = s;
    b.addEventListener("click", () => changerStyle(s));
    return b;
  });
  const roulisCase = el("input", "");
  roulisCase.type = "checkbox";
  roulisCase.checked = confort.roulis;
  roulisCase.addEventListener("change", () => {
    confort.roulis = roulisCase.checked;
    sauver();
  });
  const roulisLigne = el("label", "vertige-confort__ligne vertige-confort__ligne--case");
  roulisLigne.append(roulisCase, el("span", "", o.t("confort.roulis")));
  const fermer = el("button", "vertige-bouton", o.t("confort.fermer"));
  fermer.type = "button";
  panneau.append(
    el("h3", "", o.t("confort.titre")),
    ligne("confort.sensibilite", BORNES_CONFORT.sensibilite[0], BORNES_CONFORT.sensibilite[1], 5, confort.sensibilite, (v) => ((confort.sensibilite = v), (controles.sensibilite = v)), " %"),
    ligne("confort.champ", BORNES_CONFORT.champ[0], BORNES_CONFORT.champ[1], 1, confort.champ, (v) => (confort.champ = v), "°"),
    roulisLigne,
    el("div", "vertige-confort__styles", ""),
    fermer,
  );
  panneau.querySelector(".vertige-confort__styles")!.append(el("span", "", o.t("confort.style")), ...boutonsStyle);
  racine.append(panneau);
  const montrerStyle = (): void => boutonsStyle.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.style === confort.style)));
  function changerStyle(s: StyleVertige): void {
    confort.style = s;
    monde.appliquerStyle(s);
    montrerStyle();
    sauver();
  }
  montrerStyle();
  const basculerConfort = (ouvert: boolean): void => {
    confortOuvert = ouvert;
    panneau.hidden = !ouvert;
    ouvrirConfort.hidden = ouvert;
    if (ouvert) rendreLaSouris();
    controles.effacer();
  };
  ouvrirConfort.addEventListener("click", () => basculerConfort(true));
  fermer.addEventListener("click", () => basculerConfort(false));

  // --- Le panneau des sensations (`?debug&tune`) et les mesures (`?debug&fps`) ---
  let tune: { detruire(): void } | null = null;
  if (essai.tune) {
    void import("./tune").then((m) => {
      if (termine) return;
      tune = m.monterTune(racine, o.langue, { reglages, confort }, (r) => redemarrer(r), (c) => {
        Object.assign(confort, c);
        controles.sensibilite = confort.sensibilite;
        monde.appliquerStyle(confort.style);
        montrerStyle();
        roulisCase.checked = confort.roulis;
      }, rendreLaSouris);
    });
  }
  const mesure = essai.fps ? el("pre", "vertige-mesure") : null;
  if (mesure) racine.append(mesure);
  let images = 0;
  let depuisMesure = performance.now();
  monde.renderer.info.autoReset = false; // les compteurs sont ceux de toute l'image (le halo fait plusieurs passes), remis à zéro à chaque image
  let tailleGz = 0;
  let derniereTaille = 0;

  // --- La caméra ---
  const redimensionner = (): void => {
    const r = hote.getBoundingClientRect();
    monde.redimensionner(r.width, r.height);
  };
  const observateur = new ResizeObserver(redimensionner);
  observateur.observe(hote);
  redimensionner();
  let fov = confort.champ;
  let roulis = 0;
  let dernier = performance.now();
  let t = 0;

  // Le joueur scripté (`?debug&demo`) : ses commandes remplacent celles du joueur, pour des captures et des mesures qui se répètent.
  let demo: Commande[] | null = null;
  if (essai.demo) void import("@cdj/vertige-sim/essais").then((m) => import("@cdj/vertige-sim").then((s) => (demo = s.decoderRediffusion(m.PARTIES_ESSAIS[0]!.code).commandes)));

  const porte = { sim: () => sim, commandes: () => enregistre, controles, monde, essai, jouer: (c: Commande[]): void => void (demo = c) };
  if (essai.debug) (window as unknown as { __vertige: typeof porte }).__vertige = porte;

  return {
    avancer() {
      if (sim.finie) return;
      const c = demo ? demo[sim.tick] ?? NEUTRE : confortOuvert ? NEUTRE : controles.lire();
      if (confortOuvert || demo) controles.effacer();
      sim.avancer(c);
      enregistre.push(c);
    },
    finie: () => sim.finie,
    action(id) {
      if (id === "relancer") redemarrer();
      else if (id === "style1") changerStyle("doux");
      else if (id === "style2") changerStyle("cartouche");
    },
    hud() {
      const total = sim.prises.length;
      return { principal: ecrireTemps(sim.chrono, o.langue), secondaire: total > 0 ? o.t("hud.gemmes", { n: sim.prises.filter(Boolean).length, total }) : "" };
    },
    resultat: () => ({ score: VARIANTE.score(sim.resultat()), rediffusion: essai.scenario ? enregistrerScenario(essai.scenario, enregistre) : enregistrer(contenu, enregistre) }),
    fantome: () => undefined,
    dessiner() {
      const maintenant = performance.now();
      const dt = Math.min(0.1, (maintenant - dernier) / 1000);
      dernier = maintenant;
      t += dt;
      if (sim.finie && !termine) {
        termine = true;
        rendreLaSouris();
      }
      // La vue : la position des yeux et l'angle de la simulation, plus le regard pas encore joué.
      const [pl, pt] = controles.regardEnAttente();
      const lacet = (sim.lacet + pl) * RAD;
      const tangage = Math.max(-TANGAGE_MAX, Math.min(TANGAGE_MAX, sim.tangage + pt)) * RAD;
      const roulisVise = confort.roulis && sim.surMur ? -(sim.murNx * Math.cos(lacet) - sim.murNz * Math.sin(lacet)) * 0.16 : 0;
      roulis += (roulisVise - roulis) * Math.min(1, 8 * dt);
      const cam = monde.camera;
      cam.position.set(sim.x / M, (sim.y + YEUX) / M, sim.z / M);
      cam.rotation.set(tangage, lacet, roulis);
      fov += (confort.champ + (sim.dash > 0 ? 12 : 0) - fov) * Math.min(1, 10 * dt);
      cam.fov = fov;
      cam.updateProjectionMatrix();
      mains.animer(t, sim.sol, Math.hypot(sim.vx, sim.vz) / M, sim.dash > 0);
      monde.animer(t, dt, sim.prises);
      monde.renderer.info.reset();
      monde.dessiner();
      // Les surimpressions.
      etat.hidden = !(sim.dash > 0 || sim.surMur);
      if (!etat.hidden) etat.textContent = o.t(sim.dash > 0 ? "etat.dash" : "etat.mur");
      verrou.hidden = controles.verrouille || confortOuvert || termine;
      const texteVerrou = o.t(dejaVerrouille ? "scene.verrou.reprise" : "scene.verrou");
      if (verrou.textContent !== texteVerrou) verrou.textContent = texteVerrou;
      if (mesure) {
        images++;
        if (maintenant - depuisMesure >= 1000) {
          const octets = chargeDe(enregistre).length;
          if (octets !== derniereTaille && typeof CompressionStream !== "undefined") {
            derniereTaille = octets;
            void new Response(new Blob([new Uint8Array(chargeDe(enregistre))]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer().then((b) => (tailleGz = b.byteLength), () => undefined);
          }
          const info = monde.renderer.info.render;
          mesure.textContent = `${Math.round((images * 1000) / (maintenant - depuisMesure))} i/s · ${info.calls} appels · ${Math.round(info.triangles / 1000)} k tri\npas ${sim.tick} · rediffusion ${octets} o (gzip ${tailleGz} o)`;
          images = 0;
          depuisMesure = maintenant;
        }
      }
    },
    detruire() {
      termine = true;
      document.removeEventListener("pointerlockchange", surVerrou);
      observateur.disconnect();
      controles.detruire();
      tune?.detruire();
      rendreLaSouris();
      monde.detruire();
      racine.remove();
      delete (window as unknown as { __vertige?: unknown }).__vertige;
    },
  };
}
