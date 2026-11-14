import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { parseStockStagingConfig } from './scripts/stock-staging-config.mjs';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };

export default defineConfig(({ mode }) => {
  const staging = mode === 'staging';
  const env = staging ? loadEnv(mode, import.meta.dirname) : undefined;
  const stagingConfig = env && parseStockStagingConfig(env.VITE_STAGING_FIREBASE_CONFIG, env.VITE_STAGING_FIREBASE_APPCHECK_SITE_KEY, firebaseConfig.projectId);

  return {
    plugins: [react(), tailwindcss()],
    define: {
      __STAGING_FIREBASE_CONFIG__: JSON.stringify(stagingConfig ?? null),
      __STAGING_FIREBASE_APPCHECK_KEY__: JSON.stringify(env?.VITE_STAGING_FIREBASE_APPCHECK_SITE_KEY?.trim() ?? ''),
    },
    build: { outDir: staging ? 'dist-staging' : 'dist' },
    resolve: {
      alias: {
        '@': import.meta.dirname,
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
