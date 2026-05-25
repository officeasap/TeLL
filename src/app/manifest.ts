import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Tell',
    short_name: 'Tell',
    description: 'Sovereign communication platform – encrypted calls and messages',
    start_url: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#FF6A00',
    icons: [
      {
        src: '/tell-icons/tell-logo.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/tell-icons/tell-logo.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}