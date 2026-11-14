# Zangetsu

**https://waridosann.github.io/PomodoroBleach/**

Un sabre « sealed » planté dans le sol, une brume sombre, un chronomètre centré et deux commandes discrètes. Le manche est enveloppé de tissu blanc, sans garde, avec une bande libre à son extrémité.

L’écran affiche uniquement le temps, **Commencer / Pause / Reprendre** et une icône **reset**. Le décor est fixe et ne se manipule pas. Une brume légère se déplace lentement ; l’animation respecte la préférence système de réduction des mouvements.

## Pomodoro

- 25 minutes de travail, puis 5 minutes de repos.
- Une pause de 20 minutes remplace la pause courte après quatre sessions terminées.
- Chaque prochain intervalle attend le clic sur **Commencer**.
- Le reset remet l’intervalle actuel à sa durée initiale et l’arrête, sans changer sa phase.
- De petites notes discrètes accompagnent le démarrage, la pause, la reprise et le reset. Elles sont générées avec Web Audio, sans fichier sonore externe.
- Une cloche douce signale la fin. Elle exige une première interaction et une page ouverte ; les navigateurs peuvent retarder le son en arrière-plan.
- `Espace` démarre, met en pause ou reprend.

Aucun menu, réglage, import de modèle, historique, objectif ou compteur de progression n’est affiché. Le minuteur conserve son échéance après un changement d’onglet ou un rechargement. Une longue veille ne valide qu’un seul intervalle terminé.

L’état du minuteur est sauvegardé localement si le navigateur l’autorise. Cette version n’enregistre pas de journal et ne consulte pas les données de la première version.

## Développer

Node.js 22 ou supérieur et npm :

```bash
npm ci
npm run dev
npm test
npm run build
```

Le fond est une image générée à partir des références visuelles fournies, intégrée au build avec un nom de fichier versionné. Il ne contient pas le modèle Sketchfab précédemment envoyé. L’application ne nécessite plus WebGL ni Three.js.

Les tests couvrent les échéances, la pause/reprise, le reset, les pauses Pomodoro, la sauvegarde et les déclenchements des sons depuis les commandes. Le rendu visuel complet dans un navigateur reste à vérifier : aucun outil navigateur n’est disponible dans l’environnement de développement.

## Publication

GitHub Actions exécute les tests et le build, puis publie `dist/` sur GitHub Pages à chaque mise à jour de `main`. Les pull requests exécutent uniquement les vérifications. Le workflow peut être relancé depuis l’onglet Actions.

Projet de fan indépendant, sans affiliation avec Bleach. Voir [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
