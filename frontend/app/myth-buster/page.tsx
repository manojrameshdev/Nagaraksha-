'use client';
import { useState, useEffect, useRef } from 'react';
import { getKnowledgeBase, type KnowledgeResult } from '@/lib/nagraksha';

export default function MythBusterPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<KnowledgeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!query.trim()) return;
    debounceRef.current = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      getKnowledgeBase(query, 6)
        .then(({ results: r }) => setResults(r))
        .catch((e) => setError(e instanceof Error ? e.message : 'Search failed'))
        .finally(() => setLoading(false));
    }, 400);
    return () => window.clearTimeout(debounceRef.current);
  }, [query]);

  return (
    <main className="max-w-2xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold">Myth Buster</h1>
      <p className="text-muted-foreground">Ask about snake bite myths and facts.</p>
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!e.target.value.trim()) {
            setResults([]);
            setError(null);
          }
        }}
        placeholder='Search: "tourniquet", "sucking venom"...'
        className="w-full rounded-lg border px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      />
      {loading && <p className="text-sm text-muted-foreground">Searching knowledge base...</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="space-y-3">
        {results.map((r) => (
          <div key={r.id} className="rounded-lg border p-4">
            <h3 className="font-semibold">{r.title}</h3>
            <p className="text-xs text-muted-foreground uppercase mt-0.5">{r.category}</p>
            {r.content && <p className="text-sm mt-2">{r.content}</p>}
          </div>
        ))}
      </div>
      {!loading && !error && query.trim() && results.length === 0 && (
        <p className="text-sm text-muted-foreground">No results for &quot;{query}&quot;</p>
      )}
    </main>
  );
}
