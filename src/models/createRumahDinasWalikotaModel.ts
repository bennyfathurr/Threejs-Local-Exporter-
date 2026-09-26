import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface RumahDinasWalikotaSpec {
  scale?: number;
  showGardens?: boolean;
  showFenceAndGates?: boolean;
  showStreetProps?: boolean;
  showVehicles?: boolean;
}

/**
 * MODELING_ASSUMPTIONS
 * Units are in proposed metres matching the reference sheet:
 * - Base plinth: 250 m (width, X) by 160 m (depth, Z).
 * - Total building height: ~15.0 m to the main central roof ridge apex.
 * - Y is Up; (0, 0, 0) is ground level centered in the residence compound.
 * - Architecture: Official residence complex of the Mayor of Palembang (Rumah Dinas Walikota).
 *   - Grand projecting front Porte-Cochère / Pendopo pavilion with monumental colonnade and North-South hipped roof.
 *   - 2-story main central core with monumental hipped terracotta roof (~15m peak) oriented East-West.
 *   - Flanking East and West colonial wings with tiered hipped roofs and ribbon clerestory windows.
 *   - Two Palembang-style tiered Pavilion Gateways (Gerbang Masuk Barat & Gerbang Keluar Timur).
 *   - Perimeter white masonry and wrought-iron compound fence.
 *   - Expansive horseshoe ceremonial driveway court with central ceremonial flagpole flying the Merah Putih.
 *   - Garden planting and palms are illustrative placements inferred from the small reference render.
 */

function material(name: string, color: number, roughness = 0.8, metalness = 0, transparent = false, opacity = 1.0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ name, color, roughness, metalness, side: THREE.DoubleSide, transparent, opacity });
}

function box(name: string, w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.name = name;
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function cylinder(name: string, rt: number, rb: number, h: number, seg: number, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  mesh.name = name;
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

type BlockSpec = [width: number, height: number, depth: number, x: number, y: number, z: number];
function repeatedBoxes(name: string, specs: BlockSpec[], mat: THREE.Material): THREE.Mesh {
  const parts = specs.map(([w, h, d, x, y, z]) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    geo.translate(x, y, z);
    return geo;
  });
  const merged = mergeGeometries(parts, false);
  parts.forEach(p => p.dispose());
  if (!merged) throw new Error(`Failed to merge geometries for ${name}`);
  const mesh = new THREE.Mesh(merged, mat);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Creates custom Hipped Roof with ridge along East-West (X-axis)
 */
function hippedRoofX(name: string, width: number, depth: number, height: number, mat: THREE.Material, ridgeRatio = 0.5): THREE.Mesh {
  const hw = width / 2, hd = depth / 2, hr = hw * ridgeRatio;
  const pts = [
    [-hw, 0, hd], [hw, 0, hd], [hw, 0, -hd], [-hw, 0, -hd],
    [-hr, height, 0], [hr, height, 0]
  ];
  const vertices: number[] = [];
  pts.forEach(p => vertices.push(...p));
  const indices = [
    0, 1, 5,  0, 5, 4,
    1, 2, 5,
    2, 3, 4,  2, 4, 5,
    3, 0, 4
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Creates custom Hipped Roof with ridge along North-South (Z-axis)
 * Faithfully matches the front projecting pavilion / porte-cochere in the reference sheet.
 */
function hippedRoofZ(name: string, width: number, depth: number, height: number, mat: THREE.Material, ridgeRatio = 0.5): THREE.Mesh {
  const hw = width / 2, hd = depth / 2, hr = hd * ridgeRatio;
  const pts = [
    [-hw, 0, hd], [hw, 0, hd], [hw, 0, -hd], [-hw, 0, -hd],
    [0, height, hr], [0, height, -hr]
  ];
  const vertices: number[] = [];
  pts.forEach(p => vertices.push(...p));
  const indices = [
    0, 1, 4,
    1, 2, 5,  1, 5, 4,
    2, 3, 5,
    3, 0, 4,  3, 4, 5
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** A shallow raised terracotta tile field following a hipped roof's true planes. */
function detailHippedRoof(
  roof: THREE.Mesh, width: number, depth: number, height: number,
  ridgeRatio: number, axis: 'x' | 'z', m: ReturnType<typeof makeMaterials>
): void {
  const longHalf = (axis === 'x' ? width : depth) / 2;
  const transverseHalf = (axis === 'x' ? depth : width) / 2;
  const ridgeHalf = longHalf * ridgeRatio;
  const vertices: number[] = [], colors: number[] = [];
  const palette = [0xb35b3e, 0xbd6849, 0xa85339, 0xc07150].map(hex => new THREE.Color(hex));
  const point = (t: number, u: number, side: number, lift: number): [number,number,number] => {
    const along = u * (longHalf * (1 - t) + ridgeHalf * t);
    const across = side * transverseHalf * (1 - t);
    return axis === 'x'
      ? [along, height * t + 0.055 + lift, across]
      : [across, height * t + 0.055 + lift, along];
  };
  const triangle = (a: number[], b: number[], c: number[], color: THREE.Color) => {
    for (const v of [a,b,c]) { vertices.push(...v); colors.push(color.r,color.g,color.b); }
  };
  const rows = Math.max(5, Math.round(transverseHalf / 1.15));
  for (const side of [-1,1]) for (let row = 0; row < rows; row++) {
    const t0 = row / rows + 0.008;
    const t1 = (row + 1) / rows - 0.012;
    const cols = Math.max(7, Math.round((longHalf * (2 - t0 - t1) + ridgeHalf * (t0 + t1)) / 1.35));
    for (let col = 0; col < cols; col++) {
      const u0 = -1 + (col + 0.035) * 2 / cols;
      const u1 = -1 + (col + 0.965) * 2 / cols;
      const um = (u0 + u1) / 2;
      const a = point(t0,u0,side,0), b = point(t0,um,side,0.07), c = point(t0,u1,side,0);
      const d = point(t1,u0,side,0), e = point(t1,um,side,0.07), f = point(t1,u1,side,0);
      const color = palette[(row * 5 + col * 3 + (side + 1)) % palette.length];
      triangle(a,b,d,color); triangle(b,e,d,color);
      triangle(b,c,e,color); triangle(c,f,e,color);
    }
  }
  const tilesGeometry = new THREE.BufferGeometry();
  tilesGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices,3));
  tilesGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors,3));
  tilesGeometry.computeVertexNormals();
  const tiles = new THREE.Mesh(tilesGeometry,m.roofTile);
  tiles.name = `${roof.name}_Raised_Tiles`; tiles.castShadow = true; tiles.receiveShadow = true;
  roof.add(tiles);
  const hips: THREE.BufferGeometry[] = [];
  for (const side of [-1,1]) for (const end of [-1,1]) {
    const start = point(0,end,side,0.09);
    const finish = point(1,end,side,0.09);
    hips.push(new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(...start),new THREE.Vector3(...finish)),16,0.12,8,false));
  }
  const merged = mergeGeometries(hips,false);
  hips.forEach(hip => hip.dispose());
  if (!merged) throw new Error(`Cannot create hip caps for ${roof.name}`);
  const caps = new THREE.Mesh(merged,m.roofRidgeCap);
  caps.name = `${roof.name}_Hip_Caps`; caps.castShadow = true; roof.add(caps);
}

