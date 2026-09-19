import * as C from 'cesium';

export function setupAppearance(viewer,tileset,center){
  const frame=C.Transforms.eastNorthUpToFixedFrame(C.Cartesian3.fromDegrees(...center));
  const direction=C.Matrix4.multiplyByPointAsVector(frame,new C.Cartesian3(.8,.35,-.38),new C.Cartesian3());
  viewer.scene.light=new C.DirectionalLight({direction:C.Cartesian3.normalize(direction,direction),color:C.Color.fromCssColorString('#ffe3bc'),intensity:2.0});
  viewer.shadows=true;viewer.shadowMap.enabled=true;viewer.shadowMap.softShadows=true;viewer.shadowMap.size=2048;viewer.shadowMap.maximumDistance=3800;viewer.shadowMap.darkness=.35;
  viewer.scene.globe.shadows=C.ShadowMode.RECEIVE_ONLY;
  // Cesium 1.145 exposes no public terrain depth-bias control. Guard this
  // version-specific tuning: it prevents cascade strips on the flat ellipsoid.
  // The west tileset AABB needs a stronger bias than the original 3 km crop.
  const bias=viewer.shadowMap._terrainBias;
  if(bias){
    bias.depthBias=.002;
    if(bias.normalOffsetScale!=null)bias.normalOffsetScale=1.6;
  }
  // Distant city-scale views only make cascade splits visible on uncovered water.
  viewer.scene.preRender.addEventListener(()=>{
    viewer.shadowMap.enabled=viewer.camera.positionCartographic.height<4200;
  });
  // This archive has double-sided shells. Casting onto the ground avoids
  // self-shadow acne on those coplanar surfaces; AO retains courtyard depth.
  tileset.shadows=C.ShadowMode.CAST_ONLY;
  tileset.colorBlendMode=C.Cesium3DTileColorBlendMode.MIX;tileset.colorBlendAmount=.4;
  tileset.customShader=new C.CustomShader({fragmentShaderText:`
    void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
      material.diffuse *= vec3(0.88, 0.81, 0.70);
      material.roughness = 0.82;
    }`});
  const ao=viewer.scene.postProcessStages.ambientOcclusion;
  if(C.PostProcessStageLibrary.isAmbientOcclusionSupported(viewer.scene)){
    ao.enabled=true;ao.uniforms.intensity=.7;ao.uniforms.lengthCap=2;ao.uniforms.stepSize=1;ao.uniforms.bias=.1;
  }
  // Screen-space architectural edges above the local ground plane. Constant
  // shader cost: no per-pixel loop over thousands of feature pick IDs.
  const origin=C.Cartesian3.fromDegrees(center[0],center[1],0);
  const up=C.Ellipsoid.WGS84.geodeticSurfaceNormal(origin,new C.Cartesian3());
  const edges=viewer.scene.postProcessStages.add(new C.PostProcessStage({name:'lens-building-edges',
    fragmentShader:`uniform sampler2D colorTexture;
      uniform sampler2D depthTexture;
      uniform vec3 groundOrigin;
      uniform vec3 groundUp;
      in vec2 v_textureCoordinates;
      void main(){
        vec2 uv=v_textureCoordinates;
        vec4 color=texture(colorTexture,uv);
        float rawDepth=texture(depthTexture,uv).r;
        vec4 eye=czm_windowToEyeCoordinates(uv*czm_viewport.zw,rawDepth);
        vec3 world=(czm_inverseView*(eye/eye.w)).xyz;
        if(rawDepth>=1.0||dot(world-groundOrigin,groundUp)<3.0){out_FragColor=color;return;}
        vec2 px=1.0/czm_viewport.zw;
        float depth=czm_readDepth(depthTexture,uv);
        float delta=0.0;
        delta=max(delta,abs(depth-czm_readDepth(depthTexture,uv+vec2(px.x,0.0))));
        delta=max(delta,abs(depth-czm_readDepth(depthTexture,uv-vec2(px.x,0.0))));
        delta=max(delta,abs(depth-czm_readDepth(depthTexture,uv+vec2(0.0,px.y))));
        delta=max(delta,abs(depth-czm_readDepth(depthTexture,uv-vec2(0.0,px.y))));
        float edge=smoothstep(0.000002,0.000025,delta);
        float gray=dot(color.rgb,vec3(0.2126,0.7152,0.0722));
        vec3 tint=clamp(mix(vec3(gray),color.rgb,1.8)*1.2,0.0,1.0);
        out_FragColor=vec4(mix(color.rgb,tint,edge*.8),color.a);
      }`,uniforms:{groundOrigin:origin,groundUp:up}}));
  edges.enabled=false;
  return {edges,refresh(contents,active){
    edges.enabled=!['overview','price','parking'].includes(active);
    tileset.colorBlendAmount=['noise','energy','use'].includes(active)?0.74:0.4;
  }};
}
