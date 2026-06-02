/* ==================================================================
   Badge app — home-card live preview.

   Faithfully reproduces app/apps/badge/page.tsx at its DEFAULT state:
   the default Apple logo SVG extruded into 3D, shaded with the real
   /badge/matcap.png matcap texture + /badge/noise.png bump map, the
   exact custom matcap-shader injection (rotation / brightness /
   contrast / saturation / warp uniforms), ACES tone mapping at the
   default exposure, and the same slow auto-rotation the page applies
   via OrbitControls.autoRotate.

   Values are copied verbatim from the page's `DEF` defaults and the
   `buildFromSVG` geometry/material pipeline. Mild typing (loose three
   types via `any` on three objects) is used to stay tsc-clean without
   importing three's full type surface here.
================================================================== */

/* ── defaults (verbatim from page.tsx `DEF`) ──────── */
const DEF = {
  depth: 1.6,
  bevel: 0.5,
  layerStep: 0,
  color: "#ffffff",
  bgColor: "#0d0d0d",
  exposure: 1.6,
  globalSat: 1.0,
  brightness: 1.0,
  contrast: 1.0,
  saturation: 1.0,
  warp: 0.0,
  rotation: 0,
  tile: 5,
  bump: 0.4,
};

/* FPS cap — match the runner conventions (~40fps). */
const FRAME_MS = 25;

