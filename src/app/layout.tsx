import type { Metadata } from "next";
import { Instrument_Sans, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { themeInitScript } from "@/components/ThemeToggle";
import { Suspense } from "react";
import { ChatbotWidget } from "@/components/ChatbotWidget";

const sans = Instrument_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const serif = Instrument_Serif({
  variable: "--font-display",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ModelAtlas — AI Infrastructure Advisor",
  description: "Discovery, evaluation, trust, cost comparison, and procurement guidance for AI workloads.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${serif.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-[var(--background)] text-[var(--foreground)] transition-colors duration-200">
        {children}
        <Suspense fallback={null}>
          <ChatbotWidget />
        </Suspense>
      </body>
    </html>
  );
}
