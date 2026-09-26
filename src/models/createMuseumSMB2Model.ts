import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface MuseumSMB2Spec {
  scale?: number;
  showSideWing?: boolean;
  showHumanFigures?: boolean;
  showCurvedStairs?: boolean;
  showColonnade?: boolean;
  showGardens?: boolean;
}

/**
 * MODELING_ASSUMPTIONS
 * Units are in proposed metres matching the production model sheet:
 * - Base display plinth bounds: Exactly 180.0 m (width, X) by 110.0 m (depth, Z).
 * - Total building height: ~25.0 m to main roof ridge (simbar finials reach ~25.85 m).
 * - Y is Up; (0, 0, 0) is at plaza ground level in front of the building.
 * - Architecture: Gedung Museum Sultan Mahmud Badaruddin II, Palembang.
 *   - Grand 2-story Palembang Dutch-Colonial Royal Palace / Museum building.
 *   - Historic dual-tone facade: warm tan/brown wainscot plinth stucco (lower ~2.4m) and crisp white lime stucco above.
 *   - Iconic dual-sweeping symmetrical curved grand staircase (Modular Curved Stairs Kit, Prop #4).
 *   - Ground floor portal under stairs with arched red double doors and gold relief signage "MUSEUM" (Prop #3).
 *   - Second floor classical colonnade with white Tuscan columns and recessed Palembang lacquer red louvred screen bays.
 *   - Monumental Palembang Limas terracotta hipped roof with broad eaves and ornamental golden Palembang simbar crest finials (Prop #1 & #2).
 *   - Attached 1-story side wing / enclosure wall on the west side with brown plinth, white wall, red doors, and balustrade top.
 *   - Low-poly human scale figures (Prop #5) standing on the plaza conveying architectural grandeur and scale.
 *   - Open front plaza, perimeter street with black/white safety curbs, and garden grounds with organic trees.
 *   - Mid-poly target: ~110,000 tris with optimized AR/Web performance (<20MB GLB).
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

/** The photo shows two outward-flaring flights, not two spiral stair sectors.
 * Each boundary moves toward the plaza as it descends; the outside edge fans
 * away from the central portal while the inside edge stays beside it. */
function stairEdge(side: number, outside: boolean, t: number): THREE.Vector3 {
  const bow = Math.sin(Math.PI * t);
  const x = outside ? 7.7 + 6.5 * t + 1.3 * bow : 3.65 + 1.55 * t + 0.25 * bow;
  const z = outside ? 10.95 + 12.7 * t + 0.4 * bow : 11.05 + 14.1 * t - 0.3 * bow;
  return new THREE.Vector3(side * x, 0, z);
}

function stairTread(name: string, side: number, t0: number, t1: number,
  top: number, mat: THREE.Material): THREE.Mesh {
  const i0 = stairEdge(side, false, t0), o0 = stairEdge(side, true, t0);
  const o1 = stairEdge(side, true, t1), i1 = stairEdge(side, false, t1);
  const p = [i0, o0, o1, i1].map(v => new THREE.Vector3(v.x, top, v.z));
  p.push(...[i0, o0, o1, i1].map(v => new THREE.Vector3(v.x, 0, v.z)));
  const faces = [[0, 1, 2, 3], [7, 6, 5, 4], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]];
  const positions: number[] = [];
  for (const [a, b, c, d] of faces) for (const i of [a, b, c, a, c, d]) positions.push(p[i].x, p[i].y, p[i].z);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.name = name;
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

function stairSideWall(name: string, side: number, outside: boolean,
  landingY: number, mat: THREE.Material): THREE.Mesh {
  const segments = 44;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const edge = stairEdge(side, outside, t);
    const top = landingY * (1 - t) + 0.43;
    for (const offset of [-0.17, 0.17]) {
      positions.push(edge.x + offset, 0, edge.z);
      positions.push(edge.x + offset, top, edge.z);
    }
    if (i < segments) {
      const k = i * 4, n = k + 4;
      for (const [a, b, c, d] of [[k, n, n + 1, k + 1], [k + 2, k + 3, n + 3, n + 2],
        [k + 1, n + 1, n + 3, k + 3], [k, k + 2, n + 2, n]]) indices.push(a, b, c, a, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.name = name;
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

function tube(name: string, points: THREE.Vector3[], radius: number, mat: THREE.Material): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points);
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, points.length === 2 ? 1 : Math.max(20, points.length * 2), radius, 8, false), mat);
  mesh.name = name;
  mesh.castShadow = true;
  return mesh;
}

