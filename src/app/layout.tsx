import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AnalyticsSession } from "@/components/analytics/analytics-session";
import { NavigationFrame } from "@/components/navigation/navigation-frame";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tribe | Personality-first social discovery",
  description:
    "A personality-first social discovery workspace for finding aligned people, plans, and circles.",
};

const isClerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const app = isClerkConfigured ? (
    <ClerkProvider>
      <NavigationFrame>{children}</NavigationFrame>
    </ClerkProvider>
  ) : (
    <NavigationFrame>{children}</NavigationFrame>
  );

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {app}
        <AnalyticsSession />
      </body>
    </html>
  );
}
