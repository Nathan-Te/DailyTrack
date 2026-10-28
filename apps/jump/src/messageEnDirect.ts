import { surveillerAnnonce, texteDeAnnonce, type Annonce, type Surveillance } from "@cdj/profile";
import { bandeauAnnonce, visibiliteDeLaPage, type TraducteurCommun } from "@cdj/ui";
import { commanderSurveillance, type EcranMessage } from "./messageEnDirectLogic";
import { langueCourante, onLangue, traducteurDuSocle } from "./i18n";

// Lot N2 de la plateforme — le **message en direct** de Jump, le DOM (la décision est dans `messageEnDirectLogic.ts`, la surveillance dans `@cdj/profile`, le bandeau dans
// `@cdj/ui`). Un seul bandeau, posé dans l'emplacement de l'écran du moment (accueil, arrivée ou pause : chacun a son `hoteMessage`) ; **aux couleurs de Jump**
// (`ecrans.css`, `.message-direct__bandeau` : jaune de l'étiquette, encre ; « Important » inversé). Il ne prend **jamais le focus** (`role="status"`, aucun `.focus()`) : les
// dialogues de l'accueil, de la pause et de l'arrivée gardent le leur. Le texte est une donnée : `textContent` (le bandeau du socle le fait), jamais du HTML.
// Hors des trois écrans, `montrer(null)` : le bandeau est retiré et la surveillance suspendue (plus de minuterie, plus d'écoute, plus de réseau).

export type Hotes = Record<EcranMessage, HTMLElement>;

export interface OptionsMessageEnDirect {
  /** L'adresse de l'API (celle du classement, jamais `demo`). */
  base: string;
  /** Le stockage du jeu : le message fermé s'y retient (`cdj:annonce:fermee`, un réglage gardé). */
  stockage: Pick<Storage, "getItem" | "setItem"> | null;
  hotes: Hotes;
}

export interface MessageEnDirect {
  /** L'écran du moment (`null` : une partie, un carnage… : plus rien ne s'affiche ni ne se lit). */
  montrer(ecran: EcranMessage | null): void;
  /** Pour `?debug` et les mesures : l'écran, le message affichable, ce qui est dessiné, le nombre de lectures du réseau. */
  etat(): { ecran: EcranMessage | null; id: number | null; ton: string | null; dessine: boolean; lectures: number };
}

/** Le traducteur du socle, relu à chaque appel : le bandeau garde ses libellés (« Important », « Fermer ») dans la langue courante. */
const traducteurVivant = (): TraducteurCommun => ({ get langue() { return traducteurDuSocle().langue; }, t: (cle: never, params?: never) => traducteurDuSocle().t(cle, params) }) as unknown as TraducteurCommun;

export function monterMessageEnDirect(o: OptionsMessageEnDirect): MessageEnDirect {
  let ecran: EcranMessage | null = null;
  let annonce: Annonce | null = null;
  let bandeau: HTMLElement | null = null;
  let dessine: { id: number; ton: Annonce["ton"] } | null = null;

  const retirer = () => {
    bandeau?.remove();
    bandeau = null;
    dessine = null;
  };
  const texte = (a: Annonce) => texteDeAnnonce(a, langueCourante());

  const rendre = () => {
    if (ecran === null || annonce === null) return retirer();
    // Le même message reste le même bandeau (la croix de « Important » n'attend pas 10 s de plus à chaque écran) : on le déplace seulement.
    if (!bandeau || dessine?.id !== annonce.id || dessine.ton !== annonce.ton) {
      retirer();
      bandeau = bandeauAnnonce(traducteurVivant(), { texte: texte(annonce), ton: annonce.ton, classe: "message-direct__bandeau", onFermer: () => surveillance.fermer() });
      dessine = { id: annonce.id, ton: annonce.ton };
    }
    const hote = o.hotes[ecran];
    if (bandeau.parentElement !== hote) hote.append(bandeau);
  };

  const surveillance: Surveillance = surveillerAnnonce({
    base: o.base,
    ou: "jump",
    stockage: o.stockage,
    surChangement: (a) => {
      annonce = a;
      rendre();
    },
    ...visibiliteDeLaPage(),
  });

  // Une autre langue : le texte du message change sur place (le bandeau n'est pas refait) et ses libellés se relisent.
  onLangue(() => {
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
