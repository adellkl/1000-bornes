-- Scénario de test complet (Postgres local, après local_bootstrap.sql + migration).
--   psql -d route1000_test -f supabase/tests/game_scenario.sql
-- Deux joueurs : Alice (hôte) et Bruno. Vérifie la sécurité puis joue une partie entière.
\set ON_ERROR_STOP 1
\set alice '\'aaaaaaaa-0000-0000-0000-000000000001\''
\set bruno '\'bbbbbbbb-0000-0000-0000-000000000002\''
\set intrus '\'cccccccc-0000-0000-0000-000000000003\''

create or replace function pg_temp.as_user(p uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', p::text, false);
$$;

create or replace function pg_temp.expect_error(p_sql text, p_like text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'ÉCHEC : aucune erreur pour %', p_sql;
exception when others then
  if sqlerrm like 'ÉCHEC%' then raise; end if;
  if sqlerrm not like p_like then
    raise exception 'ÉCHEC : erreur inattendue pour % → %', p_sql, sqlerrm;
  end if;
  raise notice 'OK (refusé) : %', sqlerrm;
end;
$$;

set role authenticated;

-- 1. Création + arrivée des joueurs ---------------------------------------
select pg_temp.as_user(:alice);
select public.create_room('Alice', 4) as code \gset
\echo Salle créée : :code
select pg_temp.as_user(:bruno);
select public.join_room(:'code', 'Bruno') is not null as bruno_joined;
select pg_temp.as_user(:intrus);
select pg_temp.expect_error(format('select public.join_room(%L, %L)', :'code', 'bruno'), '%déjà pris%');
select pg_temp.as_user(:bruno);

-- 2. Seul l'hôte lance ------------------------------------------------------
select pg_temp.expect_error(format('select public.start_game(%L)', :'code'), '%Seul l''hôte%');
select pg_temp.as_user(:alice);
select public.start_game(:'code');

-- 3. Sécurité : mains invisibles ------------------------------------------
select pg_temp.as_user(:bruno);
select count(*) as cartes_visibles_par_bruno,
       count(*) filter (where state = 'deck') as pioche_visible
  from public.game_cards;   -- doit valoir 6 ou 7 (sa main uniquement), pioche 0
select jsonb_array_length(public.get_game_state(:'code') -> 'me' -> 'hand') as main_bruno;
do $$
declare v int;
begin
  update public.rooms set status = 'finished';
  raise exception 'ÉCHEC : écriture directe autorisée';
exception when insufficient_privilege then raise notice 'OK (refusé) : écriture directe interdite';
end $$;
select pg_temp.as_user(:intrus);
select count(*) as cartes_visibles_intrus from public.game_cards;
select pg_temp.expect_error(format('select public.discard_card(%L, gen_random_uuid())', :'code'), '%ne faites pas partie%');

-- 4. Hors tour / carte étrangère ------------------------------------------
select pg_temp.as_user(:bruno);
select pg_temp.expect_error(format(
  'select public.discard_card(%L, (select id from public.game_cards limit 1))', :'code'), '%pas votre tour%');

-- 5. Partie complète automatisée ------------------------------------------
-- Stratégie simple : pour chaque joueur, essayer botte > parade > distance (plus grande) > attaque,
-- sinon défausser. Les coups fourrés sont toujours joués.
do $$
declare
  v_code   text := (select code from public.rooms order by created_at desc limit 1);
  v_users  uuid[] := array['aaaaaaaa-0000-0000-0000-000000000001'::uuid,
                           'bbbbbbbb-0000-0000-0000-000000000002'::uuid];
  v_state  jsonb;
  v_room   jsonb;
  v_me     text;
  v_target uuid;
  v_card   jsonb;
  v_done   boolean;
  v_turns  int := 0;
  v_rejets int := 0;
  v_cf     int := 0;
  u        uuid;
begin
  loop
    v_turns := v_turns + 1;
    exit when v_turns > 600;
    -- Coup fourré en attente ?
    perform set_config('request.jwt.claim.sub', v_users[1]::text, false);
    v_room := public.get_game_state(v_code) -> 'room';
    exit when v_room ->> 'status' = 'finished';
    if v_room -> 'pending_attack' <> 'null'::jsonb and v_room -> 'pending_attack' is not null then
      foreach u in array v_users loop
        perform set_config('request.jwt.claim.sub', u::text, false);
        if (public.get_game_state(v_code) -> 'me' ->> 'player_id')::uuid
             = (v_room -> 'pending_attack' ->> 'target_id')::uuid then
          perform public.respond_coup_fourre(v_code, true);
          v_cf := v_cf + 1;
        end if;
      end loop;
      continue;
    end if;

    foreach u in array v_users loop
      perform set_config('request.jwt.claim.sub', u::text, false);
      v_state := public.get_game_state(v_code);
      v_me := v_state -> 'me' ->> 'player_id';
      if v_me = v_state -> 'room' ->> 'current_player_id' then
        select (p ->> 'id')::uuid into v_target
          from jsonb_array_elements(v_state -> 'players') p where p ->> 'id' <> v_me limit 1;
        v_done := false;
        for v_card in
          select c from jsonb_array_elements(v_state -> 'me' -> 'hand') c
           order by case c ->> 'type' when 'safety' then 0 when 'remedy' then 1
                                      when 'distance' then 2 else 3 end,
                    case when c ->> 'type' = 'distance' then -(c ->> 'value')::int else 0 end
        loop
          begin
            perform public.play_card(v_code, (v_card ->> 'id')::uuid,
                                     case when v_card ->> 'type' = 'attack' then v_target end);
            v_done := true;
            exit;
          exception when raise_exception then
            v_rejets := v_rejets + 1;
          end;
        end loop;
        if not v_done then
          perform public.discard_card(v_code,
            ((v_state -> 'me' -> 'hand') -> 0 ->> 'id')::uuid);
        end if;
        exit;
      end if;
    end loop;
  end loop;

  perform set_config('request.jwt.claim.sub', v_users[1]::text, false);
  v_state := public.get_game_state(v_code);
  raise notice 'Fin après % itérations, % coups refusés par le serveur, % coup(s) fourré(s)',
    v_turns, v_rejets, v_cf;
  raise notice 'Statut : %, gagnant : %', v_state -> 'room' ->> 'status',
    (select p ->> 'name' from jsonb_array_elements(v_state -> 'players') p
      where p ->> 'id' = v_state -> 'room' ->> 'winner_id');
  raise notice 'Distances : %', (select string_agg((p ->> 'name') || '=' || (p ->> 'distance'), ', ')
                                    from jsonb_array_elements(v_state -> 'players') p);
  if v_state -> 'room' ->> 'status' <> 'finished' then
    raise exception 'ÉCHEC : la partie ne s''est pas terminée';
  end if;
  if exists (select 1 from jsonb_array_elements(v_state -> 'players') p
              where (p ->> 'distance')::int > 1000 or (p ->> 'count_200')::int > 2) then
    raise exception 'ÉCHEC : règle de distance violée';
  end if;
end $$;

-- 6. Rejouer : uniquement l'hôte ------------------------------------------
select pg_temp.as_user(:bruno);
select pg_temp.expect_error(format('select public.restart_game(%L)', :'code'), '%Seul l''hôte%');
select pg_temp.as_user(:alice);
select public.restart_game(:'code');
select (public.get_game_state(:'code') -> 'room' ->> 'status') as statut_apres_rejouer;

-- 7. Règles ciblées (état forcé en superutilisateur) -----------------------
reset role;
-- Alice : limite de vitesse, à 990 bornes, main imposée
update public.players set attacks = array['limite'], distance = 975, count_200 = 2
 where name = 'Alice';
update public.rooms set current_player_id = (select id from public.players where name = 'Alice'),
                        pending_attack = null;
update public.game_cards set value = '75', type = 'distance'
 where id = (select c.id from public.game_cards c join public.players p on p.id = c.player_id
              where p.name = 'Alice' and c.state = 'hand' order by c.sort_order limit 1);
update public.game_cards set value = '25', type = 'distance'
 where id = (select c.id from public.game_cards c join public.players p on p.id = c.player_id
              where p.name = 'Alice' and c.state = 'hand' order by c.sort_order offset 1 limit 1);
update public.game_cards set value = '200', type = 'distance'
 where id = (select c.id from public.game_cards c join public.players p on p.id = c.player_id
              where p.name = 'Alice' and c.state = 'hand' order by c.sort_order offset 2 limit 1);
set role authenticated;
select pg_temp.as_user(:alice);
select pg_temp.expect_error(format(
  'select public.play_card(%L, (select id from public.game_cards where state = ''hand'' and value = ''75'' and player_id = (select id from public.players where name = ''Alice'') limit 1))',
  :'code'), '%Limite de vitesse%');
reset role;
update public.players set attacks = '{}' where name = 'Alice';
set role authenticated;
select pg_temp.expect_error(format(
  'select public.play_card(%L, (select id from public.game_cards where state = ''hand'' and value = ''200'' and player_id = (select id from public.players where name = ''Alice'') limit 1))',
  :'code'), '%dépasseriez%');
reset role;
update public.players set distance = 700 where name = 'Alice';
set role authenticated;
select pg_temp.expect_error(format(
  'select public.play_card(%L, (select id from public.game_cards where state = ''hand'' and value = ''200'' and player_id = (select id from public.players where name = ''Alice'') limit 1))',
  :'code'), '%deux cartes 200%');
reset role;
update public.players set distance = 975 where name = 'Alice';
set role authenticated;
select public.play_card(:'code', (select id from public.game_cards where state = 'hand' and value = '25'
                                    and player_id = (select id from public.players where name = 'Alice') limit 1));
select (public.get_game_state(:'code') -> 'room' ->> 'status') as statut_apres_1000,
       (select name from public.players where id = (public.get_game_state(:'code') -> 'room' ->> 'winner_id')::uuid) as gagnant;

-- 8. Coup fourré ciblé ------------------------------------------------------
select public.restart_game(:'code');
reset role;
update public.players set attacks = '{}' ;
-- Bruno détient l'Increvable ; Alice a une Crevaison et c'est son tour
update public.game_cards set type = 'safety', value = 'increvable'
 where id = (select c.id from public.game_cards c join public.players p on p.id = c.player_id
              where p.name = 'Bruno' and c.state = 'hand' limit 1);
update public.game_cards set type = 'attack', value = 'crevaison'
 where id = (select c.id from public.game_cards c join public.players p on p.id = c.player_id
              where p.name = 'Alice' and c.state = 'hand' limit 1);
update public.rooms set current_player_id = (select id from public.players where name = 'Alice');
set role authenticated;
select pg_temp.as_user(:alice);
select public.play_card(:'code',
  (select id from public.game_cards where state = 'hand' and value = 'crevaison'
     and player_id = (select id from public.players where name = 'Alice') limit 1),
  (select id from public.players where name = 'Bruno'));
select public.get_game_state(:'code') -> 'room' -> 'pending_attack' ->> 'attack' as attaque_en_attente;
select pg_temp.expect_error(format('select public.discard_card(%L, gen_random_uuid())', :'code'), '%réaction%');
select pg_temp.as_user(:bruno);
select jsonb_array_length(public.get_game_state(:'code') -> 'me' -> 'hand') as main_bruno_avant;
select public.respond_coup_fourre(:'code', true);
select p ->> 'name' as joueur, p -> 'attacks' as attaques, p -> 'protections' as bottes,
       p -> 'coup_fourres' as coups_fourres, p ->> 'hand_count' as cartes
  from jsonb_array_elements(public.get_game_state(:'code') -> 'players') p;
select (public.get_game_state(:'code') -> 'room' ->> 'current_player_id')
       = (public.get_game_state(:'code') -> 'me' ->> 'player_id') as bruno_rejoue;

-- 9. Retrait d'un joueur par l'hôte ----------------------------------------
select pg_temp.expect_error(format('select public.kick_player(%L, (select id from public.players where name = ''Alice''))', :'code'), '%Seul l''hôte%');
select pg_temp.as_user(:alice);
select public.kick_player(:'code', (select id from public.players where name = 'Bruno'));
select public.get_game_state(:'code') -> 'room' ->> 'status' as statut_apres_retrait;
\echo TOUS LES TESTS SONT PASSÉS
