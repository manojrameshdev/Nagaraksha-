'use client';

import { useEffect, useRef } from 'react';

/**
 * SnakeProgress — the snake IS the scroll-progress bar.
 *
 * Concept (honouring "break a snake gif into frames; the snake is the progress
 * indicator with a smooth scroll animation"):
 *   The serpent's body is sampled into discrete "frames" along its length each
 *   animation tick (N control points), and a time-phased sine wave shifts those
 *   points so the body slithers. The head sits exactly at the (eased) scroll-
 *   progress position on a vertical rail; the body length = progress filled.
 *   Easing (lerp toward target) gives the smooth scroll animation of the snake.
 *
 * Drawn as minimal, protective (on-brand: no aggressive cobra mascot).
 */
const RAIL_W = 38; // px

export function SnakeProgress() {
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const bodyRef = useRef<SVGPathElement>(null);
  const headRef = useRef<SVGGElement>(null);
  const tongueRef = useRef<SVGPathElement>(null);
  const trackRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    const path = pathRef.current;
    const body = bodyRef.current;
    const head = headRef.current;
    const tongue = tongueRef.current;
    const track = trackRef.current;
    if (!svg || !path || !body || !head || !tongue || !track) return;

    let H = window.innerHeight;
    const W = RAIL_W;
    const cx = W / 2;

    const resize = () => {
      H = window.innerHeight;
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.setAttribute('width', String(W));
      svg.setAttribute('height', String(H));
      // track (full height faint line)
      track.setAttribute('d', `M ${cx} 8 L ${cx} ${H - 8}`);
    };
    resize();

    let target = 0;
    let eased = 0;
    let _lastY = window.scrollY;

    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      target = max > 0 ? h.scrollTop / max : 0;
      _lastY = h.scrollTop;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', resize);

    const SAMPLES = 46;
    const start = performance.now();
    let raf = 0;

    const loop = (now: number) => {
      eased += (target - eased) * 0.1;
      const t = (now - start) / 1000;

      const headY = 8 + eased * (H - 16);
      const topY = 8;
      const span = headY - topY;

      // build a slithering body path from top to headY
      // each sample point gets a sine x-offset (the "frames" of slither)
      const pts: string[] = [];
      const bodyPts: string[] = [];
      for (let i = 0; i <= SAMPLES; i++) {
        const f = i / SAMPLES;
        const y = topY + f * span;
        // taper amplitude near head & tail; wave travels down with time + progress
        const taper = Math.sin(f * Math.PI);
        const wave = Math.sin(f * 7.5 - t * 3.2 + eased * 6.0) * 7.0 * taper;
        const x = cx + wave;
        pts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`);
        // a slightly thicker inner body for depth (offset opposite)
        const x2 = cx - wave * 0.35;
        bodyPts.push(`${i === 0 ? 'M' : 'L'} ${x2.toFixed(2)} ${y.toFixed(2)}`);
      }
      const d = pts.join(' ');
      path.setAttribute('d', d);
      if (body) body.setAttribute('d', d);

      // head at the tip, rotated to face along the last segment direction
      const lastWave = Math.sin(1 * 7.5 - t * 3.2 + eased * 6.0) * 7.0 * Math.sin(Math.PI);
      const headX = cx + lastWave;
      head.setAttribute('transform', `translate(${headX.toFixed(2)} ${headY.toFixed(2)})`);

      // tongue flick
      const flick = (Math.sin(t * 6.0) + 1) / 2;
      tongue.setAttribute('opacity', String(0.35 + 0.65 * flick));
      tongue.setAttribute('transform', `scale(${0.7 + 0.6 * flick})`);

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-40 hidden h-screen w-[38px] items-center justify-center md:flex"
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${RAIL_W} 800`}
        className="h-screen"
        preserveAspectRatio="xMidYMin meet"
      >
        <defs>
          <linearGradient id="snakeBody" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#184D36" />
            <stop offset="0.45" stopColor="#2BB673" />
            <stop offset="0.8" stopColor="#D69E2E" />
            <stop offset="1" stopColor="#E0B443" />
          </linearGradient>
          <linearGradient id="snakeTrack" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="rgba(234,243,237,0.05)" />
            <stop offset="1" stopColor="rgba(234,243,237,0.12)" />
          </linearGradient>
          <filter id="snakeGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* faint full-height track */}
        <path
          ref={trackRef}
          d={`M ${RAIL_W / 2} 8 L ${RAIL_W / 2} 792`}
          stroke="url(#snakeTrack)"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />

        {/* scale ticks along the rail */}
        {Array.from({ length: 12 }).map((_, i) => (
          <line
            key={i}
            x1={RAIL_W / 2 - 5}
            x2={RAIL_W / 2 + 5}
            y1={8 + (i * (800 - 16)) / 11}
            y2={8 + (i * (800 - 16)) / 11}
            stroke="rgba(234,243,237,0.07)"
            strokeWidth="1"
          />
        ))}

        {/* outer slither body (glow) */}
        <path
          ref={pathRef}
          d=""
          stroke="url(#snakeBody)"
          strokeWidth="9"
          strokeLinecap="round"
          fill="none"
          filter="url(#snakeGlow)"
          opacity="0.95"
        />
        {/* inner body highlight */}
        <path
          ref={bodyRef}
          d=""
          stroke="#EAF3ED"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          opacity="0.35"
        />

        {/* head */}
        <g ref={headRef} filter="url(#snakeGlow)">
          <ellipse cx="0" cy="-2" rx="7.5" ry="9" fill="#E0B443" />
          <ellipse cx="0" cy="-2" rx="7.5" ry="9" fill="none" stroke="#0A1812" strokeWidth="1" />
          {/* eyes */}
          <circle cx="-3.2" cy="-5" r="1.5" fill="#0A1812" />
          <circle cx="3.2" cy="-5" r="1.5" fill="#0A1812" />
          {/* tongue */}
          <path
            ref={tongueRef}
            d="M 0 6 L 0 12 M 0 12 L -2.5 15 M 0 12 L 2.5 15"
            stroke="#E5484D"
            strokeWidth="1.3"
            strokeLinecap="round"
            fill="none"
            transform="scale(1)"
          />
        </g>
      </svg>
    </div>
  );
}
