-- Payments: members pay their club (dues, season sign-up in full or in
-- installments, regatta/travel fees), treasurer-set discounts, and apparel
-- (in-stock items and order windows). Card payments go through Stripe
-- Checkout on the club's own connected Stripe account; this schema also
-- records cash/check payments a treasurer marks by hand.
--
-- Money columns are integer cents. Amounts, discounts and card payments are
-- only ever written by the server (service role) or a treasurer, never by a
-- member's browser, so a member can't change what they owe.

-- Treasurer: set by an admin (like tent leader); manages payments.
alter table profiles add column if not exists is_treasurer boolean not null default false;

create or replace function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  caller_role text;
begin
  if auth.uid() is null or public.is_global_admin() then
    return new;
  end if;

  select p.role::text into caller_role
  from profiles p
  where p.id = auth.uid() and p.approved_at is not null and p.disabled_at is null;

  if (new.role is distinct from old.role
      or new.approved_at is distinct from old.approved_at
      or new.is_board_member is distinct from old.is_board_member
      or new.is_tent_leader is distinct from old.is_tent_leader
      or new.is_treasurer is distinct from old.is_treasurer)
     and caller_role is distinct from 'admin' then
    raise exception 'Only admins can change role, approval, board member, tent leader, or treasurer.';
  end if;

  if new.disabled_at is distinct from old.disabled_at
     and coalesce(caller_role, '') not in ('admin', 'coach') then
    raise exception 'Only coaches and admins can remove or restore members.';
  end if;

  return new;
end;
$function$;

-- Admins and treasurers manage payments.
create or replace function public.is_treasurer()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from profiles p
    where p.id = auth.uid()
      and p.approved_at is not null
      and p.disabled_at is null
      and (p.role = 'admin' or p.is_treasurer)
  );
$$;

