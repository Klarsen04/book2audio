"use client";

/**
 * An editorial manuscript page: paper stock, margin rule, chapter heading,
 * justified serif body, page number. Body lines can be targeted for word-level
 * animation via the `.ms-line` / `.ms-word` classes.
 */

const DEFAULT_PARAGRAPHS = [
  "The recording began before dawn, a single voice against the hum of the room. Every sentence carried the weight of the thing it described, and the page was only waiting to receive it.",
  "What arrives as sound leaves as structure. The words find their margins, the paragraphs settle into columns, and the chapters announce themselves one after another, unhurried and exact.",
  "Nothing is added that was not spoken, and much is quietly removed — the stray citation, the running header, the number at the foot of the page — until only the story remains, ready to be read aloud again.",
];

export default function ManuscriptPage({
  chapterLabel = "Chapter One",
  title = "The First Recording",
  paragraphs = DEFAULT_PARAGRAPHS,
  pageNumber = "1",
  className = "",
  splitWords = false,
}: {
  chapterLabel?: string;
  title?: string;
  paragraphs?: string[];
  pageNumber?: string;
  className?: string;
  /** wrap every word in a span for word-level animation */
  splitWords?: boolean;
}) {
  return (
    <article
      className={`paper-panel paper-grain relative flex flex-col rounded-[3px] px-8 py-10 sm:px-12 sm:py-14 ${className}`}
    >
      {/* margin rule */}
      <span
        className="pointer-events-none absolute inset-y-6 left-[13%] w-px bg-burgundy/25"
        aria-hidden
      />
      <p className="label-mono text-burgundy/80">{chapterLabel}</p>
      <h3 className="mt-2 font-display text-3xl sm:text-4xl font-bold leading-tight text-ink">
        {title}
      </h3>

      <div className="mt-6 space-y-4 text-ink/85 font-serif text-[15px] leading-relaxed [text-align:justify] [hyphens:auto]">
        {paragraphs.map((p, i) => (
          <p key={i} className="ms-line">
            {splitWords
              ? p.split(" ").map((word, j) => (
                  <span key={j} className="ms-word inline-block">
                    {word}
                    {j < p.split(" ").length - 1 ? " " : ""}
                  </span>
                ))
              : p}
          </p>
        ))}
      </div>

      <div className="mt-auto flex items-center justify-between pt-8">
        <span className="h-px w-10 bg-ink/20" aria-hidden />
        <span className="label-mono text-ink/40">{pageNumber}</span>
      </div>
    </article>
  );
}
