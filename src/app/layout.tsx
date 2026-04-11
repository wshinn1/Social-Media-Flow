import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lead Flow Admin",
  description: "Super admin dashboard for managing Facebook lead ad submissions",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
