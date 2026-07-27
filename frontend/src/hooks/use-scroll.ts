'use client';

import { useEffect, useRef, useState } from 'react';

/** Smoothed scroll progress 0..1 for the whole document. */
export function useScrollProgress() {
  const [progress, setProgress] = useState(0);
  const [velocity, setVelocity] = useState(0);
  const target = useRef(0);
  const eased = useRef(0);
  const lastY = useRef(0);
  const raf = useRef<number>(0);

  useEffect(() => {
    const compute = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      const p = max > 0 ? h.scrollTop / max : 0;
      target.current = Math.min(1, Math.max(0, p));
      const v = h.scrollTop - lastY.current;
      lastY.current = h.scrollTop;
      setVelocity(v);
    };
    const onScroll = () => compute();
    compute();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  // eased animation loop — gives the "smooth scroll animation of the snake"
  useEffect(() => {
    const loop = () => {
      eased.current += (target.current - eased.current) * 0.12;
      setProgress(eased.current);
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, []);

  return { progress, velocity };
}

/** Track when an element enters the viewport (one-shot).
 *
 * IMPORTANT: Do NOT pass an inline object literal as `options` — it creates a new
 * reference every render and will cause an infinite re-render loop. Pass a stable
 * reference (e.g. a module-level constant or a `useMemo`/`useRef` value) instead.
 * All current callers invoke `useInView()` with no arguments, which is safe.
 */
// eslint-disable-next-line no-undef
export function useInView<T extends HTMLElement>(options?: IntersectionObserverInit) {
  const ref = useRef<T | null>(null);
  // Capture options in a ref so the useEffect dependency is always stable.
  // Callers must not pass new object literals on every render (see JSDoc above).
  const optionsRef = useRef(options);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ob = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setInView(true);
            ob.unobserve(e.target);
          }
        }
      },
      { threshold: 0.18, rootMargin: '0px 0px -8% 0px', ...optionsRef.current },
    );
    ob.observe(el);
    return () => ob.disconnect();
    // optionsRef is a stable ref captured at mount — the empty dep array is intentional.
  }, []);
  return { ref, inView };
}

/** Active section id based on scroll position (for the dock). */
export function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0] ?? '');
  const idsKey = ids.join(',');
  useEffect(() => {
    const onScroll = () => {
      const center = window.scrollY + window.innerHeight * 0.35;
      let current = ids[0] ?? '';
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.offsetTop <= center) current = id;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);
  return active;
}
