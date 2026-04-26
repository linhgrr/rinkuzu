'use client';

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import MascotModel from './MascotModel';

export default function DashboardMascot3D() {
  return (
    <Canvas camera={{ position: [0, 0, 5], fov: 45 }} className="h-full w-full" dpr={[1, 2]}>
      <ambientLight intensity={0.8} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <directionalLight position={[-10, 10, -5]} intensity={0.5} />
      <Environment files="/hdri/potsdamer_platz_1k.hdr" />
      <Suspense fallback={null}>
        <MascotModel />
      </Suspense>
    </Canvas>
  );
}
