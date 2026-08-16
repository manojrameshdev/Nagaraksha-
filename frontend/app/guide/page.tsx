import { CheckCircle2, ShieldAlert, XCircle } from 'lucide-react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const DO = [
  'Keep the person calm and still — panic spreads venom faster.',
  'Immobilise the bitten limb with a splint, at or below heart level.',
  'Remove rings, watches, bangles, and tight clothing near the bite.',
  'Carry the person to the nearest hospital with antivenom — ideally by vehicle, not walking.',
  'Note the time of the bite and, if safe, take a photo of the snake from a distance.',
  'Encourage frequent sips of water (if fully conscious and not vomiting).',
];

const DONT = [
  'Do not cut, suck, or squeeze the bite wound.',
  'Do not apply a tourniquet — it can cost the limb.',
  'Do not apply ice, chemicals, herbal pastes, or electric shocks.',
  'Do not let the person run, walk far, or consume alcohol.',
  'Do not try to catch or kill the snake — it may bite again.',
  'Do not wait for symptoms before going to the hospital.',
];

export default function GuidePage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Snakebite Emergency Guide</h1>
          <p className="text-muted-foreground">
            The minutes after a bite matter. Follow these steps and get to a hospital.
          </p>
        </div>
        <Link href="/" className={cn(buttonVariants({ variant: 'outline' }), 'min-h-9')}>
          ← Back to emergency home
        </Link>
      </div>

      <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
        <div className="flex gap-3">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
          <div>
            <h2 className="font-semibold text-destructive">Act immediately</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Every bite must be treated as potentially venomous. Do not wait for pain, swelling, or
              symptoms — many deadly bites (e.g. krait) are almost painless at first. Trigger SOS
              and arrange transport right away.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 font-semibold text-primary">
            <CheckCircle2 className="size-4" aria-hidden="true" /> Do
          </h2>
          <ul className="mt-4 grid gap-3 text-sm leading-6 text-muted-foreground">
            {DO.map((item) => (
              <li key={item} className="flex gap-2">
                <CheckCircle2 className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 font-semibold text-destructive">
            <XCircle className="size-4" aria-hidden="true" /> Don&apos;t
          </h2>
          <ul className="mt-4 grid gap-3 text-sm leading-6 text-muted-foreground">
            {DONT.map((item) => (
              <li key={item} className="flex gap-2">
                <XCircle className="mt-1 size-4 shrink-0 text-destructive" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-semibold">Keep learning</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Identification is optional — never delay care for it. Use these tools afterwards:
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/snake-id" className={cn(buttonVariants({ variant: 'outline' }), 'min-h-9')}>
            Snake ID
          </Link>
          <Link
            href="/myth-buster"
            className={cn(buttonVariants({ variant: 'outline' }), 'min-h-9')}
          >
            Myth Buster
          </Link>
          <Link href="/" className={cn(buttonVariants({ variant: 'outline' }), 'min-h-9')}>
            Emergency home
          </Link>
        </div>
      </section>
    </main>
  );
}
