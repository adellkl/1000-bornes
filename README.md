# Route 1000

Jeu de cartes de course multijoueur, inspiré du Mille Bornes, pensé pour jouer entre amis :

- **l'ordinateur** affiche le plateau en grand écran, mis à jour en temps réel ;
- **chaque joueur** rejoint depuis son téléphone (QR code ou lien) et ne voit que **ses propres cartes** ;
- tout passe par Internet (Firebase) : les joueurs n'ont **pas besoin d'être sur le même Wi-Fi**.

Visuels de cartes et illustrations originaux (bornes SVG, icônes Lucide) : aucun visuel officiel n'est repris.

**En ligne** : https://route-1000-coral.vercel.app · Firebase : projet `route-1000-jeu` (région `europe-west1`, Firestore `eur3`) · Code : https://github.com/adellkl/1000-bornes

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

## Stack

| Rôle | Outil |
| --- | --- |
| Front | React 19 + Vite + TypeScript |
| Style | Tailwind CSS v4 (`@tailwindcss/vite`) |
| Routage | React Router (`src/routes/index.tsx`, pages chargées à la demande) |
| Animations | Framer Motion |
| Icônes / QR | Lucide React, qrcode.react |
| Backend | **Firebase** : Authentication (anonyme), Cloud Firestore (temps réel), Cloud Functions (logique de jeu) |
| Hébergement | Vercel (front) + Firebase (Firestore, Functions) |

---

## Installation

Prérequis : Node.js 22, Java 21+ (uniquement pour les émulateurs locaux).

```bash
npm install
npm --prefix functions install
cp .env.example .env
```

---

## Configurer Firebase

1. **Créer le projet** : [console.firebase.google.com](https://console.firebase.google.com) → *Ajouter un projet* (ou `npx firebase projects:create`).
2. **Passer au forfait Blaze** (*Paramètres → Utilisation et facturation*). Les Cloud Functions l'exigent. Le quota gratuit inclus (2 M d'appels par mois) couvre largement des parties entre amis, mais une carte bancaire est demandée.
3. **Authentication → Sign-in method → Anonyme → Activer.**
4. **Firestore Database → Créer une base de données** (mode production, région `eur3` ou `europe-west1`).
5. **Ajouter une application Web** (*Paramètres du projet → Vos applications → </>*) et recopier la configuration dans `.env` :

```dotenv
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=mon-projet.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=mon-projet
VITE_FIREBASE_APP_ID=1:123:web:abc
VITE_FIREBASE_REGION=europe-west1
VITE_PUBLIC_URL=              # optionnel : URL utilisée dans les QR codes
```

Ces valeurs sont publiques par nature : la sécurité repose sur les règles Firestore et les Cloud Functions.

6. **Déployer les règles et les fonctions** :

```bash
npx firebase login
npx firebase use mon-projet
npm run deploy:firebase      # = firebase deploy --only firestore,functions
```

---

## Lancer en local

### Avec les émulateurs (aucun compte nécessaire)

```bash
npm run emulators            # Auth :9099, Firestore :8085, Functions :5001
npx vite --mode emulators    # dans un 2ᵉ terminal (lit .env.emulators)
```

### Contre le vrai projet Firebase

```bash
npm run dev
```

Pour rejoindre avec un vrai téléphone en local, ouvrez l'ordinateur sur son adresse réseau (`http://192.168.x.x:5173`, affichée par Vite), car le QR code reprend l'adresse de la page. En production (Vercel), n'importe quel téléphone, en 4G ou sur un autre Wi-Fi, peut rejoindre.

### Simuler plusieurs joueurs dans un seul navigateur

Ajoutez `?tab=<nom>` à l'URL : l'onglet obtient sa propre session anonyme.

```
http://localhost:5173/create?tab=ecran
http://localhost:5173/join/AB12CD?tab=bruno
```

### Scripts

| Commande | Effet |
| --- | --- |
| `npm run dev` | serveur de développement |
| `npm run build` | vérification TypeScript et build de production (`dist/`) |
| `npm test` | tests du moteur de règles (Cloud Functions) |
| `npm run emulators` | émulateurs Firebase locaux |
| `npm run deploy:firebase` | déploie les règles Firestore et les Cloud Functions |

---

## Déployer sur Vercel

1. Importez le dépôt GitHub sur [vercel.com/new](https://vercel.com/new). Vercel détecte **Vite** (`npm run build`, sortie `dist`).
2. Ajoutez les variables `VITE_FIREBASE_*` (et `VITE_PUBLIC_URL=https://votre-app.vercel.app`) dans *Settings → Environment Variables*.
3. Déployez. [`vercel.json`](vercel.json) redirige toutes les routes vers `index.html`.
4. Dans Firebase, ajoutez le domaine Vercel dans *Authentication → Settings → Authorized domains*.

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
Téléphone / Écran ──httpsCallable (jeton anonyme)──► Cloud Functions (transaction Firestore)
        ▲                                               │ valident et appliquent le coup (engine.ts)
        │                                               ▼
        └──── onSnapshot (temps réel) ◄──── rooms/{code}             état public
                                            rooms/{code}/events/*    journal
                                            rooms/{code}/hands/{id}  main privée (lisible par son seul propriétaire)
                                            rooms/{code}/private/*   pioche et défausse (jamais lisibles)
```

- **Validation 100 % serveur** : tour, propriété de la carte, distances, limite, cibles, bottes et coup fourré sont vérifiés dans [`functions/src/engine.ts`](functions/src/engine.ts), exécuté par les Cloud Functions. Le moteur côté navigateur ([`src/lib/gameEngine.ts`](src/lib/gameEngine.ts)) ne fait que griser les cartes.
- **Mains secrètes** : [`firestore.rules`](firestore.rules) n'autorise la lecture d'une main que si `uid == request.auth.uid`. La pioche (`private/state`) et la présence sont illisibles. Les autres joueurs ne voient que le **nombre** de cartes.
- **Aucune écriture client** : toutes les règles d'écriture valent `false`. Seules les Functions (SDK Admin) modifient les données.
- **Hôte** : seul l'hôte (l'ordinateur qui a créé la salle, ou le téléphone qui a repris sa place via son QR personnel) peut lancer, relancer ou retirer un joueur.
- **Concurrence** : chaque action est une transaction Firestore, ce qui empêche les doubles coups.

---

## Tests

- `npm test` : 9 tests du moteur. Ils couvrent l'arrivée des joueurs, le lancement réservé à l'hôte, les coups hors tour, les règles de distance (Feu rouge, limite, 1 000 pile, deux 200 au maximum), les attaques, parades et bottes, le coup fourré et son expiration, la déconnexion, le retrait et le forfait, la reprise de place, et 30 parties complètes jouées automatiquement.
- **Bout en bout avec les émulateurs** : un écran et deux téléphones dans le navigateur. Le scénario couvre la création, la reprise de place de l'hôte, l'arrivée d'une joueuse, le lancement, le jeu au toucher, une attaque et la synchronisation de l'écran. La sécurité a aussi été vérifiée : lire la main adverse ou la pioche, ou modifier la salle, renvoie **403**.

---

## Structure du projet

```
src/                 front React (composants, pages, hooks, lib/firebase.ts, lib/gameEngine.ts)
functions/src/       engine.ts (règles), index.ts (Cloud Functions), engine.test.ts
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
