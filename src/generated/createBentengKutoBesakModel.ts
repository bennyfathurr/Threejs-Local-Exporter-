import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface BentengKutoBesakSpec {
  scale?: number;
  showRiverSettlement?: boolean;
  showInnerVegetation?: boolean;
  showCannons?: boolean;
  waterColor?: number;
}

/**
 * MODELING_ASSUMPTIONS
 * The supplied production sheet is illustrative rather than a measured survey.
 * Units are proposed metres: the display base is 320 X by 270 Z. -Z is the
 * river-facing entrance, +Z is inland, and Y is up. The fort is centered on X.
 * The three portal openings, wall outline, courtyard roof masses and river
 * placement follow the sheet; small architectural details are interpretive.
 */
function material(name: string, color: number, roughness = 0.82, metalness = 0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ name, color, roughness, metalness, side: THREE.DoubleSide });
}

function box(name: string, w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.name = name;
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function outlinedSlab(name: string, points: [number, number][], bottom: number, height: number, mat: THREE.Material, bevel = 0): THREE.Mesh {
  const shape = new THREE.Shape();
  points.forEach(([x, z], i) => i ? shape.lineTo(x, -z) : shape.moveTo(x, -z));
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 12 });
  geometry.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.name = name;
  mesh.position.y = bottom;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

type BlockSpec = [width: number, height: number, depth: number, x: number, y: number, z: number];
function repeatedBlocks(name: string, specs: BlockSpec[], mat: THREE.Material): THREE.Mesh {
  const parts = specs.map(([w,h,d,x,y,z]) => {
    const part = new THREE.BoxGeometry(w,h,d); part.translate(x,y,z); return part;
  });
  const geometry = mergeGeometries(parts, false);
  // The source boxes are temporary; only the combined geometry is retained.
  parts.forEach(part => part.dispose());
  if (!geometry) throw new Error(`Cannot create repeated detail geometry: ${name}`);
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.name = name; mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}

function hippedRoof(name: string, width: number, depth: number, height: number, mat: THREE.Material): THREE.Mesh {
  const w = width / 2, d = depth / 2, r = width * 0.28;
  const p = [
    [-w, 0, d], [w, 0, d], [r, height, 0], [-r, height, 0],
    [w, 0, -d], [-w, 0, -d],
  ];
  const faces = [[0,1,2],[0,2,3],[4,5,3],[4,3,2],[1,4,2],[5,0,3]];
  const data: number[] = [];
  faces.forEach(f => f.forEach(i => data.push(...p[i])));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(data, 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.name = name;
  mesh.castShadow = true;
  return mesh;
}

function tube(name: string, points: THREE.Vector3[], radius: number, mat: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), Math.max(12, points.length * 4), radius, 8, false), mat);
  mesh.name = name;
  mesh.castShadow = true;
  return mesh;
}

function archOpening(shape: THREE.Shape, x: number, radius: number, spring: number): void {
  const path = new THREE.Path();
  path.moveTo(x - radius, 0.08);
  path.lineTo(x - radius, spring);
  path.absarc(x, spring, radius, Math.PI, 0, true);
  path.lineTo(x + radius, 0.08);
  path.closePath();
  shape.holes.push(path);
}

