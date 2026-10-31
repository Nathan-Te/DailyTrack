// Lot 55 (partie B) — approche B : échantillons **rendus hors ligne** par `outils/son/rendre-echantillons.mjs`, un jeu de boucles par voiture. Le lecteur : une échelle de boucles à des régimes de référence, jouées en boucle sans fin, **fondues de l'une à l'autre**
// selon le régime (puissance égale), et dont la vitesse de lecture suit le rapport régime ÷ régime de référence ; un filtre passe-bas ferme le son quand on
// lève le pied ; la coupure de couple d'un passage de rapport baisse le niveau un instant. Les boucles se chargent à la demande, celles de la voiture seulement.
import { regimeNormal } from "./boite";
import type { ProfilMoteur } from "./profils";
import { Compteur, lerp, type EntreeMoteur, type Moteur } from "./moteur";

/** Une boucle décodée : son régime de référence, et la fenêtre qui boucle sans raccord (au milieu du fichier : le codeur ajoute un peu de silence au début). */
export interface Boucle {
  buffer: AudioBuffer;
  rpm: number;
  debut: number;
  fin: number;
}

/** Les poids de fondu entre les deux boucles voisines du régime `rpm` (puissance égale), les autres à 0. */
export function poidsFondu(refs: readonly number[], rpm: number): number[] {
  const w = refs.map(() => 0);
  if (refs.length === 0) return w;
  if (rpm <= refs[0]!) {
    w[0] = 1;
    return w;
  }
  if (rpm >= refs[refs.length - 1]!) {
    w[refs.length - 1] = 1;
    return w;
  }
  let i = 0;
  while (rpm >= refs[i + 1]!) i++;
  // Interpolation sur le logarithme du régime : les boucles sont en progression géométrique, l'oreille juge en rapports.
  const x = Math.log(rpm / refs[i]!) / Math.log(refs[i + 1]! / refs[i]!);
  w[i] = Math.cos((x * Math.PI) / 2);
  w[i + 1] = Math.sin((x * Math.PI) / 2);
  return w;
}

/** La vitesse de lecture d'une boucle jouée au régime `rpm` : bornée (au-delà, le timbre devient méconnaissable ; les boucles voisines sont à moins de 1,35 fois l'une de l'autre). */
export const vitesseLecture = (rpm: number, ref: number): number => Math.min(1.45, Math.max(0.7, rpm / ref));

/** Options d'un lecteur : `leger` = la version de l'appareil modeste (une seule boucle à la fois, sans fondu long ni creux d'aigu) ; `silenceApres` = secondes de silence avant d'arrêter une boucle. */
export interface OptionsLecteur {
  leger?: boolean;
  silenceApres?: number;
}

