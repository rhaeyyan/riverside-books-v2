import { useEffect, useState } from 'react';
import { client } from '../api/client';
import type { components } from '../api/types';
import './Marketing.css';

type Book = components["schemas"]["Book"];
type Event = components["schemas"]["Event"];

export function Marketing() {
  const [books, setBooks] = useState<Book[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [tones, setTones] = useState<{ book: string[], event: string[] }>({ book: [], event: [] });
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<{type: 'book' | 'event', id: string, name: string} | null>(null);
  const [selectedTone, setSelectedTone] = useState('');
  
  const [variant, setVariant] = useState(0);
  const [generated, setGenerated] = useState<{ caption: string, hashtags: string, post_idea: string, has_image: boolean } | null>(null);
  
  useEffect(() => {
    client.GET("/api/books", {}).then(res => res.data && setBooks(res.data));
    client.GET("/api/events", {}).then(res => res.data && setEvents(res.data));
    client.GET("/api/marketing/tones", {}).then(res => res.data && setTones(res.data as any));
  }, []);

  const searchResults = () => {
    if (!searchQuery) return [];
    const q = searchQuery.toLowerCase();
    const b = books.filter(b => b.title.toLowerCase().includes(q)).map(b => ({ type: 'book' as const, id: b.isbn, name: b.title + ' (Book)' }));
    const e = events.filter(e => e.title.toLowerCase().includes(q)).map(e => ({ type: 'event' as const, id: e.event_id, name: e.title + ' (Event)' }));
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
  };

  const copyToClipboard = () => {
    if (generated) {
      navigator.clipboard.writeText(generated.caption);
      alert('Copied to clipboard!');
    }
  };

  return (
    <div className="marketing-page">
      <h1>Marketing Generator</h1>
      
      <div className="marketing-setup">
        <div className="search-section">
          <h3>1. Search Subject</h3>
          <input 
            type="text" 
            placeholder="Search for a book or event..." 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
          />
          {searchQuery && (
            <div className="search-results">
              {searchResults().map(res => (
                <div key={res.id} className="search-result-item" onClick={() => handleSelectSubject(res)}>
                  {res.name}
                </div>
              ))}
            </div>
          )}
          {selectedSubject && (
            <div className="selected-subject">
              Selected: <strong>{selectedSubject.name}</strong>
            </div>
          )}
        </div>

        <div className="tone-section">
          <h3>2. Select Tone</h3>
          <select 
            disabled={!selectedSubject}
            value={selectedTone}
            onChange={e => setSelectedTone(e.target.value)}
          >
            <option value="">-- Choose a tone --</option>
            {selectedSubject && tones[selectedSubject.type]?.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="generate-section">
          <h3>3. Generate</h3>
          <button 
            disabled={!selectedSubject || !selectedTone}
            onClick={() => generate(0)}
          >
            Generate Draft
          </button>
        </div>
      </div>

      {generated && (
        <div className="marketing-result">
          <div className="result-header">
            <h3>Generated Post</h3>
            <div className="result-actions">
              <button onClick={() => generate(variant + 1)}>Show another</button>
              <button className="primary" onClick={copyToClipboard}>Copy Caption</button>
            </div>
          </div>
          <div className="idea-box"><strong>Idea:</strong> {generated.post_idea}</div>
          <div className="caption-box">
            {generated.caption}
          </div>
          {generated.has_image && <div className="info-text">Note: Book cover image is available to attach.</div>}
        </div>
      )}
    </div>
  );
}
