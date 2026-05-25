import type { Metadata } from 'next'
import { Inter, Oswald } from 'next/font/google'
import './globals.css'

const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
  display: 'swap',
})

const oswald = Oswald({
  variable: '--font-heading',
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Tell – Sovereign Messaging',
  description: 'Magnetic, secure, earth‑rooted communication.',
  manifest: '/manifest.json',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Tell',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/tell-icons/tell-logo.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <style dangerouslySetInnerHTML={{ __html: `
          /* ============================================
             NUCLEAR ON-PAGE CSS OVERRIDE
             Centralizes all content, forces mobile-first layout
             ============================================ */
          
          /* Universal Reset & Centralization */
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          html, body {
            width: 100%;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            flex-direction: column;
            background: linear-gradient(145deg, #0a0a0a, #121212);
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
          }

          /* Force all containers to centralize */
          .container, .app, main, section, .main-content {
            width: 100%;
            max-width: 1200px;
            margin: 0 auto;
            padding: 1rem;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
          }

          /* Remove default margins that might break centering */
          h1, h2, h3, h4, p, ul, ol {
            margin: 0;
            padding: 0;
          }

          /* ============================================
             NUCLEAR BUTTON STYLE (MuhammadHasann)
             Injected directly – guaranteed to work
             ============================================ */
          
          .button {
            --black-700: hsla(0 0% 12% / 1);
            --border_radius: 9999px;
            --transtion: 0.3s ease-in-out;
            --offset: 2px;
            --sparkle-color: rgba(255, 255, 255, 0.8);

            cursor: pointer;
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            transform-origin: center;
            padding: 1rem 2rem;
            background: var(--black-700);
            border: none;
            border-radius: var(--border_radius);
            transform: scale(calc(1 + (var(--active, 0) * 0.1)));
            transition: transform var(--transtion);
            color: white;
            font-weight: 600;
            font-size: 1rem;
          }

          /* Sparkle effect */
          .button::before {
            content: "";
            position: absolute;
            inset: 1px;
            border-radius: calc(var(--border_radius) - 2px);
            background: radial-gradient(25% 25% at 50% 50%, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0) 100%);
            opacity: 0;
            transition: opacity 0.2s ease-in-out;
            pointer-events: none;
          }

          .button:hover::before {
            opacity: 0.3;
          }

          /* Border dots animation */
          .button .dots_border {
            --size: 1px;
            position: absolute;
            inset: 0;
            border-radius: var(--border_radius);
            background: radial-gradient(circle at var(--x, 0) var(--y, 0), #ffffff 1px, transparent 1px);
            background-size: calc(20 * var(--size)) var(--size);
            background-repeat: no-repeat;
            transition: background-position 0.2s ease;
            pointer-events: none;
          }

          /* Text inside button */
          .button .text_button {
            position: relative;
            z-index: 1;
          }

          /* Sparkle wrapper */
          .button .sparkle {
            position: absolute;
            inset: 0;
            border-radius: var(--border_radius);
            overflow: hidden;
            mask: radial-gradient(circle at 50% 50%, white 0%, transparent 80%);
          }

          .button .sparkle span {
            position: absolute;
            width: 5px;
            height: 5px;
            background: var(--sparkle-color);
            border-radius: 50%;
            opacity: 0;
            animation: sparkleMove 1s ease-out forwards;
          }

          @keyframes sparkleMove {
            0% {
              transform: translate(0, 0);
              opacity: 0;
            }
            50% {
              opacity: 1;
            }
            100% {
              transform: translate(var(--dx, 100px), var(--dy, -100px));
              opacity: 0;
            }
          }

          /* ============================================
             MOBILE RESPONSIVENESS – NUCLEAR MODE
             ============================================ */
          
          @media (max-width: 768px) {
            html, body {
              padding: 0.5rem;
            }
            
            .container, .app, main, section, .main-content {
              max-width: 100%;
              padding: 0.5rem;
            }
            
            .button {
              padding: 0.75rem 1.25rem;
              font-size: 0.9rem;
              min-height: 48px;
            }
            
            /* Stack elements vertically on mobile */
            .flex-row-mobile {
              flex-direction: column;
            }
            
            /* Thumb-friendly touch targets */
            button, .clickable {
              min-height: 48px;
              min-width: 48px;
            }
            
            /* Inputs – prevent iOS zoom */
            input, textarea, select {
              font-size: 16px !important;
            }
          }

          /* Desktop adjustments */
          @media (min-width: 769px) {
            .container, .app, main, section, .main-content {
              max-width: 1200px;
            }
          }
        ` }} />
      </head>
      <body className={`${inter.variable} ${oswald.variable} antialiased`}>
        <div className="app w-full flex flex-col items-center justify-center">
          {children}
        </div>
      </body>
    </html>
  )
}