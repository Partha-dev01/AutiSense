import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import Providers from "./components/Providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://autisense.imaginaerium.in"),
  title: {
    default: "AutiSense — Free, Private Autism Screening Support",
    template: "%s · AutiSense",
  },
  description:
    "AutiSense is a free, privacy-first autism screening-support tool that runs entirely in your browser — camera analysis happens on your device and nothing is uploaded. An educational awareness aid for parents and caregivers, not a medical diagnosis.",
  applicationName: "AutiSense",
  keywords: [
    "autism screening",
    "autism awareness",
    "early signs of autism",
    "autism support for parents",
    "privacy-first",
    "on-device AI",
    "free autism tool",
  ],
  authors: [{ name: "Imaginaerium" }],
  creator: "Imaginaerium",
  publisher: "Imaginaerium",
  manifest: "/manifest.webmanifest",
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/logo.jpeg",
  },
  openGraph: {
    type: "website",
    siteName: "AutiSense",
    url: "https://autisense.imaginaerium.in",
    title: "AutiSense — Free, Private Autism Screening Support",
    description:
      "A free, privacy-first autism screening-support tool that runs entirely in your browser. Educational awareness for parents and caregivers — not a diagnosis.",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "AutiSense — Free, Private Autism Screening Support",
    description:
      "A free, privacy-first autism screening-support tool that runs entirely in your browser. Educational awareness, not a diagnosis.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
    },
  },
  category: "health",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Nonce is injected per-request by middleware.ts; reading it here opts the
  // app into dynamic rendering (required for nonce-based CSP).
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="preload"
          href="/fonts/Fredoka-Variable.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("autisense-theme");if(t)document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`,
          }}
        />
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  "@id": "https://autisense.imaginaerium.in/#org",
                  name: "AutiSense",
                  url: "https://autisense.imaginaerium.in",
                  logo: "https://autisense.imaginaerium.in/icon-512.png",
                  sameAs: ["https://github.com/Partha-dev01/AutiSense"],
                },
                {
                  "@type": "WebSite",
                  "@id": "https://autisense.imaginaerium.in/#website",
                  url: "https://autisense.imaginaerium.in",
                  name: "AutiSense",
                  description:
                    "Free, privacy-first, in-browser autism screening support for parents and caregivers. An educational awareness tool, not a medical diagnosis.",
                  publisher: { "@id": "https://autisense.imaginaerium.in/#org" },
                  inLanguage: "en",
                },
                {
                  "@type": "WebApplication",
                  name: "AutiSense",
                  url: "https://autisense.imaginaerium.in",
                  applicationCategory: "HealthApplication",
                  operatingSystem: "Any (modern web browser)",
                  browserRequirements:
                    "Requires a modern browser with camera access",
                  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
                  isAccessibleForFree: true,
                  description:
                    "An educational, privacy-first autism awareness and screening-support tool that runs entirely on-device in the browser. It does not provide a medical diagnosis.",
                },
              ],
            }),
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
