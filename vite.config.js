import {defineConfig} from 'vite';
export default defineConfig({build:{target:'esnext',assetsInlineLimit:Infinity,rolldownOptions:{output:{codeSplitting:false}},chunkSizeWarningLimit:3000}});