function gateway(m: ReturnType<typeof makeMaterials>): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Main_Gateway_Lawang_Kuto_Besak';
  const outline = new THREE.Shape();
  outline.moveTo(-15, 0); outline.lineTo(15, 0); outline.lineTo(15, 8.5); outline.lineTo(-15, 8.5); outline.closePath();
  archOpening(outline, -8.1, 1.65, 3.5);
  archOpening(outline, 0, 3.15, 4.4);
  archOpening(outline, 8.1, 1.65, 3.5);
  const geometry = new THREE.ExtrudeGeometry(outline, { depth: 5.2, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.12, bevelSegments: 2, curveSegments: 20 });
  geometry.translate(0, 0, -2.6);
  const portal = new THREE.Mesh(geometry, m.gateway);
  portal.name = 'Gate_Triple_Arch_Portal'; portal.castShadow = true; portal.receiveShadow = true;
  group.add(portal);
  for (const side of [-1, 1]) {
    group.add(box(`Gate_Flank_Pilaster_${side < 0 ? 'Left' : 'Right'}`, 1.1, 8.8, 5.55, m.trim, side * 14.1, 4.4));
    for (const x of [-8.1, 0, 8.1]) {
      const radius = x === 0 ? 3.15 : 1.65;
      const spring = x === 0 ? 4.4 : 3.5;
      const curve = new THREE.ArcCurve(x, spring, radius + 0.25, Math.PI, 0, true);
      const pts = curve.getPoints(24).map(p => new THREE.Vector3(p.x, p.y, side * 2.73));
      group.add(tube(`Arch_Surround_${x}_${side}`, pts, 0.18, m.trim));
    }
  }
  group.add(box('Gate_Entablature', 31, 0.55, 6.2, m.trim, 0, 8.75));
  const pediment = new THREE.Shape();
  pediment.moveTo(-12.5, 0); pediment.lineTo(12.5, 0); pediment.lineTo(0, 2.9); pediment.closePath();
  const pedimentGeometry = new THREE.ExtrudeGeometry(pediment, { depth: 5.7, bevelEnabled: true, bevelSize: 0.1, bevelThickness: 0.1, bevelSegments: 2 });
  pedimentGeometry.translate(0, 9.04, -2.85);
  const roof = new THREE.Mesh(pedimentGeometry, m.trim);
  roof.name = 'Gate_Pediment'; roof.castShadow = true; group.add(roof);
  const medallion = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.16, 20), m.accent);
  medallion.geometry.rotateX(Math.PI / 2);
  medallion.name = 'Gate_Sultanate_Crest_Medallion';
  medallion.position.set(0, 10.1, 2.96); group.add(medallion);
  return group;
}

function makeMaterials(waterColor?: number) {
  return {
    earth: new THREE.MeshStandardMaterial({ name: 'Earth_Base', color: 0x786b58, roughness: 0.9, emissive: 0x463a2b, emissiveIntensity: 0.45 }), grass: material('Grass', 0x819368),
    water: material('Musi_Water', waterColor ?? 0x4589a8, 0.28),
    wall: material('Fort_Limestone', 0xe9e5d7), coping: material('Fort_Coping', 0xd5d0c2),
    paving: material('Courtyard_Paving', 0xbaa992), gateway: material('Gateway_Stucco', 0xf5f1e7),
    trim: material('Gateway_Trim', 0xc4bead), accent: material('Gateway_Medallion', 0x9b8057, 0.5, 0.2),
    stucco: material('Building_Stucco', 0xe5d7bd), timber: material('Timber', 0x70513a),
    roof: material('Clay_Roof', 0xae694d), roofDark: material('Dark_Roof', 0x675e53),
    roofSeam: material('Roof_Tile_Seam', 0x805344), stoneJoint: material('Masonry_Joint', 0xbeb9ac),
    foliage: material('Foliage', 0x527549), foliageLight: material('Foliage_Light', 0x789453),
    trunk: material('Tree_Trunk', 0x67503d), metal: material('Iron', 0x484b48, 0.5, 0.55),
  };
}