function roofTileFace(name: string, e0: THREE.Vector3, e1: THREE.Vector3,
  r0: THREE.Vector3, r1: THREE.Vector3, rows: number, columns: number,
  mat: THREE.Material): THREE.Mesh {
  const positions: number[] = [];
  const point = (u: number, v: number) => new THREE.Vector3()
    .lerpVectors(new THREE.Vector3().lerpVectors(e0, e1, u), new THREE.Vector3().lerpVectors(r0, r1, u), v);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const offset = row % 2 ? 0.5 / columns : 0;
      const u0 = THREE.MathUtils.clamp(col / columns + offset, 0, 1);
      const u1 = THREE.MathUtils.clamp((col + 1) / columns + offset, 0, 1);
      const v0 = row / rows, v1 = (row + 1) / rows;
      const a = point(u0, v0), b = point(u1, v0), c = point(u1, v1), d = point(u0, v1);
      const lifted = row % 2 ? 0.085 : 0.045;
      for (const p of [a, b, c, a, c, d]) positions.push(p.x, p.y + lifted, p.z);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.name = name;
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

/**
 * Organic canopy geometry for urban trees (Palembang garden style)
 */
function canopyGeometry(phase = 0): THREE.BufferGeometry {
  const rings = [
    [-0.72, 0], [-0.64, 0.38], [-0.54, 0.60], [-0.40, 0.79], [-0.22, 0.92],
    [0.0, 1.0], [0.22, 0.96], [0.42, 0.85], [0.60, 0.68], [0.74, 0.44], [0.82, 0],
  ] as const;
  const segments = 14;
  const vertices: number[] = [];
  const indices: number[] = [];
  for (let j = 0; j < rings.length; j++) {
    const [height, radius] = rings[j];
    for (let i = 0; i < segments; i++) {
      const angle = (i * Math.PI * 2) / segments;
      const ripple = 1 + 0.085 * Math.cos(angle * 5 + phase)
        + 0.055 * Math.sin(angle * 3 - height * 2 + phase);
      const r = radius * ripple;
      vertices.push(Math.cos(angle) * r, height, Math.sin(angle) * r);
      if (j < rings.length - 1) {
        const a = j * segments + i;
        const b = j * segments + ((i + 1) % segments);
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
    earth: material('Earth_Underside_Base', 0x2e2924, 0.95),
    plazaPaving: material('Plaza_Stone_Paving', 0xc8c2b5, 0.78),
    asphaltRoad: material('City_Road_Asphalt', 0x2c2f34, 0.88),
    roadMarking: material('Road_Lane_Marking', 0xf2eee6, 0.6),
    curbStone: material('Concrete_Curb_Stone', 0xb8b2a7, 0.82),
    bwCurbBlack: material('Safety_Curb_Black', 0x1f2124, 0.85),
    bwCurbWhite: material('Safety_Curb_White', 0xedeae2, 0.8),
    plinthStone: material('Foundation_Plinth_Stone', 0x8c8478, 0.82),
    wainscotBrown: material('Museum_Wainscot_Brown', 0x825036, 0.76),
    stuccoWhite: material('Museum_Stucco_White', 0xf6f4ec, 0.72),
    trimWhite: material('Architectural_Trim_White', 0xffffff, 0.65),
    doorRed: material('Palembang_Lacquer_Red', 0x9e2626, 0.65, 0.1),
    stairTreadDark: material('Grand_Stairs_Dark_Stone', 0x77766f, 0.88),
    stairBalustradeWhite: material('Stair_Balustrade_White', 0xf4f2ea, 0.68),
    roofTerracotta: material('Terracotta_Tile_Roof', 0xb65a3c, 0.82),
    roofRidgeCap: material('Terracotta_Ridge_Cap', 0x943e26, 0.8),
    goldFinial: material('Palembang_Simbar_Gold', 0xd4af37, 0.35, 0.8),
    signDark: material('Museum_Signboard_Dark', 0x1c1d20, 0.7),
    signGold: material('Museum_Sign_Gold_Text', 0xe0bc46, 0.3, 0.85),
    columnWhite: material('Tuscan_Column_White', 0xfaf8f2, 0.68),
    windowGlass: material('Window_Glazing_Reflective', 0x8299a3, 0.36, 0.05, true, 0.78),
    lawnGrass: material('Garden_Lawn_Grass', 0x587c38, 0.9),
    treeFoliage: material('Urban_Tree_Canopy', 0x486e38, 0.88),
    treeFoliageLight: material('Urban_Tree_Canopy_Sunlit', 0x64864a, 0.84),
    treeBark: material('Urban_Tree_Bark', 0x52463a, 0.9),
    metal: material('Streetlight_Metal_Dark', 0x42464c, 0.45, 0.65),
    lampLens: material('Streetlight_Lamp_Lens', 0xffffff, 0.1, 0.2),
    humanSkin: material('Human_Skin_Tone', 0xd8ab8c, 0.85),
    humanShirt: material('Human_Shirt_Teal', 0x4a7268, 0.8),
    humanPants: material('Human_Pants_Slate', 0x687588, 0.8),
  };
}

/**
 * 1. Base Display Plinth, Public Streets, Plaza Paving, and Safety Curbs
 * Bounds: Exactly 180.0 m (width, X) by 110.0 m (depth, Z) matching Section 1 proposed bounds.
 */
function createPlinthAndPlazaEnvironment(m: ReturnType<typeof makeMaterials>): THREE.Group {
  const g = new THREE.Group();
  g.name = 'Plinth_And_Street_Environment';

  const baseW = 180.0, baseD = 110.0;

  // 1. Earth Underside Base Plinth (min Y at -0.6)
  g.add(box('Earth_Underside_Base', baseW, 0.6, baseD, m.earth, 0, -0.3, 0));

  // One continuous stone forecourt. Raised planting beds cover its rear and
  // side margins; the paving itself has no overlapping patchwork rectangles.
  g.add(box('Plaza_Stone_Paving', baseW, 0.2, 89.0, m.plazaPaving, 0, 0.1, -10.5));
  g.add(box('City_Road_Asphalt_Surface', baseW, 0.08, 21.0, m.asphaltRoad, 0, 0.04, 44.5));

  const laneMarks: BlockSpec[] = [];
  for (let x = -84; x <= 84; x += 12) laneMarks.push([4.0, 0.02, 0.18, x, 0.085, 45.0]);
  g.add(repeatedBoxes('Road_Lane_Markings', laneMarks, m.roadMarking));

  const curbBlack: BlockSpec[] = [];
  const curbWhite: BlockSpec[] = [];
  for (let x = -89; x <= 89; x += 2) {
    (Math.round((x + 89) / 2) % 2 ? curbBlack : curbWhite).push([1.98, 0.20, 0.32, x, 0.1, 34]);
  }
  g.add(repeatedBoxes('Safety_Curb_Black', curbBlack, m.bwCurbBlack));
  g.add(repeatedBoxes('Safety_Curb_White', curbWhite, m.bwCurbWhite));

  // The building stays free of trees at the front; planting is limited to
  // three clearly edged beds instead of scattered lawn patches.
  g.add(repeatedBoxes('Garden_Lawn_Verges', [
    [179.5, 0.12, 32.0, 0, 0.26, -39.0],
    [31.0, 0.12, 55.0, -74.2, 0.26, 6.0],
    [31.0, 0.12, 55.0, 74.2, 0.26, 6.0],
  ], m.lawnGrass));
  g.add(repeatedBoxes('Garden_Bed_Stone_Edging', [
    [179.5, 0.16, 0.26, 0, 0.3, -23.0],
    [0.26, 0.16, 55.0, -58.6, 0.3, 6.0],
    [0.26, 0.16, 55.0, 58.6, 0.3, 6.0],
  ], m.curbStone));

  return g;
}

/**
 * 2. Props Kit-Bash #4: Iconic Symmetrical Dual Curved Grand Staircase (~3,600 tris)
 * Sweeps from second-floor balcony landing down in two graceful mirror-image arcs to plaza level.
 */
function createDualCurvedGrandStairs(m: ReturnType<typeof makeMaterials>): THREE.Group {
  const g = new THREE.Group();
  g.name = 'Dual_Curved_Grand_Stairs';

  const landingY = 8.8; // 2nd floor balcony floor level
  const landingZ = 8.8;

  // The approach slab spans the full width of both stair starts. The previous
  // narrow slab stopped at x=+/-4 while each flight began as far as x=+/-7.7,
  // leaving a visible void beneath the top steps when viewed obliquely.
  const landingW = 17.0, landingD = 4.8;
  g.add(box('Stair_Top_Landing_Slab', landingW, 0.45, landingD, m.stairTreadDark, 0, landingY - 0.22, landingZ));
  g.add(box('Stair_Top_Landing_Fascia', landingW + 0.3, 0.3, landingD + 0.3, m.trimWhite, 0, landingY - 0.45, landingZ));

  // Balustrade surrounding the upper balcony landing
  const centerRailW = 7.2;
  const balconyRailSpecs: BlockSpec[] = [
    // Front balcony balustrade handrail
    [centerRailW, 0.16, 0.24, 0, landingY + 1.15, landingZ + landingD / 2],
    [centerRailW, 0.12, 0.24, 0, landingY + 0.1, landingZ + landingD / 2],
  ];
  // Balusters along front balcony
  for (let x = -centerRailW / 2 + 0.4; x <= centerRailW / 2 - 0.4; x += 0.55) {
    balconyRailSpecs.push([0.1, 0.95, 0.1, x, landingY + 0.62, landingZ + landingD / 2]);
  }
  g.add(repeatedBoxes('Balcony_Upper_Balustrade', balconyRailSpecs, m.stairBalustradeWhite));

  // Slender Flagpole on center of balcony balustrade
  g.add(cylinder('Museum_Terrace_Flagpole', 0.05, 0.09, 8.5, 10, m.metal, 0, landingY + 5.2, landingZ + landingD / 2 + 0.1));

  // Entrance Canopy over upper balcony door
  const canopyW = 5.2, canopyD = 3.6, canopyH = 0.8;
  const canopyRoof = hippedRoofX('Balcony_Porch_Canopy_Roof', canopyW, canopyD, canopyH, m.roofTerracotta, 0.6);
  canopyRoof.position.set(0, landingY + 4.8, landingZ);
  g.add(canopyRoof);

  // Mirror-image fan flights. The dark treads are full-depth custom
  // quadrilateral solids so their risers form a continuous stair from the
  // upper gallery down to the ground. White side walls and open balustrades
  // follow the outer and inner curves visible in the reference photograph.
  const numSteps = 23;
  const treadGeometries: THREE.BufferGeometry[] = [];
  const balusterSpecs: BlockSpec[] = [];
  const treadNosings = new THREE.Group();
  treadNosings.name = 'Stair_Tread_Nosings';
  for (const side of [-1, 1]) {
    const suffix = side < 0 ? 'L' : 'R';
    for (const outside of [false, true]) {
      const edgeName = outside ? 'Outer' : 'Inner';
      g.add(stairSideWall(`Curved_Stair_Wall_${edgeName}_${suffix}`, side, outside, landingY, m.stuccoWhite));
      const railPoints: THREE.Vector3[] = [];
      for (let i = 0; i <= 48; i++) {
        const t = i / 48;
        const point = stairEdge(side, outside, t);
        railPoints.push(new THREE.Vector3(point.x,
          landingY * (1 - t) + (outside ? 1.22 : 0.55), point.z));
      }
      g.add(tube(`Curved_Handrail_${edgeName}_${suffix}`, railPoints, 0.12, m.stairBalustradeWhite));
    }
    for (let i = 0; i < numSteps; i++) {
      const t0 = i / numSteps, t1 = (i + 1) / numSteps;
      const stepY = landingY * (1 - t1);
      treadGeometries.push(stairTread(`Curved_Stair_Tread_${suffix}_${i + 1}`, side,
        t0, t1, stepY + 0.02, m.stairTreadDark).geometry);
      const noseInner = stairEdge(side, false, t1);
      const noseOuter = stairEdge(side, true, t1);
      treadNosings.add(tube(`Stone_Nosing_${suffix}_${i + 1}`, [
        new THREE.Vector3(noseInner.x, stepY + 0.075, noseInner.z),
        new THREE.Vector3(noseOuter.x, stepY + 0.075, noseOuter.z),
      ], 0.035, m.plinthStone));
      const edge = stairEdge(side, true, (t0 + t1) / 2);
      balusterSpecs.push([0.11, 0.65, 0.11, edge.x, stepY + 0.83, edge.z]);
    }
    const end = stairEdge(side, true, 1);
    g.add(cylinder(`Stair_Newel_Post_${suffix}`, 0.32, 0.39, 1.45, 14, m.trimWhite, end.x, 0.725, end.z));
    g.add(cylinder(`Stair_Newel_Cap_${suffix}`, 0.20, 0.31, 0.22, 14, m.trimWhite, end.x, 1.55, end.z));
  }
  const mergedTreads = mergeGeometries(treadGeometries, false);
  treadGeometries.forEach(geometry => geometry.dispose());
  if (!mergedTreads) throw new Error('Failed to build paired stair flights');
  const treads = new THREE.Mesh(mergedTreads, m.stairTreadDark);
  treads.name = 'Curved_Stair_Treads';
  treads.castShadow = treads.receiveShadow = true;
  g.add(treads);
  g.add(treadNosings);
  g.add(repeatedBoxes('Curved_Stair_Balustrades', balusterSpecs, m.stairBalustradeWhite));
  g.add(box('Stair_Base_Tiered_Plinth', 31.0, 0.18, 3.0, m.plazaPaving, 0, 0.09, 24.3));

  return g;
}

/**
 * 3. Props Kit-Bash #3: Central Ground Floor Portal Module with "MUSEUM" Text (~1,800 tris)
 * Nestled under the second floor balcony between the two curved stair flights.
 */
function createCentralPortalModule(m: ReturnType<typeof makeMaterials>): THREE.Group {
  const g = new THREE.Group();
  g.name = 'Central_Portal_Module';

  const doorW = 4.0, doorH = 4.8;
  const portalZ = 12.28;
  // The central pier projects from the facade between the two stair flights.
  g.add(box('Central_Entrance_Pier', 6.1, 8.55, 6.1, m.stuccoWhite, 0, 4.275, 9.05));

  // 1. White Classical Arch Frame
  const portalSpecs: BlockSpec[] = [
    // Left & right pilaster jambs
    [0.85, doorH + 0.4, 0.45, -doorW / 2 - 0.425, (doorH + 0.4) / 2, portalZ],
    [0.85, doorH + 0.4, 0.45, doorW / 2 + 0.425, (doorH + 0.4) / 2, portalZ],
    // Molded base blocks
    [1.1, 0.65, 0.55, -doorW / 2 - 0.425, 0.325, portalZ + 0.05],
    [1.1, 0.65, 0.55, doorW / 2 + 0.425, 0.325, portalZ + 0.05],
    // Impost caps
    [1.1, 0.35, 0.55, -doorW / 2 - 0.425, doorH * 0.68, portalZ + 0.05],
    [1.1, 0.35, 0.55, doorW / 2 + 0.425, doorH * 0.68, portalZ + 0.05],
    // Architrave lintel above arch
    [doorW + 2.8, 0.65, 0.5, 0, doorH + 1.25, portalZ],
    [doorW + 3.2, 0.3, 0.65, 0, doorH + 1.7, portalZ + 0.05],
  ];
  g.add(repeatedBoxes('Portal_Arch_Surround', portalSpecs, m.trimWhite));

  // A true extruded semicircular archivolt keeps the opening legible from
  // oblique views; the fanlight and its spokes sit within the same arch.
  const rArch = doorW / 2;
  const archCenterY = doorH * 0.68;
  const archShape = new THREE.Shape();
  archShape.moveTo(-rArch - 0.38, archCenterY);
  archShape.absarc(0, archCenterY, rArch + 0.38, Math.PI, 0, true);
  archShape.lineTo(rArch, archCenterY);
  archShape.absarc(0, archCenterY, rArch, 0, Math.PI, false);
  archShape.closePath();
  const arch = new THREE.Mesh(new THREE.ExtrudeGeometry(archShape, {
    depth: 0.42, bevelEnabled: true, bevelThickness: 0.055, bevelSize: 0.055, bevelSegments: 2, curveSegments: 24,
  }), m.trimWhite);
  arch.name = 'Portal_Arch_Crown';
  arch.position.z = portalZ - 0.22;
  arch.castShadow = true;
  g.add(arch);
  g.add(box('Portal_Arch_Keystone', 0.55, 0.7, 0.56, m.trimWhite, 0, archCenterY + rArch + 0.35, portalZ + 0.05));

  // 2. Mahogany Red Double Entrance Doors with 3D raised panels
  const leafW = (doorW - 0.2) / 2;
  const leafH = doorH * 0.68;
  const doorSpecs: BlockSpec[] = [];
  for (const side of [-1, 1]) {
    const dx = side * (leafW / 2 + 0.05);
    doorSpecs.push([leafW, leafH, 0.14, dx, leafH / 2, portalZ - 0.06]);
    // 3 pairs of raised rectangular molded panels per door
    for (let p = 0; p < 3; p++) {
      const py = 0.55 + p * (leafH / 3.2);
      doorSpecs.push([leafW - 0.28, leafH / 4.2, 0.04, dx, py, portalZ + 0.02]);
      doorSpecs.push([leafW - 0.42, leafH / 5.5, 0.03, dx, py, portalZ + 0.05]);
    }
  }
  g.add(repeatedBoxes('Portal_Red_Double_Doors', doorSpecs, m.doorRed));

  // Door handles
  g.add(box('Portal_Handle_L', 0.06, 0.35, 0.08, m.goldFinial, -0.16, leafH * 0.48, portalZ + 0.08));
  g.add(box('Portal_Handle_R', 0.06, 0.35, 0.08, m.goldFinial, 0.16, leafH * 0.48, portalZ + 0.08));

  // Semicircular glazing and real radial fanlight muntins.
  const glassShape = new THREE.Shape();
  glassShape.moveTo(-rArch + 0.07, archCenterY);
  glassShape.absarc(0, archCenterY, rArch - 0.07, Math.PI, 0, true);
  glassShape.lineTo(-rArch + 0.07, archCenterY);
  const fanGlass = new THREE.Mesh(new THREE.ExtrudeGeometry(glassShape, { depth: 0.04, bevelEnabled: false, curveSegments: 24 }), m.windowGlass);
  fanGlass.name = 'Portal_Fanlight_Glass';
  fanGlass.position.z = portalZ - 0.09;
  g.add(fanGlass);
  const spokes = new THREE.Group();
  spokes.name = 'Portal_Fanlight_Spokes';
  for (let a = 1; a < 6; a++) {
    const angle = a * Math.PI / 6;
    spokes.add(tube(`Fanlight_Radial_Muntin_${a}`, [
      new THREE.Vector3(0, archCenterY, portalZ + 0.04),
      new THREE.Vector3(Math.cos(angle) * (rArch - 0.07), archCenterY + Math.sin(angle) * (rArch - 0.07), portalZ + 0.04),
    ], 0.045, m.doorRed));
  }
  g.add(spokes);

  // 4. Dark Signboard with 3D Gold Inscription "MUSEUM"
  const signW = doorW + 1.8, signH = 1.0;
  g.add(box('Portal_Museum_Signboard', signW, signH, 0.1, m.signDark, 0, doorH + 1.32, portalZ + 0.38));

  // Raised geometric lettering; each lit pixel is a shallow piece of metal.
  const glyphs: Record<string, string[]> = {
    M: ['10001','11011','10101','10001','10001'],
    U: ['10001','10001','10001','10001','01110'],
    S: ['01111','10000','01110','00001','11110'],
    E: ['11111','10000','11110','10000','11111'],
  };
  const letterSpecs: BlockSpec[] = [];
  for (const [letterIndex, letter] of [...'MUSEUM'].entries()) {
    glyphs[letter].forEach((row, rowIndex) => {
      [...row].forEach((pixel, column) => {
        if (pixel === '1') letterSpecs.push([0.075, 0.10, 0.035,
          -2.02 + letterIndex * 0.76 + column * 0.098,
          doorH + 1.58 - rowIndex * 0.105, portalZ + 0.46]);
      });
    });
  }
  g.add(repeatedBoxes('Portal_Museum_Sign_Letters', letterSpecs, m.signGold));

  return g;
}

/**
 * 4. Ground Floor Window Bay (Variant with Arched Transom & Red Casements)
 */
function createGroundWindowBay(name: string, m: ReturnType<typeof makeMaterials>): THREE.Group {
  const g = new THREE.Group();
  g.name = name;

  const bayW = 3.6, bayH = 4.4;
  const frameThk = 0.16;

  // Outer molded white architrave surround
  const frameSpecs: BlockSpec[] = [
    [bayW, frameThk, 0.16, 0, bayH / 2 - frameThk / 2, 0],
    [bayW + 0.35, frameThk * 1.3, 0.22, 0, -bayH / 2 + frameThk / 2, 0.05],
    [frameThk, bayH - frameThk * 2, 0.16, -bayW / 2 + frameThk / 2, 0, 0],
    [frameThk, bayH - frameThk * 2, 0.16, bayW / 2 - frameThk / 2, 0, 0],
    // Horizontal transom bar dividing lower casement from arched fanlight
    [bayW - frameThk * 2, frameThk * 0.85, 0.14, 0, bayH * 0.12, 0.01],
  ];
  g.add(repeatedBoxes(`${name}_Molded_Frame`, frameSpecs, m.trimWhite));

  // Red Casement Window Frame & Glazing (Lower 6 panes)
  const lowerH = bayH * 0.58;
  const lowerW = bayW - frameThk * 2.2;
  const lowerY = -bayH / 2 + lowerH / 2 + frameThk;

  const redBarSpecs: BlockSpec[] = [
    [lowerW, 0.08, 0.06, 0, lowerY + lowerH / 2 - 0.04, 0.02],
    [lowerW, 0.08, 0.06, 0, lowerY - lowerH / 2 + 0.04, 0.02],
    [0.08, lowerH, 0.06, -lowerW / 2 + 0.04, lowerY, 0.02],
    [0.08, lowerH, 0.06, lowerW / 2 - 0.04, lowerY, 0.02],
    // Central vertical mullion
    [0.08, lowerH, 0.06, 0, lowerY, 0.02],
    // Horizontal muntin bars
    [lowerW, 0.05, 0.04, 0, lowerY - lowerH / 6, 0.03],
    [lowerW, 0.05, 0.04, 0, lowerY + lowerH / 6, 0.03],
  ];
  g.add(repeatedBoxes(`${name}_Red_Muntins`, redBarSpecs, m.doorRed));

  // Reflective lower glazing and a half-round upper light with a raised
  // arched masonry surround. This profile is reused on each facade bay.
  g.add(box(`${name}_Glass_Lower`, lowerW - 0.1, lowerH - 0.1, 0.03, m.windowGlass, 0, lowerY, 0));
  const archBase = bayH * 0.12 + 0.08;
  const radius = 1.54;
  const fan = new THREE.Shape();
  fan.moveTo(-radius, archBase);
  fan.absarc(0, archBase, radius, Math.PI, 0, true);
  fan.lineTo(-radius, archBase);
  const fanGlass = new THREE.Mesh(new THREE.ExtrudeGeometry(fan, {depth: 0.03, bevelEnabled: false, curveSegments: 20}), m.windowGlass);
  fanGlass.name = `${name}_Arched_Fanlight_Glass`;
  fanGlass.position.z = 0.015;
  g.add(fanGlass);
  const archFrameShape = new THREE.Shape();
  archFrameShape.moveTo(-radius - 0.14, archBase);
  archFrameShape.absarc(0, archBase, radius + 0.14, Math.PI, 0, true);
  archFrameShape.lineTo(radius, archBase);
  archFrameShape.absarc(0, archBase, radius, 0, Math.PI, false);
  archFrameShape.closePath();
  const archFrame = new THREE.Mesh(new THREE.ExtrudeGeometry(archFrameShape, {
    depth: 0.12, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 1, curveSegments: 20,
  }), m.trimWhite);
  archFrame.name = `${name}_Arched_Masonry_Surround`;
  archFrame.position.z = 0.04;
  g.add(archFrame);
  for (let spoke = 1; spoke <= 3; spoke++) {
    const a = spoke * Math.PI / 4;
    g.add(tube(`${name}_Fanlight_Spoke_${spoke}`, [
      new THREE.Vector3(0, archBase, 0.17),
      new THREE.Vector3(Math.cos(a) * radius, archBase + Math.sin(a) * radius, 0.17),
    ], 0.035, m.doorRed));
  }

  return g;
}

/**
 * 5. Main Museum Building Body, Colonnade Gallery, and Limas Terracotta Roof
 */
function createMuseumSMB2Building(spec: MuseumSMB2Spec, m: ReturnType<typeof makeMaterials>): THREE.Group {
  const root = new THREE.Group();
  root.name = 'Building_Museum_SMB2_Main';

  // Overall Main Core Footprint: 60m width (X in [-30, 30]), 24m depth (Z in [-18, 6], center Z = -6)
  const mainW = 60.0, mainD = 24.0;
  const mainX = 0, mainZ = -6.0;

  // 1. Foundation Stone Plinth Base
  const plinthH = 1.0;
  root.add(box('Foundation_Plinth_Base', mainW + 2.0, plinthH, mainD + 2.0, m.plinthStone, mainX, plinthH / 2, mainZ));
  root.add(box('Foundation_Plinth_Cornice', mainW + 2.4, 0.22, mainD + 2.4, m.trimWhite, mainX, plinthH + 0.11, mainZ));

  // 2. Ground Floor Body
  const gBaseY = plinthH + 0.22; // 1.22m
  const gFloorH = 7.0;
  const wainscotH = 2.4; // Lower warm brown stucco

  // Lower brown wainscot stucco
  root.add(box('Main_Ground_Wainscot_Plinth', mainW, wainscotH, mainD, m.stuccoWhite, mainX, gBaseY + wainscotH / 2, mainZ));
  root.add(box('Plinth_Wainscot_Torus_Trim', mainW + 0.35, 0.16, mainD + 0.35, m.trimWhite, mainX, gBaseY + wainscotH + 0.08, mainZ));

  // Upper white stucco ground floor wall
  const upperGroundH = gFloorH - wainscotH;
  root.add(box('Main_Ground_Stucco_Wall', mainW, upperGroundH, mainD, m.stuccoWhite, mainX, gBaseY + wainscotH + 0.16 + upperGroundH / 2, mainZ));

  // Ground Floor Classical Pilasters (vertical white dividing piers)
  const pilasterSpecs: BlockSpec[] = [];
  const colSpacing = 5.6; // Spacing of 10 bays = 56m between X = -28 and +28

  for (let i = 0; i <= 10; i++) {
    const px = -28.0 + i * colSpacing;
    // Skip central 2 bays where the curved stairs and portal connect
    if (Math.abs(px) > 3.5) {
      pilasterSpecs.push([0.65, gFloorH + 0.2, 0.22, mainX + px, gBaseY + (gFloorH + 0.2) / 2, mainZ + mainD / 2 + 0.11]);
      pilasterSpecs.push([0.85, 0.35, 0.3, mainX + px, gBaseY + 0.175, mainZ + mainD / 2 + 0.15]);
      pilasterSpecs.push([0.85, 0.35, 0.3, mainX + px, gBaseY + gFloorH - 0.175, mainZ + mainD / 2 + 0.15]);
    }
  }
  root.add(repeatedBoxes('Ground_Floor_Pilasters', pilasterSpecs, m.trimWhite));

  // Ground Floor Window Bays
  for (let i = 0; i < 10; i++) {
    const wx = -28.0 + (i + 0.5) * colSpacing;
    if (Math.abs(wx) > 4.5) {
      const win = createGroundWindowBay(`Ground_Window_South_${i + 1}`, m);
      win.position.set(mainX + wx, gBaseY + gFloorH / 2 + 0.2, mainZ + mainD / 2 + 0.06);
      root.add(win);
    }
  }

  // East & West Ground Floor Window Bays
  for (const side of [-1, 1]) {
    for (let j = 0; j < 3; j++) {
      const wz = mainZ + (j - 1) * 6.5;
      const win = createGroundWindowBay(`Ground_Window_${side < 0 ? 'West' : 'East'}_${j + 1}`, m);
      win.position.set(mainX + side * (mainW / 2 + 0.06), gBaseY + gFloorH / 2 + 0.2, wz);
      win.rotation.y = side * (Math.PI / 2);
      root.add(win);
    }
  }

  // Intermediate Floor Cornice / Stringcourse (Separating Ground and Second Floor)
  const floorCorniceY = gBaseY + gFloorH; // ~8.22m
  root.add(box('Intermediate_Floor_Cornice', mainW + 1.2, 0.4, mainD + 1.2, m.trimWhite, mainX, floorCorniceY + 0.2, mainZ));
  root.add(box('Intermediate_Floor_Molding', mainW + 1.5, 0.18, mainD + 1.5, m.trimWhite, mainX, floorCorniceY + 0.49, mainZ));

  // 3. Central Portal Module (under stairs)
  root.add(createCentralPortalModule(m));

  // 4. Second Floor Upper Colonnade Gallery (Tuscan Columns & Red Louvred Bays)
  const secFloorBaseY = floorCorniceY + 0.58; // ~8.80m
  const colH = 6.4;
  const colRadius = 0.32;

  if (spec.showColonnade !== false) {
    const colonnadeGroup = new THREE.Group();
    colonnadeGroup.name = 'Upper_Colonnade_Gallery';

    // Unified Entablature Beam across top of second floor columns
    const entablatureSpecs: BlockSpec[] = [
      // Front beam (aligned with front columns at Z = 6.0)
      [mainW - 1.6, 0.55, 0.95, mainX, secFloorBaseY + colH + 0.275, mainZ + mainD / 2],
      // Back beam
      [mainW - 1.6, 0.55, 0.95, mainX, secFloorBaseY + colH + 0.275, mainZ - mainD / 2],
      // East side beam (aligned with east columns at X = 28.0)
      [0.95, 0.55, mainD, mainX + 28.0, secFloorBaseY + colH + 0.275, mainZ],
      // West side beam (aligned with west columns at X = -28.0)
      [0.95, 0.55, mainD, mainX - 28.0, secFloorBaseY + colH + 0.275, mainZ],
      // Projecting top cornice molding
      [mainW + 0.8, 0.22, mainD + 0.8, mainX, secFloorBaseY + colH + 0.66, mainZ],
    ];
    colonnadeGroup.add(repeatedBoxes('Colonnade_Entablature', entablatureSpecs, m.trimWhite));

    // Classical Tuscan Columns & Balustrades
    const colBaseSpecs: BlockSpec[] = [];
    const redScreenSpecs: BlockSpec[] = [];

    // Front Colonnade: 11 columns from X = -28.0 to +28.0 at Z = 6.0
    for (let i = 0; i <= 10; i++) {
      const cx = -28.0 + i * colSpacing;
      // Plinth base block
      colBaseSpecs.push([0.78, 0.35, 0.78, cx, secFloorBaseY + 0.175, mainZ + mainD / 2]);
      // Capital block
      colBaseSpecs.push([0.78, 0.32, 0.78, cx, secFloorBaseY + colH - 0.16, mainZ + mainD / 2]);
      // Cylindrical shaft
      colonnadeGroup.add(cylinder(`Column_Front_${i + 1}`, colRadius * 0.92, colRadius, colH - 0.7, 14, m.columnWhite, cx, secFloorBaseY + colH / 2, mainZ + mainD / 2));

      // Balustrade between column bases
      if (i < 10) {
        const midX = cx + colSpacing / 2;
        colBaseSpecs.push([colSpacing - 0.8, 0.12, 0.16, midX, secFloorBaseY + 1.05, mainZ + mainD / 2]);
        colBaseSpecs.push([colSpacing - 0.8, 0.1, 0.16, midX, secFloorBaseY + 0.18, mainZ + mainD / 2]);
        for (let b = 1; b <= 5; b++) {
          colBaseSpecs.push([0.08, 0.75, 0.08, cx + b * (colSpacing / 6), secFloorBaseY + 0.62, mainZ + mainD / 2]);
        }
      }
    }

    // East & West Colonnade Columns (3 intermediate columns on each side at Z = 0.5, -6.0, -12.5)
    for (const side of [-1, 1]) {
      const sx = side * 28.0;
      for (const sz of [0.5, -6.0, -12.5]) {
        colBaseSpecs.push([0.78, 0.35, 0.78, sx, secFloorBaseY + 0.175, sz]);
        colBaseSpecs.push([0.78, 0.32, 0.78, sx, secFloorBaseY + colH - 0.16, sz]);
        colonnadeGroup.add(cylinder(`Column_Side_${side < 0 ? 'W' : 'E'}_${sz}`, colRadius * 0.92, colRadius, colH - 0.7, 14, m.columnWhite, sx, secFloorBaseY + colH / 2, sz));
      }
    }
    colonnadeGroup.add(repeatedBoxes('Column_Bases_And_Balustrade', colBaseSpecs, m.trimWhite));

    // Recessed Red Louvred Timber Screens (set back 0.7m behind columns at Z = 5.3)
    const screenZ = mainZ + mainD / 2 - 0.7;
    for (let i = 0; i < 10; i++) {
      const midX = -28.0 + (i + 0.5) * colSpacing;
      const panelW = colSpacing - 0.4;
      const panelH = colH - 0.2;

      // Outer screen frame
      redScreenSpecs.push([panelW, 0.12, 0.1, midX, secFloorBaseY + panelH - 0.06, screenZ]);
      redScreenSpecs.push([panelW, 0.12, 0.1, midX, secFloorBaseY + 0.06, screenZ]);
      redScreenSpecs.push([0.12, panelH, 0.1, midX - panelW / 2 + 0.06, secFloorBaseY + panelH / 2, screenZ]);
      redScreenSpecs.push([0.12, panelH, 0.1, midX + panelW / 2 - 0.06, secFloorBaseY + panelH / 2, screenZ]);
      redScreenSpecs.push([0.09, panelH, 0.08, midX, secFloorBaseY + panelH / 2, screenZ]);

      // Horizontal transom bar
      redScreenSpecs.push([panelW, 0.08, 0.08, midX, secFloorBaseY + panelH * 0.65, screenZ]);

      // Tall timber glazing divisions visible between the white columns.
      for (let division = 1; division <= 4; division++) {
        redScreenSpecs.push([0.08, panelH - 0.22, 0.055,
          midX - panelW / 2 + division * panelW / 5,
          secFloorBaseY + panelH / 2, screenZ + 0.02]);
      }
      redScreenSpecs.push([panelW - 0.28, 0.09, 0.055, midX, secFloorBaseY + panelH * 0.76, screenZ + 0.02]);
      redScreenSpecs.push([panelW - 0.28, 0.10, 0.055, midX, secFloorBaseY + panelH * 0.21, screenZ + 0.02]);
    }
    colonnadeGroup.add(repeatedBoxes('Upper_Red_Louvred_Screens', redScreenSpecs, m.doorRed));

    // A shallow plaster backing closes every bay. The tinted glazing is
    // translucent, so it needs a real surface behind it instead of showing
    // the unlit gallery cavity as a black hole.
    colonnadeGroup.add(box('Upper_Gallery_Window_Backing', mainW - 4.0, colH * 0.9,
      0.16, m.stuccoWhite, mainX, secFloorBaseY + colH / 2, screenZ - 0.30));

    // Glazing pane behind the timber mullions.
    colonnadeGroup.add(box('Gallery_Glazing_Panes', mainW - 4.0, colH * 0.9, 0.03, m.windowGlass, mainX, secFloorBaseY + colH / 2, screenZ - 0.02));

    root.add(colonnadeGroup);
  }

  // Second Floor Core Wall
  const secWallH = colH + 0.8;
  root.add(box('Main_Second_Floor_Wall', mainW - 3.6, secWallH, mainD - 3.6, m.stuccoWhite, mainX, secFloorBaseY + secWallH / 2, mainZ - 0.5));

  // 5. Monumental Palembang Limas Terracotta Roof (~25.0 m peak height!)
  const roofBaseY = secFloorBaseY + secWallH; // ~16.00 m
  const roofH = 9.0; // Peak reaches exactly 25.0 m!
  const roofOverhang = 2.0;
  const roofW = mainW + roofOverhang * 2; // 64.0 m
  const roofD = mainD + roofOverhang * 2; // 28.0 m

  // Single Unified Limas Hipped Terracotta Roof
  const mainLimasRoof = hippedRoofX('Building_Museum_SMB2_Roof', roofW, roofD, roofH, m.roofTerracotta, 0.5);
  mainLimasRoof.position.set(mainX, roofBaseY, mainZ);
  root.add(mainLimasRoof);

  // Course geometry on all four roof slopes. Its staggered edges read as
  // terracotta shingles from the top and from normal street-level viewpoints.
  const roofTiles = new THREE.Group();
  roofTiles.name = 'Terracotta_Roof_Tile_Courses';
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x + mainX, y + roofBaseY, z + mainZ);
  roofTiles.add(roofTileFace('South_Roof_Tile_Courses', v(-32, 0, 14), v(32, 0, 14), v(-16, 9, 0), v(16, 9, 0), 20, 64, m.roofTerracotta));
  roofTiles.add(roofTileFace('North_Roof_Tile_Courses', v(32, 0, -14), v(-32, 0, -14), v(16, 9, 0), v(-16, 9, 0), 20, 64, m.roofTerracotta));
  roofTiles.add(roofTileFace('East_Hip_Tile_Courses', v(32, 0, 14), v(32, 0, -14), v(16, 9, 0), v(16, 9, 0), 20, 28, m.roofTerracotta));
  roofTiles.add(roofTileFace('West_Hip_Tile_Courses', v(-32, 0, -14), v(-32, 0, 14), v(-16, 9, 0), v(-16, 9, 0), 20, 28, m.roofTerracotta));
  root.add(roofTiles);

  // Eave Fascia Trim
  root.add(box('Roof_Eave_Fascia_Trim', roofW + 0.2, 0.22, roofD + 0.2, m.trimWhite, mainX, roofBaseY + 0.11, mainZ));

  // Terracotta Ridge Cap Roll along the main ridge ($Y = 25.0 m$)
  const mainRidgeLen = roofW * 0.5 * 2; // 32.0 m
  root.add(box('Main_Roof_Ridge_Cap', mainRidgeLen, 0.26, 0.5, m.roofRidgeCap, mainX, roofBaseY + roofH, mainZ));

  // Stepped Hip Ridge Caps along the 4 diagonal hips (Props Kit-Bash #2)
  const hw = roofW / 2, hd = roofD / 2, hr = hw * 0.5;
  const hipCaps = new THREE.Group();
  hipCaps.name = 'Roof_Hip_Ridge_Caps';
  const hipCorners: [number, number, number, number, number, number][] = [
    [-hw, 0, -hd, -hr, roofH, 0],
    [-hw, 0, hd, -hr, roofH, 0],
    [hw, 0, -hd, hr, roofH, 0],
    [hw, 0, hd, hr, roofH, 0],
  ];
  for (const [x1, y1, z1, x2, y2, z2] of hipCorners) {
    hipCaps.add(tube('Continuous_Terracotta_Hip_Cap', [
      v(x1, y1 + 0.16, z1), v(x2, y2 + 0.16, z2),
    ], 0.23, m.roofRidgeCap));
  }
  root.add(hipCaps);

  // Ornamental Golden Palembang Simbar Finials along main ridge (Props Kit-Bash #1)
  const simbarPositions = [-mainRidgeLen / 2, -mainRidgeLen / 4, 0, mainRidgeLen / 4, mainRidgeLen / 2];
  simbarPositions.forEach((sx, idx) => {
    const finialGroup = new THREE.Group();
    finialGroup.name = `Palembang_Simbar_Finial_${idx + 1}`;
    finialGroup.position.set(mainX + sx, roofBaseY + roofH + 0.25, mainZ);

    const baseCone = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.28, 0.5, 10), m.goldFinial);
    finialGroup.add(baseCone);

    const hornLeft = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.55, 0.12), m.goldFinial);
    hornLeft.position.set(-0.2, 0.28, 0);
    hornLeft.rotation.z = Math.PI * 0.16;
    finialGroup.add(hornLeft);

    const hornRight = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.55, 0.12), m.goldFinial);
    hornRight.position.set(0.2, 0.28, 0);
    hornRight.rotation.z = -Math.PI * 0.16;
    finialGroup.add(hornRight);

    root.add(finialGroup);
  });

  // 6. Iconic Symmetrical Dual Curved Grand Staircase (Props Kit-Bash #4)
  if (spec.showCurvedStairs !== false) {
    root.add(createDualCurvedGrandStairs(m));
  }

  // 7. Attached 1-Story Side Wing / Enclosure Wall on West Side (Directly flush with west wall)
  if (spec.showSideWing !== false) {
    const wing = new THREE.Group();
    wing.name = 'Museum_Side_Wing';

    const wingW = 22.0, wingD = 16.0, wingH = 5.2;
    const wingX = mainX - mainW / 2 - wingW / 2; // -41.0 m (flush with west wall at -30m)
    const wingZ = mainZ - 2.0; // -8.0 m, front face at Z = 0.0

    // Wing Foundation Plinth Base (perfectly aligned with main building plinth!)
    wing.add(box('Side_Wing_Plinth_Base', wingW, plinthH, wingD, m.plinthStone, wingX, plinthH / 2, wingZ));

    // Wing Brown Wainscot Plinth (height 2.4m, perfectly aligned with main building wainscot!)
    wing.add(box('Side_Wing_Wainscot_Plinth', wingW, wainscotH, wingD, m.wainscotBrown, wingX, gBaseY + wainscotH / 2, wingZ));
    wing.add(box('Side_Wing_Plinth_Trim', wingW, 0.16, wingD + 0.1, m.trimWhite, wingX, gBaseY + wainscotH + 0.08, wingZ));

    // Wing White Upper Wall
    const wingUpperH = wingH - wainscotH;
    wing.add(box('Side_Wing_Stucco_Wall', wingW, wingUpperH, wingD, m.stuccoWhite, wingX, gBaseY + wainscotH + 0.16 + wingUpperH / 2, wingZ));

    // Wing Balustrade Parapet along front top
    const parapetSpecs: BlockSpec[] = [
      [wingW, 0.16, 0.3, wingX, gBaseY + wingH + 0.7, wingZ + wingD / 2],
      [wingW, 0.12, 0.3, wingX, gBaseY + wingH + 0.08, wingZ + wingD / 2],
    ];
    for (let bx = -wingW / 2 + 0.6; bx <= wingW / 2 - 0.6; bx += 0.85) {
      parapetSpecs.push([0.1, 0.55, 0.1, wingX + bx, gBaseY + wingH + 0.4, wingZ + wingD / 2]);
    }
    wing.add(repeatedBoxes('Side_Wing_Parapet_Balustrade', parapetSpecs, m.trimWhite));

    // Red Paneled Service Door on Wing Front
    wing.add(box('Side_Wing_Red_Door', 2.2, 3.0, 0.1, m.doorRed, wingX - 4.0, gBaseY + 1.5, wingZ + wingD / 2 + 0.06));

    root.add(wing);
  }

  return root;
}

