import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Slip2Form",
  description:
    "Slip2Form lets your AI update this online tax form through WebMCP. Every AI change is highlighted.",
};

export default function RootLayout({
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
