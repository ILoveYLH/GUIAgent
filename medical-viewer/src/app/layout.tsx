import type { Metadata } from "next";
import { Geist_Mono, Noto_Sans_SC } from "next/font/google";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoSansSc = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-sc",
});

export const metadata: Metadata = {
  title: "云胶片",
  description: "云胶片报告",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      suppressHydrationWarning
      className={`${notoSansSc.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body
        className={`${notoSansSc.className} min-h-full flex flex-col font-sans`}
      >
        {children}
      </body>
    </html>
  );
}