/** Compact irregular leaf mass; clusters and exposed branches form the tree silhouette. */
function canopyGeometry(phase = 0): THREE.BufferGeometry {
  const rings: [number, number][] = [
    [-0.85, 0.10], [-0.64, 0.66], [-0.23, 0.96],
    [0.23, 1.0], [0.62, 0.67], [0.9, 0.08],
  ];
  const segments = 9;
  const vertices: number[] = [], indices: number[] = [];
  for (let j = 0; j < rings.length; j++) {
    const [height, radius] = rings[j];
    for (let i = 0; i < segments; i++) {
      const angle = i * Math.PI * 2 / segments;
      const ripple = 1 + 0.13 * Math.cos(angle * 4 + phase)
        + 0.09 * Math.sin(angle * 3 + height * 5 - phase);
      const r = radius * ripple;
      vertices.push(Math.cos(angle) * r, height + 0.035 * Math.sin(angle * 5 + phase), Math.sin(angle) * r);
      if (j < rings.length - 1) {
        const a = j * segments + i;
        const b = j * segments + (i + 1) % segments;
        indices.push(a, b, a + segments, b, b + segments, a + segments);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function makeMaterials() {
  return {
    earth: material('Earth_Underside_Base', 0x342f27, 0.95),
    asphaltRoad: material('Public_Road_Asphalt', 0x282b30, 0.88),
    asphaltCourt: material('Compound_Driveway_Asphalt', 0x383c42, 0.82),
    roadMarking: material('Road_Lane_Marking', 0xf0ede4, 0.6),
    curbStone: material('Concrete_Curb_Stone', 0xb8b2a7, 0.82),
    bwCurbBlack: material('Safety_Curb_Black', 0x1f2124, 0.85),
    bwCurbWhite: material('Safety_Curb_White', 0xedeae2, 0.8),
    sidewalkPaving: material('Sidewalk_Paving', 0xc5bfb3, 0.78),
    terracePaving: material('Residence_Terrace_Tile', 0xd6cfc2, 0.72),
    lawnGrass: material('Compound_Lawn_Grass', 0x567e42, 0.92),
    gardenSoil: material('Mulch_Garden_Soil', 0x42382c, 0.95),
    foliagePalette: [
      material('Canopy_Deep', 0x3a5d3f, 0.88),
      material('Canopy_Mid', 0x4e7741, 0.85),
      material('Canopy_Light', 0x718f4e, 0.85),
      material('Canopy_Olive', 0x5d733e, 0.88),
    ],
    treeTrunk: material('Tree_Trunk_Bark', 0x544738, 0.9),
    palmTrunk: material('Royal_Palm_Bark', 0x5e4e3e, 0.88),
    palmCrown: material('Royal_Palm_Crownshaft', 0x42682e, 0.65),
    palmLeaves: new THREE.MeshStandardMaterial({ name: 'Royal_Palm_Fronds', vertexColors: true, roughness: 0.85, side: THREE.DoubleSide }),
    timber: material('Hardwood_Bargeboard_Timber', 0x453020, 0.8),
    stuccoWhite: material('Residence_Colonial_White_Stucco', 0xf5f3ed, 0.72),
    stuccoCream: material('Architectural_Trim_Cream_Stucco', 0xe8e2d4, 0.75),
    stuccoDark: material('Residence_Plinth_Base_Stucco', 0xc4bcac, 0.78),
    roofTerracotta: material('Multi_Tiered_Terracotta_Roof', 0xb65538, 0.82),
    roofRidgeCap: material('Terracotta_Ridge_Cap', 0x9b4128, 0.8),
    roofTile: new THREE.MeshStandardMaterial({ name: 'Raised_Terracotta_Tile_Field', vertexColors: true, roughness: 0.84, side: THREE.DoubleSide }),
    windowGlass: material('Residence_Window_Glazing', 0x384c5c, 0.18, 0.45),
    windowFrame: material('Casement_Window_Frame', 0x2c2926, 0.6),
    fenceIron: material('Wrought_Iron_Fence_White', 0xf2efea, 0.5, 0.25),
    fencePostStone: material('Fence_Concrete_Pillars', 0xdad4c8, 0.75),
    flagRed: material('Indonesian_Flag_Red', 0xcc1829, 0.7),
    flagWhite: material('Indonesian_Flag_White', 0xfafafa, 0.7),
    metal: material('Streetlight_Metal_Dark', 0x42464c, 0.45, 0.65),
    gold: material('Finial_Burnished_Gold', 0xd4af37, 0.35, 0.8),
    carBodyBlack: material('VIP_Vehicle_Body_Black', 0x181a1c, 0.25, 0.75),
    carChrome: material('VIP_Vehicle_Chrome', 0xdcdedf, 0.2, 0.85),
    carLight: material('VIP_Vehicle_Light', 0xffffff, 0.1, 0.2),
  };
}

/** A branching broadleaf tree, with varied overlapping leaf clusters instead of a single ball. */
function createKambangIwakShadeTree(
  name: string,
  x: number,
  z: number,
  size: number,
  colorIndex: number,
  crownGeometries: THREE.BufferGeometry[],
  trunkGeo: THREE.BufferGeometry,
  m: ReturnType<typeof makeMaterials>
): THREE.Group {
  const tree = new THREE.Group();
  tree.name = name;
  tree.position.set(x, 0, z);

  const trunk = new THREE.Mesh(trunkGeo, m.treeTrunk);
  trunk.name = `${name}_Trunk`;
  trunk.scale.setScalar(size);
  trunk.castShadow = true;
  tree.add(trunk);

  const branchGeometries: THREE.BufferGeometry[] = [];
  const clusters: [number, number, number, number][] = [
    [0, 2.18, 0, 0.72],
    [-0.72, 1.82, -0.25, 0.70], [0.70, 1.89, 0.16, 0.74],
    [-0.17, 1.88, -0.72, 0.68], [0.25, 1.95, 0.74, 0.70],
    [-1.16, 1.57, 0.27, 0.57], [1.17, 1.64, -0.24, 0.61],
    [-0.61, 1.51, 0.93, 0.56], [0.56, 1.57, -0.92, 0.58],
  ];
  const shift = (colorIndex % 3) * 0.11;
  for (let i = 0; i < clusters.length; i++) {
    const [cx, cy, cz, scale] = clusters[i];
    const px = (cx + shift * (i % 2 ? 1 : -1)) * size;
    const py = (cy + 0.06 * Math.sin(i * 2.3 + colorIndex)) * size;
    const pz = (cz + shift * (i % 3 ? 0.5 : -0.5)) * size;
    if (i > 0 && i < 5) {
      const start = new THREE.Vector3(0, 1.08 * size, 0);
      const fork = new THREE.Vector3(px * 0.42, 1.44 * size, pz * 0.42);
      const end = new THREE.Vector3(px * 0.9, py - 0.14 * size, pz * 0.9);
      branchGeometries.push(new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([start, fork, end]), 6, 0.13 * size, 5, false,
      ));
    }
    const canopy = new THREE.Mesh(
      crownGeometries[(i + colorIndex) % crownGeometries.length],
      m.foliagePalette[(i + colorIndex) % m.foliagePalette.length],
    );
    canopy.name = `${name}_Canopy_Lobe_${i + 1}`;
    canopy.position.set(px, py, pz);
    canopy.scale.set(scale * size, scale * size * (0.75 + i % 3 * 0.07), scale * size * 0.91);
    canopy.rotation.y = i * 0.79 + colorIndex * 0.31;
    canopy.castShadow = true;
    canopy.receiveShadow = true;
    tree.add(canopy);
  }
  const branches = mergeGeometries(branchGeometries, false);
  branchGeometries.forEach(geometry => geometry.dispose());
  if (!branches) throw new Error(`Cannot build tree branches: ${name}`);
  const branchMesh = new THREE.Mesh(branches, m.treeTrunk);
  branchMesh.name = `${name}_Primary_Branches`;
  branchMesh.castShadow = true;
  tree.add(branchMesh);
  return tree;
}

/** Royal palm with an exposed crownshaft and full, curved pinnate fronds. */
function createRoyalPalm(
  name: string,
  x: number,
  z: number,
  height: number,
  m: ReturnType<typeof makeMaterials>,
  hasUnderstory = true
): THREE.Group {
  const palm = new THREE.Group();
  palm.name = name;
  palm.position.set(x, 0, z);
  const trunkH = height * 0.77;
  const crownY = height * 0.86;
  const trunk = new THREE.Mesh(new THREE.LatheGeometry([
    new THREE.Vector2(height * 0.055, 0),
    new THREE.Vector2(height * 0.046, height * 0.055),
    new THREE.Vector2(height * 0.031, trunkH * 0.45),
    new THREE.Vector2(height * 0.027, trunkH * 0.82),
    new THREE.Vector2(height * 0.034, trunkH),
  ], 12), m.palmTrunk);
  trunk.name = `${name}_Trunk`;
  trunk.castShadow = true;
  palm.add(trunk);
  const crownshaft = new THREE.Mesh(new THREE.LatheGeometry([
    new THREE.Vector2(height * 0.034, 0),
    new THREE.Vector2(height * 0.041, height * 0.028),
    new THREE.Vector2(height * 0.035, height * 0.065),
    new THREE.Vector2(height * 0.012, height * 0.1),
  ], 12), m.palmCrown);
  crownshaft.name = `${name}_Crownshaft`;
  crownshaft.position.y = trunkH;
  palm.add(crownshaft);

  const rachisGeometries: THREE.BufferGeometry[] = [];
  const leafVertices: number[] = [];
  const leafColors: number[] = [];
  const bladeVertices: number[] = [];
  const bladeColors: number[] = [];
  const shades = [0x356b35, 0x487b38, 0x649246, 0x799d4c].map(hex => new THREE.Color(hex));
  const frondCount = 13;
  for (let i = 0; i < frondCount; i++) {
    const angle = (i + 0.18 * (i % 3)) * Math.PI * 2 / frondCount;
    const radial = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const across = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle));
    const reach = height * (0.39 + 0.035 * (i % 3));
    const droop = height * (0.19 + 0.028 * (i % 4));
    const at = (t: number) => new THREE.Vector3(
      radial.x * reach * t,
      crownY + height * 0.09 * Math.sin(Math.PI * t) - droop * t * t,
      radial.z * reach * t,
    );
    rachisGeometries.push(new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(Array.from({ length: 6 }, (_, j) => at(j / 5))),
      14, height * 0.005, 5, false,
    ));
    // The continuous tapered feather gives the frond its mass at viewer distance.
    // Individual paired leaflets below break up its edge in close inspection.
    for (let j = 0; j < 15; j++) {
      const t0 = j / 15, t1 = (j + 1) / 15;
      for (const side of [-1, 1]) {
        const bladePoint = (t: number) => {
          const width = height * 0.092 * Math.pow(Math.sin(Math.PI * t), 0.85);
          return at(t).addScaledVector(across, side * width)
            .addScaledVector(radial, width * 0.13);
        };
        const a = at(t0), b = at(t1);
        const c = bladePoint(t0), d = bladePoint(t1);
        const color = shades[(i + j + (side + 1)) % shades.length];
        for (const v of [a, c, b, b, c, d]) {
          bladeVertices.push(v.x, v.y, v.z);
          bladeColors.push(color.r, color.g, color.b);
        }
      }
    }
    for (let j = 1; j <= 14; j++) {
      const t = j / 16;
      const base = at(t);
      const leafletLength = height * 0.165 * Math.sin(Math.PI * t);
      const width = height * 0.018 * Math.sin(Math.PI * t);
      for (const side of [-1, 1]) {
        const tip = base.clone().addScaledVector(across, side * leafletLength)
          .addScaledVector(radial, leafletLength * 0.29);
        tip.y -= height * (0.012 + 0.023 * t);
        const leading = base.clone().addScaledVector(radial, -width);
        const trailing = base.clone().addScaledVector(radial, width);
        const color = shades[(i + j + (side + 1)) % shades.length];
        for (const v of [leading, tip, base, base, tip, trailing]) {
          leafVertices.push(v.x, v.y, v.z);
          leafColors.push(color.r, color.g, color.b);
        }
      }
    }
  }
  const rachisGeometry = mergeGeometries(rachisGeometries, false);
  rachisGeometries.forEach(geometry => geometry.dispose());
  if (!rachisGeometry) throw new Error(`Cannot build palm rachises: ${name}`);
  const rachises = new THREE.Mesh(rachisGeometry, m.palmCrown);
  rachises.name = `${name}_Curved_Frond_Rachises`;
  rachises.castShadow = true;
  palm.add(rachises);
  const bladeGeometry = new THREE.BufferGeometry();
  bladeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(bladeVertices, 3));
  bladeGeometry.setAttribute('color', new THREE.Float32BufferAttribute(bladeColors, 3));
  bladeGeometry.computeVertexNormals();
  const blades = new THREE.Mesh(bladeGeometry, m.palmLeaves);
  blades.name = `${name}_Tapered_Frond_Blades`;
  blades.castShadow = true;
  palm.add(blades);
  const leafGeometry = new THREE.BufferGeometry();
  leafGeometry.setAttribute('position', new THREE.Float32BufferAttribute(leafVertices, 3));
  leafGeometry.setAttribute('color', new THREE.Float32BufferAttribute(leafColors, 3));
  leafGeometry.computeVertexNormals();
  const leaves = new THREE.Mesh(leafGeometry, m.palmLeaves);
  leaves.name = `${name}_Compound_Leaflets`;
  leaves.castShadow = true;
  palm.add(leaves);

  if (hasUnderstory) {
    const dwarf = new THREE.Group();
    dwarf.name = `${name}_Dwarf_Palm`;
    dwarf.position.set(0.75, 0, 0.55);
    dwarf.add(cylinder(`${name}_Dwarf_Trunk`, 0.08, 0.14, 1.6, 9, m.palmTrunk, 0, 0.8, 0));
    const dwarfVertices: number[] = [];
    for (let i = 0; i < 9; i++) {
      const angle = i * Math.PI * 2 / 9;
      const dx = Math.cos(angle), dz = Math.sin(angle);
      dwarfVertices.push(0, 1.8, 0, dx * 0.8, 2.05, dz * 0.8, dx * 1.5, 1.25, dz * 1.5);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(dwarfVertices, 3));
    geometry.computeVertexNormals();
    const smallFronds = new THREE.Mesh(geometry, m.palmCrown);
    smallFronds.name = `${name}_Dwarf_Fronds`;
    smallFronds.castShadow = true;
    dwarf.add(smallFronds);
    palm.add(dwarf);
  }
  return palm;
}

