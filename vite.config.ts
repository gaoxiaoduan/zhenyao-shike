import { configDefaults, defineConfig } from 'vitest/config'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'

const isVitest = Boolean(process.env.VITEST)

// https://vite.dev/config/
export default defineConfig(async () => {
  const plugins = [vue(), tailwindcss()]
  if (!isVitest) {
    const { cloudflare } = await import('@cloudflare/vite-plugin')
    plugins.push(cloudflare({ inspectorPort: false }))
  }

  return {
    plugins,
    test: {
      environment: 'node',
      exclude: [...configDefaults.exclude, 'e2e/**'],
    },
  }
})
