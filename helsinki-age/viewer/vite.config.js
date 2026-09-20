import {foundationMiddleware} from '../server/foundation.js';
import {defineConfig,normalizePath,loadEnv} from 'vite';
import {createListingSearch,listingMiddleware} from '../server/listing-search.js';
import {viteStaticCopy} from 'vite-plugin-static-copy';
import {fileURLToPath} from 'node:url';
const cesium=normalizePath(fileURLToPath(new URL('../node_modules/cesium/Build/Cesium/',import.meta.url)));
const envDir=fileURLToPath(new URL('../',import.meta.url));
export default defineConfig(({mode})=>{
 const env=loadEnv(mode,envDir,'');
 const middleware=listingMiddleware(createListingSearch({apiKey:env.BRAVE_SEARCH_API_KEY,storageAllowed:env.BRAVE_STORAGE_ALLOWED==='true',dailyLimit:Number(env.LISTING_DAILY_LIMIT)||100}));
 const foundation=foundationMiddleware({apiKey:env.NLS_API_KEY});
 const listings={name:'listing-search',configureServer(server){server.middlewares.use(middleware);server.middlewares.use(foundation);},configurePreviewServer(server){server.middlewares.use(middleware);server.middlewares.use(foundation);}};
 return {envDir,define:{CESIUM_BASE_URL:JSON.stringify('/cesium/')},plugins:[listings,viteStaticCopy({targets:['Workers','ThirdParty','Assets','Widgets'].map(src=>({src:cesium+src,dest:'cesium'}))})],build:{chunkSizeWarningLimit:2000},server:{port:5173}};
});
