import { useEffect, useState } from 'react';
import { client } from '../api/client';
import type { components } from '../api/types';

type Book = components["schemas"]["Book"];
type Event = components["schemas"]["Event"];

export function Marketing() {
  const [books, setBooks] = useState<Book[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [tones, setTones] = useState<{ book: string[], event: string[] }>({ book: [], event: [] });
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<{type: 'book' | 'event', id: string, name: string, author?: string, price?: number} | null>(null);
  const [selectedTone, setSelectedTone] = useState('');
  
  const [variant, setVariant] = useState(0);
  const [generated, setGenerated] = useState<{ caption: string, hashtags: string, post_idea: string, has_image: boolean } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  useEffect(() => {
    client.GET("/api/books", {}).then(res => res.data && setBooks(res.data));
    client.GET("/api/events", {}).then(res => res.data && setEvents(res.data));
    client.GET("/api/marketing/tones", {}).then(res => res.data && setTones(res.data as any));
  }, []);

  const searchResults = () => {
    if (!searchQuery) return [];
    const q = searchQuery.toLowerCase();
    const b = books.filter(b => b.title.toLowerCase().includes(q)).map(b => ({ type: 'book' as const, id: b.isbn, name: b.title, author: b.author, price: b.price_cents / 100 }));
    const e = events.filter(e => e.title.toLowerCase().includes(q)).map(e => ({ type: 'event' as const, id: e.event_id, name: e.title, price: undefined }));
    return [...b, ...e].slice(0, 10);
  };

  const handleSelectSubject = (subj: any) => {
    setSelectedSubject(subj);
    setSelectedTone('');
    setSearchQuery('');
    setGenerated(null);
    setVariant(0);
  };

  const generate = async (v = 0) => {
    if (!selectedSubject || !selectedTone) return;
    setIsGenerating(true);
    setGenerated(null);
    
    try {
      const res = await client.POST("/api/marketing/generate", {
        body: {
          subject_type: selectedSubject.type,
          subject_id: selectedSubject.id,
          tone: selectedTone,
          variant: v
        }
      });
      if (res.data) {
        setGenerated(res.data as any);
        setVariant(v);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = () => {
    if (generated) {
      navigator.clipboard.writeText(generated.caption);
      alert('Copied to clipboard!');
    }
  };

  return (
    <section aria-labelledby="generator-heading" className="min-w-0 p-8 max-w-7xl mx-auto">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--text)]">
          Deterministic preview
        </p>
        <h2 id="generator-heading" className="mt-2 text-3xl font-semibold tracking-[-0.025em] text-[var(--text-h)]">
          Create social content
        </h2>
        <p className="mt-3 text-base leading-7 text-[var(--text)]">
          Choose a trusted record and channel, then review stable options.
          There is no free-text prompt and nothing is published automatically.
        </p>
      </div>

      <div className="mt-8 grid min-w-0 gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="min-w-0 space-y-5">
          <div className="relative">
            <label htmlFor="search" className="text-sm font-semibold text-[var(--text-h)]">
              Search Record
            </label>
            <input
              id="search"
              type="text"
              placeholder="Search for a book or event..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[var(--border)] bg-[var(--bg-raised)] text-[var(--text-h)] px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            />
            {searchQuery && (
              <div className="absolute z-10 w-full mt-1 bg-[var(--bg-raised)] border border-[var(--border)] rounded-xl shadow-lg max-h-60 overflow-y-auto">
                {searchResults().map(res => (
                  <button
                    key={res.id}
                    type="button"
                    onClick={() => handleSelectSubject(res)}
                    className="block w-full appearance-none bg-transparent text-left px-4 py-3 cursor-pointer hover:bg-[var(--code-bg)] border-b border-[var(--border)] last:border-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                  >
                    <div className="font-medium text-[var(--text-h)]">{res.name}</div>
                    <div className="text-xs text-[var(--text)] capitalize">{res.type}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <section aria-label="Source facts" className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--code-bg)] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text)]">
              Source facts
            </p>
            <dl className="mt-4 grid min-w-0 gap-4 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
              <div className="min-w-0">
                <dt className="text-xs font-medium uppercase tracking-wide text-[var(--text)]">
                  Title
                </dt>
                <dd className="mt-1 break-words font-semibold text-[var(--text-h)]">
                  {selectedSubject ? selectedSubject.name : "—"}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs font-medium uppercase tracking-wide text-[var(--text)]">
                  Author / Type
                </dt>
                <dd className="mt-1 break-words text-[var(--text)]">
                  {selectedSubject?.author || selectedSubject?.type || "—"}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs font-medium uppercase tracking-wide text-[var(--text)]">
                  Price
                </dt>
                <dd className="mt-1 text-[var(--text)]">
                  {selectedSubject?.price ? `$${selectedSubject.price.toFixed(2)}` : "—"}
                </dd>
              </div>
            </dl>
          </section>

          <fieldset role="radiogroup" aria-labelledby="channel-legend" className="min-w-0">
            <legend id="channel-legend" className="text-sm font-semibold text-[var(--text-h)]">
              Tone / Channel
            </legend>
            <div className="mt-2 grid grid-cols-2 gap-3">
              {selectedSubject ? (
                tones[selectedSubject.type]?.map(t => (
                  <label
                    key={t}
                    className="flex min-h-11 min-w-0 cursor-pointer items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-raised)] px-3 py-2 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--accent)]"
                  >
                    <input
                      type="radio"
                      name="tone"
                      value={t}
                      checked={selectedTone === t}
                      onChange={() => setSelectedTone(t)}
                      className="size-5 shrink-0 accent-[var(--accent)]"
                    />
                    <span className="min-w-0 break-words capitalize text-[var(--text-h)]">
                      {t.replace('_', ' ')}
                    </span>
                  </label>
                ))
              ) : (
                <div className="col-span-2 text-sm text-[var(--text)]">Select a record first</div>
              )}
            </div>
          </fieldset>

          {/* --ink/--ink-hover/--ink-text are fixed, non-theme-adaptive tokens (no
              dark-mode override in index.css), matching the same pairing already
              used for filled dark-surface buttons in Inventory/Preorders/SignIn. */}
          <button
            type="button"
            onClick={() => generate(0)}
            disabled={!selectedSubject || !selectedTone || isGenerating}
            className="min-h-11 w-full rounded-xl bg-[var(--ink)] px-5 py-3 text-base font-semibold text-[var(--ink-text)] transition-colors hover:bg-[var(--ink-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-wait disabled:opacity-65"
          >
            {isGenerating ? "Generating…" : "Generate Draft"}
          </button>
        </div>

        <div className="min-w-0" aria-live="polite" aria-busy={isGenerating}>
          {!generated ? (
            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg-raised)] p-6 text-sm leading-6 text-[var(--text)] flex items-center justify-center min-h-[300px] text-center">
              Generated variations will appear here after you choose Generate.
            </div>
          ) : (
            <div className="grid min-w-0 gap-4">
              <article role="region" aria-label="Variation" className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--bg-raised)] p-6 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-semibold text-[var(--text-h)]">Draft {variant + 1}</h3>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => generate(variant + 1)}
                      disabled={isGenerating}
                      className="text-sm font-medium text-[var(--text)] hover:text-[var(--text-h)] px-3 py-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--code-bg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-wait disabled:opacity-65"
                    >
                      Regenerate
                    </button>
                    <button
                      type="button"
                      onClick={copyToClipboard}
                      /* --accent-hover, not --accent, at rest: --accent on --accent-bg
                         computes to ~4.36:1 in dark mode, below the 4.5:1 minimum for
                         this text size -- --accent-hover clears it in both schemes
                         (~5.57 dark, ~7.24 light). hover darkens the background via
                         color-mix, matching the pattern already used for fixed-token
                         hover states elsewhere in this app (e.g. Preorders.css). */
                      className="text-sm font-medium text-[var(--accent-hover)] px-3 py-1.5 rounded-lg border border-[var(--accent-border)] bg-[var(--accent-bg)] hover:bg-[color-mix(in_srgb,var(--accent)_18%,var(--bg-raised))] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                    >
                      Copy Caption
                    </button>
                  </div>
                </div>

                <div className="mt-4 min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text)]">Caption</p>
                  <p aria-label="Caption" className="mt-2 break-words text-base leading-7 text-[var(--text-h)] whitespace-pre-wrap">
                    {generated.caption}
                  </p>
                </div>

                <div className="mt-6 min-w-0 border-t border-[var(--border)] pt-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text)]">Post idea</p>
                  <p aria-label="Post idea" className="mt-2 break-words text-sm leading-6 text-[var(--text)]">
                    {generated.post_idea}
                  </p>
                </div>

                <p className="mt-6 flex items-start gap-2 rounded-xl bg-[var(--status-in-bg)] px-3 py-2 text-sm font-medium text-[var(--status-in)]">
                  <span aria-hidden="true" className="font-bold">✓</span>
                  <span>No unsupported facts flagged</span>
                </p>
              </article>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
