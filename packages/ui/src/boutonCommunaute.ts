import { ADRESSES_COMMUNAUTE, type LienCommunaute } from "./liensCommunaute";

// Lot S1 : la variante du pied du portail (boutons à l'allure des services). Un fichier à part : les jeux n'en ont pas besoin (leur morceau à la demande reste petit).

/** La variante du pied du portail : un bouton à texte, à l'allure du service (l'habillage est celui du portail : `classe`), l'image est hébergée ici et donnée par l'appelant. */
export function boutonCommunaute(type: LienCommunaute, o: { texte: string; classe: string; id: string; image: { src: string; classe: string; largeur: number; hauteur: number } }): HTMLAnchorElement {
  const a = document.createElement("a");
  a.className = o.classe;
  a.id = o.id;
  a.href = ADRESSES_COMMUNAUTE[type];
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  const img = document.createElement("img");
  img.className = o.image.classe;
  img.alt = "";
  img.src = o.image.src;
  img.width = o.image.largeur;
  img.height = o.image.hauteur;
  const s = document.createElement("span");
  s.textContent = o.texte;
  a.append(img, s);
  return a;
}

