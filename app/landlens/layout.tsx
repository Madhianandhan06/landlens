import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist } from "next/font/google";
import { Toaster } from "../../components/ui/sonner";
import { TooltipProvider } from "../../components/ui/tooltip";
const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "Nextjob",
  description: "A simple Next.js app.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <html lang="en" suppressHydrationWarning>
        <head />
          <body>
            <Toaster />
            <TooltipProvider>{children}</TooltipProvider>
          </body>
      </html>
    </>
  )
}
