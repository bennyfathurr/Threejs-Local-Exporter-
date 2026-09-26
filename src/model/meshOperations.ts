import * as THREE from 'three';
import { ICONS } from '../ui/icons';

export type PrimitiveType =
  | 'box'
  | 'sphere'
  | 'cylinder'
  | 'cone'
  | 'torus'
  | 'plane'
  | 'capsule'
  | 'group';

export interface PrimitiveDefinition {
  type: PrimitiveType;
  label: string;
  icon: string;
  description: string;
}

export const PRIMITIVE_DEFINITIONS: PrimitiveDefinition[] = [
  { type: 'box', label: 'Cube / Box', icon: ICONS.box(16), description: 'Box mesh (1×1×1)' },
  { type: 'sphere', label: 'Sphere', icon: ICONS.sphere(16), description: 'UV Sphere mesh (r=0.7)' },
  { type: 'cylinder', label: 'Cylinder', icon: ICONS.cylinder(16), description: 'Cylinder mesh (r=0.5, h=1.5)' },
  { type: 'cone', label: 'Cone', icon: ICONS.cone(16), description: 'Cone mesh (r=0.6, h=1.5)' },
  { type: 'torus', label: 'Torus / Donut', icon: ICONS.torus(16), description: 'Torus ring mesh (r=0.6, tube=0.2)' },
  { type: 'plane', label: 'Plane', icon: ICONS.plane(16), description: 'Flat ground plane (2×2)' },
  { type: 'capsule', label: 'Capsule', icon: ICONS.capsule(16), description: 'Capsule pill mesh (r=0.4, h=0.8)' },
  { type: 'group', label: 'Empty Group', icon: ICONS.group(16), description: 'Folder group for organizing hierarchy' },
];

const MODERN_COLORS = [
  0x06b6d4, // Cyan
  0x6366f1, // Indigo
  0x10b981, // Emerald
  0xf59e0b, // Amber
  0xec4899, // Pink
  0x8b5cf6, // Purple
  0x38bdf8, // Sky Blue
  0xf97316, // Orange
  0x14b8a6, // Teal
  0xe11d48, // Rose
];

let colorIndex = 0;

/**
 * Generates a unique, clean name for a new object based on existing scene names.
 */
export function generateUniqueName(base: string, root?: THREE.Object3D): string {
  if (!root) {
    return `${base}_1`;
  }
  const existingNames = new Set<string>();
  root.traverse((node) => {
    if (node.name) existingNames.add(node.name);
  });

  let index = 1;
  while (existingNames.has(`${base}_${index}`)) {
    index++;
  }
  return `${base}_${index}`;
}

/**
 * Creates a new Three.js mesh or group for the specified primitive type.
 */
export function createPrimitiveObject(type: PrimitiveType, name?: string): THREE.Object3D {
  if (type === 'group') {
    const group = new THREE.Group();
    group.name = name || 'Group_1';
    return group;
  }

  let geom: THREE.BufferGeometry;
  let defaultY = 0.5;

  switch (type) {
    case 'box':
      geom = new THREE.BoxGeometry(1, 1, 1);
      defaultY = 0.5;
      break;
    case 'sphere':
      geom = new THREE.SphereGeometry(0.7, 32, 16);
      defaultY = 0.7;
      break;
    case 'cylinder':
      geom = new THREE.CylinderGeometry(0.5, 0.5, 1.5, 32);
      defaultY = 0.75;
      break;
    case 'cone':
      geom = new THREE.ConeGeometry(0.6, 1.5, 32);
      defaultY = 0.75;
      break;
    case 'torus':
      geom = new THREE.TorusGeometry(0.6, 0.2, 16, 32);
      geom.rotateX(Math.PI / 2); // Lay flat horizontally
      defaultY = 0.2;
      break;
    case 'plane':
      geom = new THREE.PlaneGeometry(2, 2);
      geom.rotateX(-Math.PI / 2); // Horizontal ground orientation
      defaultY = 0.01;
      break;
    case 'capsule':
      geom = new THREE.CapsuleGeometry(0.4, 0.8, 16, 32);
      defaultY = 0.8;
      break;
    default:
      geom = new THREE.BoxGeometry(1, 1, 1);
      defaultY = 0.5;
      break;
  }

  geom.computeVertexNormals();

  const color = MODERN_COLORS[colorIndex % MODERN_COLORS.length];
  colorIndex++;

  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.35,
    metalness: 0.15,
  });

  const mesh = new THREE.Mesh(geom, mat);
  mesh.name = name || (type.charAt(0).toUpperCase() + type.slice(1) + '_1');
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.set(0, defaultY, 0);

  return mesh;
}

export interface ObjectHierarchyLocation {
  parent: THREE.Object3D;
  index: number;
}

/**
 * Detaches an object from its parent and remembers its position in children array.
 */
export function detachObject(object: THREE.Object3D): ObjectHierarchyLocation | null {
  const parent = object.parent;
  if (!parent) return null;
  const index = parent.children.indexOf(object);
  parent.remove(object);
  parent.updateMatrixWorld(true);
  return { parent, index: index >= 0 ? index : parent.children.length };
}

/**
 * Re-attaches an object to a parent, optionally at the exact child index.
 */
export function attachObjectAt(
  object: THREE.Object3D,
  parent: THREE.Object3D,
  index?: number
): void {
  if (object.parent) {
    object.parent.remove(object);
  }
  if (typeof index === 'number' && index >= 0 && index <= parent.children.length) {
    parent.children.splice(index, 0, object);
    object.parent = parent;
    object.dispatchEvent({ type: 'added' });
  } else {
    parent.add(object);
  }
  parent.updateMatrixWorld(true);
}