/**
 * 6. Props Kit-Bash #5: Small Scale Human Figure Prop (~150 tris each)
 * Stylized low-poly visitor figures standing on the plaza to convey human scale.
 */
function createHumanFigureProp(name: string, m: ReturnType<typeof makeMaterials>): THREE.Group {
  const g = new THREE.Group();
  g.name = name;

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), m.humanSkin);
  head.position.y = 1.66;
  g.add(head);

  // Torso / Shirt
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.16, 0.62, 8), m.humanShirt);
  torso.position.y = 1.25;
  g.add(torso);

  // Arms
  const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.55, 6), m.humanShirt);
  armL.position.set(-0.24, 1.22, 0);
  g.add(armL);
  const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.55, 6), m.humanShirt);
  armR.position.set(0.24, 1.22, 0);
  g.add(armR);

  // Legs / Pants
  const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.88, 6), m.humanPants);
  legL.position.set(-0.1, 0.48, 0);
  g.add(legL);
  const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.88, 6), m.humanPants);
  legR.position.set(0.1, 0.48, 0);
  g.add(legR);

  return g;
}

/**
 * 7. Plaza Lighting & Visitor Figures
 */
function createPlazaPropsAndFigures(spec: MuseumSMB2Spec, m: ReturnType<typeof makeMaterials>): THREE.Group {
  const g = new THREE.Group();
  g.name = 'Plaza_Props_And_Figures';

  // Human scale figures placed on the plaza (Prop #5)
  if (spec.showHumanFigures !== false) {
    const figures = new THREE.Group();
    figures.name = 'Scale_Human_Figures';

    const figurePositions: [number, number, number][] = [
      [-12.0, 0.0, 18.0],
      [12.0, 0.0, 18.0],
      [-34.0, 0.0, 14.0],
    ];

    figurePositions.forEach(([fx, fy, fz], idx) => {
      const fig = createHumanFigureProp(`Human_Figure_${idx + 1}`, m);
      fig.position.set(fx, fy, fz);
      fig.rotation.y = idx * 0.8 - 0.4;
      figures.add(fig);
    });

    g.add(figures);
  }

  // Streetlights along the perimeter sidewalk
  const mastGeo = new THREE.CylinderGeometry(0.09, 0.16, 7.2, 10);
  const lampPositions: [number, number][] = [
    [-61.0, 31.0], [61.0, 31.0],
  ];

  lampPositions.forEach(([lx, lz], i) => {
    const post = new THREE.Group();
    post.name = `City_Streetlight_${i + 1}`;
    post.position.set(lx, 0, lz);

    const mast = new THREE.Mesh(mastGeo, m.metal);
    mast.position.y = 3.6;
    post.add(mast);
    post.add(box('Streetlight_Arm', 0.12, 0.12, 2.2, m.metal, 0, 7.1, 1.1));
    post.add(box('Streetlight_Luminaire', 0.42, 0.18, 0.85, m.metal, 0, 7.05, 2.1));
    post.add(box('Streetlight_Lens', 0.32, 0.06, 0.72, m.lampLens, 0, 6.94, 2.1));

    g.add(post);
  });

  return g;
}