-- Whose bills the caller sees: their own, their linked rowers', and their
-- spouse's linked rowers' (a household shares its kids' bills).
create or replace function public.can_see_rower(rower uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select auth.uid() = rower
    or exists (
      select 1
      from family_links fl
      join profiles me on me.id = auth.uid()
      where fl.rower_id = rower
        and (
          fl.guardian_id = me.id
          or fl.guardian_id = me.spouse_id
          or exists (select 1 from profiles s where s.id = fl.guardian_id and s.spouse_id = me.id)
        )
    );
$$;

-- One row: the club's Stripe account and its default for who covers card fees.
create table payment_settings (
  id boolean primary key default true check (id),
  stripe_account_id text,
  stripe_charges_enabled boolean not null default false,
  default_fee_mode text not null default 'club' check (default_fee_mode in ('club', 'payer')),
  updated_at timestamptz not null default now()
);
insert into payment_settings (id) values (true);

alter table payment_settings enable row level security;
create policy "members read payment settings" on payment_settings for select to authenticated using (true);
create policy "treasurers update payment settings" on payment_settings for update to authenticated
  using (public.is_treasurer()) with check (public.is_treasurer());

-- The Stripe account itself is only set by the server after Stripe says so.
create or replace function public.guard_payment_settings_stripe()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null
     and (new.stripe_account_id is distinct from old.stripe_account_id
          or new.stripe_charges_enabled is distinct from old.stripe_charges_enabled) then
    raise exception 'The Stripe account is set by connecting it, not edited directly.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger guard_payment_settings_stripe before update on payment_settings
  for each row execute function public.guard_payment_settings_stripe();

-- What the club charges for.
create table charges (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  kind text not null default 'dues' check (kind in ('season', 'dues', 'regatta', 'travel', 'apparel', 'other')),
  amount_cents integer not null check (amount_cents > 0),
  due_date date,
  -- null = the club's default_fee_mode
  fee_mode text check (fee_mode in ('club', 'payer')),
  event_id uuid references schedule_events (id) on delete set null,
  -- Season sign-up: members sign their rowers up themselves.
  signup_open boolean not null default false,
  allow_installments boolean not null default false,
  installment_count integer not null default 4 check (installment_count between 2 and 12),
  installment_interval_days integer not null default 30 check (installment_interval_days between 7 and 120),
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

alter table charges enable row level security;
create policy "members read charges" on charges for select to authenticated using (true);
create policy "treasurers manage charges" on charges for all to authenticated
  using (public.is_treasurer()) with check (public.is_treasurer());

-- Treasurer-set discounts, applied automatically when a bill is created
-- (sign-up or assignment): everyone, one charge, one rower, or one rower on
-- one charge; optionally only until a date (early bird).
create table discounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('percent', 'amount')),
  percent_bps integer check (percent_bps between 1 and 10000),
  amount_cents integer check (amount_cents > 0),
  charge_id uuid references charges (id) on delete cascade,
  profile_id uuid references profiles (id) on delete cascade,
  expires_on date,
  active boolean not null default true,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check ((kind = 'percent' and percent_bps is not null) or (kind = 'amount' and amount_cents is not null))
);

alter table discounts enable row level security;
create policy "members read discounts that apply to them" on discounts for select to authenticated
  using (public.is_treasurer() or profile_id is null or public.can_see_rower(profile_id));
create policy "treasurers manage discounts" on discounts for all to authenticated
  using (public.is_treasurer()) with check (public.is_treasurer());

-- One bill per rower per charge.
create table bills (
  id uuid primary key default gen_random_uuid(),
  charge_id uuid not null references charges (id) on delete cascade,
  rower_id uuid not null references profiles (id) on delete cascade,
  amount_cents integer not null check (amount_cents >= 0),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  discount_note text,
  plan text not null default 'full' check (plan in ('full', 'installments')),
  status text not null default 'owed' check (status in ('owed', 'paid', 'waived', 'cancelled')),
  stripe_customer_id text,
  stripe_subscription_id text unique,
  signed_up_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (charge_id, rower_id),
  check (discount_cents <= amount_cents)
);

alter table bills enable row level security;
create policy "members read their household's bills" on bills for select to authenticated
  using (public.is_treasurer() or public.can_see_rower(rower_id));
create policy "treasurers manage bills" on bills for all to authenticated
  using (public.is_treasurer()) with check (public.is_treasurer());

-- Apparel.
create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  image_url text,
  price_cents integer not null check (price_cents > 0),
  sizes text[] not null default '{}',
  -- true = kept on hand at the boathouse (sold from stock); false = only
  -- through order windows.
  in_stock_item boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table product_stock (
  product_id uuid not null references products (id) on delete cascade,
  size text not null default '',
  quantity integer not null default 0 check (quantity >= 0),
  primary key (product_id, size)
);

create table order_windows (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  opens_at timestamptz not null default now(),
  closes_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table order_window_products (
  window_id uuid not null references order_windows (id) on delete cascade,
  product_id uuid not null references products (id) on delete cascade,
  primary key (window_id, product_id)
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references profiles (id) on delete cascade,
  for_rower_id uuid references profiles (id) on delete set null,
  -- null = an in-stock purchase
  window_id uuid references order_windows (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'picked_up', 'cancelled')),
  total_cents integer not null check (total_cents >= 0),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  picked_up_at timestamptz
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  product_id uuid not null references products (id) on delete restrict,
  size text not null default '',
  quantity integer not null check (quantity > 0),
  price_cents integer not null check (price_cents >= 0)
);

alter table products enable row level security;
alter table product_stock enable row level security;
alter table order_windows enable row level security;
alter table order_window_products enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;

create policy "members read products" on products for select to authenticated using (true);
create policy "treasurers manage products" on products for all to authenticated
  using (public.is_treasurer()) with check (public.is_treasurer());
create policy "members read stock" on product_stock for select to authenticated using (true);
create policy "treasurers manage stock" on product_stock for all to authenticated
  using (public.is_treasurer()) with check (public.is_treasurer());
create policy "members read order windows" on order_windows for select to authenticated using (true);
create policy "treasurers manage order windows" on order_windows for all to authenticated
  using (public.is_treasurer()) with check (public.is_treasurer());
create policy "members read window products" on order_window_products for select to authenticated using (true);
create policy "treasurers manage window products" on order_window_products for all to authenticated
  using (public.is_treasurer()) with check (public.is_treasurer());
create policy "buyers and treasurers read orders" on orders for select to authenticated
  using (public.is_treasurer() or buyer_id = auth.uid() or (for_rower_id is not null and public.can_see_rower(for_rower_id)));
create policy "treasurers manage orders" on orders for all to authenticated
  using (public.is_treasurer()) with check (public.is_treasurer());
create policy "order items follow their order" on order_items for select to authenticated
  using (exists (select 1 from orders o where o.id = order_id));
create policy "treasurers manage order items" on order_items for all to authenticated
  using (public.is_treasurer()) with check (public.is_treasurer());

-- Every payment toward a bill or an order: card (Stripe) or recorded by hand.
create table payments (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid references bills (id) on delete cascade,
  order_id uuid references orders (id) on delete cascade,
  -- Credited to the bill/order (before any card fee the payer covered).
  amount_cents integer not null check (amount_cents >= 0),
  surcharge_cents integer not null default 0,
  platform_fee_cents integer not null default 0,
  method text not null check (method in ('card', 'cash', 'check', 'other')),
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed', 'refunded')),
  installment_number integer,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  stripe_invoice_id text unique,
  note text,
  paid_by uuid references profiles (id) on delete set null,
  recorded_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  check (bill_id is not null or order_id is not null)
);

alter table payments enable row level security;
create policy "members read their household's payments" on payments for select to authenticated
  using (
    public.is_treasurer()
    or exists (select 1 from bills b where b.id = bill_id)
    or exists (select 1 from orders o where o.id = order_id)
  );
create policy "treasurers record payments" on payments for all to authenticated
  using (public.is_treasurer()) with check (public.is_treasurer());

create index bills_rower_idx on bills (rower_id);
create index bills_charge_idx on bills (charge_id);
create index payments_bill_idx on payments (bill_id);
create index payments_order_idx on payments (order_id);
create index payments_intent_idx on payments (stripe_payment_intent_id);
create index orders_buyer_idx on orders (buyer_id);
create index discounts_charge_idx on discounts (charge_id);
