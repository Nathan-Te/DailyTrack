# La musique de Du Jour — ajouter un morceau en 3 étapes

La plateforme a **un seul lecteur de musique, commun à Track, Jump et Tower** (le portail peut s'y brancher : voir « Le portail »). Chaque jeu joue **sa liste**, mélangée, jamais deux fois le même morceau d'affilée, avec un fondu entre deux morceaux. Ajouter un morceau ne demande **aucun code**.

> **Demander à un agent, en une phrase** : « Ajoute le morceau `mon-fichier.mp3` (titre *…*, artiste *…*, licence *…*) à la musique de Track et Jump, en suivant `docs/plateforme/musique.md`. »

## Les 3 étapes

**1. Dépose le fichier** dans `musique/pistes/` (mp3, wav, flac, ogg, m4a, aac ou opus ; n'importe quel débit : il est converti).

**2. Décris-le** dans `musique/musiques.json` (une entrée de plus dans `pistes`) :

```json
{
  "pistes": [
    {
      "id": "premier-jour",
      "titre": "Premier jour",
      "artiste": "Nathan",
      "fichier": "premier-jour.mp3",
      "jeux": ["track", "jump"],
      "licence": "mienne"
    },
    {
      "id": "lumieres-du-port",
      "titre": "Lumières du port",
      "artiste": "Une Artiste",
      "fichier": "lumieres-du-port.wav",
      "jeux": ["tous"],
      "licence": "CC-BY-4.0",
      "credit": "« Lumières du port » par Une Artiste, CC BY 4.0",
      "source": "https://exemple.org/lumieres-du-port",
      "poids": 2,
      "volumeDb": -2
    }
  ]
}
```

| Champ | Obligatoire | Sens |
|---|---|---|
| `id` | oui | un nom court et stable (`a-z`, `0-9`, `-`) : il nomme les fichiers servis et la reprise d'une page à l'autre |
| `titre`, `artiste` | oui | ce que le joueur lit (« En écoute : Titre — Artiste ») |
| `fichier` | oui | le nom du fichier dans `musique/pistes/` |
| `jeux` | oui | où il passe : `track`, `jump`, `tower`, `portail`, ou `tous` (= Track, Jump et Tower, **pas** le portail) |
| `licence` | oui | `mienne` (c'est à toi), `CC0`, `CC-BY-4.0` ou `achetee` — **rien d'autre n'est publié** |
| `credit` | en `CC-BY-4.0` | le texte exact que l'auteur exige ; sinon « Titre — Artiste » est écrit à sa place |
| `source` | en `CC0`, `CC-BY-4.0`, `achetee` | l'adresse du morceau, ou la référence de l'achat : la preuve que tu as le droit |
| `poids` | non | 1 par défaut ; 2 passe deux fois plus souvent qu'un morceau de poids 1 |
| `volumeDb` | non | 0 par défaut ; correction en décibels (−3 : plus doux) pour un morceau qui reste trop fort ou trop doux après l'harmonisation |

**3. Lance `npm run musique`** et ajoute au commit ce qu'elle a changé (`musique/servi/`, les deux pages de mentions légales). Elle :

- **vérifie** chaque morceau et dit en français ce qui ne va pas (fichier absent, **licence manquante ou non admise**, **jeu inconnu**, identifiant en double, champ mal orthographié) ;
- **prépare** les fichiers servis : **AAC** (`.m4a`, lu partout, iPhone compris), **96 kbit/s** stéréo, volume **harmonisé à −18 LUFS** (assez bas pour passer sous les moteurs et les effets), début du fichier prêt pour la lecture en flux — seulement ce qui a changé ;
- **écrit** la liste que lisent les jeux (`musique/servi/liste.json`) et **les crédits** dans les deux pages de mentions légales (`/mentions-legales/` et `/legal/`).

`npm run musique -- --verifier` fait seulement la vérification (c'est ce que fait la CI : elle échoue si ce qui est préparé n'est pas à jour). `npm run musique -- --essai` ajoute **un morceau d'essai généré par le code** (CC0, 6 secondes, pour Track) : tout le chemin se voit sans morceau à soi ; pour le retirer, efface son entrée de `musiques.json` et relance la commande.

**Il manque `ffmpeg` ?** C'est l'outil de conversion. Une ligne : Windows `winget install Gyan.FFmpeg` · Mac `brew install ffmpeg` · Linux `sudo apt install ffmpeg`. Ou, sans rien installer, demande à un agent de lancer la commande dans une session (il l'a).

## Le droit d'usage — la règle

Seuls des morceaux que tu as **le droit de diffuser** : les tiens, **CC0**, **CC-BY** (avec le crédit exigé), ou sous **licence achetée**. La commande **refuse** un morceau sans licence, et refuse CC0, CC-BY ou achetée **sans `source`**. Les crédits sont publiés tout seuls dans les mentions légales, et le joueur les voit dans les réglages (« En écoute : Titre — Artiste » et le crédit dessous). Une licence qui interdit l'usage commercial, la modification ou un format (CC-BY-NC, CC-BY-ND) **n'est pas admise** : ne la contourne pas, demande-moi un autre morceau.

## Ce que fait le joueur

- **Démarrage** : la musique démarre **au premier geste** dans la page (un toucher, un clic, une touche) ; **rien n'est téléchargé avant** (ni la liste, ni un morceau), et rien de tout cela n'est dans le premier chargement d'un jeu (le branchement pèse ≈ 0,3 ko).
- **Arrière-plan** : elle se met en pause quand l'onglet passe en arrière-plan et reprend au retour.
- **Changer de page** (portail → Track → Jump) recharge la page : **le même morceau reprend là où il en était** s'il passe aussi dans le jeu d'arrivée, sinon un autre entre en fondu (jamais celui qu'on vient d'entendre). La position est gardée dans le stockage de l'onglet (`cdj:musique:reprise`), jamais dans celui de l'appareil.
- **iPhone** : l'audio est débloqué par le premier geste qui se termine (`touchend`, `click`) ; la musique passe aussi quand l'interrupteur « silence » est sur silence, **comme le son des jeux** (`navigator.audioSession`).
- **Réglages** (Track : Réglages › Son · Jump : Réglages › Son · Tower : la pause) : **volume de la musique**, **Couper la musique**, **Morceau suivant**, et le morceau en cours avec son crédit. **Les mêmes dans les trois jeux** : un seul réglage, gardé sous `cdj:musique` dans le navigateur (volume et « coupée »). **Par défaut : musique allumée, volume 40 %** (modéré) — à confirmer par Nathan. Le muet de Track (touche M) et « Son : non » de Jump coupent aussi la musique ; ils ne touchent pas à son volume.
- **Sous les effets** : le niveau de base de la musique est à moitié du maximum, un compresseur doux est sur sa sortie (rien ne sature), et **chaque jeu la baisse en jeu** : Track à **35 %** pendant une course (pleine aux menus), Jump à **60 %** pendant un niveau, Tower à **60 %** pendant une partie (pleine dans la pause et à l'écran de fin). Ces trois nombres sont des constantes de leur jeu (`MUSIQUE_EN_COURSE`, `MUSIQUE_EN_NIVEAU`, `MUSIQUE_EN_PARTIE`) : à décider par Nathan.

## Le portail

Le portail **n'est pas branché** : il reste silencieux (décision à prendre : musique d'accueil ou silence). Pour qu'il joue : une ligne, `brancherMusique("portail", …)` dans `apps/portail/src/portail.ts`, et des morceaux avec `"portail"` dans `jeux`. Ses réglages seraient ceux de la plateforme ; il faudrait un panneau dans son profil.

## Hébergement et poids

Les morceaux sont des **fichiers statiques** servis à `/musique/` (site Firebase, comme `/api/`), nommés `<id>-<empreinte>.m4a` : le nom change quand le fichier change, donc **cache sans fin** (`firebase.json`, `Cache-Control: immutable`). Lus **en flux** (le navigateur demande des morceaux du fichier, jamais tout en mémoire). Ils ne sont **pas comptés dans le poids des jeux** : voir `docs/plateforme/budgets.md`, « La musique » (≈ 0,7 Mo par minute).

## Si ça ne joue pas

1. `npm run musique -- --verifier` : dit ce qui n'est pas à jour.
2. Ouvre `/musique/liste.json` sur le site : le morceau y est-il, avec le bon jeu ?
3. Le premier geste dans la page a-t-il eu lieu ? (Rien ne joue avant.) Le réglage « Couper la musique » est-il sur « non » ? Le muet du jeu est-il levé ?
4. Les jeux ne montrent le bloc « Musique » des réglages que s'il y a un morceau pour eux.

Règles de fond et fichiers : `packages/musique/CLAUDE.md`.
