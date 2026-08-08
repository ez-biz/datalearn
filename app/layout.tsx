import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { headers } from "next/headers";
import "./globals.css";
import { ConsoleShell } from "@/components/layout/console/ConsoleShell";
import { Footer } from "@/components/layout/Footer";
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
                className={`${inter.variable} ${jetbrainsMono.variable} antialiased h-dvh overflow-hidden bg-background text-foreground`}
            >
                <ThemeProvider nonce={nonce}>
                    <a
                        href="#main-content"
                        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                        Skip to main content
                    </a>
                    <ConsoleShell>
                        {/* The scroll column, not <main>. A <footer> only maps
                            to the `contentinfo` landmark when it is NOT inside
                            article/aside/main/nav/section, so the footer cannot
                            live inside <main> — and ARIA forbids nesting
                            `contentinfo` in `main`, which rules out patching it
                            with an explicit role. Splitting the scroll
                            container off from <main> keeps the footer in the
                            scrolling flow (it must scroll away with the page)
                            while leaving it a sibling of <main>, whose nearest
                            sectioning ancestor is <body>. Landmarks are back to
                            banner / main / contentinfo.

                            #app-scroll (not #main-content) is what
                            MainScrollRestoration, SignInDialog and ReportDialog
                            reach for — they want the element that owns the
                            scrollbar. #main-content stays on <main> so the
                            skip link still lands on the content itself. */}
                        <div
                            id="app-scroll"
                            className="flex flex-1 flex-col overflow-y-auto pb-14 lg:pb-0"
                        >
                            <main
                                id="main-content"
                                tabIndex={-1}
                                className="flex flex-1 flex-col focus:outline-none"
                            >
                                {children}
                            </main>
                            <Footer />
                        </div>
                    </ConsoleShell>
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
