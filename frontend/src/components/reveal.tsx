"use client";

import { ReactNode } from "react";
import { useInView } from "@/hooks/use-scroll";
import { cn } from "@/lib/utils";

export function Reveal({
  children,
  className,
  delay = 0,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: keyof JSX.IntrinsicElements;
}) {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    // @ts-expect-error dynamic tag
    <Tag
      ref={ref}
      className={cn("reveal", inView && "in-view", className)}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}
