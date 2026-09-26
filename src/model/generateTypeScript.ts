import * as THREE from 'three';
import { buildInventory } from './inventory';

/**
 * Decompiles a live THREE.Object3D scene hierarchy into clean, executable Three.js TypeScript code.
 */
export function generateModelTypeScript(
  root: THREE.Object3D,
  customName?: string
): string {
  const { stats } = buildInventory(root);
  const cleanRootName = (customName || root.name || 'Custom_Procedural_Model')
    .replace(/[^a-zA-Z0-9_]/g, '_');

  const lines: string[] = [];
  lines.push("import * as THREE from 'three';");
  lines.push('');
  lines.push('/**');
  lines.push(` * Procedural Model: ${cleanRootName}`);
  lines.push(' * Generated from Three.js Model Studio');
  lines.push(` * Metrics: ${stats.meshCount} meshes, ${stats.totalTriangles.toLocaleString()} triangles, ${stats.materialCount} materials`);
  lines.push(' */');
  lines.push('export function createModel(spec?: Record<string, unknown>, options?: Record<string, unknown>): THREE.Group {');
  lines.push('  const root = new THREE.Group();');
  lines.push(`  root.name = ${JSON.stringify(cleanRootName)};`);
  lines.push('');

  // Collect unique materials
  const materialMap = new Map<THREE.Material, string>();
  let matCounter = 1;

  root.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      const mesh = obj as THREE.Mesh;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        if (m && !materialMap.has(m)) {
          const varName = `mat_${(m.name || `material_${matCounter++}`)
            .replace(/[^a-zA-Z0-9_]/g, '_')}`;
          materialMap.set(m, varName);
        }
      }
    }
  });

  // Declare Materials
  if (materialMap.size > 0) {
    lines.push('  // --- Shared Materials ---');
    for (const [mat, varName] of materialMap.entries()) {
      const m = mat as THREE.MeshStandardMaterial;
      const type = m.type || 'MeshStandardMaterial';
      const colorHex = m.color ? `0x${m.color.getHexString()}` : '0xcccccc';

      const props: string[] = [];
      if (m.name) props.push(`name: ${JSON.stringify(m.name)}`);
      props.push(`color: ${colorHex}`);
      if (m.roughness !== undefined && m.roughness !== 1.0) props.push(`roughness: ${Number(m.roughness.toFixed(2))}`);
      if (m.metalness !== undefined && m.metalness !== 0.0) props.push(`metalness: ${Number(m.metalness.toFixed(2))}`);
      if (m.transparent) {
        props.push('transparent: true');
        if (m.opacity !== undefined && m.opacity < 1.0) props.push(`opacity: ${Number(m.opacity.toFixed(2))}`);
      }
      if (m.wireframe) props.push('wireframe: true');
      if (m.side === THREE.DoubleSide) props.push('side: THREE.DoubleSide');

      lines.push(`  const ${varName} = new THREE.${type}({ ${props.join(', ')} });`);
    }
    lines.push('');
  }

  // Traverse hierarchy and generate objects
  lines.push('  // --- Scene Graph Hierarchy ---');
  let nodeCounter = 1;

  const processNode = (node: THREE.Object3D, parentVar: string) => {
    // Skip root itself in recursion
    for (const child of node.children) {
      if (child.userData?.isEditorHelper || child.name?.startsWith('__helper_')) {
        continue;
      }

      const childVar = `node_${nodeCounter++}`;
      const childName = child.name || `Part_${nodeCounter}`;

      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const geoCode = generateGeometryCode(mesh.geometry);
        const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
        const matVar = mat ? (materialMap.get(mat) || 'new THREE.MeshStandardMaterial()') : 'new THREE.MeshStandardMaterial()';

        lines.push(`  const ${childVar} = new THREE.Mesh(${geoCode}, ${matVar});`);
      } else {
        lines.push(`  const ${childVar} = new THREE.Group();`);
      }

      lines.push(`  ${childVar}.name = ${JSON.stringify(childName)};`);

      // Transforms
      if (child.position.x !== 0 || child.position.y !== 0 || child.position.z !== 0) {
        const p = child.position;
        lines.push(`  ${childVar}.position.set(${Number(p.x.toFixed(3))}, ${Number(p.y.toFixed(3))}, ${Number(p.z.toFixed(3))});`);
      }
      if (child.rotation.x !== 0 || child.rotation.y !== 0 || child.rotation.z !== 0) {
        const r = child.rotation;
        lines.push(`  ${childVar}.rotation.set(${Number(r.x.toFixed(3))}, ${Number(r.y.toFixed(3))}, ${Number(r.z.toFixed(3))});`);
      }
      if (child.scale.x !== 1 || child.scale.y !== 1 || child.scale.z !== 1) {
        const s = child.scale;
        lines.push(`  ${childVar}.scale.set(${Number(s.x.toFixed(3))}, ${Number(s.y.toFixed(3))}, ${Number(s.z.toFixed(3))});`);
      }
      if (!child.visible) {
        lines.push(`  ${childVar}.visible = false;`);
      }

      lines.push(`  ${parentVar}.add(${childVar});`);

      // Recursively process children
      if (child.children.length > 0) {
        processNode(child, childVar);
      }
    }
  };

  processNode(root, 'root');

  lines.push('');
  lines.push('  return root;');
  lines.push('}');
  lines.push('');
  lines.push('export default createModel;');
  lines.push('');

  return lines.join('\n');
}

/**
 * Converts a Three.js BufferGeometry to its instantiation code.
 */
function generateGeometryCode(geo: THREE.BufferGeometry): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params = (geo as any).parameters;

  if (geo.type === 'BoxGeometry' && params) {
    return `new THREE.BoxGeometry(${params.width}, ${params.height}, ${params.depth})`;
  }
  if (geo.type === 'CylinderGeometry' && params) {
    return `new THREE.CylinderGeometry(${params.radiusTop}, ${params.radiusBottom}, ${params.height}, ${params.radialSegments || 16})`;
  }
  if (geo.type === 'SphereGeometry' && params) {
    return `new THREE.SphereGeometry(${params.radius}, ${params.widthSegments || 16}, ${params.heightSegments || 16})`;
  }
  if (geo.type === 'ConeGeometry' && params) {
    return `new THREE.ConeGeometry(${params.radius}, ${params.height}, ${params.radialSegments || 16})`;
  }
  if (geo.type === 'TorusGeometry' && params) {
    return `new THREE.TorusGeometry(${params.radius}, ${params.tube}, ${params.radialSegments || 12}, ${params.tubularSegments || 24})`;
  }
  if (geo.type === 'PlaneGeometry' && params) {
    return `new THREE.PlaneGeometry(${params.width}, ${params.height})`;
  }
  if (geo.type === 'CapsuleGeometry' && params) {
    return `new THREE.CapsuleGeometry(${params.radius}, ${params.length}, ${params.capSegments || 4}, ${params.radialSegments || 8})`;
  }

  // Fallback: Check bounding box dimensions to create a fitting proxy geometry if custom buffer
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  if (bb) {
    const size = new THREE.Vector3();
    bb.getSize(size);
    const w = Number((size.x || 1).toFixed(2));
    const h = Number((size.y || 1).toFixed(2));
    const d = Number((size.z || 1).toFixed(2));
    return `new THREE.BoxGeometry(${w}, ${h}, ${d})`;
  }

  return 'new THREE.BoxGeometry(1, 1, 1)';
}
