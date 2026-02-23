import type { Metadata } from "next";
import "../landing.css";

export const metadata: Metadata = {
  title: "Forge — AI Codebase Onboarding",
  description: "Turn any repository into an interactive storyboard that teaches you the system step-by-step",
};

import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';

export default function LandingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${GeistSans.variable} ${GeistMono.variable} bg-obsidian text-steel font-sans antialiased`}>{children}</body>
    </html>
  );
}