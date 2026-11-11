// Lot QA1 : les pages du portail que `npm run relecture` photographie, et leurs états. Un sujet = une page dans un état ; `etat` choisit l'identité posée dans le navigateur (`neuf` : aucune ;
// `demo` : le joueur de démonstration, celui de `/?demo=joueur` ; `parfaite` : un joueur du classement de démonstration qui a fini tous les jeux du jour, sans ami ni groupe ; `admin` : la session factice du panneau).
// Ajouter une page au portail = ajouter une ligne ici.

/** @param {{ groupe: string | null }} donnees ce que la base de démonstration contient (le groupe de « Démo »). */
export function sujetsDuPortail(donnees) {
  const groupe = encodeURIComponent(donnees.groupe ?? "Les Noctambules");
  const p = (id, titre, etat, chemin, plus = {}) => ({ id, zone: "portail", titre, etat, chemin, ...plus });
  return [
    p("accueil-neuf", "Accueil — pas encore joué, sans profil", "neuf", "/"),
    p("accueil-demo", "Accueil — « Démo » : amis, groupe, un jeu fini", "demo", "/"),
    p("accueil-parfaite", "Accueil — journée parfaite, sans ami ni groupe", "parfaite", "/"),
    p("classement-cumul", "Classements — cumul du jour", "demo", "/classement/"),
    p("classement-jeu-du-jour", "Classements — un jeu du jour (Track)", "demo", "/classement/?vue=track"),
    p("classement-arcade", "Classements — un jeu d'arcade (Tower)", "demo", "/classement/?vue=tower"),
    p("classement-amis", "Classements — Amis", "demo", "/classement/?filtre=amis"),
    p("classement-amis-vide", "Classements — Amis, sans ami", "parfaite", "/classement/?filtre=amis"),
    p("classement-mon-groupe", "Classements — Mon groupe", "demo", "/classement/?filtre=groupe"),
    p("classement-groupes", "Classements — Groupes", "demo", "/classement/?mode=groupes"),
    p("classement-neuf", "Classements — sans profil", "neuf", "/classement/"),
    p("amis-demo", "Amis et groupes — avec amis et groupe", "demo", "/amis/"),
    p("amis-vide", "Amis et groupes — sans ami ni groupe", "parfaite", "/amis/"),
    p("amis-neuf", "Amis et groupes — sans profil", "neuf", "/amis/"),
    p("profil-demo", "Profil — « Démo »", "demo", "/profil/"),
    p("profil-parfaite", "Profil — journée parfaite, sans groupe", "parfaite", "/profil/"),
    p("profil-neuf", "Profil — sans profil", "neuf", "/profil/"),
    p("nouveautes", "Nouveautés", "demo", "/nouveautes/"),
    p("messages-demo", "Mes messages — avec une réponse", "demo", "/messages/"),
    p("messages-fil", "Mes messages — un fil ouvert", "demo", "/messages/", { apres: async (page) => { await page.locator("main a[href^='#'], main [data-fil], main li button, main li a").first().click({ timeout: 3000 }).catch(() => {}); } }),
    p("messages-neuf", "Mes messages — sans profil", "neuf", "/messages/"),
    p("groupe-membre", "Page d'un groupe — vue par un membre", "demo", `/groupe/${groupe}`),
    p("groupe-visiteur", "Page d'un groupe — vue sans profil", "neuf", `/groupe/${groupe}`),
    p("groupe-inconnu", "Page d'un groupe — groupe inconnu", "neuf", "/groupe/Introuvable", { attendues: [/\/api\/groupes\//] }),
    p("partage", "Images de partage (outil de dessin)", "neuf", "/partage/images.html", { langues: ["fr"] }),
    p("mentions", "Mentions légales", "neuf", { fr: "/mentions-legales/", en: "/legal/" }),
    p("introuvable", "Page 404", "neuf", "/cette-page-n-existe-pas", { attendues: [/cette-page-n-existe-pas/] }),
    p("admin-accueil", "Administration — accueil du panneau", "admin", "/admin/", { langues: ["fr"] }),
    p("admin-jeux", "Administration — Jeux", "admin", "/admin/#/jeux", { langues: ["fr"] }),
    p("admin-retours", "Administration — Retours", "admin", "/admin/#/retours", { langues: ["fr"] }),
  ];
}
