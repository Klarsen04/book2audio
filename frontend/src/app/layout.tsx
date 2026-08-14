import type { Metadata } from "next";
import Script from "next/script";
import { Playfair_Display, Source_Serif_4, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/contexts/SessionContext";

// Set NEXT_PUBLIC_SITE_URL to your real frontend URL so social-card image links
// resolve absolutely.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://book2audio-eyw2.onrender.com";

// Editorial type system: display serif / body serif / mono for audio metadata.
const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-source-serif",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains",
  display: "swap",
});

const DESCRIPTION =
  "Turn documents into audiobooks. Upload a PDF, EPUB, DOCX, or TXT — we detect chapters, strip the junk, and read it aloud in a natural voice.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Book2Audio — Every page has a voice",
  description: DESCRIPTION,
  manifest: "/manifest.json",
  // Social preview cards. Swap /icon-512.png for a designed 1200×630 /og.png
  // when you have one.
  openGraph: {
    title: "Book2Audio — Every page has a voice",
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "Book2Audio",
    images: [{ url: "/icon-512.png", width: 512, height: 512 }],
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Book2Audio — Every page has a voice",
    description: DESCRIPTION,
    images: ["/icon-512.png"],
  },
  appleWebApp: {
    capable: true,
    title: "Book2Audio",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport = {
  themeColor: "#16130f",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${sourceSerif.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen bg-[#16130f] antialiased">
        <SessionProvider>{children}</SessionProvider>
        {/* Privacy-friendly analytics (Umami). Enabled only when the site ID is set. */}
        {process.env.NEXT_PUBLIC_UMAMI_ID && (
          <Script
            src={process.env.NEXT_PUBLIC_UMAMI_SRC || "https://cloud.umami.is/script.js"}
            data-website-id={process.env.NEXT_PUBLIC_UMAMI_ID}
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  );
}
