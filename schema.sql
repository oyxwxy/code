-- Supabase > SQL Editor 에 통째로 붙여넣고 Run 하세요.
create extension if not exists pgcrypto;

create table profiles(
  id uuid primary key references auth.users on delete cascade,
  handle text unique not null check (handle ~ '^[a-z0-9_]{3,20}$'),
  display text not null default '',
  bio text not null default '',
  is_admin boolean not null default false,
  theme jsonb not null default '{}',
  invited_by uuid,
  created timestamptz default now());

create table invites(
  code text primary key,
  owner uuid not null references profiles(id) on delete cascade,
  max_uses int not null default 1,
  uses int not null default 0,
  created timestamptz default now());

create table posts(
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references profiles(id) on delete cascade,
  title text not null,
  tags text[] not null default '{}',
  vis text not null check (vis in ('public','locked','private')),
  cover text,
  created timestamptz default now(),
  updated timestamptz default now());

create table bodies(
  post_id uuid primary key references posts(id) on delete cascade,
  prompt text not null default '',
  negative text not null default '',
  params text not null default '',
  images text[] not null default '{}');

create table secrets(post_id uuid primary key references posts(id) on delete cascade, pw_hash text not null);

alter table profiles enable row level security;
alter table invites enable row level security;
alter table posts enable row level security;
alter table bodies enable row level security;
alter table secrets enable row level security; -- 정책 없음 = 아무도 직접 못 읽음

create policy "profiles read" on profiles for select using (true);
create policy "profiles update own" on profiles for update using (id = auth.uid());
revoke update on profiles from authenticated, anon;
grant update (display, bio, theme) on profiles to authenticated;

create policy "invites read own" on invites for select using (owner = auth.uid());

create policy "posts read" on posts for select using (vis <> 'private' or owner = auth.uid());
create policy "posts write" on posts for all using (owner = auth.uid()) with check (owner = auth.uid());

create policy "bodies read" on bodies for select using (
  exists (select 1 from posts p where p.id = post_id and (p.owner = auth.uid() or p.vis = 'public')));
create policy "bodies write" on bodies for all
  using (exists (select 1 from posts p where p.id = post_id and p.owner = auth.uid()))
  with check (exists (select 1 from posts p where p.id = post_id and p.owner = auth.uid()));

-- 가입: 첫 번째 가입자는 관리자(코드 불필요), 이후는 추천 코드 필수
create function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare m jsonb := new.raw_user_meta_data; inv invites; first_user boolean;
begin
  select not exists(select 1 from profiles) into first_user;
  if not first_user then
    select * into inv from invites where code = upper(m->>'code') for update;
    if not found or inv.uses >= inv.max_uses then raise exception '유효하지 않은 추천 코드'; end if;
    update invites set uses = uses + 1 where code = inv.code;
  end if;
  insert into profiles(id, handle, display, is_admin, invited_by)
  values (new.id, lower(m->>'handle'), coalesce(nullif(m->>'display',''), m->>'handle'), first_user, inv.owner);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

create function signup_open(c text) returns boolean language sql security definer set search_path = public as $$
  select not exists(select 1 from profiles)
      or exists(select 1 from invites where code = upper(c) and uses < max_uses) $$;
grant execute on function signup_open(text) to anon, authenticated;

create function create_invite() returns text language plpgsql security definer set search_path = public as $$
declare c text := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)); adm boolean;
begin
  select is_admin into adm from profiles where id = auth.uid();
  if adm is null then raise exception '로그인이 필요해요'; end if;
  if not adm and (select count(*) from invites where owner = auth.uid()) >= 3 then
    raise exception '일반 멤버는 코드를 3개까지 만들 수 있어요'; end if;
  insert into invites(code, owner) values (c, auth.uid());
  return c;
end $$;
grant execute on function create_invite() to authenticated;

-- 글 비밀번호 설정/변경/해제 (pw 가 null 이면 해제). 비밀번호는 해시로만 저장
create function set_post_password(pid uuid, pw text) returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists(select 1 from posts where id = pid and owner = auth.uid()) then raise exception '권한 없음'; end if;
  if pw is null or pw = '' then delete from secrets where post_id = pid;
  else insert into secrets(post_id, pw_hash) values (pid, crypt(pw, gen_salt('bf')))
       on conflict (post_id) do update set pw_hash = excluded.pw_hash; end if;
end $$;
grant execute on function set_post_password(uuid, text) to authenticated;

-- 비밀번호 글 열기 (맞을 때만 본문 반환)
create function unlock_post(pid uuid, pw text) returns setof bodies language plpgsql security definer set search_path = public as $$
begin
  perform pg_sleep(0.4); -- 대입 공격 완화
  return query select b.* from bodies b join secrets s on s.post_id = b.post_id
    join posts p on p.id = b.post_id
    where b.post_id = pid and p.vis = 'locked' and s.pw_hash = crypt(pw, s.pw_hash);
end $$;
grant execute on function unlock_post(uuid, text) to anon, authenticated;

-- 이미지 저장소 (경로가 추측 불가능한 UUID라 링크를 아는 사람만 볼 수 있음)
insert into storage.buckets(id, name, public) values ('images', 'images', true) on conflict do nothing;
create policy "img upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "img delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "img read" on storage.objects for select using (bucket_id = 'images');
