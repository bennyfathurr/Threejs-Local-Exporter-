import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { executeProceduralCode } from './codeRunner';

export interface ModelPreset {
  id: string;
  name: string;
  category: 'Architectural' | 'Industrial' | 'Mechanical' | 'User Generated';
  description: string;
  defaultSpec?: unknown;
  referenceImage?: string;
  sourceCode?: string;
  factory: (spec?: unknown, options?: unknown) => THREE.Object3D;
}

// Automatically discover all factory modules in src/generated/ via Vite glob
const generatedModules = import.meta.glob('../generated/**/*.{ts,js}', { eager: true }) as Record<
  string,
  Record<string, unknown>
>;

// Also discover raw source code for code inspection and editing
const rawSources = import.meta.glob('../generated/**/*.{ts,js}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export function getDiscoveredPresets(): ModelPreset[] {
  const presets: ModelPreset[] = [];

  for (const [filePath, mod] of Object.entries(generatedModules)) {
    const filename = filePath.split('/').pop()?.replace(/\.(ts|js)$/, '') || 'model';
    const factoryFn =
      (typeof mod.createModel === 'function' && mod.createModel) ||
      (typeof mod.default === 'function' && mod.default) ||
      (typeof mod.generateModel === 'function' && mod.generateModel);

    if (factoryFn) {
      let displayName = filename
        .replace(/^create/i, '')
        .replace(/model$/i, '')
        .replace(/([A-Z])/g, ' $1')
        .replace(/_/g, ' ')
        .trim();

      let referenceImage: string | undefined;

      if (filename.toLowerCase().includes('benteng')) {
        displayName = 'Benteng Kuto Besak (Palembang Heritage)';
        referenceImage = '/reference/benteng-kuto-besak-production-reference.png';
      } else if (filename.toLowerCase().includes('lakeside')) {
        displayName = 'Kambang Iwak (draft four-view study)';
        referenceImage = '/reference/kambang-iwak-production-reference.png';
      } else if (filename.toLowerCase().includes('drone')) {
        displayName = 'Autonomous Survey Drone';
      } else if (filename.toLowerCase().includes('ledeng')) {
        displayName = 'Menara Ledeng (Kantor Walikota Palembang)';
        referenceImage = '/reference/menara-ledeng-production-reference.png';
      } else if (filename.toLowerCase().includes('rumahdinas') || (filename.toLowerCase().includes('rumah') && filename.toLowerCase().includes('walikota'))) {
        displayName = 'Rumah Dinas Walikota Palembang';
        referenceImage = '/reference/rumah-dinas-walikota-production-reference.png';
      } else if (filename.toLowerCase().includes('vanderberj') || filename.toLowerCase().includes('vanderberg') || filename.toLowerCase().includes('gedungvander')) {
        displayName = 'Gedung Van der Berj (Palembang Heritage)';
        referenceImage = '/reference/gedung-van-der-berj-production-reference.png';
      } else if (filename.toLowerCase().includes('museum') || filename.toLowerCase().includes('smb') || filename.toLowerCase().includes('badaruddin')) {
        displayName = 'Museum Sultan Mahmud Badaruddin II (Palembang Heritage)';
        referenceImage = '/reference/museum-smb2-production-reference.png';
      } else if (filename.toLowerCase() === 'createmodel' || filename.toLowerCase().includes('villa')) {
        displayName = 'Modern Architectural Villa';
        referenceImage = '/reference/aerial_reference.jpg';
      }

      presets.push({
        id: filename.toLowerCase(),
        name: displayName,
        category: filename.includes('drone') ? 'Industrial' : 'Architectural',
        description: `Factory from ${filePath}`,
        referenceImage,
        sourceCode: rawSources[filePath] || '',
        factory: (spec, opt) => (factoryFn as (s?: unknown, o?: unknown) => THREE.Object3D)(spec, opt),
      });
    }
  }

  // Put Benteng Kuto Besak first in the list
  presets.sort((a, b) => {
    if (a.id.includes('benteng')) return -1;
    if (b.id.includes('benteng')) return 1;
    if (a.id.includes('lakeside')) return -1;
    if (b.id.includes('lakeside')) return 1;
    return 0;
  });

  return presets;
}

export const PRESETS: ModelPreset[] = getDiscoveredPresets();

export function getPresetSourceCode(id: string): string | undefined {
  const p = PRESETS.find((preset) => preset.id === id);
  return p?.sourceCode;
}

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
