# Route 1000

Jeu de cartes de course multijoueur, inspiré du Mille Bornes, pensé pour jouer entre amis :

- **l'ordinateur** affiche le plateau en grand écran, mis à jour en temps réel ;
- **chaque joueur** rejoint depuis son téléphone (QR code ou lien) et ne voit que **ses propres cartes** ;
- tout passe par Internet (Firebase) : les joueurs n'ont **pas besoin d'être sur le même Wi-Fi**.

Visuels de cartes et illustrations originaux (bornes SVG, icônes Lucide) : aucun visuel officiel n'est repris.

**En ligne** : https://route-1000-coral.vercel.app · Firebase (gratuit) : projet `route-1000-jeu` (Firestore `eur3`) · Code : https://github.com/adellkl/1000-bornes

---

## Sommaire

1. [Stack](#stack)
2. [Installation](#installation)
3. [Configurer Firebase](#configurer-firebase)
4. [Lancer en local](#lancer-en-local)
5. [Déployer sur Vercel](#déployer-sur-vercel)
6. [Comment jouer](#comment-jouer)
7. [Règles implémentées](#règles-implémentées)
8. [Architecture et sécurité](#architecture-et-sécurité)
9. [Tests](#tests)
10. [Structure du projet](#structure-du-projet)

---

## Stack (100 % gratuite)

| Rôle | Outil | Coût |
| --- | --- | --- |
| Front | React 19 + Vite + TypeScript, Tailwind CSS v4, React Router, Framer Motion, Lucide, qrcode.react | — |
| Données temps réel | **Firebase Firestore** (forfait Spark) | gratuit |
| Identité des joueurs | **Firebase Authentication** anonyme (forfait Spark) | gratuit |
| Logique de jeu (serveur) | **Fonction serverless Vercel** `api/game.ts` + SDK Admin Firebase | gratuit (Hobby) |
| Hébergement | Vercel | gratuit (Hobby) |

Aucune Cloud Function, donc **aucun forfait Blaze ni carte bancaire** : la validation des coups tourne dans une fonction Vercel gratuite.

---

## Installation

Prérequis : Node.js 22, Java 21+ (uniquement pour les émulateurs locaux).

```bash
npm install
cp .env.example .env
```

---

## Configurer Firebase (gratuit)

1. **Créer le projet** sur [console.firebase.google.com](https://console.firebase.google.com). Le forfait Spark gratuit suffit.
2. **Authentication → Sign-in method → Anonyme → Activer.**
3. **Firestore Database → Créer une base de données** (région `eur3`).
4. **Ajouter une application Web** et recopier sa configuration dans `.env` (`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`). Ces valeurs sont publiques par nature.
5. **Déployer les règles de sécurité** :

```bash
npx firebase login
npm run deploy:firebase      # = firebase deploy --only firestore
```

6. **Clé de compte de service** (gratuite) pour la fonction Vercel : *Paramètres du projet → Comptes de service → Générer une nouvelle clé privée*. Puis :

```bash
npm run setup:key -- ~/Downloads/<projet>-firebase-adminsdk-xxxxx.json
```

Le script l'enregistre dans la variable Vercel `FIREBASE_SERVICE_ACCOUNT` (production + aperçu), puis redéploie. Ne committez jamais ce fichier : il est déjà dans `.gitignore`.

---

## Lancer en local

### Avec les émulateurs (aucun compte nécessaire)

```bash
npm run emulators            # Auth :9099, Firestore :8085
npm run dev:api              # serveur de jeu local (api/game.ts) sur :3001
npx vite --mode emulators    # front ; /api est relayé vers :3001
```

### Simuler plusieurs joueurs dans un seul navigateur

Ajoutez `?tab=<nom>` à l'URL : l'onglet obtient sa propre session anonyme.

### Scripts

| Commande | Effet |
| --- | --- |
| `npm run dev` | front de développement |
| `npm run build` | vérification TypeScript (front + API) et build de production |
| `npm test` | tests du moteur de règles |
| `npm run emulators` / `npm run dev:api` | environnement local complet |
| `npm run deploy:firebase` | déploie les règles Firestore |
| `npm run setup:key -- <clé.json>` | installe la clé de service sur Vercel et redéploie |

---

## Déployer sur Vercel

Le projet Vercel est relié au dépôt GitHub. Variables à définir : `VITE_FIREBASE_*` et `FIREBASE_PROJECT_ID` (déjà en place), plus `FIREBASE_SERVICE_ACCOUNT` (via `npm run setup:key`). [`vercel.json`](vercel.json) gère la réécriture SPA, et `api/game.ts` est automatiquement déployé comme fonction serverless.

---

## Application installable (PWA) et responsive

- **Installable** : manifeste, icônes (dont maskable et Apple), service worker (`vite-plugin-pwa`). Sur Android et ordinateur, le bouton *Installer l'application* de l'accueil lance l'installation ; sur iPhone, il explique *Partager → Sur l'écran d'accueil*. L'appli s'ouvre alors en plein écran, en respectant l'encoche.
- **Responsive** : vérifié sans aucun débordement de 320 px (iPhone SE) à 1920 px (TV), téléphone à l'horizontale compris.
  - **Téléphone vertical** : main en grille de 4 colonnes.
  - **Tablette ou téléphone à l'horizontale** : main sur une seule ligne, adversaires sur deux colonnes.
  - **Plateau grand écran** : calé sur la hauteur de l'écran, sans défilement à partir de 1280 px. Les panneaux joueurs s'adaptent à leur propre largeur (*container queries*) et grossissent sur TV.
- Les icônes se régénèrent à partir de `public/icon.svg` avec `npx pwa-assets-generator`.

---

## Comment jouer

1. **Ordinateur** : *Créer une partie*. Saisissez votre prénom et le nombre maximum de joueurs (2 à 6).
2. L'écran `/screen/CODE` affiche le **code**, le **QR code** et le lien de partage.
3. **Amis** : ils scannent le QR code, indiquent leur prénom et arrivent dans le salon (`/lobby/CODE`).
4. **Hôte** : un second QR code, personnel, permet de transférer *votre* place de joueur sur votre téléphone. Ne le montrez pas aux autres. Vous pouvez aussi jouer depuis l'ordinateur via `/game/CODE`.
5. L'hôte (depuis l'ordinateur ou depuis son téléphone) clique sur **Lancer la partie**.
6. À votre tour, vous avez **déjà pioché**. Toute votre main est visible d'un coup d'œil, sans défilement :
   - **touchez une carte pour la jouer** immédiatement (pour une attaque avec plusieurs adversaires possibles, choisissez la cible) ;
   - pour **défausser**, appuyez sur le bouton *Défausser*, touchez la carte, puis **confirmez**.

   Les cartes injouables sont grisées. Le tour passe ensuite automatiquement au joueur suivant.
7. Quand vous êtes attaqué et que vous tenez la botte correspondante, une fenêtre **Coup fourré ?** s'ouvre pendant 20 secondes.
8. À la victoire : podium, classement et bouton **Rejouer** (réservé à l'hôte).

---

## Règles implémentées

- **But** : atteindre **exactement 1 000 bornes**. Une carte qui ferait dépasser 1 000 est refusée.
- **Distances** : 25, 50, 75, 100 et 200. **Deux cartes 200 au maximum** par joueur.
- **Départ** : chaque joueur commence **à l'arrêt** : il faut un **Feu vert** (ou la botte *Véhicule prioritaire*) pour rouler.
- **Attaques → parades** :

  | Attaque | Parade | Botte (immunité définitive) |
  | --- | --- | --- |
  | Feu rouge | Feu vert | Véhicule prioritaire |
  | Limite de vitesse | Fin de limitation | Véhicule prioritaire |
  | Panne d'essence | Essence | Citerne d'essence |
  | Crevaison | Roue de secours | Increvable |
  | Accident | Réparations | As du volant |

- Un joueur ne peut subir qu'**une attaque bloquante à la fois** (Feu rouge, Panne, Crevaison ou Accident). La **Limite de vitesse** peut s'y ajouter.
- Sous **Limite de vitesse**, seules les cartes **25 et 50** sont jouables.
- Une fois la parade posée, le joueur peut rouler de nouveau (pas de Feu vert supplémentaire à reposer : version simplifiée, plus fluide).
- Une **botte** posée annule les attaques qu'elle couvre, protège pour toute la manche et **donne le droit de rejouer** (avec une nouvelle pioche).
- **Coup fourré** : la cible d'une attaque qui détient la botte correspondante peut la jouer **immédiatement**, dans les 20 secondes. L'attaque est annulée, la botte est posée, le joueur **pioche une carte supplémentaire** et **rejoue**. Passé le délai, l'attaque s'applique normalement.
- **Pioche épuisée** : on continue avec les cartes en main. Quand plus personne n'a de carte, le joueur le plus avancé l'emporte.
- **Paquet** (106 cartes) : distances 25×10, 50×10, 75×10, 100×12, 200×4 ; Feu rouge×5, Limite×4, Panne×3, Crevaison×3, Accident×3 ; Feu vert×14, autres parades×6 ; une botte de chaque.

### Déconnexions

- Chaque appareil envoie un battement de cœur (`heartbeat`) toutes les 10 secondes. Un joueur silencieux depuis 30 secondes est marqué **déconnecté**.
- Si c'est son tour (ou s'il doit répondre à un coup fourré), la partie s'affiche **en pause** partout.
- L'hôte voit un bouton **Retirer**, avec une demande de confirmation. Les cartes du joueur retiré partent à la défausse et le tour passe au suivant. S'il ne reste qu'un joueur, il gagne par forfait. *Rejouer* ramène alors au salon pour accueillir de nouveaux joueurs.
- Un joueur qui revient (même lien, même appareil) retrouve automatiquement sa place.

---

## Architecture et sécurité

```
Téléphone / Écran ──POST /api/game (jeton Firebase)──► Fonction Vercel (transaction Firestore)
        ▲                                                │ valide et applique le coup (api/_lib/engine.ts)
        │                                                ▼
        └──── onSnapshot (temps réel) ◄──── rooms/{code}             état public
                                            rooms/{code}/events/*    journal
                                            rooms/{code}/hands/{id}  main privée (lisible par son seul propriétaire)
                                            rooms/{code}/private/*   pioche et défausse (jamais lisibles)
```

- **Validation 100 % serveur** : [`api/_lib/engine.ts`](api/_lib/engine.ts) vérifie le tour, la propriété de la carte, les distances, la limite, les cibles, les bottes et le coup fourré. La fonction contrôle d'abord le jeton Firebase de l'appelant (`verifyIdToken`).
- **Mains secrètes** : [`firestore.rules`](firestore.rules) ne laisse lire une main qu'à son propriétaire. La pioche, la défausse et la présence sont illisibles.
- **Aucune écriture client** : toutes les règles d'écriture valent `false`. Seule la fonction (SDK Admin) écrit.
- **Concurrence** : chaque action est une transaction Firestore.

---

## Tests

- `npm test` : 9 tests du moteur. Ils couvrent les règles de distance, les attaques et bottes, le coup fourré et son expiration, la déconnexion et le forfait, la reprise de place de l'hôte, et 30 parties complètes jouées automatiquement.
- **Bout en bout avec les émulateurs** : création, arrivée d'un joueur, lancement, coups au toucher et synchronisation en temps réel, via l'API de jeu.

---

## Structure du projet

```
src/                 front React (composants, pages, hooks, lib/firebase.ts, lib/gameEngine.ts)
api/game.ts          serveur de jeu (fonction Vercel)
api/_lib/            engine.ts (règles), actions.ts (transactions Firestore), admin.ts, tests
scripts/             dev-api.ts (API locale), setup-service-account.sh
firestore.rules      règles de sécurité
firebase.json        configuration Firebase et émulateurs
vercel.json          réécriture SPA
```

### Routes

| Route | Écran |
| --- | --- |
| `/` | accueil |
| `/create` | prénom de l'hôte + nombre maximum de joueurs |
| `/join/:roomCode` | rejoindre (`?claim=…` : reprise de place de l'hôte) |
| `/lobby/:roomCode` | salle d'attente mobile |
| `/game/:roomCode` | interface mobile du joueur |
| `/screen/:roomCode` | plateau grand écran |
