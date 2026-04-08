// ═══════════════════════════════════════════════
// GalaxyBreyne — Hero 3D Parallax (Option 1 done right)
// The hero JPG lives in a 3D scene with:
//   - Fake-depth shader parallax (brighter = closer, shifts more on mouse)
//   - Star particles behind the image plane for depth
//   - Waterfall particles in front in real 3D space
//   - Perspective camera drift + plane tilt on mouse
// ═══════════════════════════════════════════════
import * as THREE from 'three';

const canvas = document.getElementById('hero-three');
if (!canvas) throw new Error('hero-three canvas missing');

if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // JPG fallback remains
} else {
    initHero();
}

function initHero() {
    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(50, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
    camera.position.set(0, 0, 50);

    const renderer = new THREE.WebGLRenderer({
        canvas, antialias: true, alpha: true, powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    // ─── STAR PARTICLES (behind image, peek out at bleed) ───
    const starCount = 1200;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
        starPos[i * 3]     = (Math.random() - 0.5) * 800;
        starPos[i * 3 + 1] = (Math.random() - 0.5) * 500;
        starPos[i * 3 + 2] = -150 - Math.random() * 250;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
        color: 0xffffff, size: 1.3, sizeAttenuation: true,
        transparent: true, opacity: 0.85, depthWrite: false,
    }));
    scene.add(stars);

    // ─── HERO IMAGE PLANE (shader for fake-depth parallax) ───
    const heroMat = new THREE.ShaderMaterial({
        uniforms: {
            uMap:       { value: null },
            uMouse:     { value: new THREE.Vector2(0, 0) },
            uTime:      { value: 0 },
            uOpacity:   { value: 0 },
            uStrength:  { value: 0.022 }, // parallax intensity
        },
        transparent: true,
        vertexShader: /* glsl */`
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: /* glsl */`
            uniform sampler2D uMap;
            uniform vec2 uMouse;
            uniform float uTime;
            uniform float uOpacity;
            uniform float uStrength;
            varying vec2 vUv;

            // Small hash for subtle shimmer
            float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

            void main() {
                // ── Parallax depth from luminance ──
                vec4 base = texture2D(uMap, vUv);
                float lum = dot(base.rgb, vec3(0.299, 0.587, 0.114));
                float depth = smoothstep(0.08, 0.95, lum);

                vec2 offset = uMouse * uStrength * (0.4 + depth);
                offset += vec2(sin(uTime * 0.3) * 0.0015, cos(uTime * 0.35) * 0.0012);

                // ── Waterfall mask ──
                // Waterfalls are in the lower half of the image and are cyan/blue dominant.
                // vUv.y = 0 at bottom, 1 at top (Three.js PlaneGeometry default).
                float belowIsland = smoothstep(0.55, 0.15, vUv.y);         // 0 up top → 1 near bottom
                float cyanish     = smoothstep(0.02, 0.25, base.b - (base.r + base.g) * 0.42);
                float brightEnough= smoothstep(0.15, 0.55, lum);           // ignore near-black sky
                float wfMask      = belowIsland * cyanish * brightEnough;

                // ── Scrolling UV for waterfall regions ──
                // Sample from higher in the image, making content appear to stream downward.
                float scroll = uTime * 0.09;
                vec2 wfUv = vec2(vUv.x, vUv.y + scroll);
                // Subtle horizontal shimmer
                wfUv.x += sin(vUv.y * 60.0 + uTime * 2.0) * 0.0015;
                vec4 wfCol = texture2D(uMap, wfUv + offset);

                // Slight brighten to sell the motion
                wfCol.rgb *= 1.0 + 0.12 * wfMask;
                // Tiny sparkle
                float sparkle = step(0.985, hash(vec2(vUv.x * 800.0, floor(uTime * 20.0 + vUv.y * 40.0))));
                wfCol.rgb += sparkle * wfMask * 0.25;

                vec4 stillCol = texture2D(uMap, vUv + offset);
                vec4 col = mix(stillCol, wfCol, wfMask);

                gl_FragColor = vec4(col.rgb, col.a * uOpacity);
            }
        `,
    });

    const heroPlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 1, 1), heroMat);
    scene.add(heroPlane);

    let planeBaseScale = { x: 1, y: 1 };

    new THREE.TextureLoader().load('images/hero-galaxybreyne-city.jpg', (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        tex.minFilter = THREE.LinearFilter;
        heroMat.uniforms.uMap.value = tex;

        const imgAspect = tex.image.width / tex.image.height;
        heroPlane._imgAspect = imgAspect;

        const fit = () => {
            const dist = camera.position.z;
            const vFov = (camera.fov * Math.PI) / 180;
            const viewH = 2 * Math.tan(vFov / 2) * dist;
            const viewW = viewH * camera.aspect;
            let w, h;
            if (camera.aspect > imgAspect) { w = viewW * 1.08; h = w / imgAspect; }
            else                            { h = viewH * 1.08; w = h * imgAspect; }
            planeBaseScale = { x: w, y: h };
            heroPlane.scale.set(w, h, 1);
        };
        fit();
        heroPlane._fit = fit;

        // Fade in
        const t0 = performance.now();
        const fadeTick = () => {
            const p = Math.min(1, (performance.now() - t0) / 1200);
            heroMat.uniforms.uOpacity.value = p;
            if (p < 1) requestAnimationFrame(fadeTick);
        };
        fadeTick();
        canvas.classList.add('is-ready');
    });

    // ─── WATERFALL PARTICLES (in front of plane, real 3D) ───
    const wfCount = 450;
    const wfPos = new Float32Array(wfCount * 3);
    const wfVel = new Float32Array(wfCount);
    const wfInit = (i, fresh) => {
        wfPos[i * 3]     = (Math.random() - 0.5) * 90;
        wfPos[i * 3 + 1] = fresh ? (Math.random() - 0.5) * 60 : 35 + Math.random() * 10;
        wfPos[i * 3 + 2] = 8 + Math.random() * 6;
        wfVel[i] = 0.12 + Math.random() * 0.22;
    };
    for (let i = 0; i < wfCount; i++) wfInit(i, true);
    const wfGeo = new THREE.BufferGeometry();
    wfGeo.setAttribute('position', new THREE.BufferAttribute(wfPos, 3));
    const waterfall = new THREE.Points(wfGeo, new THREE.PointsMaterial({
        color: 0x9fd8ff, size: 0.18, sizeAttenuation: true,
        transparent: true, opacity: 0.55, depthWrite: false,
        blending: THREE.AdditiveBlending,
    }));
    scene.add(waterfall);

    // ─── MOUSE ───
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    window.addEventListener('pointermove', (e) => {
        mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
        mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    }, { passive: true });

    // ─── RESIZE ───
    function resize() {
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        if (heroPlane._fit) heroPlane._fit();
    }
    window.addEventListener('resize', resize);
    resize();

    // ─── PAUSE OFF-SCREEN ───
    let running = true;
    const heroEl = document.querySelector('.hero');
    if (heroEl && 'IntersectionObserver' in window) {
        const io = new IntersectionObserver((entries) => { running = entries[0].isIntersecting; }, { threshold: 0.01 });
        io.observe(heroEl);
    }

    // ─── ANIMATE ───
    const clock = new THREE.Clock();
    function tick() {
        requestAnimationFrame(tick);
        if (!running) return;
        const t = clock.getElapsedTime();

        mouse.x += (mouse.tx - mouse.x) * 0.05;
        mouse.y += (mouse.ty - mouse.y) * 0.05;

        // Feed mouse to shader (depth parallax)
        heroMat.uniforms.uMouse.value.set(mouse.x, -mouse.y);
        heroMat.uniforms.uTime.value = t;

        // Plane tilt + subtle breath on the mesh
        const breath = 1 + Math.sin(t * 0.4) * 0.006;
        heroPlane.scale.x = planeBaseScale.x * breath;
        heroPlane.scale.y = planeBaseScale.y * breath;
        heroPlane.rotation.y = mouse.x * 0.04;
        heroPlane.rotation.x = -mouse.y * 0.03;
        heroPlane.position.x = mouse.x * 0.8;
        heroPlane.position.y = -mouse.y * 0.6;

        // Stars parallax (much stronger than plane = real depth)
        stars.position.x = mouse.x * 6;
        stars.position.y = -mouse.y * 4;
        stars.rotation.z = t * 0.005;

        // Waterfall tick
        const pos = wfGeo.attributes.position.array;
        for (let i = 0; i < wfCount; i++) {
            pos[i * 3 + 1] -= wfVel[i];
            if (pos[i * 3 + 1] < -40) wfInit(i, false);
        }
        wfGeo.attributes.position.needsUpdate = true;
        waterfall.position.x = mouse.x * 0.4;

        renderer.render(scene, camera);
    }
    tick();
}
