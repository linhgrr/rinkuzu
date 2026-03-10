'use client';

import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, Float } from '@react-three/drei';
import * as THREE from 'three';

export default function MascotModel() {
    const { scene } = useGLTF('/models/base_basic_pbr.glb');
    const groupRef = useRef<THREE.Group>(null);

    // Track mouse globally across the whole screen
    const target = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            // Normalize to -1 to 1 based on window width/height
            target.current.x = (e.clientX / window.innerWidth) * 2 - 1;
            target.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    useFrame(() => {
        if (groupRef.current) {
            // Add slight offset for natural look (-0.1y)
            const targetRotationY = target.current.x * 0.8 - 0.1;
            const targetRotationX = target.current.y * -0.5;

            groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotationY, 0.1);
            groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, targetRotationX, 0.1);
        }
    });

    return (
        <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
            <group ref={groupRef}>
                <primitive object={scene} scale={1.5} position={[0, -1.2, 0]} />
            </group>
        </Float>
    );
}
