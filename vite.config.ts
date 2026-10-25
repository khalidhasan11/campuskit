import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {defineConfig, Plugin} from 'vite';

function campusKitServiceWorkerPlugin(): Plugin {
  return {
    name: 'campuskit-sw-manifest-injector',
    apply: 'build',
    closeBundle() {
      const distDir = path.resolve(__dirname, 'dist');
      const swPath = path.join(distDir, 'sw.js');
      const assetsDir = path.join(distDir, 'assets');
      if (!fs.existsSync(swPath)) return;

      const builtAssetUrls: string[] = [];
      if (fs.existsSync(assetsDir)) {
        for (const file of fs.readdirSync(assetsDir)) {
          if (/\.(js|css|svg|png|woff2?)$/i.test(file)) {
            builtAssetUrls.push(`/assets/${file}`);
          }
        }
      }

      const rawSw = fs.readFileSync(swPath, 'utf-8');
      const versionHash = crypto
        .createHash('sha256')
        .update(builtAssetUrls.sort().join('|') + rawSw)
        .digest('hex')
        .slice(0, 10);

      const injectedAssets = builtAssetUrls.map((u) => `  ${JSON.stringify(u)}`).join(',\n');
      const updatedSw = rawSw
        .replace('__CAMPUSKIT_SW_VERSION__', `v1.0.0-${versionHash}`)
        .replace('/*__CAMPUSKIT_BUILD_ASSETS__*/', injectedAssets);

      fs.writeFileSync(swPath, updatedSw, 'utf-8');
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), campusKitServiceWorkerPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
