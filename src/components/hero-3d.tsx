"use client";

// Adegan 3D ambient untuk hero: dua pin lokasi + rute putus-putus (kisah
// perjalanan Grab) dan kartu-kartu berwarna dengan garis tepi — bukan kotak
// putih polos yang terbaca "placeholder". three.js murni, di-load dinamis,
// DPR dibatasi, reduced-motion render sekali, semua di-dispose.
import { useEffect, useRef } from "react";
// Type-only — hilang saat kompilasi; three tetap di-load dinamis di effect
import type * as ThreeType from "three";

export function Hero3D({ className = "" }: { className?: string }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;
    let frame = 0;
    let cleanup: (() => void) | null = null;

    (async () => {
      const THREE = await import("three");
      if (disposed || !mountRef.current) return;

      const width = mount.clientWidth || 1;
      const height = mount.clientHeight || 1;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
      camera.position.set(0, 0.6, 9);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.setSize(width, height);
      mount.appendChild(renderer.domElement);

      const disposables: Array<{ dispose: () => void }> = [];

      const mat = (color: number, roughness = 0.4) => {
        const m = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.08 });
        disposables.push(m);
        return m;
      };
      const geo = <T extends ThreeType.BufferGeometry>(g: T) => {
        disposables.push(g);
        return g;
      };

      // ==== Kartu klaim berwarna + garis tepi supaya terbaca "kartu",
      // bukan kotak abu polos ====
      const group = new THREE.Group();
      const cardGeo = geo(new THREE.BoxGeometry(1.5, 2, 0.06));
      const edgeGeo = geo(new THREE.EdgesGeometry(cardGeo));
      const edgeLine = (color: number) => {
        const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.5 });
        disposables.push(m);
        return m;
      };
      const palette = [0x2563eb, 0x818cf8, 0x7dd3fc, 0xffffff, 0x2563eb];
      const layout = [
        { x: -2.4, y: 0.6, z: -0.6, s: 0.85 },
        { x: 0.1, y: -0.1, z: 0.3, s: 1 },
        { x: 2.5, y: 0.8, z: -0.7, s: 0.8 },
        { x: -1.3, y: -1.7, z: 0.8, s: 0.55 },
        { x: 1.5, y: -1.8, z: 1, s: 0.5 },
      ];
      const floats: Array<{ obj: ThreeType.Object3D; phase: number; baseY: number }> = [];
      layout.forEach((c, i) => {
        const card = new THREE.Group();
        card.add(new THREE.Mesh(cardGeo, mat(palette[i] ?? 0xffffff)));
        card.add(new THREE.LineSegments(edgeGeo, edgeLine(0x93c5fd)));
        card.position.set(c.x, c.y, c.z);
        card.scale.setScalar(c.s);
        card.rotation.z = (i % 2 === 0 ? 1 : -1) * (0.09 + i * 0.02);
        group.add(card);
        floats.push({ obj: card, phase: i * 1.25, baseY: c.y });
      });

      // ==== Rute perjalanan: pin jemput (abu) → putus-putus → pin tujuan (biru) ====
      const makePin = (color: number, scale: number) => {
        const g = new THREE.Group();
        const head = new THREE.Mesh(geo(new THREE.SphereGeometry(0.32, 24, 24)), mat(color));
        head.position.y = 0.55;
        const tip = new THREE.Mesh(geo(new THREE.ConeGeometry(0.32, 0.66, 24)), mat(color));
        tip.rotation.x = Math.PI;
        tip.position.y = 0.06;
        g.add(head, tip);
        g.scale.setScalar(scale);
        return g;
      };
      const startPin = makePin(0x94a3b8, 0.75);
      startPin.position.set(-3.1, 2.1, 1.2);
      const endPin = makePin(0x2563eb, 1);
      endPin.position.set(3.0, 2.4, 1.4);
      group.add(startPin, endPin);

      const routePoints = [
        new THREE.Vector3(-3.1, 2.1, 1.2),
        new THREE.Vector3(-1.2, 3.1, 1.2),
        new THREE.Vector3(1.1, 3.3, 1.3),
        new THREE.Vector3(3.0, 2.4, 1.4),
      ];
      const routeGeo = geo(new THREE.BufferGeometry().setFromPoints(routePoints));
      const routeMat = new THREE.LineDashedMaterial({
        color: 0x2563eb,
        dashSize: 0.28,
        gapSize: 0.18,
        transparent: true,
        opacity: 0.85,
      });
      disposables.push(routeMat);
      const route = new THREE.Line(routeGeo, routeMat);
      route.computeLineDistances();
      group.add(route);

      // Cincin aksen lembut di belakang
      const ring = new THREE.Mesh(
        geo(new THREE.TorusGeometry(3.4, 0.045, 16, 80)),
        mat(0xbfdbfe, 0.6)
      );
      ring.position.z = -2.6;
      group.add(ring);

      scene.add(group);
      scene.add(new THREE.AmbientLight(0xffffff, 0.95));
      const key = new THREE.DirectionalLight(0xffffff, 1.5);
      key.position.set(4, 6, 6);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0x93c5fd, 0.7);
      rim.position.set(-6, -2, 4);
      scene.add(rim);

      // Parallax halus mengikuti pointer
      let targetX = 0;
      let targetY = 0;
      const onPointer = (e: PointerEvent) => {
        targetX = (e.clientX / window.innerWidth - 0.5) * 0.25;
        targetY = (e.clientY / window.innerHeight - 0.5) * 0.15;
      };
      window.addEventListener("pointermove", onPointer);

      const onResize = () => {
        const w = mount.clientWidth || 1;
        const h = mount.clientHeight || 1;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      const resizeObserver = new ResizeObserver(onResize);
      resizeObserver.observe(mount);

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const startedAt = performance.now();

      const tick = () => {
        const t = (performance.now() - startedAt) / 1000;
        for (const f of floats) {
          f.obj.position.y = f.baseY + Math.sin(t * 0.8 + f.phase) * 0.16;
          f.obj.rotation.y = Math.sin(t * 0.4 + f.phase) * 0.2;
        }
        endPin.position.y = 2.4 + Math.sin(t * 1.1) * 0.12;
        endPin.rotation.y = t * 0.5;
        ring.rotation.z = t * 0.08;
        group.rotation.y += (targetX - group.rotation.y) * 0.05;
        group.rotation.x += (targetY - group.rotation.x) * 0.05;
        renderer.render(scene, camera);
        if (!reduced) frame = requestAnimationFrame(tick);
      };
      tick();

      cleanup = () => {
        cancelAnimationFrame(frame);
        window.removeEventListener("pointermove", onPointer);
        resizeObserver.disconnect();
        renderer.dispose();
        for (const d of disposables) d.dispose();
        if (renderer.domElement.parentElement === mount) {
          mount.removeChild(renderer.domElement);
        }
      };
    })();

    return () => {
      disposed = true;
      if (cleanup) cleanup();
    };
  }, []);

  return <div ref={mountRef} className={className} aria-hidden />;
}