/**
 * Creates the Central Official Residence Building: Rumah Dinas Walikota Palembang
 * Based on the proposed 4-view orthographic and isometric production sheet:
 * - Elevated plinth foundation with grand cascading entrance steps.
 * - Grand front projecting Porte-Cochère / Pendopo pavilion with North-South hipped roof.
 * - Monumental white colonnade of fluted square pillars supporting deep overhanging eaves.
 * - 2-story main central core with East-West grand hipped terracotta roof (~15.0m peak).
 * - Flanking East and West colonial wings with tiered roofs and clerestory ribbon windows.
 * - Rear residential / staff quarters.
 */
function createResidenceBuilding(m: ReturnType<typeof makeMaterials>): THREE.Group {
  const bldg = new THREE.Group();
  bldg.name = 'Residence_Main_Building';

  // 1. ELEVATED COMPOUND FOUNDATION & TERRACE PLINTH
  const plinthH = 0.75;
  const plinthW = 126, plinthD = 78, plinthZ = -14.0;
  bldg.add(box('Residence_Foundation_Plinth', plinthW, plinthH, plinthD, m.stuccoDark, 0, plinthH / 2, plinthZ));
  bldg.add(box('Residence_Terrace_Paving', plinthW - 0.8, 0.08, plinthD - 0.8, m.terracePaving, 0, plinthH + 0.04, plinthZ));

  // Front Portico Extended Terrace Deck
  const porticoW = 27.0, porticoD = 23.0, porticoZ = 9.5;
  bldg.add(box('Porte_Cochere_Base_Deck', porticoW + 2.0, plinthH, porticoD + 2.0, m.stuccoCream, 0, plinthH / 2, porticoZ));
  bldg.add(box('Porte_Cochere_Floor_Tile', porticoW + 1.2, 0.08, porticoD + 1.2, m.terracePaving, 0, plinthH + 0.04, porticoZ));

  // Grand Cascading Entrance Steps (Teras Tangga Utama)
  // Cascading forward from portico edge into the driveway court
  const stepCount = 5;
  const stepStart = porticoZ + porticoD / 2 + 1.0;
  for (let s = 0; s < stepCount; s++) {
    const sw = porticoW - s * 0.6;
    const sy = (stepCount - 1 - s) * (plinthH / stepCount) + 0.075;
    const sz = stepStart + s * 0.85;
    bldg.add(box(`Porte_Cochere_Step_${s}`, sw, plinthH / stepCount, 0.9, m.curbStone, 0, sy, sz));
  }
  // Stepped Balustrade Cheek Walls flanking the stairs
  for (const side of [-1, 1]) {
    const bx = side * (porticoW / 2 + 1.1);
    bldg.add(box(`Stair_Cheek_Wall_${side > 0 ? 'R' : 'L'}`, 0.6, plinthH + 0.5, 4.8, m.stuccoWhite, bx, (plinthH + 0.5) / 2, stepStart + 1.8));
    bldg.add(box(`Stair_Plinth_Pedestal_${side > 0 ? 'R' : 'L'}`, 0.9, 0.9, 0.9, m.stuccoCream, bx, 0.45, stepStart + 4.2));
    bldg.add(cylinder(`Stair_Urn_${side > 0 ? 'R' : 'L'}`, 0.35, 0.22, 0.65, 10, m.curbStone, bx, 1.22, stepStart + 4.2));
  }

  // 2. GRAND FRONT PORTE-COCHERE / PENDEPO PAVILION COLONNADE
  // Monumental fluted white classical columns supporting the grand forward pavilion
  const porticoH = 5.2;
  const colSpecs: BlockSpec[] = [];

  // 4 columns along the front line (Z = porticoZ + porticoD/2 - 1.2)
  const frontColZ = porticoZ + porticoD / 2 - 1.2;
  const colXs = [-porticoW / 2 + 1.4, -porticoW / 6, porticoW / 6, porticoW / 2 - 1.4];
  for (const cx of colXs) {
    colSpecs.push([0.9, porticoH, 0.9, cx, plinthH + porticoH / 2, frontColZ]);
    colSpecs.push([1.2, 0.4, 1.2, cx, plinthH + 0.2, frontColZ]); // Pedestal
    colSpecs.push([1.2, 0.35, 1.2, cx, plinthH + porticoH - 0.175, frontColZ]); // Capital
  }

  // Side columns along West and East colonnade lines
  const sideColZs = [porticoZ + 5.0, porticoZ - 0.5, porticoZ - 6.0];
  for (const sideX of [-porticoW / 2 + 1.4, porticoW / 2 - 1.4]) {
    for (const cz of sideColZs) {
      colSpecs.push([0.9, porticoH, 0.9, sideX, plinthH + porticoH / 2, cz]);
      colSpecs.push([1.2, 0.4, 1.2, sideX, plinthH + 0.2, cz]);
      colSpecs.push([1.2, 0.35, 1.2, sideX, plinthH + porticoH - 0.175, cz]);
    }
  }
  bldg.add(repeatedBoxes('Porte_Cochere_Columns', colSpecs, m.stuccoWhite));

  // Architrave & Entablature Beams over Portico Colonnade
  const beamY = plinthH + porticoH + 0.3;
  const beamSpecs: BlockSpec[] = [];
  beamSpecs.push([porticoW + 1.6, 0.6, 1.0, 0, beamY, frontColZ]);
  beamSpecs.push([porticoW + 1.6, 0.6, 1.0, 0, beamY, porticoZ - porticoD / 2 + 1.0]);
  beamSpecs.push([1.0, 0.6, porticoD + 1.6, -porticoW / 2 + 1.4, beamY, porticoZ]);
  beamSpecs.push([1.0, 0.6, porticoD + 1.6, porticoW / 2 - 1.4, beamY, porticoZ]);
  bldg.add(repeatedBoxes('Porte_Cochere_Architrave_Beams', beamSpecs, m.stuccoCream));

  // Exposed Coffered Timber Ceiling under the Pendopo
  bldg.add(box('Porte_Cochere_Ceiling', porticoW - 0.5, 0.12, porticoD - 0.5, m.timber, 0, plinthH + porticoH, porticoZ));

  // FRONT PORTE-COCHERE HIPPED ROOF (Ridge oriented North-South along Z-axis!)
  // Perfectly matches the reference sheet isometric and orthographic top views!
  const porticoRoofW = porticoW + 4.8; // 31.8 m
  const porticoRoofD = porticoD + 4.5; // 27.5 m
  const porticoRoofH = 3.8;
  const porticoRoof = hippedRoofZ('Porte_Cochere_Roof', porticoRoofW, porticoRoofD, porticoRoofH, m.roofTerracotta, 0.48);
  porticoRoof.position.set(0, beamY + 0.3, porticoZ);
  detailHippedRoof(porticoRoof, porticoRoofW, porticoRoofD, porticoRoofH, 0.48, 'z', m);
  bldg.add(porticoRoof);

  // Terracotta Ridge Cap along the North-South Porte-Cochère peak
  const porticoRidgeLen = porticoRoofD * 0.48 * 2;
  bldg.add(box('Porte_Cochere_Ridge_Cap', 0.45, 0.18, porticoRidgeLen, m.roofRidgeCap, 0, beamY + 0.3 + porticoRoofH, porticoZ));
  bldg.add(cylinder('Porte_Cochere_Apex_Finial', 0.08, 0.18, 0.7, 8, m.gold, 0, beamY + 0.3 + porticoRoofH + 0.35, porticoZ + porticoRidgeLen / 2));

  // 3. MAIN CENTRAL RESIDENCE CORE BODY (2-Story High Core)
  const coreW = 50.0, coreD = 28.0, coreH = 8.6;
  const coreZ = -14.0;
  bldg.add(box('Residence_Central_Core_Body', coreW, coreH, coreD, m.stuccoWhite, 0, plinthH + coreH / 2, coreZ));

  // Cornice moldings separating ground floor, upper floor, and eaves
  bldg.add(box('Residence_Floor_Belt_Cornice', coreW + 0.8, 0.35, coreD + 0.8, m.stuccoCream, 0, plinthH + 4.4, coreZ));
  bldg.add(box('Residence_Main_Eaves_Cornice', coreW + 1.8, 0.45, coreD + 1.8, m.timber, 0, plinthH + coreH + 0.22, coreZ));

  // Recessed Grand Entrance Doors & Fanlight inside the portico
  const entranceZ = coreZ + coreD / 2 + 0.1;
  bldg.add(box('Residence_Grand_Entrance_Door', 4.8, 3.6, 0.25, m.timber, 0, plinthH + 1.8, entranceZ));
  bldg.add(box('Residence_Entrance_Fanlight_Glass', 4.4, 1.3, 0.2, m.windowGlass, 0, plinthH + 4.25, entranceZ));
  bldg.add(box('Residence_Entrance_Door_Frame', 5.6, 4.4, 0.15, m.stuccoCream, 0, plinthH + 2.2, entranceZ - 0.05));

  // Heritage Casement Windows on Central Core Facade
  const coreWinSpecs: BlockSpec[] = [];
  const coreFrameSpecs: BlockSpec[] = [];
  for (const side of [-1, 1]) {
    for (const offset of [9.0, 17.5]) {
      const wx = side * offset;
      // Ground floor tall sash windows
      coreWinSpecs.push([2.6, 2.4, 0.2, wx, plinthH + 2.2, entranceZ]);
      coreFrameSpecs.push([3.0, 2.8, 0.12, wx, plinthH + 2.2, entranceZ - 0.05]);
      // Upper floor clerestory windows
      coreWinSpecs.push([2.6, 2.0, 0.2, wx, plinthH + 6.4, entranceZ]);
      coreFrameSpecs.push([3.0, 2.4, 0.12, wx, plinthH + 6.4, entranceZ - 0.05]);
    }
  }
  bldg.add(repeatedBoxes('Central_Core_Windows', coreWinSpecs, m.windowGlass));
  bldg.add(repeatedBoxes('Central_Core_Frames', coreFrameSpecs, m.windowFrame));

  // 4. MAIN CENTRAL HIGH HIPPED ROOF (Peak reaches exactly 15.0 m above ground!)
  // East-West grand hipped roof matching the elevation and profile views in Section 2.
  const mainRoofBaseY = plinthH + coreH + 0.4; // 9.75 m
  const mainRoofH = 5.25; // Peak reaches exactly 15.0 m!
  const mainRoofW = coreW + 5.5; // 55.5 m
  const mainRoofD = coreD + 5.5; // 33.5 m

  const mainRoof = hippedRoofX('Residence_Central_High_Roof', mainRoofW, mainRoofD, mainRoofH, m.roofTerracotta, 0.46);
  mainRoof.position.set(0, mainRoofBaseY, coreZ);
  detailHippedRoof(mainRoof, mainRoofW, mainRoofD, mainRoofH, 0.46, 'x', m);
  bldg.add(mainRoof);

  // Terracotta Ridge Cap & Peak Finials along central roof
  const mainRidgeLen = mainRoofW * 0.46 * 2;
  bldg.add(box('Main_Roof_Ridge_Cap', mainRidgeLen, 0.2, 0.45, m.roofRidgeCap, 0, mainRoofBaseY + mainRoofH, coreZ));
  for (const rx of [-mainRidgeLen / 2, mainRidgeLen / 2]) {
    bldg.add(cylinder(`Main_Roof_Apex_Finial_${rx}`, 0.07, 0.16, 0.7, 8, m.gold, rx, mainRoofBaseY + mainRoofH + 0.35, coreZ));
  }

  // 5. WEST RESIDENTIAL WING (Sayap Barat)
  const wingW = 38.0, wingD = 24.0, wingH = 6.4;
  const westWingX = -(coreW / 2 + wingW / 2 - 1.5); // -42.5 m
  const westWingZ = -14.0;

  bldg.add(box('Residence_West_Wing_Body', wingW, wingH, wingD, m.stuccoWhite, westWingX, plinthH + wingH / 2, westWingZ));
  bldg.add(box('Residence_West_Wing_Cornice', wingW + 0.8, 0.35, wingD + 0.8, m.stuccoCream, westWingX, plinthH + wingH + 0.175, westWingZ));

  // West Wing Tiered Hipped Roof
  const westRoofH = 3.8;
  const westRoof = hippedRoofX('Residence_West_Wing_Roof', wingW + 4.5, wingD + 4.5, westRoofH, m.roofTerracotta, 0.42);
  westRoof.position.set(westWingX, plinthH + wingH + 0.35, westWingZ);
  detailHippedRoof(westRoof, wingW + 4.5, wingD + 4.5, westRoofH, 0.42, 'x', m);
  bldg.add(westRoof);
  bldg.add(box('West_Wing_Ridge_Cap', (wingW + 4.5) * 0.42 * 2, 0.18, 0.45, m.roofRidgeCap, westWingX, plinthH + wingH + 0.35 + westRoofH, westWingZ));

  // West Wing Windows & Veranda
  const westWinSpecs: BlockSpec[] = [];
  for (let i = -1; i <= 1; i++) {
    westWinSpecs.push([2.8, 2.4, 0.2, westWingX + i * 11.0, plinthH + 2.5, westWingZ + wingD / 2 + 0.1]);
  }
  bldg.add(repeatedBoxes('West_Wing_Windows', westWinSpecs, m.windowGlass));

  // 6. EAST ADMINISTRATIVE WING (Sayap Timur)
  // Continuous ribbon clerestory windows along upper facade as shown in isometric reference!
  const eastWingX = coreW / 2 + wingW / 2 - 1.5; // 42.5 m
  const eastWingZ = -14.0;

  bldg.add(box('Residence_East_Wing_Body', wingW, wingH, wingD, m.stuccoWhite, eastWingX, plinthH + wingH / 2, eastWingZ));
  bldg.add(box('Residence_East_Wing_Cornice', wingW + 0.8, 0.35, wingD + 0.8, m.stuccoCream, eastWingX, plinthH + wingH + 0.175, eastWingZ));

  // Continuous ribbon clerestory windows on East Wing upper floor
  const eastRibbonZ = eastWingZ + wingD / 2 + 0.1;
  bldg.add(box('East_Wing_Ribbon_Glass', wingW - 4.0, 1.4, 0.15, m.windowGlass, eastWingX, plinthH + 4.9, eastRibbonZ));
  bldg.add(box('East_Wing_Ribbon_Frame', wingW - 3.6, 1.6, 0.08, m.windowFrame, eastWingX, plinthH + 4.9, eastRibbonZ - 0.05));

  // East Wing Ground Veranda French Windows
  const eastWinSpecs: BlockSpec[] = [];
  for (let i = -1; i <= 1; i++) {
    eastWinSpecs.push([2.8, 2.4, 0.2, eastWingX + i * 11.0, plinthH + 2.2, eastRibbonZ]);
  }
  bldg.add(repeatedBoxes('East_Wing_Windows', eastWinSpecs, m.windowGlass));

  // East Wing Tiered Hipped Roof
  const eastRoof = hippedRoofX('Residence_East_Wing_Roof', wingW + 4.5, wingD + 4.5, westRoofH, m.roofTerracotta, 0.42);
  eastRoof.position.set(eastWingX, plinthH + wingH + 0.35, eastWingZ);
  detailHippedRoof(eastRoof, wingW + 4.5, wingD + 4.5, westRoofH, 0.42, 'x', m);
  bldg.add(eastRoof);
  bldg.add(box('East_Wing_Ridge_Cap', (wingW + 4.5) * 0.42 * 2, 0.18, 0.45, m.roofRidgeCap, eastWingX, plinthH + wingH + 0.35 + westRoofH, eastWingZ));

  // 7. REAR RESIDENTIAL QUARTERS (Sayap Belakang)
  const rearW = 34.0, rearD = 18.0, rearH = 5.4;
  const rearZ = coreZ - coreD / 2 - rearD / 2 + 1.0; // -36.0 m
  bldg.add(box('Residence_Rear_Wing_Body', rearW, rearH, rearD, m.stuccoWhite, 0, plinthH + rearH / 2, rearZ));

  const rearRoofH = 3.4;
  const rearRoof = hippedRoofX('Residence_Rear_Wing_Roof', rearW + 3.5, rearD + 3.5, rearRoofH, m.roofTerracotta, 0.38);
  rearRoof.position.set(0, plinthH + rearH + 0.35, rearZ);
  detailHippedRoof(rearRoof, rearW + 3.5, rearD + 3.5, rearRoofH, 0.38, 'x', m);
  bldg.add(rearRoof);

  return bldg;
}

