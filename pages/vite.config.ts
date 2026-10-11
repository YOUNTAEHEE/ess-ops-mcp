import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
export default defineConfig({root:fileURLToPath(new URL('.',import.meta.url)),base:'/ess-ops-mcp/',publicDir:'../public',plugins:[react()],build:{outDir:'../pages-dist',emptyOutDir:true}});
