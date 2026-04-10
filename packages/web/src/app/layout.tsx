import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { BRAND_NAME, BRAND_TAGLINE } from "../lib/brand";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: BRAND_NAME,
  description: BRAND_TAGLINE,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body style={{ fontFamily: "var(--font-inter, var(--font))" }}>
        {children}
      </body>
    </html>
  );
}