/**
 * Creates Palembang-Style Traditional Entrance Pavilion Gateway Module (Props Kit-Bash #3)
 */
function createPavilionGateway(name: string, x: number, z: number, m: ReturnType<typeof makeMaterials>): THREE.Group {
  const gate = new THREE.Group();
  gate.name = name;
  gate.position.set(x, 0, z);

  const gateW = 12.0, gateD = 5.5, gateH = 4.4;

  // 4 Square Load-Bearing Concrete Pillars
  const pillarSpecs: BlockSpec[] = [];
  const colXs = [-gateW / 2 + 1.0, gateW / 2 - 1.0];
  const colZs = [-gateD / 2 + 1.0, gateD / 2 - 1.0];

  for (const cx of colXs) {
    for (const cz of colZs) {
      pillarSpecs.push([0.9, gateH, 0.9, cx, gateH / 2, cz]);
      pillarSpecs.push([1.2, 0.4, 1.2, cx, 0.2, cz]);
      pillarSpecs.push([1.2, 0.35, 1.2, cx, gateH - 0.175, cz]);
    }
  }
  gate.add(repeatedBoxes('Gateway_Pillars', pillarSpecs, m.stuccoWhite));

  // Architrave Timber Beams
  const beamY = gateH + 0.3;
  gate.add(box('Gateway_Architrave_EW', gateW + 0.8, 0.6, 0.8, m.stuccoCream, 0, beamY, -gateD / 2 + 1.0));
  gate.add(box('Gateway_Architrave_NS', gateW + 0.8, 0.6, 0.8, m.stuccoCream, 0, beamY, gateD / 2 - 1.0));
  gate.add(box('Gateway_Cross_Beam_L', 0.8, 0.6, gateD, m.stuccoCream, -gateW / 2 + 1.0, beamY, 0));
  gate.add(box('Gateway_Cross_Beam_R', 0.8, 0.6, gateD, m.stuccoCream, gateW / 2 - 1.0, beamY, 0));

  // Two-Tiered Palembang Traditional Hipped Roof
  const lowerRoofH = 1.8;
  const lowerRoof = hippedRoofX('Gateway_Lower_Roof', gateW + 3.2, gateD + 3.2, lowerRoofH, m.roofTerracotta, 0.35);
  lowerRoof.position.set(0, beamY + 0.3, 0);
  detailHippedRoof(lowerRoof, gateW + 3.2, gateD + 3.2, lowerRoofH, 0.35, 'x', m);
  gate.add(lowerRoof);

  // Upper Roof Tier
  const upperRoofH = 1.6;
  const upperRoof = hippedRoofX('Gateway_Upper_Roof', (gateW + 3.2) * 0.65, (gateD + 3.2) * 0.65, upperRoofH, m.roofTerracotta, 0.35);
  upperRoof.position.set(0, beamY + 0.3 + lowerRoofH * 0.85, 0);
  detailHippedRoof(upperRoof, (gateW + 3.2) * 0.65, (gateD + 3.2) * 0.65, upperRoofH, 0.35, 'x', m);
  gate.add(upperRoof);

  // Decorative Ridge Cap & Apex Horn Finials
  const ridgeLen = (gateW + 3.2) * 0.65 * 0.35 * 2;
  gate.add(box('Gateway_Ridge_Cap', ridgeLen, 0.15, 0.35, m.roofRidgeCap, 0, beamY + 0.3 + lowerRoofH * 0.85 + upperRoofH, 0));
  for (const rx of [-ridgeLen / 2, ridgeLen / 2]) {
    gate.add(cylinder(`Gateway_Roof_Finial_${rx}`, 0.06, 0.14, 0.9, 8, m.gold, rx, beamY + 0.3 + lowerRoofH * 0.85 + upperRoofH + 0.45, 0));
  }

  // Open picket leaves retain a genuine passage and pivot around their hinges.
  const gateLeafW = (gateW - 2.8) / 2;
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.name = `Gateway_Leaf_Pivot_${side > 0 ? 'Right' : 'Left'}`;
    pivot.position.set(side * (gateW / 2 - 1.35), 0, 0);
    const leafBars: BlockSpec[] = [
      [gateLeafW,0.1,0.12,-side * gateLeafW / 2,0.55,0],
      [gateLeafW,0.1,0.12,-side * gateLeafW / 2,2.55,0],
      [0.1,2.1,0.12,-side * gateLeafW,1.55,0],
    ];
    for (let i = 1; i < 10; i++) leafBars.push([0.075,2.05,0.075,-side * gateLeafW * i / 10,1.53,0]);
    pivot.add(repeatedBoxes(`Gateway_Iron_Leaf_${side > 0 ? 'Right' : 'Left'}`,leafBars,m.fenceIron));
    pivot.rotation.y = side * 0.35;
    gate.add(pivot);
  }

  return gate;
}

