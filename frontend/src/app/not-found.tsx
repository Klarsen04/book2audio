import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        <div className="text-7xl mb-6">📖</div>
        <h1 className="text-4xl font-display text-paper mb-3">Page not found</h1>
        <p className="text-paper/60 font-serif mb-8 max-w-sm mx-auto">
          The page you&apos;re looking for doesn&apos;t exist. Maybe the book was returned to the shelf.
        </p>
        <Link
          href="/library"
          className="inline-flex px-6 py-3 rounded-full bg-gold text-ink font-semibold hover:bg-gold-soft transition-all hover:scale-105 active:scale-[0.98]"
        >
          Back to Library
        </Link>
      </div>
    </div>
  );
}
