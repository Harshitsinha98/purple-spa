-- The Purple Skin Friendly Salon and Spa — core schema
-- Run this once in Supabase: Dashboard → SQL Editor → paste → Run.
-- Then run 0002_seed.sql.


-- ─────────────────────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────────────────────
do $$ begin
  create type app_role as enum ('customer', 'employee', 'admin');
  create type resource_kind as enum ('bed', 'chair');
  create type service_kind as enum ('spa', 'salon');
  create type gender as enum ('female', 'male', 'other');
  create type gender_pref as enum ('any', 'female', 'male');
  create type payment_mode as enum ('full', 'partial', 'pay_at_spa');
  create type booking_status as enum ('pending_payment', 'confirmed', 'assigned', 'in_progress', 'completed', 'cancelled', 'no_show');
  create type payment_status as enum ('unpaid', 'partial', 'paid', 'refunded');
  create type payment_method as enum ('razorpay', 'cash', 'upi', 'card');
  create type payment_record_status as enum ('created', 'captured', 'failed', 'refunded');
exception when duplicate_object then null; end $$;

-- ─────────────────────────────────────────────────────────────
-- Settings (single row, id = 1). Everything here is editable from the admin panel.
-- ─────────────────────────────────────────────────────────────
create table if not exists settings (
  id int primary key default 1 check (id = 1),
  business_name text not null default 'The Purple Skin Friendly Salon and Spa',
  phone text not null default '+918109750539',
  whatsapp text not null default '+918109750539',
  email text not null default 'purplespasalon23@gmail.com',
  address text not null default 'SF 14, Second Floor, Mansarovar Complex, C Block, Maharana Pratap Nagar, Bhopal, Madhya Pradesh 462016',
  maps_query text not null default '6CGP+36 Bhopal, Madhya Pradesh',
  instagram_url text,
  timezone text not null default 'Asia/Kolkata',
  open_time time not null default '10:00',
  close_time time not null default '20:30',
  slot_interval_min int not null default 30 check (slot_interval_min between 5 and 120),
  buffer_min int not null default 10 check (buffer_min between 0 and 60),
  booking_window_days int not null default 30 check (booking_window_days between 1 and 180),
  min_lead_min int not null default 60 check (min_lead_min between 0 and 1440),
  bed_count int not null default 5 check (bed_count >= 0),
  chair_count int not null default 2 check (chair_count >= 0),
  allow_gender_preference boolean not null default true,
  cancellation_hours int not null default 2 check (cancellation_hours between 0 and 168),
  payment_modes payment_mode[] not null default array['full','partial','pay_at_spa']::payment_mode[],
  advance_percent int not null default 30 check (advance_percent between 1 and 99),
  auto_assign boolean not null default true,
  payment_hold_min int not null default 15 check (payment_hold_min between 5 and 60),
  updated_at timestamptz not null default now(),
  constraint payment_modes_not_empty check (cardinality(payment_modes) > 0)
);
insert into settings (id) values (1) on conflict do nothing;

-- ─────────────────────────────────────────────────────────────
-- People
-- ─────────────────────────────────────────────────────────────
create table if not exists admin_emails (
  email text primary key check (email = lower(email))
);

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  phone text,
  avatar_url text,
  role app_role not null default 'customer',
  whatsapp_opt_in boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references profiles(id) on delete set null,
  email text not null unique check (email = lower(email)),
  full_name text not null,
  phone text,
  gender gender not null,
  title text not null default 'Therapist',
  commission_percent numeric(5,2) not null default 10 check (commission_percent between 0 and 100),
  weekly_off smallint check (weekly_off between 0 and 6), -- 0 = Sunday
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Catalogue
-- ─────────────────────────────────────────────────────────────
create table if not exists service_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  kind service_kind not null,
  name_en text not null,
  name_hi text not null,
  description_en text,
  description_hi text,
  sort int not null default 0,
  is_active boolean not null default true
);

create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references service_categories(id) on delete restrict,
  slug text not null unique,
  name_en text not null,
  name_hi text not null,
  description_en text,
  description_hi text,
  tag_en text,
  tag_hi text,
  resource resource_kind not null default 'bed',
  commission_percent numeric(5,2) check (commission_percent between 0 and 100), -- overrides employee default when set
  sort int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists service_variants (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references services(id) on delete cascade,
  duration_min int not null check (duration_min between 5 and 480),
  price numeric(10,2) not null check (price >= 0),
  is_active boolean not null default true,
  unique (service_id, duration_min)
);

