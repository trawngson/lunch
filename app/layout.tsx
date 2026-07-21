import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lunch Menu",
  description: "School lunch for today and the coming week.",
  metadataBase: new URL("https://lunch.truongson.me"),
  openGraph: {
    title: "Lunch Menu",
    description: "School lunch for today and the coming week.",
    url: "/",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Lunch Menu",
    description: "School lunch for today and the coming week.",
    images: ["/og.png"],
  },
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
