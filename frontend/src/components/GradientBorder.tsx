"use client";

interface Props {
  children: React.ReactNode;
  className?: string;
  animate?: boolean;
}

export default function GradientBorder({ children, className = "", animate = true }: Props) {
  return (
    <div className={`relative p-[1px] rounded-sm overflow-visible ${className}`}>
      <div
        className={`absolute inset-0 bg-gradient-to-r from-burgundy via-gold to-gold-soft ${
          animate ? "animate-gradient bg-[length:200%_200%]" : ""
        } opacity-40`}
      />
      <div className="relative bg-[#16130f] rounded-sm">
        {children}
      </div>
    </div>
  );
}