create table if not exists employee_services (
  employee_id uuid not null references employees(id) on delete cascade,
  service_id uuid not null references services(id) on delete cascade,
  primary key (employee_id, service_id)
);

-- ─────────────────────────────────────────────────────────────
-- Bookings
-- ─────────────────────────────────────────────────────────────
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
  customer_id uuid references profiles(id) on delete set null,
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  resource resource_kind not null,
  status booking_status not null default 'pending_payment',
  employee_id uuid references employees(id) on delete set null,
  employee_name text,      -- snapshot so customers can see who is assigned without reading staff records
  employee_gender gender,
  gender_preference gender_pref not null default 'any',
  payment_mode payment_mode not null,
  total_amount numeric(10,2) not null,
  advance_amount numeric(10,2) not null default 0,
  amount_paid numeric(10,2) not null default 0,
  payment_status payment_status not null default 'unpaid',
  commission_amount numeric(10,2),
  hold_expires_at timestamptz,
  notes text,
  source text not null default 'website', -- website | admin
  cancelled_at timestamptz,
  cancel_reason text,
  completed_at timestamptz,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  check (end_at > start_at)
);
create index if not exists bookings_start_idx on bookings (start_at);
create index if not exists bookings_customer_idx on bookings (customer_id);
create index if not exists bookings_employee_idx on bookings (employee_id, start_at);

create table if not exists booking_items (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  service_id uuid references services(id) on delete set null,
  variant_id uuid references service_variants(id) on delete set null,
  name_en text not null,
  name_hi text not null,
  duration_min int not null,
  price numeric(10,2) not null,
  commission_percent numeric(5,2)
);
create index if not exists booking_items_booking_idx on booking_items (booking_id);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  method payment_method not null,
  amount numeric(10,2) not null check (amount > 0),
  status payment_record_status not null default 'created',
  razorpay_order_id text unique,
  razorpay_payment_id text unique,
  refund_id text,
  recorded_by uuid references profiles(id),
  note text,
  created_at timestamptz not null default now()
);
create index if not exists payments_booking_idx on payments (booking_id);