export function creerEchantillons(ctx: BaseAudioContext, sortie: AudioNode, p: ProfilMoteur, boucles: readonly Boucle[], nom: string, etalon: number, options: OptionsLecteur = {}): Moteur {
  const c = new Compteur();
  const leger = options.leger === true;
  const silenceApres = options.silenceApres ?? 0.4;
  const refs = boucles.map((b) => b.rpm);
  const sortieMoteur = c.nd(ctx.createGain());
  sortieMoteur.gain.value = p.niveau * etalon;
  sortieMoteur.connect(sortie);
  const lp = c.nd(ctx.createBiquadFilter());
  lp.type = "lowpass";
  lp.Q.value = 0.7;
  const amp = c.nd(ctx.createGain());
  amp.gain.value = 0;
  if (leger) lp.connect(amp).connect(sortieMoteur);
  else {
    // Un creux léger dans l'aigu (retouche après écoute : « un peu trop aigu parfois »).
    const doux = c.nd(ctx.createBiquadFilter());
    doux.type = "highshelf";
    doux.frequency.value = 2800;
    doux.gain.value = -4;
    lp.connect(doux).connect(amp).connect(sortieMoteur);
  }
  // Une voix = un gain permanent et, **seulement quand la boucle s'entend**, une source : au silence (pause, arrivée, boucle trop éloignée du régime) rien ne tourne.
  const voix = boucles.map((b) => {
    const g = c.nd(ctx.createGain());
    g.gain.value = 0;
    g.connect(lp);
    return { b, g, s: null as AudioBufferSourceNode | null, muetDepuis: 0 };
  });
  let actives = 0;
  const allumer = (i: number, t: number) => {
    const v = voix[i]!;
    if (v.s) return;
    const s = c.bref(ctx.createBufferSource());
    s.buffer = v.b.buffer;
    s.loop = true;
    s.loopStart = v.b.debut;
    s.loopEnd = v.b.fin;
    s.connect(v.g);
    s.start(t, v.b.debut + ((i * 0.137) % 1) * (v.b.fin - v.b.debut));
    v.s = s;
    actives++;
  };
  const eteindre = (i: number, t: number) => {
    const v = voix[i]!;
    if (!v.s) return;
    try {
      v.s.stop(t);
    } catch {
      /* déjà arrêtée */
    }
    v.s = null;
    actives--;
  };
  return {
    nom,
    get noeuds() {
      return c.n;
    },
    /** Boucles qui jouent en ce moment (outil de test et de mesure). */
    get sources() {
      return actives;
    },
    maj(e: EntreeMoteur) {
      const now = e.t ?? ctx.currentTime;
      const k = leger ? 0.06 : 0.025;
      let w = poidsFondu(refs, e.rpm);
      if (leger) {
        // Appareil modeste : la seule boucle la plus proche du régime (pas de fondu entre deux, une source de moins).
        const plus = w.indexOf(Math.max(...w));
        w = w.map((_, i) => (i === plus ? 1 : 0));
      }
      // Au silence du jeu (pause, arrivée, fenêtre ouverte), toutes les boucles s'éteignent après `silenceApres` secondes.
      voix.forEach((v, i) => {
        const poids = e.silence ? 0 : w[i]!;
        if (poids > 0.001) {
          allumer(i, now);
          v.muetDepuis = 0;
          v.s!.playbackRate.setTargetAtTime(vitesseLecture(e.rpm, refs[i]!), now, k);
        } else if (v.s) {
          if (v.muetDepuis === 0) v.muetDepuis = now;
          else if (now - v.muetDepuis > silenceApres) eteindre(i, now + 0.02);
        }
        v.g.gain.setTargetAtTime(poids, now, k);
      });
      const rn = regimeNormal(p, e.rpm);
      lp.frequency.setTargetAtTime(lerp(p.timbre.coupure[0] * 1.1, p.timbre.coupure[1] * 1.1, rn) * (0.3 + 0.7 * e.charge), now, k);
      amp.gain.setTargetAtTime((0.14 + 0.7 * e.charge) * (0.55 + 0.45 * rn) * (e.enAir ? 0.85 : 1) * (e.silence ? 0 : 1), now, k);
    },
    petarade() {
      /* les boucles n'ont pas de pétarade : elle vient de la couche des bruitages */
    },
    arreter() {
      for (let i = 0; i < voix.length; i++) voix[i]!.s = null;
      actives = 0;
      c.tout();
    },
  };
}

/** Une boucle à charger : son adresse, son régime de référence, la fenêtre qui boucle (secondes) — ou une `marge` retirée de chaque bord du fichier entier. */
export interface EntreeBoucle {
  url: string;
  rpm: number;
  debut?: number;
  fin?: number;
  marge?: number;
}

/** Charge et décode les boucles. Rend aussi leur poids (octets du fichier), le temps de décodage et la mémoire des échantillons décodés (flottants 32 bits). */
export async function chargerBoucles(ctx: BaseAudioContext, entrees: readonly EntreeBoucle[]): Promise<{ boucles: Boucle[]; octets: number; decodageMs: number; memoire: number }> {
  const t0 = performance.now();
  const lues = await Promise.all(
    entrees.map(async (e) => {
      const r = await fetch(e.url);
      if (!r.ok) throw new Error(`${e.url} : ${r.status}`);
      const brut = await r.arrayBuffer();
      const octets = brut.byteLength;
      let buffer = await ctx.decodeAudioData(brut);
      let debut = e.debut ?? (e.marge ?? 0);
      let fin = e.fin ?? buffer.duration - (e.marge ?? 0);
      if (e.debut !== undefined && e.fin !== undefined) {
        // Le fichier porte trois copies de la période (le codeur ajoute un peu de silence aux bords) : on ne garde en mémoire que la fenêtre qui boucle.
        const i0 = Math.round(debut * buffer.sampleRate);
        const i1 = Math.min(buffer.length, Math.round(fin * buffer.sampleRate));
        const coupe = ctx.createBuffer(buffer.numberOfChannels, i1 - i0, buffer.sampleRate);
        for (let c = 0; c < buffer.numberOfChannels; c++) coupe.copyToChannel(buffer.getChannelData(c).subarray(i0, i1), c);
        buffer = coupe;
        debut = 0;
        fin = buffer.duration;
      }
      const boucle: Boucle = { buffer, rpm: e.rpm, debut, fin: Math.min(fin, buffer.duration) };
      return { boucle, octets };
    }),
  );
  return {
    boucles: lues.map((l) => l.boucle),
    octets: lues.reduce((n, l) => n + l.octets, 0),
    decodageMs: performance.now() - t0,
    memoire: lues.reduce((n, l) => n + l.boucle.buffer.length * l.boucle.buffer.numberOfChannels * 4, 0),
  };
}