/**
 * Creates Compound Perimeter Fence, Security Guard Post, and Gates (Props Kit-Bash #2)
 */
function createCompoundFenceAndPerimeter(m: ReturnType<typeof makeMaterials>): THREE.Group {
  const fence = new THREE.Group();
  fence.name = 'Compound_Fence_And_Perimeter';

  const fenceZ = 52.0;
  const fenceH = 1.9;

  // Front Perimeter Fence Line with two gateway openings:
  // Gateway 1 (West In-Gate): X in [-71, -59]
  // Gateway 2 (East Out-Gate): X in [59, 71]
  const wallPlinthSpecs: BlockSpec[] = [];
  const pillarSpecs: BlockSpec[] = [];
  const grilleSpecs: BlockSpec[] = [];

  const fenceIntervals: [number, number][] = [
    [-122, -71],
    [-59, 59],
    [71, 122],
  ];

  fenceIntervals.forEach(([xStart, xEnd]) => {
    const len = xEnd - xStart;
    const midX = (xStart + xEnd) / 2;

    wallPlinthSpecs.push([len, 0.45, 0.5, midX, 0.225, fenceZ]);

    const steps = Math.floor(len / 5.0);
    const stepSize = len / steps;

    for (let i = 0; i <= steps; i++) {
      const px = xStart + i * stepSize;
      pillarSpecs.push([0.65, fenceH, 0.65, px, fenceH / 2, fenceZ]);
      pillarSpecs.push([0.8, 0.15, 0.8, px, fenceH + 0.075, fenceZ]);

      if (i < steps) {
        const gx = px + stepSize / 2;
        grilleSpecs.push([stepSize - 0.7, 0.1, 0.12, gx, 0.84, fenceZ]);
        grilleSpecs.push([stepSize - 0.7, 0.1, 0.12, gx, 1.72, fenceZ]);
        const pickets = Math.max(4, Math.floor((stepSize - 0.7) / 0.38));
        for (let picket = 1; picket < pickets; picket++) {
          const pxBar = px + 0.35 + picket * (stepSize - 0.7) / pickets;
          grilleSpecs.push([0.065, 1.4, 0.065, pxBar, 1.15, fenceZ]);
        }
      }
    }
  });

  // Lateral Side Perimeter Walls (West X=-122 and East X=+122)
  for (const sideX of [-122, 122]) {
    wallPlinthSpecs.push([0.5, 0.45, 126, sideX, 0.225, -11]);
    for (let z = -74; z <= 52; z += 7.0) {
      pillarSpecs.push([0.65, fenceH, 0.65, sideX, fenceH / 2, z]);
      pillarSpecs.push([0.8, 0.15, 0.8, sideX, fenceH + 0.075, z]);
      if (z < 52) {
        grilleSpecs.push([0.12, 0.1, 6.35, sideX, 0.84, z + 3.5]);
        grilleSpecs.push([0.12, 0.1, 6.35, sideX, 1.72, z + 3.5]);
        for (let picket = 1; picket < 17; picket++) {
          grilleSpecs.push([0.065, 1.4, 0.065, sideX, 1.15, z + 0.35 + picket * 6.3 / 17]);
        }
      }
    }
  }

  // Rear Boundary Masonry Wall (Z = -74)
  wallPlinthSpecs.push([244, 2.4, 0.6, 0, 1.2, -74]);

  fence.add(repeatedBoxes('Fence_Concrete_Plinth', wallPlinthSpecs, m.fencePostStone));
  fence.add(repeatedBoxes('Fence_Concrete_Pillars', pillarSpecs, m.fencePostStone));
  fence.add(repeatedBoxes('Fence_Wrought_Iron_Grilles', grilleSpecs, m.fenceIron));

  // Security Guard Post (Pos Penjagaan Satpol PP) near West Gate
  const guard = new THREE.Group();
  guard.name = 'Security_Guard_Post';
  guard.position.set(-54, 0, 47);
  guard.add(box('Guard_Post_Body', 4.5, 3.2, 4.0, m.stuccoWhite, 0, 1.6, 0));
  guard.add(box('Guard_Post_Plinth', 4.9, 0.3, 4.4, m.stuccoDark, 0, 0.15, 0));
  guard.add(box('Guard_Post_Door', 1.0, 2.2, 0.1, m.timber, 0, 1.1, 2.05));
  guard.add(box('Guard_Post_Window_Front', 1.8, 1.2, 0.1, m.windowGlass, 1.0, 1.8, 2.05));
  guard.add(box('Guard_Post_Window_Side', 0.1, 1.2, 1.8, m.windowGlass, -2.05, 1.8, 0));
  const guardRoof = hippedRoofX('Guard_Post_Roof', 5.6, 5.1, 1.5, m.roofTerracotta, 0.35);
  guardRoof.position.set(0, 3.2, 0);
  detailHippedRoof(guardRoof,5.6,5.1,1.5,0.35,'x',m);
  guard.add(guardRoof);
  fence.add(guard);

  return fence;
}

