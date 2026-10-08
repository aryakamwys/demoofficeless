"use client";

// Hero 3D ala SaaS modern (three.js murni — tanpa wrapper react): kartu
// klaim melayang + pin rute + cincin aksen, palet biru DESIGN.md. Ringan:
// geometri dasar, DPR dibatasi, animasi berhenti bila tab tak terlihat /
// reduced-motion, semua resource di-dispose saat unmount.
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
      camera.position.set(0, 0.4, 9);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.setSize(width, height);
      mount.appendChild(renderer.domElement);

      // ==== Objek: kartu klaim melayang (putih) + aksen biru ====
      const cards = new THREE.Group();
      const cardGeo = new THREE.BoxGeometry(1.6, 2.1, 0.06);
      const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.05 });
      const blueMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.4, metalness: 0.1 });
      const skyMat = new THREE.MeshStandardMaterial({ color: 0x93c5fd, roughness: 0.5 });

      const layout: Array<{ x: number; y: number; z: number; mat: ThreeType.Material; scale: number }> = [
        { x: -2.1, y: 0.5, z: -0.4, mat: whiteMat, scale: 0.85 },
        { x: 0, y: 0, z: 0.4, mat: whiteMat, scale: 1 },
        { x: 2.2, y: 0.7, z: -0.5, mat: whiteMat, scale: 0.8 },
        { x: -1.1, y: -1.5, z: 0.9, mat: skyMat, scale: 0.6 },
        { x: 1.3, y: -1.6, z: 1.1, mat: blueMat, scale: 0.55 },
      ];
      const floats: Array<{ mesh: ThreeType.Mesh; phase: number; baseY: number }> = [];
      layout.forEach((c, i) => {
        const mesh = new THREE.Mesh(cardGeo, c.mat);
        mesh.position.set(c.x, c.y, c.z);
        mesh.scale.setScalar(c.scale);
        mesh.rotation.z = (i % 2 === 0 ? 1 : -1) * (0.08 + i * 0.03);
        cards.add(mesh);
        floats.push({ mesh, phase: i * 1.3, baseY: c.y });
      });
      scene.add(cards);

      // Pin lokasi (drop-off) — motif perjalanan Grab
      const pin = new THREE.Group();
      const pinHead = new THREE.Mesh(
        new THREE.SphereGeometry(0.34, 24, 24),
        blueMat
      );
      pinHead.position.y = 0.55;
      const pinTip = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.7, 24), blueMat);
      pinTip.rotation.x = Math.PI;
      pinTip.position.y = 0.05;
      pin.add(pinHead, pinTip);
      pin.position.set(1.15, 2.2, 1.4);
      pin.scale.setScalar(0.9);
      scene.add(pin);

      // Cincin aksen lembut di belakang
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(3.2, 0.05, 16, 80),
        new THREE.MeshStandardMaterial({ color: 0xbfdbfe, roughness: 0.6 })
      );
      ring.position.z = -2.5;
      scene.add(ring);

      scene.add(new THREE.AmbientLight(0xffffff, 0.9));
      const key = new THREE.DirectionalLight(0xffffff, 1.4);
      key.position.set(4, 6, 6);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0x93c5fd, 0.6);
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
          f.mesh.position.y = f.baseY + Math.sin(t * 0.8 + f.phase) * 0.18;
          f.mesh.rotation.y = Math.sin(t * 0.4 + f.phase) * 0.22;
        }
        pin.position.y = 2.2 + Math.sin(t * 1.1) * 0.14;
        pin.rotation.y = t * 0.6;
        ring.rotation.z = t * 0.08;
        cards.rotation.y += (targetX - cards.rotation.y) * 0.05;
        cards.rotation.x += (targetY - cards.rotation.x) * 0.05;
        renderer.render(scene, camera);
        if (!reduced) frame = requestAnimationFrame(tick);
      };
      tick();

      cleanup = () => {
        cancelAnimationFrame(frame);
        window.removeEventListener("pointermove", onPointer);
        resizeObserver.disconnect();
        renderer.dispose();
        cardGeo.dispose();
        whiteMat.dispose();
        blueMat.dispose();
        skyMat.dispose();
        pinHead.geometry.dispose();
        pinTip.geometry.dispose();
        ring.geometry.dispose();
        (ring.material as ThreeType.Material).dispose();
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
