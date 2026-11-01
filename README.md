# Route 1000

Jeu de cartes de course multijoueur, inspiré du Mille Bornes, pensé pour jouer entre amis :

- **l'ordinateur** affiche le plateau en grand écran, mis à jour en temps réel ;
- **chaque joueur** rejoint depuis son téléphone (QR code ou lien) et ne voit que **ses propres cartes** ;
- tout passe par Internet (Supabase) : les joueurs n'ont **pas besoin d'être sur le même Wi-Fi**.

Visuels de cartes et illustrations originaux (bornes SVG, icônes Lucide) : aucun visuel officiel n'est repris.

---

## Sommaire

1. [Stack](#stack)
2. [Installation](#installation)
3. [Configurer Supabase](#configurer-supabase)
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
| Icônes | Lucide React |
| QR code | qrcode.react |
| Backend | Supabase : Postgres + RLS + fonctions RPC + Realtime + authentification anonyme |
| Hébergement | Vercel |

---

## Installation

Prérequis : Node.js 20 ou plus, un compte [Supabase](https://supabase.com) (l'offre gratuite suffit).

```bash
npm install
cp .env.example .env
```

---

## Configurer Supabase

### 1. Créer le projet

Sur [supabase.com/dashboard](https://supabase.com/dashboard), cliquez sur **New project**. Choisissez une région proche de vos joueurs (par exemple `eu-west-3`, Paris).

### 2. Activer la connexion anonyme

Les joueurs ne créent pas de compte : chaque appareil reçoit une session anonyme.

**Authentication → Sign In / Providers → Anonymous Sign-Ins → Enable**, puis enregistrez.

> Recommandé : laissez la protection CAPTCHA désactivée pour l'anonyme (sinon il faut l'intégrer côté client), et gardez la limite de débit par défaut.

### 3. Créer le schéma (tables, RLS, RPC, Realtime)

Tout est dans un seul script : [`supabase/migrations/20261101000000_route1000.sql`](supabase/migrations/20261101000000_route1000.sql). Il peut être relancé sans risque (idempotent).

**Option A : éditeur SQL (le plus simple)**
Ouvrez **SQL Editor → New query**, collez tout le contenu du fichier, puis cliquez sur **Run**.

**Option B : Supabase CLI**

```bash
supabase login
supabase link --project-ref <votre-project-ref>
supabase db push
```

Le script :

- crée les tables `rooms`, `players`, `game_cards`, `game_events` (plus `room_secrets`, invisible des clients) ;
- active la RLS partout, **sans aucune politique d'écriture** : les clients ne modifient jamais les tables directement ;
- crée les fonctions RPC (`create_room`, `join_room`, `start_game`, `play_card`, `discard_card`, `respond_coup_fourre`, `heartbeat`, `kick_player`, `restart_game`, `claim_seat`, `get_game_state`) ;
- ajoute `rooms` et `game_events` à la publication `supabase_realtime`.

Pour vérifier le Realtime : **Database → Publications → supabase_realtime**. Les tables `rooms` et `game_events` doivent être cochées.

### 4. Récupérer les clés

**Project Settings → API** (ou **Data API**) :

```dotenv
# .env
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...   # clé « anon » / « publishable », jamais la service_role
VITE_PUBLIC_URL=                       # optionnel, voir plus bas
```

La clé anon est publique par nature : la sécurité repose sur la RLS et les fonctions RPC, pas sur le secret de cette clé.

| Variable | Obligatoire | Rôle |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | oui | URL du projet Supabase |
| `VITE_SUPABASE_ANON_KEY` | oui | Clé publique anon |
| `VITE_PUBLIC_URL` | non | URL utilisée dans les liens et QR codes. Par défaut, l'URL de la page courante. |

---

## Lancer en local

```bash
npm run dev
```

Ouvrez `http://localhost:5173`, cliquez sur **Créer une partie** : l'ordinateur affiche le salon, le code et le QR code.

### Rejoindre avec un vrai téléphone en local

Le QR code reprend l'adresse de la page. Si l'ordinateur est ouvert sur `localhost`, le téléphone ne pourra pas l'atteindre. Deux solutions :

- ouvrez l'ordinateur sur son adresse réseau (Vite l'affiche au démarrage, par exemple `http://192.168.1.20:5173`) ; téléphone et ordinateur doivent alors être sur le même Wi-Fi ;
- ou déployez sur Vercel (section suivante) : n'importe quel téléphone, en 4G ou sur un autre Wi-Fi, peut rejoindre.

### Simuler plusieurs joueurs dans un seul navigateur

Par défaut, tous les onglets d'un même navigateur partagent la même session (donc le même joueur). Ajoutez `?tab=<nom>` à l'URL pour donner à un onglet sa propre session :

```
http://localhost:5173/?tab=alice     → créer la partie
http://localhost:5173/join/AB12CD?tab=bruno
http://localhost:5173/join/AB12CD?tab=chloe
```

La session est mémorisée pour l'onglet. Une fenêtre de navigation privée fonctionne aussi.

### Scripts

| Commande | Effet |
| --- | --- |
| `npm run dev` | serveur de développement (accessible sur le réseau local) |
| `npm run build` | vérification TypeScript et build de production dans `dist/` |
| `npm run preview` | sert le build localement |
| `npm run test:db` | tests SQL sur un Postgres local (voir [Tests](#tests)) |

---

## Déployer sur Vercel

1. Poussez le projet sur GitHub, GitLab ou Bitbucket.
2. Sur [vercel.com/new](https://vercel.com/new), importez le dépôt. Vercel détecte **Vite** : commande `npm run build`, dossier de sortie `dist`.
3. Dans **Environment Variables**, ajoutez `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (et éventuellement `VITE_PUBLIC_URL=https://votre-domaine.vercel.app`).
4. Cliquez sur **Deploy**.

Avec la CLI :

```bash
npm i -g vercel
vercel                      # premier déploiement (aperçu)
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
vercel --prod
```

Le fichier [`vercel.json`](vercel.json) redirige toutes les routes vers `index.html`. Sans lui, un lien direct comme `/join/AB12CD` renverrait une erreur 404.

Aucune configuration d'URL de redirection n'est nécessaire côté Supabase, puisque l'authentification anonyme n'utilise ni e-mail ni OAuth.

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
Téléphone / Écran ──RPC (JWT anonyme)──► Fonctions PostgreSQL (security definer)
        ▲                                     │ valident et appliquent le coup
        │                                     ▼
        └──── Realtime : UPDATE rooms.version ◄── tables (RLS, aucune écriture client)
              puis rechargement via get_game_state (filtré pour l'appelant)
```

- **Validation 100 % serveur** : tour, propriété de la carte, règles de distance, de limite, de cible, de botte et de coup fourré sont vérifiés en PL/pgSQL. Le moteur TypeScript ([`src/lib/gameEngine.ts`](src/lib/gameEngine.ts)) sert seulement à guider l'interface (cartes grisées, choix de cible).
- **Mains secrètes** : les cartes sont des lignes de `game_cards`. La politique RLS ne laisse lire que **ses propres** cartes en main et les cartes posées. La pioche et les mains adverses sont illisibles. `get_game_state` ne renvoie que la main de l'appelant ; pour les autres joueurs, seul le **nombre** de cartes est exposé.
  - `players` ne contient donc pas de colonne `hand` (elle serait lisible par toute la salle) : la main « de chaque joueur » est l'ensemble des lignes `game_cards` où `state = 'hand'`.
- **Aucune écriture directe** : `INSERT`, `UPDATE` et `DELETE` sont révoqués pour `anon` et `authenticated`, et aucune politique d'écriture n'existe. Les fonctions internes (`_draw`, `_begin_turn`…) ne sont pas exécutables par les clients.
- **Hôte** : seul l'hôte (l'ordinateur qui a créé la salle, ou le téléphone qui a repris sa place) peut lancer, relancer ou retirer un joueur.
- **Concurrence** : chaque action verrouille la ligne de la salle (`SELECT … FOR UPDATE`), ce qui évite les doubles coups.
- **Realtime robuste** : chaque action incrémente `rooms.version`. Les clients abonnés rechargent alors leur état filtré. Si le WebSocket tombe, un rafraîchissement périodique prend le relais (toutes les 3 s hors ligne, 15 s en ligne), avec un rechargement au retour au premier plan.

---

## Tests

### Tests SQL (logique et sécurité)

[`supabase/tests/game_scenario.sql`](supabase/tests/game_scenario.sql) rejoue, sur un Postgres local, un scénario complet à deux joueurs :

- création, arrivée, prénom en double refusé ;
- lancement réservé à l'hôte ;
- mains invisibles pour l'adversaire et pour un intrus, pioche invisible, écriture directe interdite ;
- coup hors tour refusé ;
- partie entière jouée automatiquement jusqu'à la victoire ;
- relance réservée à l'hôte ;
- Limite de vitesse, dépassement de 1 000, plus de deux 200 ;
- victoire à 1 000 pile ;
- coup fourré (pioche bonus et rejeu) ;
- retrait d'un joueur.

```bash
# Postgres 15 local requis (ex. brew install postgresql@15) ; aucun Docker nécessaire
npm run test:db
```

[`supabase/tests/local_bootstrap.sql`](supabase/tests/local_bootstrap.sql) simule le minimum de Supabase : rôles, `auth.uid()` et publication Realtime.

### Test de bout en bout

Scénario validé dans le navigateur avec trois onglets (écran 1440×900 et deux téléphones 375×812) :

- création de la salle ;
- arrivée de Bruno par lien ;
- reprise de la place de l'hôte par son QR personnel ;
- lancement ;
- Feu vert ;
- attaque Crevaison avec choix de la cible ;
- synchronisation de l'écran et des téléphones ;
- coup fourré avec compte à rebours ;
- refus d'un dépassement de 1 000 ;
- victoire à 1 000 pile et classement ;
- Rejouer ;
- déconnexion d'un joueur, pause, retrait confirmé par l'hôte ;
- victoire par forfait et retour au salon.

---

## Structure du projet

```
src/
  components/
    game/      Card, PlayerHand, Board, PlayerStatus, AttackArea (+ bottes), DistanceArea,
               GameHeader, TurnIndicator, Results (victoire), PauseControl (déconnexions)
    lobby/     JoinRoom, RoomLobby, QRCodeShare
    ui/        Button, Logo, Notice, ConfirmDialog, FullScreenMessage
  pages/       HomePage, CreateGamePage, JoinGamePage, LobbyPage, GamePage, ScreenPage
  hooks/       useRealtimeRoom (état + Realtime + repli), useGame (actions + présence)
  lib/         supabase (client, session anonyme, RPC), gameEngine (aide aux règles), deck (catalogue)
  types/       game.ts
  routes/      index.tsx
  App.tsx, main.tsx, index.css (thème : bleu nuit, crème, rouge orangé, jaune signalisation)
supabase/
  migrations/  20261101000000_route1000.sql   ← tables, RLS, RPC, Realtime
  tests/       local_bootstrap.sql, game_scenario.sql, run_local.sh
vercel.json    réécriture SPA
```

### Routes

| Route | Écran |
| --- | --- |
| `/` | accueil : *Créer une partie* / *Rejoindre une partie* |
| `/create` | prénom de l'hôte + nombre maximum de joueurs |
| `/join/:roomCode` | rejoindre avec son prénom (`?claim=…` : reprise de place de l'hôte) |
| `/lobby/:roomCode` | salle d'attente mobile |
| `/game/:roomCode` | interface mobile du joueur (main fixée en bas) |
| `/screen/:roomCode` | plateau grand écran (salon avec QR, puis table de jeu) |
