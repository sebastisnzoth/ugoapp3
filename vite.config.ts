import tailwindcss from '@tailwindcss/vite';
import tailwindcssPostcss from '@tailwindcss/postcss';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', 'VITE_');
  return {
    plugins: [react(), tailwindcss()],
    css: {
      postcss: {
        plugins: [tailwindcssPostcss()],
      },
    },
    define: {
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || ''),
      'import.meta.env.VITE_GOOGLE_MAPS_PLATFORM_KEY': JSON.stringify(env.VITE_GOOGLE_MAPS_PLATFORM_KEY || ''),
      'import.meta.env.VITE_GOOGLE_GENAI_API_KEY': JSON.stringify(env.VITE_GOOGLE_GENAI_API_KEY || ''),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      cors: true,
      headers: {
        'Content-Security-Policy': "default-src *; script-src 'self' 'unsafe-inline' 'unsafe-eval' *; style-src 'self' 'unsafe-inline' *; connect-src *; img-src * data:; font-src * data:; media-src *; frame-src *;",
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-goog-api-key',
      },
    },
  };
});
