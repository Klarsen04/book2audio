"use client";

import { useEffect, useRef } from "react";
import Lenis from "lenis";
import { gsap, ScrollTrigger, prefersReducedMotion } from "@/lib/gsap";

/**
 * Site-wide smooth scroll (Lenis) driven off GSAP's ticker so ScrollTrigger and
 * Lenis share a single RAF loop and never drift. Disabled when the user prefers
 * reduced motion — native scrolling is kept intact for accessibility.
 */
export default function SmoothScroll({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);
  const updaterRef = useRef<(time: number) => void | null>();

  useEffect(() => {
    if (prefersReducedMotion()) return;

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => 1 - Math.pow(1 - t, 3), // easeOutCubic
      smoothWheel: true,
      touchMultiplier: 1.4,
    });
    lenisRef.current = lenis;

    // Keep ScrollTrigger in sync with Lenis' virtual scroll position.
    lenis.on("scroll", ScrollTrigger.update);

    const update = (time: number) => {
      // Safety check: ensure lenis still exists before calling methods on it
      if (lenisRef.current) {
        lenisRef.current.raf(time * 1000);
      }
    };
    updaterRef.current = update;
    gsap.ticker.add(update);
    gsap.ticker.lagSmoothing(0);

    // Recalculate trigger positions once fonts/images settle.
    const refresh = () => ScrollTrigger.refresh();
    if (document.fonts?.ready) document.fonts.ready.then(refresh);
    window.addEventListener("load", refresh);

    return () => {
      // Remove from ticker FIRST
      if (updaterRef.current) {
        gsap.ticker.remove(updaterRef.current);
      }
      // Then destroy Lenis instance
      if (lenisRef.current) {
        lenisRef.current.destroy();
        lenisRef.current = null;
      }
      window.removeEventListener("load", refresh);
    };
  }, []);

  return <>{children}</>;
}
