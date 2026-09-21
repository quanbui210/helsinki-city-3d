import * as C from 'cesium';
export function createBuildingMaterials(){
  const texture=name=>({type:C.UniformType.SAMPLER_2D,value:new C.TextureUniform({url:`/materials/concrete-${name}.jpg`,repeat:true})});
  return new C.CustomShader({varyings:{v_facadeNormal:C.VaryingType.VEC3},vertexShaderText:'void vertexMain(VertexInput vsInput, inout czm_modelVertexOutput vsOutput){v_facadeNormal=vsInput.attributes.normalMC;}',uniforms:{u_color:texture('color'),u_normal:texture('normal'),u_rough:texture('roughness'),u_dusk:{type:C.UniformType.FLOAT,value:1},u_data:{type:C.UniformType.FLOAT,value:0},u_time:{type:C.UniformType.FLOAT,value:0}},fragmentShaderText:`
    float noiseCell(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material){
      vec3 p=fsInput.attributes.positionMC,n=normalize(v_facadeNormal);
      float style=floor(fsInput.attributes.styleid+0.5);
      float stadium=step(0.5,style)*(1.0-step(1.5,style));
      float cathedral=step(1.5,style)*(1.0-step(2.5,style));
      float landmark=max(stadium,cathedral),illustrated=landmark*(1.0-u_data);
      vec3 up=vec3(0.0,1.0,0.0);
      float facade=1.0-smoothstep(0.12,0.35,abs(n.y));
      vec3 tangent=abs(n.y)<0.9?normalize(cross(up,n)):vec3(1.0,0.0,0.0);
      vec2 uv=abs(n.y)<0.9?vec2(dot(p,tangent),p.y):p.xz;
      float detail=1.0-smoothstep(900.0,2400.0,length(fsInput.attributes.positionEC));
      vec3 albedo=texture(u_color,uv/2.0).rgb;
      float rough=texture(u_rough,uv/2.0).r;
      vec3 bump=texture(u_normal,uv/2.0).xyz*2.0-1.0;
      material.diffuse*=mix(vec3(0.88,0.85,0.79),mix(vec3(0.87,0.85,0.79),albedo,0.35),detail*(1.0-u_data));
      material.roughness=mix(0.84,clamp(rough,0.45,1.0),detail);
      material.normalEC=normalize(material.normalEC+czm_normal*(tangent*bump.x+up*bump.y)*0.12*detail*(1.0-u_data));
      float roof=1.0-facade;
      float ribs=facade*smoothstep(0.72,0.98,abs(sin(uv.x*1.45)));
      float stadiumBand=facade*pow(max(0.0,cos(p.y*0.23)),18.0);
      vec3 stadiumColor=mix(vec3(0.13,0.19,0.21),vec3(0.70,0.72,0.69),roof);
      stadiumColor=mix(stadiumColor,vec3(0.44,0.50,0.49),ribs*0.48);
      float pilasters=facade*smoothstep(0.82,0.99,abs(cos(uv.x*0.34)));
      vec3 cathedralColor=mix(vec3(0.80,0.78,0.68),vec3(0.12,0.28,0.25),roof);
      cathedralColor=mix(cathedralColor,vec3(0.94,0.90,0.76),pilasters*0.42);
      material.diffuse=mix(material.diffuse,stadiumColor,stadium*(1.0-u_data));
      material.diffuse=mix(material.diffuse,cathedralColor,cathedral*(1.0-u_data));
      material.roughness=mix(material.roughness,mix(0.56,0.78,roof),illustrated);
      material.specular=mix(material.specular,vec3(0.10*stadium+0.04*cathedral),illustrated);
      vec2 cell=uv/vec2(3.0,3.2),f=fract(cell),aa=max(fwidth(cell),vec2(0.015));
      vec2 windowMask=smoothstep(vec2(0.20),vec2(0.20)+aa,f)*(1.0-smoothstep(vec2(0.68)-aa,vec2(0.68),f));
      float window=windowMask.x*windowMask.y*facade*detail*(1.0-u_data)*(1.0-landmark)*step(3.0,p.y);
      float random=noiseCell(floor(cell));
      float lit=step(0.64,random)*u_dusk;
      material.diffuse=mix(material.diffuse,vec3(0.19,0.26,0.28),window*0.7);
      material.roughness=mix(material.roughness,0.25,window);
      material.emissive+=vec3(1.0,0.59,0.23)*window*lit*(0.75+0.025*sin(u_time*0.7+random*50.0));
      material.emissive+=vec3(0.58,0.78,0.84)*stadium*stadiumBand*detail*u_dusk*(1.0-u_data)*0.58;
      material.emissive+=vec3(1.0,0.72,0.34)*cathedral*facade*detail*u_dusk*(1.0-u_data)*0.14;
    }`});
}
