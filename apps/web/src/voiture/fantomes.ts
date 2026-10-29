// Lot 51 — **la voiture des fantômes** : le fantôme d'un joueur (le premier, le joueur devant, ton record, ceux du Salon) a la voiture avec laquelle il a fini sa course, en
// version simple (retouche 40c : un maillage, ≈ 400 triangles, translucide, sans livrée, teinte unie, liseré) — le modèle compte, pas la peinture. Chaque modèle se charge
// **à la demande** (un `import()` de son plan, comme la voiture du Garage) et se garde en mémoire (`planDe`) : au Salon, dix voitures différentes ne chargent que dix plans, et
// les six fantômes d'une session ne dessinent que six maillages (comme avant : une voiture de plus ne coûte pas d'appel de rendu de plus). Une course d'avant le lot 51, ou une
// voiture illisible, n'a pas de voiture : la Sparrow en orange (la civile, déjà dans le premier chargement).
import type { Object3D } from "three";
import type { CarModel } from "../carMesh";
import { VOITURE_DEFAUT, ficheVoiture } from "./catalogue";
import { TEINTE_FANTOME } from "./enJeu";
import { construireFantome, type PlanVoiture } from "./modele";
import { PLAN_CIVILE } from "./modeleCivile";

/** Les plans déjà demandés (la promesse : deux fantômes de la même voiture n'en chargent qu'un). */
const plans = new Map<string, Promise<PlanVoiture>>();

/** Le plan d'une voiture, chargé une seule fois ; un chargement raté (hors ligne, morceau introuvable) retombe sur la civile, sans rien retenir. */
export function planDe(id: string): Promise<PlanVoiture> {
  if (id === VOITURE_DEFAUT) return Promise.resolve(PLAN_CIVILE);
  let p = plans.get(id);
  if (!p) {
    const fiche = ficheVoiture(id);
    p = (fiche ? fiche.charger() : Promise.resolve(PLAN_CIVILE)).catch(() => {
      plans.delete(id);
      return PLAN_CIVILE;
    });
    plans.set(id, p);
  }
  return p;
}

/** Le fantôme simple de cette voiture, à cette teinte (le bleu froid de ton record, la couleur d'une place du Salon). */
export async function fantomeDe(id: string, teinte: number): Promise<CarModel & { triangles: number }> {
  return construireFantome(await planDe(id), teinte);
}

/** Libère un fantôme (géométries et matériaux) que la scène n'utilise plus. */
export function libererFantome(m: CarModel): void {
  m.group.traverse((o) => {
    const x = o as { geometry?: { dispose(): void }; material?: { dispose(): void } };
    x.geometry?.dispose();
    x.material?.dispose();
  });
}

/** Ce que le jeu prête pour poser un fantôme (`main.ts`) : la scène du moment, le fantôme montré, le fantôme par défaut (la civile, déjà là), le modèle voulu et la façon d'adopter le nouveau. */
export interface HoteFantome {
  scene(): Object3D;
  modele(): CarModel;
  defaut: CarModel;
  voulu(): string;
  poser(m: CarModel, id: string): void;
}

/** Pose le fantôme de cette voiture (position, orientation et visibilité repris) à la place du fantôme montré — sauf si, le temps du chargement, un autre modèle a été voulu. */
export async function poserFantome(h: HoteFantome, id: string): Promise<void> {
  const m = id === VOITURE_DEFAUT ? h.defaut : await fantomeDe(id, TEINTE_FANTOME);
  if (h.voulu() !== id) return void (m !== h.defaut && libererFantome(m));
  const ancien = h.modele();
  m.group.position.copy(ancien.group.position);
  m.group.rotation.copy(ancien.group.rotation);
  m.group.visible = ancien.group.visible;
  h.scene().remove(ancien.group);
  h.scene().add(m.group);
  if (ancien !== h.defaut) libererFantome(ancien);
  h.poser(m, id);
}
