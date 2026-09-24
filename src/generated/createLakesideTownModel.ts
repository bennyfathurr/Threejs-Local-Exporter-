import * as THREE from 'three';

export interface LakesideTownSpec {
  scale?: number;
  waterColor?: number;
  showWaterGrid?: boolean;
}

/**
 * MODELING_ASSUMPTIONS
 * Y is up, X follows the long side, Z follows the short side (negative Z is
 * the illustrated north edge). The plinth is centered at the origin and is
 * 56 x 30 scene units, preserving the sheet's approximate 300:160 proportion.
 * Those numbers are NOT surveyed metres. Shore depth, building identities,
 * roof heights and tree positions are inferred stylized forms because the
 * supplied concept sheet is not a measured construction drawing. The bottom
 * view only supports a simple uninterrupted plinth underside.
 */
const WORLD_W = 56;
const WORLD_D = 30;
const GROUND_Y = 0.56;
const WATER_Y = 0.43;

function material(name: string, color: number, roughness = 0.85): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ name, color, roughness, flatShading: true, side: THREE.DoubleSide });
}

function mesh(name: string, geometry: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Group, x = 0, y = 0, z = 0): THREE.Mesh {
  const obj = new THREE.Mesh(geometry, mat);
  obj.name = name;
  obj.position.set(x, y, z);
  obj.castShadow = true;
  obj.receiveShadow = true;
  parent.add(obj);
  return obj;
}

function shapeMesh(name: string, shape: THREE.Shape, mat: THREE.Material, parent: THREE.Group, y: number): THREE.Mesh {
  const geo = new THREE.ShapeGeometry(shape, 24);
  geo.rotateX(Math.PI / 2);
  return mesh(name, geo, mat, parent, 0, y, 0);
}

function ribbon(name: string, curve: THREE.Curve<THREE.Vector3>, width: number, mat: THREE.Material, parent: THREE.Group, y: number, steps = 120): THREE.Mesh {
  const verts: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p = curve.getPoint(t);
    const tangent = curve.getTangent(t).normalize();
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    verts.push(p.x - side.x * width / 2, y, p.z - side.z * width / 2);
    verts.push(p.x + side.x * width / 2, y, p.z + side.z * width / 2);
    if (i < steps) {
      const a = i * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return mesh(name, geo, mat, parent);
}

function roofGeometry(width: number, depth: number, height: number): THREE.BufferGeometry {
  const x = width / 2;
  const z = depth / 2;
  const ridge = Math.max(0.08, x * 0.38);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([
    -x, 0, -z, x, 0, -z, x, 0, z, -x, 0, z,
    -ridge, height, 0, ridge, height, 0,
  ], 3));
  geo.setIndex([
    0, 5, 1, 0, 4, 5,
    3, 5, 4, 3, 2, 5,
    0, 3, 4, 1, 5, 2,
    0, 2, 3, 0, 1, 2,
  ]);
  geo.computeVertexNormals();
  return geo;
}