/**
 * 8. Organic Trees framing the side & rear grounds (matching Top View Plan)
 */
function createGardenTrees(m: ReturnType<typeof makeMaterials>): THREE.Group {
  const g = new THREE.Group();
  g.name = 'Garden_Trees_And_Landscaping';

  const crownGeos = [canopyGeometry(0), canopyGeometry(1.7), canopyGeometry(3.14)];
  const trunkGeo = new THREE.CylinderGeometry(0.11, 0.23, 2.55, 12);

  const treePositions: [number, number, number][] = [
    [-73.0, -42.0, 2.4], [-54.0, -42.0, 2.5], [-35.0, -42.0, 2.3],
    [-14.0, -43.0, 2.6], [11.0, -43.0, 2.4], [34.0, -42.0, 2.5],
    [56.0, -42.0, 2.35], [75.0, -42.0, 2.4],
    [-74.0, -8.0, 2.45], [-74.0, 19.0, 2.3],
    [74.0, -8.0, 2.45], [74.0, 19.0, 2.3],
  ];

  treePositions.forEach(([tx, tz, tsize], i) => {
    const tree = new THREE.Group();
    tree.name = `Garden_Tree_${i + 1}`;
    tree.position.set(tx, 0, tz);

    const trunk = new THREE.Mesh(trunkGeo, m.treeBark);
    trunk.position.y = 1.3 * tsize;
    trunk.scale.set(tsize, tsize, tsize);
    tree.add(trunk);

    // A forked crown with visible branch structure and overlapping, irregular
    // leaf masses, rather than a single spherical top on a cylinder.
    const crown = new THREE.Group();
    crown.name = `Garden_Tree_${i + 1}_Branched_Crown`;
    const branchCount = 11;
    for (let j = 0; j < branchCount; j++) {
      const angle = (j / branchCount) * Math.PI * 2 + i * 0.51;
      const reach = (j % 3 === 0 ? 1.35 : 1.05) * tsize;
      const x = Math.cos(angle) * reach;
      const z = Math.sin(angle) * reach;
      const endY = (2.35 + (j % 3) * 0.16) * tsize;
      crown.add(tube(`Branch_${j + 1}`, [
        new THREE.Vector3(0, 1.65 * tsize, 0),
        new THREE.Vector3(x * 0.42, 2.05 * tsize, z * 0.42),
        new THREE.Vector3(x, endY, z),
      ], 0.065 * tsize, m.treeBark));
      const leaves = new THREE.Mesh(crownGeos[(i + j) % crownGeos.length],
        j % 3 === 0 ? m.treeFoliageLight : m.treeFoliage);
      leaves.name = `Foliage_Cluster_${j + 1}`;
      leaves.position.set(x, endY + 0.22 * tsize, z);
      leaves.scale.set(tsize * (j % 2 ? 0.52 : 0.63), tsize * 0.55, tsize * 0.58);
      leaves.rotation.y = i * 0.7 + j * 0.9;
      crown.add(leaves);
    }
    const apex = new THREE.Mesh(crownGeos[i % crownGeos.length], m.treeFoliageLight);
    apex.name = 'Upper_Foliage_Mass';
    apex.position.set(0, 2.8 * tsize, 0);
    apex.scale.set(0.68 * tsize, 0.64 * tsize, 0.67 * tsize);
    crown.add(apex);
    tree.add(crown);

    g.add(tree);
  });

  return g;
}

