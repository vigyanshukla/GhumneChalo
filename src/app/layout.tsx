import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PWARegistration } from "@/components/pwa/PWARegistration";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { RouteProgressBar } from "@/components/navigation/RouteProgressBar";
import { Suspense } from "react";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL || 'https://ghumne-chalo.vercel.app'),
  title: {
    default: "GhumneChalo - Smart Travel & Itinerary Platform",
    template: "%s | GhumneChalo",
  },
  description:
    "Smart travel planning, itinerary management, real-time reminders, emergency assistance, and local discovery.",
  applicationName: "GhumneChalo",
  keywords: [
    "travel planner",
    "itinerary management",
    "smart wander",
    "GhumneChalo",
    "India travel",
    "trip routes",
    "travel reminders",
    "emergency assistance",
  ],
  authors: [{ name: "GhumneChalo Team" }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GhumneChalo",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://ghumne-chalo.vercel.app",
    siteName: "GhumneChalo",
    title: "GhumneChalo - Smart Travel & Itinerary Platform",
    description:
      "Plan multi-day journeys, explore hidden gems, set real-time travel alerts, track milestones, and access emergency helplines.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "GhumneChalo - Smart Wander & Travel Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "GhumneChalo - Smart Travel & Itinerary Platform",
    description:
      "Plan multi-day journeys, explore hidden gems, set real-time travel alerts, track milestones, and access emergency helplines.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} min-h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var t = localStorage.getItem('theme');
                if (!t) {
                  var m = document.cookie.match(/(^|; )theme=([^;]+)/);
                  if (m) t = decodeURIComponent(m[2]);
                }
                var d = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (t === 'dark' || (t === 'system' && d)) {
                  document.documentElement.classList.add('dark');
                  document.documentElement.classList.remove('light');
                  document.documentElement.setAttribute('data-theme', 'dark');
                  document.documentElement.style.colorScheme = 'dark';
                } else {
                  document.documentElement.classList.remove('dark');
                  document.documentElement.classList.add('light');
                  document.documentElement.setAttribute('data-theme', 'light');
                  document.documentElement.style.colorScheme = 'light';
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="min-h-screen min-w-[320px] flex flex-col font-sans" suppressHydrationWarning>
        <Suspense fallback={null}>
          <RouteProgressBar />
        </Suspense>
        <ThemeProvider>
          {children}
          <PWARegistration />
        </ThemeProvider>
      </body>
    </html>
  );
}
