import {defineConfig} from 'vite';
import {viteStaticCopy} from 'vite-plugin-static-copy';
import {fileURLToPath} from 'node:url';
const cesium=fileURLToPath(new URL('../node_modules/cesium/Build/Cesium/',import.meta.url));
export default defineConfig({define:{CESIUM_BASE_URL:JSON.stringify('/cesium/')},plugins:[viteStaticCopy({targets:['Workers','ThirdParty','Assets','Widgets'].map(src=>({src:cesium+src,dest:'cesium'}))})],build:{chunkSizeWarningLimit:2000},server:{port:5173}});
