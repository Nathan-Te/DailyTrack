import { svg } from "@cdj/ui";
import { el, row, segmented, slider, type Control } from "./dom";
import { ajouterTextes, fNombre, onLangue, t } from "./i18n";
import { en, fr } from "./catalogue.reglages.gyroscope";
import { PLAGE_SENSIBILITE, PLAGE_ZONE_MORTE, clamp, shape, wrap180 } from "./steerMath";
import type { Steerer } from "./touch";
import type { SteerFactory, SteerModule } from "./touchUi";
import "./steerGyro.css";

// Lot 52 — le gyroscope (maquettes docs/lots/lot-52-commandes/maquettes.html, validées par Nathan) : on tourne en inclinant le téléphone tenu en paysage, comme un volant
// (`DeviceOrientationEvent`). **Aucune donnée du capteur n'est gardée ni envoyée** : seul le réglage est gardé (`cdj:touch`) ; les mesures vivent le temps de la page, en mémoire.
// - **Angle** : celui du plan de l'écran (comme un volant), tiré de la gravité que donnent `beta` et `gamma` — pas de blocage près de la verticale, et le sens suit
//   `screen.orientation.angle` : les deux paysages donnent « à gauche » quand on penche vers la gauche de l'écran. À plat, sans appui, pas d'angle : direction 0.
// - **Calibrage** : le neutre est la moyenne des 0,5 dernières secondes du décompte (« PARTEZ ! ») ; « Recentrer » (pause, réglages) le reprend 1,5 s après l'appui.
// - **Filtrage** léger contre les tremblements (lissage exponentiel, ≈ 30 ms) : aucun retard perceptible.
// - **Autorisation** : iPhone, `requestPermission` au geste du joueur ; refusée, ou capteur absent ou muet, le jeu reprend le mode d'avant et le dit.
// Chargé à la demande : jamais dans le premier chargement.

/** Inclinaison qui donne le plein braquage à sensibilité ×1 (degrés). */
export const GYRO_FULL_LOCK_DEG = 35;
/** Constante de temps du lissage (ms). */
export const GYRO_FILTER_MS = 30;
/** Fenêtre de la moyenne qui donne le neutre (ms), et délai du recentrage (ms). */
export const GYRO_NEUTRAL_WINDOW_MS = 500;
export const GYRO_RECENTER_MS = 1500;
/** En dessous, la gravité est trop peu dans le plan de l'écran (téléphone presque à plat) : pas d'angle. */
export const GYRO_FLAT = 0.35;
/** Le capteur doit répondre dans ce délai (ms), sinon il est dit absent. */
export const GYRO_SILENCE_MS = 1000;

/**
 * Inclinaison dans le plan de l'écran, en degrés, positive vers la droite de l'écran ; `null` si le téléphone est presque à plat. `beta` et `gamma` sont ceux de
 * `DeviceOrientationEvent` ; `screenAngle` celui de `screen.orientation.angle` (0 portrait, 90 et 270 les deux paysages). La gravité dans le repère de l'appareil est
 * `(sin γ cos β, −sin β, −cos γ cos β)`, puis on la lit dans le repère de l'écran.
 */
export function inPlaneRoll(beta: number, gamma: number, screenAngle: number): number | null {
  const b = (beta * Math.PI) / 180;
  const g = (gamma * Math.PI) / 180;
  const a = (screenAngle * Math.PI) / 180;
  const gx = Math.sin(g) * Math.cos(b);
  const gy = -Math.sin(b);
  const sx = gx * Math.cos(a) - gy * Math.sin(a);
  const sy = gx * Math.sin(a) + gy * Math.cos(a);
  if (Math.hypot(sx, sy) < GYRO_FLAT) return null;
  return (Math.atan2(sx, -sy) * 180) / Math.PI;
}

/** Moyenne d'angles (degrés) : celle des écarts au premier, pour ne pas se tromper autour de ±180°. */
export function meanAngle(angles: readonly number[]): number {
  if (angles.length === 0) return 0;
  const ref = angles[0]!;
  return wrap180(ref + angles.reduce((s, a) => s + wrap180(a - ref), 0) / angles.length);
}

