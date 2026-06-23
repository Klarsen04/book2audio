import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Book2Audio - Convert Books to Audiobooks",
  description: "Upload PDF, EPUB, DOCX, or TXT files and convert them to high-quality audiobooks",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0a0a0a]">{children}</body>
    </html>
  );
}
