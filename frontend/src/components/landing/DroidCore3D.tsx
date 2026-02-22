'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere, Line } from '@react-three/drei';
import * as THREE from 'three';

export default function DroidCore3D() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.15;
      groupRef.current.rotation.x = state.clock.elapsedTime * 0.05;
    }
  });

  const nodes = useMemo(() => {
    return Array.from({ length: 30 }).map(() => ({
      position: [
        (Math.random() - 0.5) * 6,
        (Math.random() - 0.5) * 6,
        (Math.random() - 0.5) * 6,
      ] as [number, number, number],
    }));
  }, []);

  return (
    <group ref={groupRef}>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      {nodes.map((node, i) => (
        <Sphere key={i} args={[0.06, 16, 16]} position={node.position}>
          <meshBasicMaterial color="#FF4D00" />
        </Sphere>
      ))}
      {nodes.slice(0, 20).map((node, i) => (
        <Line
          key={`line-${i}`}
          points={[node.position, nodes[i + 1].position]}
          color="#A1A1AA"
          lineWidth={1}
          opacity={0.2}
          transparent
        />
      ))}
    </group>
  );
}
