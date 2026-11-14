# Le golem (boss) : « Golem » du pack Dungeon Mason « RPG Monster BUNDLE PBR » (Wave 01), recoloré en pierre brun chaud aux yeux ambre.
# Clips : attente, marche, annonce (le poing levé : le début de l'Attack01, joué au rythme de l'annonce), frappe (la suite de l'Attack01), recupere (Dizzy : étourdi),
# touche (GetHit), mort (Die), dort (IdleNormal), reveil (Taunting).
P = "dm-monstres/Assets/RPGMonsterBundlePBR/RPGMonsterWave01PBR"
A = P + "/Animations/Golem/"
SPEC = {
    "nom": "golem",
    "pack": "dm-monstres",
    "maillage": P + "/Meshes/Character/GolemMesh.fbx",
    "texture": "dm-monstres/Assets/RPGMonsterBundlePBR/CommonStuffs/Textures/DefaultPBR/Albedo.png",
    "rayon": 1.70,  # RAYON_GOLEM
    # l'empreinte : le corps (tronc, tête, jambes) ; les bras, les poings et les épaules sortent du disque, comme le golem procédural
    "exclus": ["arm", "hand", "thumb", "index", "mid", "pinky", "joint", "shoulder"],
    "clips": {
        "attente": {"fbx": A + "IdleBattle_Golem_Anim.fbx"},
        "marche": {"fbx": A + "Walk_Golem_Anim.fbx"},
        "annonce": {"fbx": A + "Attack01_Golem_Anim.fbx"},
        "recupere": {"fbx": A + "Dizzy_Golem_Anim.fbx"},
        "touche": {"fbx": A + "GetHit_Golem_Anim.fbx"},
        "mort": {"fbx": A + "Die_Golem_Anim.fbx"},
        "dort": {"fbx": A + "IdleNormal_Golem_Anim.fbx"},
        "reveil": {"fbx": A + "Taunting_Golem_Anim.fbx"},
    },
    "racines": {},
    "inspecter": True,
    # les yeux ambre LUISENT (une texture de lueur : le bloom du jeu les fait fleurir, comme sur la cible)
    "lueur": ["ffb43c"],
    # les grandes masses de couleur après recoloration : `test/lisibilite.test.ts` les lit (écart ≥ 25 sur chaque sol)
    "dominantes": ["9e8872", "6e5a47", "413428"],
    # la pierre grise → le gris-brun de la roche de la cible (tour 2 : moins orangé) ; les bandes bleues → à peine plus sombres (pas de rayures) ; le bleu clair (les yeux) → ambre
    "teintes": {
        "e0e0e0": "c4ae94",
        "c8c8c8": "9e8872",
        "858585": "7c6854",
        "7c7c7c": "76624e",
        "6f6f6f": "6e5a47",
        "696969": "695543",
        "656565": "645140",
        "3b3b3b": "47392c",
        "343434": "413428",
        "1b79ff": "5e4c3b",
        "2766ff": "5e4c3b",
        "1045bb": "564535",
        "0a2aa3": "4f3f31",
        "11388c": "4f3f31",
        "1742d9": "5a4838",
        "0c2072": "433628",
        "2dadff": "ffb43c",
    },
}
