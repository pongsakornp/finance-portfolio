import type { Metadata, Viewport } from "next";
import { Oxanium } from "next/font/google";

import { cn } from "@/lib/utils";

import { Providers } from "@/components/providers";

import "./globals.css";

const oxanium = Oxanium({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Finance Portfolio",
  description: "Track stocks, ETFs, crypto, commodities and mutual funds across portfolios",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("h-full antialiased", "font-sans", oxanium.variable)}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
