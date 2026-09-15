-- ============ PROFILES ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role text not null default 'user'
       check (role in ('user','seller','admin')),
  created_at timestamptz default now()
);

-- Автосоздание профиля при регистрации
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    coalesce(new.raw_user_meta_data->>'phone',''),
    case
      when coalesce(new.raw_user_meta_data->>'role','user') in ('user','seller','admin')
      then new.raw_user_meta_data->>'role'
      else 'user'
    end
  );
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create policy "profiles insert own" on public.profiles
for insert with check (auth.uid() = id);

-- Хелпер: админ?
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles
                where id = auth.uid() and role = 'admin');
$$;

-- ============ CATEGORIES ============
create table public.categories (
  id serial primary key,
  name text unique not null,
  icon text default '📦',
  sort_order int default 0
);

-- ============ BANNERS ============
create table public.banners (
  id serial primary key,
  title text not null,
  text text,
  button text,
  is_active boolean default true,
  sort_order int default 0
);

-- ============ PRODUCTS ============
create table public.products (
  id bigserial primary key,
  seller_id uuid references public.profiles(id) on delete set null,
  name text not null,
  price numeric not null check (price >= 0),
  old_price numeric,
  rating numeric default 5,
  category text not null,
  icon text default '📦',
  description text,
  images text[] default '{}',
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ============ ORDERS ============
create table public.orders (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete set null,
  customer_name text,
  customer_phone text,
  notes text,
  total numeric not null default 0,
  status text not null default 'new'
       check (status in ('new','confirmed','paid','delivered','cancelled')),
  created_at timestamptz default now()
);

create table public.order_items (
  id bigserial primary key,
  order_id bigint references public.orders(id) on delete cascade,
  product_id bigint references public.products(id) on delete set null,
  product_name text not null,
  price numeric not null,
  quantity int not null check (quantity > 0)
);

-- ============ RLS ============
alter table public.profiles    enable row level security;
alter table public.categories  enable row level security;
alter table public.banners     enable row level security;
alter table public.products    enable row level security;
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;

-- profiles
create policy "profiles read own or admin"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

create policy "profiles update own"
  on public.profiles for update using (auth.uid() = id);

-- categories
create policy "categories read all"
  on public.categories for select using (true);
create policy "categories admin write"
  on public.categories for all
  using (public.is_admin()) with check (public.is_admin());

-- banners
create policy "banners read all"
  on public.banners for select using (true);
create policy "banners admin write"
  on public.banners for all
  using (public.is_admin()) with check (public.is_admin());

-- products
create policy "products read active or own or admin"
  on public.products for select
  using (is_active = true
         or seller_id = auth.uid()
         or public.is_admin());

create policy "products insert by seller/admin"
  on public.products for insert
  with check (
    seller_id = auth.uid()
    and exists (select 1 from public.profiles
                where id = auth.uid() and role in ('seller','admin'))
  );

create policy "products update by owner/admin"
  on public.products for update
  using (seller_id = auth.uid() or public.is_admin());

create policy "products delete by owner/admin"
  on public.products for delete
  using (seller_id = auth.uid() or public.is_admin());

-- orders
create policy "orders insert"
  on public.orders for insert with check (true);

create policy "orders read own / admin / seller"
  on public.orders for select using (
    user_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.order_items oi
      join public.products p on p.id = oi.product_id
      where oi.order_id = orders.id and p.seller_id = auth.uid()
    )
  );

create policy "orders update admin or owner"
  on public.orders for update
  using (public.is_admin() or user_id = auth.uid());

-- order_items
create policy "order_items insert"
  on public.order_items for insert with check (true);

create policy "order_items read"
  on public.order_items for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (o.user_id = auth.uid() or public.is_admin()
             or exists (select 1 from public.products p
                        where p.id = order_items.product_id
                          and p.seller_id = auth.uid()))
    )
  );

-- ============ SEED ============
insert into public.categories (name, icon, sort_order) values
  ('Электроника','📱',1),
  ('Үй жана бакча','🏠',2),
  ('Кийим-кече','👕',3),
  ('Балдар үчүн','🧸',4),
  ('Спорт','🏃',5),
  ('Сулуулук','✨',6)
on conflict (name) do nothing;

insert into public.banners (title, text, button, sort_order) values
  ('Жаңы сезон — жаңы тандоо',
   'Күнүмдүк жашооңузга керектүү заманбап товарларды бир жерден табыңыз.',
   'Азыр көрүү', 1),
  ('Үйүңүзгө керектүү нерсенин баары',
   'Үй жана бакча категориясында пайдалуу товарларды ыңгайлуу тандаңыз.',
   'Категорияны көрүү', 2),
  ('Активдүү жашоо үчүн',
   'Спортко жана күнүмдүк кыймылга ылайыктуу товарларды карап көрүңүз.',
   'Товарларды көрүү', 3)
on conflict do nothing;

-- Разрешения на использование схемы
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;

ALTER TABLE public.<orders> ENABLE ROW LEVEL SECURITY;
