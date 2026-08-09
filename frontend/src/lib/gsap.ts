"use client";

/**
 * Central GSAP setup. Import { gsap, ScrollTrigger } from here so plugins are
 * registered exactly once, and never touch GSAP during SSR.
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

let registered = false;

export function registerGsap() {
  if (registered || typeof window === "undefined") return;
  gsap.registerPlugin(ScrollTrigger, useGSAP);
  registered = true;
}

// Register on module load in the browser.
registerGsap();

export { gsap, ScrollTrigger, useGSAP };

/** True when the user prefers reduced motion (checked at call time). */
export function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
