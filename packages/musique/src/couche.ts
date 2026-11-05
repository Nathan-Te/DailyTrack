import type { ContexteAudio, GainAudio } from "./lecteur";
import { COUCHE_ECART_MAX_S, COUCHE_FONDU_S, COUCHE_LECTURES, arpegeDeMesure, debutMesure, ecartHorloge, etincelle, hzDeMidi, mesureSec, nappeTenue } from "./logique";
import type { PisteServie } from "./types";

// **La couche du jeu** (lot B6), chargée avec le lecteur (à la demande) : quand le jeu dit `couche(true)`, un **arpège** léger s'ajoute au morceau, synthétisé sur le contexte du lecteur, **calé sur la phase de la
// boucle** (l'horloge du flux, relue à chaque mesure) ; il repart en fondu à `couche(false)`. Elle passe par le bus du lecteur : volume, « couper », baisse du jeu s'appliquent d'eux-mêmes, et rien n'est synthétisé
// quand le niveau est à zéro ou la page cachée.
//
// **Quand le calage n'est pas tenable** : l'horloge du flux (`currentTime` d'un élément audio) avance par bonds sur certains appareils (mobiles). Le lecteur mesure, sur les dernières lectures, de combien « horloge
// du flux − horloge du contexte » varie ; au-dessus de `COUCHE_ECART_MAX_S` (20 ms), ou tant qu'il n'a pas assez de lectures, la couche est une **nappe sans pulsation** (deux sons tenus et des étincelles à des
// instants tirés au hasard), qui n'a besoin d'aucun calage. Le choix se refait à chaque tick.

export interface PourCouche {
  ctx: ContexteAudio;
  /** Le bus du lecteur : la couche s'y branche. */
  bus: GainAudio;
  piste(): PisteServie | null;
  /** L'horloge du flux de la voix qui joue : son numéro d'écoute et sa position (secondes du fichier), ou `null` si rien ne joue. */
  flux(): { genre: number; t: number } | null;
  /** On entendrait la couche : le niveau n'est pas nul, la page est visible, le contexte tourne. */
  audible(): boolean;
  hasard(): number;
  planifier(ms: number, fn: () => void): void;
}

/** Le pas de la boucle qui programme les notes, et son avance (secondes) : une mesure est programmée au plus 0,6 s avant son début. */
const PAS_MS = 125;
const AVANCE_S = 0.6;

export interface Couche {
  regler(actif: boolean): void;
  /** Une lecture de l'horloge du flux (à chaque `timeupdate` de la voix active) : `ecart` = flux − contexte. */
  lire(genre: number, ecart: number, t: number): void;
  /** Le calage est tenable : assez de lectures, et peu d'écart entre elles. */
  calee(): boolean;
}

export function creerCouche(p: PourCouche): Couche {
  const ctx = p.ctx;
  let actif = false;
  let tourne = false;
  let jeton = 0;
  let sortie: GainAudio | undefined;
  let genreVu = -1;
  let lectures: number[] = [];
  let prochaine: number | null = null;
  let prochaineEtincelle = 0;
  let tenue: { id: string; arret(): void } | null = null;

  const porte = (): GainAudio => {
    if (!sortie) {
      sortie = ctx.createGain();
      sortie.gain.value = 0;
      sortie.connect(p.bus);
    }
    return sortie;
  };

  function note(midi: number, t: number, duree: number, gain: number, onde: string): void {
    const o = ctx.createOscillator!();
    const g = ctx.createGain();
    o.type = onde;
    o.frequency.setValueAtTime(hzDeMidi(midi), t);
    g.gain.setValueAtTime(0, t);
    g.gain.setTargetAtTime(gain, t, 0.004);
    g.gain.setTargetAtTime(0, t + duree * 0.25, duree * 0.3);
    o.connect(g);
    g.connect(porte());
    o.start(t);
    o.stop(t + duree + 0.5);
  }

  /** L'arpège : les mesures à venir, chacune recalée sur le début de la mesure du morceau. */
  function arpege(piste: PisteServie, now: number, flux: { t: number }): void {
    const bpm = piste.bpm!;
    const m = mesureSec(bpm);
    if (prochaine === null || prochaine < now - 0.2) prochaine = now + 0.05;
    while (prochaine < now + AVANCE_S) {
      let debut = debutMesure(prochaine, flux.t, now, bpm);
      if (debut + m <= now) debut += m; // une mesure déjà finie : la suivante (une mesure en cours est jouée à partir de maintenant : les notes passées sont sautées)
      const mesure = Math.round((flux.t + (debut - now)) / m);
      for (const n of arpegeDeMesure(piste.tonique!, bpm, mesure)) if (debut + n.dt >= now) note(n.midi, debut + n.dt, n.duree, n.gain, "triangle");
      prochaine = debut + m;
    }
  }

  /** La nappe : deux sons tenus tant que la couche dure, des étincelles tirées au hasard (aucune grille, donc aucun calage). */
  function nappe(piste: PisteServie, now: number): void {
    if (tenue?.id !== piste.id) {
      arreterNappe();
      const g = ctx.createGain();
      g.gain.value = 0.022;
      g.connect(porte());
      const oscs = nappeTenue(piste.tonique!).map((midi) => {
        const o = ctx.createOscillator!();
        o.type = "sine";
        o.frequency.setValueAtTime(hzDeMidi(midi), now);
        o.connect(g);
        o.start(now);
        return o;
      });
      tenue = { id: piste.id, arret: () => oscs.forEach((o) => o.stop(ctx.currentTime + 0.2)) };
    }
    if (prochaineEtincelle < now) prochaineEtincelle = now + 0.3;
    while (prochaineEtincelle < now + AVANCE_S) {
      const e = etincelle(piste.tonique!, piste.gamme, p.hasard(), p.hasard());
      note(e.midi, prochaineEtincelle, 2.2, e.gain, "sine");
      prochaineEtincelle += e.attente;
    }
  }

  function arreterNappe(): void {
    tenue?.arret();
    tenue = null;
  }

  function pas(): void {
    tourne = false;
    if (!actif) return;
    const now = ctx.currentTime;
    const piste = p.piste();
    const flux = p.flux();
    if (p.audible() && flux && piste?.bpm && piste.tonique !== undefined) {
      if (calee()) {
        arreterNappe();
        arpege(piste, now, flux);
      } else {
        prochaine = null;
        nappe(piste, now);
      }
    }
    boucle();
  }
  function boucle(): void {
    if (tourne) return;
    tourne = true;
    p.planifier(PAS_MS, pas);
  }

  function calee(): boolean {
    return lectures.length >= COUCHE_LECTURES && ecartHorloge(lectures) <= COUCHE_ECART_MAX_S;
  }

  return {
    regler(a) {
      if (a === actif) return;
      actif = a;
      const j = ++jeton;
      const t = ctx.currentTime;
      const g = porte();
      g.gain.cancelScheduledValues(t);
      g.gain.setTargetAtTime(a ? 1 : 0, t, COUCHE_FONDU_S / 3);
      if (a) {
        prochaine = null;
        boucle();
      } else
        p.planifier(COUCHE_FONDU_S * 1000 + 100, () => {
          if (j === jeton) arreterNappe();
        });
    },
    lire(genre, ecart, t) {
      // Les premières secondes d'un flux (mise en mémoire, démarrage) ne disent rien de son horloge ; une autre écoute repart de zéro.
      if (genre !== genreVu) {
        genreVu = genre;
        lectures = [];
      }
      if (t < 1) return;
      lectures.push(ecart);
      if (lectures.length > COUCHE_LECTURES) lectures.shift();
    },
    calee,
  };
}
