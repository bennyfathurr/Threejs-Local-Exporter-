import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface GedungVanDerBerjSpec {
  scale?: number;
  showAnnex?: boolean;
  showStreetProps?: boolean;
  showModularWindows?: boolean;
  showEntranceDetails?: boolean;
  showContextBuildings?: boolean;
}

/**
 * MODELING_ASSUMPTIONS
 * Units are in proposed metres matching the reference sheet:
 * - The overview proposes a 180 m by 110 m display base; the orthographic labels conflict, so the existing base scale is retained.
 * - Total building height: ~25.0 m to the main roof apex.
 * - Y is Up; (0, 0, 0) is at street level near the center of the display base.
 * - Architectural and material details are interpretations of the supplied concept sheet, not surveyed facts.
 *   - Historic 2-story Dutch colonial trading house building with 1-story side annex.
 *   - Distinctive dual-tone color scheme: rich reddish-brown / maroon wainscot plinth stucco (lower ~3.2m)
 *     and warm ochre / mustard yellow stucco on upper walls.
 *   - Colonial blue double doors and louvred shutters (Prop Variant B).
 *   - White / cream architectural moldings, trims, and multi-pane casement windows (Prop Variant A).
 *   - Detailed entrance unit with molded portal, blue doors, geometric ventilation grille, and plaque "GEDUNG VAN DER BERG" (Prop #3).
 *   - Continuous intermediate pent roof eave awning with corbels separating ground and second floors.
 *   - Monumental hipped terracotta roof (~25m peak) with overhanging eaves, rafter brackets, and ridge caps.
 *   - Urban street corner setting with curved sidewalk, alternating black/white safety curbs, asphalt roads, zebra crossings, and city streetlights (Prop #5).
 *   - Mid-poly target: ~110,000 tris with optimized city context framing.
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

/** The street-facing ground floor has a rounded southeast corner in the reference. */
function roundedGroundVolume(
  name: string, width: number, height: number, depth: number, radius: number,
  mat: THREE.Material, x: number, y: number, z: number,
): THREE.Mesh {
  const hw = width / 2, hd = depth / 2;
  // Shape Y is -world Z after rotation; round the +X/+Z street corner.
  const shape = new THREE.Shape();
  shape.moveTo(-hw, -hd);
  shape.lineTo(hw - radius, -hd);
  shape.quadraticCurveTo(hw, -hd, hw, -hd + radius);
  shape.lineTo(hw, hd);
  shape.lineTo(-hw, hd);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height, bevelEnabled: false, curveSegments: 10, steps: 1,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.name = name;
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Small raised terracotta facets follow all four actual roof slopes. */
function detailHippedRoof(
  roof: THREE.Mesh, width: number, depth: number, height: number,
  ridgeRatio: number, m: ReturnType<typeof makeMaterials>, pitch = 0.95,
): void {
  const hw = width / 2, hd = depth / 2, hr = hw * ridgeRatio;
  type Point = [number, number, number];
  const faces: [Point, Point, Point, Point][] = [
    [[-hw, 0, hd], [hw, 0, hd], [-hr, height, 0], [hr, height, 0]],
    [[hw, 0, -hd], [-hw, 0, -hd], [hr, height, 0], [-hr, height, 0]],
    [[hw, 0, hd], [hw, 0, -hd], [hr, height, 0], [hr, height, 0]],
    [[-hw, 0, -hd], [-hw, 0, hd], [-hr, height, 0], [-hr, height, 0]],
  ];
  const positions: number[] = [], colors: number[] = [];
  const palette = [0xb35c3e, 0xb75f40, 0xb96041, 0xb55d3d, 0xbb6242]
    .map(value => new THREE.Color(value));
  const mix = (a: Point, b: Point, t: number): Point => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
  const add = (p: Point, color: THREE.Color, lift = 0) => {
    positions.push(p[0], p[1] + 0.05 + lift, p[2]);
    colors.push(color.r, color.g, color.b);
  };
  faces.forEach(([e0, e1, r0, r1], face) => {
    const rows = Math.max(4, Math.round(Math.hypot(hd, height) / pitch));
    const cols = Math.max(5, Math.round((face < 2 ? width : depth) / pitch));
    const point = (u: number, v: number) => mix(mix(e0, e1, u), mix(r0, r1, u), v);
    for (let row = 0; row < rows; row++) {
      const v0 = (row + 0.025) / rows;
      const v1 = (row + 0.975) / rows;
      for (let col = 0; col < cols; col++) {
        const u0 = (col + 0.025) / cols;
        const u1 = (col + 0.975) / cols;
        const um = (u0 + u1) / 2;
        const a = point(u0, v0), b = point(um, v0), c = point(u1, v0);
        const d = point(u0, v1), e = point(um, v1), f = point(u1, v1);
        const shade = palette[(face * 7 + row * 3 + col * 2) % palette.length];
        add(a, shade); add(b, shade, 0.06); add(d, shade);
        add(b, shade, 0.06); add(e, shade, 0.06); add(d, shade);
        add(b, shade, 0.06); add(c, shade); add(e, shade, 0.06);
        add(c, shade); add(f, shade); add(e, shade, 0.06);
      }
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const tiles = new THREE.Mesh(geometry, m.roofTiles);
  tiles.name = `${roof.name}_Raised_Terracotta_Tiles`;
  tiles.castShadow = true;
  tiles.receiveShadow = true;
  roof.add(tiles);
}

function roofHipCaps(
  name: string, width: number, depth: number, height: number,
  ridgeRatio: number, mat: THREE.Material,
): THREE.Mesh {
  const hw = width / 2, hd = depth / 2, hr = hw * ridgeRatio;
  const segments: THREE.BufferGeometry[] = [];
  for (const sideX of [-1, 1]) for (const sideZ of [-1, 1]) {
    segments.push(new THREE.TubeGeometry(new THREE.LineCurve3(
      new THREE.Vector3(sideX * hw, 0.12, sideZ * hd),
      new THREE.Vector3(sideX * hr, height + 0.12, 0),
    ), 14, 0.16, 6, false));
  }
  segments.push(new THREE.TubeGeometry(new THREE.LineCurve3(
    new THREE.Vector3(-hr, height + 0.12, 0),
    new THREE.Vector3(hr, height + 0.12, 0),
  ), 14, 0.19, 6, false));
  const merged = mergeGeometries(segments, false);
  segments.forEach(segment => segment.dispose());
  if (!merged) throw new Error(`Cannot construct roof caps: ${name}`);
  const mesh = new THREE.Mesh(merged, mat);
  mesh.name = name;
  mesh.castShadow = true;
  return mesh;
}

/**
 * Organic canopy geometry for urban street trees (Kambang Iwak style)
 */
function canopyGeometry(phase = 0): THREE.BufferGeometry {
  const rings = [
    [-0.72, 0], [-0.64, 0.38], [-0.54, 0.60], [-0.40, 0.79], [-0.22, 0.92],
    [0.0, 1.0], [0.22, 0.96], [0.42, 0.85], [0.60, 0.68], [0.74, 0.44], [0.82, 0],
  ] as const;
  const segments = 20;
  const vertices: number[] = [];
  const indices: number[] = [];
  for (let j = 0; j < rings.length; j++) {
    const [height, radius] = rings[j];
    for (let i = 0; i < segments; i++) {
      const angle = i * Math.PI * 2 / segments;
      const ripple = 1 + 0.085 * Math.cos(angle * 5 + phase)
        + 0.055 * Math.sin(angle * 3 - height * 2 + phase);
      const r = radius * ripple;
      vertices.push(Math.cos(angle) * r, height, Math.sin(angle) * r);
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
    earth: material('Earth_Underside_Base', 0x2e2924, 0.95),
    asphaltRoad: material('City_Road_Asphalt', 0x2c2f34, 0.88),
    roadMarking: material('Road_Lane_Marking', 0xf2eee6, 0.6),
    sidewalkPaving: material('Sidewalk_Concrete_Paving', 0xc5bfb3, 0.78),
    curbStone: material('Concrete_Curb_Stone', 0xb8b2a7, 0.82),
    bwCurbBlack: material('Safety_Curb_Black', 0x1f2124, 0.85),
    bwCurbWhite: material('Safety_Curb_White', 0xedeae2, 0.8),
    plinthStone: material('Foundation_Plinth_Stone', 0x8c8478, 0.82),
    wallPlinthBrown: material('Van_Der_Berj_Plinth_Brown', 0x855139, 0.76),
    wallOchre: material('Van_Der_Berj_Wall_Ochre', 0xd6a852, 0.72),
    trimWhite: material('Architectural_Trim_White', 0xf4f1e8, 0.68),
    trimCream: material('Architectural_Trim_Cream', 0xe4dec8, 0.74),
    doorBlue: material('Colonial_Shutter_Door_Blue', 0x3a658d, 0.65, 0.1),
    doorFrame: material('Entrance_Portal_Stone', 0xdad4c4, 0.72),
    roofTerracotta: material('Terracotta_Tile_Roof', 0xb45838, 0.82),
    roofRidgeCap: material('Terracotta_Ridge_Cap', 0x943e26, 0.8),
    roofTiles: new THREE.MeshStandardMaterial({ name: 'Raised_Terracotta_Roof_Tiles', vertexColors: true, roughness: 0.83, side: THREE.DoubleSide }),
    timberBracket: material('Timber_Corbel_Bracket', 0x4e3828, 0.82),
    windowGlass: material('Window_Glazing_Reflective', 0x324756, 0.18, 0.45),
    windowFrame: material('Casement_Window_Frame', 0x26282a, 0.6),
    grilleLattice: material('Ventilation_Grille_Lattice', 0x222426, 0.75),
    contextBuildingWall: material('City_Context_Facade', 0xb2aca2, 0.82),
    contextBuildingRoof: material('City_Context_Roof', 0x5a6068, 0.8),
    treeFoliage: material('Urban_Tree_Canopy', 0x486e38, 0.88),
    treeBark: material('Urban_Tree_Bark', 0x52463a, 0.9),
    lawnGrass: material('Outer_Lawn_Grass', 0x587c38, 0.9),
    metal: material('Streetlight_Metal_Dark', 0x42464c, 0.45, 0.65),
    lampLens: material('Streetlight_Lamp_Lens', 0xffffff, 0.1, 0.2),
    gold: material('Finial_Burnished_Gold', 0xd4af37, 0.35, 0.8),
  };
}

/**
 * Creates Props Kit-Bash #1: Modular Window Unit (Variant A - Multi-Pane Casement Window, ~800 tris)
 */
function createModularWindowUnit(name: string, w: number, h: number, m: ReturnType<typeof makeMaterials>): THREE.Group {
  const g = new THREE.Group();
  g.name = name;

  const frameThk = 0.18;
  const frameDepth = 0.14;
  const specs: BlockSpec[] = [
    // Top header molding
    [w, frameThk, frameDepth, 0, h / 2 - frameThk / 2, 0],
    // Molded pediment drip cap
    [w + 0.35, 0.12, frameDepth + 0.08, 0, h / 2 + 0.06, 0.04],
    // Projecting lower stone sill
    [w + 0.4, frameThk * 1.35, frameDepth + 0.14, 0, -h / 2 + frameThk / 2, 0.07],
    // Left and right jambs
    [frameThk, h - frameThk * 2, frameDepth, -w / 2 + frameThk / 2, 0, 0],
    [frameThk, h - frameThk * 2, frameDepth, w / 2 - frameThk / 2, 0, 0],
    // Central vertical mullion
    [frameThk * 0.75, h - frameThk * 2, frameDepth * 0.9, 0, 0, 0],
    // Horizontal transom bar (cross layout at 2/3 height)
    [w - frameThk * 2, frameThk * 0.75, frameDepth * 0.9, 0, h * 0.18, 0],
    // Molded corbel brackets supporting the stone sill
    [0.12, 0.28, 0.16, -w / 2 + 0.25, -h / 2 - 0.14, 0.06],
    [0.12, 0.28, 0.16, w / 2 - 0.25, -h / 2 - 0.14, 0.06],
  ];

  // Muntin grid bars in each lower and upper pane for ~800 tri detail
  const paneW = (w - frameThk * 2.75) / 2;
  for (const side of [-1, 1]) {
    const px = side * (paneW / 2 + frameThk * 0.375);
    // Casement sash inner border
    specs.push([paneW, 0.07, 0.05, px, -h * 0.22 + (h * 0.58) / 2 - 0.035, 0.02]);
    specs.push([paneW, 0.07, 0.05, px, -h * 0.22 - (h * 0.58) / 2 + 0.035, 0.02]);
    specs.push([0.07, h * 0.58, 0.05, px - paneW / 2 + 0.035, -h * 0.22, 0.02]);
    specs.push([0.07, h * 0.58, 0.05, px + paneW / 2 - 0.035, -h * 0.22, 0.02]);

    // Internal glazing division bars
    specs.push([0.045, h * 0.54, 0.035, px, -h * 0.22, 0.03]);
    specs.push([paneW * 0.88, 0.045, 0.035, px, -h * 0.22, 0.03]);
    // Transom top light muntins
    specs.push([0.045, h * 0.24, 0.035, px, h * 0.32, 0.03]);
  }

  g.add(repeatedBoxes(`${name}_Molded_Frame`, specs, m.trimWhite));

  // Glazing panes
  const glass = box(`${name}_Glass_Panes`, w - frameThk * 1.8, h - frameThk * 1.8, 0.04, m.windowGlass, 0, 0, 0);
  g.add(glass);

  return g;
}

/**
 * Creates Props Kit-Bash #2: Modular Shuttered Unit (Variant B - Closed Blue Louvred Shutter, ~600 tris)
 */
function createModularShutteredUnit(name: string, w: number, h: number, m: ReturnType<typeof makeMaterials>): THREE.Group {
  const g = new THREE.Group();
  g.name = name;

  const caseThk = 0.15;
  const caseDepth = 0.12;
  const frameSpecs: BlockSpec[] = [
    [w, caseThk, caseDepth, 0, h / 2 - caseThk / 2, 0],
    [w + 0.3, caseThk * 1.25, caseDepth + 0.1, 0, -h / 2 + caseThk / 2, 0.05],
    [caseThk, h - caseThk * 2, caseDepth, -w / 2 + caseThk / 2, 0, 0],
    [caseThk, h - caseThk * 2, caseDepth, w / 2 - caseThk / 2, 0, 0],
    [caseThk * 0.85, h - caseThk * 2, caseDepth * 0.9, 0, 0, 0], // Center dividing stile
  ];
  g.add(repeatedBoxes(`${name}_Casing`, frameSpecs, m.trimWhite));

  // 2 Shutter leaves with individual 3D angled louvre slats (~600 tris)
  const leafW = (w - caseThk * 2.85) / 2;
  const leafH = h - caseThk * 2.2;
  const slatSpecs: BlockSpec[] = [];

  for (const side of [-1, 1]) {
    const lx = side * (leafW / 2 + 0.05);
    slatSpecs.push([leafW, leafH, 0.06, lx, 0, 0.01]);
    slatSpecs.push([0.08, leafH, 0.04, lx - leafW / 2 + 0.04, 0, 0.04]);
    slatSpecs.push([0.08, leafH, 0.04, lx + leafW / 2 - 0.04, 0, 0.04]);
    slatSpecs.push([leafW, 0.1, 0.04, lx, leafH / 2 - 0.05, 0.04]);
    slatSpecs.push([leafW, 0.1, 0.04, lx, -leafH / 2 + 0.05, 0.04]);
    slatSpecs.push([leafW, 0.08, 0.04, lx, 0, 0.04]);

    const slatCount = 18;
    const slatGap = leafH / (slatCount + 1);
    for (let s = 1; s <= slatCount; s++) {
      const sy = -leafH / 2 + s * slatGap;
      slatSpecs.push([leafW - 0.18, 0.045, 0.035, lx, sy, 0.045]);
    }
  }
  g.add(repeatedBoxes(`${name}_Blue_Louvres`, slatSpecs, m.doorBlue));

  return g;
}

/**
 * Creates Props Kit-Bash #3: Detailed Entrance Unit (~1,800 tris)
 */
function createDetailedEntranceUnit(name: string, m: ReturnType<typeof makeMaterials>): THREE.Group {
  const g = new THREE.Group();
  g.name = name;

  const doorW = 4.4, doorH = 5.4;

  // 1. Heavy Molded Entrance Architrave Portal
  const portalSpecs: BlockSpec[] = [
    [0.85, doorH + 1.8, 0.45, -doorW / 2 - 0.425, (doorH + 1.8) / 2, 0.16],
    [0.85, doorH + 1.8, 0.45, doorW / 2 + 0.425, (doorH + 1.8) / 2, 0.16],
    [1.05, 0.65, 0.55, -doorW / 2 - 0.425, 0.325, 0.2],
    [1.05, 0.65, 0.55, doorW / 2 + 0.425, 0.325, 0.2],
    [1.05, 0.4, 0.55, -doorW / 2 - 0.425, doorH + 0.65, 0.2],
    [1.05, 0.4, 0.55, doorW / 2 + 0.425, doorH + 0.65, 0.2],
    [doorW + 2.6, 0.85, 0.52, 0, doorH + 1.25, 0.2],
    [doorW + 3.0, 0.38, 0.68, 0, doorH + 1.85, 0.24],
  ];
  g.add(repeatedBoxes(`${name}_Portal_Architrave`, portalSpecs, m.doorFrame));

  // 2. Inscription Plaque with "GEDUNG VAN DER BERG"
  const plaque = box(`${name}_Text_Plaque`, doorW + 1.4, 0.68, 0.08, m.trimWhite, 0, doorH + 1.25, 0.48);
  g.add(plaque);

  // Raised 5x7 vector-pixel letters keep the entrance inscription editable and exportable.
  const glyphs: Record<string, string[]> = {
    A: ['01110','10001','10001','11111','10001','10001','10001'],
    B: ['11110','10001','10001','11110','10001','10001','11110'],
    D: ['11110','10001','10001','10001','10001','10001','11110'],
    E: ['11111','10000','10000','11110','10000','10000','11111'],
    G: ['01111','10000','10000','10111','10001','10001','01110'],
    N: ['10001','11001','10101','10101','10011','10001','10001'],
    R: ['11110','10001','10001','11110','10100','10010','10001'],
    U: ['10001','10001','10001','10001','10001','10001','01110'],
    V: ['10001','10001','10001','10001','10001','01010','00100'],
  };
  const inscription = 'GEDUNG VAN DER BERG';
  const letterSpecs: BlockSpec[] = [];
  const px = 0.045, py = 0.068;
  const startX = -(inscription.length * 6 - 1) * px / 2;
  for (let i = 0; i < inscription.length; i++) {
    const glyph = glyphs[inscription[i]];
    if (!glyph) continue;
    for (let row = 0; row < 7; row++) for (let col = 0; col < 5; col++) {
      if (glyph[row][col] === '1') {
        letterSpecs.push([px * 0.82, py * 0.8, 0.035,
          startX + (i * 6 + col) * px, doorH + 1.25 + (3 - row) * py, 0.54]);
      }
    }
  }
  g.add(repeatedBoxes(`${name}_Lettering_Relief`, letterSpecs, m.wallPlinthBrown));

  // 3. Double Blue Doors with Molded Panels
  const leafW = (doorW - 0.22) / 2;
  const leafH = doorH * 0.72;
  const doorSpecs: BlockSpec[] = [];

  for (const side of [-1, 1]) {
    const dx = side * (leafW / 2 + 0.055);
    doorSpecs.push([leafW, leafH, 0.12, dx, leafH / 2, 0.02]);
    for (let p = 0; p < 3; p++) {
      const py = 0.55 + p * (leafH / 3.25);
      doorSpecs.push([leafW - 0.28, leafH / 4.0, 0.04, dx, py, 0.09]);
      doorSpecs.push([leafW - 0.42, leafH / 5.2, 0.03, dx, py, 0.12]);
    }
  }
  g.add(repeatedBoxes(`${name}_Double_Blue_Doors`, doorSpecs, m.doorBlue));

  // Bronze door handles
  g.add(box(`${name}_Handle_L`, 0.06, 0.38, 0.08, m.gold, -0.16, leafH * 0.48, 0.15));
  g.add(box(`${name}_Handle_R`, 0.06, 0.38, 0.08, m.gold, 0.16, leafH * 0.48, 0.15));

  // 4. Rectangular Ventilation Transom Grille above doors (with geometric lattice bars)
  const ventY = leafH + (doorH - leafH) / 2;
  const ventH = doorH - leafH - 0.22;
  g.add(repeatedBoxes(`${name}_Vent_Frame`, [
    [doorW - 0.1, 0.14, 0.13, 0, ventY + ventH / 2, 0.07],
    [doorW - 0.1, 0.14, 0.13, 0, ventY - ventH / 2, 0.07],
    [0.14, ventH, 0.13, -doorW / 2 + 0.05, ventY, 0.07],
    [0.14, ventH, 0.13, doorW / 2 - 0.05, ventY, 0.07],
  ], m.trimWhite));
  g.add(box(`${name}_Vent_Recess`, doorW - 0.4, ventH - 0.2, 0.035, m.grilleLattice, 0, ventY, -0.07));

  const grilleSpecs: BlockSpec[] = [];
  const barCount = 16;
  const barGap = (doorW - 0.4) / barCount;
  for (let b = 0; b <= barCount; b++) {
    const bx = -doorW / 2 + 0.2 + b * barGap;
    grilleSpecs.push([0.05, ventH - 0.1, 0.05, bx, ventY, 0.06]);
  }
  g.add(repeatedBoxes(`${name}_Vent_Lattice_Bars`, grilleSpecs, m.grilleLattice));

  return g;
}

/**
 * Creates Props Kit-Bash #5: City Streetlight Post (Low-Poly, ~150 tris)
 */
function createCityStreetlight(name: string, x: number, z: number, rotY = 0, m: ReturnType<typeof makeMaterials>): THREE.Group {
  const post = new THREE.Group();
  post.name = name;
  post.position.set(x, 0, z);
  post.rotation.y = rotY;

  // Stepped base pedestal
  post.add(cylinder('Streetlight_Base', 0.22, 0.28, 0.8, 10, m.metal, 0, 0.4, 0));
  // Slender mast
  const mastH = 8.5;
  post.add(cylinder('Streetlight_Mast', 0.09, 0.16, mastH, 10, m.metal, 0, 0.8 + mastH / 2, 0));
  // Curved outreach arm
  post.add(box('Streetlight_Arm', 0.12, 0.12, 2.6, m.metal, 0, 0.8 + mastH - 0.1, 1.3));
  // Cobra-head luminaire housing
  post.add(box('Streetlight_Luminaire', 0.42, 0.18, 0.95, m.metal, 0, 0.8 + mastH - 0.15, 2.5));
  // Illuminating lens
  post.add(box('Streetlight_Lens', 0.32, 0.06, 0.8, m.lampLens, 0, 0.8 + mastH - 0.26, 2.5));

  return post;
}

/**
 * Creates Ground Plinth, Public Street Corner, Sidewalks, and Safety Curbs
 * - Plinth bounds: Exactly 180.0 m (width, X) by 110.0 m (depth, Z) matching Section 1 proposed bounds.
 */
function createPlinthAndStreetEnvironment(m: ReturnType<typeof makeMaterials>): THREE.Group {
  const g = new THREE.Group();
  g.name = 'Plinth_And_Street_Environment';

  const baseW = 180.0, baseD = 110.0;

  // 1. Earth Underside Base Plinth (min Y at -0.6)
  g.add(box('Earth_Underside_Base', baseW, 0.6, baseD, m.earth, 0, -0.3, 0));

  // 2. Asphalt Roadways (South Z in [22, 55], East X in [42, 90])
  const roadSpecs: BlockSpec[] = [
    // South main avenue (width 180, depth 33, centered at Z=38.5)
    [baseW, 0.08, 33.0, 0, 0.04, 38.5],
    // East crossing street (width 48, depth 110, centered at X=66.0, Z=0)
    [48.0, 0.08, baseD, 66.0, 0.04, 0],
  ];
  g.add(repeatedBoxes('City_Road_Asphalt_Surface', roadSpecs, m.asphaltRoad));

  // 3. Road Lane Center Dividers (White dashed lines)
  const lineSpecs: BlockSpec[] = [];
  for (let x = -baseW / 2 + 3; x < baseW / 2 - 3; x += 6.5) {
    if (x < 42 || x > 90) {
      lineSpecs.push([3.8, 0.02, 0.35, x, 0.085, 38.5]);
    }
  }
  for (let z = -baseD / 2 + 3; z < baseD / 2 - 3; z += 6.5) {
    if (z < 18 || z > 55) {
      lineSpecs.push([0.35, 0.02, 3.8, 66.0, 0.085, z]);
    }
  }
  g.add(repeatedBoxes('Road_Lane_Markings', lineSpecs, m.roadMarking));

  // 4. Zebra Pedestrian Crosswalks
  const zebraSpecs: BlockSpec[] = [];
  for (let i = 0; i < 9; i++) {
    zebraSpecs.push([0.8, 0.02, 5.5, 36.0 + i * 1.5, 0.085, 23.5]);
    zebraSpecs.push([5.5, 0.02, 0.8, 43.5, 0.085, 16.0 + i * 1.5]);
  }
  g.add(repeatedBoxes('Zebra_Crosswalk_Stripes', zebraSpecs, m.roadMarking));

  // 5. Urban Corner Sidewalk (Kept strictly within [-90, 90] and [-55, 55])
  const sidewalkSpecs: BlockSpec[] = [
    // Front sidewalk directly fronting the building
    [92.0, 0.22, 14.0, -8.0, 0.11, 15.0],
    // East side sidewalk: depth 74 centered at -18, goes from Z = -55 to Z = +19!
    [16.0, 0.22, 74.0, 34.0, 0.11, -18.0],
    // Back courtyard paving: depth 56 centered at -27, goes from Z = -55 to Z = +1!
    [100.0, 0.22, 56.0, -12.0, 0.11, -27.0],
  ];
  g.add(repeatedBoxes('Sidewalk_Concrete_Paving', sidewalkSpecs, m.sidewalkPaving));

  // 6. Curved Safety Curbs with Alternating Black and White Blocks
  const curbBlackSpecs: BlockSpec[] = [];
  const curbWhiteSpecs: BlockSpec[] = [];

  // Straight South curb line (X in [-54, 30])
  for (let x = -54; x <= 30; x += 2.0) {
    const isBlack = (Math.floor(x / 2.0) % 2 === 0);
    const target = isBlack ? curbBlackSpecs : curbWhiteSpecs;
    target.push([1.95, 0.26, 0.35, x, 0.13, 22.0]);
  }

  // Curved corner curb arc (from South line to East line)
  const cornerRadius = 12.0;
  const cornerCenterX = 30.0;
  const cornerCenterZ = 10.0;
  const segCount = 12;
  for (let i = 0; i < segCount; i++) {
    const angle = (i / segCount) * (Math.PI / 2);
    const cx = cornerCenterX + Math.cos(angle) * cornerRadius;
    const cz = cornerCenterZ + Math.sin(angle) * cornerRadius;
    const isBlack = (i % 2 === 0);
    const target = isBlack ? curbBlackSpecs : curbWhiteSpecs;
    target.push([1.5, 0.26, 0.35, cx, 0.13, cz]);
  }

  // Straight East curb line (Z in [-54, 10])
  for (let z = -54; z <= 10; z += 2.0) {
    const isBlack = (Math.floor(z / 2.0) % 2 === 0);
    const target = isBlack ? curbBlackSpecs : curbWhiteSpecs;
    target.push([0.35, 0.26, 1.95, 42.0, 0.13, z]);
  }

  g.add(repeatedBoxes('Safety_Curb_Black', curbBlackSpecs, m.bwCurbBlack));
  g.add(repeatedBoxes('Safety_Curb_White', curbWhiteSpecs, m.bwCurbWhite));

  return g;
}

/**
 * Creates the Historic Gedung Van der Berj Main 2-Story Building and Side Annex
 * Reaches ~25.0 m peak height matching Section 2 Left/Right profile views.
 */
function createGedungVanDerBerjBuilding(spec: GedungVanDerBerjSpec, m: ReturnType<typeof makeMaterials>): THREE.Group {
  const root = new THREE.Group();
  root.name = 'Building_Van_Der_Berj_Main';

  // 1. ELEVATED FOUNDATION PLINTH (Test Hilge)
  const plinthH = 1.1;
  const mainW = 46.0, mainD = 38.0;
  const mainX = 2.0, mainZ = -4.0;

  root.add(box('Foundation_Plinth_Base', mainW + 3.0, plinthH, mainD + 3.0, m.plinthStone, mainX, plinthH / 2, mainZ));
  root.add(box('Foundation_Plinth_Cornice', mainW + 3.4, 0.22, mainD + 3.4, m.trimWhite, mainX, plinthH + 0.11, mainZ));

  // 2. GROUND FLOOR BODY
  const gFloorH = 8.5;
  const plinthWainscotH = 1.75;
  const ochreGFloorH = gFloorH - plinthWainscotH;
  const gFloorBaseY = plinthH + 0.22;

  // Lower brown wainscot plinth
  root.add(roundedGroundVolume('Main_Ground_Wainscot_Plinth', mainW, plinthWainscotH, mainD, 3.0, m.wallPlinthBrown, mainX, gFloorBaseY, mainZ));
  root.add(box('Plinth_Wainscot_Trim', mainW + 0.45, 0.2, mainD + 0.45, m.trimWhite, mainX, gFloorBaseY + plinthWainscotH + 0.1, mainZ));
  // Upper ochre ground floor wall
  root.add(roundedGroundVolume('Main_Ground_Ochre_Wall', mainW, ochreGFloorH, mainD, 3.0, m.wallOchre, mainX, gFloorBaseY + plinthWainscotH + 0.2, mainZ));

  // 3. INTERMEDIATE PENT ROOF / EAVE AWNING (Running all around the 2-story building)
  const awningY = gFloorBaseY + gFloorH;
  const awningOverhang = 2.4;
  const awningW = mainW + awningOverhang * 2;
  const awningD = mainD + awningOverhang * 2;
  const awningH = 1.35;

  const awningRoof = hippedRoofX('Intermediate_Eave_Awning_Roof', awningW, awningD, awningH, m.roofTerracotta, 0.65);
  detailHippedRoof(awningRoof, awningW, awningD, awningH, 0.65, m, 1.05);
  awningRoof.position.set(mainX, awningY, mainZ);
  root.add(awningRoof);
  root.add(box('Awning_Fascia_Trim', awningW + 0.2, 0.25, awningD + 0.2, m.trimWhite, mainX, awningY, mainZ));

  // Timber corbels / brackets supporting the intermediate awning
  const bracketSpecs: BlockSpec[] = [];
  const bracketSpacing = 3.6;
  for (const zSide of [-mainD / 2 - 0.2, mainD / 2 + 0.2]) {
    for (let x = -mainW / 2 + 1.8; x <= mainW / 2 - 1.8; x += bracketSpacing) {
      bracketSpecs.push([0.25, 0.7, 0.9, mainX + x, awningY - 0.35, mainZ + zSide]);
    }
  }
  for (const xSide of [-mainW / 2 - 0.2, mainW / 2 + 0.2]) {
    for (let z = -mainD / 2 + 1.8; z <= mainD / 2 - 1.8; z += bracketSpacing) {
      bracketSpecs.push([0.9, 0.7, 0.25, mainX + xSide, awningY - 0.35, mainZ + z]);
    }
  }
  root.add(repeatedBoxes('Awning_Timber_Brackets', bracketSpecs, m.timberBracket));

  // 4. SECOND FLOOR BODY (Painted warm ochre with white window architraves)
  const secFloorBaseY = awningY + awningH;
  const secFloorH = 7.6;

  root.add(box('Main_Second_Floor_Wall', mainW - 0.6, secFloorH, mainD - 0.6, m.wallOchre, mainX, secFloorBaseY + secFloorH / 2, mainZ));
  root.add(box('Second_Floor_Upper_Frieze', mainW + 0.6, 0.45, mainD + 0.6, m.trimWhite, mainX, secFloorBaseY + secFloorH - 0.22, mainZ));

  // Decorative brackets under main roof eaves
  const roofBracketSpecs: BlockSpec[] = [];
  for (const zSide of [-mainD / 2 - 0.5, mainD / 2 + 0.5]) {
    for (let x = -mainW / 2 + 1.5; x <= mainW / 2 - 1.5; x += 3.2) {
      roofBracketSpecs.push([0.25, 0.85, 1.1, mainX + x, secFloorBaseY + secFloorH - 0.42, mainZ + zSide]);
    }
  }
  for (const xSide of [-mainW / 2 - 0.5, mainW / 2 + 0.5]) {
    for (let z = -mainD / 2 + 1.5; z <= mainD / 2 - 1.5; z += 3.2) {
      roofBracketSpecs.push([1.1, 0.85, 0.25, mainX + xSide, secFloorBaseY + secFloorH - 0.42, mainZ + z]);
    }
  }
  root.add(repeatedBoxes('Main_Roof_Eave_Brackets', roofBracketSpecs, m.timberBracket));

  // 5. MAIN MONUMENTAL HIPPED TERRACOTTA ROOF (~25.0 m peak height!)
  const roofBaseY = secFloorBaseY + secFloorH; // 18.77 m
  const roofH = 6.23; // Peak reaches 25.0 m!
  const roofOverhang = 3.2;
  const roofW = mainW + roofOverhang * 2; // 52.4 m
  const roofD = mainD + roofOverhang * 2; // 44.4 m

  const mainRoof = hippedRoofX('Building_Van_Der_Berj_Roof', roofW, roofD, roofH, m.roofTerracotta, 0.42);
  detailHippedRoof(mainRoof, roofW, roofD, roofH, 0.42, m, 0.82);
  mainRoof.position.set(mainX, roofBaseY, mainZ);
  root.add(mainRoof);

  // Terracotta Ridge Cap & Finials (Props Kit-Bash #4)
  const mainRidgeLen = roofW * 0.42 * 2;
  root.add(box('Main_Roof_Ridge_Cap', mainRidgeLen, 0.24, 0.5, m.roofRidgeCap, mainX, roofBaseY + roofH, mainZ));
  for (const rx of [-mainRidgeLen / 2, mainRidgeLen / 2]) {
    root.add(cylinder(`Main_Roof_Finial_${rx}`, 0.08, 0.2, 0.9, 8, m.gold, mainX + rx, roofBaseY + roofH + 0.45, mainZ));
  }

  const mainCaps = roofHipCaps('Main_Roof_Hip_Ridge_Caps', roofW, roofD, roofH, 0.42, m.roofRidgeCap);
  mainCaps.position.set(mainX, roofBaseY, mainZ);
  root.add(mainCaps);
  const awningCaps = roofHipCaps('Awning_Hip_Ridge_Caps', awningW, awningD, awningH, 0.65, m.roofRidgeCap);
  awningCaps.position.set(mainX, awningY, mainZ);
  root.add(awningCaps);

  // Facade bays and a low relief cornice follow the ground-floor proportions.
  const bayPilasters: BlockSpec[] = [];
  for (const localX of [-21, -11, 4, 14, 22]) {
    bayPilasters.push([0.42, gFloorH - 0.3, 0.32, mainX + localX, gFloorBaseY + gFloorH / 2, mainZ + mainD / 2 + 0.17]);
  }
  for (const localZ of [-14, -4, 6, 16]) {
    bayPilasters.push([0.32, gFloorH - 0.3, 0.42, mainX + mainW / 2 + 0.17, gFloorBaseY + gFloorH / 2, mainZ + localZ]);
  }
  root.add(repeatedBoxes('Ground_Facade_Bay_Pilasters', bayPilasters, m.trimCream));
  // Narrow raised timber shutters flank the ground-floor glazing, leaving the glass visible.
  const shutterSpecs: BlockSpec[] = [];
  for (const localX of [-16, -7, 0, 18]) for (const side of [-1, 1]) {
    shutterSpecs.push([0.62, 3.65, 0.16, mainX + localX + side * 2.08,
      gFloorBaseY + 4.8, mainZ + mainD / 2 + 0.19]);
  }
  for (const localZ of [-12, -2, 9]) for (const side of [-1, 1]) {
    shutterSpecs.push([0.16, 3.65, 0.62, mainX + mainW / 2 + 0.19,
      gFloorBaseY + 4.8, mainZ + localZ + side * 2.08]);
  }
  root.add(repeatedBoxes('Ground_Window_Timber_Shutters', shutterSpecs, m.wallPlinthBrown));

  // 6. ENTRANCES & FAÇADE FENESTRATION (Props Kit-Bash #3)
  if (spec.showEntranceDetails !== false) {
    // Grand Entrance Portal on South Façade (Front Street)
    const entrance = createDetailedEntranceUnit('Main_Entrance_South', m);
    entrance.position.set(mainX + 8.5, gFloorBaseY, mainZ + mainD / 2);
    root.add(entrance);

    // Secondary Blue Entrance Door on West Façade
    const secDoor = createDetailedEntranceUnit('Secondary_Entrance_West', m);
    secDoor.position.set(mainX - mainW / 2, gFloorBaseY, mainZ + 4.0);
    secDoor.rotation.y = -Math.PI / 2;
    root.add(secDoor);
  }

  // 7. MODULAR WINDOWS & BLUE SHUTTERS (Props Kit-Bash #1 & #2, ~800 & ~600 tris each)
  if (spec.showModularWindows !== false) {
    const windowsGroup = new THREE.Group();
    windowsGroup.name = 'Modular_Window_Units';

    // Second Floor Windows: South Façade
    for (const [i, wx] of [-14.0, -3.0, 18.0].entries()) {
      const isShutter = (i === 1);
      const win = isShutter
        ? createModularShutteredUnit(`Sec_Floor_Window_South_${i + 1}`, 3.2, 3.8, m)
        : createModularWindowUnit(`Sec_Floor_Window_South_${i + 1}`, 3.2, 3.8, m);
      win.position.set(mainX + wx, secFloorBaseY + 3.6, mainZ + mainD / 2 + 0.05);
      windowsGroup.add(win);

      windowsGroup.add(box(`Sec_Vent_South_${i + 1}`, 2.6, 0.75, 0.08, m.grilleLattice, mainX + wx, secFloorBaseY + 6.1, mainZ + mainD / 2 + 0.06));
    }

    // Second Floor Windows: East Façade
    for (const [i, wz] of [-10.0, 2.0, 12.0].entries()) {
      const isShutter = (i === 0);
      const win = isShutter
        ? createModularShutteredUnit(`Sec_Floor_Window_East_${i + 1}`, 3.2, 3.8, m)
        : createModularWindowUnit(`Sec_Floor_Window_East_${i + 1}`, 3.2, 3.8, m);
      win.position.set(mainX + mainW / 2 + 0.05, secFloorBaseY + 3.6, mainZ + wz);
      win.rotation.y = Math.PI / 2;
      windowsGroup.add(win);

      windowsGroup.add(box(`Sec_Vent_East_${i + 1}`, 0.08, 0.75, 2.6, m.grilleLattice, mainX + mainW / 2 + 0.06, secFloorBaseY + 6.1, mainZ + wz));
    }

    // Second Floor Windows: North Façade (Back)
    for (const [i, wx] of [-14.0, 0.0, 14.0].entries()) {
      const win = createModularWindowUnit(`Sec_Floor_Window_North_${i + 1}`, 3.2, 3.8, m);
      win.position.set(mainX + wx, secFloorBaseY + 3.6, mainZ - mainD / 2 - 0.05);
      win.rotation.y = Math.PI;
      windowsGroup.add(win);
      windowsGroup.add(box(`Sec_Vent_North_${i + 1}`, 2.6, 0.75, 0.08, m.grilleLattice, mainX + wx, secFloorBaseY + 6.1, mainZ - mainD / 2 - 0.06));
    }

    // Second Floor Windows: West Façade
    for (const [i, wz] of [-8.0, 8.0].entries()) {
      const win = createModularWindowUnit(`Sec_Floor_Window_West_${i + 1}`, 3.2, 3.8, m);
      win.position.set(mainX - mainW / 2 - 0.05, secFloorBaseY + 3.6, mainZ + wz);
      win.rotation.y = -Math.PI / 2;
      windowsGroup.add(win);
      windowsGroup.add(box(`Sec_Vent_West_${i + 1}`, 0.08, 0.75, 2.6, m.grilleLattice, mainX - mainW / 2 - 0.06, secFloorBaseY + 6.1, mainZ + wz));
    }

    // Ground Floor Windows: South Façade
    for (const [i, wx] of [-16.0, -7.0, 0.0, 18.0].entries()) {
      const win = createModularWindowUnit(`Ground_Window_South_${i + 1}`, 3.2, 3.6, m);
      win.position.set(mainX + wx, gFloorBaseY + 4.8, mainZ + mainD / 2 + 0.05);
      windowsGroup.add(win);

      windowsGroup.add(box(`Ground_Vent_South_${i + 1}`, 2.6, 0.75, 0.08, m.grilleLattice, mainX + wx, gFloorBaseY + 7.2, mainZ + mainD / 2 + 0.06));
    }

    // Ground Floor Windows: East Façade
    for (const [i, wz] of [-12.0, -2.0, 9.0].entries()) {
      const win = createModularShutteredUnit(`Ground_Window_East_${i + 1}`, 3.2, 3.6, m);
      win.position.set(mainX + mainW / 2 + 0.05, gFloorBaseY + 4.8, mainZ + wz);
      win.rotation.y = Math.PI / 2;
      windowsGroup.add(win);

      windowsGroup.add(box(`Ground_Vent_East_${i + 1}`, 0.08, 0.75, 2.6, m.grilleLattice, mainX + mainW / 2 + 0.06, gFloorBaseY + 7.2, mainZ + wz));
    }

    // Ground Floor Windows: North Façade
    for (const [i, wx] of [-14.0, 0.0, 14.0].entries()) {
      const win = createModularWindowUnit(`Ground_Window_North_${i + 1}`, 3.2, 3.6, m);
      win.position.set(mainX + wx, gFloorBaseY + 4.8, mainZ - mainD / 2 - 0.05);
      win.rotation.y = Math.PI;
      windowsGroup.add(win);
      windowsGroup.add(box(`Ground_Vent_North_${i + 1}`, 2.6, 0.75, 0.08, m.grilleLattice, mainX + wx, gFloorBaseY + 7.2, mainZ - mainD / 2 - 0.06));
    }

    root.add(windowsGroup);
  }

  // 8. 1-STORY SIDE / REAR ANNEX WING (As shown on left in Isometric and Left Profile Views)
  if (spec.showAnnex !== false) {
    const annex = new THREE.Group();
    annex.name = 'Building_Side_Annex';

    const annexW = 34.0, annexD = 34.0, annexH = 6.4;
    const annexX = mainX - mainW / 2 - annexW / 2 + 0.5; // attached along the west wall
    const annexZ = mainZ + 1.5;

    annex.add(box('Annex_Plinth', annexW + 1.2, plinthH, annexD + 1.2, m.plinthStone, annexX, plinthH / 2, annexZ));

    const aBaseY = plinthH + 0.22;
    annex.add(box('Annex_Wainscot_Plinth', annexW, plinthWainscotH, annexD, m.wallPlinthBrown, annexX, aBaseY + plinthWainscotH / 2, annexZ));
    annex.add(box('Annex_Plinth_Trim', annexW + 0.3, 0.18, annexD + 0.3, m.trimWhite, annexX, aBaseY + plinthWainscotH + 0.09, annexZ));

    const aOchreH = annexH - plinthWainscotH;
    annex.add(box('Annex_Ochre_Wall', annexW, aOchreH, annexD, m.wallOchre, annexX, aBaseY + plinthWainscotH + 0.18 + aOchreH / 2, annexZ));

    const aRoofOverhang = 1.8;
    const aRoofW = annexW + aRoofOverhang * 2;
    const aRoofD = annexD + aRoofOverhang * 2;
    const aRoofH = 3.6;

    const annexRoof = hippedRoofX('Annex_Sloped_Roof', aRoofW, aRoofD, aRoofH, m.roofTerracotta, 0.45);
    detailHippedRoof(annexRoof, aRoofW, aRoofD, aRoofH, 0.45, m, 0.95);
    annexRoof.position.set(annexX, aBaseY + annexH + 0.18, annexZ);
    annex.add(annexRoof);
    const annexCaps = roofHipCaps('Annex_Roof_Hip_Caps', aRoofW, aRoofD, aRoofH, 0.45, m.roofRidgeCap);
    annexCaps.position.copy(annexRoof.position);
    annex.add(annexCaps);

    // Annex blue doors & windows
    for (let i = 0; i < 2; i++) {
      const az = annexZ - 6.0 + i * 12.0;
      const adoor = box(`Annex_Blue_Door_${i + 1}`, 0.08, 3.2, 2.2, m.doorBlue, annexX - annexW / 2 - 0.04, aBaseY + 1.6, az);
      annex.add(adoor);
      const awin = createModularWindowUnit(`Annex_Window_${i + 1}`, 2.6, 2.8, m);
      awin.position.set(annexX, aBaseY + 3.8, annexZ + annexD / 2 + 0.04);
      annex.add(awin);
    }

    root.add(annex);
  }

  return root;
}

/**
 * Creates Surrounding City Context Buildings framing the street corner
 * As specified in Section 4: "City Context Buildings 30%"
 */
function createCityContextBuildings(m: ReturnType<typeof makeMaterials>): THREE.Group {
  const g = new THREE.Group();
  g.name = 'City_Context_Buildings';

  // 1. Outer Perimeter Sidewalks across the roadways (kept low and strictly within bounds)
  const outerSidewalkSpecs: BlockSpec[] = [
    // South outer sidewalk (across the avenue, Z in [44, 55])
    [180.0, 0.22, 11.0, 0, 0.11, 49.5],
    // East outer sidewalk (across the street, X in [78, 90])
    [12.0, 0.22, 110.0, 84.0, 0.11, 0],
  ];
  g.add(repeatedBoxes('Outer_Perimeter_Sidewalks', outerSidewalkSpecs, m.sidewalkPaving));

  // 2. Green Parkway Lawns & Planting Verges (matching green corner lots in Top View Plan)
  const outerLawnSpecs: BlockSpec[] = [
    // South green parkway lawn strip (Z in [46, 54])
    [174.0, 0.26, 7.5, 0, 0.13, 50.0],
    // East green parkway lawn strip (X in [80.5, 88.5])
    [8.0, 0.26, 102.0, 84.5, 0.13, 0],
  ];
  g.add(repeatedBoxes('Outer_Lawn_Verges', outerLawnSpecs, m.lawnGrass));

  // 3. Low Distant Background Outbuildings at Far North Edge (Z in [-54, -46])
  // Kept low (height 4.2m) and placed far behind the building so they never obstruct Gedung Van der Berj
  const rearBlockSpecs: BlockSpec[] = [
    [54.0, 4.2, 7.0, -12.0, 2.1, -50.0],
    [32.0, 3.8, 6.0, 35.0, 1.9, -50.5],
  ];
  g.add(repeatedBoxes('Context_Rear_Background', rearBlockSpecs, m.contextBuildingWall));

  const rearRoof1 = hippedRoofX('Context_Rear_Roof_1', 56.0, 8.5, 1.8, m.contextBuildingRoof, 0.5);
  rearRoof1.position.set(-12.0, 4.2, -50.0);
  g.add(rearRoof1);

  const rearRoof2 = hippedRoofX('Context_Rear_Roof_2', 34.0, 7.5, 1.6, m.contextBuildingRoof, 0.5);
  rearRoof2.position.set(35.0, 3.8, -50.5);
  g.add(rearRoof2);

  // 4. Urban Street Trees placed along the outer lawn verges framing the avenue
  const crownGeos = [canopyGeometry(0), canopyGeometry(1.7), canopyGeometry(3.14)];
  const trunkGeo = new THREE.LatheGeometry([
    new THREE.Vector2(0.43, 0), new THREE.Vector2(0.31, 0.15),
    new THREE.Vector2(0.23, 0.75), new THREE.Vector2(0.12, 1.5),
  ], 10);

  const treePositions: [number, number, number][] = [
    [-68.0, 50.0, 2.5],
    [-34.0, 50.0, 2.4],
    [8.0, 50.0, 2.6],
    [52.0, 50.0, 2.4],
    [84.5, -34.0, 2.5],
    [84.5, 14.0, 2.5],
    [-76.0, -22.0, 2.3],
  ];

  treePositions.forEach(([tx, tz, tsize], i) => {
    const tree = new THREE.Group();
    tree.name = `Street_Tree_${i + 1}`;
    tree.position.set(tx, 0, tz);
    const trunk = new THREE.Mesh(trunkGeo, m.treeBark);
    trunk.name = `${tree.name}_Trunk`;
    trunk.scale.setScalar(tsize);
    trunk.castShadow = true;
    tree.add(trunk);
    const branchGeometries: THREE.BufferGeometry[] = [];
    const lobes: [number, number, number, number][] = [
      [0, 2.03, 0, 0.68], [-0.67, 1.76, 0.12, 0.61],
      [0.72, 1.81, -0.16, 0.65], [-0.26, 1.62, -0.7, 0.6],
      [0.31, 1.7, 0.7, 0.62],
    ];
    lobes.forEach(([dx, dy, dz, radius], j) => {
      if (j > 0) {
        branchGeometries.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 1.05 * tsize, 0),
          new THREE.Vector3(dx * tsize * 0.5, 1.35 * tsize, dz * tsize * 0.5),
          new THREE.Vector3(dx * tsize, (dy - 0.1) * tsize, dz * tsize),
        ]), 6, 0.11 * tsize, 5, false));
      }
      const crown = new THREE.Mesh(crownGeos[(i + j) % crownGeos.length], m.treeFoliage);
      crown.name = `${tree.name}_Canopy_Lobe_${j + 1}`;
      crown.position.set(dx * tsize, dy * tsize, dz * tsize);
      crown.scale.set(radius * tsize, radius * tsize * 0.82, radius * tsize * 0.91);
      crown.rotation.y = i * 0.41 + j * 0.9;
      crown.castShadow = true;
      tree.add(crown);
    });
    const branches = mergeGeometries(branchGeometries, false);
    branchGeometries.forEach(geometry => geometry.dispose());
    if (!branches) throw new Error(`Cannot construct branches for ${tree.name}`);
    const limbs = new THREE.Mesh(branches, m.treeBark);
    limbs.name = `${tree.name}_Primary_Branches`;
    limbs.castShadow = true;
    tree.add(limbs);
    g.add(tree);
  });

  return g;
}

