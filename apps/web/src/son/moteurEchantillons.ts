// Lot 55 (partie B) — approches B (échantillons **rendus hors ligne** par `outils/son/rendre-echantillons.mjs`, un jeu de boucles par voiture) et C (enregistrements
// libres de droits, CC0). Même lecteur pour les deux : une échelle de boucles à des régimes de référence, jouées en boucle sans fin, **fondues de l'une à l'autre**
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
  const x = (rpm - refs[i]!) / (refs[i + 1]! - refs[i]!);
  w[i] = Math.cos((x * Math.PI) / 2);
  w[i + 1] = Math.sin((x * Math.PI) / 2);
  return w;
}

/** La vitesse de lecture d'une boucle jouée au régime `rpm` : bornée (au-delà, le timbre devient méconnaissable). */
export const vitesseLecture = (rpm: number, ref: number): number => Math.min(2.6, Math.max(0.4, rpm / ref));

export function creerEchantillons(ctx: BaseAudioContext, sortie: AudioNode, p: ProfilMoteur, boucles: readonly Boucle[], nom: string, etalon: number): Moteur {
  const c = new Compteur();
  const refs = boucles.map((b) => b.rpm);
  const sortieMoteur = c.nd(ctx.createGain());
  sortieMoteur.gain.value = p.niveau * etalon;
  sortieMoteur.connect(sortie);
  const lp = c.nd(ctx.createBiquadFilter());
  lp.type = "lowpass";
  lp.Q.value = 0.7;
  const amp = c.nd(ctx.createGain());
  amp.gain.value = 0;
  lp.connect(amp).connect(sortieMoteur);
  const voix = boucles.map((b) => {
    const s = c.nd(ctx.createBufferSource());
    s.buffer = b.buffer;
    s.loop = true;
    s.loopStart = b.debut;
    s.loopEnd = b.fin;
    const g = c.nd(ctx.createGain());
    g.gain.value = 0;
    s.connect(g).connect(lp);
    s.start(0, b.debut);
    return { s, g };
  });
  return {
    nom,
    get noeuds() {
      return c.n;
    },
    maj(e: EntreeMoteur) {
      const now = e.t ?? ctx.currentTime;
      const k = 0.025;
      const w = poidsFondu(refs, e.rpm);
      voix.forEach((v, i) => {
        v.g.gain.setTargetAtTime(w[i]!, now, k);
        if (w[i]! > 0.001) v.s.playbackRate.setTargetAtTime(vitesseLecture(e.rpm, refs[i]!), now, k);
      });
      const rn = regimeNormal(p, e.rpm);
      lp.frequency.setTargetAtTime(lerp(p.timbre.coupure[0] * 1.6, p.timbre.coupure[1] * 1.6, rn) * (0.3 + 0.7 * e.charge), now, k);
      amp.gain.setTargetAtTime((0.14 + 0.7 * e.charge) * (0.55 + 0.45 * rn) * (e.enAir ? 0.85 : 1), now, k);
    },
    petarade() {
      /* les boucles n'ont pas de pétarade : elle viendrait de la couche d'effets */
    },
    arreter() {
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
