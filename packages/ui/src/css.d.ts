// Lot 53 : `aideIphone.ts` importe sa feuille (`modale.css`, chargée à la demande avec lui) ; l'empaqueteur des applications la traite, TypeScript n'a qu'à la connaître.
declare module "*.css";
// Lot M1 : la feuille du menu à la manette est une adresse (`?url`), posée en `<link>` par le module.
declare module "*.css?url" {
  const adresse: string;
  export default adresse;
}
// Lot S1 : les images des boutons Discord et Ko-fi (`liensCommunaute.ts`), servies comme des fichiers du site.
declare module "*.svg?no-inline" {
  const adresse: string;
  export default adresse;
}
declare module "*.png" {
  const adresse: string;
  export default adresse;
}
