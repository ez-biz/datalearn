import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { headers } from "next/headers";
import "./globals.css";
import { ConsoleShell } from "@/components/layout/console/ConsoleShell";
import { ThemeProvider } from "@/components/layout/ThemeProvider";

const googleAnalyticsId =
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ??
    (process.env.VERCEL_ENV === "production" ? "G-B9RFQWH2JC" : undefined);

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

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const nonce = (await headers()).get("x-csp-nonce") ?? undefined;

    return (
        <html lang="en" suppressHydrationWarning>
            <body
                className={`${inter.variable} ${jetbrainsMono.variable} antialiased h-dvh overflow-hidden bg-background text-foreground print:h-auto print:overflow-visible`}
            >
                <ThemeProvider nonce={nonce}>
                    <a
                        href="#main-content"
                        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                        Skip to main content
                    </a>
                    {/* The scroll column, <main> and <Footer> live inside
                        ConsoleChrome now — it is the only component that can
                        see the pathname, and focus routes (the lesson reader)
                        need to supply their own <header>/<main> pair to keep
                        the `banner` landmark legal. See ConsoleChrome. */}
                    <ConsoleShell>{children}</ConsoleShell>
                </ThemeProvider>
                <Analytics />
                <SpeedInsights />
                {googleAnalyticsId ? (
                    <GoogleAnalytics gaId={googleAnalyticsId} />
                ) : null}
            </body>
        </html>
    );
}
