import { messageALaDemande } from "@cdj/kit/branche";
import type { EcranMessage, MessageEnDirect } from "@cdj/kit/message";
import type { OuAnnonce } from "@cdj/profile";
import { el } from "@cdj/ui";
import { langueCourante, traducteurDuSocle } from "./i18n";

// Le message en direct de Tower (lot T4) : sur l'accueil et sur l'arrivée — jamais pendant une partie (lot T7 : et sur la pause). Aux couleurs de Tower (`accueil.css`, `.message-direct__bandeau`). Il ne
// prend **jamais le focus** (`role="status"`). Le texte est une donnée : `textContent`, jamais du HTML. Lot TP : Tower a sa destination propre, `tower` (`OuAnnonce` de `@cdj/profile`, la table `annonces`, la case
// « Tower » du panneau d'administration). **Lot K3 : le bandeau, sa surveillance et son placement sont ceux de `@cdj/kit/message`, chargés à la demande** (`messageALaDemande`) : au premier écran qui peut
// l'afficher, jamais dans le premier chargement de l'accueil.
export const OU_TOWER: OuAnnonce = "tower";

export type { EcranMessage };
export type MessageDirect = MessageEnDirect;

/** `base` : l'adresse de l'API ; `hotes` : l'emplacement de chaque écran (vide, il n'occupe aucune place). */
export const monterMessage = (o: { base: string; stockage: Pick<Storage, "getItem" | "setItem"> | null; hotes: { accueil: HTMLElement; arrivee: HTMLElement; pause?: HTMLElement } }): MessageDirect =>
  messageALaDemande(() => import("@cdj/kit/message").then((m) => m.monterMessageEnDirect({ ...o, ou: OU_TOWER, langue: langueCourante, traducteur: traducteurDuSocle })));

/** Un emplacement vide pour le bandeau (aucune place tant qu'il n'y a rien). */
export const hoteMessage = (): HTMLElement => el("div", { classe: "message-direct" });
