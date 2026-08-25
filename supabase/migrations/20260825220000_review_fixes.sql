-- Review fixes for PR #20.
--
-- These changes were first made by editing 20260825210000_init_schema.sql
-- directly. That migration had already been applied, and Supabase records
-- applied migrations by version, so `db push` skipped the file and the edits
-- never reached the database — leaving the repo and the database silently
-- disagreeing. §5.2 rules that out in the other direction ("no schema is
-- changed by hand against a live database"); the same reasoning applies here.
-- The init migration is restored to what was actually applied, and the changes
-- live here instead.

-- ---------------------------------------------------------------------------
-- books.published_date becomes required
-- ---------------------------------------------------------------------------
-- Every book in the §6.7 seed carries one (verified across all 32), and §6.1
-- lists it as a plain YYYY-MM-DD field with no "may be empty" note — unlike
-- blurb and cover_image_url, which say so explicitly.
alter table books alter column published_date set not null;

-- ---------------------------------------------------------------------------
-- order_items.isbn — keep the foreign key, make its delete behaviour explicit
-- ---------------------------------------------------------------------------
-- The review proposed dropping this constraint so an order would still render
-- after its book was deleted. Nothing in the suite can delete a book today —
-- there is no DELETE route and no delete method on BookRepository — so that
-- would have traded a guarantee for a hypothetical, and left order_items free
-- to reference ISBNs that never existed.
--
-- `on delete restrict` expresses the same intent the review was reaching for,
-- and expresses it better: order history is protected because the database
-- refuses to delete a book that any order references, rather than because the
-- reference was never checked. If the catalogue ever genuinely needs to shed a
-- title that has order history, the answer is to denormalise the title into
-- order_items — which is the pattern §6.3 already leans on for total_cents,
-- "sum at time of order; prices may change later" — not to drop the key.
--
-- The existing constraint defaults to NO ACTION, which already blocks the
-- delete; RESTRICT additionally forbids deferring the check to commit time.
alter table order_items drop constraint order_items_isbn_fkey;

alter table order_items
    add constraint order_items_isbn_fkey
    foreign key (isbn) references books (isbn) on delete restrict;
