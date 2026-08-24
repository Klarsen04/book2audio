"use client";

interface SectionShellProps {
  kicker: string;
  title: string;
  lede?: string;
  children: React.ReactNode;
  id?: string;
}

/**
 * Small shared editorial section header
 */
export default function SectionShell({
  kicker,
  title,
  lede,
  children,
  id,
}: SectionShellProps) {
  return (
    <section id={id} className="border-t border-hairline py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-14 max-w-2xl">
          <p className="label-mono text-gold">{kicker}</p>
          <h2 className="mt-3 font-display text-4xl font-bold leading-tight text-paper sm:text-5xl">
            {title}
          </h2>
          {lede && <p className="mt-4 font-serif text-lg text-paper/60">{lede}</p>}
        </div>
        {children}
      </div>
    </section>
  );
}