function building(name: string, width: number, depth: number, height: number, roofMat: THREE.Material, m: ReturnType<typeof makeMaterials>): THREE.Group {
  const g = new THREE.Group(); g.name = name;
  g.add(box(`${name}_Plinth`, width + 1, 0.45, depth + 1, m.paving, 0, 0.225));
  g.add(box(`${name}_Walls`, width, height, depth, m.stucco, 0, 0.45 + height / 2));
  g.add(box(`${name}_Cornice`, width + 0.65, 0.34, depth + 0.65, m.trim, 0, height + 0.34));
  const roof = hippedRoof(`${name}_Limasan_Roof`, width + 2.2, depth + 2.2, Math.max(2.8, depth * 0.2), roofMat);
  roof.position.y = height + 0.55; g.add(roof);
  const roofHeight = Math.max(2.8, depth * 0.2);
  // Tile courses follow each sloping roof face. Repeated courses share one
  // named mesh per roof to keep the scene practical for browser rendering.
  const courseParts: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    for (let row = 1; row <= 3; row++) {
      const t = row / 4;
      const xHalf = (width + 2.2) * (1 - t) / 2 + width * 0.28 * t;
      const y = height + 0.55 + roofHeight * t + 0.07;
      const z = side * (depth + 2.2) * (1 - t) / 2;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-xHalf, y, z), new THREE.Vector3(0, y + 0.018, z), new THREE.Vector3(xHalf, y, z),
      ]);
      courseParts.push(new THREE.TubeGeometry(curve, 12, 0.055, 8, false));
    }
  }
  const courseGeometry = mergeGeometries(courseParts, false);
  courseParts.forEach(part => part.dispose());
  if (!courseGeometry) throw new Error(`Cannot create roof courses: ${name}`);
  const courses = new THREE.Mesh(courseGeometry, m.roofSeam);
  courses.name = `${name}_Roof_Tile_Courses`; courses.castShadow = true;
  g.add(courses);
  g.add(box(`${name}_Roof_Ridge_Cap`, width * 0.56, 0.22, 0.34, m.trim, 0, height + 0.55 + Math.max(2.8, depth * 0.2)));
  for (const side of [-1, 1]) {
    g.add(box(`${name}_Eave_Fascia_${side}`, width + 2.35, 0.19, 0.35, m.timber, 0, height + 0.58, side * (depth / 2 + 1.08)));
  }
  const bays = Math.max(3, Math.round(width / 6));
  const panes: BlockSpec[] = [], frames: BlockSpec[] = [], sills: BlockSpec[] = [];
  for (let i = 0; i < bays; i++) {
    const x = -width / 2 + (i + 0.5) * width / bays;
    panes.push([1.4,1.8,0.15,x,2.5,depth / 2 + 0.09], [1.4,1.8,0.15,x,2.5,-depth / 2 - 0.09]);
    frames.push([1.72,2.12,0.11,x,2.5,depth / 2 + 0.04], [1.72,2.12,0.11,x,2.5,-depth / 2 - 0.04]);
    sills.push([1.7,0.18,0.48,x,1.55,depth / 2 + 0.2]);
  }
  for (const side of [-1, 1]) for (const z of [-depth * 0.27, depth * 0.27]) {
    panes.push([0.15,1.8,1.45,side * (width / 2 + 0.09),2.5,z]);
    frames.push([0.1,2.12,1.76,side * (width / 2 + 0.04),2.5,z]);
  }
  g.add(repeatedBlocks(`${name}_Window_Panes`,panes,m.timber));
  g.add(repeatedBlocks(`${name}_Window_Frames`,frames,m.trim));
  g.add(repeatedBlocks(`${name}_Window_Sills`,sills,m.trim));
  for (const x of [-width * 0.27, width * 0.27]) {
    const post = box(`${name}_Veranda_Post`, 0.32, 3.1, 0.32, m.trim, x, 1.55, depth / 2 + 2.4);
    g.add(post);
  }
  g.add(box(`${name}_Veranda_Canopy`, width * 0.75, 0.3, 3.1, roofMat, 0, 3.2, depth / 2 + 1.7));
  const entry = new THREE.Group(); entry.name = `${name}_Entrance`;
  entry.add(box('Recessed_Door', 1.85, 2.7, 0.18, m.timber, 0, 1.8, depth / 2 + 0.11));
  entry.add(box('Door_Lintel', 2.5, 0.2, 0.43, m.trim, 0, 3.23, depth / 2 + 0.22));
  for (const side of [-1, 1]) {
    entry.add(box(`Door_Jamb_${side}`, 0.19, 2.8, 0.43, m.trim, side * 1.1, 1.83, depth / 2 + 0.22));
  }
  g.add(entry);
  return g;
}

function tree(name: string, radius: number, height: number, m: ReturnType<typeof makeMaterials>): THREE.Group {
  const g = new THREE.Group(); g.name = name;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.65, height * 0.55, 10), m.trunk);
  trunk.name = `${name}_Trunk`; trunk.position.y = height * 0.275; trunk.castShadow = true; g.add(trunk);
  const offsets: [number, number, number, number][] = [[0,0,0,1],[-0.53,0.02,0.12,0.68],[0.46,-0.04,0.24,0.7],[0.05,0.1,-0.48,0.7]];
  offsets.forEach(([x,y,z,s], i) => {
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(radius * s, 2), i % 2 ? m.foliageLight : m.foliage);
    crown.name = `${name}_Canopy_${i}`;
    crown.position.set(x * radius, height * (0.76 + y), z * radius); crown.scale.y = 0.68;
    crown.castShadow = true; g.add(crown);
  });
  return g;
}

