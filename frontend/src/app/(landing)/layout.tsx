import type { Metadata } from "next";
import "../landing.css";

export const metadata: Metadata = {
  title: "Forge — AI Codebase Onboarding",
  description: "Turn any repository into an interactive storyboard that teaches you the system step-by-step",
};

export default function LandingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-obsidian text-steel font-sans antialiased">{children}</body>
    </html>
  );
}