/**
 * Creates Ground Plinth, Public Road, Sidewalks, and Semicircular Ceremonial Driveway Court
 */
function createPlinthAndDriveway(m: ReturnType<typeof makeMaterials>): THREE.Group {
  const g = new THREE.Group();
  g.name = 'Plinth_And_Driveway_Court';

  const baseW = 250.0, baseD = 160.0;

  // 1. Earth Underside Display Base
  g.add(box('Terrain_Underside_Base', baseW, 0.6, baseD, m.earth, 0, -0.3, 0));

  // 2. Main Compound Lawn Green
  g.add(box('Compound_Lawn_Base', baseW, 0.05, baseD, m.lawnGrass, 0, 0.025, 0));

  // 3. Public Highway / Front Street (Z in [58, 80])
  const roadZ = 69.0, roadD = 22.0;
  g.add(box('Public_Road_Asphalt_Surface', baseW, 0.18, roadD, m.asphaltRoad, 0, 0.09, roadZ));

  // Road Lane Dividers (White Dashed Markings)
  const lineSpecs: BlockSpec[] = [];
  for (let x = -baseW / 2 + 3; x < baseW / 2 - 3; x += 6.0) {
    lineSpecs.push([3.5, 0.02, 0.3, x, 0.195, roadZ]);
  }
  g.add(repeatedBoxes('Public_Road_Center_Markings', lineSpecs, m.roadMarking));

  // Sidewalk with Black-and-White Safety Curb along public road
  const sidewalkZ = 55.0, sidewalkD = 6.0;
  g.add(box('Public_Sidewalk_Paving', baseW, 0.22, sidewalkD, m.sidewalkPaving, 0, 0.11, sidewalkZ));

  // Black and White Curb Pattern (B/W kerb safety stones)
  const curbBlackSpecs: BlockSpec[] = [];
  const curbWhiteSpecs: BlockSpec[] = [];
  for (let x = -baseW / 2 + 1; x < baseW / 2 - 1; x += 2.0) {
    const isBlack = (Math.floor(x / 2.0) % 2 === 0);
    const target = isBlack ? curbBlackSpecs : curbWhiteSpecs;
    target.push([1.95, 0.26, 0.35, x, 0.13, 57.85]);
  }
  g.add(repeatedBoxes('Road_Safety_Curb_Black', curbBlackSpecs, m.bwCurbBlack));
  g.add(repeatedBoxes('Road_Safety_Curb_White', curbWhiteSpecs, m.bwCurbWhite));

  // 4. Semicircular Horseshoe Ceremonial Driveway Court
  // Grand asphalt driveway connecting West Entrance Gate (X=-65) -> Grand Porte-Cochère (Z=18) -> East Exit Gate (X=+65)
  const courtSpecs: BlockSpec[] = [
    // Entrance ramp West
    [16.0, 0.16, 26.0, -65.0, 0.08, 39.0],
    // Exit ramp East
    [16.0, 0.16, 26.0, 65.0, 0.08, 39.0],
    // Broad ceremonial turnaround forecourt in front of the Grand Pendopo
    [105.0, 0.16, 32.0, 0, 0.08, 26.0],
    // Connecting apron towards the Grand Steps
    [40.0, 0.16, 12.0, 0, 0.08, 22.0],
  ];
  g.add(repeatedBoxes('Ceremonial_Driveway_Court', courtSpecs, m.asphaltCourt));

  // Inner manicured grass island inside the horseshoe driveway
  g.add(box('Driveway_Island_Lawn', 56.0, 0.2, 18.0, m.lawnGrass, 0, 0.1, 39.0));
  g.add(repeatedBoxes('Driveway_Island_Curb', [
    [56.8, 0.22, 0.4, 0, 0.11, 29.8],
    [56.8, 0.22, 0.4, 0, 0.11, 48.2],
    [0.4, 0.22, 18.0, -28.2, 0.11, 39.0],
    [0.4, 0.22, 18.0, 28.2, 0.11, 39.0],
  ], m.curbStone));

  return g;
}

