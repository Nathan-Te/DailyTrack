import { messageALaDemande } from "@cdj/kit/branche";
import type { EcranMessage, MessageEnDirect } from "@cdj/kit/message";
import { langueCourante, onLangue, traducteurDuSocle } from "./i18n";

// Lot N2 de la plateforme — le **message en direct** de Jump. **Lot K3 : le bandeau, sa surveillance et son placement sont ceux de `@cdj/kit/message`** (communs aux trois jeux), **chargés à la demande** :
// au premier écran qui a le droit de l'afficher (`messageALaDemande`), jamais dans le premier chargement. Ce module lie ce que le kit demande à ce que Jump a : sa destination (`jump`), sa langue et son
// traducteur. La décision (quel écran) est dans `messageEnDirectLogic.ts`. **Aux couleurs de Jump** (`ecrans.css`, `.message-direct__bandeau`). Il ne prend **jamais le focus** (`role="status"`).

export type { MessageEnDirect };
export type Hotes = Record<EcranMessage, HTMLElement>;

export interface OptionsMessageEnDirect {
  /** L'adresse de l'API (celle du classement, jamais `demo`). */
  base: string;
  /** Le stockage du jeu : le message fermé s'y retient (`cdj:annonce:fermee`, un réglage gardé). */
  stockage: Pick<Storage, "getItem" | "setItem"> | null;
  hotes: Hotes;
}

export const monterMessageEnDirect = (o: OptionsMessageEnDirect): MessageEnDirect =>
  messageALaDemande(() => import("@cdj/kit/message").then((m) => m.monterMessageEnDirect({ ...o, ou: "jump", langue: langueCourante, traducteur: traducteurDuSocle, surLangue: onLangue })));
