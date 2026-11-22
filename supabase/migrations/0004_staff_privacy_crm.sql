-- 0004: staff privacy + start-time lock, customer records, employee leave, reschedule, staff calendar.
-- Run once in Supabase → SQL Editor (after 0001–0003). Safe to run again.

-- ── Settings ──────────────────────────────────────────────────
alter table settings add column if not exists staff_early_start_min int not null default 0;
do $$ begin
  alter table settings add constraint staff_early_start_range check (staff_early_start_min between 0 and 120);
exception when duplicate_object then null; end $$;

-- ── Customer key: last 10 digits of the phone, so "+91 98…" and "98…" are the same person ──
alter table bookings add column if not exists customer_phone_key text
  generated always as (right(regexp_replace(customer_phone, '\D', '', 'g'), 10)) stored;
create index if not exists bookings_phone_key_idx on bookings (customer_phone_key);

create table if not exists customer_notes (
  phone_key text primary key check (phone_key ~ '^[0-9]{10}$'),
  note text,
  tags text[] not null default '{}',
  is_blocked boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id) on delete set null
);

create table if not exists employee_time_off (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  day date not null,
  reason text,
  created_at timestamptz not null default now(),
  unique (employee_id, day)
);

alter table customer_notes enable row level security;
alter table employee_time_off enable row level security;

drop policy if exists customer_notes_admin on customer_notes;
create policy customer_notes_admin on customer_notes for all using (is_admin()) with check (is_admin());
drop policy if exists time_off_admin on employee_time_off;
create policy time_off_admin on employee_time_off for all using (is_admin()) with check (is_admin());
drop policy if exists time_off_self on employee_time_off;
create policy time_off_self on employee_time_off for select using (employee_id = current_employee_id());

