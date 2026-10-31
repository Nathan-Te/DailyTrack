// Lot 53 : `aideIphone.ts` importe sa feuille (`modale.css`, chargée à la demande avec lui) ; l'empaqueteur des applications la traite, TypeScript n'a qu'à la connaître.
declare module "*.css";
// Lot M1 : la feuille du menu à la manette est une adresse (`?url`), posée en `<link>` par le module.
declare module "*.css?url" {
  const adresse: string;
  export default adresse;
}
