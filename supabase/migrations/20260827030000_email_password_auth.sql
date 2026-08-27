-- Email/password authentication for customers and staff.
--
-- Reverses part of PRD §5.3's original identity model ("phone number is the
-- whole account... there are no passwords and no sessions") and the §2.2
-- non-goal "server-side authentication" -- both explicit, deliberate
-- decisions per Appendix A, revisited here at the PRD owner's direction. See
-- docs/PRD.md v0.5 for the accompanying contract update; this migration and
-- that revision must land together.
--
-- What this does NOT do: it does not add request-level access control to any
-- existing endpoint. GET /api/customers/{id}/orders and friends remain
-- reachable by anyone holding the ID, exactly as before (§5.3, R3's
-- reachability-not-storage reasoning still stands for the rest of the API).
-- This migration is scoped to proving identity at login, not gating reads.

-- ---------------------------------------------------------------------------
-- customers: phone stops being the identity key, email + password_hash is
-- ---------------------------------------------------------------------------

-- This is demo/seed data with no real customer to preserve (PRD R8 -- no
-- real PII, ever), and scripts/seed.py --db fully repopulates every table
-- immediately after any migration runs. Existing rows predate password_hash
-- (which cannot be backfilled -- there is no plaintext to hash) and many
-- have a blank email, which the new NOT NULL/format constraints below would
-- reject. Clearing first is the honest choice here; a migration touching
-- real user data would need actual backfill logic instead, not this.
truncate table order_items, orders, customers cascade;

-- Phone is no longer required or unique -- it becomes optional pickup-contact
-- info, same role a real bookstore's till already gives it, not an account
-- key. Existing constraint/index depended on NOT NULL; drop and re-add
-- narrower.
alter table customers alter column phone drop not null;

-- Email is the new identity key: required, unique, and (loosely) shaped like
-- an email address -- demo-grade validation, not RFC 5322.
alter table customers alter column email drop default;
alter table customers alter column email set not null;
alter table customers add constraint customers_email_looks_valid
    check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');
alter table customers add constraint customers_email_unique unique (email);

alter table customers add column password_hash text not null default '';
alter table customers alter column password_hash drop default;
alter table customers add constraint customers_password_hash_present
    check (length(password_hash) > 0);

comment on column customers.email is
    'PRD §5.3 (v0.5): the identity key. bcrypt-verified at login via '
    'POST /api/customers/login. Replaces the v0.1-v0.4 phone-only model.';
comment on column customers.password_hash is
    'bcrypt hash (backend/api/core/auth.py). Never selected into an API '
    'response -- the Customer Pydantic model does not declare this field, so '
    'it cannot leak through response_model even by omission of an explicit '
    'exclude.';
comment on column customers.phone is
    'Optional pickup-contact info as of v0.5 -- no longer the identity key. '
    'See email/password_hash for the account.';

-- ---------------------------------------------------------------------------
-- staff  (new -- v0.4's PIN screen had no server-side table at all)
-- ---------------------------------------------------------------------------
create table staff (
    staff_id       text primary key,
    email          text        not null unique,
    password_hash  text        not null,
    name           text        not null,
    role           text        not null,

    constraint staff_email_looks_valid
        check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
    constraint staff_role_valid check (role in ('Manager', 'Bookseller')),
    constraint staff_password_hash_present check (length(password_hash) > 0)
);

comment on table staff is
    'PRD §5.3 (v0.5). Provisioned by seed data only -- no self-registration '
    'endpoint, matching how a real store''s manager hands out accounts. '
    'Authenticated via POST /api/staff/login; still does not gate any other '
    'endpoint (§2.2''s non-goal, R3''s reachability-not-storage reasoning, '
    'both otherwise unchanged).';

alter table staff enable row level security;