/**
 * 9. Educational, Historical, and AR Hotspot Anchors
 */
function createEducationalAnchors(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'Helpers_And_Anchors';

  const anchorData: [string, number, number, number][] = [
    ['Anchor_Curved_Grand_Stairs', 0, 4.5, 18.0],
    ['Anchor_Central_Portal_Museum', 0, 3.2, 12.3],
    ['Anchor_Second_Floor_Colonnade', 0, 12.5, 6.0],
    ['Anchor_Limas_Roof_Finials', 0, 25.0, -6.0],
    ['Anchor_Terrace_Flagpole', 0, 14.8, 11.2],
    ['Anchor_Museum_Side_Wing', -41.0, 3.5, -8.0],
    ['Anchor_Plaza_Visitor_Arrival', 0, 1.0, 22.0],
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
 * Master Factory: Creates the procedural 3D model of Gedung Museum Sultan Mahmud Badaruddin II
 */
export function createMuseumSMB2Model(spec: MuseumSMB2Spec = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = 'Museum_SMB2_Root';

  const m = makeMaterials();

  // 1. Plinth, Public Streets, Plaza Paving, and Safety Curbs
  root.add(createPlinthAndPlazaEnvironment(m));

  // 2. Main Museum Building Body, Colonnade, Limas Roof, Dual Curved Stairs, and Side Wing
  root.add(createMuseumSMB2Building(spec, m));

  // 3. Plaza Lighting & Scale Human Figures (Prop #5)
  root.add(createPlazaPropsAndFigures(spec, m));

  // 4. Garden Trees & Landscaping
  if (spec.showGardens !== false) {
    root.add(createGardenTrees(m));
  }

  // 5. Calibrated AR & Educational Anchors
  root.add(createEducationalAnchors());

  if (spec.scale && spec.scale !== 1.0) {
    root.scale.setScalar(spec.scale);
  }

  return root;
}

export const createModel = createMuseumSMB2Model;
export default createMuseumSMB2Model;
