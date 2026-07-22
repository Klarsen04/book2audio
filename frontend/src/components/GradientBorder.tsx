"use client";

interface Props {
  children: React.ReactNode;
  className?: string;
  animate?: boolean;
}

export default function GradientBorder({ children, className = "", animate = true }: Props) {
  return (
    <div className={`relative p-[1px] rounded-2xl overflow-hidden ${className}`}>
      <div
        className={`absolute inset-0 bg-gradient-to-r from-purple-600 via-blue-500 to-emerald-500 ${
          animate ? "animate-gradient bg-[length:200%_200%]" : ""
        } opacity-50`}
      />
      <div className="relative bg-[#0a0a0a] rounded-2xl">
        {children}
      </div>
    </div>
  );
}