/**
 * Creates Central Ceremonial Flagpole flying Sang Saka Merah Putih (Props Kit-Bash #5)
 */
function createCeremonialFlagpole(m: ReturnType<typeof makeMaterials>): THREE.Group {
  const g = new THREE.Group();
  g.name = 'Compound_Ceremonial_Flagpole';
  g.position.set(-25, 0, 32);

  // Stepped Concrete Plinth Base
  g.add(box('Flagpole_Plinth_Lower', 4.5, 0.35, 4.5, m.curbStone, 0, 0.175, 0));
  g.add(box('Flagpole_Plinth_Upper', 3.2, 0.3, 3.2, m.stuccoCream, 0, 0.5, 0));

  // Tapered White Stainless Steel Mast (Height ~14m)
  const mastH = 13.5;
  g.add(cylinder('Flagpole_Mast', 0.07, 0.18, mastH, 12, m.stuccoWhite, 0, 0.65 + mastH / 2, 0));
  g.add(cylinder('Flagpole_Finial_Ball', 0.22, 0.22, 0.3, 12, m.gold, 0, 0.65 + mastH + 0.15, 0));

  // Indonesian National Flag: Sang Saka Merah Putih
  const flagW = 3.6, flagH = 2.4, flagThk = 0.04;
  const flagY = 0.65 + mastH - flagH / 2 - 0.3;
  const flagZ = flagW / 2;

  g.add(box('Flag_Red_Half', flagThk, flagH / 2, flagW, m.flagRed, 0.05, flagY + flagH / 4, flagZ));
  g.add(box('Flag_White_Half', flagThk, flagH / 2, flagW, m.flagWhite, 0.05, flagY - flagH / 4, flagZ));

  return g;
}

/**
 * Creates Compound Gardens and Organic Vegetation using the Kambang Iwak procedural system:
 * - Multi-lobe shade trees with organic canopy geometry
 * - Multi-species Royal Palm kit (Asset #4)
 * - Dense groves flanking the residence and perimeter boundary walls
 * - Manicured boxwood hedges along the driveway
 */
function createCompoundGardensAndVegetation(m: ReturnType<typeof makeMaterials>): THREE.Group {
  const g = new THREE.Group();
  g.name = 'Compound_Gardens_And_Vegetation';

  // Shared geometry instances for high performance and organic variety
  const crownGeometries = [
    canopyGeometry(0),
    canopyGeometry(1.7),
    canopyGeometry(3.14),
  ];
  const trunkGeo = new THREE.LatheGeometry([
    new THREE.Vector2(0.48, 0), new THREE.Vector2(0.34, 0.13),
    new THREE.Vector2(0.25, 0.65), new THREE.Vector2(0.18, 1.25),
    new THREE.Vector2(0.1, 1.55),
  ], 10);

  // 1. EAST GARDEN GROVE (Lush shade tree cluster in the front-right lawn)
  // Matching the isometric reference sheet overview!
  const eastGroveTrees: [number, number, number, number][] = [
    [42, 14, 2.6, 0],
    [52, 22, 2.9, 1],
    [64, 16, 2.4, 2],
    [75, 26, 3.1, 3],
    [86, 18, 2.7, 0],
    [96, 28, 2.8, 1],
    [48, 34, 2.5, 2],
    [60, 42, 3.0, 3],
    [72, 36, 2.8, 0],
    [84, 44, 2.6, 1],
    [98, 40, 2.9, 2],
    [106, 22, 2.5, 3],
    [108, 36, 2.7, 0],
    [56, 8, 2.4, 1],
    [78, 10, 2.8, 2],
    [92, 12, 2.6, 3],
  ];

  eastGroveTrees.forEach(([x, z, size, colorIdx], i) => {
    g.add(createKambangIwakShadeTree(`East_Grove_Tree_${i + 1}`, x, z, size, colorIdx, crownGeometries, trunkGeo, m));
  });

  // 2. WEST GARDEN GROVE (Shade tree cluster flanking the entrance driveway)
  const westGroveTrees: [number, number, number, number][] = [
    [-42, 14, 2.5, 1],
    [-52, 24, 2.9, 2],
    [-64, 18, 2.7, 3],
    [-78, 28, 3.0, 0],
    [-88, 20, 2.6, 1],
    [-98, 32, 2.8, 2],
    [-106, 22, 2.5, 3],
    [-46, 36, 2.4, 0],
    [-60, 44, 2.8, 1],
    [-74, 40, 3.1, 2],
    [-88, 44, 2.6, 3],
    [-102, 42, 2.7, 0],
  ];

  westGroveTrees.forEach(([x, z, size, colorIdx], i) => {
    g.add(createKambangIwakShadeTree(`West_Grove_Tree_${i + 1}`, x, z, size, colorIdx, crownGeometries, trunkGeo, m));
  });

  // 3. NORTH REAR & PERIMETER BOUNDARY TREES
  const rearTrees: [number, number, number, number][] = [
    [-112, -10, 3.0, 0],
    [-112, -30, 2.8, 1],
    [-112, -50, 3.1, 2],
    [-110, -64, 2.7, 3],
    [-90, -66, 3.2, 0],
    [-70, -66, 2.9, 1],
    [-50, -66, 3.0, 2],
    [-30, -66, 2.8, 3],
    [-10, -66, 3.1, 0],
    [10, -66, 2.9, 1],
    [30, -66, 3.2, 2],
    [50, -66, 2.8, 3],
    [70, -66, 3.0, 0],
    [90, -66, 2.9, 1],
    [110, -64, 3.1, 2],
    [112, -50, 2.8, 3],
    [112, -30, 3.0, 0],
    [112, -10, 2.7, 1],
  ];

  rearTrees.forEach(([x, z, size, colorIdx], i) => {
    g.add(createKambangIwakShadeTree(`Perimeter_Tree_${i + 1}`, x, z, size, colorIdx, crownGeometries, trunkGeo, m));
  });

  // 4. ROYAL PALM TREES (Reference Asset #4)
  // Prominently placed at the entrance gates, driveway turns, and flanking the grand steps
  const royalPalms: [number, number, number, boolean][] = [
    // Flanking the Grand Front Pavilion steps
    [18, 22, 13.5, true],
    [-18, 22, 13.5, true],
    [24, 26, 11.5, false],
    [-24, 26, 11.5, false],
    // Near West Entrance Gateway
    [-76, 46, 12.0, true],
    [-60, 46, 10.5, false],
    [-84, 50, 11.0, true],
    // Near East Exit Gateway
    [60, 46, 10.5, false],
    [76, 46, 12.0, true],
    [84, 50, 11.0, true],
    // Framing the Driveway Central Island
    [-24, 46, 10.0, false],
    [24, 46, 10.0, false],
    [0, 46, 12.5, true],
  ];

  royalPalms.forEach(([x, z, height, understory], i) => {
    g.add(createRoyalPalm(`Royal_Palm_${i + 1}`, x, z, height, m, understory));
  });

  // 5. MANICURED HEDGES & SHRUBS (Boxwood hedges along the driveway borders)
  const hedgeSpecs: BlockSpec[] = [];
  // Hedges along driveway island
  hedgeSpecs.push([54.0, 0.75, 0.9, 0, 0.45, 47.0]);
  hedgeSpecs.push([54.0, 0.75, 0.9, 0, 0.45, 31.0]);
  // Hedges flanking the terrace plinth
  hedgeSpecs.push([0.9, 0.85, 32.0, -16.0, 0.5, 6.0]);
  hedgeSpecs.push([0.9, 0.85, 32.0, 16.0, 0.5, 6.0]);
  g.add(repeatedBoxes('Compound_Garden_Hedges', hedgeSpecs, m.foliagePalette[3]));

  return g;
}