/**
 * Creates Street Props: City Streetlight Posts (Props Kit-Bash #5), Bollards, and Traffic Posts
 */
function createStreetPropsAndLighting(m: ReturnType<typeof makeMaterials>): THREE.Group {
  const g = new THREE.Group();
  g.name = 'Street_Props_And_Lighting';

  const lightPositions: [number, number, number][] = [
    [-45.0, 20.5, 0],
    [-12.0, 20.5, 0],
    [22.0, 20.5, -Math.PI * 0.15],
    [40.5, 6.0, Math.PI / 2],
    [40.5, -30.0, Math.PI / 2],
    [-20.0, 46.5, Math.PI],
    [82.0, -8.0, -Math.PI / 2],
  ];

  lightPositions.forEach(([lx, lz, rotY], i) => {
    g.add(createCityStreetlight(`City_Streetlight_${i + 1}`, lx, lz, rotY, m));
  });

  const bollardSpecs: BlockSpec[] = [];
  for (let b = 0; b < 6; b++) {
    const angle = (b / 5) * (Math.PI / 2);
    const bx = 30.0 + Math.cos(angle) * 11.0;
    const bz = 10.0 + Math.sin(angle) * 11.0;
    bollardSpecs.push([0.35, 0.9, 0.35, bx, 0.55, bz]);
  }
  g.add(repeatedBoxes('Corner_Safety_Bollards', bollardSpecs, m.metal));

  return g;
}