-- ── Staff must not read the bookings table directly (it holds the customer's phone). ──
-- They get their schedule from staff_bookings(), which leaves contact details out.
create or replace function is_my_assigned_booking(p_booking uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from bookings b where b.id = p_booking
                 and b.employee_id is not null and b.employee_id = current_employee_id());
$$;
create or replace function is_my_customer_booking(p_booking uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from bookings b where b.id = p_booking and b.customer_id = auth.uid());
$$;

drop policy if exists bookings_read on bookings;
create policy bookings_read on bookings for select using (customer_id = auth.uid() or is_admin());

drop policy if exists items_read on booking_items;
create policy items_read on booking_items for select
  using (is_admin() or is_my_customer_booking(booking_id) or is_my_assigned_booking(booking_id));

drop policy if exists events_read on booking_events;
create policy events_read on booking_events for select
  using (is_admin() or is_my_customer_booking(booking_id) or is_my_assigned_booking(booking_id));

-- ── Updated functions ──────────────────────────────────────────
create or replace function qualified_employees(p_service_ids uuid[], p_gender gender_pref, p_day date)
returns setof uuid language sql stable security definer set search_path = public as $$
  select e.id from employees e
  where e.is_active
    and (p_gender = 'any' or e.gender::text = p_gender::text)
    and (e.weekly_off is null or e.weekly_off <> extract(dow from p_day)::int)
    and not exists (select 1 from employee_time_off t where t.employee_id = e.id and t.day = p_day)
    and not exists (
      select 1 from unnest(p_service_ids) sid
      where not exists (select 1 from employee_services es where es.employee_id = e.id and es.service_id = sid)
    );
$$;

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
  if p_source <> 'admin' and exists (select 1 from customer_notes n
       where n.phone_key = right(regexp_replace(p_phone, '\D', '', 'g'), 10) and n.is_blocked) then
    raise exception 'Online booking is not available for this number. Please call us.';
  end if;
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

  if exists (select 1 from employee_time_off t where t.employee_id = e.id
             and t.day = (b.start_at at time zone s.timezone)::date) then
    raise exception '% is on leave that day', e.full_name;
  end if;

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

create or replace function set_booking_status(p_booking uuid, p_status booking_status, p_reason text default null)
returns bookings language plpgsql security definer set search_path = public as $$
declare b bookings; v_is_admin boolean := is_admin() or auth.role() = 'service_role'; v_emp uuid := current_employee_id();
        s settings%rowtype; v_commission numeric(10,2); v_customer boolean;
begin
  select * into s from settings where id = 1;
  select * into b from bookings where id = p_booking for update;
  if b.id is null then raise exception 'Booking not found'; end if;
  v_customer := b.customer_id is not null and b.customer_id = auth.uid();

  if v_is_admin then
    -- Admin can do everything, including starting early, but transitions must make sense.
    if p_status = 'in_progress' then
      if b.status not in ('confirmed','assigned') then raise exception 'Only confirmed bookings can be started'; end if;
      if b.employee_id is null then raise exception 'Assign a therapist before starting'; end if;
    elsif p_status = 'assigned' then
      if b.status <> 'in_progress' or b.employee_id is null then raise exception 'Only a session in progress can be moved back'; end if;
    elsif p_status = 'completed' then
      if b.status not in ('assigned','in_progress') then raise exception 'Only an assigned or running session can be completed'; end if;
    elsif p_status = 'no_show' then
      if b.status not in ('confirmed','assigned') then raise exception 'Only an upcoming booking can be marked no-show'; end if;
    elsif p_status = 'cancelled' then
      if b.status in ('completed','cancelled','no_show') then raise exception 'Booking is already closed'; end if;
    else
      raise exception 'This status change is not supported';
    end if;
  elsif v_customer and p_status = 'cancelled' then
    if b.status not in ('pending_payment','confirmed','assigned') then raise exception 'This booking can no longer be cancelled'; end if;
    if b.start_at - now() < make_interval(hours => s.cancellation_hours) then
      raise exception 'Bookings can be cancelled only up to % hours before the start time. Please call us.', s.cancellation_hours;
    end if;
  elsif v_emp is not null and b.employee_id = v_emp then
    if p_status = 'in_progress' then
      if b.status <> 'assigned' then raise exception 'Only an assigned booking can be started'; end if;
      if now() < b.start_at - make_interval(mins => s.staff_early_start_min) then
        raise exception 'This session starts at %. Ask the admin to start it early.',
          to_char(b.start_at at time zone s.timezone, 'DD Mon, HH12:MI AM');
      end if;
    elsif p_status = 'completed' then
      if b.status <> 'in_progress' then raise exception 'Start the session before completing it'; end if;
    elsif p_status = 'no_show' then
      if b.status <> 'assigned' then raise exception 'Only an upcoming booking can be marked no-show'; end if;
      if now() < b.start_at then raise exception 'You can mark no-show only after the start time'; end if;
    else
      raise exception 'Not allowed';
    end if;
  else
    raise exception 'Not allowed';
  end if;

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
  values (b.id, p_status::text,
          coalesce(p_reason, case p_status when 'in_progress' then 'Session started'
                                           when 'assigned' then 'Session start undone'
                                           when 'completed' then 'Session completed'
                                           when 'no_show' then 'Marked as no-show'
                                           else initcap(replace(p_status::text, '_', ' ')) end),
          auth.uid());

  if not v_is_admin and not v_customer then b.customer_phone := ''; b.customer_email := null; end if;
  return b;
end $$;


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
  b := refresh_payment_totals(b.id);
  if not is_admin() then b.customer_phone := ''; b.customer_email := null; end if; -- staff never receive contact details
  return b;
end $$;

-- ── New functions ─────────────────────────────────────────────

-- Therapist's own schedule, without customer phone/email.
create or replace function staff_bookings(p_from timestamptz, p_to timestamptz)
returns table (
  id uuid, code text, customer_name text, start_at timestamptz, end_at timestamptz,
  resource resource_kind, status booking_status, total_amount numeric, amount_paid numeric,
  payment_status payment_status, payment_mode payment_mode, notes text, commission_amount numeric,
  items jsonb, can_start boolean
) language sql stable security definer set search_path = public as $$
  select b.id, b.code, b.customer_name, b.start_at, b.end_at, b.resource, b.status,
         b.total_amount, b.amount_paid, b.payment_status, b.payment_mode, b.notes, b.commission_amount,
         coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'name_en', i.name_en, 'name_hi', i.name_hi,
                                                       'duration_min', i.duration_min))
                   from booking_items i where i.booking_id = b.id), '[]'::jsonb),
         b.status = 'assigned' and now() >= b.start_at - make_interval(mins => (select staff_early_start_min from settings where id = 1))
  from bookings b
  where current_employee_id() is not null
    and b.employee_id = current_employee_id()
    and b.start_at >= p_from and b.start_at < p_to
    and p_to - p_from <= interval '120 days'
    and b.status not in ('pending_payment','cancelled')
  order by b.start_at;
