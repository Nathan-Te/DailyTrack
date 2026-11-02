import {
  NAME_KEY,
  invitationRangee,
  isValidName,
  noteIdentityChange,
  normalizeName,
  oublierInvitation,
  rangerInvitation,
  writeIdentity,
  type ApiResult,
  type Ami,
  type ListableStore,
} from "@cdj/profile";

// Lot F2 : la logique pure de la page « Mes amis » (`/amis/`) — l'état d'une invitation, quand on l'oublie, le pseudo qu'on écrit sur l'appareil. Sans DOM ni réseau, testée dans `test/amisDonnees.test.ts`.

/** Où en est l'invitation de l'adresse : lue (`lecture`), lisible (`ok`, avec le pseudo de qui invite ; `acceptee` une fois l'amitié faite), refusée pour de bon (`invalide`) ou impossible à lire pour l'instant (`erreur`). */
export type EtatInvitation =
  | { etat: "lecture"; jeton: string }
  | { etat: "invalide"; code: string }
  | { etat: "erreur"; code: string }
  | { etat: "ok"; jeton: string; pseudo: string; acceptee: boolean };

/** Les refus qui ne changeront pas en réessayant : le lien est inconnu ou renouvelé, vous êtes déjà amis, c'est ton propre lien. Le jeton rangé dans l'onglet est alors oublié. */
const REFUS_DEFINITIFS: readonly string[] = ["invalid_invitation", "friend_exists", "friend_self"];
export const oublieLInvitation = (code: string): boolean => REFUS_DEFINITIFS.includes(code);

/** L'état d'une invitation que le serveur n'a pas pu lire : un lien invalide ou révoqué est définitif (`invalide`), le reste (réseau, délai, débit) se réessaie (`erreur`). */
export const etatDeLInvitation = (code: string): EtatInvitation => (code === "invalid_invitation" ? { etat: "invalide", code } : { etat: "erreur", code });

/** Le pseudo à écrire sur l'appareil après une acceptation qui a créé le profil : celui qui a été choisi, nettoyé comme le serveur le fait ; `null` si on n'en a pas demandé (le profil existait). */
export function pseudoAEcrire(choisi: string | undefined): string | null {
  if (choisi === undefined) return null;
  const n = normalizeName(choisi);
  return isValidName(n) ? n : null;
}

/**
 * L'ouverture de la page : le jeton d'un lien d'invitation est rangé dans le stockage de l'onglet et **retiré de l'adresse tout de suite** (`rangerInvitation`) ; sans paramètre, un jeton déjà rangé
 * dans cet onglet sert encore. `initial` : un lien illisible est `invalide` d'emblée (rien n'est gardé), un jeton lisible est `lecture` (le pseudo de qui invite reste à lire), rien : `null`.
 */
export function ouvrirInvitation(page: { href: string; session: Storage | null; remplacer(adresse: string): void }): { jeton: string | null; initial: EtatInvitation | null } {
  const aParametre = new URL(page.href).searchParams.has("invitation");
  const recu = rangerInvitation(page);
  const jeton = aParametre ? recu : invitationRangee(page.session);
  if (aParametre && !recu) return { jeton: null, initial: { etat: "invalide", code: "invalid_invitation" } };
  return { jeton, initial: jeton ? { etat: "lecture", jeton } : null };
}

/** Ce que l'acceptation demande à la page : le serveur, l'identité de ce navigateur, le stockage de l'onglet. */
export interface AcceptationDeps {
  accepter(jeton: string, pseudo?: string): Promise<ApiResult<{ ami: Ami; total: number }>>;
  /** L'identifiant de ce navigateur (`null` : pas de profil) ; `fixer` le change (le client de la page le lit à chaque appel). */
  identifiant(): string | null;
  fixer(id: string | null): void;
  stockage: ListableStore | null;
  session: Pick<Storage, "removeItem"> | null;
  /** Tire un identifiant (128 bits, 32 hexadécimaux). */
  nouvelIdentifiant(): string;
}

/**
 * Accepte l'invitation. Sans profil sur cet appareil, un identifiant est tiré (en mémoire d'abord) et le serveur crée le profil avec le pseudo choisi ; **l'identité locale (`cdj:player`, `cdj:name`)
 * n'est écrite qu'une fois l'amitié faite** : un pseudo pris, un lien révoqué ou une liste pleine ne laissent rien derrière eux. Un refus définitif (lien inconnu, déjà amis, son propre lien) oublie
 * le jeton de l'onglet. Avec un profil, seul le pseudo est mis à jour si on en a demandé un (le profil existait sur cet appareil mais pas sur le serveur). Ne lève jamais.
 */
export async function accepterEtEcrire(d: AcceptationDeps, jeton: string, choisi?: string): Promise<ApiResult<{ ami: Ami; total: number }>> {
  const avant = d.identifiant();
  const candidat = avant ?? d.nouvelIdentifiant();
  d.fixer(candidat);
  const r = await d.accepter(jeton, choisi);
  if (!r.ok) {
    d.fixer(avant);
    if (oublieLInvitation(r.code)) oublierInvitation(d.session);
    return r;
  }
  oublierInvitation(d.session);
  try {
    if (d.stockage) {
      if (avant === null) {
        writeIdentity({ id: candidat, name: pseudoAEcrire(choisi) }, d.stockage);
        noteIdentityChange(d.stockage, "creation"); // le premier profil de ce navigateur : les jeux le verront, sans rien effacer
      } else if (pseudoAEcrire(choisi)) d.stockage.setItem(NAME_KEY, pseudoAEcrire(choisi)!);
    }
  } catch {
    /* stockage refusé : l'identité vit en mémoire le temps de la page */
  }
  return r;
}
