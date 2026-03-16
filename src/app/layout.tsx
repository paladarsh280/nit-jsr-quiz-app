import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Toaster } from "@/components/ui/sonner"; // 🔥 Ye import kiya

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NIT JSR Quiz Portal",
  description: "Official Quiz Portal for NIT Jamshedpur",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          {children}
          <Toaster position="top-center" richColors /> {/* 🔥 Ye add kiya */}
        </Providers>
      </body>
    </html>
  );
}