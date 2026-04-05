import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "AutiSense — AI-Powered Autism Screening",
  description: "Privacy-first, AI-powered autism screening platform with real-time behavioral analysis, DSM-5 aligned clinical reports, and adaptive therapy games.",
  icons: {
    icon: "/icon.svg",
    apple: "/logo.jpeg",
  },
  openGraph: {
    title: "AutiSense — AI-Powered Autism Screening",
    description: "Privacy-first, AI-powered autism screening platform with real-time behavioral analysis, DSM-5 aligned clinical reports, and adaptive therapy games.",
    url: "https://autisense.imaginaerium.in",
    siteName: "AutiSense",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AutiSense — AI-Powered Autism Screening",
    description: "Privacy-first, AI-powered autism screening with edge AI and adaptive therapy games.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("autisense-theme");if(t)document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`,
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
