import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
// viteSingleFile junta todo en un solo index.html (útil para hostear rápido). Se puede quitar sin problema.
export default defineConfig({ plugins: [react(), viteSingleFile()], base: './' })
