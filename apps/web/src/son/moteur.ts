// Lot 55 (partie B) — ce que partagent les moteurs du son (synthèse, échantillons rendus hors ligne) : l'entrée, le contrat, un bruit blanc
// semé. Module à la demande. Le son ne lit que l'état de la voiture : un moteur ne peut rien changer à une course.
import type { EtatBoite } from "./boite";

/** Ce qu'un moteur reçoit à chaque image : l'état de la boîte virtuelle, plus la vitesse et le gaz bruts (pour le son d'avant, qui n'a pas de boîte). */
export interface EntreeMoteur extends Pick<EtatBoite, "rpm" | "charge" | "passage" | "sens" | "rapport"> {
  vitesse: number;
  gaz: number;
  enAir: boolean;
  /** Le jeu est au silence (pause, arrivée, fenêtre ouverte, hors course) : le moteur se tait, puis ses boucles s'arrêtent. */
  silence?: boolean;
  /** Instant (s) où régler les paramètres : par défaut l'horloge du contexte ; un rendu hors ligne donne le sien. */
  t?: number;
}

export interface Moteur {
  readonly nom: string;
  /** Nombre de nœuds Web Audio créés (coût mesuré sur la planche). */
  readonly noeuds: number;
  /** Boucles qui jouent en ce moment (moteurs à échantillons). */
  readonly sources?: number;
  /** À appeler à chaque image. */
  maj(e: EntreeMoteur): void;
  /** Une pétarade à l'échappement (lever de pied à haut régime), pour les moteurs qui en ont. */
  petarade(): void;
  /** Arrête tout et détache les nœuds (aucune fuite au redémarrage ni au changement de mode). */
  arreter(): void;
}

/**
 * Un compteur de nœuds : tout nœud **permanent** d'un moteur passe par `nd` (compté, détaché à l'arrêt) ; tout nœud **bref** (une pétarade, un turbo, une réception)
 * passe par `bref` : il se détache seul à la fin de sa source et ne s'accumule jamais (un son qui dure une heure ne garde pas des milliers de nœuds morts).
 */
export class Compteur {
  n = 0;
  readonly tous: AudioNode[] = [];
  readonly sources: AudioScheduledSourceNode[] = [];
  private readonly breves = new Set<AudioNode>();
  nd<T extends AudioNode>(noeud: T): T {
    this.n++;
    this.tous.push(noeud);
    if ("start" in noeud && typeof (noeud as unknown as AudioScheduledSourceNode).stop === "function") this.sources.push(noeud as unknown as AudioScheduledSourceNode);
    return noeud;
  }
  /** Une source brève et les nœuds qui la suivent : détachés quand elle finit. */
  bref<T extends AudioScheduledSourceNode>(source: T, ...lies: AudioNode[]): T {
    const groupe: AudioNode[] = [source, ...lies];
    for (const n of groupe) this.breves.add(n);
    source.addEventListener(
      "ended",
      () => {
        for (const n of groupe) {
          n.disconnect();
          this.breves.delete(n);
        }
      },
      { once: true },
    );
    return source;
  }
  /** Nœuds brefs encore vivants (outil de test). */
  get brefsVivants(): number {
    return this.breves.size;
  }
  /** Arrête les sources, détache tous les nœuds, les brefs aussi. */
  tout(): void {
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {
        /* déjà arrêtée ou jamais démarrée */
      }
    }
    for (const n of this.tous) n.disconnect();
    for (const n of this.breves) {
      try {
        (n as Partial<AudioScheduledSourceNode>).stop?.();
      } catch {
        /* pas encore démarrée */
      }
      n.disconnect();
    }
    this.tous.length = 0;
    this.sources.length = 0;
    this.breves.clear();
  }
}

/** Un bruit blanc semé de 2 s (le même à chaque fois : un rendu hors ligne se compare), lu en boucle. */
export function bruitBlanc(ctx: BaseAudioContext, graine = 20261030): AudioBuffer {
  const b = ctx.createBuffer(1, Math.round(ctx.sampleRate * 2), ctx.sampleRate);
  const d = b.getChannelData(0);
  let s = graine >>> 0;
  for (let i = 0; i < d.length; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    d[i] = (s / 0x80000000) - 1;
  }
  return b;
}

export const lerp = (a: number, b: number, x: number): number => a + (b - a) * (x < 0 ? 0 : x > 1 ? 1 : x);
