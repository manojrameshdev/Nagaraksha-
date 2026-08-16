'use client';

import { useState } from 'react';
import { Camera, Loader2, TriangleAlert } from 'lucide-react';
import { identifySnake, type SnakeIdResult } from '@/lib/nagraksha';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function SnakeIdPage() {
  const [text, setText] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [result, setResult] = useState<SnakeIdResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onFile(file: File | undefined) {
    if (!file) return;
    setImageName(file.name);
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result));
    reader.readAsDataURL(file);
  }

  async function handleIdentify() {
    if (!text.trim() && !image) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      setResult(await identifySnake({ text: text.trim() || undefined, image: image ?? undefined }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Identification failed — try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Snake ID</h1>
          <p className="text-muted-foreground">
            Upload a photo or describe the snake. Assistive identification only — never delay
            emergency care.
          </p>
        </div>
        <Link href="/" className={cn(buttonVariants({ variant: 'outline' }), 'min-h-9')}>
          ← Back to emergency home
        </Link>
      </div>

      <section className="rounded-xl border border-border bg-card p-5">
        <label className="block">
          <span className="text-sm font-semibold">Describe the snake</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="e.g. glossy black with thin white crossbands, hexagonal scales along the spine…"
            className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-ring"
          />
        </label>

        <div className="mt-4">
          <span className="text-sm font-semibold">Or upload a photo</span>
          <label className="mt-2 flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 text-sm text-muted-foreground transition hover:border-primary/50 hover:text-primary">
            <Camera className="size-6" aria-hidden="true" />
            {imageName ? (
              <span className="max-w-full truncate px-4 font-medium">{imageName}</span>
            ) : (
              <span>Tap to choose an image</span>
            )}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </label>
        </div>

        <Button
          onClick={handleIdentify}
          disabled={loading || (!text.trim() && !image)}
          className="mt-4 min-h-11"
        >
          {loading && <Loader2 className="animate-spin" aria-hidden="true" />}
          {loading ? 'Identifying…' : 'Identify snake'}
        </Button>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      </section>

      {result && (
        <section className="space-y-4 rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold tracking-[0.12em] text-primary">IDENTIFICATION</p>
              <h2 className="mt-1 text-xl font-semibold">
                {result.species ?? 'Could not identify'}
              </h2>
              {result.venom && (
                <p className="mt-1 text-sm font-semibold text-muted-foreground">
                  Venom: {result.venom.replaceAll('_', ' ')}
                </p>
              )}
            </div>
            {result.confidence != null && (
              <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold">
                {Math.round(result.confidence * 100)}% confidence
              </span>
            )}
          </div>

          {result.danger && (
            <div className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p>{result.danger}</p>
            </div>
          )}
          {result.mimicWarning && (
            <p className="rounded-lg bg-accent/10 p-3 text-sm leading-6">
              <span className="font-semibold">Lookalike warning:</span> {result.mimicWarning}
            </p>
          )}
          {result.firstAid && (
            <div>
              <p className="text-xs font-bold tracking-[0.12em] text-muted-foreground">FIRST AID</p>
              <p className="mt-1 text-sm leading-6">{result.firstAid}</p>
            </div>
          )}
          {result.habitat && (
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">Habitat:</span> {result.habitat}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {result.disclaimer ??
              'Assistive visual identification by AI. This is NOT a medical diagnosis.'}
          </p>
        </section>
      )}

      <p className="text-xs text-muted-foreground">
        If someone has been bitten, trigger SOS and get to a hospital immediately — do not wait for
        identification.
      </p>
    </main>
  );
}
