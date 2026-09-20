import * as C from 'cesium';
export const REALITY_URL='https://kartta.hel.fi/3d/mesh/Helsinki_2024/tileset.json';
export function coveragePolygons(tiles){
  const matrix=C.Matrix4.fromArray(tiles.root.transform);
  // A continuous protected envelope prevents cut mesh facades in tiny gaps
  // between individual data tiles. Buffer moves the seam beyond selectable data.
  const b=tiles.root.boundingVolume.box,x=b[0],y=b[1],dx=b[3]+250,dy=b[7]+250;
  return [new C.ClippingPolygon({positions:[[-dx,-dy],[dx,-dy],[dx,dy],[-dx,dy]].map(([a,c])=>C.Matrix4.multiplyByPoint(matrix,new C.Cartesian3(x+a,y+c,0),new C.Cartesian3()))})];
}
export async function loadRealityMesh(viewer,coverage){
  const mesh=await C.Cesium3DTileset.fromUrl(REALITY_URL,{maximumScreenSpaceError:12,cacheBytes:96*1024*1024,maximumCacheOverflowBytes:32*1024*1024});
  if(coverage)mesh.clippingPolygons=new C.ClippingPolygonCollection({polygons:coveragePolygons(coverage)});
  mesh.customShader=new C.CustomShader({fragmentShaderText:'void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material){if(length(fsInput.attributes.positionEC)>5800.0)discard;}'});
  viewer.scene.primitives.add(mesh);mesh.shadows=C.ShadowMode.DISABLED;return mesh;
}
export async function loadDistantContext(viewer,coverage){
  const context=await C.Cesium3DTileset.fromUrl('/api/foundation/context/tileset.json',{maximumScreenSpaceError:40,cacheBytes:32*1024*1024,maximumCacheOverflowBytes:16*1024*1024});
  context.clippingPolygons=new C.ClippingPolygonCollection({polygons:coveragePolygons(coverage)});
  context.style=new C.Cesium3DTileStyle({color:"color('#89918a')"});
  context.customShader=new C.CustomShader({fragmentShaderText:'void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material){if(length(fsInput.attributes.positionEC)<5800.0)discard;material.roughness=1.0;}'});
  context.shadows=C.ShadowMode.DISABLED;viewer.scene.primitives.add(context);return context;
}
