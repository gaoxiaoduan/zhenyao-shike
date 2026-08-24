import { configDefaults, defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'

const isVitest = Boolean(process.env.VITEST)
const isE2e = process.env.E2E === '1'

// https://vite.dev/config/
export default defineConfig(async () => {
  const plugins = [vue(), tailwindcss()]
  if (!isVitest) {
    const { cloudflare } = await import('@cloudflare/vite-plugin')
    plugins.push(cloudflare({ inspectorPort: false }))
  }

  return {
    plugins,
    resolve: {
      alias: {
        phaser: fileURLToPath(new URL('./node_modules/phaser/dist/phaser.esm.js', import.meta.url)),
      },
    },
    define: {
      global: 'globalThis',
      'typeof CANVAS_RENDERER': 'true',
      'typeof WEBGL_RENDERER': 'true',
      'typeof WEBGL_DEBUG': 'false',
      'typeof FEATURE_SOUND': 'undefined',
    },
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: 'phaser',
                test: /node_modules[\\/]phaser[\\/]/,
                maxSize: 2048 * 1024,
                priority: 10,
              },
            ],
          },
        },
      },
    },
    server: isE2e ? { hmr: { overlay: false } } : undefined,
    test: {
      environment: 'node',
      exclude: [...configDefaults.exclude, 'e2e/**'],
    },
  }
})
