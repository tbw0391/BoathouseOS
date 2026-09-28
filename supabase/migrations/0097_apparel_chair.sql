-- Apparel Chair: someone an admin names (like Tent Leader) who runs the
-- apparel store — products, stock, order windows, and handing out orders.
-- Marking an order paid stays with the treasurer and admins (it's money).
-- Safe to re-run.

alter table profiles add column if not exists is_apparel_chair boolean not null default false;

-- Only admins can hand out the flag (same guard as 0060/0067, plus the new
-- column).
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
      or new.is_treasurer is distinct from old.is_treasurer
      or new.is_apparel_chair is distinct from old.is_apparel_chair)
     and caller_role is distinct from 'admin' then
    raise exception 'Only admins can change role, approval, board member, tent leader, treasurer, or apparel chair.';
  end if;

  if new.disabled_at is distinct from old.disabled_at
     and coalesce(caller_role, '') not in ('admin', 'coach') then
    raise exception 'Only coaches and admins can remove or restore members.';
  end if;

  return new;
end;
$function$;

-- Admins, treasurers, and the apparel chair run the store.
create or replace function public.is_apparel_manager()
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
      and (p.role = 'admin' or p.is_treasurer or p.is_apparel_chair)
  );
$$;

revoke execute on function public.is_apparel_manager() from public, anon;
grant execute on function public.is_apparel_manager() to authenticated;

drop policy if exists "apparel managers manage products" on products;
create policy "apparel managers manage products" on products for all to authenticated
  using (public.is_apparel_manager()) with check (public.is_apparel_manager());

drop policy if exists "apparel managers manage stock" on product_stock;
create policy "apparel managers manage stock" on product_stock for all to authenticated
  using (public.is_apparel_manager()) with check (public.is_apparel_manager());

drop policy if exists "apparel managers manage order windows" on order_windows;
create policy "apparel managers manage order windows" on order_windows for all to authenticated
  using (public.is_apparel_manager()) with check (public.is_apparel_manager());

drop policy if exists "apparel managers manage window products" on order_window_products;
create policy "apparel managers manage window products" on order_window_products for all to authenticated
  using (public.is_apparel_manager()) with check (public.is_apparel_manager());

-- See every order, and mark one picked up or cancelled — only through
-- set_order_handout(), so the chair can't change prices or mark anything
-- paid. Payments stay with treasurers.
drop policy if exists "apparel managers read orders" on orders;
create policy "apparel managers read orders" on orders for select to authenticated
  using (public.is_apparel_manager());

drop policy if exists "apparel managers hand out orders" on orders;

create or replace function public.set_order_handout(order_id uuid, new_status text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_apparel_manager() then
    raise exception 'Only the apparel chair, treasurer or an admin can do that.';
  end if;
  if new_status not in ('picked_up', 'cancelled') then
    raise exception 'Orders can only be marked picked up or cancelled here.';
  end if;
  update orders
    set status = new_status,
        picked_up_at = case when new_status = 'picked_up' then now() end
    where id = order_id;
end;
$$;

revoke execute on function public.set_order_handout(uuid, text) from public, anon;
grant execute on function public.set_order_handout(uuid, text) to authenticated;

select public.apply_approval_gate();