$$;

-- Therapist's own numbers for a month.
create or replace function staff_stats(p_month date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_emp uuid := current_employee_id(); s settings%rowtype; v_from timestamptz; v_to timestamptz; r jsonb;
begin
  if v_emp is null then raise exception 'Not allowed'; end if;
  select * into s from settings where id = 1;
  v_from := (date_trunc('month', p_month)::date)::timestamp at time zone s.timezone;
  v_to := ((date_trunc('month', p_month) + interval '1 month')::date)::timestamp at time zone s.timezone;
  select jsonb_build_object(
    'month_completed', count(*) filter (where status = 'completed' and start_at >= v_from and start_at < v_to),
    'month_minutes', coalesce(sum(extract(epoch from (end_at - start_at)) / 60) filter (where status = 'completed' and start_at >= v_from and start_at < v_to), 0),
    'month_service_value', coalesce(sum(total_amount) filter (where status = 'completed' and start_at >= v_from and start_at < v_to), 0),
    'month_commission', coalesce(sum(commission_amount) filter (where status = 'completed' and start_at >= v_from and start_at < v_to), 0),
    'month_no_show', count(*) filter (where status = 'no_show' and start_at >= v_from and start_at < v_to),
    'upcoming', count(*) filter (where status in ('assigned','confirmed') and start_at >= now()),
    'all_time_completed', count(*) filter (where status = 'completed'),
    'commission_percent', (select commission_percent from employees where id = v_emp)
  ) into r from bookings where employee_id = v_emp;
  return r;
end $$;

-- Admin moves a booking to another time. Keeps the therapist if they are free, otherwise unassigns.
create or replace function reschedule_booking(p_booking uuid, p_start timestamptz)
returns bookings language plpgsql security definer set search_path = public as $$
declare b bookings; s settings%rowtype; v_end timestamptz; v_service_ids uuid[]; v_keep boolean := true; v_old timestamptz;
begin
  if not is_admin() and auth.role() <> 'service_role' then raise exception 'Not allowed'; end if;
  select * into s from settings where id = 1;
  select * into b from bookings where id = p_booking for update;
  if b.id is null then raise exception 'Booking not found'; end if;
  if b.status not in ('pending_payment','confirmed','assigned') then raise exception 'Only upcoming bookings can be moved'; end if;
  v_old := b.start_at;
  v_end := p_start + (b.end_at - b.start_at);
  perform pg_advisory_xact_lock(hashtext('booking:' || (p_start at time zone s.timezone)::date::text));

  select array_agg(service_id) into v_service_ids from booking_items where booking_id = b.id and service_id is not null;
  if not slot_is_free(p_start, v_end, b.resource, coalesce(v_service_ids, '{}'), b.gender_preference, b.id) then
    raise exception 'That time is not free (rooms or qualified therapists are busy)';
  end if;

  if b.employee_id is not null then
    v_keep := not exists (select 1 from employee_time_off t where t.employee_id = b.employee_id
                            and t.day = (p_start at time zone s.timezone)::date)
          and not exists (select 1 from bookings o where o.employee_id = b.employee_id and o.id <> b.id
                            and is_active_status(o.status, o.hold_expires_at)
                            and tstzrange(o.start_at, o.end_at + make_interval(mins => s.buffer_min))
                                && tstzrange(p_start, v_end + make_interval(mins => s.buffer_min)))
          and exists (select 1 from employees e where e.id = b.employee_id and e.is_active
                        and (e.weekly_off is null or e.weekly_off <> extract(dow from (p_start at time zone s.timezone))::int));
  end if;

  update bookings set start_at = p_start, end_at = v_end, reminder_sent_at = null,
    employee_id = case when v_keep then employee_id else null end,
    employee_name = case when v_keep then employee_name else null end,
    employee_gender = case when v_keep then employee_gender else null end,
    status = case when not v_keep and status = 'assigned' then 'confirmed'::booking_status else status end
  where id = b.id returning * into b;

  insert into booking_events (booking_id, type, message, actor)
  values (b.id, 'rescheduled',
          'Moved from ' || to_char(v_old at time zone s.timezone, 'DD Mon HH12:MI AM') || ' to ' ||
          to_char(p_start at time zone s.timezone, 'DD Mon HH12:MI AM') ||
          case when v_keep then '' else ' (therapist unassigned)' end, auth.uid());
  return b;
end $$;

-- Customer list for admin, grouped by phone number.
create or replace function admin_customers(p_search text default null, p_limit int default 50, p_offset int default 0)
returns table (
  phone_key text, name text, phone text, email text, customer_id uuid,
  bookings bigint, completed bigint, cancelled bigint, no_show bigint,
  spent numeric, paid numeric, first_visit timestamptz, last_visit timestamptz, next_visit timestamptz,
  tags text[], is_blocked boolean, note text, total_count bigint
) language plpgsql stable security definer set search_path = public as $$
declare v_q text := nullif(trim(coalesce(p_search, '')), ''); v_digits text;
begin
  if not is_admin() then raise exception 'Not allowed'; end if;
  v_digits := nullif(regexp_replace(coalesce(v_q, ''), '\D', '', 'g'), '');
  return query
  with agg as (
    select b.customer_phone_key as k,
      (array_agg(b.customer_name order by b.created_at desc))[1] as name,
      (array_agg(b.customer_phone order by b.created_at desc))[1] as phone,
      (array_agg(b.customer_email order by b.created_at desc) filter (where b.customer_email is not null))[1] as email,
      (array_agg(b.customer_id order by b.created_at desc) filter (where b.customer_id is not null))[1] as cid,
      count(*) as bookings,
      count(*) filter (where b.status = 'completed') as completed,
      count(*) filter (where b.status = 'cancelled') as cancelled,
      count(*) filter (where b.status = 'no_show') as no_show,
      coalesce(sum(b.total_amount) filter (where b.status = 'completed'), 0) as spent,
      coalesce(sum(b.amount_paid), 0) as paid,
      min(b.start_at) filter (where b.status = 'completed') as first_visit,
      max(b.start_at) filter (where b.status = 'completed') as last_visit,
      min(b.start_at) filter (where b.status in ('confirmed','assigned') and b.start_at >= now()) as next_visit,
      max(b.start_at) as last_activity
    from bookings b
    where b.status <> 'pending_payment'
    group by b.customer_phone_key
  )
  select a.k, a.name, a.phone, a.email, a.cid, a.bookings, a.completed, a.cancelled, a.no_show,
         a.spent, a.paid, a.first_visit, a.last_visit, a.next_visit,
         coalesce(n.tags, '{}'::text[]), coalesce(n.is_blocked, false), n.note,
         count(*) over ()
  from agg a left join customer_notes n on n.phone_key = a.k
  where v_q is null
     or a.name ilike '%' || v_q || '%'
     or a.email ilike '%' || v_q || '%'
     or (v_digits is not null and a.k like '%' || v_digits || '%')
     or v_q = any(coalesce(n.tags, '{}'::text[]))
  order by a.last_activity desc nulls last
  limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0);
end $$;

-- ── Permissions ───────────────────────────────────────────────
grant select, insert, update, delete on customer_notes, employee_time_off to authenticated;
grant all on customer_notes, employee_time_off to service_role;

revoke execute on function staff_bookings(timestamptz, timestamptz), staff_stats(date),
  reschedule_booking(uuid, timestamptz), admin_customers(text, int, int),
  is_my_assigned_booking(uuid), is_my_customer_booking(uuid) from public, anon;
grant execute on function staff_bookings(timestamptz, timestamptz), staff_stats(date),
  reschedule_booking(uuid, timestamptz), admin_customers(text, int, int),
  is_my_assigned_booking(uuid), is_my_customer_booking(uuid) to authenticated;
grant execute on all functions in schema public to service_role;
