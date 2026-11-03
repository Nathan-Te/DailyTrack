import { type Annonce, surveillerAnnonce, texteDeAnnonce, type Surveillance, type OuAnnonce } from "@cdj/profile";
import { bandeauAnnonce, type Langue, type TraducteurCommun, visibiliteDeLaPage } from "@cdj/ui";

// Le message en direct côté jeu (lot K3 ; avant : `messageEnDirect.ts` de Jump et `messageDirect.ts` de Tower). Le composant est celui de la plateforme (`bandeauAnnonce` de `@cdj/ui`, la surveillance
// de `@cdj/profile`) ; ce module pose le bandeau dans l'emplacement de l'écran du moment, **sans jamais prendre le focus** (`role="status"`), texte en `textContent`. Hors des écrans qui ont un emplacement,
// `montrer(null)` : le bandeau est retiré et la surveillance suspendue (plus de minuterie, plus d'écoute, plus de réseau). Quels écrans, et à quel moment : c'est au jeu (`ecranDuMessage` de Jump).

/** Les écrans où un bandeau a le droit d'être. */
export type EcranMessage = "accueil" | "arrivee" | "pause";

export interface OptionsMessage {
  /** La destination du message (la fiche : `messageOu`). */
  ou: OuAnnonce;
  /** L'adresse de l'API (celle du classement, jamais `demo`). */
  base: string;
  /** Le stockage du jeu : le message fermé s'y retient (`cdj:annonce:fermee`, un réglage gardé). */
  stockage: Pick<Storage, "getItem" | "setItem"> | null;
  /** L'emplacement de chaque écran ; un écran sans emplacement n'affiche rien. */
  hotes: Partial<Record<EcranMessage, HTMLElement>>;
  /** La langue courante du jeu (relue à chaque dessin). */
  langue(): Langue;
  /** Le traducteur du socle du jeu, relu à chaque appel : le bandeau garde ses libellés (« Important », « Fermer ») dans la langue courante. */
  traducteur(): { langue: Langue; t(cle: never, params?: never): string };
  /** Abonnement au changement de langue : le texte du message change sur place (le bandeau n'est pas refait). Facultatif. */
  surLangue?(rappel: () => void): void;
  /** La classe du bandeau, que la feuille du jeu habille (`message-direct__bandeau`). */
  classe?: string;
}

export interface MessageEnDirect {
  /** L'écran du moment (`null` : une partie, un carnage… : plus rien ne s'affiche ni ne se lit). */
  montrer(ecran: EcranMessage | null): void;
  /** Pour `?debug` et les mesures : l'écran, le message affichable, ce qui est dessiné, le nombre de lectures du réseau. */
  etat(): { ecran: EcranMessage | null; id: number | null; ton: string | null; dessine: boolean; lectures: number };
}

/** Ce que la surveillance de `@cdj/profile` offre ici : la mettre en marche ou l'arrêter. */
export interface SurveillanceCommandable {
  activer(): void;
  suspendre(): void;
}

/**
 * Fait suivre la surveillance à l'écran du moment : un écran du bandeau → `activer()` (une seule fois tant qu'on reste sur l'un des trois) ; plus d'écran → `suspendre()` **tout de suite**
 * (minuterie, écoute et réseau arrêtés). Même écran deux fois de suite : rien.
 */
export function commanderSurveillance(s: SurveillanceCommandable): (ecran: EcranMessage | null) => void {
  let courant: EcranMessage | null = null;
  return (ecran) => {
    if (ecran === courant) return;
    const avant = courant;
    courant = ecran;
    if (ecran === null) s.suspendre();
    else if (avant === null) s.activer();
  };
}

/**
 * L'adresse de l'API que le bandeau lit, ou `null` : **pas de serveur** (aucune adresse), **démonstration** (`?api=demo`) — alors aucun bandeau, aucune lecture, rien ne casse.
 */
export function baseDuMessage(apiBase: string | null): string | null {
  if (apiBase === null || apiBase === "" || apiBase === "demo") return null;
  return apiBase;
}

export function monterMessageEnDirect(o: OptionsMessage): MessageEnDirect {
  let ecran: EcranMessage | null = null;
  let annonce: Annonce | null = null;
  let bandeau: HTMLElement | null = null;
  let dessine: { id: number; ton: Annonce["ton"] } | null = null;
  const traducteurVivant = (): TraducteurCommun =>
    ({ get langue() { return o.traducteur().langue; }, t: (cle: never, params?: never) => o.traducteur().t(cle, params) }) as unknown as TraducteurCommun;
  const texte = (a: Annonce) => texteDeAnnonce(a, o.langue());

  const retirer = () => {
    bandeau?.remove();
    bandeau = null;
    dessine = null;
  };

  const rendre = () => {
    if (ecran === null || annonce === null) return retirer();
    // Le même message reste le même bandeau (la croix de « Important » n'attend pas 10 s de plus à chaque écran) : on le déplace seulement.
    if (!bandeau || dessine?.id !== annonce.id || dessine.ton !== annonce.ton) {
      retirer();
      bandeau = bandeauAnnonce(traducteurVivant(), { texte: texte(annonce), ton: annonce.ton, classe: o.classe ?? "message-direct__bandeau", onFermer: () => surveillance.fermer() });
      dessine = { id: annonce.id, ton: annonce.ton };
    }
    const hote = o.hotes[ecran];
    if (!hote) return retirer();
    if (bandeau.parentElement !== hote) hote.append(bandeau);
  };

  const surveillance: Surveillance = surveillerAnnonce({
    base: o.base,
    ou: o.ou,
    stockage: o.stockage,
    surChangement: (a) => {
      annonce = a;
      rendre();
    },
    ...visibiliteDeLaPage(),
  });

  o.surLangue?.(() => {
    if (!bandeau || !annonce) return;
    const p = bandeau.querySelector(".dj-bandeau__texte");
    if (p) p.textContent = texte(annonce);
    bandeau.dispatchEvent(new Event("maj"));
  });

  const commander = commanderSurveillance(surveillance);

  return {
    montrer(suivant) {
      if (suivant === ecran) return;
      ecran = suivant;
      commander(suivant); // `null` d'abord : plus de réseau ni de minuterie, avant même de retirer le bandeau
      rendre(); // un écran du bandeau : l'emplacement change ; aucun : le bandeau est retiré
    },
    etat: () => ({ ecran, id: annonce?.id ?? null, ton: annonce?.ton ?? null, dessine: bandeau?.isConnected ?? false, lectures: surveillance.lectures() }),
  };
}