export class GyroSteerer implements Steerer {
  /** L'inclinaison lissée (degrés) ; `null` tant qu'aucune mesure ne vient, ou à plat. */
  smooth: number | null = null;
  neutral: number | null = null;
  settings: { gyroSensitivity: number; gyroDeadzone: number };
  private lastT = 0;
  private flat = true;
  private readonly ring: { t: number; roll: number }[] = [];
  /** « Calage » affiché pendant le décompte, « Prêt » un instant après. */
  phase: "attente" | "calage" | "pret" = "attente";
  /** L'instant (ms) où « PARTEZ ! » a pris le neutre : la jauge dit « Prêt » un moment. */
  readyAt = -1e9;

  constructor(settings: { gyroSensitivity: number; gyroDeadzone: number }) {
    this.settings = settings;
  }

  /** Une mesure : `roll` (voir `inPlaneRoll`) à l'instant `t` (ms). */
  feed(roll: number | null, t: number): void {
    if (roll === null) {
      this.flat = true;
      return;
    }
    this.flat = false;
    const dt = clamp(t - this.lastT, 0, 100);
    this.smooth = this.smooth === null || this.lastT === 0 ? roll : wrap180(this.smooth + (1 - Math.exp(-dt / GYRO_FILTER_MS)) * wrap180(roll - this.smooth));
    this.lastT = t;
    this.ring.push({ t, roll });
    while (this.ring.length > 1 && t - this.ring[0]!.t > GYRO_NEUTRAL_WINDOW_MS) this.ring.shift();
    if (this.neutral === null) this.neutral = roll; // la première mesure fait le neutre tant qu'aucun calage n'a eu lieu
  }

  /** Le neutre : la moyenne des mesures de la dernière demi-seconde (ou la dernière mesure). */
  calibrate(): void {
    if (this.ring.length > 0) this.neutral = meanAngle(this.ring.map((r) => r.roll));
  }

  begin(): void {
    this.phase = "calage";
    this.onBegin?.();
  }
  /** Le décompte commence : de quoi dire « tiens le téléphone droit » (renseigné par le module). */
  onBegin: (() => void) | null = null;

  go(): void {
    this.calibrate();
    this.phase = "pret";
    this.readyAt = performance.now();
  }

  /** Écart à la position neutre, en degrés. */
  tilt(): number {
    return this.smooth === null || this.neutral === null || this.flat ? 0 : wrap180(this.smooth - this.neutral);
  }

  /** L'inclinaison qui donne le plein braquage à la sensibilité réglée (degrés). */
  fullLock(): number {
    return GYRO_FULL_LOCK_DEG / this.settings.gyroSensitivity;
  }

  /** Position de la jauge ∈ [-1, 1] : l'écart au neutre, sans zone morte. */
  gauge(): number {
    return clamp(this.tilt() / this.fullLock(), -1, 1);
  }

  steer(): number {
    return shape(this.gauge(), this.settings.gyroDeadzone);
  }
}

/** L'angle de l'écran (0, 90, 180, 270). */
const screenAngle = (): number => (((screen.orientation?.angle ?? (window as { orientation?: number }).orientation ?? 0) % 360) + 360) % 360;

