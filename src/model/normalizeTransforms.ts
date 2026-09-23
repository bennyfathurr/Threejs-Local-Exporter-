import * as THREE from 'three';

export type UnitScale = 'meters' | 'centimeters' | 'millimeters' | 'inches' | 'feet' | 'custom';
export type UpAxis = 'Y_UP' | 'Z_UP';

export interface TransformOptions {
  centerModel?: boolean;
  groundBase?: boolean;
  unitScale?: UnitScale;
  customScaleFactor?: number;
  upAxis?: UpAxis;
}

const SCALE_FACTORS: Record<UnitScale, number> = {
  meters: 1.0,
  centimeters: 100.0,
  millimeters: 1000.0,
  inches: 39.3701,
  feet: 3.28084,
  custom: 1.0,
};

/**
 * Normalizes export transforms: centering, grounding base at Y=0,
 * scaling units, and converting coordinate orientation (Y-up to Z-up).
 */
export function normalizeTransforms(
  root: THREE.Object3D,
  options: TransformOptions
): THREE.Object3D {
  root.updateMatrixWorld(true);

  // 1. Calculate current bounding box
  const initialBox = new THREE.Box3().setFromObject(root);
  const center = new THREE.Vector3();
  initialBox.getCenter(center);

  // Create a wrapper container so hierarchy names and structures are untouched
  const container = new THREE.Group();
  container.name = 'Export_Root_Normalized';
  container.add(root);

  // 2. Center at origin
  if (options.centerModel) {
    root.position.x -= center.x;
    root.position.z -= center.z;
    if (!options.groundBase) {
      root.position.y -= center.y;
    }
  }

  // 3. Ground base at Y = 0
  if (options.groundBase) {
    const updatedBox = new THREE.Box3().setFromObject(root);
    root.position.y -= updatedBox.min.y;
  }

  // 4. Unit Scale
  const unit = options.unitScale || 'meters';
  const scaleMultiplier = unit === 'custom' ? (options.customScaleFactor ?? 1.0) : SCALE_FACTORS[unit];
  if (scaleMultiplier !== 1.0) {
    container.scale.setScalar(scaleMultiplier);
  }

  // 5. Up-Axis conversion (Three.js standard is Y-up; convert to Z-up if requested)
  if (options.upAxis === 'Z_UP') {
    // Rotate -90 degrees around X to bring Y-up into Z-up
    container.rotation.x = -Math.PI / 2;
  }

  container.updateMatrixWorld(true);
  return container;
}
