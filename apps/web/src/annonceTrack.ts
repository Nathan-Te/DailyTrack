import type { Annonce, Surveillance } from "@cdj/profile";
import type { EcranAnnonce } from "./annonceEcran";

// Lot N2 — le pilote du message en direct de Track : **quels écrans activent et suspendent la surveillance**. Pur (aucun DOM, aucun réseau : la surveillance et la pose du
// bandeau sont injectées), testé dans `test/annonce.test.ts` avec la vraie surveillance de `@cdj/profile`. Le DOM est dans `annonceUi.ts`.
//   - un écran où le bandeau a le droit d'être (accueil, arrivée, pause) : `activer()` — il montre ce qu'on savait, relit tout de suite, puis toutes les 60 s tant que la page est visible ;
//   - tout autre état (course, décompte, réglages, Garage, archives, Salon…) : `suspendre()` — plus de bandeau, de minuterie, d'écoute ni de lecture du réseau ; une réponse en vol est ignorée.

export type SurveillanceAnnonce = Pick<Surveillance, "activer" | "suspendre" | "courant" | "fermer">;

export interface DepsPilote {
  /** Crée la surveillance (`surveillerAnnonce({ …, surChangement })` de `@cdj/profile`). */
  surveiller(surChangement: (a: Annonce | null) => void): SurveillanceAnnonce;
  /** Pose (ou retire, si `ecran` ou `a` est `null`) le bandeau sur cet écran. Idempotent : rappelée avec le même message sur le même écran, elle ne refait rien. `fermer` : le joueur ferme le bandeau. */
  poser(ecran: EcranAnnonce | null, a: Annonce | null, fermer: () => void): void;
}

export interface PiloteAnnonce {
  /** L'écran où l'on est maintenant (`ecranAnnonce` de `annonceEcran.ts`), appelée à chaque changement ; `null` : une course ou un autre écran. */
  ecran(e: EcranAnnonce | null): void;
  /** La langue a changé : le texte du bandeau suit. */
  actualiser(): void;
}

export function creerPilote(d: DepsPilote): PiloteAnnonce {
  let courant: EcranAnnonce | null = null;
  const fermer = () => s.fermer();
  const s = d.surveiller((a) => {
    if (courant) d.poser(courant, a, fermer);
  });
  return {
    ecran(e) {
      if (e === courant) return;
      courant = e;
      if (e === null) {
        s.suspendre();
        d.poser(null, null, fermer);
        return;
      }
      s.activer(); // sans effet si déjà actif (accueil → pause sans course entre les deux)
      d.poser(e, s.courant(), fermer); // le bandeau passe d'un écran à l'autre
    },
    actualiser() {
      if (courant) d.poser(courant, s.courant(), fermer);
    },
  };
}
