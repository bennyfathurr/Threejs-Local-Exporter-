import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { executeProceduralCode } from './codeRunner';

export interface ModelPreset {
  id: string;
  name: string;
  category: 'Architectural' | 'Industrial' | 'Mechanical' | 'User Generated';
  description: string;
  defaultSpec?: unknown;
  factory: (spec?: unknown, options?: unknown) => THREE.Object3D;
}

// Automatically discover all factory modules in src/generated/ via Vite glob
const generatedModules = import.meta.glob('../generated/**/*.{ts,js}', { eager: true }) as Record<
  string,
  Record<string, unknown>
>;

export function getDiscoveredPresets(): ModelPreset[] {
  const presets: ModelPreset[] = [];

  for (const [filePath, mod] of Object.entries(generatedModules)) {
    const filename = filePath.split('/').pop()?.replace(/\.(ts|js)$/, '') || 'model';
    const factoryFn =
      (typeof mod.createModel === 'function' && mod.createModel) ||
      (typeof mod.default === 'function' && mod.default) ||
      (typeof mod.generateModel === 'function' && mod.generateModel);

    if (factoryFn) {
      const formattedName = filename
        .replace(/([A-Z])/g, ' $1')
        .replace(/_/g, ' ')
        .trim();

      presets.push({
        id: filename.toLowerCase(),
        name: formattedName.charAt(0).toUpperCase() + formattedName.slice(1),
        category: filename.includes('drone') ? 'Industrial' : 'Architectural',
        description: `Factory from ${filePath}`,
        factory: (spec, opt) => (factoryFn as (s?: unknown, o?: unknown) => THREE.Object3D)(spec, opt),
      });
    }
  }

  return presets;
}

export const PRESETS: ModelPreset[] = getDiscoveredPresets();

/**
 * Executes raw TypeScript or JavaScript procedural model code in the browser.
 */
export function loadModelFromCode(
  code: string,
  spec: unknown = {},
  options: unknown = {}
): THREE.Object3D {
  const result = executeProceduralCode(code, spec, options);
  return result.model;
}

/**
 * Loads a procedural model from a user-uploaded .ts or .js file.
 */
export async function loadModelFromTsJsFile(
  file: File,
  spec: unknown = {},
  options: unknown = {}
): Promise<THREE.Object3D> {
  const text = await file.text();
  const result = executeProceduralCode(text, spec, options);
  if (!result.model.name || result.model.name === 'Custom_Procedural_Model') {
    result.model.name = file.name.replace(/\.[^/.]+$/, '');
  }
  return result.model;
}

/**
 * Loads a 3D model from a GLB/glTF file.
 */
export async function loadGlbFromFile(file: File): Promise<THREE.Group> {
  const buffer = await file.arrayBuffer();
  const loader = new GLTFLoader();

  return new Promise<THREE.Group>((resolve, reject) => {
    loader.parse(
      buffer,
      '',
      (gltf) => {
        const root = gltf.scene;
        root.name = file.name.replace(/\.[^/.]+$/, '');
        resolve(root);
      },
      (error) => {
        reject(error);
      }
    );
  });
}
