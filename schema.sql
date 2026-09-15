-- ============ PROFILES ============
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role text not null default 'user'
       check (role in ('user','seller','admin')),
  created_at timestamptz default now()
);

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
  )
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Хелпер: админ?
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles
                where id = auth.uid() and role = 'admin');
$$;

-- Хелпер: продавец или админ?
create or replace function public.is_seller_or_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles
                where id = auth.uid() and role in ('seller','admin'));
$$;

-- ============ CATEGORIES ============
create table if not exists public.categories (
  id serial primary key,
  name text unique not null,
  icon text default '📦',
  sort_order int default 0
);

-- ============ BANNERS ============
create table if not exists public.banners (
  id serial primary key,
  title text not null,
  text text,
  button text,
  is_active boolean default true,
  sort_order int default 0
);

-- ============ PRODUCTS ============
create table if not exists public.products (
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

create index if not exists idx_products_seller on public.products(seller_id);
create index if not exists idx_products_category on public.products(category);

-- ============ ORDERS ============
create table if not exists public.orders (
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

create table if not exists public.order_items (
  id bigserial primary key,
  order_id bigint references public.orders(id) on delete cascade,
  product_id bigint references public.products(id) on delete set null,
  product_name text not null,
  price numeric not null,
  quantity int not null check (quantity > 0)
);

create index if not exists idx_order_items_order on public.order_items(order_id);

-- ============ RLS ============
alter table public.profiles    enable row level security;
alter table public.categories  enable row level security;
alter table public.banners     enable row level security;
alter table public.products    enable row level security;
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;

-- profiles
drop policy if exists "profiles read own or admin" on public.profiles;
create policy "profiles read own or admin"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own"
  on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own"
  on public.profiles for update using (auth.uid() = id);

-- categories
drop policy if exists "categories read all" on public.categories;
create policy "categories read all"
  on public.categories for select using (true);

drop policy if exists "categories admin write" on public.categories;
create policy "categories admin write"
  on public.categories for all
  using (public.is_admin()) with check (public.is_admin());

-- banners
drop policy if exists "banners read all" on public.banners;
create policy "banners read all"
  on public.banners for select using (true);

drop policy if exists "banners admin write" on public.banners;
create policy "banners admin write"
  on public.banners for all
  using (public.is_admin()) with check (public.is_admin());

-- products
drop policy if exists "products read active or own or admin" on public.products;
create policy "products read active or own or admin"
  on public.products for select
  using (is_active = true
         or seller_id = auth.uid()
         or public.is_admin());

drop policy if exists "products insert by seller/admin" on public.products;
create policy "products insert by seller/admin"
  on public.products for insert
  with check (seller_id = auth.uid() and public.is_seller_or_admin());

drop policy if exists "products update by owner/admin" on public.products;
create policy "products update by owner/admin"
  on public.products for update
  using (seller_id = auth.uid() or public.is_admin());

drop policy if exists "products delete by owner/admin" on public.products;
create policy "products delete by owner/admin"
  on public.products for delete
  using (seller_id = auth.uid() or public.is_admin());

-- orders (RPC работает через SECURITY DEFINER, эти политики — для чтения)
drop policy if exists "orders insert" on public.orders;
create policy "orders insert"
  on public.orders for insert with check (true);

drop policy if exists "orders read own / admin / seller" on public.orders;
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

drop policy if exists "orders update admin or owner" on public.orders;
create policy "orders update admin or owner"
  on public.orders for update
  using (public.is_admin() or user_id = auth.uid());

-- order_items
drop policy if exists "order_items insert" on public.order_items;
create policy "order_items insert"
  on public.order_items for insert with check (true);

drop policy if exists "order_items read" on public.order_items;
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


-- ============================================================
--  RPC: create_order — ГЛАВНОЕ, ЧЕГО НЕ ХВАТАЛО
--  Создаёт заказ + позиции одной транзакцией.
--  Работает для гостя (p_user_id = null) и для авторизованного.
-- ============================================================
create or replace function public.create_order(
  p_user_id        uuid,
  p_customer_name  text,
  p_customer_phone text,
  p_notes          text,
  p_total          numeric,
  p_items          jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id bigint;
  v_item     jsonb;
begin
  insert into public.orders (user_id, customer_name, customer_phone, notes, total, status)
  values (p_user_id, p_customer_name, p_customer_phone, p_notes, p_total, 'new')
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.order_items (order_id, product_id, product_name, price, quantity)
    values (
      v_order_id,
      nullif(v_item->>'id','')::bigint,
      v_item->>'name',
      (v_item->>'price')::numeric,
      greatest((v_item->>'quantity')::int, 1)
    );
  end loop;

  return v_order_id;
end;
$$;

grant execute on function public.create_order(uuid,text,text,text,numeric,jsonb)
  to anon, authenticated;


-- ============================================================
--  STORAGE: bucket для картинок товаров
-- ============================================================
insert into storage.buckets (id, name, public)
values ('products','products', true)
on conflict (id) do nothing;

drop policy if exists "products images public read" on storage.objects;
create policy "products images public read"
  on storage.objects for select
  using (bucket_id = 'products');

drop policy if exists "products images upload by seller" on storage.objects;
create policy "products images upload by seller"
  on storage.objects for insert
  with check (
    bucket_id = 'products'
    and auth.uid() is not null
    and public.is_seller_or_admin()
  );

drop policy if exists "products images update by owner" on storage.objects;
create policy "products images update by owner"
  on storage.objects for update
  using (
    bucket_id = 'products'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "products images delete by owner" on storage.objects;
create policy "products images delete by owner"
  on storage.objects for delete
  using (
    bucket_id = 'products'
    and auth.uid()::text = (storage.foldername(name))[1]
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

grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;
