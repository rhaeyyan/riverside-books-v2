-- Riverside Books — initial schema.
--
-- Implements PRD §6. Field names and types are the binding half of that
-- section and are reproduced exactly; §6 explicitly leaves nullability,
-- indexes, and foreign keys "decided in the migration that creates each table
-- and reviewed with it", which is what the constraints below are.
--
-- Two conventions from §5.2 carried over deliberately:
--   * Money is integer cents. No numeric, no float, anywhere.
--   * IDs stay application-generated prefixed strings (cust_001, order_001).
--     No sequences and no uuid defaults, so an ID means the same thing before
--     and after it is persisted.

-- ---------------------------------------------------------------------------
-- books  (§6.1, formerly inventory.json)
-- ---------------------------------------------------------------------------
create table books (
    isbn                 text primary key,
    title                text        not null,
    author               text        not null,
    format               text        not null,
    price_cents          integer     not null,
    stock_count          integer     not null default 0,
    reserved_count       integer     not null default 0,
    low_stock_threshold  integer     not null default 2,
    genre                text        not null default '',
    blurb                text        not null default '',
    cover_image_url      text        not null default '',
    publisher            text        not null default '',
    published_date       date,

    constraint books_isbn_is_13_digits    check (isbn ~ '^[0-9]{13}$'),
    constraint books_format_valid         check (format in ('hardcover', 'paperback')),
    constraint books_price_non_negative   check (price_cents >= 0),
    constraint books_stock_non_negative   check (stock_count >= 0),
    -- §5.4: reserved copies are a subset of the copies actually on the shelf.
    -- available_count is derived as stock_count - reserved_count and must never
    -- be negative, so the database refuses the state rather than serving a
    -- phantom-stock answer to Product C.
    constraint books_reserved_in_range    check (reserved_count between 0 and stock_count),
    constraint books_threshold_positive   check (low_stock_threshold >= 0)
);

-- Product A, B and C all search title/author case-insensitively (§8.A.1, §8.C.2).
create index books_title_lower_idx  on books (lower(title));
create index books_author_lower_idx on books (lower(author));
create index books_genre_idx        on books (genre);

comment on table books is
    'PRD §6.1. available_count and stock_status are DERIVED (§5.4/§5.6) and are '
    'deliberately not stored — computing them server-side from stock_count and '
    'reserved_count is what keeps every product''s answer identical.';

-- ---------------------------------------------------------------------------
-- customers  (§6.2)
-- ---------------------------------------------------------------------------
create table customers (
    customer_id        text primary key,
    phone              text        not null unique,
    name               text        not null,
    email              text        not null default '',
    stamps             integer     not null default 0,
    rewards_available  integer     not null default 0,
    joined_date        date        not null,

    constraint customers_phone_is_10_digits check (phone ~ '^[0-9]{10}$'),
    -- §6.2: 0-9, rolling over to a reward at 10. A stored 10 would mean a
    -- reward the customer never received.
    constraint customers_stamps_in_range    check (stamps between 0 and 9),
    constraint customers_rewards_non_negative check (rewards_available >= 0)
);

comment on column customers.phone is
    'PRD §5.3: the identity key. Normalised to digits only — there are no '
    'passwords and no sessions, so this column is the whole account.';

-- ---------------------------------------------------------------------------
-- orders  (§6.3)
-- ---------------------------------------------------------------------------
create table orders (
    order_id         text primary key,
    customer_id      text        not null references customers (customer_id),
    status           text        not null,
    created_at       timestamptz not null,
    hold_expires_at  timestamptz not null,
    total_cents      integer     not null,
    notes            text        not null default '',

    constraint orders_status_valid check (
        status in ('pending', 'ready_for_pickup', 'completed', 'cancelled', 'expired')
    ),
    constraint orders_total_non_negative check (total_cents >= 0),
    constraint orders_expiry_after_creation check (hold_expires_at > created_at)
);

-- The §5.7 sweep asks exactly one question on every read: which pending holds
-- have lapsed? This index is that question.
create index orders_pending_expiry_idx
    on orders (hold_expires_at)
    where status = 'pending';

