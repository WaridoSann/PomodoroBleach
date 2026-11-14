# Zangetsu — Un instant à la fois

Un Pomodoro en français, avec un véritable sabre en 3D au centre de l’expérience. Une direction graphique charbon, ivoire et acier, des transitions monochromes discrètes, et des commandes accessibles sans connaître Bleach.

## Utiliser le site

**https://waridosann.github.io/PomodoroBleach/**

GitHub Actions vérifie et compile l’application, puis publie automatiquement sur GitHub Pages à chaque mise à jour de `main`. Les pull requests exécutent les vérifications sans publier. Le workflow peut aussi être relancé manuellement depuis l’onglet Actions.

## Démarrer

Node.js **22 ou supérieur** et npm sont nécessaires.

```bash
git clone https://github.com/WaridoSann/PomodoroBleach.git
cd PomodoroBleach
npm ci
npm run dev
```

Ouvrir l’adresse affichée par Vite. Le mode développement ne publie rien sur Internet.

```bash
npm test        # logique du minuteur et interactions dans le DOM
npm run build  # vérification TypeScript et production dans dist/
npm run preview
```

Le dossier `dist/` peut aussi être hébergé sur un autre service de sites statiques. Les chemins relatifs permettent un hébergement sous `/PomodoroBleach/`. Aucun serveur applicatif, compte ou clé API n’est nécessaire pour utiliser l’application.

## Le rituel

- **25 minutes** de concentration, **5 minutes** de pause courte, **20 minutes** de pause longue après quatre sessions.
- Durées réglables de 1 à 180 minutes ; pause, reprise et remise à zéro.
- Les changements de mode ou la remise à zéro d’une session entamée demandent confirmation. Aucune session interrompue n’est comptabilisée.
- La pause est préparée automatiquement, puis attend votre clic. L’enchaînement automatique est une option désactivée par défaut.
- Une intention peut être associée à chaque session ; elle est capturée au départ du chrono.
- Une cloche synthétisée, un souffle d’ambiance facultatif et un bouton de coupure générale, indépendants des animations.
- Mode immersif, navigation clavier, respect du réglage système de réduction des animations.
- Journal des sessions, graphique des sept derniers jours, objectif quotidien de quatre sessions et export CSV.
- La lumière du sabre évolue après la première et la quatrième session. **Il s’agit d’une progression de l’éclairage, pas d’un remplacement par plusieurs modèles Shikai/Bankai.**

**Raccourcis :** `Espace` démarre/met en pause, `R` recommence avec confirmation et `Échap` quitte le mode immersif. Les raccourcis ne s’appliquent pas dans les champs de saisie ou les dialogues.

## Importer le Tensa Zangetsu fourni

1. Ouvrir **Réglages → Votre sabre en 3D → Importer**.
2. Choisir `fullbring_tensa_zangetsu_-_bleach.zip` tel quel. Aucun dézippage manuel n’est nécessaire.
3. Le modèle et les textures sont validés, puis enregistrés dans **IndexedDB sur cet appareil**. L’import ne téléverse rien et reste disponible après rechargement.
4. Faire glisser le sabre pour le regarder sous différents angles. Le petit bouton de recentrage rétablit la vue initiale.

Les GLB autonomes et les ZIP contenant un glTF et toutes ses ressources sont acceptés (40 Mo compressés et 160 Mo décompressés maximum). Les références distantes ne sont pas chargées. Les archives nécessitant Draco/KTX2 ne sont pas prises en charge dans cette première version. Les textures trop grandes sont réduites pour l’affichage, à 2048 px sur ordinateur et 1024 px sur petit écran. Le ZIP d’origine reste intact dans le stockage local.

La lame incluse par défaut est une géométrie originale : volumes extrudés, métal, tranchant, poignée enveloppée et chaîne. Elle est disponible sans téléchargement de modèle externe. Le moteur est Three.js, avec éclairage d’environnement et rotation interactive ; la scène n’est ni une image ni une illustration.

### Pourquoi le modèle fourni n’est pas dans le dépôt

Le fichier `license.txt` de l’archive indique une **licence Sketchfab Standard**, qui interdit de rendre le modèle disponible comme fichier autonome. Puisque ce dépôt est public, le ZIP, la géométrie et ses textures ne sont pas commités. L’import local permet d’utiliser la copie fournie sans exposer ces fichiers à tout le monde.

- Modèle : [fullbring Tensa Zangetsu - BLEACH](https://sketchfab.com/3d-models/fullbring-tensa-zangetsu-bleach-e4d0ee747dbc4531abb63d99dc7f9dd7)
- Créateur : [worms845](https://sketchfab.com/worms845)
- [Licence Sketchfab](https://sketchfab.com/licenses)

Cette application est un projet de fan indépendant, sans affiliation avec Bleach ou ses ayants droit. Les droits sur le modèle et l’univers restent distincts du code de l’application. Voir [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Sauvegarde et comportement en arrière-plan

Les réglages, la tâche, le minuteur et les 5 000 dernières sessions sont enregistrés dans `localStorage`. Le modèle personnel est enregistré séparément dans IndexedDB. Aucune statistique n’est inventée et aucun outil de suivi n’est installé. Effacer les données du site dans le navigateur efface aussi ces sauvegardes ; un autre appareil dispose de sa propre progression. L’export CSV conserve une copie du journal, mais ne constitue pas une sauvegarde réimportable de toute l’application.

Le chrono repose sur une **échéance absolue**. Un changement d’onglet ou un rechargement ne le remet pas à zéro. Au retour après une longue veille, une seule session échue est comptabilisée : l’application n’accorde pas plusieurs cycles imaginaires pendant la nuit. Si l’enchaînement automatique est activé, le prochain intervalle commence lors de cette reprise.

Les navigateurs peuvent retarder les sons et notifications en arrière-plan. La cloche exige une première interaction et la page doit rester ouverte ; un navigateur fermé ne peut pas jouer de son. Les notifications sont facultatives, demandées uniquement au clic et disponibles selon le navigateur. L’import et la 3D nécessitent des fonctionnalités web modernes ; si WebGL est indisponible, le minuteur reste utilisable avec un message explicite.

## Structure

```text
src/
  App.tsx            interface, réglages, journal et coordination
  timer.ts           transitions pures et validation des sauvegardes
  SwordView.tsx      cycle de vie de la vue 3D
  sword-scene.ts     géométrie, éclairage, import glTF/GLB et ressources GPU
  model-store.ts     stockage local du modèle personnel
  audio.ts           cloche et souffle générés avec Web Audio
  *.test.ts(x)       tests de logique et d’interaction
```

Les polices et dépendances sont empaquetées avec l’application. La scène 3D est chargée dans un module séparé et son rendu est limité à 30 images/seconde ; il est suspendu lorsque l’onglet ou la scène est masqué.

## Validation de cette première version

- Build TypeScript/Vite réussi.
- 23 tests automatisés : échéances, pause/reprise, rechargement, veille, cycles, réglages, confirmations, journal et stockage indisponible.
- Archive fournie vérifiée avec le validateur glTF Khronos : **0 erreur, 0 avertissement**.
- Les tests DOM utilisent une vue 3D simulée. Ils ne vérifient pas le rendu WebGL. L’outil navigateur n’étant pas disponible dans l’environnement de création, une vérification visuelle sur ordinateur et mobile reste à effectuer.
