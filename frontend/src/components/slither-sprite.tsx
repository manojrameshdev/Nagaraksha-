"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

/**
 * SlitherSprite — cycles through the 6 generated snake slither frames to
 * produce a "gif broken into frames" animation. Honours the brief: a snake
 * video/gif decomposed into frames, played back as a smooth slither.
 *
 * Frame rate scales subtly with scroll velocity so the snake appears to
 * "slither faster" as the reader scrolls — tying it to the scroll-driven
 * snake progress indicator.
 */
const FRAMES = [1, 2, 3, 4, 5, 6];

export function SlitherSprite({
  className,
  size = 220,
}: {
  className?: string;
  size?: number;
}) {
  const [frame, setFrame] = useState(0);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let lastY = window.scrollY;
    const interval = 110; // ms per frame at 1x

    const loop = (now: number) => {
      const dt = now - last;
      last = now;
      const v = Math.abs(window.scrollY - lastY);
      lastY = window.scrollY;
      // 1x at rest, up to ~3x when scrolling fast
      const s = 1 + Math.min(2, v / 60);
      setSpeed(s);
      acc += dt * s;
      if (acc >= interval) {
        acc = 0;
        setFrame((f) => (f + 1) % FRAMES.length);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className={className}
      style={{ width: size, height: Math.round(size * 0.572) }}
      aria-hidden
    >
      <div className="relative h-full w-full">
        {FRAMES.map((n, i) => (
          <Image
            key={n}
            src={`/snake/snake-frame-${n}.png`}
            alt=""
            fill
            sizes={`${size}px`}
            className="object-contain transition-opacity duration-75"
            style={{ opacity: i === frame ? 1 : 0 }}
            priority={i === 0}
          />
        ))}
      </div>
    </div>
  );
}