/**
 * Creates Streetlights, Compound Security Lighting, and VIP Official Vehicles (Props Kit-Bash #5)
 */
function createStreetPropsAndLighting(m: ReturnType<typeof makeMaterials>): THREE.Group {
  const g = new THREE.Group();
  g.name = 'Street_Props_And_Lighting';

  // Curved Modern Cobra-Head Streetlights along the public road (Z = 57.2)
  for (let x = -110; x <= 110; x += 44.0) {
    const post = new THREE.Group();
    post.name = `Streetlight_${x}`;
    post.position.set(x, 0, 57.2);
    post.add(cylinder('Post_Mast', 0.1, 0.18, 7.5, 10, m.metal, 0, 3.75, 0));
    post.add(box('Post_Arm', 0.12, 0.12, 2.4, m.metal, 0, 7.4, 1.2));
    post.add(box('Post_Luminaire', 0.35, 0.15, 0.9, m.metal, 0, 7.35, 2.3));
    post.add(box('Post_Lamp_Lens', 0.28, 0.05, 0.75, m.carLight, 0, 7.25, 2.3));
    g.add(post);
  }

  // Courtyard Heritage Lantern Posts along the driveway
  const lanternPositions: [number, number][] = [
    [-38, 20], [38, 20], [-68, 28], [68, 28], [-14, 25], [14, 25],
  ];
  lanternPositions.forEach(([lx, lz], i) => {
    const lantern = new THREE.Group();
    lantern.name = `Courtyard_Lantern_${i + 1}`;
    lantern.position.set(lx, 0, lz);
    lantern.add(cylinder('Lantern_Pole', 0.08, 0.14, 4.2, 8, m.metal, 0, 2.1, 0));
    lantern.add(box('Lantern_Head', 0.6, 0.8, 0.6, m.stuccoCream, 0, 4.4, 0));
    lantern.add(box('Lantern_Glass', 0.45, 0.6, 0.45, m.windowGlass, 0, 4.4, 0));
    lantern.add(box('Lantern_Cap', 0.8, 0.2, 0.8, m.metal, 0, 4.85, 0));
    g.add(lantern);
  });

  return g;
}

/**
 * Creates Official VIP Vehicles (Mayor's Official Black Luxury Car & Escort)
 */
function createOfficialVehicles(m: ReturnType<typeof makeMaterials>): THREE.Group {
  const g = new THREE.Group();
  g.name = 'Official_Vehicles';

  function createCar(name: string, x: number, z: number, rotY = 0): THREE.Group {
    const car = new THREE.Group();
    car.name = name;
    car.position.set(x, 0, z);
    car.rotation.y = rotY;

    // Body chassis & cabin
    car.add(box('Car_Body_Lower', 2.3, 0.8, 5.2, m.carBodyBlack, 0, 0.6, 0));
    car.add(box('Car_Body_Cabin', 1.9, 0.75, 3.2, m.carBodyBlack, 0, 1.35, -0.3));
    car.add(box('Car_Windshield', 1.82, 0.65, 3.0, m.windowGlass, 0, 1.35, -0.3));
    car.add(box('Car_Front_Grille', 1.6, 0.45, 0.1, m.carChrome, 0, 0.65, 2.62));
    car.add(box('Car_Headlight_L', 0.45, 0.2, 0.08, m.carLight, -0.8, 0.7, 2.62));
    car.add(box('Car_Headlight_R', 0.45, 0.2, 0.08, m.carLight, 0.8, 0.7, 2.62));

    // Wheels
    for (const wx of [-1.15, 1.15]) {
      for (const wz of [-1.6, 1.6]) {
        const wheel = cylinder(`Car_Wheel_${wx}_${wz}`, 0.4, 0.4, 0.32, 16, m.bwCurbBlack, wx, 0.4, wz);
        wheel.rotation.z = Math.PI / 2;
        car.add(wheel);
      }
    }
    return car;
  }

  // Official Car parked under the porte-cochère
  g.add(createCar('Mayor_Official_Car_1', 0, 12.0, 0));
  // Escort Patrol Car parked near the West Driveway
  g.add(createCar('Escort_Patrol_Car_2', -48, 28.0, Math.PI * 0.12));

  return g;
}

/**
 * Creates Educational, Cultural, and AR Hotspot Anchors across the complex
 */
function createEducationalAnchors(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'Helpers_And_Anchors';

  const anchorData: [string, number, number, number][] = [
    ['Anchor_Main_Entrance_Porte_Cochere', 0, 4.8, 12.0],
    ['Anchor_Central_Residence_High_Roof', 0, 15.0, -14.0],
    ['Anchor_West_Wing_Terrace', -42.5, 3.5, -14.0],
    ['Anchor_East_Wing_Office', 42.5, 3.5, -14.0],
    ['Anchor_Ceremonial_Flagpole', -25.0, 6.0, 32.0],
    ['Anchor_West_Pavilion_Gateway', -65.0, 4.0, 52.0],
    ['Anchor_East_Pavilion_Gateway', 65.0, 4.0, 52.0],
    ['Anchor_Compound_Front_Boulevard', 0, 1.5, 69.0],
  ];

  anchorData.forEach(([name, x, y, z]) => {
    const anchor = new THREE.Object3D();
    anchor.name = name;
    anchor.position.set(x, y, z);
    g.add(anchor);
  });

  return g;
}

/**
 * Master Factory: Creates the procedural 3D model of Rumah Dinas Walikota Palembang
 */
export function createRumahDinasWalikotaModel(spec: RumahDinasWalikotaSpec = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = 'Rumah_Dinas_Walikota_Root';

  const m = makeMaterials();

  // 1. Plinth, Ground, Public Road, and Ceremonial Driveway
  root.add(createPlinthAndDriveway(m));

  // 2. Official Residence Main Building (Colonnade, North-South Pendopo, Central Core, East/West Wings)
  root.add(createResidenceBuilding(m));

  // 3. Pavilion Gateways (Props Kit-Bash #3)
  if (spec.showFenceAndGates !== false) {
    root.add(createPavilionGateway('Pavilion_Gateway_West', -65.0, 52.0, m));
    root.add(createPavilionGateway('Pavilion_Gateway_East', 65.0, 52.0, m));
    root.add(createCompoundFenceAndPerimeter(m));
  }

  // 4. Ceremonial Flagpole flying Merah Putih
  root.add(createCeremonialFlagpole(m));

  // 5. Compound Gardens & Procedural Vegetation
  if (spec.showGardens !== false) {
    root.add(createCompoundGardensAndVegetation(m));
  }

  // 6. Street Lighting & Courtyard Furnishings
  if (spec.showStreetProps !== false) {
    root.add(createStreetPropsAndLighting(m));
  }

  // 7. VIP Official Vehicles
  if (spec.showVehicles !== false) {
    root.add(createOfficialVehicles(m));
  }

  // 8. AR & Educational Hotspots
  root.add(createEducationalAnchors());

  if (spec.scale && spec.scale !== 1.0) {
    root.scale.setScalar(spec.scale);
  }

  return root;
}

export const createModel = createRumahDinasWalikotaModel;
export default createRumahDinasWalikotaModel;
