// Loads the CAD-derived part models (public/models/*.json, built by
// tools/build-models.mjs from the KiSwitch library) and instances them.
// One fetch per model per session; one InstancedMesh per model part, so an
// 84-key board is a handful of draw calls, not hundreds.

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";

export type ModelName = "switch-mx" | "switch-choc" | "hotswap-mx" | "hotswap-choc" | "stab-2u" | "stab-6u";

interface Part {
  geometry: THREE.BufferGeometry;
  material: THREE.MeshStandardMaterial;
}

interface RawPart {
  color: string;
  metalness: number;
  roughness: number;
  position: string;
  index: string;
}

const cache = new Map<ModelName, Promise<Part[]>>();

const decode = <T extends Float32Array | Uint32Array>(b64: string, Kind: new (b: ArrayBuffer) => T): T => {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Kind(bytes.buffer);
};

function load(name: ModelName): Promise<Part[]> {
  let p = cache.get(name);
  if (!p) {
    p = fetch(`/models/${name}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`model ${name}: ${r.status}`);
        return r.json() as Promise<{ parts: RawPart[] }>;
      })
      .then(({ parts }) =>
        parts.map((raw) => {
          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute("position", new THREE.BufferAttribute(decode(raw.position, Float32Array), 3));
          geometry.setIndex(new THREE.BufferAttribute(decode(raw.index, Uint32Array), 1));
          geometry.computeVertexNormals();
          return {
            geometry,
            material: new THREE.MeshStandardMaterial({
              color: raw.color,
              metalness: raw.metalness,
              roughness: raw.roughness,
            }),
          };
        }),
      );
    cache.set(name, p);
  }
  return p;
}

export function useModel(name: ModelName): Part[] | null {
  const [parts, setParts] = useState<Part[] | null>(null);
  useEffect(() => {
    let live = true;
    load(name)
      .then((p) => live && setParts(p))
      .catch(() => live && setParts([]));
    return () => {
      live = false;
    };
  }, [name]);
  return parts;
}

export interface Placement {
  x: number;
  y: number;
  z: number;
  /** Rotation about the vertical axis, radians. */
  ry?: number;
}

/** Every part of a model, drawn once per placement. */
export function Instanced({ name, at }: { name: ModelName; at: Placement[] }) {
  const parts = useModel(name);
  const matrices = useMemo(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const one = new THREE.Vector3(1, 1, 1);
    return at.map((p) => m.clone().compose(new THREE.Vector3(p.x, p.y, p.z), q.clone().setFromAxisAngle(up, p.ry ?? 0), one));
  }, [at]);

  if (!parts || at.length === 0) return null;
  return (
    <>
      {parts.map((part, i) => (
        <instancedMesh
          // Remount when the count changes: an InstancedMesh's capacity is fixed.
          key={`${i}-${at.length}`}
          args={[part.geometry, part.material, at.length]}
          castShadow
          receiveShadow
          ref={(mesh) => {
            if (!mesh) return;
            matrices.forEach((mx, j) => mesh.setMatrixAt(j, mx));
            mesh.instanceMatrix.needsUpdate = true;
            mesh.computeBoundingSphere();
          }}
        />
      ))}
    </>
  );
}
