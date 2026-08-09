"use client";

interface Props {
  className?: string;
  variant?: "text" | "circle" | "card";
  count?: number;
}

export default function Skeleton({ className = "", variant = "text", count = 1 }: Props) {
  const baseClass = "animate-pulse bg-gradient-to-r from-surface via-surface-hover to-surface bg-[length:200%_100%] animate-shimmer rounded-sm";

  if (variant === "circle") {
    return <div className={`${baseClass} rounded-full ${className}`} />;
  }

  if (variant === "card") {
    return (
      <div className={`bg-surface border border-hairline rounded-sm p-5 space-y-4 ${className}`}>
        <div className="flex items-start justify-between">
          <div className={`${baseClass} w-10 h-10 rounded-sm`} />
          <div className={`${baseClass} w-16 h-5 rounded-full`} />
        </div>
        <div className={`${baseClass} w-3/4 h-4`} />
        <div className={`${baseClass} w-1/2 h-3`} />
        <div className="flex gap-2 pt-2">
          <div className={`${baseClass} flex-1 h-9 rounded-sm`} />
          <div className={`${baseClass} w-9 h-9 rounded-sm`} />
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`${baseClass} h-4`}
          style={{ width: `${70 + Math.random() * 30}%` }}
        />
      ))}
    </div>
  );
}
