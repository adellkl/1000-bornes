-- =====================================================================
--  Route 1000 — schéma Supabase complet
--  Tables, index, RLS, fonctions RPC (toute la logique de jeu) et Realtime.
--
--  À exécuter tel quel dans l'éditeur SQL de Supabase,
--  ou via `supabase db push` (fichier de migration).
--
--  Principe de sécurité :
--   * Les clients n'écrivent JAMAIS directement dans les tables :
--     aucune politique INSERT / UPDATE / DELETE n'est définie.
--   * Toutes les actions passent par des fonctions RPC `security definer`
--     qui valident le coup côté serveur (tour, main, règles…).
--   * La main d'un joueur est stockée dans `game_cards` (state = 'hand') :
--     la politique RLS ne laisse lire que ses propres cartes, et
--     `get_game_state` ne renvoie que la main de l'appelant.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
--  Tables
-- ---------------------------------------------------------------------

create table if not exists public.rooms (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,
  host_id           uuid not null,                 -- auth.uid() de l'ordinateur hôte
  host_player_id    uuid,                          -- place de joueur de l'hôte
  status            text not null default 'lobby'
                      check (status in ('lobby', 'playing', 'finished')),
  max_players       int  not null default 4 check (max_players between 2 and 6),
  current_player_id uuid,
  winner_id         uuid,
  pending_attack    jsonb,                         -- fenêtre de coup fourré en cours
  turn_number       int  not null default 0,
  version           bigint not null default 0,     -- incrémenté à chaque action (déclenche le Realtime)
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists public.players (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid not null references public.rooms(id) on delete cascade,
  user_id       uuid not null,
  name          text not null check (char_length(name) between 1 and 20),
  position      int  not null,
  distance      int  not null default 0 check (distance between 0 and 1000),
  -- La main n'est PAS stockée ici (elle serait lisible par les autres joueurs) :
  -- elle vit dans game_cards (state = 'hand'), protégée par RLS.
  attacks       text[] not null default '{}',      -- attaques en cours subies
  protections   text[] not null default '{}',      -- bottes posées
  coup_fourres  text[] not null default '{}',      -- bottes posées en coup fourré
  count_200     int  not null default 0,
  is_connected  boolean not null default true,
  last_seen     timestamptz not null default now(),
  joined_at     timestamptz not null default now(),
  unique (room_id, user_id),
  unique (room_id, position)
);

create table if not exists public.game_cards (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.rooms(id) on delete cascade,
  player_id  uuid references public.players(id) on delete set null,
  type       text not null check (type in ('distance', 'attack', 'remedy', 'safety')),
  value      text not null,
  state      text not null check (state in ('deck', 'hand', 'played', 'discard')),
  sort_order bigint not null default 0
);

create table if not exists public.game_events (
  id         bigint generated always as identity primary key,
  room_id    uuid not null references public.rooms(id) on delete cascade,
  player_id  uuid,
  action     text not null,
  payload    jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Secrets de salle (jeton permettant à l'hôte de reprendre sa place sur son téléphone).
-- Aucune politique RLS : illisible depuis le client.
create table if not exists public.room_secrets (
  room_id     uuid primary key references public.rooms(id) on delete cascade,
  claim_token uuid not null default gen_random_uuid()
);

create sequence if not exists public.game_cards_seq;

create index if not exists players_room_idx     on public.players (room_id, position);
create index if not exists players_user_idx     on public.players (user_id);
create index if not exists game_cards_room_idx  on public.game_cards (room_id, state, sort_order);
create index if not exists game_cards_owner_idx on public.game_cards (player_id, state);
create index if not exists game_events_room_idx on public.game_events (room_id, id desc);

-- ---------------------------------------------------------------------
--  Row Level Security
-- ---------------------------------------------------------------------

alter table public.rooms        enable row level security;
alter table public.players      enable row level security;
alter table public.game_cards   enable row level security;
alter table public.game_events  enable row level security;
alter table public.room_secrets enable row level security;

create or replace function public.is_room_member(p_room uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from players where room_id = p_room and user_id = auth.uid())
      or exists (select 1 from rooms   where id = p_room and host_id = auth.uid());
$$;

-- Les salles sont lisibles (code, statut) par tout utilisateur authentifié :
-- nécessaire pour rejoindre et pour recevoir les notifications Realtime.
drop policy if exists rooms_select on public.rooms;
create policy rooms_select on public.rooms
  for select to authenticated using (true);

drop policy if exists players_select on public.players;
create policy players_select on public.players
  for select to authenticated using (public.is_room_member(room_id));

-- Cartes : uniquement SES cartes en main, ou les cartes visibles de tous (posées / défaussées).
-- Les cartes de la pioche et des mains adverses ne sont jamais lisibles.
drop policy if exists game_cards_select on public.game_cards;
create policy game_cards_select on public.game_cards
  for select to authenticated using (
    (state = 'hand' and player_id in (select id from public.players where user_id = auth.uid()))
    or (state in ('played', 'discard') and public.is_room_member(room_id))
  );

drop policy if exists game_events_select on public.game_events;
create policy game_events_select on public.game_events
  for select to authenticated using (public.is_room_member(room_id));

-- Aucune politique d'écriture : seules les fonctions RPC ci-dessous modifient les données.

-- ---------------------------------------------------------------------
--  Données de référence : composition du paquet (106 cartes)
-- ---------------------------------------------------------------------

create or replace function public._deck_composition()
returns table (card_type text, card_value text, qty int)
language sql
immutable
as $$
  select * from (values
    ('distance', '25',  10), ('distance', '50',  10), ('distance', '75', 10),
    ('distance', '100', 12), ('distance', '200', 4),
    ('attack', 'feu_rouge', 5), ('attack', 'limite', 4), ('attack', 'panne', 3),
    ('attack', 'crevaison', 3), ('attack', 'accident', 3),
    ('remedy', 'feu_vert', 14), ('remedy', 'fin_limite', 6), ('remedy', 'essence', 6),
    ('remedy', 'roue_secours', 6), ('remedy', 'reparations', 6),
    ('safety', 'vehicule_prioritaire', 1), ('safety', 'citerne', 1),
    ('safety', 'increvable', 1), ('safety', 'as_du_volant', 1)
  ) as t (card_type, card_value, qty);
$$;

-- Attaque → botte qui la neutralise
create or replace function public._safety_for(p_attack text)
returns text language sql immutable as $$
  select case p_attack
    when 'feu_rouge' then 'vehicule_prioritaire'
    when 'limite'    then 'vehicule_prioritaire'
    when 'panne'     then 'citerne'
    when 'crevaison' then 'increvable'
    when 'accident'  then 'as_du_volant'
  end;
$$;

-- Parade → attaque qu'elle répare
create or replace function public._attack_for_remedy(p_remedy text)
returns text language sql immutable as $$
  select case p_remedy
    when 'feu_vert'     then 'feu_rouge'
    when 'fin_limite'   then 'limite'
    when 'essence'      then 'panne'
    when 'roue_secours' then 'crevaison'
    when 'reparations'  then 'accident'
  end;
$$;

-- Botte → attaques couvertes
create or replace function public._covered_by(p_safety text)
returns text[] language sql immutable as $$
  select case p_safety
    when 'vehicule_prioritaire' then array['feu_rouge', 'limite']
    when 'citerne'              then array['panne']
    when 'increvable'           then array['crevaison']
    when 'as_du_volant'         then array['accident']
    else array[]::text[]
  end;
$$;

-- Attaques qui immobilisent (la limite de vitesse, elle, ralentit seulement)
create or replace function public._hazards()
returns text[] language sql immutable as $$
  select array['feu_rouge', 'panne', 'crevaison', 'accident'];
$$;

-- ---------------------------------------------------------------------
--  Fonctions internes (non exposées aux clients)
-- ---------------------------------------------------------------------

create or replace function public._uid()
returns uuid language plpgsql stable as $$
begin
  if auth.uid() is null then
    raise exception 'Session expirée : rechargez la page.';
  end if;
  return auth.uid();
end;
$$;

create or replace function public._gen_code()
returns text language plpgsql as $$
declare
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code  text;
begin
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    end loop;
    exit when not exists (select 1 from rooms where code = v_code);
  end loop;
  return v_code;
end;
$$;

-- Verrouille la salle pour sérialiser les actions concurrentes
create or replace function public._lock_room(p_code text)
returns public.rooms language plpgsql as $$
declare
  r rooms;
begin
  select * into r from rooms where code = upper(trim(p_code)) for update;
  if not found then
    raise exception 'Salle introuvable.';
  end if;
  return r;
end;
$$;

create or replace function public._require_me(p_room uuid)
returns public.players language plpgsql as $$
declare
  v_me players;
begin
  select * into v_me from players where room_id = p_room and user_id = _uid();
  if not found then
    raise exception 'Vous ne faites pas partie de cette partie.';
  end if;
  return v_me;
end;
$$;

create or replace function public._is_host(r public.rooms)
returns boolean language sql stable as $$
  select auth.uid() is not null and (
    r.host_id = auth.uid()
    or exists (select 1 from players where id = r.host_player_id and user_id = auth.uid())
  );
$$;

create or replace function public._bump(p_room uuid)
returns void language sql as $$
  update rooms set version = version + 1, updated_at = now() where id = p_room;
$$;

create or replace function public._log(p_room uuid, p_player uuid, p_action text, p_payload jsonb default '{}')
returns void language sql as $$
  insert into game_events (room_id, player_id, action, payload)
  values (p_room, p_player, p_action, coalesce(p_payload, '{}'));
$$;

create or replace function public._hand_count(p_player uuid)
returns int language sql stable as $$
  select count(*)::int from game_cards where player_id = p_player and state = 'hand';
$$;

create or replace function public._deck_count(p_room uuid)
returns int language sql stable as $$
  select count(*)::int from game_cards where room_id = p_room and state = 'deck';
$$;

-- Pioche la carte du dessus ; renvoie null si la pioche est vide
create or replace function public._draw(p_room uuid, p_player uuid)
returns uuid language plpgsql as $$
declare
  v_id uuid;
begin
  select id into v_id from game_cards
   where room_id = p_room and state = 'deck'
   order by sort_order
   limit 1
   for update;
  if v_id is null then
    return null;
  end if;
  update game_cards
     set state = 'hand', player_id = p_player, sort_order = nextval('game_cards_seq')
   where id = v_id;
  return v_id;
end;
$$;

-- Déplace une carte vers la table (posée devant p_owner) ou la défausse
create or replace function public._move_card(p_card uuid, p_state text, p_owner uuid)
returns void language sql as $$
  update game_cards
     set state = p_state, player_id = p_owner, sort_order = nextval('game_cards_seq')
   where id = p_card;
$$;

create or replace function public._next_player(p_room uuid, p_after uuid)
returns uuid language plpgsql stable as $$
declare
  v_pos  int;
  v_next uuid;
begin
  select position into v_pos from players where id = p_after;
  select id into v_next from players
   where room_id = p_room and position > coalesce(v_pos, -1)
   order by position limit 1;
  if v_next is null then
    select id into v_next from players where room_id = p_room order by position limit 1;
  end if;
  return v_next;
end;
$$;

create or replace function public._finish(p_room uuid, p_winner uuid, p_reason text)
returns void language plpgsql as $$
begin
  update rooms
     set status = 'finished', winner_id = p_winner, current_player_id = null, pending_attack = null
   where id = p_room;
  perform _log(p_room, p_winner, 'finish', jsonb_build_object(
    'reason', p_reason,
    'winner_name', (select name from players where id = p_winner)
  ));
end;
$$;

create or replace function public._finish_by_distance(p_room uuid)
returns void language plpgsql as $$
declare
  v_winner uuid;
begin
  select id into v_winner from players where room_id = p_room
   order by distance desc, position asc limit 1;
  perform _finish(p_room, v_winner, 'deck_empty');
end;
$$;

-- Début de tour : le joueur pioche automatiquement.
-- Les joueurs sans carte (pioche vide) sont sautés ; si plus personne n'a de carte, fin de partie.
create or replace function public._begin_turn(p_room uuid, p_player uuid)
returns void language plpgsql as $$
declare
  v_player uuid := p_player;
  v_count  int;
  v_tries  int := 0;
begin
  select count(*) into v_count from players where room_id = p_room;
  loop
    exit when _deck_count(p_room) > 0 or _hand_count(v_player) > 0;
    v_tries := v_tries + 1;
    if v_tries > v_count then
      perform _finish_by_distance(p_room);
      return;
    end if;
    v_player := _next_player(p_room, v_player);
  end loop;

  update rooms
     set current_player_id = v_player, turn_number = turn_number + 1
   where id = p_room;
  perform _draw(p_room, v_player);
end;
$$;

-- Résout une fenêtre de coup fourré expirée (le joueur n'a pas réagi à temps)
create or replace function public._resolve_expired(p_room uuid)
returns boolean language plpgsql as $$
declare
  v_pending jsonb;
begin
  select pending_attack into v_pending from rooms where id = p_room;
  if v_pending is null or (v_pending ->> 'expires_at')::timestamptz > now() then
    return false;
  end if;
  update rooms set pending_attack = null where id = p_room;
  perform _begin_turn(p_room, _next_player(p_room, (v_pending ->> 'attacker_id')::uuid));
  return true;
end;
$$;

create or replace function public._deal(p_room uuid)
returns void language plpgsql as $$
declare
  p record;
begin
  delete from game_cards where room_id = p_room;
  insert into game_cards (room_id, type, value, state, sort_order)
  select p_room, c.card_type, c.card_value, 'deck', row_number() over (order by random())
    from _deck_composition() c
    cross join lateral generate_series(1, c.qty);

  update players
     set distance = 0, attacks = array['feu_rouge'], protections = '{}',
         coup_fourres = '{}', count_200 = 0
   where room_id = p_room;

  for p in select id from players where room_id = p_room order by position loop
    for i in 1..6 loop
      perform _draw(p_room, p.id);
    end loop;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
--  RPC publiques
-- ---------------------------------------------------------------------

create or replace function public.create_room(p_name text, p_max_players int default 4)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_uid    uuid := _uid();
  v_name   text := trim(coalesce(p_name, ''));
  v_room   uuid;
  v_player uuid;
  v_code   text;
begin
  if char_length(v_name) < 1 or char_length(v_name) > 20 then
    raise exception 'Le prénom doit faire entre 1 et 20 caractères.';
  end if;
  if p_max_players is null or p_max_players < 2 or p_max_players > 6 then
    raise exception 'Le nombre de joueurs doit être compris entre 2 et 6.';
  end if;

  v_code := _gen_code();
  insert into rooms (code, host_id, max_players)
  values (v_code, v_uid, p_max_players)
  returning id into v_room;

  insert into players (room_id, user_id, name, position)
  values (v_room, v_uid, v_name, 0)
  returning id into v_player;

  update rooms set host_player_id = v_player where id = v_room;
  insert into room_secrets (room_id) values (v_room);
  perform _log(v_room, v_player, 'join', jsonb_build_object('name', v_name));
  return v_code;
end;
$$;

create or replace function public.join_room(p_code text, p_name text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_uid  uuid := _uid();
  v_name text := trim(coalesce(p_name, ''));
  r      rooms;
  v_id   uuid;
begin
  if char_length(v_name) < 1 or char_length(v_name) > 20 then
    raise exception 'Le prénom doit faire entre 1 et 20 caractères.';
  end if;
  r := _lock_room(p_code);

  select id into v_id from players where room_id = r.id and user_id = v_uid;
  if v_id is not null then
    update players set name = v_name, last_seen = now(), is_connected = true where id = v_id;
    perform _bump(r.id);
    return v_id;
  end if;

  if r.status <> 'lobby' then
    raise exception 'La partie a déjà commencé.';
  end if;
  if (select count(*) from players where room_id = r.id) >= r.max_players then
    raise exception 'La salle est complète.';
  end if;
  if exists (select 1 from players where room_id = r.id and lower(name) = lower(v_name)) then
    raise exception 'Ce prénom est déjà pris dans cette salle.';
  end if;

  insert into players (room_id, user_id, name, position)
  values (r.id, v_uid, v_name,
          coalesce((select max(position) + 1 from players where room_id = r.id), 0))
  returning id into v_id;

  perform _log(r.id, v_id, 'join', jsonb_build_object('name', v_name));
  perform _bump(r.id);
  return v_id;
end;
$$;

-- L'hôte scanne son QR personnel : sa place de joueur passe sur son téléphone.
create or replace function public.claim_seat(p_code text, p_token uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := _uid();
  r     rooms;
begin
  r := _lock_room(p_code);
  if not exists (select 1 from room_secrets where room_id = r.id and claim_token = p_token) then
    raise exception 'Lien de reprise invalide.';
  end if;
  if exists (select 1 from players where room_id = r.id and user_id = v_uid and id <> r.host_player_id) then
    raise exception 'Cet appareil occupe déjà une autre place dans la partie.';
  end if;
  update players set user_id = v_uid, last_seen = now(), is_connected = true
   where id = r.host_player_id;
  perform _bump(r.id);
  return r.host_player_id;
end;
$$;

create or replace function public.start_game(p_code text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  r       rooms;
  v_first uuid;
begin
  r := _lock_room(p_code);
  if not _is_host(r) then
    raise exception 'Seul l''hôte peut lancer la partie.';
  end if;
  if r.status <> 'lobby' then
    raise exception 'La partie est déjà lancée.';
  end if;
  if (select count(*) from players where room_id = r.id) < 2 then
    raise exception 'Il faut au moins 2 joueurs pour lancer la partie.';
  end if;

  perform _deal(r.id);
  update rooms set status = 'playing', winner_id = null, pending_attack = null, turn_number = 0
   where id = r.id;
  select id into v_first from players where room_id = r.id order by position limit 1;
  perform _log(r.id, null, 'start', '{}');
  perform _begin_turn(r.id, v_first);
  perform _bump(r.id);
end;
$$;

create or replace function public.restart_game(p_code text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  r       rooms;
  v_first uuid;
begin
  r := _lock_room(p_code);
  if not _is_host(r) then
    raise exception 'Seul l''hôte peut relancer la partie.';
  end if;
  if r.status = 'lobby' then
    raise exception 'La partie n''a pas encore commencé.';
  end if;
  -- Moins de 2 joueurs (retraits) : retour au salon pour accueillir de nouveaux pilotes
  if (select count(*) from players where room_id = r.id) < 2 then
    delete from game_cards where room_id = r.id;
    update players
       set distance = 0, attacks = '{}', protections = '{}', coup_fourres = '{}', count_200 = 0
     where room_id = r.id;
    update rooms
       set status = 'lobby', winner_id = null, pending_attack = null, current_player_id = null
     where id = r.id;
    perform _log(r.id, null, 'restart', '{}');
    perform _bump(r.id);
    return;
  end if;

  perform _deal(r.id);
  update rooms set status = 'playing', winner_id = null, pending_attack = null, turn_number = 0
   where id = r.id;
  -- Le perdant de la manche précédente (ou le suivant du gagnant) commence
  v_first := _next_player(r.id, coalesce(r.winner_id, r.host_player_id));
  perform _log(r.id, null, 'restart', '{}');
  perform _begin_turn(r.id, v_first);
  perform _bump(r.id);
end;
$$;

create or replace function public.play_card(p_code text, p_card_id uuid, p_target_id uuid default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  r         rooms;
  v_me      players;
  v_tgt     players;
  v_card    game_cards;
  v_val     int;
  v_attack  text;
  v_safety  text;
  v_covered text[];
begin
  r := _lock_room(p_code);
  perform _resolve_expired(r.id);
  select * into r from rooms where id = r.id;

  if r.status <> 'playing' then
    raise exception 'La partie n''est pas en cours.';
  end if;
  v_me := _require_me(r.id);
  if r.pending_attack is not null then
    raise exception 'En attente de la réaction d''un joueur attaqué.';
  end if;
  if r.current_player_id is distinct from v_me.id then
    raise exception 'Ce n''est pas votre tour.';
  end if;

  select * into v_card from game_cards
   where id = p_card_id and room_id = r.id and state = 'hand' and player_id = v_me.id
   for update;
  if not found then
    raise exception 'Cette carte n''est pas dans votre main.';
  end if;

  -- ---------------- Distance ----------------
  if v_card.type = 'distance' then
    v_val := v_card.value::int;
    if 'feu_rouge' = any (v_me.attacks) then
      raise exception 'Feu rouge : il vous faut un Feu vert pour rouler.';
    end if;
    if v_me.attacks && _hazards() then
      raise exception 'Vous êtes immobilisé : posez d''abord la parade.';
    end if;
    if 'limite' = any (v_me.attacks) and v_val > 50 then
      raise exception 'Limite de vitesse : seules les cartes 25 et 50 sont autorisées.';
    end if;
    if v_me.distance + v_val > 1000 then
      raise exception 'Impossible : vous dépasseriez 1 000 bornes.';
    end if;
    if v_val = 200 and v_me.count_200 >= 2 then
      raise exception 'Maximum deux cartes 200 bornes par joueur.';
    end if;

    update players
       set distance = distance + v_val,
           count_200 = count_200 + (case when v_val = 200 then 1 else 0 end)
     where id = v_me.id;
    perform _move_card(v_card.id, 'played', v_me.id);
    perform _log(r.id, v_me.id, 'play_distance', jsonb_build_object(
      'card_type', v_card.type, 'card_value', v_card.value,
      'player_name', v_me.name, 'distance', v_me.distance + v_val));

    if v_me.distance + v_val = 1000 then
      perform _finish(r.id, v_me.id, 'exact_1000');
    else
      perform _begin_turn(r.id, _next_player(r.id, v_me.id));
    end if;

  -- ---------------- Parade ----------------
  elsif v_card.type = 'remedy' then
    v_attack := _attack_for_remedy(v_card.value);
    if not (v_attack = any (v_me.attacks)) then
      raise exception 'Aucune attaque à réparer avec cette carte.';
    end if;
    update players set attacks = array_remove(attacks, v_attack) where id = v_me.id;
    perform _move_card(v_card.id, 'played', v_me.id);
    perform _log(r.id, v_me.id, 'play_remedy', jsonb_build_object(
      'card_type', v_card.type, 'card_value', v_card.value, 'player_name', v_me.name));
    perform _begin_turn(r.id, _next_player(r.id, v_me.id));

  -- ---------------- Attaque ----------------
  elsif v_card.type = 'attack' then
    if p_target_id is null then
      raise exception 'Choisissez un adversaire à attaquer.';
    end if;
    select * into v_tgt from players where id = p_target_id and room_id = r.id for update;
    if not found then
      raise exception 'Adversaire introuvable.';
    end if;
    if v_tgt.id = v_me.id then
      raise exception 'Vous ne pouvez pas vous attaquer vous-même.';
    end if;
    v_safety := _safety_for(v_card.value);
    if v_safety = any (v_tgt.protections) then
      raise exception '% est protégé contre cette attaque.', v_tgt.name;
    end if;
    if v_card.value = 'limite' then
      if 'limite' = any (v_tgt.attacks) then
        raise exception '% est déjà sous limitation de vitesse.', v_tgt.name;
      end if;
    elsif v_tgt.attacks && _hazards() then
      raise exception '% est déjà immobilisé.', v_tgt.name;
    end if;

    update players set attacks = array_append(attacks, v_card.value) where id = v_tgt.id;
    perform _move_card(v_card.id, 'played', v_tgt.id);
    perform _log(r.id, v_me.id, 'play_attack', jsonb_build_object(
      'card_type', v_card.type, 'card_value', v_card.value, 'player_name', v_me.name,
      'target_id', v_tgt.id, 'target_name', v_tgt.name));

    -- Coup fourré possible ? On ouvre une fenêtre de réaction de 20 secondes.
    if exists (select 1 from game_cards
                where player_id = v_tgt.id and state = 'hand' and value = v_safety) then
      update rooms set pending_attack = jsonb_build_object(
        'target_id', v_tgt.id, 'attacker_id', v_me.id, 'attack', v_card.value,
        'expires_at', now() + interval '20 seconds')
       where id = r.id;
    else
      perform _begin_turn(r.id, _next_player(r.id, v_me.id));
    end if;

  -- ---------------- Botte ----------------
  elsif v_card.type = 'safety' then
    v_covered := _covered_by(v_card.value);
    update players
       set protections = array_append(protections, v_card.value),
           attacks = array(select a from unnest(attacks) a where not (a = any (v_covered)))
     where id = v_me.id;
    perform _move_card(v_card.id, 'played', v_me.id);
    perform _log(r.id, v_me.id, 'play_safety', jsonb_build_object(
      'card_type', v_card.type, 'card_value', v_card.value, 'player_name', v_me.name));
    -- Une botte donne le droit de rejouer (nouvelle pioche)
    perform _begin_turn(r.id, v_me.id);
  end if;

  perform _bump(r.id);
end;
$$;

create or replace function public.discard_card(p_code text, p_card_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  r      rooms;
  v_me   players;
  v_card game_cards;
begin
  r := _lock_room(p_code);
  perform _resolve_expired(r.id);
  select * into r from rooms where id = r.id;

  if r.status <> 'playing' then
    raise exception 'La partie n''est pas en cours.';
  end if;
  v_me := _require_me(r.id);
  if r.pending_attack is not null then
    raise exception 'En attente de la réaction d''un joueur attaqué.';
  end if;
  if r.current_player_id is distinct from v_me.id then
    raise exception 'Ce n''est pas votre tour.';
  end if;

  select * into v_card from game_cards
   where id = p_card_id and room_id = r.id and state = 'hand' and player_id = v_me.id
   for update;
  if not found then
    raise exception 'Cette carte n''est pas dans votre main.';
  end if;

  perform _move_card(v_card.id, 'discard', null);
  perform _log(r.id, v_me.id, 'discard', jsonb_build_object(
    'card_type', v_card.type, 'card_value', v_card.value, 'player_name', v_me.name));
  perform _begin_turn(r.id, _next_player(r.id, v_me.id));
  perform _bump(r.id);
end;
$$;

-- Réponse du joueur attaqué : jouer sa botte en coup fourré (p_accept = true) ou laisser passer.
create or replace function public.respond_coup_fourre(p_code text, p_accept boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  r         rooms;
  v_me      players;
  v_pending jsonb;
  v_attack  text;
  v_safety  text;
  v_card    uuid;
begin
  r := _lock_room(p_code);
  v_me := _require_me(r.id);
  v_pending := r.pending_attack;
  if v_pending is null or (v_pending ->> 'target_id')::uuid <> v_me.id then
    raise exception 'Aucune attaque en attente de votre réaction.';
  end if;
  if (v_pending ->> 'expires_at')::timestamptz < now() then
    perform _resolve_expired(r.id);
    perform _bump(r.id);
    raise exception 'Trop tard : le délai du coup fourré est écoulé.';
  end if;

  update rooms set pending_attack = null where id = r.id;

  if not p_accept then
    perform _begin_turn(r.id, _next_player(r.id, (v_pending ->> 'attacker_id')::uuid));
    perform _bump(r.id);
    return;
  end if;

  v_attack := v_pending ->> 'attack';
  v_safety := _safety_for(v_attack);
  select id into v_card from game_cards
   where player_id = v_me.id and state = 'hand' and value = v_safety
   limit 1 for update;
  if v_card is null then
    raise exception 'Vous n''avez pas la botte correspondante.';
  end if;

  update players
     set protections  = array_append(protections, v_safety),
         coup_fourres = array_append(coup_fourres, v_safety),
         attacks = array(select a from unnest(attacks) a where not (a = any (_covered_by(v_safety))))
   where id = v_me.id;
  perform _move_card(v_card, 'played', v_me.id);
  perform _log(r.id, v_me.id, 'coup_fourre', jsonb_build_object(
    'card_type', 'safety', 'card_value', v_safety, 'attack', v_attack, 'player_name', v_me.name));

  -- Pioche supplémentaire, puis le joueur rejoue (son tour commence avec la pioche normale)
  perform _draw(r.id, v_me.id);
  perform _begin_turn(r.id, v_me.id);
  perform _bump(r.id);
end;
$$;

-- Battement de cœur (toutes les ~10 s) + entretien : détecte les déconnexions,
-- expire les fenêtres de coup fourré.
create or replace function public.heartbeat(p_code text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  r         rooms;
  v_changed boolean := false;
  v_n       int;
begin
  r := _lock_room(p_code);

  update players set last_seen = now(), is_connected = true
   where room_id = r.id and user_id = _uid() and not is_connected;
  get diagnostics v_n = row_count;
  v_changed := v_n > 0;

  update players set last_seen = now()
   where room_id = r.id and user_id = auth.uid();

  update players set is_connected = false
   where room_id = r.id and is_connected and last_seen < now() - interval '30 seconds';
  get diagnostics v_n = row_count;
  v_changed := v_changed or v_n > 0;

  if r.status = 'playing' and _resolve_expired(r.id) then
    v_changed := true;
  end if;

  if v_changed then
    perform _bump(r.id);
  end if;
end;
$$;

-- L'hôte retire un joueur (déconnecté ou non). Ses cartes en main partent à la défausse.
create or replace function public.kick_player(p_code text, p_player_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  r         rooms;
  v_tgt     players;
  v_next    uuid;
  v_left    int;
begin
  r := _lock_room(p_code);
  if not _is_host(r) then
    raise exception 'Seul l''hôte peut retirer un joueur.';
  end if;
  select * into v_tgt from players where id = p_player_id and room_id = r.id;
  if not found then
    raise exception 'Joueur introuvable.';
  end if;
  if v_tgt.id = r.host_player_id then
    raise exception 'L''hôte ne peut pas se retirer lui-même.';
  end if;

  v_next := _next_player(r.id, v_tgt.id);
  update game_cards set state = 'discard', player_id = null, sort_order = nextval('game_cards_seq')
   where room_id = r.id and player_id = v_tgt.id and state = 'hand';
  update game_cards set player_id = null where room_id = r.id and player_id = v_tgt.id;
  delete from players where id = v_tgt.id;
  perform _log(r.id, null, 'kick', jsonb_build_object('name', v_tgt.name));

  if r.status = 'playing' then
    select count(*) into v_left from players where room_id = r.id;
    if v_left < 2 then
      perform _finish(r.id, (select id from players where room_id = r.id limit 1), 'forfeit');
    elsif r.pending_attack is not null
          and ((r.pending_attack ->> 'target_id')::uuid = v_tgt.id
               or (r.pending_attack ->> 'attacker_id')::uuid = v_tgt.id) then
      update rooms set pending_attack = null where id = r.id;
      perform _begin_turn(r.id, v_next);
    elsif r.current_player_id = v_tgt.id then
      perform _begin_turn(r.id, v_next);
    end if;
  end if;
  perform _bump(r.id);
end;
$$;

-- État complet de la partie, filtré pour l'appelant (seule SA main est renvoyée).
create or replace function public.get_game_state(p_code text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  r    rooms;
  v_me players;
begin
  select * into r from rooms where code = upper(trim(p_code));
  if not found then
    raise exception 'Salle introuvable.';
  end if;
  select * into v_me from players where room_id = r.id and user_id = _uid();

  return jsonb_build_object(
    'room', jsonb_build_object(
      'id', r.id,
      'code', r.code,
      'status', r.status,
      'max_players', r.max_players,
      'current_player_id', r.current_player_id,
      'winner_id', r.winner_id,
      'host_player_id', r.host_player_id,
      'pending_attack', r.pending_attack,
      'turn_number', r.turn_number,
      'version', r.version,
      'deck_count', _deck_count(r.id),
      'discard_top', (select jsonb_build_object('id', id, 'type', type, 'value', value)
                        from game_cards where room_id = r.id and state = 'discard'
                       order by sort_order desc limit 1),
      'is_host', _is_host(r),
      'is_screen_owner', r.host_id = auth.uid(),
      'host_claim_token', case when r.host_id = auth.uid()
                               then (select claim_token from room_secrets where room_id = r.id) end
    ),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id,
               'name', p.name,
               'position', p.position,
               'distance', p.distance,
               'hand_count', _hand_count(p.id),
               'attacks', to_jsonb(p.attacks),
               'protections', to_jsonb(p.protections),
               'coup_fourres', to_jsonb(p.coup_fourres),
               'count_200', p.count_200,
               'is_connected', p.is_connected,
               'is_me', p.user_id = auth.uid()
             ) order by p.position)
        from players p where p.room_id = r.id), '[]'::jsonb),
    'me', case when v_me.id is null then null else jsonb_build_object(
      'player_id', v_me.id,
      'hand', coalesce((
        select jsonb_agg(jsonb_build_object('id', c.id, 'type', c.type, 'value', c.value)
                         order by c.sort_order)
          from game_cards c where c.player_id = v_me.id and c.state = 'hand'), '[]'::jsonb)
    ) end,
    'events', coalesce((
      select jsonb_agg(to_jsonb(e) order by e.id)
        from (select id, player_id, action, payload, created_at from game_events
               where room_id = r.id order by id desc limit 20) e), '[]'::jsonb),
    'server_time', now()
  );
end;
$$;

-- ---------------------------------------------------------------------
--  Droits d'exécution
-- ---------------------------------------------------------------------

do $$
declare
  f record;
begin
  -- Fonctions internes : aucun accès client
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname like '\_%'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;

  -- RPC publiques : utilisateurs authentifiés (y compris anonymes) uniquement
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('create_room', 'join_room', 'claim_seat', 'start_game', 'restart_game',
                         'play_card', 'discard_card', 'respond_coup_fourre', 'heartbeat',
                         'kick_player', 'get_game_state', 'is_room_member')
  loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end;
$$;

revoke all on public.room_secrets from anon, authenticated;
revoke insert, update, delete on public.rooms, public.players, public.game_cards, public.game_events
  from anon, authenticated;

-- ---------------------------------------------------------------------
--  Realtime : chaque action incrémente rooms.version → les clients
--  reçoivent l'UPDATE et rechargent leur état via get_game_state.
-- ---------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_publication_tables
                  where pubname = 'supabase_realtime' and tablename = 'rooms') then
    alter publication supabase_realtime add table public.rooms;
  end if;
  if not exists (select 1 from pg_publication_tables
                  where pubname = 'supabase_realtime' and tablename = 'game_events') then
    alter publication supabase_realtime add table public.game_events;
  end if;
end;
$$;