type Capteur = "ok" | "refuse" | "absent" | "geste";
const permission = (): ((() => Promise<string>) | undefined) => (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent?.requestPermission;

/** Le capteur répond-il (une mesure non nulle dans `GYRO_SILENCE_MS`) ? Sans autorisation à demander (Android) : on écoute seulement. */
function ecouterUneMesure(): Promise<boolean> {
  return new Promise((resolve) => {
    const fin = (ok: boolean) => {
      window.removeEventListener("deviceorientation", surMesure);
      clearTimeout(minuteur);
      resolve(ok);
    };
    const surMesure = (e: DeviceOrientationEvent) => {
      if (e.beta !== null && e.gamma !== null) fin(true);
    };
    const minuteur = setTimeout(() => fin(false), GYRO_SILENCE_MS);
    window.addEventListener("deviceorientation", surMesure);
  });
}

/**
 * Demande l'autorisation si le navigateur le veut, puis vérifie que le capteur répond. iPhone : la demande n'aboutit **qu'au geste du joueur** ; hors d'un geste (`auGeste`
 * faux) le navigateur la rejette sans rien afficher : on rend « geste » (il faut attendre le premier toucher et redemander), jamais « refusé ».
 */
export async function demanderCapteur(auGeste = true): Promise<Capteur> {
  if (typeof DeviceOrientationEvent === "undefined") return "absent";
  const demande = permission();
  if (demande) {
    try {
      if ((await demande.call(DeviceOrientationEvent)) !== "granted") return "refuse";
    } catch {
      return auGeste ? "refuse" : "geste";
    }
  }
  return (await ecouterUneMesure()) ? "ok" : "absent";
}

const icone = () =>
  svg("svg", { classe: "dj-icone", attrs: { viewBox: "0 0 40 40", width: 40, height: 40, "aria-hidden": "true", focusable: "false", fill: "none", stroke: "currentColor", "stroke-linecap": "square", "stroke-width": 2.25 } }, svg("rect", { attrs: { x: 13, y: 6, width: 14, height: 24 } }), svg("path", { attrs: { d: "M18 26h4M30 12c4 2 6 5 6 8M36 20l-3-3M36 20l3-3" } }));

/** Une carte d'état (maquette) : l'icône, la phrase, une précision, un bouton éventuel. */
function carte(variante: "" | "ok" | "refus", texte: string, petit: string, bouton?: HTMLElement): HTMLElement {
  const c = el("div", `gyro-carte${variante ? ` gyro-carte--${variante}` : ""}`);
  const corps = el("div", "gyro-carte__corps");
  corps.append(el("p", "", texte), el("p", "gyro-carte__petit", petit));
  if (bouton) corps.append(bouton);
  c.append(icone(), corps);
  return c;
}

/** La jauge d'inclinaison (une plaque : graduations, zone morte, curseur) ; rend l'élément et sa mise à jour. */
function creerJauge(steerer: GyroSteerer, cls: string): { racine: HTMLElement; maj(): void } {
  const racine = el("div", cls);
  const zone = el("i", "gyro-jauge__zone");
  const curseur = el("i", "gyro-jauge__curseur");
  const etat = el("span", "gyro-jauge__etat");
  racine.append(zone, ...Array.from({ length: 9 }, (_, i) => el("i", i === 4 ? "gyro-jauge__graduation gyro-jauge__graduation--centre" : "gyro-jauge__graduation")), curseur, etat);
  Array.from(racine.querySelectorAll<HTMLElement>(".gyro-jauge__graduation")).forEach((g, i) => (g.style.left = `${(i / 8) * 100}%`));
  let dernier = "";
  return {
    racine,
    maj() {
      const dz = steerer.settings.gyroDeadzone * 100;
      const texte = steerer.phase === "calage" ? t("tactile.gyro.jauge.calage") : steerer.phase === "pret" && performance.now() - steerer.readyAt < 1200 ? t("tactile.gyro.jauge.pret") : "";
      const cle = `${texte}|${steerer.gauge().toFixed(3)}|${dz}`;
      if (cle === dernier) return;
      dernier = cle;
      zone.style.left = `${50 - dz / 2}%`;
      zone.style.width = `${dz}%`;
      curseur.style.left = `${50 + steerer.gauge() * 46}%`;
      etat.textContent = texte;
      racine.classList.toggle("gyro-jauge--texte", texte !== "");
    },
  };
}
export const create: SteerFactory = (pad, io): SteerModule => {
  ajouterTextes({ fr, en });
  const steerer = new GyroSteerer(pad.settings);
  steerer.onBegin = () => io.notice(t("tactile.gyro.calage"));
  steerer.settings = pad.settings; // les réglages sont lus à chaque mesure : un curseur déplacé agit tout de suite
  let capteur: "attente" | "demande" | "ok" | "refuse" | "absent" = "attente";
  let racineJauge: HTMLElement | null = null;
  /** Change l'état du capteur ; la jauge de course le porte (`data-capteur`), pour les tests et les lecteurs d'écran. */
  const etat = (c: typeof capteur) => {
    capteur = c;
    if (racineJauge) racineJauge.dataset.capteur = c;
    majCarte();
  };
  let monte = false;
  let ecoute: ((e: DeviceOrientationEvent) => void) | null = null;
  let boucle = 0;
  const jauges: { racine: HTMLElement; maj(): void }[] = [];
  let essaiActuel: { racine: HTMLElement; maj(): void } | null = null;
  let majCarte: () => void = () => undefined;

  const arreter = () => {
    if (ecoute) window.removeEventListener("deviceorientation", ecoute);
    ecoute = null;
    cancelAnimationFrame(boucle);
    boucle = 0;
  };
  const ecouter = () => {
    if (ecoute) return;
    ecoute = (e) => {
      if (e.beta === null || e.gamma === null) return;
      steerer.feed(inPlaneRoll(e.beta, e.gamma, screenAngle()), e.timeStamp || performance.now());
    };
    window.addEventListener("deviceorientation", ecoute);
    const tour = () => {
      for (const j of jauges) j.maj();
      boucle = requestAnimationFrame(tour);
    };
    boucle = requestAnimationFrame(tour);
  };

  /** La demande d'autorisation et la vérification du capteur ; un échec rend la main au jeu (`io.fail` : il reprend le mode d'avant). */
  async function demander(auGeste: boolean) {
    if (capteur === "demande") return; // une demande est déjà en cours (le toucher du bouton « Autoriser » a aussi passé par le geste global)
    etat("demande");
    const r = await demanderCapteur(auGeste);
    if (!monte) return;
    if (r === "geste") {
      // iPhone : la demande attend un geste du joueur — son premier toucher (ou le bouton « Autoriser » des Réglages).
      etat("attente");
      retirerGeste();
      geste = () => {
        retirerGeste();
        void demander(true);
      };
      for (const e of GESTES) document.addEventListener(e, geste, true);
    } else if (r === "ok") {
      etat("ok");
      ecouter();
    } else {
      etat(r);
      io.fail(r);
    }
  }

  let geste: ((e: Event) => void) | null = null;
  /** Les évènements qui comptent comme un geste du joueur pour Safari (le toucher d'une zone de jeu n'envoie pas de « click » : il est retenu pour ne pas défiler). */
  const GESTES = ["touchend", "pointerup", "click"] as const;
  const retirerGeste = () => {
    if (geste) for (const e of GESTES) document.removeEventListener(e, geste, true);
    geste = null;
  };

  let recentrage = 0;
  let boutonPause: HTMLButtonElement | null = null;
  const majBoutons = () => {
    if (!boutonPause) return;
    const en = recentrage > 0;
    boutonPause.disabled = en;
    boutonPause.classList.toggle("gyro-recentrage", en);
    boutonPause.textContent = t(en ? "tactile.gyro.recentrage" : "tactile.gyro.recentrer");
  };
  function recentrer() {
    if (recentrage) return;
    recentrage = window.setTimeout(() => {
      recentrage = 0;
      steerer.calibrate();
      if (boutonPause) {
        boutonPause.textContent = t("tactile.gyro.recentre");
        boutonPause.disabled = false;
        window.setTimeout(majBoutons, 1500);
      }
    }, GYRO_RECENTER_MS);
    majBoutons();
  }

  return {
    steerer,
    loading: () => capteur === "demande",
    // Le frein sous le pouce de la direction, le gaz de l'autre côté.
    hint: (s, cd, cp) => ({ direction: t("tactile.indice.gyro"), pedales: s.autoThrottle ? t("tactile.indice.auto", { cote: cd }) : t("tactile.indice.gyroPedales", { frein: cd, gaz: cp }) }),
    mount(host) {
      monte = true;
      steerer.smooth = null;
      steerer.neutral = null;
      const jauge = creerJauge(steerer, "gyro-jauge gyro-jauge--course");
      jauges.push(jauge);
      racineJauge = jauge.racine;
      host.append(jauge.racine);
      // Le bouton de la pause : sous « Reprendre », en mode gyroscope seulement.
      boutonPause = el("button", "dj-bouton dj-bouton--secondaire gyro-pause", t("tactile.gyro.recentrer"));
      boutonPause.type = "button";
      boutonPause.id = "pause-recentrer";
      boutonPause.addEventListener("click", recentrer);
      document.getElementById("pause-resume")?.after(boutonPause);
      const langue = onLangue(majBoutons);
      void demander(false);
      const layout = () => {
        jauge.racine.hidden = !pad.settings.gyroGauge;
      };
      layout();
      return {
        layout,
        render: () => undefined,
        unmount() {
          monte = false;
          arreter();
          retirerGeste();
          langue();
          jauges.length = 0;
          essaiActuel = null;
          jauge.racine.remove();
          racineJauge = null;
          boutonPause?.remove();
          boutonPause = null;
          clearTimeout(recentrage);
          recentrage = 0;
        },
      };
    },
    refusal(raison, retour) {
      const mode = t(`tactile.direction.${retour === "buttons" ? "boutons" : retour === "slider" ? "glissiere" : retour === "wheel" ? "volant" : "gyro"}`);
      const cle = raison === "refuse" ? "refus" : "absent";
      return { carte: carte("refus", t(`tactile.gyro.carte.${cle}`, { mode }), t(`tactile.gyro.carte.${cle}Petit`)), message: t(`tactile.gyro.carte.${cle}`, { mode }) };
    },
    rows(apply) {
      const nodes: HTMLElement[] = [];
      const zoneCarte = el("div", "reglage reglage--pleine");
      majCarte = () => {
        const bouton = el("button", "dj-bouton dj-bouton--track", t("tactile.gyro.carte.autoriser"));
        bouton.type = "button";
        bouton.addEventListener("click", () => {
          retirerGeste();
          void demander(true); // le clic est le geste : `requestPermission` est appelé tout de suite, sans attendre
        });
        zoneCarte.replaceChildren(capteur === "ok" ? carte("ok", t("tactile.gyro.carte.ok"), t("tactile.gyro.carte.okPetit")) : capteur === "demande" ? carte("", t("tactile.gyro.carte.demande"), "") : carte("", t("tactile.gyro.carte.attente"), t("tactile.gyro.carte.attentePetit"), bouton));
      };
      majCarte();
      const essai = creerJauge(steerer, "gyro-jauge gyro-jauge--essai");
      if (essaiActuel && jauges.includes(essaiActuel)) jauges.splice(jauges.indexOf(essaiActuel), 1); // les réglages se redessinent : l'ancienne jauge d'essai n'est plus à l'écran
      essaiActuel = essai;
      jauges.push(essai);
      const sensibilite = slider(PLAGE_SENSIBILITE, () => pad.settings.gyroSensitivity, (v) => apply({ gyroSensitivity: v }), (v) => `×${fNombre(v, 2)}`, t("tactile.sensibilite.nom"));
      const aideSensibilite = el("div", "reglage__aide");
      const zoneMorte: Control = slider(PLAGE_ZONE_MORTE, () => pad.settings.gyroDeadzone, (v) => apply({ gyroDeadzone: v }), (v) => `${fNombre(Math.round(v * 100))} %`, t("tactile.zoneMorte.nom"));
      const jaugeCourse = segmented<boolean>([[true, t("reglages.oui")], [false, t("reglages.non")]], () => pad.settings.gyroGauge, (v) => apply({ gyroGauge: v }), t("tactile.gyro.jauge.reglage"));
      const recentrerMaintenant = el("button", "dj-bouton dj-bouton--secondaire", t("tactile.gyro.recentrer"));
      recentrerMaintenant.type = "button";
      recentrerMaintenant.addEventListener("click", () => {
        recentrerMaintenant.blur();
        window.setTimeout(() => steerer.calibrate(), GYRO_RECENTER_MS);
      });
      const filtre = el("span", "reglage__valeur", `≈ ${fNombre(GYRO_FILTER_MS)} ms`);
      const ligneSens = row(t("tactile.sensibilite.nom"), sensibilite.box);
      ligneSens.firstElementChild?.append(aideSensibilite);
      nodes.push(
        zoneCarte,
        row(t("tactile.gyro.essai.nom"), essai.racine, t("tactile.gyro.essai.aide")),
        ligneSens,
        row(t("tactile.zoneMorte.nom"), zoneMorte.box),
        row(t("tactile.gyro.filtre.nom"), filtre, t("tactile.gyro.filtre.aide")),
        row(t("tactile.gyro.jauge.reglage"), jaugeCourse.box),
        row(t("tactile.gyro.recentrer"), recentrerMaintenant, t("tactile.gyro.recentrer.aide")),
      );
      return {
        nodes,
        sync() {
          for (const c of [sensibilite, zoneMorte, jaugeCourse]) c.sync();
          aideSensibilite.textContent = t("tactile.gyro.sensibilite.aide", { deg: fNombre(Math.round(GYRO_FULL_LOCK_DEG / pad.settings.gyroSensitivity)) });
        },
      };
    },
  };
};
