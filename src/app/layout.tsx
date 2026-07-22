import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HealthDocX Team Dashboard",
  description:
    "Internal team dashboard for HealthDocX tasks, reminders, projects, documentation, users, and operations visibility.",
  icons: {
    icon: "/healthdocx-logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