function riverBoat(name: string, length: number, width: number, covered: boolean, m: ReturnType<typeof makeMaterials>): THREE.Group {
  const g = new THREE.Group(); g.name = name;
  const stations = [-0.5, -0.35, 0, 0.35, 0.5].map(v => v * length);
  const halfWidths = [0.09, 0.5, 0.55, 0.5, 0.09].map(v => v * width);
  const vertices: number[] = [];
  const tri = (a: number[], b: number[], c: number[]) => vertices.push(...a, ...b, ...c);
  for (let i = 0; i < stations.length - 1; i++) {
    const x0 = stations[i], x1 = stations[i + 1], w0 = halfWidths[i], w1 = halfWidths[i + 1];
    for (const side of [-1, 1]) {
      const top0 = [x0, 0.76, side * w0], top1 = [x1, 0.76, side * w1];
      const low0 = [x0, 0.12, side * w0 * 0.43], low1 = [x1, 0.12, side * w1 * 0.43];
      tri(top0, low0, top1); tri(top1, low0, low1);
    }
    tri([x0, 0.12, -w0 * 0.43], [x0, 0.12, w0 * 0.43], [x1, 0.12, -w1 * 0.43]);
    tri([x1, 0.12, -w1 * 0.43], [x0, 0.12, w0 * 0.43], [x1, 0.12, w1 * 0.43]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.computeVertexNormals();
  const hull = new THREE.Mesh(geometry, m.timber); hull.name = `${name}_Custom_Hull`; hull.castShadow = true; g.add(hull);
  for (const side of [-1, 1]) {
    g.add(tube(`${name}_Sheer_Rail_${side}`, stations.map((x,i) => new THREE.Vector3(x,0.79,side * halfWidths[i])),0.075,m.trim));
  }
  for (const x of [-length * 0.22, 0, length * 0.22]) {
    g.add(box(`${name}_Cross_Seat_${x}`,0.38,0.12,width * 0.74,m.trim,x,0.57));
  }
  if (covered) {
    const canopy = hippedRoof(`${name}_Canopy`,length * 0.48,width * 1.08,0.8,m.roofDark);
    canopy.position.y = 1.9; g.add(canopy);
    for (const x of [-length * 0.21,length * 0.21]) for (const side of [-1,1]) {
      g.add(box(`${name}_Canopy_Post_${x}_${side}`,0.09,1.4,0.09,m.timber,x,1.26,side * width * 0.4));
    }
  }
  return g;
}

function createBastion(
  name: string,
  cornerX: number,
  cornerZ: number,
  dirX: number,
  dirZ: number,
  m: ReturnType<typeof makeMaterials>,
  showCannons = true
): THREE.Group {
  const g = new THREE.Group();
  g.name = name;

  const wallH = 6.1;
  const poly: [number, number][] = [
    [cornerX, cornerZ - dirZ * 4.0],
    [cornerX + dirX * 11.0, cornerZ - dirZ * 4.0],
    [cornerX + dirX * 11.0, cornerZ + dirZ * 7.0],
    [cornerX + dirX * 7.0, cornerZ + dirZ * 11.0],
    [cornerX - dirX * 4.0, cornerZ + dirZ * 11.0],
    [cornerX - dirX * 4.0, cornerZ],
    [cornerX, cornerZ],
  ];

  // Bastion Solid Rampart Base
  const base = outlinedSlab(`${name}_Base`, poly, 0.19, wallH, m.wall, 0.08);
  g.add(base);

  // Bastion Coping Trim
  const coping = outlinedSlab(`${name}_Coping`, poly, 0.19 + wallH, 0.32, m.coping, 0.18);
  g.add(coping);

  // Bastion Parapet Walls along outer perimeter
  const parapetH = 1.1;
  const pFlank = box(`${name}_Parapet_Flank`, 0.8, parapetH, 13, m.wall, cornerX + dirX * 10.6, 0.19 + wallH + parapetH / 2, cornerZ + dirZ * 0.5);
  g.add(pFlank);
  const pFront = box(`${name}_Parapet_Front`, 13, parapetH, 0.8, m.wall, cornerX + dirX * 0.5, 0.19 + wallH + parapetH / 2, cornerZ + dirZ * 10.6);
  g.add(pFront);

  // Bastion Watch Pavilion (Pos Pengawas Bastion)
  const pavX = cornerX + dirX * 3.5;
  const pavZ = cornerZ + dirZ * 3.5;
  const pavW = 6.5;
  const pavD = 5.5;
  const pavH = 3.2;

  const pav = new THREE.Group();
  pav.name = `${name}_Watch_Pavilion`;
  pav.position.set(pavX, 0.19 + wallH, pavZ);

  // Pavilion Plinth
  pav.add(box(`${name}_Pavilion_Plinth`, pavW + 0.6, 0.3, pavD + 0.6, m.paving, 0, 0.15, 0));
  // Stucco walls
  pav.add(box(`${name}_Pavilion_Walls`, pavW, pavH, pavD, m.stucco, 0, 0.3 + pavH / 2, 0));
  // Cornice moulding
  pav.add(box(`${name}_Pavilion_Cornice`, pavW + 0.4, 0.25, pavD + 0.4, m.trim, 0, 0.3 + pavH + 0.12, 0));
  // Limasan Clay Roof
  const rHeight = 2.2;
  const roof = hippedRoof(`${name}_Pavilion_Limasan_Roof`, pavW + 1.8, pavD + 1.8, rHeight, m.roof);
  roof.position.y = 0.3 + pavH + 0.25;
  pav.add(roof);
  // Ridge cap
  pav.add(box(`${name}_Pavilion_Ridge_Cap`, pavW * 0.5, 0.2, 0.28, m.trim, 0, 0.3 + pavH + 0.25 + rHeight, 0));

  // Observation Windows
  pav.add(box(`${name}_Pavilion_Window_Flank`, 1.2, 1.4, 0.15, m.timber, dirX * (pavW / 2 + 0.05), 0.3 + pavH * 0.55, 0));
  pav.add(box(`${name}_Pavilion_Window_Front`, 0.15, 1.4, 1.2, m.timber, 0, 0.3 + pavH * 0.55, dirZ * (pavD / 2 + 0.05)));

  g.add(pav);

  // Bastion Artillery Cannons
  if (showCannons) {
    // Cannon 1: Salient gun pointing diagonally outward through salient angle
    const c1 = new THREE.Group();
    c1.name = `${name}_Cannon_Salient`;
    c1.position.set(cornerX + dirX * 7.5, 0.19 + wallH + 0.28, cornerZ + dirZ * 7.5);
    c1.rotation.y = Math.atan2(dirX, dirZ);
    c1.add(box(`${name}_Cannon_Salient_Carriage`, 1.4, 0.45, 0.9, m.timber, 0, 0.22, 0));
    const barrel1 = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.24, 2.0, 12), m.metal);
    barrel1.name = `${name}_Cannon_Salient_Barrel`;
    barrel1.rotation.x = Math.PI / 2;
    barrel1.position.set(0, 0.55, 0.3);
    barrel1.castShadow = true;
    c1.add(barrel1);
    g.add(c1);

    // Cannon 2: Flank gun pointing along curtain wall
    const c2 = new THREE.Group();
    c2.name = `${name}_Cannon_Flank`;
    c2.position.set(cornerX + dirX * 8.5, 0.19 + wallH + 0.28, cornerZ - dirZ * 1.0);
    c2.rotation.y = dirZ < 0 ? 0 : Math.PI;
    c2.add(box(`${name}_Cannon_Flank_Carriage`, 1.4, 0.45, 0.9, m.timber, 0, 0.22, 0));
    const barrel2 = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.24, 2.0, 12), m.metal);
    barrel2.name = `${name}_Cannon_Flank_Barrel`;
    barrel2.rotation.x = Math.PI / 2;
    barrel2.position.set(0, 0.55, 0.3);
    barrel2.castShadow = true;
    c2.add(barrel2);
    g.add(c2);
  }

  return g;
}

