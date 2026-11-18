# Le chevalier (le héros) : « Knight » du pack KayKit « Adventurers Character Pack » (Kay Lousberg), son épée à une main et son bouclier rond aux mains,
# les clips du squelette « Rig_Medium » du même pack. Recoloré vers la cible : armure jaune, casque clair.
# Clips : attente (Idle_A), marche (Walking_A), course (Running_A), coup1 / coup2 / coup3 (les trois coups de l'enchaînement), esquive (Dodge_Forward),
# competence (le tourbillon : 2H_Attack_Spinning), touche (Hit_A), mort (Death_A), victoire (Taunt).
K = "kaykit/Assets/KayKit/Characters"
R = K + "/Animations/Source_FBX/Animations_Source_FBX/Rig_Medium/Rig_Medium_"
M = K + "/KayKit - Adventurers (for Unity)/Models/"
SPEC = {
    "nom": "chevalier",
    "pack": "kaykit",
    "maillage": M + "Characters/Knight.fbx",
    # la cape gêne la lecture vue d'en haut (elle cache le corps) : retirée
    "pieces": ["Knight_Body", "Knight_Head", "Knight_LegLeft", "Knight_LegRight", "Knight_ArmLeft", "Knight_ArmRight", "Knight_Helmet", "Knight_HelmetVisor"],
    "accessoires": [
        {"fbx": M + "Accessories/sword_1handed.fbx", "os": "handslot.r"},
        {"fbx": M + "Accessories/shield_round.fbx", "os": "handslot.l"},
    ],
    "texture": K + "/KayKit - Adventurers (for Unity)/Textures/Knight/knight_texture.png",
    "taille_texture": 256,
    "plus_proche": False,
    "rayon": 0.42,  # RAYON_CHEVALIER
    "exclus": ["arm", "wrist", "hand"],
    "clips": {
        "attente": {"fbx": R + "General.fbx", "prise": "Idle_A"},
        "marche": {"fbx": R + "MovementBasic.fbx", "prise": "Walking_A"},
        "course": {"fbx": R + "MovementBasic.fbx", "prise": "Running_A"},
        "coup1": {"fbx": R + "CombatMelee.fbx", "prise": "Melee_1H_Attack_Slice_Diagonal"},
        "coup2": {"fbx": R + "CombatMelee.fbx", "prise": "Melee_1H_Attack_Slice_Horizontal"},
        "coup3": {"fbx": R + "CombatMelee.fbx", "prise": "Melee_1H_Attack_Chop"},
        "esquive": {"fbx": R + "MovementAdvanced.fbx", "prise": "Dodge_Forward"},
        "competence": {"fbx": R + "CombatMelee.fbx", "prise": "Melee_2H_Attack_Spinning"},
        "touche": {"fbx": R + "General.fbx", "prise": "Hit_A"},
        "mort": {"fbx": R + "General.fbx", "prise": "Death_A"},
        "victoire": {"fbx": R + "Special.fbx", "prise": "Skeletons_Taunt"},
    },
    "racines": {"root": [0, 2], "hips": [0, 2]},
    "inspecter": False,
    # la texture est une palette de dégradés (cases de 1/8 × 1/4) : l'armure (le gris de la case 3, ligne 0) passe au dégradé jaune-orangé (case 4, ligne 1), le casque au blanc (case 1, ligne 1)
    "deplacer_uv": [
        {"pieces": ["Knight_Body", "Knight_ArmLeft", "Knight_ArmRight", "Knight_LegLeft", "Knight_LegRight"], "de": [0.375, 0.0, 0.5, 0.25], "vers": [0.5, 0.25, 0.625, 0.5]},
        {"pieces": ["Knight_Helmet", "Knight_HelmetVisor"], "de": [0.375, 0.0, 0.5, 0.25], "vers": [0.125, 0.25, 0.25, 0.5]},
    ],
    "teintes": {},
}
