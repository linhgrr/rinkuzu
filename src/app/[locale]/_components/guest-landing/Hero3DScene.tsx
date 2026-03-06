'use client'

import React, { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Icosahedron, Points, PointMaterial } from '@react-three/drei'
import * as THREE from 'three'

function CameraRig({ children }: { children: React.ReactNode }) {
    const group = useRef<THREE.Group>(null)

    useFrame((state: any) => {
        if (!group.current) return
        const t = state.clock.getElapsedTime()
        group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, state.pointer.x * 0.2, 0.05)
        group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, -state.pointer.y * 0.1, 0.05)
        group.current.position.y = Math.sin(t * 0.5) * 0.1
    })

    return <group ref={group}>{children}</group>
}

function CoreNode() {
    const meshRef = useRef<THREE.Mesh>(null)

    useFrame(() => {
        if (!meshRef.current) return
        meshRef.current.rotation.x += 0.002
        meshRef.current.rotation.y += 0.003
    })

    return (
        <Icosahedron ref={meshRef} args={[1.5, 1]} position={[0, 0, 0]}>
            <meshStandardMaterial
                color="#818cf8"
                wireframe={true}
                transparent={true}
                opacity={0.4}
                emissive="#c084fc"
                emissiveIntensity={0.5}
            />
        </Icosahedron>
    )
}

function OrbitalParticles() {
    const pointsRef = useRef<THREE.Points>(null)
    const count = 300

    const positions = useMemo(() => {
        const p = new Float32Array(count * 3)
        for (let i = 0; i < count; i++) {
            const radius = 3 + Math.random() * 5
            const theta = Math.random() * 2 * Math.PI
            const phi = Math.acos(Math.random() * 2 - 1)
            p[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
            p[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
            p[i * 3 + 2] = radius * Math.cos(phi)
        }
        return p
    }, [count])

    useFrame(() => {
        if (!pointsRef.current) return
        pointsRef.current.rotation.y -= 0.001
        pointsRef.current.rotation.z += 0.0005
    })

    return (
        <Points ref={pointsRef} positions={positions} stride={3}>
            <PointMaterial
                transparent
                color="#c084fc"
                size={0.03}
                sizeAttenuation={true}
                depthWrite={false}
                opacity={0.6}
            />
        </Points>
    )
}

export function Hero3DScene() {
    return (
        <div className="absolute inset-0 w-full h-full pointer-events-none z-0">
            <Canvas
                camera={{ position: [0, 0, 8], fov: 45 }}
                dpr={[1, 2]}
                gl={{ alpha: true, antialias: true }}
            >
                <ambientLight intensity={0.5} />
                <directionalLight position={[10, 10, 5]} intensity={1} color="#ffffff" />
                <pointLight position={[-10, -10, -10]} intensity={0.5} color="#818cf8" />

                <CameraRig>
                    <CoreNode />
                    <OrbitalParticles />
                </CameraRig>
            </Canvas>
        </div>
    )
}
