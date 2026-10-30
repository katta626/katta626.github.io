// The neutron star: an oblique rotator with a cutaway interior, dipole field,
// radio beams, orbiting particles, a starfield and a lensing pass.
import * as THREE from 'three';

const NOISE = /* glsl */ `
const vec3 BG = vec3(0.055, 0.055, 0.051);
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

const MAG_TILT = THREE.MathUtils.degToRad(38); // angle between spin and magnetic axes
const CUT_MAX = 1.0; // half-angle of the open wedge, radians
const CUT_CENTER = 1.5708 - 0.15; // the open wedge faces the camera

export function createStar(canvas, { mobile, reduced }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 2));
  renderer.setClearColor(0x0e0e0d, 1);
  renderer.autoClear = false;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
  camera.position.set(0, 0, 7.5);

  // Hierarchy: root (placed on screen) → axis (spin axis tilt) → spin (rotates) → mag (magnetic tilt)
  const root = new THREE.Group();
  const axis = new THREE.Group();
  axis.rotation.set(0.28, 0, 0.32);
  const spin = new THREE.Group();
  const mag = new THREE.Group();
  mag.rotation.z = MAG_TILT;
  scene.add(root); root.add(axis); axis.add(spin); spin.add(mag);

  const U = {
    uTime: { value: 0 },
    uFade: { value: 0 },
    uSpin: { value: 0 },
    uCut: { value: 0 },
    uPole: { value: 0 },
    uFlare: { value: 0 },
    uField: { value: 0 },
    uTwist: { value: 0 },
    uFlash: { value: 0 },
    uBeam: { value: 0 },
    uHiCore: { value: 0 },
    uHiPasta: { value: 0 },
    uQr: { value: 0.34 },
    uMixW: { value: 0.0 },
    uMagAxis: { value: new THREE.Vector3(-Math.sin(MAG_TILT), Math.cos(MAG_TILT), 0) },
    uFlarePos: { value: new THREE.Vector3() },
  };

  // ---------- surface ----------
  const surfaceMat = new THREE.ShaderMaterial({
    uniforms: U,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      uniform float uSpin;
      varying vec3 vLocal; varying vec3 vAxis; varying vec3 vN; varying vec3 vView;
      void main(){
        vLocal = position;
        float c = cos(uSpin), s = sin(uSpin);
        vAxis = vec3(c*position.x + s*position.z, position.y, -s*position.x + c*position.z);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vView = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      ${NOISE}
      uniform float uTime, uFade, uCut, uPole, uFlare;
      uniform vec3 uMagAxis, uFlarePos;
      varying vec3 vLocal; varying vec3 vAxis; varying vec3 vN; varying vec3 vView;
      void main(){
        float phi = atan(vAxis.z, vAxis.x);
        if (uCut > 0.0 && abs(phi - ${CUT_CENTER.toFixed(4)}) < uCut * ${CUT_MAX.toFixed(3)}) discard;
        if (!gl_FrontFacing) { gl_FragColor = vec4(mix(BG, vec3(0.05, 0.055, 0.07), uFade), 1.0); return; }
        vec3 p = normalize(vLocal);
        float n = snoise(p * 2.6 + uTime * 0.04) * 0.5
                + snoise(p * 7.0 - uTime * 0.07) * 0.3
                + snoise(p * 19.0 + uTime * 0.1) * 0.15;
        vec3 cool = vec3(0.42, 0.58, 1.0);
        vec3 hot  = vec3(1.0, 1.0, 1.0);
        vec3 col = mix(cool, hot, clamp(0.55 + n * 0.55, 0.0, 1.0));
        float pc = max(dot(p, uMagAxis), dot(p, -uMagAxis));
        col += vec3(1.0, 0.94, 0.78) * smoothstep(0.88, 0.995, pc) * (0.5 + uPole * 2.2);
        float fd = distance(p, normalize(uFlarePos));
        col += vec3(1.0, 0.86, 0.55) * smoothstep(0.55, 0.0, fd) * uFlare * 2.4;
        float mu = max(dot(normalize(vN), vView), 0.0);
        col *= 0.55 + 0.45 * pow(mu, 0.5);
        col += vec3(0.55, 0.7, 1.0) * pow(1.0 - mu, 2.0) * 0.9;
        gl_FragColor = vec4(mix(BG, col, uFade), 1.0);
      }`,
  });
  const sphereGeo = new THREE.SphereGeometry(1, mobile ? 64 : 112, mobile ? 48 : 80);
  const surface = new THREE.Mesh(sphereGeo, surfaceMat);
  spin.add(surface);

  // ---------- cutaway faces (in the non-spinning axis frame) ----------
  // The cut face. Crust outside; inside, hadronic matter (neutrons: rings holding three quarks),
  // a hadron-quark mixed phase whose width follows the extra pressure ΔP, and a core of free quarks.
  const faceMat = new THREE.ShaderMaterial({
    uniforms: U,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying vec2 vP;
      void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      ${NOISE}
      uniform float uTime, uFade, uCut, uHiCore, uQr, uMixW;
      varying vec2 vP;
      float band(float r, float a, float b){ return step(a, r) * (1.0 - step(b, r)); }
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      vec3 qcol(float k){ return k < 0.5 ? vec3(1.0, 0.36, 0.28) : k < 1.5 ? vec3(0.32, 0.9, 0.5) : vec3(0.42, 0.62, 1.0); }
      // quark fraction at radius r: 1 in the core, 0 in hadronic matter, falling across the mixed phase
      float chiAt(float r){ return 1.0 - smoothstep(uQr, uQr + max(uMixW, 0.002), r); }
      // pasta: quark domains fill the low ground of a fixed landscape first (droplets, then rods and slabs)
      bool isQuark(vec2 p){
        float dom = snoise(vec3(p * 6.5, 3.1)) * 0.5 + 0.5;
        return dom < chiAt(length(p));
      }
      void main(){
        if (uCut <= 0.0) discard;
        float r = length(vP);
        vec3 col;
        vec3 outerCrust = vec3(0.62, 0.60, 0.56);
        vec3 innerCrust = vec3(0.36, 0.40, 0.48);
        vec3 hadBg = vec3(0.07, 0.11, 0.26);
        vec3 qBg = vec3(0.34, 0.25, 0.06) * (1.0 + uHiCore * 0.5);
        col = outerCrust * band(r, 0.96, 1.01) + innerCrust * band(r, 0.80, 0.96);
        if (r < 0.80) {
          col = isQuark(vP) ? qBg : hadBg;
          // particles, one cell at a time
          float S = 12.0;
          vec2 g = vP * S;
          vec2 id = floor(g);
          vec2 f = fract(g) - 0.5;
          vec2 c = (id + 0.5) / S;
          float h = hash(id);
          if (length(c) < 0.76) {
            bool q = isQuark(c);
            vec3 add = vec3(0.0);
            if (!q) {
              // a neutron: a ring holding three quarks of different colour
              vec2 o = (vec2(hash(id + 7.0), hash(id + 13.0)) - 0.5) * 0.18;
              float d = length(f - o);
              add += vec3(0.85) * (1.0 - smoothstep(0.0, 0.05, abs(d - 0.3))) * 0.8;
              float a = uTime * 0.6 + h * 6.283;
              for (int k = 0; k < 3; k++) {
                float ak = a + float(k) * 2.094;
                vec2 pk = o + 0.15 * vec2(cos(ak), sin(ak));
                add += qcol(float(k)) * (1.0 - smoothstep(0.07, 0.11, length(f - pk)));
              }
            } else {
              // deconfined: the same three quarks, moving on their own
              for (int k = 0; k < 3; k++) {
                float fk = float(k);
                vec2 pk = 0.3 * vec2(sin(uTime * (0.9 + h) + fk * 2.1 + h * 10.0), cos(uTime * (1.2 + h * 0.7) + fk * 1.7 + h * 4.0));
                add += qcol(fk) * (1.0 - smoothstep(0.08, 0.12, length(f - pk)));
              }
            }
            col += add;
          }
        }
        // boundaries between layers; the quark core has a hard edge only when the transition is sharp
        float edge = 0.0;
        edge += 1.0 - smoothstep(0.0, 0.006, abs(r - 0.96));
        edge += 1.0 - smoothstep(0.0, 0.008, abs(r - 0.80));
        edge += (1.0 - smoothstep(0.0, 0.007, abs(r - uQr))) * (1.0 - smoothstep(0.0, 0.03, uMixW));
        col = mix(col, vec3(0.02), clamp(edge, 0.0, 1.0) * 0.75);
        gl_FragColor = vec4(mix(BG, col, uFade), 1.0);
      }`,
  });
  const halfDisc = new THREE.CircleGeometry(1, 96, -Math.PI / 2, Math.PI);
  const faceA = new THREE.Mesh(halfDisc, faceMat);
  const faceB = new THREE.Mesh(halfDisc, faceMat);
  axis.add(faceA, faceB);

  // ---------- dipole field lines (magnetic frame: axis = +Y) ----------
  const fieldMat = new THREE.ShaderMaterial({
    uniforms: U,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float uTwist;
      attribute float aSeed;
      varying float vU; varying float vSeed;
      void main(){
        vU = uv.x; vSeed = aSeed;
        float a = uTwist * position.y * 0.55;
        float c = cos(a), s = sin(a);
        vec3 p = vec3(c*position.x + s*position.z, position.y, -s*position.x + c*position.z);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uField, uFade, uFlash, uTwist;
      varying float vU; varying float vSeed;
      void main(){
        float flow = pow(fract(vU * 2.0 - uTime * 0.25 + vSeed), 10.0);
        float ends = smoothstep(0.0, 0.08, vU) * smoothstep(1.0, 0.92, vU);
        vec3 base = mix(vec3(0.45, 0.62, 1.0), vec3(1.0, 0.86, 0.5), uTwist * 0.6);
        vec3 col = base * (0.4 + 1.1 * flow) + vec3(1.0, 0.92, 0.7) * uFlash * 0.9;
        gl_FragColor = vec4(col, (0.35 + 0.65 * flow + uFlash) * uField * uFade * ends);
      }`,
  });
  const fieldGroup = new THREE.Group();
  const fieldGeos = [];
  const shells = mobile ? [1.7, 2.5, 3.6] : [1.6, 2.2, 3.0, 4.2];
  const around = mobile ? 6 : 8;
  shells.forEach((L, li) => {
    const th0 = Math.asin(Math.sqrt(1 / L));
    for (let k = 0; k < around; k++) {
      const ph = (k / around) * Math.PI * 2 + li * 0.35;
      const pts = [];
      for (let i = 0; i <= 64; i++) {
        const th = th0 + (Math.PI - 2 * th0) * (i / 64);
        const r = L * Math.sin(th) ** 2;
        pts.push(new THREE.Vector3(r * Math.sin(th) * Math.cos(ph), r * Math.cos(th), r * Math.sin(th) * Math.sin(ph)));
      }
      const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 96, 0.007 + li * 0.0015, 5, false);
      const seed = new Float32Array(geo.attributes.position.count).fill(Math.random());
      geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
      fieldGeos.push(geo);
      fieldGroup.add(new THREE.Mesh(geo, fieldMat));
    }
  });
  // open field lines above each pole feed the beams
  for (const sign of [1, -1]) {
    for (let k = 0; k < 6; k++) {
      const ph = (k / 6) * Math.PI * 2;
      const pts = [];
      const L = 14;
      const th0 = Math.asin(Math.sqrt(1 / L));
      for (let i = 0; i <= 40; i++) {
        const th = th0 + 0.55 * (i / 40);
        const r = L * Math.sin(th) ** 2;
        const y = r * Math.cos(th) * sign;
        pts.push(new THREE.Vector3(r * Math.sin(th) * Math.cos(ph), y, r * Math.sin(th) * Math.sin(ph)));
      }
      const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.006, 5, false);
      geo.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count).fill(Math.random()), 1));
      fieldGeos.push(geo);
      fieldGroup.add(new THREE.Mesh(geo, fieldMat));
    }
  }
  mag.add(fieldGroup);

  // ---------- radio beams from both magnetic poles ----------
  const beamMat = new THREE.ShaderMaterial({
    uniforms: U,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      varying float vV; varying vec3 vN; varying vec3 vView;
      void main(){
        vV = uv.y;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vView = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uBeam, uFade, uPole, uTime;
      varying float vV; varying vec3 vN; varying vec3 vView;
      void main(){
        float along = pow(vV, 1.8);
        float core = pow(abs(dot(normalize(vN), vView)), 2.0);
        float shimmer = 0.85 + 0.15 * sin(vV * 40.0 - uTime * 6.0);
        vec3 col = mix(vec3(0.55, 0.7, 1.0), vec3(1.0, 0.9, 0.6), 0.25 + uPole * 0.5);
        gl_FragColor = vec4(col, along * core * shimmer * uBeam * uFade * (0.55 + uPole * 0.6));
      }`,
  });
  const beamGeo = new THREE.ConeGeometry(0.62, 6.5, 48, 1, true);
  beamGeo.rotateX(Math.PI);
  beamGeo.translate(0, 3.25, 0);
  const beamInnerGeo = new THREE.ConeGeometry(0.2, 6.5, 32, 1, true);
  beamInnerGeo.rotateX(Math.PI);
  beamInnerGeo.translate(0, 3.25, 0);
  for (const sign of [1, -1]) {
    const g = new THREE.Group();
    g.position.y = 0.98 * sign;
    if (sign < 0) g.rotation.z = Math.PI;
    g.add(new THREE.Mesh(beamGeo, beamMat), new THREE.Mesh(beamInnerGeo, beamMat));
    mag.add(g);
  }

  // ---------- halo ----------
  const haloMat = new THREE.ShaderMaterial({
    uniforms: { ...U, uGlow: { value: 1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uFade, uFlash, uCut;
      varying vec2 vUv;
      void main(){
        float d = length(vUv - 0.5) * 2.0;
        float g = pow(max(0.0, 1.0 - d), 2.6) * 0.95 * (1.0 - uCut * 0.6) + uFlash * pow(max(0.0, 1.0 - d), 1.4) * 0.6;
        gl_FragColor = vec4(vec3(0.5, 0.66, 1.0) * g * uFade, 1.0);
      }`,
  });
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 5.2), haloMat);
  halo.renderOrder = -1;
  root.add(halo);

  // ---------- orbiting particles ----------
  const NP = mobile ? 380 : 1100;
  const pGeo = new THREE.BufferGeometry();
  const pA = new Float32Array(NP * 4); // radius, phase, inclination, seed
  for (let i = 0; i < NP; i++) {
    pA[i * 4] = 1.35 + Math.pow(Math.random(), 1.6) * 2.4;
    pA[i * 4 + 1] = Math.random() * Math.PI * 2;
    pA[i * 4 + 2] = (Math.random() - 0.5) * 0.5;
    pA[i * 4 + 3] = Math.random();
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NP * 3), 3));
  pGeo.setAttribute('aOrbit', new THREE.BufferAttribute(pA, 4));
  const pMat = new THREE.ShaderMaterial({
    uniforms: { ...U, uPhase: { value: 0 }, uPuff: { value: 0 }, uPx: { value: renderer.getPixelRatio() } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float uPhase, uPuff, uPx;
      attribute vec4 aOrbit;
      varying float vA;
      void main(){
        float r = aOrbit.x * (1.0 + uPuff * (0.08 + 0.2 * aOrbit.w));
        float a = aOrbit.y + uPhase * pow(aOrbit.x, -1.5) * 2.2;
        vec3 p = vec3(cos(a) * r, sin(a * 2.0 + aOrbit.w * 6.28) * aOrbit.z * r * 0.4, sin(a) * r);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = (1.2 + aOrbit.w * 2.2) * uPx * (6.0 / -mv.z);
        vA = 0.25 + 0.75 * aOrbit.w;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uFade, uField;
      varying float vA;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * vA * uFade * (0.35 + uField * 0.65);
        gl_FragColor = vec4(vec3(0.75, 0.84, 1.0) * a, a);
      }`,
  });
  const particles = new THREE.Points(pGeo, pMat);
  particles.frustumCulled = false;
  axis.add(particles);

  // ---------- starfield ----------
  const NS = mobile ? 1300 : 3200;
  const sPos = new Float32Array(NS * 3);
  const sSeed = new Float32Array(NS);
  for (let i = 0; i < NS; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(40 + Math.random() * 60);
    sPos.set([v.x, v.y, v.z], i * 3);
    sSeed[i] = Math.random();
  }
  const sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  sGeo.setAttribute('aSeed', new THREE.BufferAttribute(sSeed, 1));
  const sMat = new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uPx: { value: renderer.getPixelRatio() }, uSky: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float uTime, uPx;
      attribute float aSeed;
      varying float vB;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vB = (0.35 + 0.65 * pow(aSeed, 3.0)) * (0.75 + 0.25 * sin(uTime * (0.6 + aSeed * 2.0) + aSeed * 40.0));
        gl_PointSize = (0.8 + pow(aSeed, 4.0) * 2.6) * uPx;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uSky;
      varying float vB;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.05, d) * vB * uSky;
        gl_FragColor = vec4(vec3(0.85, 0.88, 0.95) * a, a);
      }`,
  });
  const sky = new THREE.Points(sGeo, sMat);
  scene.add(sky);

  // ---------- lensing pass (screen space) ----------
  const lensScene = new THREE.Scene();
  const lensCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const lensU = {
    uTex: { value: null },
    uRes: { value: new THREE.Vector2(1, 1) },
    uCenter: { value: new THREE.Vector2(0.5, 0.5) },
    uE: { value: 0.13 },
    uOff: { value: new THREE.Vector2(0.3, 0.1) },
    uMix: { value: 0 },
    uSize: { value: 0.75 },
  };
  new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}img/crab-nebula.jpg`, (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    lensU.uTex.value = t;
  });
  const lensMat = new THREE.ShaderMaterial({
    uniforms: lensU,
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uTex; uniform vec2 uRes, uCenter, uOff; uniform float uE, uMix, uSize;
      void main(){
        vec2 p = (gl_FragCoord.xy - uCenter * uRes) / uRes.y;
        float r2 = dot(p, p) + 1e-6;
        vec2 b = p - uE * uE * p / r2 - uOff;      // point-mass lens equation
        vec2 uv = b / uSize + 0.5;
        float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
        vec3 c = texture2D(uTex, uv).rgb * inside;
        float vign = smoothstep(0.62, 0.25, length(p));
        c *= vign * smoothstep(0.0, 0.035, sqrt(r2));
        c += vec3(1.0, 0.86, 0.45) * smoothstep(0.012, 0.0, sqrt(r2)) * 0.6;
        gl_FragColor = vec4(c * uMix, 1.0);
      }`,
  });
  const lensQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), lensMat);
  lensQuad.frustumCulled = false;
  lensScene.add(lensQuad);

  // ---------- anchors the cards point at ----------
  const anchors = {
    core: new THREE.Object3D(),
    pasta: new THREE.Object3D(),
    crust: new THREE.Object3D(),
    pole: new THREE.Object3D(),
    flare: new THREE.Object3D(),
    outer: new THREE.Object3D(),
    icrust: new THREE.Object3D(),
    mixed: new THREE.Object3D(),
  };
  anchors.core.position.set(0.12, 0.06, 0.002);
  anchors.pasta.position.set(0.84 * Math.cos(-0.55), 0.84 * Math.sin(-0.55), 0.002);
  anchors.crust.position.set(0.98 * Math.cos(0.7), 0.98 * Math.sin(0.7), 0.002);
  anchors.outer.position.set(0.66 * Math.cos(-0.1), 0.66 * Math.sin(-0.1), 0.002);
  anchors.icrust.position.set(0.92 * Math.cos(0.25), 0.92 * Math.sin(0.25), 0.002);
  faceA.add(anchors.core, anchors.pasta, anchors.crust, anchors.outer, anchors.icrust, anchors.mixed);
  anchors.pole.position.set(0, 1.25, 0);
  mag.add(anchors.pole);
  const flareDir = new THREE.Vector3(0.55, 0.6, 0.58).normalize();
  U.uFlarePos.value.copy(flareDir);
  // flare sits on the surface in the spin frame (same frame as the surface shader)
  anchors.flare.position.copy(flareDir).multiplyScalar(1.02);
  spin.add(anchors.flare);

  // ---------- size + frame ----------
  const view = { w: 1, h: 1, halfW: 1, halfH: 1 };
  function resize() {
    const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    view.w = w; view.h = h;
    view.halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    view.halfW = view.halfH * camera.aspect;
    lensU.uRes.value.set(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
  }
  resize();

  const tmp = new THREE.Vector3();
  const camDir = new THREE.Vector3();
  const starCenter = new THREE.Vector3();
  function project(name) {
    const o = anchors[name];
    o.getWorldPosition(tmp);
    root.getWorldPosition(starCenter);
    // is the anchor on the far side of the star?
    camDir.copy(camera.position).sub(starCenter).normalize();
    const facing = tmp.clone().sub(starCenter).dot(camDir);
    tmp.project(camera);
    return { x: (tmp.x * 0.5 + 0.5) * view.w, y: (-tmp.y * 0.5 + 0.5) * view.h, behind: facing < -0.15 };
  }

  // ---------- frame update ----------
  function render(s, t) {
    U.uTime.value = t;
    U.uFade.value = s.o;
    const cut = s.cut < 0.03 ? 0 : s.cut;
    U.uCut.value = cut;
    U.uPole.value = s.pole;
    U.uFlare.value = s.flare;
    U.uField.value = s.field;
    U.uTwist.value = s.twist;
    U.uFlash.value = s.flash;
    U.uBeam.value = s.beam;
    U.uHiCore.value = s.hiCore;
    U.uHiPasta.value = s.hiPasta;
    U.uSpin.value = s.spin;
    sMat.uniforms.uSky.value = s.sky;

    root.visible = s.o > 0.004;
    root.position.set(s.x * view.halfW, s.y * view.halfH, 0);
    const fit = Math.min(1, camera.aspect / 1.2) * 0.5 + 0.5; // shrink a little on narrow screens
    root.scale.setScalar(s.s * fit);
    spin.rotation.y = s.spin;

    const w = cut * CUT_MAX;
    faceA.rotation.y = -(CUT_CENTER - w);
    faceB.rotation.y = -(CUT_CENTER + w);
    faceA.visible = faceB.visible = cut > 0;

    halo.lookAt(camera.position);
    pMat.uniforms.uPhase.value = s.phase;
    pMat.uniforms.uPuff.value = s.puff;
    sky.rotation.y = s.skyTurn;
    sky.rotation.x = s.skyTurn * 0.3;

    lensU.uMix.value = s.lens;
    lensU.uCenter.value.set(s.lensX, s.lensY);
    lensU.uOff.value.set(0.22 * s.lensOff, 0.08 * s.lensOff);
    lensU.uSize.value = mobile ? 0.6 : 0.78;

    renderer.clear();
    renderer.render(scene, camera);
    if (s.lens > 0.002 && lensU.uTex.value) renderer.render(lensScene, lensCam);
  }

  // the mixed phase sits between the quark core and hadronic matter; its width follows ΔP
  function setInterior(mixW) {
    U.uMixW.value = mixW;
    const r = U.uQr.value + mixW / 2 + 0.02;
    anchors.mixed.position.set(r * Math.cos(-0.5), r * Math.sin(-0.5), 0.002);
  }
  setInterior(0);

  function dispose() {
    [sphereGeo, halfDisc, beamGeo, beamInnerGeo, pGeo, sGeo, lensQuad.geometry, halo.geometry, ...fieldGeos].forEach((g) => g.dispose());
    [surfaceMat, faceMat, fieldMat, beamMat, haloMat, pMat, sMat, lensMat].forEach((m) => m.dispose());
    lensU.uTex.value?.dispose();
    renderer.dispose();
  }

  return { render, resize, project, dispose, setInterior, reduced };
}
