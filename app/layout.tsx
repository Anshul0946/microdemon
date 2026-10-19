import type { Metadata } from 'next'
import { Suspense } from 'react'
import Header from '@/components/layout/Header'
import './globals.css'

export const metadata: Metadata = {
  title: 'Nyxir CQI — Customer Quality Index & Margin Leak Diagnostic',
  description: 'Institutional-grade Day-0 e-commerce store telemetry and margin leak diagnostic engine for Shopify brands.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-[#FAFAFA] text-[#0F172A] min-h-screen flex flex-col antialiased selection:bg-slate-900 selection:text-white">
        <Suspense fallback={<div className="h-16 bg-white border-b border-slate-200" />}>
          <Header />
        </Suspense>
        <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-8 md:py-12">
          {children}
        </main>
        <footer className="border-t border-[#E2E8F0] bg-white py-6 text-center text-xs text-slate-500 font-mono">
          © {new Date().getFullYear()} Nyxir CQI Diagnostic Engine • Institutional E-Commerce Intelligence
        </footer>
      </body>
    </html>
  )
}