export function createModel(spec?: BentengKutoBesakSpec): THREE.Group {
  const root = new THREE.Group(); root.name = 'Benteng_Kuto_Besak_Root';
  root.userData.preferredViewDirection = [1, 0.7, -1]; // Look toward the river-facing gate.
  const m = makeMaterials(spec?.waterColor);
  const terrain = new THREE.Group(); terrain.name = 'Terrain_And_Water_Base'; root.add(terrain);
  terrain.add(box('Terrain_Underside_Base', 320, 1.2, 270, m.earth, 0, -0.6));
  terrain.add(box('Fort_Ground_Plinth', 320, 0.18, 198, m.grass, 0, 0.09, 36));
  terrain.add(box('Riverbank_Embankment', 320, 1.0, 3, m.paving, 0, 0.5, -64.5));
  terrain.add(box('Musi_River_Water', 320, 0.12, 55, m.water, 0, 0.03, -92.5));
  terrain.add(box('Opposite_Riverbank', 320, 0.22, 15, m.grass, 0, 0.11, -127.5));
  terrain.add(box('River_Stone_Edge', 320, 0.35, 1.2, m.trim, 0, 0.45, -66));
  // The bottom view remains a plain rectangular block, as drawn in the sheet.
  const fort = new THREE.Group(); fort.name = 'Fort_Defensive_Perimeter'; root.add(fort);
  const half = 117, front = 68, back = -57, wall = 3.1, wallHeight = 6.1;
  const wallSpan = (name: string, w: number, d: number, x: number, z: number) => {
    const part = new THREE.Group(); part.name = name;
    part.add(box(name, w, wallHeight, d, m.wall, 0, wallHeight / 2));
    part.add(box(`${name}_Coping`, w + 0.18, 0.32, d + 0.18, m.coping, 0, wallHeight + 0.16));
    part.position.set(x, 0.19, z); fort.add(part);
  };
  wallSpan('Wall_Flank_West_Span', wall, front - back, -half + wall / 2, (front + back) / 2);
  wallSpan('Wall_Flank_East_Span', wall, front - back, half - wall / 2, (front + back) / 2);
  // The three open arches occupy the river (-Z) wall. The triangular facade,
  // medallion, and arch surrounds rotate toward the water with the portal.
  const gateSpan = half - wall - 15;
  wallSpan('Wall_North_Rear_West_Span', gateSpan, wall, -15 - gateSpan / 2, back + wall / 2);
  wallSpan('Wall_North_Rear_East_Span', gateSpan, wall, 15 + gateSpan / 2, back + wall / 2);
  wallSpan('Wall_Front_West_Span', half - wall / 2, wall, -(half + wall / 2) / 2, front - wall / 2);
  wallSpan('Wall_Front_East_Span', half - wall / 2, wall, (half + wall / 2) / 2, front - wall / 2);
  const entrance = gateway(m);
  entrance.position.set(0, 0.19, back + wall / 2);
  entrance.rotation.y = Math.PI;
  fort.add(entrance);
  // Inner coping and short returns make wall thickness visible in plan.
  for (const side of [-1, 1]) {
    fort.add(box(`Rampart_Inner_Ledge_${side}`, 100, 0.2, 2.1, m.paving, side * 64, wallHeight - 0.1, back + 3.3));
    fort.add(box(`Corner_Return_${side}`, 4.5, wallHeight, 4.5, m.wall, side * (half - 2.25), wallHeight / 2 + 0.19, back + 2.25));
  }
  // Four corner bastions projecting outward from perimeter corners
  const bastionCorners = [
    { name: 'Bastion_River_West', x: -half, z: back, dirX: -1, dirZ: -1 },
    { name: 'Bastion_River_East', x: half, z: back, dirX: 1, dirZ: -1 },
    { name: 'Bastion_Inland_West', x: -half, z: front, dirX: -1, dirZ: 1 },
    { name: 'Bastion_Inland_East', x: half, z: front, dirX: 1, dirZ: 1 },
  ];
  bastionCorners.forEach(b => fort.add(createBastion(b.name, b.x, b.z, b.dirX, b.dirZ, m, spec?.showCannons !== false)));
  const grounds = new THREE.Group(); grounds.name = 'Courtyard_Grounds'; root.add(grounds);
  grounds.add(box('Avenue_Central_Promenade', 9, 0.1, 112, m.paving, 0, 0.29, 0));
  grounds.add(box('Avenue_Cross_Axis', 179, 0.1, 5, m.paving, 0, 0.29, -4));
  for (const side of [-1, 1]) {
    grounds.add(outlinedSlab(`Courtyard_Paving_${side}`, [[16 * side, 45],[98 * side,45],[98 * side,-42],[16 * side,-42]],0.23,0.09,m.paving));
    grounds.add(box(`Garden_Parterre_${side}`, 23, 0.15, 10, m.grass, side * 32, 0.36, 35));
  }
  const buildings = new THREE.Group(); buildings.name = 'Palace_Complex_Dalem_Kuto_Besak'; root.add(buildings);
  const place = (name: string, x: number, z: number, w: number, d: number, h: number, dark = false) => {
    const part = building(name, w, d, h, dark ? m.roofDark : m.roof, m);
    part.position.set(x, 0.28, z); buildings.add(part);
  };
  place('Dalem_Keraton_Main_Palace', 0, -22, 43, 23, 9.8);
  place('West_Pavilion_Gedung_Prajurit', -58, -15, 31, 19, 6.2);
  place('East_Pavilion_Gedung_Tamu', 58, -15, 31, 19, 6.2, true);
  place('North_Barracks_Gedung_Pusaka', 0, 48, 32, 11, 4.5, true);
  place('Courtyard_West_Annex', -87, 21, 23, 14, 4.9);
  place('Courtyard_East_Annex', 87, 21, 23, 14, 4.9, true);
  for (const side of [-1, 1]) {
    place(`River_Wall_Guardhouse_${side}`, side * 39, -43, 17, 9, 4.8, side > 0);
    place(`River_Wall_Store_${side}`, side * 88, -42, 19, 9, 4.5, side < 0);
    place(`Inner_Courtyard_Block_${side}`, side * 37, 27, 18, 11, 5.2, side < 0);
    place(`Inland_Courtyard_Block_${side}`, side * 68, 49, 19, 9, 4.6, side > 0);
  }
  const outside = new THREE.Group(); outside.name = 'Outside_Fort_Buildings'; root.add(outside);
  const outsidePlace = (name: string, x: number, z: number, w: number, d: number, dark: boolean) => {
    const part = building(name, w, d, 4.7 + (dark ? 0.45 : 0), dark ? m.roofDark : m.roof, m);
    part.position.set(x, 0.24, z); outside.add(part);
  };
  for (const side of [-1, 1]) {
    for (const [i,z] of [-38, -8, 22, 52].entries()) outsidePlace(`Outside_Side_Block_${side}_${i}`, side * 139, z, 12.5, 9.5, i % 2 === 0);
  }
  for (const [i,x] of [-94, -64, -31, 31, 64, 94].entries()) {
    outsidePlace(`Outside_Inland_Block_${i}`, x, i === 2 || i === 3 ? 113 : 95, 16, 11, i % 3 === 0);
  }
  const farBank = new THREE.Group(); farBank.name = 'Opposite_Riverbank_Houses'; root.add(farBank);
  if (spec?.showRiverSettlement !== false) for (const [i,x] of [-139, -76, -12, 53, 126].entries()) {
    const house = building(`Far_Bank_Stilt_House_${i}`, 10.5, 7.5, 4.0, i % 2 ? m.roofDark : m.roof, m);
    house.position.set(x, 2.25, -128);
    farBank.add(house);
    for (const side of [-1, 1]) for (const end of [-1, 1]) {
      farBank.add(box(`Far_Bank_Stilt_Post_${i}_${side}_${end}`, 0.3, 2.25, 0.3, m.timber,
        x + side * 4, 1.125, -128 + end * 2.9));
    }
  }
  const vegetation = new THREE.Group(); vegetation.name = 'Courtyard_Landscaping_Vegetation'; root.add(vegetation);
  if (spec?.showInnerVegetation !== false) {
    const locations: [number,number,number,number][] = [];
    for (const side of [-1, 1]) {
      for (const z of [-44, -18, 7, 33, 56]) locations.push([side * 107, z, 3.6, 7.3]);
      for (const x of [23, 52, 81]) {
        locations.push([side * x, -50, 3.2, 6.7]);
        locations.push([side * x, 59, 3.3, 6.8]);
      }
      for (const z of [2, 45]) locations.push([side * 26, z, 3.5, 7.0]);
      for (const z of [-51, 70, 118]) locations.push([side * 153, z, 3.2, 6.4]);
    }
    locations.forEach(([x,z,r,h], i) => { const t = tree(`Heritage_Tree_${i+1}`,r,h,m); t.position.set(x,0.2,z); vegetation.add(t); });
  }
  const settlement = new THREE.Group(); settlement.name = 'River_Settlement_Musi_Life'; root.add(settlement);
  if (spec?.showRiverSettlement !== false) {
    const positions: [number, number, number, number][] = [
      [-142,-87,0.1,8],[-116,-105,-0.17,9.5],[-92,-76,0.3,7.2],[-70,-99,-0.24,8.4],
      [-46,-110,0.16,10],[-24,-82,-0.37,7.6],[0,-104,0.23,9],[26,-79,-0.27,7.5],
      [49,-108,0.13,9.2],[75,-86,0.38,8.7],[99,-105,-0.2,9.8],[132,-79,0.24,7.8],
    ];
    positions.forEach(([x,z,r,length], i) => {
      const boat = riverBoat(`Perahu_Getek_${i+1}`, length, 1.9 + (i % 3) * 0.18, i % 4 === 1, m);
      boat.position.set(x, 0.06, z); boat.rotation.y = r; settlement.add(boat);
    });
  }
  const cannons = new THREE.Group(); cannons.name = 'Rampart_Cannons_Artillery'; root.add(cannons);
  if (spec?.showCannons !== false) {
    for (const x of [-84,-55,55,84]) {
      const base = box(`Rampart_Cannon_Carriage_${x}`,1.6,0.5,1,m.timber,x,6.6,-53);
      cannons.add(base);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.26,2.2,16),m.metal);
      barrel.name = `Rampart_Cannon_Barrel_${x}`; barrel.rotation.x = Math.PI / 2;
      barrel.position.set(x,7.05,-53.3); cannons.add(barrel);
    }
  }
  const helpers = new THREE.Group(); helpers.name = 'Helpers_And_Anchors'; root.add(helpers);
  const anchor = (name: string, x: number, y: number, z: number) => { const g = new THREE.Group(); g.name = name; g.position.set(x,y,z); helpers.add(g); };
  // AR ETNO-STEM Hotspot Anchors matching the 6 educational domains
  anchor('Anchor_BKB_01_Ethno_Sejarah_Keraton', 0, 10.5, 12);
  anchor('Anchor_BKB_02_Sains_Material_Tembok', 65, 7.8, -45);
  anchor('Anchor_BKB_03_Teknologi_Pertahanan_Gerbang', 0, 7.5, -47);
  anchor('Anchor_BKB_04_Rekayasa_Konstruksi_Bastion', -120, 7.5, -49);
  anchor('Anchor_BKB_05_Matematika_Ruang_Denah', 45, 1.6, 12);
  anchor('Anchor_BKB_06_Sains_Lingkungan_Sungai', 60, 1.5, -92);
  // Backward compatibility anchors
  anchor('Anchor_Main_Gateway_Lawang_Kuto_Besak', 0, 7.5, -47);
  anchor('Anchor_Palace_Courtyard', 0, 10.5, 12);
  anchor('Anchor_Musi_Riverfront', 60, 1.5, -92);
  anchor('Anchor_Corner_SW_Rampart', -120, 7.5, -49);
  root.scale.setScalar(spec?.scale ?? 1);
  return root;
}

export function createBentengKutoBesakModel(spec?: BentengKutoBesakSpec): THREE.Group {
  return createModel(spec);
}
export default createModel;
