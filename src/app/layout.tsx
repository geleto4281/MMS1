import type { Metadata } from "next"
import "./globals.css"
import { AuthProvider } from "@/context/AuthContext"
import { PreferencesProvider } from "@/context/PreferencesContext"
import { InstallAppPrompt } from "@/components/InstallAppPrompt"

export const metadata: Metadata = {
  title: {
    default: "MMS1",
    template: "%s | MMS1",
  },
  // No description on purpose: it is what link previews (Telegram, WhatsApp)
  // show under the title when sharing the URL.
  applicationName: "MMS1",
  keywords: ["attendance", "school", "students", "teachers", "madresah", "management"],
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/image/mms1-logo.png",
    apple: "/icons/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    title: "MMS1",
    statusBarStyle: "default",
  },
  // No openGraph.description on purpose: link previews (Telegram, WhatsApp,
  // etc.) would otherwise show this text when sharing the URL.
  openGraph: {
    title: "MMS1",
    type: "website",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased font-sans" data-theme="dark">
        <PreferencesProvider>
          <AuthProvider>
            {children}
            <InstallAppPrompt />
          </AuthProvider>
        </PreferencesProvider>
      </body>
    </html>
  )
}