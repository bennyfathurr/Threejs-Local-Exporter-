import * as THREE from 'three';
import { PLYExporter } from 'three/addons/exporters/PLYExporter.js';

export interface PlyExportOptions {
  binary?: boolean;
}

/**
 * Exports a THREE.Object3D hierarchy to PLY format (binary or ASCII).
 */
export function exportPly(
  root: THREE.Object3D,
  options?: PlyExportOptions
): Blob {
  const exporter = new PLYExporter();
  const binary = options?.binary ?? true;
  // Passing null avoids triggering requestAnimationFrame in headless/node environments
  const result = (exporter as unknown as { parse: (root: THREE.Object3D, onDone: null, options: unknown) => unknown }).parse(
    root,
    null,
    { binary }
  );

  if (binary) {
    const buffer = result instanceof DataView ? result.buffer : (result as ArrayBuffer);
    return new Blob([buffer as ArrayBuffer], { type: 'application/octet-stream' });
  } else {
    return new Blob([result as string], { type: 'text/plain' });
  }
}
