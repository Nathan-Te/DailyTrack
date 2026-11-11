// Les constantes de capture des paliers (lot V2). Un palier ramène l'état du joueur à l'état de jonction canonique (`Niveau.jonctions`, `Partie.canoniser`) quand il en passe le plan en étant DÉJÀ presque dans cet état : assez
// au centre, assez dans l'axe, assez vite, au sol, dans la bonne gravité. Un joueur humain, qui n'est presque jamais dans cet état à l'écart près, ne sent rien (au plus 5 cm et 1,5° d'un coup) ; les solutions des
// modules, elles, y arrivent exactement (c'est vérifié module par module). Tout est entier.
/** Au plus 5 cm du centre du palier, de côté (µm). */
export const CAPTURE_LATERAL = 50_000;
/** Au plus 2 cm au-dessus ou au-dessous de la hauteur posée du palier (µm). */
export const CAPTURE_VERTICAL = 20_000;
/** Le regard dans l'axe à 1,5° près : le produit scalaire du regard (à l'échelle 65 536) et de la direction du palier est au moins cela (65 536 × cos 1,5° = 65 509). */
export const CAPTURE_REGARD = 65_500;
/** La vitesse le long de l'axe : de 98,5 % à 101,5 % de la vitesse de course (pour mille) — ni un joueur qui n'a pas fini d'accélérer, ni un joueur lancé par un dash, ne sont ramenés d'un coup à la course. */
export const CAPTURE_VITESSE_MILLE = 985;
export const CAPTURE_VITESSE_MAX_MILLE = 1015;
/** La vitesse de côté : au plus 20 cm/s (µm/s). */
export const CAPTURE_VITESSE_LATERALE = 200_000;
