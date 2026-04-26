'use client';

import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, Float } from '@react-three/drei';
import * as THREE from 'three';

const MODEL_URL = '/models/base_basic_pbr.glb';

export default function MascotModel() {
  const { scene } = useGLTF(MODEL_URL);
  const groupRef = useRef<THREE.Group>(null);
  const target = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      target.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      target.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;
    const targetRotationY = target.current.x * 0.8 - 0.1;
    const targetRotationX = target.current.y * -0.5;
    group.rotation.y = THREE.MathUtils.lerp(group.rotation.y, targetRotationY, 0.1);
    group.rotation.x = THREE.MathUtils.lerp(group.rotation.x, targetRotationX, 0.1);
  });

  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
      <group ref={groupRef}>
        <primitive object={scene} scale={1.5} position={[0, -1.2, 0]} />
      </group>
    </Float>
  );
}

useGLTF.preload(MODEL_URL);
