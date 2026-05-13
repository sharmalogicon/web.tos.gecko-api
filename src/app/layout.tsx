import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./gecko_design_system.css";
import { AppShell } from "../components/layout/AppShell";

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
    default: "Gecko TOS · End-to-End Terminal Operating System",
    template: "%s · Gecko TOS",
  },
  description:
    "Modern SaaS Terminal Operating System for container terminals, inland depots, CFS operators, and 3PLs across Southeast Asia — TOS, EDI, VBS, Trucking, Fleet, and M&R in one platform.",
  applicationName: "Gecko TOS",
  authors: [{ name: "Gecko TOS" }],
  keywords: [
    "Terminal Operating System",
    "TOS",
    "container terminal software",
    "inland container depot",
    "ICD",
    "CFS",
    "EDI Hub",
    "Vehicle Booking System",
    "VBS",
    "Southeast Asia logistics",
    "gecko-api",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      data-theme="light"
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
