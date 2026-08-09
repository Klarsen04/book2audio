"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

/**
 * A canvas waveform that morphs between a flat typographic baseline (amp = 0)
 * and a living audio waveform (amp = 1). This is the core visual material of the
 * site: a line of text and a line of sound are the same stroke at different
 * amplitudes. Amplitude is driven imperatively so GSAP/ScrollTrigger can scrub it.
 */
export type WaveHandle = {
  /** 0 = flat baseline, 1 = full waveform. */
  setAmp: (v: number) => void;
  /** 0 = still, 1 = fully animated. */
  setLife: (v: number) => void;
};

type Props = {
  className?: string;
  color?: string;
  /** number of samples across the width */
  points?: number;
  lineWidth?: number;
  /** draw as filled bars instead of a continuous stroke */
  bars?: boolean;
};

const WaveCanvas = forwardRef<WaveHandle, Props>(function WaveCanvas(
  { className, color = "#B45309", points = 220, lineWidth = 2, bars = false },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const amp = useRef(0);
  const life = useRef(1);
  const raf = useRef<number>();
  // Deterministic per-point randomness so the shape is stable frame to frame.
  const seeds = useRef<number[]>([]);

  useImperativeHandle(ref, () => ({
    setAmp: (v: number) => {
      amp.current = Math.max(0, Math.min(1, v));
    },
    setLife: (v: number) => {
      life.current = Math.max(0, Math.min(1, v));
    },
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (seeds.current.length !== points) {
      seeds.current = Array.from({ length: points }, (_, i) =>
        // layered frequencies give an organic, non-repeating envelope
        0.35 +
        0.65 *
          Math.abs(
            Math.sin(i * 0.35) * 0.6 +
              Math.sin(i * 0.11 + 1.3) * 0.3 +
              Math.sin(i * 0.9 + 0.7) * 0.1
          )
      );
    }

    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();

    const render = (now: number) => {
      const t = ((now - start) / 1000) * (reduced ? 0 : 1);
      ctx.clearRect(0, 0, w, h);
      const mid = h / 2;
      const a = amp.current;
      const maxAmp = mid * 0.82;

      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";

      if (bars) {
        const gap = 2;
        const bw = Math.max(1, w / points - gap);
        for (let i = 0; i < points; i++) {
          const x = (i / points) * w;
          const wobble =
            0.5 + 0.5 * Math.sin(t * 3 + i * 0.5) * life.current;
          const env = seeds.current[i];
          const barH = Math.max(1.5, a * env * wobble * maxAmp * 2);
          ctx.fillRect(x, mid - barH / 2, bw, barH);
        }
        raf.current = requestAnimationFrame(render);
        return;
      }

      ctx.beginPath();
      for (let i = 0; i <= points; i++) {
        const x = (i / points) * w;
        const env = seeds.current[i % points];
        const wobble = Math.sin(t * 2.4 + i * 0.5) * life.current;
        const y = mid + a * env * wobble * maxAmp;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      raf.current = requestAnimationFrame(render);
    };
    raf.current = requestAnimationFrame(render);

    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      ro.disconnect();
    };
  }, [points, color, lineWidth, bars]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
});

export default WaveCanvas;
