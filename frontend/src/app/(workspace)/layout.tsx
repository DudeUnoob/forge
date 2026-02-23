import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "Forge — AI Codebase Onboarding",
  description: "Turn any repository into an interactive storyboard that teaches you the system step-by-step",
};

export default function WorkspaceLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}