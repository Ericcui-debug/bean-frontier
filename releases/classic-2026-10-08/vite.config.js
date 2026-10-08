import {defineConfig} from 'vite';
export default defineConfig({build:{target:'esnext',assetsInlineLimit:Infinity,rollupOptions:{output:{inlineDynamicImports:true}}}});
