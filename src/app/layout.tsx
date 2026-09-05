import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { RunProvider } from "@/lib/store/RunProvider";
import { EvidenceDrawerProvider } from "@/lib/store/EvidenceDrawerProvider";
import { EvidenceDrawer } from "@/components/evidence/evidence-drawer";
import { Header } from "@/components/app-shell/header";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WinBack — Autonomous first-pass diligence",
  description: "Extraction, benchmark, portfolio impact, and evidence-linked decision support for PE deal teams.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <RunProvider>
          <TooltipProvider>
            <EvidenceDrawerProvider>
              <Header />
              <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
              <EvidenceDrawer />
            </EvidenceDrawerProvider>
          </TooltipProvider>
        </RunProvider>
        <Toaster />
      </body>
    </html>
  );
}
