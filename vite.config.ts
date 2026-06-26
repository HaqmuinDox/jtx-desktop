import { defineConfig } from 'vite'
import path from 'node:path'
import electron from 'vite-plugin-electron/simple'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    build: {
        chunkSizeWarningLimit: 1000, // Bumps the warning threshold to 1MB
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (id.includes('node_modules')) {
                        return 'vendor-core'
                    }
                },
            },
        },
    },
    plugins: [
        react(),
        electron({
            main: {
                entry: 'electron/main.ts',
                vite: {
                    build: {
                        rollupOptions: {
                            external: ['better-sqlite3'],
                        },
                    },
                },
            },
            preload: {
                input: path.join(__dirname, 'electron/preload.ts'),
            },
            renderer: process.env.NODE_ENV === 'test'
                ? undefined
                : {},
        }),
    ],
})