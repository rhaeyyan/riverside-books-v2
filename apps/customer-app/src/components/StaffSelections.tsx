import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { components } from '../api/types';
import { prefersReducedMotion } from '../utils/motion';
import './StaffSelections.css';

type Book = components['schemas']['Book'];

interface StaffPick {
  title: string;
  quote: string;
  staff: string;
}

// Curated by hand, not editorial content the backend returns — matched at
// render time against whatever titles are actually in `books` (Home.tsx's
// already-fetched /api/books response) so this never references a title
// that isn't really on the shelf, and drops any pick that's sold out.
const STAFF_PICKS: StaffPick[] = [
  {
    title: 'Braiding Sweetgrass',
    quote:
      "Every time I restock this table it's thinner by Friday. Borrow it from a neighbor if you have to — just read the strawberry chapter before winter.",
    staff: 'Nora, floor 2',
  },
  {
    title: 'The Midnight Library',
    quote:
      "Handed this to three customers this week who all came back for their own copy. The book people didn't know they needed on a Tuesday.",
    staff: 'Priya, register',
  },
  {
    title: 'Educated',
    quote:
      'Stayed up until 2 a.m. with this one and opened the store the next morning running on tea and adrenaline. Worth every yawn.',
    staff: 'Marcus, back office',
  },
  {
    title: 'Kindred',
    quote:
      "Not an easy read, and it shouldn't be. Keep it on the nightstand, not the beach bag — you'll want to sit with it.",
    staff: 'Ellis, front counter',
  },
  {
    title: 'Klara and the Sun',
    quote:
      'Quietest book on this table and the one that wrecked me the most. Bring tissues and an evening with nothing else planned.',
    staff: 'Nora, floor 2',
  },
];

const ROTATE_MS = 6500;

export default function StaffSelections({ books }: { books: Book[] }) {
  const picks = useMemo(() => {
    const byTitle = new Map(books.map((b) => [b.title.toLowerCase(), b]));
    return STAFF_PICKS.reduce<Array<StaffPick & { book: Book }>>((acc, pick) => {
      const book = byTitle.get(pick.title.toLowerCase());
      if (book && book.available_count > 0) acc.push({ ...pick, book });
      return acc;
    }, []);
  }, [books]);

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [coverErrors, setCoverErrors] = useState<Record<string, boolean>>({});
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (paused || picks.length < 2 || prefersReducedMotion()) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % picks.length);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [paused, picks.length]);

  if (picks.length === 0) return null;

  // The curated list can shrink between renders (a pick sells out) — derive
  // a safe index for this render rather than storing a clamped value back
  // into state; the rotation interval above already re-keys itself off
  // picks.length whenever it changes.
  const current = picks[index < picks.length ? index : 0];
  const hasCover = Boolean(current.book.cover_image_url) && !coverErrors[current.book.isbn];

  const goTo = (next: number) => {
    setIndex(((next % picks.length) + picks.length) % picks.length);
  };

  return (
    <section
      className="staff-picks"
      aria-roledescription="carousel"
      aria-label="Staff Selections"
      ref={containerRef}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!containerRef.current?.contains(e.relatedTarget as Node)) {
          setPaused(false);
        }
      }}
    >
      <div className="staff-picks-header">
        <p className="staff-picks-eyebrow">Staff Selections</p>
        <span className="staff-picks-hint">Handwritten on the shelf this month</span>
      </div>

      {/* Not aria-live: this region auto-rotates every few seconds, and a
          polite live region would re-announce it on every rotation whether
          or not anyone is paying attention to it — the W3C carousel pattern
          specifically warns against this. Pausing on hover/focus plus the
          manual controls below are the accessible path in instead. */}
      <div className="staff-picks-body">
        <Link
          to={`/book/${current.book.isbn}`}
          className="staff-picks-cover"
          tabIndex={-1}
          aria-hidden="true"
        >
          {hasCover ? (
            <img
              src={current.book.cover_image_url}
              alt=""
              onError={() => setCoverErrors((prev) => ({ ...prev, [current.book.isbn]: true }))}
            />
          ) : (
            <span className="staff-picks-cover-fallback">{current.book.title.charAt(0).toUpperCase()}</span>
          )}
        </Link>
        <div className="staff-picks-content" key={current.title}>
          <Link to={`/book/${current.book.isbn}`} className="staff-picks-title-link">
            <h3 className="staff-picks-title">{current.book.title}</h3>
          </Link>
          <p className="staff-picks-author">{current.book.author}</p>
          <p className="staff-picks-quote">&ldquo;{current.quote}&rdquo;</p>
          <div className="staff-picks-attribution">
            <span className="staff-picks-attribution-rule" aria-hidden="true" />
            <span className="staff-picks-attribution-name">{current.staff}</span>
          </div>
        </div>
      </div>

      {picks.length > 1 && (
        <div className="staff-picks-controls">
          <button
            type="button"
            className="staff-picks-arrow"
            onClick={() => goTo(index - 1)}
            aria-label="Previous staff pick"
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <div className="staff-picks-dots" role="group" aria-label="Choose a staff pick">
            {picks.map((p, i) => (
              <button
                key={p.title}
                type="button"
                aria-label={`Show pick ${i + 1} of ${picks.length}: ${p.title}`}
                aria-current={i === index ? 'true' : undefined}
                className={`staff-picks-dot ${i === index ? 'active' : ''}`}
                onClick={() => goTo(i)}
              />
            ))}
          </div>
          <button
            type="button"
            className="staff-picks-arrow"
            onClick={() => goTo(index + 1)}
            aria-label="Next staff pick"
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      )}
    </section>
  );
}