create index orders_customer_idx on orders (customer_id);
create index orders_status_idx   on orders (status);

-- ---------------------------------------------------------------------------
-- order_items  (§6.3 `items`, normalised out of the JSON array)
-- ---------------------------------------------------------------------------
create table order_items (
    order_id  text    not null references orders (order_id) on delete cascade,
    isbn      text    not null references books (isbn),
    quantity  integer not null,

    primary key (order_id, isbn),
    constraint order_items_quantity_positive check (quantity > 0)
);

comment on table order_items is
    'PRD §6.3 stored `items` as an inline array. The primary key collapses a '
    'repeated ISBN into one row, which is what the API already did implicitly.';

-- ---------------------------------------------------------------------------
-- events  (§6.4)
-- ---------------------------------------------------------------------------
create table events (
    event_id      text primary key,
    title         text        not null,
    author_name   text        not null default '',
    starts_at     timestamptz not null,
    capacity      integer     not null,
    tickets_sold  integer     not null default 0,
    description   text        not null default '',

    constraint events_capacity_positive   check (capacity > 0),
    -- Sold out is tickets_sold = capacity (§8.C.4). Oversold is not a state
    -- any product knows how to render.
    constraint events_tickets_in_range    check (tickets_sold between 0 and capacity)
);

-- §8.C.4 and GET /events both order soonest-first.
create index events_starts_at_idx on events (starts_at);

-- ---------------------------------------------------------------------------
-- store_info  (§6.5 — a single row)
-- ---------------------------------------------------------------------------
create table store_info (
    -- Singleton guard: `id` can only ever be true, so a second row is rejected
    -- by the primary key rather than by convention.
    id        boolean primary key default true,
    name      text  not null,
    address   text  not null,
    phone     text  not null,
    email     text  not null,
    hours     jsonb not null,
    policies  jsonb not null,
    faqs      jsonb not null default '[]'::jsonb,

    constraint store_info_is_singleton check (id),
    constraint store_info_hours_is_object    check (jsonb_typeof(hours) = 'object'),
    constraint store_info_policies_is_object check (jsonb_typeof(policies) = 'object'),
    constraint store_info_faqs_is_array      check (jsonb_typeof(faqs) = 'array')
);

comment on column store_info.hours is
    'PRD §6.5: keyed monday-sunday, each {"open","close"} or null when closed. '
    'Kept as jsonb rather than normalised — §6 calls store_info a single row, '
    'and the chatbot reads the whole object at once (§8.C.3).';

-- ---------------------------------------------------------------------------
-- messages  (§6.6 — chatbot escalations, Product B's inbox)
-- ---------------------------------------------------------------------------
create table messages (
    message_id  text primary key,
    name        text        not null,
    contact     text        not null,
    body        text        not null,
    created_at  timestamptz not null,
    status      text        not null default 'new',

    constraint messages_status_valid check (status in ('new', 'read'))
);

create index messages_status_created_idx on messages (status, created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- Supabase exposes the `public` schema through PostgREST, and the anon key is
-- public by design — it is meant to be embedded in a browser. A table in an
-- exposed schema without RLS is readable *and writable* by `anon`, which would
-- put a second writer on the store's data and break §5.1's "one writer, one
-- truth" without anyone touching the API.
--
-- RLS is enabled with NO policies, which is a deliberate default-deny: every
-- request arriving over the Data API is refused. Nothing legitimate is lost.
-- The FastAPI backend connects as `postgres`, which carries BYPASSRLS, so the
-- repository layer is unaffected — it remains the only path to this data,
-- which is exactly what §5.1 and §5.2 require.
--
-- If a product ever genuinely needs to read Supabase directly, that is a
-- schema-contract change: it needs a policy written and reviewed here, not a
-- table quietly left open.

alter table books       enable row level security;
alter table customers   enable row level security;
alter table orders      enable row level security;
alter table order_items enable row level security;
alter table events      enable row level security;
alter table store_info  enable row level security;
alter table messages    enable row level security;