create table if not exists booking_events (
  id bigint generated always as identity primary key,
  booking_id uuid not null references bookings(id) on delete cascade,
  type text not null,
  message text,
  actor uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists booking_events_booking_idx on booking_events (booking_id);

create table if not exists notification_log (
  id bigint generated always as identity primary key,
  booking_id uuid references bookings(id) on delete set null,
  channel text not null,          -- whatsapp | push
  recipient text,
  template text,
  status text not null,           -- sent | failed | skipped
  error text,
  created_at timestamptz not null default now()
);

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Helper functions for RLS
-- ─────────────────────────────────────────────────────────────
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function current_employee_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from employees where profile_id = auth.uid() and is_active;
$$;

-- ─────────────────────────────────────────────────────────────
-- New user → profile, with role taken from admin_emails / employees
-- ─────────────────────────────────────────────────────────────
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(new.email);
  v_role app_role := 'customer';
begin
  if exists (select 1 from admin_emails where email = v_email) then
    v_role := 'admin';
  elsif exists (select 1 from employees where email = v_email and is_active) then
    v_role := 'employee';
  end if;

  insert into profiles (id, email, full_name, avatar_url, role)
  values (new.id, v_email,
          coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
          new.raw_user_meta_data->>'avatar_url', v_role)
  on conflict (id) do nothing;

  update employees set profile_id = new.id where email = v_email and profile_id is null;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- When admin creates an employee whose Google account already exists, link and promote it.
create or replace function link_employee_profile() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_profile uuid;
begin
  if new.profile_id is null then
    select id into v_profile from profiles where email = new.email;
    if v_profile is not null then
      new.profile_id := v_profile;
    end if;
  end if;
  if new.profile_id is not null then
    update profiles set role = case when role = 'admin' then 'admin'::app_role
                                    when new.is_active then 'employee'::app_role
                                    else 'customer'::app_role end
    where id = new.profile_id;
  end if;
  return new;
end $$;

create or replace function unlink_employee_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.profile_id is not null then
    update profiles set role = 'customer' where id = old.profile_id and role = 'employee';
  end if;
  return old;
end $$;

drop trigger if exists employees_unlink_profile on employees;
create trigger employees_unlink_profile after delete on employees
  for each row execute function unlink_employee_profile();

drop trigger if exists employees_link_profile on employees;
create trigger employees_link_profile before insert or update of email, is_active on employees
  for each row execute function link_employee_profile();

-- Customers may update only their own name/phone/opt-in; role changes are blocked.
create or replace function guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and not is_admin() and auth.uid() is not null then
    raise exception 'Not allowed to change role';
  end if;
  if new.email is distinct from old.email and auth.uid() is not null then
    raise exception 'Email is managed by Google sign-in';
  end if;
  return new;
end $$;

drop trigger if exists profiles_guard on profiles;
create trigger profiles_guard before update on profiles
  for each row execute function guard_profile_update();

-- ─────────────────────────────────────────────────────────────
-- Availability
-- ─────────────────────────────────────────────────────────────
-- Statuses that occupy a bed/chair and a therapist.
create or replace function is_active_status(s booking_status, hold timestamptz) returns boolean
language sql stable as $$
  select s in ('confirmed','assigned','in_progress') or (s = 'pending_payment' and hold > now());
$$;

-- Employees qualified for every service, active, matching gender, not off that weekday.
create or replace function qualified_employees(p_service_ids uuid[], p_gender gender_pref, p_day date)
returns setof uuid language sql stable security definer set search_path = public as $$
  select e.id from employees e
  where e.is_active
    and (p_gender = 'any' or e.gender::text = p_gender::text)
    and (e.weekly_off is null or e.weekly_off <> extract(dow from p_day)::int)
    and not exists (
      select 1 from unnest(p_service_ids) sid
      where not exists (select 1 from employee_services es where es.employee_id = e.id and es.service_id = sid)
    );
$$;

-- Core check used by availability listing and booking creation.
create or replace function slot_is_free(
  p_start timestamptz, p_end timestamptz, p_resource resource_kind,
  p_service_ids uuid[], p_gender gender_pref, p_exclude uuid default null
) returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  s settings%rowtype;
  v_capacity int;
  v_used int;
  v_free_staff int;
  v_unassigned int;
  v_buffer interval;
  v_day date;
begin
  select * into s from settings where id = 1;
  v_buffer := make_interval(mins => s.buffer_min);
  v_capacity := case when p_resource = 'bed' then s.bed_count else s.chair_count end;
  v_day := (p_start at time zone s.timezone)::date;

  select count(*) into v_used from bookings b
  where b.resource = p_resource and is_active_status(b.status, b.hold_expires_at)
    and (p_exclude is null or b.id <> p_exclude)
    and tstzrange(b.start_at, b.end_at + v_buffer) && tstzrange(p_start, p_end + v_buffer);
  if v_used >= v_capacity then return false; end if;

  -- Free qualified staff = qualified staff with no overlapping assigned booking.
  select count(*) into v_free_staff from qualified_employees(p_service_ids, p_gender, v_day) q
  where not exists (
    select 1 from bookings b where b.employee_id = q
      and is_active_status(b.status, b.hold_expires_at)
      and (p_exclude is null or b.id <> p_exclude)
      and tstzrange(b.start_at, b.end_at + v_buffer) && tstzrange(p_start, p_end + v_buffer)
  );

  -- Unassigned overlapping bookings will need someone too.
  select count(*) into v_unassigned from bookings b
  where b.employee_id is null and is_active_status(b.status, b.hold_expires_at)
    and (p_exclude is null or b.id <> p_exclude)
    and tstzrange(b.start_at, b.end_at + v_buffer) && tstzrange(p_start, p_end + v_buffer);

  return v_free_staff - v_unassigned > 0;
end $$;

-- Lists bookable start times for a day. Public (anon can call it).
create or replace function get_available_slots(p_date date, p_variant_ids uuid[], p_gender gender_pref default 'any')
returns table (slot_start timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare
  s settings%rowtype;
  v_duration int;
  v_resource resource_kind;
  v_service_ids uuid[];
  v_t timestamptz;
  v_close timestamptz;
  v_earliest timestamptz;
begin
  select * into s from settings where id = 1;
  if p_date < (now() at time zone s.timezone)::date or p_date > (now() at time zone s.timezone)::date + s.booking_window_days then
    return;
  end if;
  if not s.allow_gender_preference then p_gender := 'any'; end if;

  select sum(v.duration_min), array_agg(distinct v.service_id),
         case when bool_or(sv.resource = 'bed') then 'bed'::resource_kind else 'chair'::resource_kind end
    into v_duration, v_service_ids, v_resource
  from service_variants v join services sv on sv.id = v.service_id
  where v.id = any(p_variant_ids) and v.is_active and sv.is_active;
  if v_duration is null then return; end if;

  v_t := (p_date + s.open_time) at time zone s.timezone;
  v_close := (p_date + s.close_time) at time zone s.timezone;
  v_earliest := now() + make_interval(mins => s.min_lead_min);

  while v_t + make_interval(mins => v_duration) <= v_close loop
    if v_t >= v_earliest and slot_is_free(v_t, v_t + make_interval(mins => v_duration), v_resource, v_service_ids, p_gender) then
      slot_start := v_t; return next;
    end if;
    v_t := v_t + make_interval(mins => s.slot_interval_min);
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────
-- Booking creation (prices are always computed here, never trusted from the browser)
-- ─────────────────────────────────────────────────────────────
create or replace function create_booking(
  p_variant_ids uuid[], p_start timestamptz, p_gender gender_pref, p_payment_mode payment_mode,
  p_name text, p_phone text, p_notes text default null,
  p_source text default 'website', p_customer uuid default null
) returns bookings
language plpgsql security definer set search_path = public as $$
declare
  s settings%rowtype;
  v_duration int;
  v_total numeric(10,2);
  v_resource resource_kind;
  v_service_ids uuid[];
  v_customer uuid;
  v_email text;
  v_end timestamptz;
  v_local timestamp;
  b bookings;
begin
  select * into s from settings where id = 1;

  if p_source = 'admin' then
    if not is_admin() and auth.role() <> 'service_role' then raise exception 'Only admin can create walk-in bookings'; end if;
    v_customer := p_customer;
  else
    v_customer := auth.uid();
    if v_customer is null then raise exception 'Please sign in to book'; end if;
    if not (p_payment_mode = any(s.payment_modes)) then raise exception 'This payment option is not available'; end if;
  end if;

  if coalesce(trim(p_name), '') = '' then raise exception 'Name is required'; end if;
  if p_phone !~ '^\+?[0-9]{10,13}$' then raise exception 'Enter a valid phone number'; end if;
  if cardinality(p_variant_ids) = 0 or cardinality(p_variant_ids) > 5 then raise exception 'Choose between 1 and 5 services'; end if;
  if not s.allow_gender_preference then p_gender := 'any'; end if;

  select sum(v.duration_min), sum(v.price), array_agg(v.service_id),
         case when bool_or(sv.resource = 'bed') then 'bed'::resource_kind else 'chair'::resource_kind end
    into v_duration, v_total, v_service_ids, v_resource
  from service_variants v join services sv on sv.id = v.service_id
  where v.id = any(p_variant_ids) and v.is_active and sv.is_active;

  if v_duration is null or cardinality(v_service_ids) <> cardinality(p_variant_ids) then
    raise exception 'One of the selected services is no longer available';
  end if;
  if (select count(distinct x) from unnest(v_service_ids) x) <> cardinality(v_service_ids) then
    raise exception 'Each service can be chosen only once';
  end if;

  v_end := p_start + make_interval(mins => v_duration);
  v_local := p_start at time zone s.timezone;

  if p_source <> 'admin' then
    if p_start < now() + make_interval(mins => s.min_lead_min) then raise exception 'This time is too soon. Please pick a later slot'; end if;
    if v_local::date > (now() at time zone s.timezone)::date + s.booking_window_days then raise exception 'This date is too far ahead'; end if;
    if v_local::time < s.open_time or (v_end at time zone s.timezone)::time > s.close_time
       or (v_end at time zone s.timezone)::date <> v_local::date then
      raise exception 'Outside opening hours';
    end if;
  end if;

  -- Serialise bookings for the same day so two people can't take the last bed.
  perform pg_advisory_xact_lock(hashtext('booking:' || v_local::date::text));

  if not slot_is_free(p_start, v_end, v_resource, v_service_ids, p_gender) then
    raise exception 'Sorry, this slot was just taken. Please choose another time';
  end if;

  if v_customer is not null then
    select email into v_email from profiles where id = v_customer;
    update profiles set phone = coalesce(phone, p_phone), full_name = coalesce(full_name, p_name) where id = v_customer;
  end if;

  insert into bookings (customer_id, customer_name, customer_phone, customer_email, start_at, end_at, resource,
                        status, gender_preference, payment_mode, total_amount, advance_amount, hold_expires_at, notes, source)
  values (v_customer, trim(p_name), p_phone, v_email, p_start, v_end, v_resource,
          case when p_payment_mode = 'pay_at_spa' then 'confirmed'::booking_status else 'pending_payment'::booking_status end,
          p_gender, p_payment_mode, v_total,
          case p_payment_mode when 'full' then v_total
                              when 'partial' then ceil(v_total * s.advance_percent / 100.0)
                              else 0 end,
          case when p_payment_mode = 'pay_at_spa' then null else now() + make_interval(mins => s.payment_hold_min) end,
          nullif(trim(p_notes), ''), p_source)
  returning * into b;

  insert into booking_items (booking_id, service_id, variant_id, name_en, name_hi, duration_min, price, commission_percent)
  select b.id, sv.id, v.id, sv.name_en, sv.name_hi, v.duration_min, v.price, sv.commission_percent
  from unnest(p_variant_ids) with ordinality as x(vid, ord)
  join service_variants v on v.id = x.vid join services sv on sv.id = v.service_id
  order by x.ord;

  insert into booking_events (booking_id, type, message, actor)
  values (b.id, 'created', case when b.status = 'confirmed' then 'Booking confirmed (pay at spa)' else 'Awaiting payment' end, auth.uid());

  return b;
end $$;

-- ─────────────────────────────────────────────────────────────
-- Assignment
-- ─────────────────────────────────────────────────────────────
create or replace function assign_employee(p_booking uuid, p_employee uuid, p_actor uuid default null)
returns bookings language plpgsql security definer set search_path = public as $$
declare b bookings; e employees; v_service_ids uuid[]; s settings%rowtype;
begin
  if auth.role() <> 'service_role' and not is_admin() then raise exception 'Not allowed'; end if;
  select * into s from settings where id = 1;
  select * into b from bookings where id = p_booking for update;
  if b.id is null then raise exception 'Booking not found'; end if;
  if b.status not in ('confirmed','assigned','pending_payment') then raise exception 'Booking can no longer be reassigned'; end if;
  select * into e from employees where id = p_employee and is_active;
  if e.id is null then raise exception 'Employee not found or inactive'; end if;

  select array_agg(service_id) into v_service_ids from booking_items where booking_id = b.id and service_id is not null;
  if exists (select 1 from unnest(coalesce(v_service_ids, '{}')) sid
             where not exists (select 1 from employee_services es where es.employee_id = e.id and es.service_id = sid)) then
    raise exception '% is not assigned to all services in this booking', e.full_name;
  end if;
  if exists (select 1 from bookings o where o.employee_id = e.id and o.id <> b.id
               and is_active_status(o.status, o.hold_expires_at)
               and tstzrange(o.start_at, o.end_at + make_interval(mins => s.buffer_min)) && tstzrange(b.start_at, b.end_at + make_interval(mins => s.buffer_min))) then
    raise exception '% already has a booking at this time', e.full_name;
  end if;

  update bookings set employee_id = e.id, employee_name = e.full_name, employee_gender = e.gender,
         status = case when status = 'confirmed' then 'assigned'::booking_status else status end
  where id = b.id returning * into b;
  insert into booking_events (booking_id, type, message, actor)
  values (b.id, 'assigned', 'Assigned to ' || e.full_name, coalesce(p_actor, auth.uid()));
  return b;
end $$;

-- Picks the least busy qualified therapist who is free. Returns null when nobody fits.
create or replace function auto_assign(p_booking uuid) returns bookings
language plpgsql security definer set search_path = public as $$
declare b bookings; v_emp uuid; v_service_ids uuid[]; s settings%rowtype;
begin
  if auth.role() <> 'service_role' and not is_admin() then raise exception 'Not allowed'; end if;
  select * into s from settings where id = 1;
  select * into b from bookings where id = p_booking;
  if b.id is null or b.employee_id is not null or b.status <> 'confirmed' then return b; end if;
  select array_agg(service_id) into v_service_ids from booking_items where booking_id = b.id and service_id is not null;

  select q into v_emp
  from qualified_employees(coalesce(v_service_ids, '{}'), b.gender_preference, (b.start_at at time zone s.timezone)::date) q
  where not exists (
    select 1 from bookings o where o.employee_id = q and o.id <> b.id and is_active_status(o.status, o.hold_expires_at)
      and tstzrange(o.start_at, o.end_at + make_interval(mins => s.buffer_min)) && tstzrange(b.start_at, b.end_at + make_interval(mins => s.buffer_min))
  )
  order by (select count(*) from bookings o where o.employee_id = q
              and (o.start_at at time zone s.timezone)::date = (b.start_at at time zone s.timezone)::date
              and o.status not in ('cancelled','no_show')), random()
  limit 1;

  if v_emp is null then return b; end if;
  return assign_employee(b.id, v_emp, null);
end $$;

-- ─────────────────────────────────────────────────────────────
-- Status changes
-- ─────────────────────────────────────────────────────────────
create or replace function set_booking_status(p_booking uuid, p_status booking_status, p_reason text default null)
returns bookings language plpgsql security definer set search_path = public as $$
declare b bookings; v_is_admin boolean := is_admin() or auth.role() = 'service_role'; v_emp uuid := current_employee_id();
        s settings%rowtype; v_commission numeric(10,2);
begin
  select * into s from settings where id = 1;
  select * into b from bookings where id = p_booking for update;
  if b.id is null then raise exception 'Booking not found'; end if;

  if not v_is_admin then
    if b.customer_id = auth.uid() and p_status = 'cancelled' then
      if b.status not in ('pending_payment','confirmed','assigned') then raise exception 'This booking can no longer be cancelled'; end if;
      if b.start_at - now() < make_interval(hours => s.cancellation_hours) then
        raise exception 'Bookings can be cancelled only up to % hours before the start time. Please call us.', s.cancellation_hours;
      end if;
    elsif v_emp is not null and b.employee_id = v_emp and p_status in ('in_progress','completed','no_show') then
      null;
    else
      raise exception 'Not allowed';
    end if;
  end if;

  if b.status in ('cancelled','completed') and not v_is_admin then raise exception 'Booking is already closed'; end if;
  if p_status = 'completed' and b.employee_id is null then raise exception 'Assign a therapist before completing'; end if;

  if p_status = 'completed' then
    select coalesce(sum(i.price * coalesce(i.commission_percent, e.commission_percent) / 100.0), 0)
      into v_commission from booking_items i, employees e where i.booking_id = b.id and e.id = b.employee_id;
  end if;

  update bookings set status = p_status,
    cancelled_at = case when p_status = 'cancelled' then now() else cancelled_at end,
    cancel_reason = case when p_status = 'cancelled' then p_reason else cancel_reason end,
    completed_at = case when p_status = 'completed' then now() else completed_at end,
    commission_amount = case when p_status = 'completed' then round(v_commission, 2)
                             when p_status in ('cancelled','no_show') then null else commission_amount end,
    hold_expires_at = case when p_status <> 'pending_payment' then null else hold_expires_at end
  where id = b.id returning * into b;

  insert into booking_events (booking_id, type, message, actor)
  values (b.id, p_status::text, coalesce(p_reason, initcap(replace(p_status::text, '_', ' '))), auth.uid());
  return b;
end $$;

-- Recompute paid amount from captured payments.
create or replace function refresh_payment_totals(p_booking uuid) returns bookings
language plpgsql security definer set search_path = public as $$
declare b bookings; v_paid numeric(10,2); v_refunded boolean;
begin
  select coalesce(sum(amount) filter (where status = 'captured'), 0),
         bool_or(status = 'refunded') and coalesce(sum(amount) filter (where status = 'captured'), 0) = 0
    into v_paid, v_refunded from payments where booking_id = p_booking;
  update bookings set amount_paid = v_paid,
    payment_status = case when v_refunded then 'refunded'::payment_status
                          when v_paid >= total_amount then 'paid'::payment_status
                          when v_paid > 0 then 'partial'::payment_status
                          else 'unpaid'::payment_status end
  where id = p_booking returning * into b;
  return b;
end $$;

-- Cash/UPI/card collected at the counter by admin or the assigned therapist.
create or replace function record_offline_payment(p_booking uuid, p_amount numeric, p_method payment_method, p_note text default null)
returns bookings language plpgsql security definer set search_path = public as $$
declare b bookings;
begin
  select * into b from bookings where id = p_booking;
  if b.id is null then raise exception 'Booking not found'; end if;
  if not (is_admin() or (current_employee_id() is not null and b.employee_id = current_employee_id())) then
    raise exception 'Not allowed';
  end if;
  if p_method = 'razorpay' then raise exception 'Online payments are recorded automatically'; end if;
  if p_amount <= 0 or p_amount > b.total_amount - b.amount_paid then raise exception 'Amount must be between 1 and the balance due'; end if;
  insert into payments (booking_id, method, amount, status, recorded_by, note)
  values (b.id, p_method, p_amount, 'captured', auth.uid(), p_note);
  insert into booking_events (booking_id, type, message, actor)
  values (b.id, 'payment', '₹' || p_amount || ' received by ' || p_method, auth.uid());
  return refresh_payment_totals(b.id);
end $$;

-- ─────────────────────────────────────────────────────────────
-- Reports (admin only)
-- ─────────────────────────────────────────────────────────────
create or replace function monthly_report(p_month date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare s settings%rowtype; v_from timestamptz; v_to timestamptz; r jsonb;
begin
  if not is_admin() then raise exception 'Not allowed'; end if;
  select * into s from settings where id = 1;
  v_from := (date_trunc('month', p_month)::date)::timestamp at time zone s.timezone;
  v_to := ((date_trunc('month', p_month) + interval '1 month')::date)::timestamp at time zone s.timezone;

  with b as (select * from bookings where start_at >= v_from and start_at < v_to),
  pay as (select p.* from payments p where p.created_at >= v_from and p.created_at < v_to)
  select jsonb_build_object(
    'month', to_char(p_month, 'YYYY-MM'),
    'summary', (select jsonb_build_object(
        'bookings', count(*),
        'completed', count(*) filter (where status = 'completed'),
        'cancelled', count(*) filter (where status = 'cancelled'),
        'no_show', count(*) filter (where status = 'no_show'),
        'upcoming', count(*) filter (where status in ('confirmed','assigned','in_progress')),
        'service_value', coalesce(sum(total_amount) filter (where status = 'completed'), 0),
        'commission', coalesce(sum(commission_amount) filter (where status = 'completed'), 0),
        'outstanding', coalesce(sum(total_amount - amount_paid) filter (where status = 'completed'), 0)
      ) from b),
    'collections', (select jsonb_build_object(
        'total', coalesce(sum(amount) filter (where status = 'captured'), 0),
        'refunded', coalesce(sum(amount) filter (where status = 'refunded'), 0),
        'by_method', coalesce((select jsonb_object_agg(method, amt) from (
            select method, sum(amount) amt from pay where status = 'captured' group by method) m), '{}'::jsonb)
      ) from pay),
    'daily', coalesce((select jsonb_agg(d order by d->>'day') from (
        select jsonb_build_object('day', to_char((start_at at time zone s.timezone)::date, 'YYYY-MM-DD'),
                                  'bookings', count(*),
                                  'revenue', coalesce(sum(total_amount) filter (where status = 'completed'), 0)) d
        from b where status not in ('pending_payment') group by (start_at at time zone s.timezone)::date) x), '[]'::jsonb),
    'services', coalesce((select jsonb_agg(x order by (x->>'revenue')::numeric desc) from (
        select jsonb_build_object('name', i.name_en, 'count', count(*), 'revenue', sum(i.price)) x
        from booking_items i join b on b.id = i.booking_id where b.status = 'completed' group by i.name_en) y), '[]'::jsonb),
    'employees', coalesce((select jsonb_agg(x order by (x->>'revenue')::numeric desc) from (
        select jsonb_build_object('id', e.id, 'name', e.full_name,
          'bookings', count(b.id) filter (where b.status = 'completed'),
          'no_show', count(b.id) filter (where b.status = 'no_show'),
          'minutes', coalesce(sum(extract(epoch from (b.end_at - b.start_at)) / 60) filter (where b.status = 'completed'), 0),
          'revenue', coalesce(sum(b.total_amount) filter (where b.status = 'completed'), 0),
          'commission', coalesce(sum(b.commission_amount) filter (where b.status = 'completed'), 0)) x
        from employees e left join b on b.employee_id = e.id group by e.id, e.full_name) y), '[]'::jsonb)
  ) into r;
  return r;
end $$;

-- Releases unpaid holds (also called before every availability check via is_active_status)
create or replace function expire_unpaid_holds() returns int
language sql security definer set search_path = public as $$
  with x as (
    update bookings set status = 'cancelled', cancelled_at = now(), cancel_reason = 'Payment not completed'
    where status = 'pending_payment' and hold_expires_at < now() returning id
  ) select count(*)::int from x;
$$;

-- ─────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────
alter table settings enable row level security;
alter table admin_emails enable row level security;
alter table profiles enable row level security;
alter table employees enable row level security;
alter table service_categories enable row level security;
alter table services enable row level security;
alter table service_variants enable row level security;
alter table employee_services enable row level security;
alter table bookings enable row level security;
alter table booking_items enable row level security;
alter table payments enable row level security;
alter table booking_events enable row level security;
alter table notification_log enable row level security;
alter table push_subscriptions enable row level security;

-- settings: everyone reads (opening hours, payment options); admin edits
drop policy if exists settings_read on settings;
create policy settings_read on settings for select using (true);
drop policy if exists settings_admin on settings;
create policy settings_admin on settings for update using (is_admin()) with check (is_admin());

drop policy if exists admin_emails_admin on admin_emails;
create policy admin_emails_admin on admin_emails for all using (is_admin()) with check (is_admin());

drop policy if exists profiles_self_read on profiles;
create policy profiles_self_read on profiles for select using (id = auth.uid() or is_admin());
drop policy if exists profiles_self_update on profiles;
create policy profiles_self_update on profiles for update using (id = auth.uid() or is_admin()) with check (id = auth.uid() or is_admin());

drop policy if exists employees_read on employees;
create policy employees_read on employees for select using (is_admin() or profile_id = auth.uid());
drop policy if exists employees_admin on employees;
create policy employees_admin on employees for all using (is_admin()) with check (is_admin());

-- catalogue: public reads active rows, admin manages everything
drop policy if exists cat_read on service_categories;
create policy cat_read on service_categories for select using (is_active or is_admin());
drop policy if exists cat_admin on service_categories;
create policy cat_admin on service_categories for all using (is_admin()) with check (is_admin());
drop policy if exists svc_read on services;
create policy svc_read on services for select using (is_active or is_admin());
drop policy if exists svc_admin on services;
create policy svc_admin on services for all using (is_admin()) with check (is_admin());
drop policy if exists var_read on service_variants;
create policy var_read on service_variants for select using (is_active or is_admin());
drop policy if exists var_admin on service_variants;
create policy var_admin on service_variants for all using (is_admin()) with check (is_admin());
drop policy if exists es_read on employee_services;
create policy es_read on employee_services for select using (is_admin() or employee_id = current_employee_id());
drop policy if exists es_admin on employee_services;
create policy es_admin on employee_services for all using (is_admin()) with check (is_admin());

-- bookings: customers see their own, employees see assigned, admin sees all. Writes go through functions.
drop policy if exists bookings_read on bookings;
create policy bookings_read on bookings for select
  using (customer_id = auth.uid() or is_admin() or (employee_id is not null and employee_id = current_employee_id()));
drop policy if exists bookings_admin_update on bookings;
create policy bookings_admin_update on bookings for update using (is_admin()) with check (is_admin());

drop policy if exists items_read on booking_items;
create policy items_read on booking_items for select using (
  exists (select 1 from bookings b where b.id = booking_id
          and (b.customer_id = auth.uid() or is_admin() or (b.employee_id is not null and b.employee_id = current_employee_id()))));

drop policy if exists payments_read on payments;
create policy payments_read on payments for select using (
  is_admin() or exists (select 1 from bookings b where b.id = booking_id and b.customer_id = auth.uid()));

drop policy if exists events_read on booking_events;
create policy events_read on booking_events for select using (
  exists (select 1 from bookings b where b.id = booking_id
          and (b.customer_id = auth.uid() or is_admin() or (b.employee_id is not null and b.employee_id = current_employee_id()))));

drop policy if exists notif_admin on notification_log;
create policy notif_admin on notification_log for select using (is_admin());

drop policy if exists push_self on push_subscriptions;
create policy push_self on push_subscriptions for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- Function permissions: lock everything down, then open what the browser needs.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;
grant execute on function get_available_slots(date, uuid[], gender_pref) to anon, authenticated;
grant execute on function is_admin(), current_employee_id(), is_active_status(booking_status, timestamptz) to anon, authenticated;
grant execute on function create_booking(uuid[], timestamptz, gender_pref, payment_mode, text, text, text, text, uuid) to authenticated;
grant execute on function set_booking_status(uuid, booking_status, text) to authenticated;
grant execute on function record_offline_payment(uuid, numeric, payment_method, text) to authenticated;
grant execute on function assign_employee(uuid, uuid, uuid), auto_assign(uuid) to authenticated;
grant execute on function monthly_report(date) to authenticated;

-- Realtime: customers/staff get live updates for the rows RLS lets them see.
do $$ begin
  alter publication supabase_realtime add table bookings;
exception when others then null; end $$;
do $$ begin
  alter publication supabase_realtime add table booking_events;
exception when others then null; end $$;
