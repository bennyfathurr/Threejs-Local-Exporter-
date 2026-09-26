import * as THREE from 'three';
import { buildInventory, ModelSceneStats } from '../model/inventory';

export type ExportFormat = 'glb' | 'gltf' | 'json' | 'usdz' | 'obj' | 'stl' | 'ply';

export interface ValidationIssue {
  severity: 'info' | 'warning' | 'error';
  title: string;
  detail: string;
}

export interface ValidationReport {
  format: ExportFormat;
  scope: 'full' | 'subtree' | 'selectedOnly';
  targetName: string;
  stats: ModelSceneStats;
  canExport: boolean;
  issues: ValidationIssue[];
}

/**
 * Validates a cloned export tree against the chosen export format rules.
 */
export function validateExport(
  root: THREE.Object3D,
  format: ExportFormat,
  scope: 'full' | 'subtree' | 'selectedOnly'
): ValidationReport {
  const { stats } = buildInventory(root);
  const issues: ValidationIssue[] = [];

  // Check empty scene
  if (stats.meshCount === 0 && stats.skinnedMeshCount === 0) {
    issues.push({
      severity: 'error',
      title: 'No Renderable Meshes',
      detail: 'The selected export target does not contain any mesh geometry.',
    });
  }

  // Format-specific rules
  switch (format) {
    case 'json':
      issues.push({
        severity: 'info',
        title: 'Complete Three.js Project Scene',
        detail: 'Exports full Three.js Object3D scene hierarchy, geometries, materials, names, and transforms with 100% editable fidelity.',
      });
      break;

    case 'glb':
    case 'gltf':
      issues.push({
        severity: 'info',
        title: 'Full Hierarchy & PBR Preserved',
        detail: 'GLTF/GLB will export all separate nodes, transforms, materials, and pivot points cleanly.',
      });
      break;

    case 'usdz':
      // Apple USDZ constraints
      issues.push({
        severity: 'info',
        title: 'Apple AR / Quick Look Ready',
        detail: 'USDZ preserves separate named meshes and standard PBR materials for iOS & visionOS.',
      });

      // Check for non-standard shaders or materials
      root.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((m) => {
            if (m && m.type === 'ShaderMaterial') {
              issues.push({
                severity: 'warning',
                title: 'Custom Shader Detected',
                detail: `Part "${obj.name}" uses custom GLSL "${m.name}". USDZ requires standard PBR; approximate shading will be exported.`,
              });
            }
          });
        }
      });
      break;

    case 'obj':
      issues.push({
        severity: 'warning',
        title: 'Hierarchy & Animation Limitations',
        detail: 'Wavefront OBJ does not preserve skeletal skinning, morph targets, or nested pivot hierarchy. Separate part names are retained via "o" and "g" records.',
      });
      if (stats.skinnedMeshCount > 0) {
        issues.push({
          severity: 'warning',
          title: 'Skeletal Bones Ignored in OBJ',
          detail: 'Skinned meshes will be baked to their rest position as static geometry in OBJ export.',
        });
      }
      issues.push({
        severity: 'info',
        title: 'Companion MTL & ZIP',
        detail: 'A companion .mtl file with diffuse and specular colors will be generated and packaged into a .zip archive.',
      });
      break;

    case 'stl':
      issues.push({
        severity: 'warning',
        title: 'Geometry-Only Format',
        detail: 'STL does not store materials, textures, colors, or node hierarchies. Meshes are tessellated for 3D printing/manufacturing.',
      });
      break;

    case 'ply':
      issues.push({
        severity: 'info',
        title: 'Polygon Mesh Interchange',
        detail: 'PLY exports geometry with vertex normals and faces. Material shading is approximated or omitted.',
      });
      break;
  }

  // Check scale / dimensions
  const maxDimension = Math.max(...stats.boundingBox.size);
  if (maxDimension > 1000) {
    issues.push({
      severity: 'warning',
      title: 'Large Bounding Box',
      detail: `Model dimensions are large (${stats.boundingBox.size.map((v) => v.toFixed(1)).join(' x ')} units). Ensure appropriate unit scaling is chosen.`,
    });
  } else if (maxDimension < 0.01) {
    issues.push({
      severity: 'warning',
      title: 'Very Small Dimensions',
      detail: 'Model dimensions are sub-millimeter. Check if custom scale needs to be adjusted.',
    });
  }

  const canExport = !issues.some((issue) => issue.severity === 'error');

  return {
    format,
    scope,
    targetName: root.name || 'Exported_Model',
    stats,
    canExport,
    issues,
  };
}
