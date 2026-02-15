import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Antigravity — Master Data Engineering",
    template: "%s | Antigravity",
  },
  description:
    "Learn SQL, Python, ETL Pipelines, and System Design through interactive coding challenges and real-world projects. Free, browser-based SQL engine.",
  keywords: [
    "data engineering",
    "SQL practice",
    "ETL",
    "data warehousing",
    "SQL playground",
    "learn SQL",
    "data engineering interview",
  ],
  openGraph: {
    title: "Antigravity — Master Data Engineering",
    description:
      "Interactive SQL challenges, curated learning content, and data engineering education. No setup required.",
    type: "website",
    locale: "en_US",
    siteName: "Antigravity",
  },
  twitter: {
    card: "summary_large_image",
    title: "Antigravity — Master Data Engineering",
    description:
      "Interactive SQL challenges, curated learning content, and data engineering education.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Navbar />
        {children}
      </body>
    </html>
  );
}
