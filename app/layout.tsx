import type { Metadata, Viewport } from 'next'
import { Inter as FontSans } from 'next/font/google'
import './globals.css'
import { cn } from '@/lib/utils'
import { ThemeProvider } from '@/components/theme-provider'
import Header from '@/components/header'
import { Toaster } from '@/components/ui/sonner'
import { AppStateProvider } from "@/lib/context/app-state";

const fontSans = FontSans({
  subsets: ['latin'],
  variable: '--font-sans'
})

const title = "Mike";
const description = "L’IA juridique ultra performante conçue par des experts du droit. Accédez à des millions de sources juridiques fiables en temps réel, sécurisé et optimisé pour simplifier votre pratique juridique.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description
  },
  twitter: {
    title,
    description,
    card: 'summary_large_image',
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn('font-sans antialiased', fontSans.variable)}>
      <AppStateProvider>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Header />
          {children}
          {/*<Sidebar />*/}
          {/*<Footer />*/}
          <Toaster />
        </ThemeProvider>
      </AppStateProvider>
      </body>
    </html>
  )
}
