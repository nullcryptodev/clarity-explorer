import "./globals.css"

import { Raleway, DM_Sans, Geist_Mono } from "next/font/google"
import type { Metadata, Viewport } from "next"

import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"

import { cn } from "@/lib/utils"

const dmSansHeading = DM_Sans({
  subsets: ["latin"],
  variable: "--font-heading",
})

const raleway = Raleway({
  subsets: ["latin"],
  variable: "--font-sans",
})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  metadataBase: new URL("https://github.com/nullcryptodev/Clarity"), // TODO replace with real domain
  title: "Clarity - Authority rotates, the chain doesn't.",
  description:
    "The official website for the Clarity blockchain explorer.",
  keywords: [
    "Clarity",
    "CLRTY",
    "Blockchain",
    "Crypto",
    "Explorer",
  ],
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "Clarity - Authority rotates, the chain doesn't.",
    description:
      "Proof of Rotating Authority (PoRA), immediate finality, sparse Merkle state with historical proofs, AMM, limit orders, two-key validators, epoch rewards. Ed25519, Blake2b, MDBX, JSON-RPC 2.0.",
    images: ["/clarity.png"],
    type: "website",
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        raleway.variable,
        dmSansHeading.variable,
        fontMono.variable,
      )}
    >
      <body>
        <ThemeProvider>
          <TooltipProvider>
            {children}
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}