/**
 * Creates Educational, Historical, and AR Hotspot Anchors across Gedung Van der Berj
 */
function createEducationalAnchors(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'Helpers_And_Anchors';

  const anchorData: [string, number, number, number][] = [
    ['Anchor_Main_Entrance_South', 10.5, 3.2, 15.0],
    ['Anchor_Building_Van_Der_Berj_Roof', 2.0, 25.0, -4.0],
    ['Anchor_Intermediate_Awning', 2.0, 11.5, 15.0],
    ['Anchor_Corner_Intersection', 42.0, 1.2, 22.0],
    ['Anchor_Side_Annex_Wing', -37.5, 4.5, -2.5],
    ['Anchor_Historical_Sign_Plaque', 10.5, 6.4, 15.5],
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
 * Master Factory: Creates the procedural 3D model of Gedung Van der Berj (Palembang Heritage)
 */
export function createGedungVanDerBerjModel(spec: GedungVanDerBerjSpec = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = 'Gedung_Van_Der_Berj_Root';

  const m = makeMaterials();

  // 1. Plinth, Public Streets, Curved Corner Sidewalk, Safety Curbs, and Crosswalks
  root.add(createPlinthAndStreetEnvironment(m));

  // 2. Historic Gedung Van der Berj Building (Plinth, 2-Story Body, Intermediate Awning, Upper Roof, Annex, Fenestration)
  root.add(createGedungVanDerBerjBuilding(spec, m));

  // 3. Surrounding City Context Buildings framing the street corner (Section 4)
  if (spec.showContextBuildings !== false) {
    root.add(createCityContextBuildings(m));
  }

  // 4. Street Props & Lighting (City Streetlight Posts, Safety Bollards)
  if (spec.showStreetProps !== false) {
    root.add(createStreetPropsAndLighting(m));
  }

  // 5. Existing educational anchors; their positions still need checking against any production asset
  root.add(createEducationalAnchors());

  if (spec.scale && spec.scale !== 1.0) {
    root.scale.setScalar(spec.scale);
  }

  return root;
}

export const createModel = createGedungVanDerBerjModel;
export default createGedungVanDerBerjModel;
