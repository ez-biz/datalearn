import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ThemeProvider } from "@/components/layout/ThemeProvider";

const inter = Inter({
    variable: "--font-inter",
    subsets: ["latin"],
    display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
    variable: "--font-jetbrains",
    subsets: ["latin"],
    display: "swap",
});

export const metadata: Metadata = {
    title: {
        default: "Data Learn — Master SQL & Data Engineering",
        template: "%s · Data Learn",
    },
    description:
        "Practice SQL the way LeetCode does code. Run queries in your browser, get instant validation, and learn data engineering through real problems.",
    keywords: [
        "data engineering",
        "SQL practice",
        "SQL playground",
        "learn SQL",
        "data engineering interview",
        "DuckDB",
        "ETL",
    ],
    openGraph: {
        title: "Data Learn — Master SQL & Data Engineering",
        description:
            "Practice SQL in your browser. Real problems, instant validation, no setup.",
        type: "website",
        locale: "en_US",
        siteName: "Data Learn",
    },
    twitter: {
        card: "summary_large_image",
        title: "Data Learn — Master SQL & Data Engineering",
        description:
            "Practice SQL in your browser. Real problems, instant validation, no setup.",
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
        <html lang="en" suppressHydrationWarning>
            <body
                className={`${inter.variable} ${jetbrainsMono.variable} antialiased min-h-screen flex flex-col bg-background text-foreground`}
            >
                <ThemeProvider>
                    <a
                        href="#main-content"
                        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                        Skip to main content
                    </a>
                    <Navbar />
                    <div
                        id="main-content"
                        tabIndex={-1}
                        className="flex-1 flex flex-col focus:outline-none"
                    >
                        {children}
                    </div>
                    <Footer />
                </ThemeProvider>
                <Analytics />
            </body>
        </html>
    );
}