function canopyGeometry(phase = 0): THREE.BufferGeometry {
  // Radial rings vary by azimuth and height so the silhouette forms broad,
  // asymmetrical leaf masses rather than a lathed ball or stacked spheres.
  const rings = [
    [-0.72, 0], [-0.63, 0.46], [-0.48, 0.71], [-0.25, 0.89],
    [0.03, 1.0], [0.30, 0.95], [0.54, 0.76], [0.72, 0.49], [0.82, 0],
  ] as const;
  const segments = 14;
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

function beveledPanel(width: number, height: number, depth: number): THREE.BufferGeometry {
  const outline = new THREE.Shape();
  outline.moveTo(-width / 2, -height / 2);
  outline.lineTo(width / 2, -height / 2);
  outline.lineTo(width / 2, height / 2);
  outline.lineTo(-width / 2, height / 2);
  outline.closePath();
  return new THREE.ExtrudeGeometry(outline, {
    depth, steps: 1, bevelEnabled: true, bevelSegments: 1,
    bevelSize: Math.min(0.035, height * 0.08), bevelThickness: 0.025,
  });
}

function pointInPolygon(x: number, z: number, contour: THREE.Vector2[]): boolean {
  let inside = false;
  for (let i = 0, j = contour.length - 1; i < contour.length; j = i++) {
    const a = contour[i];
    const b = contour[j];
    if ((a.y > z) !== (b.y > z) && x < (b.x - a.x) * (z - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function createModel(spec?: LakesideTownSpec): THREE.Group {
  const root = new THREE.Group();
  root.name = 'Kambang_Iwak_Draft_Model';
  const terrain = new THREE.Group();
  terrain.name = 'Terrain_and_Water';
  root.add(terrain);

  const grass = material('Grass', 0x637b54);
  const grassLight = material('Park_Lawn', 0x829569);
  const soil = material('Plinth_Earth', 0x5a4c3f);
  const shore = material('Stone_Shoreline', 0xb5a88e);
  const path = material('Pedestrian_Path', 0xd1c6ae);
  const road = material('Asphalt_Road', 0x555f60);
  const water = new THREE.MeshStandardMaterial({
    name: 'Lake_Water', color: spec?.waterColor ?? 0x6b9fb0,
    roughness: 0.29, metalness: 0.08, side: THREE.DoubleSide,
  });
  const waterLine = new THREE.LineBasicMaterial({ color: 0xc3dbe0, transparent: true, opacity: 0.38 });
  const wood = material('Wood', 0x795841);
  const metal = material('Dark_Metal', 0x535957, 0.48);
  const wallCream = material('Building_Cream', 0xe2d7be);
  const wallBlue = material('Building_Blue', 0x899fa3);
  const wallWarm = material('Building_Warm', 0xc1a58c);
  const roofRed = material('Roof_Red', 0x9d5545);
  const roofGrey = material('Roof_Grey', 0x68727a);
  const window = material('Window', 0x405762, 0.25);
  const trim = material('Facade_Trim', 0xf1e8d4);
  const awning = material('Striped_Awning', 0xb77757);
  const trunk = material('Tree_Trunk', 0x60543d);
  const foliage = [
    material('Canopy_Deep', 0x426948),
    material('Canopy_Mid', 0x608155),
    material('Canopy_Light', 0x829664),
    material('Canopy_Olive', 0x6f8251),
  ];

  // Low rectangular study base, matching the 300:160 plan proportions.
  mesh('Display_Plinth', new THREE.BoxGeometry(WORLD_W, 0.38, WORLD_D), soil, terrain, 0, 0.19, 0);
  const undersideMaterial = new THREE.MeshStandardMaterial({
    name: 'Plinth_Underside', color: 0x6d5d4e, roughness: 1,
    emissive: 0x44382d, emissiveIntensity: 0.38, side: THREE.DoubleSide,
  });
  const underside = mesh('Display_Plinth_Underside', new THREE.PlaneGeometry(WORLD_W, WORLD_D),
    undersideMaterial, terrain, 0, -0.006, 0);
  underside.rotation.x = Math.PI / 2;
  underside.castShadow = false;
  underside.receiveShadow = false;
  // Ground_Plate is cut around the shoreline below; the lake is recessed.

  // One custom lake silhouette: the broad eastern basin connects to a west arm.
  // A long tree-covered peninsula projects between the two water portions.
  const lake = new THREE.Shape();
  lake.moveTo(-19, -1.4);
  lake.bezierCurveTo(-21, -4.7, -18, -8.1, -13.6, -7.8);
  lake.bezierCurveTo(-10.6, -7.5, -8.4, -6.6, -7, -4.1);
  lake.bezierCurveTo(-5.5, -1.8, -3.3, -0.8, -0.7, 0.0);
  lake.bezierCurveTo(1.1, 0.6, 3.5, -0.1, 5.0, -2.5);
  lake.bezierCurveTo(7.1, -5.6, 11, -7.6, 16, -7.0);
  lake.bezierCurveTo(21.9, -6.4, 24.0, -3.2, 23.4, 1.3);
  lake.bezierCurveTo(22.8, 5.8, 19.8, 8.0, 15.0, 8.4);
  lake.bezierCurveTo(10.5, 8.8, 7.5, 7.1, 4.7, 5.4);
  lake.bezierCurveTo(2.2, 3.8, -0.1, 3.4, -2.4, 4.3);
  lake.bezierCurveTo(-5.8, 5.7, -8.6, 8.6, -12.5, 8.1);
  lake.bezierCurveTo(-15.6, 7.7, -19.9, 4.3, -19, -1.4);
  // The land is one extruded shape with a true lake opening. Its side wall
  // reaches the plinth; the water lies below the top surface.
  const groundOutline = new THREE.Shape();
  groundOutline.moveTo(-WORLD_W / 2 + 0.06, -WORLD_D / 2 + 0.06);
  groundOutline.lineTo(WORLD_W / 2 - 0.06, -WORLD_D / 2 + 0.06);
  groundOutline.lineTo(WORLD_W / 2 - 0.06, WORLD_D / 2 - 0.06);
  groundOutline.lineTo(-WORLD_W / 2 + 0.06, WORLD_D / 2 - 0.06);
  groundOutline.closePath();
  const hole = new THREE.Path(lake.getPoints(96));
  groundOutline.holes.push(hole);
  const landGeometry = new THREE.ExtrudeGeometry(groundOutline, {
    depth: 0.16, steps: 1, bevelEnabled: false, curveSegments: 48,
  });
  landGeometry.rotateX(Math.PI / 2);
  mesh('Ground_Plate', landGeometry, grass, terrain, 0, GROUND_Y, 0);
  shapeMesh('Lake_Water_Surface', lake, water, terrain, WATER_Y);

  const lakeContour = lake.getPoints(192);
  const shorePoints = lakeContour.map(p => new THREE.Vector3(p.x, 0, p.y));
  const shoreCurve = new THREE.CatmullRomCurve3(shorePoints, true, 'centripetal');
  const clockwise = THREE.ShapeUtils.isClockWise(lakeContour);
  const bankPositions: number[] = [];
  const bankIndices: number[] = [];
  const pavingPositions: number[] = [];
  const pavingIndices: number[] = [];
  const steps = 192;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p = shoreCurve.getPoint(t);
    const tangent = shoreCurve.getTangent(t).normalize();
    const outward = new THREE.Vector3(tangent.z, 0, -tangent.x).multiplyScalar(clockwise ? -1 : 1);
    const put = (list: number[], offset: number, height: number) => {
      list.push(p.x + outward.x * offset, height, p.z + outward.z * offset);
    };
    put(bankPositions, -0.24, WATER_Y - 0.008);
    put(bankPositions, 0.02, WATER_Y + 0.025);
    put(bankPositions, 0.48, GROUND_Y + 0.012);
    put(pavingPositions, 0.48, GROUND_Y + 0.026);
    put(pavingPositions, 1.72, GROUND_Y + 0.026);
    if (i < steps) {
      const k = i * 3;
      for (let r = 0; r < 2; r++) bankIndices.push(k + r, k + r + 3, k + r + 1, k + r + 1, k + r + 3, k + r + 4);
      const q = i * 2;
      pavingIndices.push(q, q + 2, q + 1, q + 1, q + 2, q + 3);
    }
  }
  const bankGeometry = new THREE.BufferGeometry();
  bankGeometry.setAttribute('position', new THREE.Float32BufferAttribute(bankPositions, 3));
  bankGeometry.setIndex(bankIndices);
  bankGeometry.computeVertexNormals();
  mesh('Continuous_Shore_Edge', bankGeometry, shore, terrain);
  const pavingGeometry = new THREE.BufferGeometry();
  pavingGeometry.setAttribute('position', new THREE.Float32BufferAttribute(pavingPositions, 3));
  pavingGeometry.setIndex(pavingIndices);
  pavingGeometry.computeVertexNormals();
  mesh('Continuous_Pedestrian_Loop', pavingGeometry, path, terrain);

  // Visual water glints replace the previous conspicuous triangulation grid.
  if (spec?.showWaterGrid) {
    for (let i = 0; i < 7; i++) {
      const x = 8.5 + i * 1.4;
      const points = [new THREE.Vector3(x, WATER_Y + 0.014, 2.8), new THREE.Vector3(x + 0.85, WATER_Y + 0.014, 2.8)];
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), waterLine);
      line.name = `Water_Glint_${i + 1}`;
      terrain.add(line);
    }
  }

  // Narrow land tongue separates the west basin from the larger east basin.
  const island = new THREE.Shape();
  island.moveTo(-15.1, -0.7);
  island.bezierCurveTo(-13.7, -2.6, -10.2, -2.8, -7.5, -1.6);
  island.bezierCurveTo(-5.3, -0.9, -3.0, 0.3, -2.7, 1.2);
  island.bezierCurveTo(-3.5, 2.9, -6.9, 3.4, -9.3, 3.7);
  island.bezierCurveTo(-12.3, 3.9, -15.2, 2.5, -15.1, -0.7);
  const peninsulaGeometry = new THREE.ExtrudeGeometry(island, {
    depth: 0.14, steps: 1, bevelEnabled: true,
    bevelThickness: 0.04, bevelSize: 0.09, bevelSegments: 2,
    curveSegments: 24,
  });
  peninsulaGeometry.rotateX(Math.PI / 2);
  mesh('Tree_Peninsula', peninsulaGeometry, grassLight, terrain, 0, GROUND_Y + 0.04, 0);

  // Perimeter road and short paved connectors follow the plan, without covering the lake.
  mesh('South_Road', new THREE.BoxGeometry(50, 0.04, 2.2), road, terrain, 0, GROUND_Y + 0.03, 12.2);
  mesh('West_Road', new THREE.BoxGeometry(2.2, 0.04, 21), road, terrain, -25.3, GROUND_Y + 0.03, 0);
  const northPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-23, 0, -10.4), new THREE.Vector3(-14, 0, -11.0),
    new THREE.Vector3(-4, 0, -11.6), new THREE.Vector3(8, 0, -11.2),
    new THREE.Vector3(22, 0, -9.7),
  ]);
  ribbon('North_Park_Path', northPath, 1.3, path, terrain, GROUND_Y + 0.055);
  // Visible road geometry on the four perimeter edges and lane marks.
  mesh('North_Road', new THREE.BoxGeometry(46, 0.035, 1.25), road, terrain, 0, GROUND_Y + 0.023, -11.1);
  mesh('East_Road', new THREE.BoxGeometry(1.25, 0.035, 22), road, terrain, 24.55, GROUND_Y + 0.023, 0);
  const laneMark = material('Lane_Paint', 0xe8e0cc);
  for (let i = -22; i <= 22; i += 4) {
    mesh(`South_Lane_Mark_${i}`, new THREE.BoxGeometry(1.55, 0.008, 0.045), laneMark, terrain, i, GROUND_Y + 0.057, 12.2);
    mesh(`North_Lane_Mark_${i}`, new THREE.BoxGeometry(1.55, 0.008, 0.045), laneMark, terrain, i, GROUND_Y + 0.046, -11.1);
  }

  // Cambered bridge over the narrow channel, built from a real strip mesh.
  const bridge = new THREE.Group();
  bridge.name = 'Pedestrian_Bridge';
  bridge.position.set(-2.7, GROUND_Y + 0.09, 1.2);
  bridge.rotation.y = -0.24;
  root.add(bridge);
  const bridgeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, -2.2), new THREE.Vector3(0, 0.25, 0), new THREE.Vector3(0, 0, 2.2),
  ]);
  const deckVerts: number[] = [];
  const deckIndices: number[] = [];
  for (let i = 0; i <= 20; i++) {
    const p = bridgeCurve.getPoint(i / 20);
    deckVerts.push(-0.55, p.y, p.z, 0.55, p.y, p.z);
    if (i < 20) {
      const a = i * 2;
      deckIndices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const deckGeo = new THREE.BufferGeometry();
  deckGeo.setAttribute('position', new THREE.Float32BufferAttribute(deckVerts, 3));
  deckGeo.setIndex(deckIndices);
  deckGeo.computeVertexNormals();
  mesh('Bridge_Cambered_Deck', deckGeo, wood, bridge);
  for (let i = 0; i < 18; i++) {
    const p = bridgeCurve.getPoint((i + 0.5) / 18);
    mesh(`Bridge_Deck_Plank_${i + 1}`, beveledPanel(1.08, 0.025, 0.20), wood, bridge,
      0, p.y + 0.028, p.z - 0.11).rotation.x = -Math.PI / 2;
  }
  for (const x of [-0.43, 0.43]) {
    for (const z of [-1.8, 0, 1.8]) {
      const pileHeight = z === 0 ? 0.48 : 0.34;
      mesh(`Bridge_Support_${x}_${z}`, new THREE.CylinderGeometry(0.045, 0.06, pileHeight, 8), wood,
        bridge, x, -pileHeight / 2, z);
    }
  }
  for (const side of [-0.52, 0.52]) {
    const railCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side, 0.45, -2.2), new THREE.Vector3(side, 0.7, 0), new THREE.Vector3(side, 0.45, 2.2),
    ]);
    mesh(`Bridge_Rail_${side}`, new THREE.TubeGeometry(railCurve, 20, 0.025, 5), wood, bridge);
    for (let i = 0; i <= 5; i++) {
      const t = i / 5;
      const top = railCurve.getPoint(t);
      const bottom = bridgeCurve.getPoint(t);
      mesh(`Bridge_Post_${side}_${i}`, new THREE.CylinderGeometry(0.025, 0.03, top.y - bottom.y, 5), wood, bridge, side, (top.y + bottom.y) / 2, top.z);
    }
  }

  // Building kit: low perimeter blocks, shaped hip roofs, inset doors and window arrays.
  const buildings = new THREE.Group();
  buildings.name = 'Perimeter_Buildings';
  root.add(buildings);
  const buildingFootprints: Array<{ x: number; z: number; w: number; d: number }> = [];
  function addBuilding(name: string, x: number, z: number, w: number, d: number, h: number, wall: THREE.Material, roof: THREE.Material, facing = 1): void {
    const group = new THREE.Group();
    group.name = name;
    group.position.set(x, GROUND_Y, z);
    group.rotation.y = facing === -1 ? Math.PI : 0;
    buildings.add(group);
    buildingFootprints.push({ x, z, w, d });
    const stories = h >= 2.05 ? 2 : 1;
    mesh(`${name}_Raised_Foundation`, new THREE.BoxGeometry(w + 0.12, 0.22, d + 0.12), shore, group, 0, 0.11, 0);
    mesh(`${name}_Walls`, new THREE.BoxGeometry(w, h - 0.15, d), wall, group, 0, h / 2 + 0.1, 0);
    // A shallow extruded facade shell carries real apertures. Dark glazing
    // and door panels sit behind the shell, making recesses visible in profile.
    const facade = new THREE.Shape();
    facade.moveTo(-w / 2, 0.15);
    facade.lineTo(w / 2, 0.15);
    facade.lineTo(w / 2, h - 0.12);
    facade.lineTo(-w / 2, h - 0.12);
    facade.closePath();
    const cutout = (cx: number, cy: number, fw: number, fh: number) => {
      const opening = new THREE.Path();
      opening.moveTo(cx - fw / 2, cy - fh / 2);
      opening.lineTo(cx - fw / 2, cy + fh / 2);
      opening.lineTo(cx + fw / 2, cy + fh / 2);
      opening.lineTo(cx + fw / 2, cy - fh / 2);
      opening.closePath();
      facade.holes.push(opening);
    };
    const openingCols = Math.max(2, Math.floor(w / 1.12));
    for (let story = 0; story < stories; story++) {
      const cy = stories === 2 ? (story === 0 ? h * 0.34 : h * 0.76) : h * 0.63;
      for (let c = 0; c < openingCols; c++) {
        const cx = -w / 2 + (c + 0.5) * w / openingCols;
        if (story === 0 && Math.abs(cx) < 0.43) continue;
        cutout(cx, cy, 0.47, 0.57);
      }
    }
    const doorOpeningH = Math.min(1.03, h * 0.63);
    cutout(0, doorOpeningH / 2 + 0.17, 0.61, doorOpeningH);
    const facadeGeo = new THREE.ExtrudeGeometry(facade, {
      depth: 0.065, steps: 1, bevelEnabled: true,
      bevelSize: 0.018, bevelThickness: 0.015, bevelSegments: 1,
    });
    mesh(`${name}_Recessed_Facade`, facadeGeo, wall, group, 0, 0, d / 2 + 0.025);
    const rearFacade = mesh(`${name}_Rear_Recessed_Facade`, facadeGeo, wall, group, 0, 0, -d / 2 - 0.025);
    rearFacade.rotation.y = Math.PI;
    mesh(`${name}_Rear_Entry`, new THREE.BoxGeometry(0.56, doorOpeningH, 0.026), wood,
      group, 0, doorOpeningH / 2 + 0.17, -d / 2 - 0.055);
    for (let story = 0; story < stories; story++) {
      const cy = stories === 2 ? (story === 0 ? h * 0.34 : h * 0.76) : h * 0.63;
      for (let c = 0; c < openingCols; c++) {
        const cx = -w / 2 + (c + 0.5) * w / openingCols;
        if (story === 0 && Math.abs(cx) < 0.43) continue;
        mesh(`${name}_Rear_Glazing_${story}_${c}`, new THREE.BoxGeometry(0.40, 0.50, 0.026),
          window, group, cx, cy, -d / 2 - 0.055);
        mesh(`${name}_Rear_Mullion_${story}_${c}`, new THREE.BoxGeometry(0.035, 0.50, 0.028),
          trim, group, cx, cy, -d / 2 - 0.077);
      }
    }
    mesh(`${name}_Eaves`, new THREE.BoxGeometry(w + 0.58, 0.08, d + 0.58), roof, group, 0, h + 0.04, 0);
    mesh(`${name}_Roof`, roofGeometry(w + 0.58, d + 0.58, Math.min(0.83, h * 0.39)), roof, group, 0, h + 0.08, 0);
    mesh(`${name}_Cornice`, new THREE.BoxGeometry(w + 0.16, 0.10, d + 0.16), trim, group, 0, h - 0.12, 0);
    if (stories === 2) mesh(`${name}_Floor_Band`, new THREE.BoxGeometry(w + 0.08, 0.08, d + 0.08), trim, group, 0, h * 0.54, 0);
    const doorH = Math.min(1.03, h * 0.63);
    mesh(`${name}_Entry_Frame`, new THREE.BoxGeometry(0.70, doorH + 0.09, 0.055), trim, group, 0, doorH / 2 + 0.18, d / 2 + 0.028);
    mesh(`${name}_Entry`, new THREE.BoxGeometry(0.56, doorH, 0.058), wood, group, 0, doorH / 2 + 0.16, d / 2 + 0.061);
    mesh(`${name}_Door_Lintel`, new THREE.BoxGeometry(0.85, 0.10, 0.22), trim, group, 0, doorH + 0.22, d / 2 + 0.07);
    const cols = Math.max(2, Math.floor(w / 1.12));
    for (let story = 0; story < stories; story++) {
      const wy = stories === 2 ? (story === 0 ? h * 0.34 : h * 0.76) : h * 0.63;
      for (let c = 0; c < cols; c++) {
        const wx = -w / 2 + (c + 0.5) * w / cols;
        if (story === 0 && Math.abs(wx) < 0.43) continue;
        mesh(`${name}_Window_Frame_${story}_${c}`, new THREE.BoxGeometry(0.54, 0.66, 0.055), trim, group, wx, wy, d / 2 + 0.031);
        mesh(`${name}_Window_Glass_${story}_${c}`, new THREE.BoxGeometry(0.40, 0.52, 0.058), window, group, wx, wy, d / 2 + 0.063);
        mesh(`${name}_Window_Mullion_${story}_${c}`, new THREE.BoxGeometry(0.045, 0.52, 0.06), trim, group, wx, wy, d / 2 + 0.097);
        mesh(`${name}_Window_Sill_${story}_${c}`, new THREE.BoxGeometry(0.66, 0.06, 0.18), trim, group, wx, wy - 0.35, d / 2 + 0.09);
      }
    }
    for (const side of [-1, 1]) {
      mesh(`${name}_Side_Frame_${side}`, new THREE.BoxGeometry(0.06, 0.60, 0.52), trim, group, side * (w / 2 + 0.03), h * 0.63, 0);
      mesh(`${name}_Side_Glass_${side}`, new THREE.BoxGeometry(0.065, 0.47, 0.39), window, group, side * (w / 2 + 0.065), h * 0.63, 0);
    }
    if (name.includes('Block_B') || name.includes('South')) {
      const canopy = mesh(`${name}_Shopfront_Awning`, roofGeometry(Math.min(w * 0.75, 2.5), 0.75, 0.22), awning, group, 0, h * 0.57, d / 2 + 0.40);
      canopy.rotation.x = 0.08;
    }
  }
  // The draft's compact perimeter blocks make the lake the focus while
  // giving the top and elevation views the building density of the sheet.
  addBuilding('Northwest_Block_A', -22, -12.1, 4.0, 2.1, 1.85, wallWarm, roofRed);
  addBuilding('Northwest_Block_B', -17.2, -12.1, 3.8, 2.1, 2.35, wallBlue, roofGrey);
  addBuilding('Northwest_Block_C', -12.7, -12.2, 3.6, 2.0, 1.7, wallCream, roofRed);
  addBuilding('North_Block_D', -8.4, -12.25, 3.2, 1.8, 2.1, wallWarm, roofGrey);
  addBuilding('North_Block_E', -4.2, -12.25, 3.0, 1.8, 1.8, wallBlue, roofRed);
  addBuilding('North_Block_F', 0.4, -12.25, 3.4, 1.9, 2.45, wallCream, roofGrey);
  addBuilding('North_Block_G', 5.1, -12.25, 3.2, 1.9, 1.85, wallWarm, roofRed);
  addBuilding('North_Block_H', 10.0, -12.2, 3.5, 1.9, 2.15, wallBlue, roofGrey);
  addBuilding('North_Block_I', 15.0, -12.1, 3.4, 2.0, 1.75, wallCream, roofRed);
  addBuilding('East_North_Block', 22.4, -10.7, 3.0, 2.1, 2.05, wallWarm, roofGrey);
  addBuilding('East_Park_Block', 25.2, 6.9, 2.8, 2.2, 1.65, wallBlue, roofRed);
  addBuilding('East_South_Block', 25.0, 10.2, 2.6, 2.0, 1.8, wallCream, roofGrey);
  addBuilding('Southeast_Block', 19.6, 12.8, 3.6, 2.0, 1.75, wallWarm, roofGrey, -1);
  addBuilding('South_Block_E', 14.5, 13.4, 3.2, 1.8, 2.25, wallBlue, roofRed, -1);
  addBuilding('South_Block_D', 9.5, 13.4, 3.4, 1.8, 1.8, wallCream, roofGrey, -1);
  addBuilding('South_Block_C', 4.5, 13.4, 3.2, 1.8, 2.15, wallWarm, roofRed, -1);
  addBuilding('South_Block_B', -1.2, 13.4, 3.6, 1.8, 1.8, wallBlue, roofGrey, -1);
  addBuilding('South_Pavilion', -7.0, 13.4, 3.4, 1.8, 1.5, wallCream, roofRed, -1);
  addBuilding('South_Block_A', -12.6, 13.4, 3.5, 1.8, 2.05, wallWarm, roofGrey, -1);
  addBuilding('Southwest_Block', -19.9, 10.3, 3.3, 2.0, 1.65, wallWarm, roofRed, -1);
  addBuilding('West_Park_Block', -23.0, 7.7, 3.2, 2.2, 1.6, wallBlue, roofGrey);

  // Dense canopy belt: reusable custom radial leaf meshes and a deterministic
  // shoreline distribution. Every tree remains an independent named group.
  const trees = new THREE.Group();
  trees.name = 'Tree_Canopies';
  root.add(trees);
  const crownGeometries = [canopyGeometry(0), canopyGeometry(1.7)];
  const trunkGeo = new THREE.CylinderGeometry(0.11, 0.19, 1.02, 9);
  function addTree(name: string, x: number, z: number, size: number, colorIndex: number): void {
    const tree = new THREE.Group();
    tree.name = name;
    tree.position.set(x, GROUND_Y, z);
    trees.add(tree);
    mesh(`${name}_Trunk`, trunkGeo, trunk, tree, 0, 0.51 * size, 0).scale.setScalar(size);
    for (const [j, dx, dy, dz, lobeScale] of [
      [0, 0, 1.67, 0, 1], [1, -0.53, 1.48, 0.17, 0.72], [2, 0.42, 1.64, -0.31, 0.68],
    ] as const) {
      const crown = mesh(`${name}_Canopy_Lobe_${j + 1}`, crownGeometries[(colorIndex + j) % 2],
        foliage[(colorIndex + j) % foliage.length], tree,
        dx * size, dy * size, dz * size);
      crown.scale.set(size * lobeScale, size * lobeScale * 0.9, size * lobeScale * 0.93);
      crown.rotation.y = colorIndex * 0.31 + j * 0.9;
    }
  }
  const peninsulaTrees: Array<[number, number, number]> = [
    [-13.5, 0.8, 1.05], [-12.2, -0.5, 1.14], [-10.7, 1.6, 1.22],
    [-9.1, -0.5, 1.12], [-8.0, 1.7, 1.18], [-6.7, 0.1, 1.10],
    [-5.4, 1.9, 1.04], [-4.5, 0.6, 0.92], [-12.8, 2.5, 1.0],
    [-10.6, 3.0, 1.1], [-8.8, 3.0, 1.0], [-6.5, 2.8, 0.96],
  ];
  peninsulaTrees.forEach(([x, z, size], i) => addTree(`Peninsula_Tree_${i + 1}`, x, z, size, i));
  const edgeTrees: Array<[number, number, number]> = [
    [-22, -7.8, 1.15], [-19.8, -9.4, 1.1], [-17.2, -9.6, 1.0], [-14.9, -9.5, 1.18],
    [-9.2, -10.1, 1.16], [-6.8, -10.3, 1.05], [-4.4, -10.5, 1.1], [-1.9, -10.5, 1.0],
    [1.0, -10.4, 1.18], [4.1, -10.2, 1.12], [7.3, -10.0, 1.2], [10.6, -9.6, 1.05],
    [13.9, -9.5, 1.15], [17.2, -9.3, 1.08], [20.5, -8.2, 1.1], [24.5, -4.8, 1.0],
    [25.2, -1.0, 1.15], [25.3, 3.0, 1.12], [22.9, 9.1, 1.0], [17.6, 10.1, 1.14],
    [12.7, 10.1, 1.14], [7.6, 9.8, 1.1], [2.8, 8.1, 1.1], [-3.5, 7.2, 1.07],
    [-8.3, 9.0, 1.12], [-12.7, 9.5, 1.14], [-17.4, 7.6, 1.08], [-21.9, 4.6, 1.12],
    [-21.5, 0.2, 1.0], [-20.8, -4.2, 1.1], [2.0, 10.5, 0.9], [5.2, 10.4, 0.95],
  ];
  edgeTrees.forEach(([x, z, size], i) => addTree(`Shore_Tree_${i + 1}`, x, z, size, i + 2));
  // Fill the gaps along the outer promenade without unseeded randomness.
  const onLand = (x: number, z: number) =>
    Math.abs(x) < WORLD_W / 2 - 1 && Math.abs(z) < WORLD_D / 2 - 1
    && !pointInPolygon(x, z, lakeContour)
    && !buildingFootprints.some(b => Math.abs(x - b.x) < b.w / 2 + 0.65 && Math.abs(z - b.z) < b.d / 2 + 0.65);
  for (let i = 0; i < 60; i++) {
    const t = (i + 0.42) / 60;
    const p = shoreCurve.getPoint(t);
    const tangent = shoreCurve.getTangent(t).normalize();
    const sign = clockwise ? -1 : 1;
    const outward = new THREE.Vector3(tangent.z * sign, 0, -tangent.x * sign);
    const x = p.x + outward.x * (2.55 + (i % 3) * 0.22);
    const z = p.z + outward.z * (2.55 + (i % 3) * 0.22);
    if (onLand(x, z)) addTree(`Promenade_Tree_${i + 1}`, x, z, 0.78 + (i % 5) * 0.075, i + 1);
  }

  // Small furnishings make scale legible in the orthographic side views.
  const furnishings = new THREE.Group();
  furnishings.name = 'Benches_and_Lamps';
  root.add(furnishings);
  for (const [i, x, z] of [[0, -18.8, 5.6], [1, 3.1, 9.3], [2, 16.6, 10.0], [3, -2.8, -9.3]] as const) {
    mesh(`Bench_Seat_${i}`, new THREE.BoxGeometry(1.05, 0.09, 0.32), wood, furnishings, x, 0.85, z);
    mesh(`Bench_Back_${i}`, new THREE.BoxGeometry(1.05, 0.43, 0.08), wood, furnishings, x, 1.08, z - 0.16);
    for (const dx of [-0.39, 0.39]) mesh(`Bench_Leg_${i}_${dx}`, new THREE.CylinderGeometry(0.035, 0.045, 0.4, 6), metal, furnishings, x + dx, 0.63, z);
  }
  for (const [i, x, z] of [[0, -20.2, -8.4], [1, -4.2, -10.0], [2, 11.0, 10.8], [3, 23.9, 7.7]] as const) {
    mesh(`Lamp_Post_${i}`, new THREE.CylinderGeometry(0.04, 0.065, 2.55, 8), metal, furnishings, x, 1.7, z);
    mesh(`Lamp_Head_${i}`, new THREE.SphereGeometry(0.16, 9, 7), wallCream, furnishings, x, 3.02, z);
  }

  if (spec?.scale !== undefined) root.scale.setScalar(spec.scale);
  return root;
}