export function createPreview(canvas: HTMLCanvasElement): () => void {
  let disposed = false;
  let cleanup: (() => void) | null = null;

  (async () => {
    const THREE = await import("three");
    const { OrbitControls } = await import(
      "three/examples/jsm/controls/OrbitControls.js"
    );
    if (disposed) return;

    /* ── renderer ─────────────────────────────────── */
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(new THREE.Color(DEF.bgColor));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = DEF.exposure;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 2000);
    camera.position.set(0, 0, 200);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.2;
    controls.enabled = false; // card preview is non-interactive
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.enableRotate = false;

    /* ── shared shader uniforms (default values) ────── */
    const uniforms = {
      uRotation: { value: (DEF.rotation * Math.PI) / 180 },
      uBrightness: { value: DEF.brightness },
      uContrast: { value: DEF.contrast },
      uSaturation: { value: DEF.saturation },
      uWarp: { value: DEF.warp },
    };

    /* ── textures ─────────────────────────────────── */
    const loader = new THREE.TextureLoader();
    const matcapTex: any = await new Promise<any>((res) =>
      loader.load("/badge/matcap.png", res),
    );
    if (disposed) {
      matcapTex.dispose?.();
      renderer.dispose();
      renderer.forceContextLoss?.();
      return;
    }
    matcapTex.colorSpace = THREE.SRGBColorSpace;

    const detailTex: any = await new Promise<any>((res) =>
      loader.load("/badge/noise.png", res),
    );
    if (disposed) {
      matcapTex.dispose?.();
      detailTex.dispose?.();
      renderer.dispose();
      renderer.forceContextLoss?.();
      return;
    }
    detailTex.colorSpace = THREE.NoColorSpace;
    detailTex.wrapS = detailTex.wrapT = THREE.RepeatWrapping;
    detailTex.repeat.set(DEF.tile, DEF.tile);

    /* ── default SVG ──────────────────────────────── */
    const svgText = await fetch("/badge/Apple_logo.svg").then((r) => r.text());
    const { SVGLoader } = await import(
      "three/examples/jsm/loaders/SVGLoader.js"
    );
    if (disposed) {
      matcapTex.dispose?.();
      detailTex.dispose?.();
      renderer.dispose();
      renderer.forceContextLoss?.();
      return;
    }

    /* ── build extruded group (verbatim pipeline) ───── */
    const mats: any[] = [];
    const geos: any[] = [];

    const svgData = new SVGLoader().parse(svgText);
    const allShapes: any[] = [];
    svgData.paths.forEach((p: any) => {
      SVGLoader.createShapes(p).forEach((sh: any) => allShapes.push(sh));
    });

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const sh of allShapes)
      for (const pt of sh.getPoints(12)) {
        if (pt.x < minX) minX = pt.x;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.y > maxY) maxY = pt.y;
      }
    if (!isFinite(minX)) {
      minX = 0;
      minY = 0;
      maxX = 100;
      maxY = 100;
    }
    const cx = (minX + maxX) / 2,
      cy = (minY + maxY) / 2;
    const sf = 40 / Math.max(maxX - minX, maxY - minY, 1);
    const nm = new THREE.Matrix4()
      .makeScale(sf, sf, 1)
      .multiply(new THREE.Matrix4().makeTranslation(-cx, cy, 0));

    const shapeBBoxes = allShapes.map((sh: any) => {
      let x0 = Infinity,
        y0 = Infinity,
        x1 = -Infinity,
        y1 = -Infinity;
      for (const pt of sh.getPoints(12)) {
        if (pt.x < x0) x0 = pt.x;
        if (pt.x > x1) x1 = pt.x;
        if (pt.y < y0) y0 = pt.y;
        if (pt.y > y1) y1 = pt.y;
      }
      return { x0, y0, x1, y1 };
    });
    const bboxOverlap = (a: any, b: any) =>
      !(a.x1 < b.x0 || b.x1 < a.x0 || a.y1 < b.y0 || b.y1 < a.y0);

    const zLevels: number[] = [];
    for (let i = 0; i < allShapes.length; i++) {
      let level = 0;
      for (let j = 0; j < i; j++) {
        if (bboxOverlap(shapeBBoxes[i], shapeBBoxes[j]))
          level = Math.max(level, zLevels[j] + 1);
      }
      zLevels.push(level);
    }

    const grp = new THREE.Group();

    for (let si = 0; si < allShapes.length; si++) {
      const d = DEF.depth;
      const bv = DEF.bevel;
      const matColor = DEF.color;
      const matBump = DEF.bump;
      const globalLayerZ = zLevels[si] * DEF.layerStep;

      const shape = allShapes[si];
      const pts = shape
        .getPoints(20)
        .map((p: any) => new THREE.Vector2(p.x, -p.y));
      const fl = new THREE.Shape(pts);
      for (const h of shape.holes)
        fl.holes.push(
          new THREE.Path(
            h.getPoints(20).map((p: any) => new THREE.Vector2(p.x, -p.y)),
          ),
        );

      const geo = new THREE.ExtrudeGeometry([fl], {
        depth: Math.max(0.05, d - bv * 2),
        bevelEnabled: bv > 0,
        bevelThickness: bv,
        bevelSize: bv / sf,
        bevelSegments: 8,
        curveSegments: 24,
      });
      geo.applyMatrix4(nm);
      const totalZ = globalLayerZ;
      if (totalZ !== 0) geo.translate(0, 0, totalZ);
      geo.computeVertexNormals();
      geo.computeBoundingBox();
      const bb = geo.boundingBox!;
      const pos = geo.attributes.position as any;
      const uvs = new Float32Array(pos.count * 2);
      const ext = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y) || 1;
      for (let i = 0; i < pos.count; i++) {
        uvs[i * 2] = (pos.getX(i) - bb.min.x) / ext;
        uvs[i * 2 + 1] = (pos.getY(i) - bb.min.y) / ext;
      }
      geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
      geos.push(geo);

      const mat: any = new THREE.MeshMatcapMaterial({
        matcap: matcapTex,
        color: new THREE.Color(matColor),
      });
      mat.bumpMap = detailTex;
      mat.bumpScale = matBump;

      mat.onBeforeCompile = (shader: any) => {
        shader.uniforms.uRotation = uniforms.uRotation;
        shader.uniforms.uBrightness = uniforms.uBrightness;
        shader.uniforms.uContrast = uniforms.uContrast;
        shader.uniforms.uSaturation = uniforms.uSaturation;
        shader.uniforms.uWarp = uniforms.uWarp;
        mat.userData.shader = shader;

        shader.fragmentShader = shader.fragmentShader
          .replace(
            "#define MATCAP",
            "#define MATCAP\nuniform float uRotation; uniform float uBrightness; uniform float uContrast; uniform float uSaturation; uniform float uWarp;",
          )
          .replace(
            "\tvec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;",
            "\tvec2 uvRaw = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;\n\tfloat cosA = cos(uRotation), sinA = sin(uRotation);\n\tvec2 mc0 = uvRaw - 0.5;\n\tvec2 uv = vec2(cosA*mc0.x - sinA*mc0.y, sinA*mc0.x + cosA*mc0.y) + 0.5;\n\tuv = clamp(uv + uWarp * vec2(sin(uv.y*8.0), cos(uv.x*8.0)) * 0.06, 0.0, 1.0);",
          )
          .replace(
            "\t\tvec4 matcapColor = texture2D( matcap, uv );",
            "\t\tvec4 matcapColor = texture2D( matcap, uv );\n\t\tmatcapColor.rgb *= uBrightness;\n\t\tmatcapColor.rgb = (matcapColor.rgb - 0.5) * uContrast + 0.5;\n\t\tfloat mcLum = dot(matcapColor.rgb, vec3(0.299,0.587,0.114));\n\t\tmatcapColor.rgb = mix(vec3(mcLum), matcapColor.rgb, uSaturation);\n\t\tmatcapColor.rgb = clamp(matcapColor.rgb, 0.0, 1.0);",
          );
      };

      mats.push(mat);
      grp.add(new THREE.Mesh(geo, mat));
    }

    const box = new THREE.Box3().setFromObject(grp);
    grp.position.sub(box.getCenter(new THREE.Vector3()));
    scene.add(grp);

    const size = box.getSize(new THREE.Vector3());
    const dim = Math.max(size.x, size.y, size.z);
    controls.minDistance = dim * 0.6;
    controls.maxDistance = dim * 6;
    const dist = dim * 2.2;
    camera.position.set(dist * 0.18, dist * 0.22, dist);
    camera.lookAt(0, 0, 0);
    controls.target.set(0, 0, 0);
    controls.update();

    /* push shared uniforms onto each compiled shader before render */
    scene.onBeforeRender = () => {
      for (const m of mats) {
        const sh = m.userData.shader;
        if (!sh) continue;
        sh.uniforms.uRotation.value = uniforms.uRotation.value;
        sh.uniforms.uBrightness.value = uniforms.uBrightness.value;
        sh.uniforms.uContrast.value = uniforms.uContrast.value;
        sh.uniforms.uSaturation.value = uniforms.uSaturation.value;
        sh.uniforms.uWarp.value = uniforms.uWarp.value;
      }
      renderer.toneMappingExposure = DEF.exposure;
    };

    /* ── size to CSS box ──────────────────────────── */
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    /* ── animation loop (auto-rotate, FPS-capped) ──── */
    let raf = 0;
    let last = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < FRAME_MS) return;
      last = now;
      if (document.hidden) return;
      controls.update(); // applies autoRotate
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);

    cleanup = () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      for (const m of mats) m.dispose();
      for (const g of geos) g.dispose();
      matcapTex.dispose?.();
      detailTex.dispose?.();
      renderer.dispose();
      renderer.forceContextLoss?.();
    };
  })();

  return () => {
    disposed = true;
    cleanup?.();
  };
}
