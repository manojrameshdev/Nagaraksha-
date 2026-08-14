import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'NagRaksha',
    short_name: 'NagRaksha',
    description: 'Emergency coordination workspace for snakebite response.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F7F9F8',
    theme_color: '#184D36',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
