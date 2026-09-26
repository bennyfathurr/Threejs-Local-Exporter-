import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface MenaraLedengSpec {
  scale?: number;
  showSurroundingCity?: boolean;
  showParkVegetation?: boolean;
  showStreetProps?: boolean;
  showVehicles?: boolean;
  showWaterways?: boolean;
}

/**
 * MODELING_ASSUMPTIONS
 * Units are in proposed metres:
 * - Base plinth: 200 m (width, X) by 150 m (depth, Z).
 * - Menara Ledeng total height: ~60.0 m to the lightning rod spire peak.
 * - Y is Up; (0, 0, 0) is ground level centered under the water tower.
 * - ORIENTATION:
 *   - UTARA (North, -Z): Main Entrance of Kantor Walikota (Portico, fluted columns, grand steps)
 *     facing North onto Jalan Merdeka / North Boulevard.
 *   - SELATAN (South, +Z): Belakang / rear of Kantor Walikota, facing the expansive SUNGAI MUSI
 *     with stone revetment embankment, riverside promenade, grand docking stairs, and perahu tambang.
 *   - BARAT (West, -X): SUNGAI SEKANAK urban canal running north-to-south and emptying into Musi,
 *     crossed by the Dutch colonial arched stone bridge "JEMBATAN SEKANAK" along Jalan Merdeka.
 *   - TIMUR (East, +X): Municipal Administrative Annex building.
 * - WATER TOWER CUBE:
 *   - The water tower tank (Bak Air) is a pure Art Deco RECTANGULAR CUBE body with flat roof deck,
 *     upper cantilever corbels, top cornice, continuous flat-roof safety railings, corner flagpoles,
 *     and apex lightning rod (NO hipped/pitched house roof, exactly matching historical photos).
 *   - Includes internal water mass (1,200 m³ capacity) and front cutaway observation glazing for AR.
 * - Incorporates the 5 AR ETNO-STEM educational anchors:
 *   1. ETNO: Sungai Musi, akses air & perubahan sosial (South, at river promenade)
 *   2. SAINS: Gravitasi, tekanan hidrostatis & kesehatan air (Central blue riser pipe)
 *   3. TEKNOLOGI: Tangki, pipa, katup & distribusi (Elevated tank manifold & valves)
 *   4. REKAYASA: Struktur tangki 1.200 m³ & fondasi (Reinforced concrete columns & corbels)
 *   5. MATEMATIKA: Tinggi 35 m, volume & geometri (Tower height & volume geometry)
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

function hippedRoof(name: string, width: number, depth: number, height: number, mat: THREE.Material): THREE.Mesh {
  const w = width / 2, d = depth / 2, r = width * 0.26;
  const p = [
    [-w, 0, d], [w, 0, d], [r, height, 0], [-r, height, 0],
    [w, 0, -d], [-w, 0, -d],
  ];
  const faces = [[0, 1, 2], [0, 2, 3], [4, 5, 3], [4, 3, 2], [1, 4, 2], [5, 0, 3]];
  const data: number[] = [];
  faces.forEach(f => f.forEach(i => data.push(...p[i])));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(data, 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function tree(name: string, radius: number, height: number, m: ReturnType<typeof makeMaterials>): THREE.Group {
  const g = new THREE.Group();
  g.name = name;
  const trunkH = height * 0.38;
  const trunk = cylinder(`${name}_Trunk`, radius * 0.14, radius * 0.22, trunkH, 12, m.timber, 0, trunkH / 2, 0);
  g.add(trunk);
  const foliageH = height * 0.62;
  const c1 = new THREE.Mesh(new THREE.DodecahedronGeometry(radius, 2), m.foliage);
  c1.name = `${name}_Canopy_Main`;
  c1.position.y = trunkH + foliageH * 0.45;
  c1.scale.set(1.0, 1.15, 0.95);
  c1.castShadow = true;
  g.add(c1);
  const c2 = new THREE.Mesh(new THREE.DodecahedronGeometry(radius * 0.72, 2), m.foliageLight);
  c2.name = `${name}_Canopy_Upper`;
  c2.position.set(radius * 0.15, trunkH + foliageH * 0.72, -radius * 0.1);
  c2.castShadow = true;
  g.add(c2);
  return g;
}

function makeMaterials() {
  return {
    earth: material('Earth_Underside_Base', 0x363028, 0.95),
    asphalt: material('City_Road_Asphalt', 0x2e3136, 0.88),
    roadMarking: material('Road_Lane_Marking', 0xf0ede4, 0.6),
    curb: material('Concrete_Curb_Stone', 0xb8b2a7, 0.82),
    sidewalk: material('Sidewalk_Paving', 0xc5bfb3, 0.78),
    plazaPaving: material('Civic_Plaza_Paving_Tile', 0xd1cbc0, 0.75),
    promenadePaving: material('Promenade_Paving', 0xb8af9e, 0.8),
    foliage: material('Tree_Canopy_Foliage', 0x486b3b, 0.85),
    foliageLight: material('Ornamental_Shrub_Foliage', 0x688d46, 0.85),
    timber: material('Trunk_Timber', 0x5a4635, 0.85),
    stucco: material('Municipal_Office_Stucco', 0xede8dc, 0.75),
    stuccoCream: material('Civic_Facade_Cream_Stucco', 0xf2ede0, 0.75),
    stuccoDark: material('Municipal_Accent_Stucco', 0xd3ccbe, 0.78),
    concreteTower: material('Tower_Structural_Concrete', 0xdcd7cd, 0.72),
    concreteDark: material('Tower_Framework_Beams', 0xa49f95, 0.78),
    tankStucco: material('Tower_Tank_Reservoir_Wall', 0xe2ded4, 0.74),
    trim: material('Cornice_Stone_Trim', 0xbab3a6, 0.65),
    glass: material('Office_Window_Glass', 0x364858, 0.18, 0.45),
    metal: material('Balcony_Steel_Metal', 0x454b52, 0.45, 0.6),
    metalPainted: material('Metal_Painted_White', 0xe8e6e2, 0.5, 0.3),
    carBodyRed: material('Vehicle_Body_Red', 0x9e2a2b, 0.3, 0.7),
    carBodyBlue: material('Vehicle_Body_Blue', 0x2b4c7e, 0.3, 0.7),
    carBodySilver: material('Vehicle_Body_Silver', 0x909497, 0.25, 0.8),
    buildingCommercial1: material('Urban_Commercial_Facade_A', 0xe0d6c5, 0.8),
    buildingCommercial2: material('Urban_Commercial_Facade_B', 0xc2b7a6, 0.8),
    buildingBrick: material('Urban_Facade_Brick_Red', 0x9e5746, 0.82),
    roofTerracotta: material('Shophouse_Terracotta_Roof', 0xa85d45, 0.85),
    roofCommercialFlat: material('Commercial_Rooftop_Gravel', 0x827d76, 0.88),

    // River, Canal & AR ETNO-STEM Water System
    riverWater: material('Sungai_Musi_Water_Surface', 0x265e6b, 0.15, 0.35),
    canalWater: material('Sungai_Sekanak_Canal_Water', 0x2f636e, 0.2, 0.25),
    riverEmbankment: material('River_Stone_Revetment', 0x8b857a, 0.85),
    riverPromenade: material('River_Promenade_Paving', 0xc7c0b0, 0.75),
    boatWood: material('Perahu_Tambang_Timber', 0x5b3f2a, 0.85),
    boatCanopy: material('Perahu_Canopy_Canvas', 0xba4e32, 0.8),
    pipeBlue: material('Tower_Water_Riser_Pipe_Blue', 0x1d6fa5, 0.3, 0.3),
    waterReservoir: material('Tower_Water_Reservoir_Mass', 0x2480b0, 0.12, 0.25, true, 0.88),
    waterTankGlass: material('Tower_Reservoir_Cutaway_Glass', 0x68a5cc, 0.1, 0.5, true, 0.45),
  };
}

/**
 * Creates the central Menara Ledeng architectural complex:
 * - 3-story Art Deco / Dutch colonial Municipal Office Base (Kantor Walikota)
 *   with main entrance portico facing NORTH (-Z onto Jalan Merdeka).
 * - Reinforced concrete open skeletal framework with rectangular grid (Rangka Struktur Menara).
 * - Prominent central blue water riser pipe running down through the tower (Hotspot 2: SAINS).
 * - Pure RECTANGULAR CUBE water reservoir tank with flat roof deck, top cantilever corbels,
 *   continuous perimeter roof railings, corner flagpoles, and apex lightning spire
 *   (NO hipped house roof, perfectly matching the historical photograph).
 */
function createMenaraLedengComplex(m: ReturnType<typeof makeMaterials>): THREE.Group {
  const complex = new THREE.Group();
  complex.name = 'Menara_Ledeng_Complex';

  // 1. PLAZA LOT ELEVATED PLINTH
  const lotW = 60, lotD = 56, lotH = 0.35;
  complex.add(box('Menara_Ledeng_Lot_Plinth', lotW, lotH, lotD, m.curb, 0, lotH / 2, 0));
  complex.add(box('Menara_Ledeng_Lot_Paving', lotW - 0.8, 0.08, lotD - 0.8, m.plazaPaving, 0, lotH + 0.04, 0));

  // 2. KANTOR WALIKOTA BASE BUILDING (Art Deco Municipal Office)
  const baseBldg = new THREE.Group();
  baseBldg.name = 'Kantor_Walikota_Base_Building';

  // Central Core Massing (beneath tower)
  const coreW = 24, coreD = 24, coreH = 13.5;
  baseBldg.add(box('Kantor_Walikota_Central_Core', coreW, coreH, coreD, m.stucco, 0, lotH + coreH / 2, 0));
  baseBldg.add(box('Kantor_Walikota_Core_Cornice', coreW + 1.2, 0.6, coreD + 1.2, m.trim, 0, lotH + coreH + 0.3, 0));

  // West & East Office Wings
  const wingW = 14, wingD = 18, wingH = 11.0;
  for (const side of [-1, 1]) {
    const wx = side * (coreW / 2 + wingW / 2 - 0.8);
    baseBldg.add(box(`Kantor_Walikota_Wing_${side > 0 ? 'East' : 'West'}`, wingW, wingH, wingD, m.stucco, wx, lotH + wingH / 2, 0));
    baseBldg.add(box(`Kantor_Walikota_Wing_Cornice_${side > 0 ? 'East' : 'West'}`, wingW + 0.8, 0.5, wingD + 0.8, m.trim, wx, lotH + wingH + 0.25, 0));
    baseBldg.add(box(`Kantor_Walikota_Wing_Parapet_${side > 0 ? 'East' : 'West'}`, wingW - 0.4, 0.8, wingD - 0.4, m.stuccoDark, wx, lotH + wingH + 0.9, 0));

    // Vertical Pilasters & Recessed Window Bays on Wings (North & South facades)
    const pilasterSpecs: BlockSpec[] = [];
    const windowSpecs: BlockSpec[] = [];
    const frameSpecs: BlockSpec[] = [];

    for (const fz of [-wingD / 2, wingD / 2]) {
      const zOffset = Math.sign(fz) * 0.15;
      for (let i = 0; i < 4; i++) {
        const px = wx + (i - 1.5) * 3.6;
        pilasterSpecs.push([0.55, wingH - 0.4, 0.35, px, lotH + wingH / 2, fz + zOffset]);
        if (i < 3) {
          const winX = wx + (i - 1.0) * 3.6;
          // Floor 1 & Floor 2 Windows
          windowSpecs.push([2.0, 2.2, 0.2, winX, lotH + 3.6, fz + zOffset * 0.5]);
          frameSpecs.push([2.2, 2.4, 0.12, winX, lotH + 3.6, fz + zOffset * 0.3]);
          windowSpecs.push([2.0, 2.2, 0.2, winX, lotH + 7.4, fz + zOffset * 0.5]);
          frameSpecs.push([2.2, 2.4, 0.12, winX, lotH + 7.4, fz + zOffset * 0.3]);
        }
      }
    }
    baseBldg.add(repeatedBoxes(`Kantor_Walikota_Wing_Pilasters_${side > 0 ? 'East' : 'West'}`, pilasterSpecs, m.trim));
    baseBldg.add(repeatedBoxes(`Kantor_Walikota_Wing_Frames_${side > 0 ? 'East' : 'West'}`, frameSpecs, m.stuccoDark));
    baseBldg.add(repeatedBoxes(`Kantor_Walikota_Wing_Windows_${side > 0 ? 'East' : 'West'}`, windowSpecs, m.glass));
  }

  // MAIN ENTRANCE PORTICO FACING NORTH (-Z onto Jalan Merdeka)
  const porticoW = 13, porticoD = 6.5, porticoH = 5.8;
  const porticoZ = -(coreD / 2 + porticoD / 2 - 0.5); // -14.5 m (North!)

  baseBldg.add(box('Kantor_Walikota_Entrance_Portico_Base', porticoW, 0.8, porticoD, m.curb, 0, lotH + 0.4, porticoZ));
  baseBldg.add(box('Kantor_Walikota_Entrance_Canopy', porticoW + 0.8, 0.6, porticoD + 0.6, m.trim, 0, lotH + porticoH, porticoZ));
  baseBldg.add(box('Kantor_Walikota_Entrance_Canopy_Parapet', porticoW + 0.2, 0.7, porticoD + 0.2, m.stuccoDark, 0, lotH + porticoH + 0.65, porticoZ));

  // Front Entrance Fluted Columns (on the North side of the portico)
  for (const cx of [-4.8, -1.6, 1.6, 4.8]) {
    baseBldg.add(cylinder(`Kantor_Walikota_Portico_Col_${cx}`, 0.42, 0.48, porticoH - 0.8, 16, m.trim, cx, lotH + 0.8 + (porticoH - 0.8) / 2, porticoZ - porticoD / 2 + 0.6));
  }

  // Entrance Double Glass Doors (facing North)
  baseBldg.add(box('Kantor_Walikota_Main_Door', 3.6, 3.2, 0.2, m.glass, 0, lotH + 2.4, porticoZ + porticoD / 2 - 0.1));
  baseBldg.add(box('Kantor_Walikota_Door_Frame', 4.0, 3.6, 0.15, m.metal, 0, lotH + 2.6, porticoZ + porticoD / 2 - 0.05));

  // Entrance Grand Steps stepping down toward North (Jalan Merdeka)
  for (let s = 0; s < 4; s++) {
    baseBldg.add(box(`Kantor_Walikota_Entrance_Step_${s}`, 10 - s * 0.9, 0.2, 0.75, m.curb, 0, lotH + (3 - s) * 0.2 + 0.1, porticoZ - porticoD / 2 - 0.4 - s * 0.65));
  }

  // Central Tower Transition Pedestal (Terrace around framework base)
  const pedW = 20, pedD = 20, pedH = 2.65;
  baseBldg.add(box('Tower_Transition_Pedestal', pedW, pedH, pedD, m.stuccoDark, 0, lotH + coreH + pedH / 2, 0));
  baseBldg.add(box('Tower_Transition_Cornice', pedW + 1.0, 0.45, pedD + 1.0, m.trim, 0, lotH + coreH + pedH + 0.22, 0));

  complex.add(baseBldg);

  // 3. TOWER SKELETAL FRAMEWORK (Concrete Column & Tie-Beam Cage)
  const framework = new THREE.Group();
  framework.name = 'Tower_Skeletal_Framework';

  const frameBottom = lotH + coreH + pedH + 0.45; // 16.95 m
  const frameHeight = 24.5;
  const frameTop = frameBottom + frameHeight; // 41.45 m
  const cageW = 14.4, cageD = 12.0;

  // Rectangular Concrete Column Grid
  const colSpecs: BlockSpec[] = [];
  const colXs = [-cageW / 2, -cageW / 6, cageW / 6, cageW / 2];
  const colZs = [-cageD / 2, 0, cageD / 2];

  for (const cx of colXs) {
    for (const cz of colZs) {
      if (Math.abs(cx) < cageW / 4 && cz === 0) continue;
      colSpecs.push([1.25, frameHeight, 1.25, cx, frameBottom + frameHeight / 2, cz]);
    }
  }
  framework.add(repeatedBoxes('Tower_Main_Columns', colSpecs, m.concreteTower));

  // Intermediate Horizontal Tie-Beam Loops (4 structural tiers)
  const beamSpecs: BlockSpec[] = [];
  const tiers = 4;
  for (let t = 1; t <= tiers; t++) {
    const by = frameBottom + (t / tiers) * frameHeight - 0.45;
    beamSpecs.push([cageW + 1.25, 0.85, 0.8, 0, by, -cageD / 2]);
    beamSpecs.push([cageW + 1.25, 0.85, 0.8, 0, by, cageD / 2]);
    beamSpecs.push([0.8, 0.85, cageD + 1.25, -cageW / 2, by, 0]);
    beamSpecs.push([0.8, 0.85, cageD + 1.25, cageW / 2, by, 0]);
    for (const cx of [-cageW / 6, cageW / 6]) {
      beamSpecs.push([0.7, 0.75, cageD, cx, by, 0]);
    }
    beamSpecs.push([cageW, 0.75, 0.7, 0, by, 0]);
  }
  framework.add(repeatedBoxes('Tower_Horizontal_Tie_Beams', beamSpecs, m.concreteDark));

  // Structural Diagonal Cross Bracing (X-bracing struts)
  const braceSpecs: BlockSpec[] = [];
  for (let t = 0; t < tiers; t++) {
    const y0 = frameBottom + (t / tiers) * frameHeight;
    const y1 = frameBottom + ((t + 1) / tiers) * frameHeight;
    const yMid = (y0 + y1) / 2;
    const bayH = y1 - y0;
    const bayW = cageW / 3;
    const braceLen = Math.sqrt(bayW * bayW + bayH * bayH);

    // Front (North) & Back (South) bays
    for (const bz of [-cageD / 2, cageD / 2]) {
      for (let b = 0; b < 3; b++) {
        const bx = -cageW / 2 + (b + 0.5) * bayW;
        braceSpecs.push([0.22, braceLen * 0.92, 0.22, bx, yMid, bz]);
      }
    }
    // East & West side bays
    for (const bx of [-cageW / 2, cageW / 2]) {
      const sideBayD = cageD / 2;
      const sideBraceLen = Math.sqrt(sideBayD * sideBayD + bayH * bayH);
      for (let b = 0; b < 2; b++) {
        const bz = -cageD / 2 + (b + 0.5) * sideBayD;
        braceSpecs.push([0.22, sideBraceLen * 0.92, 0.22, bx, yMid, bz]);
      }
    }
  }
  framework.add(repeatedBoxes('Tower_Diagonal_Bracing_Struts', braceSpecs, m.metal));

  // Cantilever Concrete Support Corbels at top of columns
  const corbelSpecs: BlockSpec[] = [];
  for (const cx of colXs) {
    for (const cz of colZs) {
      if (Math.abs(cx) < cageW / 4 && cz === 0) continue;
      const dirX = Math.sign(cx);
      const dirZ = Math.sign(cz);
      corbelSpecs.push([1.35, 1.4, 1.35, cx + dirX * 0.6, frameTop - 0.7, cz + dirZ * 0.6]);
    }
  }
  framework.add(repeatedBoxes('Tower_Top_Support_Corbels', corbelSpecs, m.concreteDark));

  // Central Vertical Service Shaft / Water Pipe Duct
  framework.add(box('Tower_Central_Pipe_Shaft', 2.8, frameHeight, 2.8, m.stuccoDark, 0, frameBottom + frameHeight / 2, 0));

  // PROMINENT CENTRAL BLUE WATER RISER PIPE (AR ETNO-STEM Concept)
  const riserPipe = cylinder('Tower_Main_Riser_Pipe', 0.55, 0.55, frameHeight, 20, m.pipeBlue, 0, frameBottom + frameHeight / 2, -1.15);
  framework.add(riserPipe);

  // Twin Water Supply & Discharge Manifold Pipes
  for (const px of [-1.2, 1.2]) {
    framework.add(cylinder(`Tower_Main_Riser_Pipe_${px}`, 0.32, 0.32, frameHeight, 12, m.pipeBlue, px, frameBottom + frameHeight / 2, -0.95));
  }

  // Riser Pipe Flanges & Intermediate Pressure Regulator Valve (Hotspot 2 Anchor)
  for (let f = 1; f <= 4; f++) {
    const fy = frameBottom + (f / 4) * frameHeight - 0.45;
    framework.add(cylinder(`Tower_Riser_Pipe_Flange_${f}`, 0.72, 0.72, 0.22, 16, m.metal, 0, fy, -1.15));
  }
  const midPipeY = frameBottom + frameHeight * 0.45; // ~28.0 m
  framework.add(box('Tower_Pressure_Regulator_Valve', 1.4, 0.6, 1.4, m.metal, 0, midPipeY, -1.15));
  framework.add(cylinder('Tower_Valve_Handwheel', 0.45, 0.45, 0.1, 16, m.pipeBlue, 0, midPipeY, -1.85));

  complex.add(framework);

  // 4. WATER RESERVOIR TANK (Bak Air Reservoir Utama - PURE RECTANGULAR CUBE, FLAT ROOF)
  const tankGroup = new THREE.Group();
  tankGroup.name = 'Tower_Water_Tank_Reservoir';

  // Support Slab below tank
  const slabW = 16.8, slabD = 14.4, slabH = 1.0;
  tankGroup.add(box('Tower_Tank_Support_Slab', slabW, slabH, slabD, m.concreteDark, 0, frameTop + slabH / 2, 0));

  // Water Distribution Manifold & Control Valves (Hotspot 3: TEKNOLOGI)
  tankGroup.add(box('Tower_Distribution_Manifold', 8.2, 0.8, 1.2, m.pipeBlue, 0, frameTop + slabH * 0.4, -1.8));
  for (const vx of [-2.6, 0, 2.6]) {
    tankGroup.add(cylinder(`Tower_Manifold_Valve_${vx}`, 0.36, 0.36, 0.48, 12, m.metal, vx, frameTop + slabH * 0.4, -2.45));
    tankGroup.add(cylinder(`Tower_Valve_Wheel_${vx}`, 0.28, 0.28, 0.08, 12, m.pipeBlue, vx, frameTop + slabH * 0.4, -2.72));
  }

  // Perimeter Catwalk Balcony (Cantilevered rectangular inspection deck)
  const catwalkW = 18.6, catwalkD = 16.2, catwalkH = 0.25;
  tankGroup.add(box('Tower_Catwalk_Deck', catwalkW, catwalkH, catwalkD, m.plazaPaving, 0, frameTop + slabH + catwalkH / 2, 0));

  // Steel Safety Handrail along Catwalk
  const railH = 1.1;
  const railY = frameTop + slabH + catwalkH + railH / 2;
  const railSpecs: BlockSpec[] = [
    [catwalkW, 0.08, 0.08, 0, railY + railH * 0.4, -catwalkD / 2 + 0.1],
    [catwalkW, 0.08, 0.08, 0, railY + railH * 0.4, catwalkD / 2 - 0.1],
    [0.08, 0.08, catwalkD, -catwalkW / 2 + 0.1, railY + railH * 0.4, 0],
    [0.08, 0.08, catwalkD, catwalkW / 2 - 0.1, railY + railH * 0.4, 0],
    [catwalkW, 0.06, 0.06, 0, railY - 0.1, -catwalkD / 2 + 0.1],
    [catwalkW, 0.06, 0.06, 0, railY - 0.1, catwalkD / 2 - 0.1],
    [0.06, 0.06, catwalkD, -catwalkW / 2 + 0.1, railY - 0.1, 0],
    [0.06, 0.06, catwalkD, catwalkW / 2 - 0.1, railY - 0.1, 0],
  ];
  for (let p = -5; p <= 5; p++) {
    const rx = p * (catwalkW / 10.5);
    railSpecs.push([0.08, railH, 0.08, rx, railY, -catwalkD / 2 + 0.1]);
    railSpecs.push([0.08, railH, 0.08, rx, railY, catwalkD / 2 - 0.1]);
  }
  for (let p = -4; p <= 4; p++) {
    const rz = p * (catwalkD / 8.5);
    railSpecs.push([0.08, railH, 0.08, -catwalkW / 2 + 0.1, railY, rz]);
    railSpecs.push([0.08, railH, 0.08, catwalkW / 2 - 0.1, railY, rz]);
  }
  tankGroup.add(repeatedBoxes('Tower_Balcony_Railings', railSpecs, m.metal));  // 4. MAIN WATER RESERVOIR TANK BODY (SOLID MASONRY - FULL TEMBOK, NO GLASS!)
  const tankBaseY = frameTop + slabH + catwalkH; // 42.70 m
  const tankW = 15.6, tankD = 13.2, tankH = 7.5;
  tankGroup.add(box('Tower_Water_Tank_Body', tankW, tankH, tankD, m.tankStucco, 0, tankBaseY + tankH / 2, 0));

  // Architectural Vertical Pilasters and Recessed Solid Wall Bays (Full Tembok)
  const tankPilasters: BlockSpec[] = [];
  const tankPanels: BlockSpec[] = [];

  for (const fz of [-tankD / 2, tankD / 2]) {
    for (const px of colXs) {
      tankPilasters.push([1.1, tankH, 0.45, px, tankBaseY + tankH / 2, fz + Math.sign(fz) * 0.18]);
    }
    for (let b = 0; b < 3; b++) {
      const bx = -cageW / 2 + (b + 0.5) * (cageW / 3);
      tankPanels.push([cageW / 3 - 1.3, tankH - 0.8, 0.15, bx, tankBaseY + tankH / 2, fz + Math.sign(fz) * 0.06]);
    }
  }

  for (const fx of [-tankW / 2, tankW / 2]) {
    for (const pz of colZs) {
      tankPilasters.push([0.45, tankH, 1.1, fx + Math.sign(fx) * 0.18, tankBaseY + tankH / 2, pz]);
    }
    for (let b = 0; b < 2; b++) {
      const bz = -cageD / 2 + (b + 0.5) * (cageD / 2);
      tankPanels.push([0.15, tankH - 0.8, cageD / 2 - 1.3, fx + Math.sign(fx) * 0.06, tankBaseY + tankH / 2, bz]);
    }
  }

  tankGroup.add(repeatedBoxes('Tower_Tank_Vertical_Pilasters', tankPilasters, m.concreteDark));
  tankGroup.add(repeatedBoxes('Tower_Tank_Recessed_Panels', tankPanels, m.stuccoDark));

  // Upper Cantilever Balcony / Cornice Ledge with Corbels (between tank and upper loggia)
  const upperLedgeY = tankBaseY + tankH; // 50.20 m
  const topCorbelSpecs: BlockSpec[] = [];
  for (const cz of [-tankD / 2 - 0.15, tankD / 2 + 0.15]) {
    for (const cx of colXs) {
      topCorbelSpecs.push([1.1, 0.85, 0.65, cx, upperLedgeY - 0.42, cz]);
    }
  }
  for (const cx of [-tankW / 2 - 0.15, tankW / 2 + 0.15]) {
    for (const cz of colZs) {
      topCorbelSpecs.push([0.65, 0.85, 1.1, cx, upperLedgeY - 0.42, cz]);
    }
  }
  tankGroup.add(repeatedBoxes('Tower_Tank_Top_Corbels', topCorbelSpecs, m.concreteDark));

  // Upper Cantilevered Balcony Deck
  const upperLedgeH = 0.35;
  tankGroup.add(box('Tower_Tank_Top_Cornice', tankW + 1.6, upperLedgeH, tankD + 1.6, m.trim, 0, upperLedgeY + upperLedgeH / 2, 0));

  // Upper Balcony Railings
  const upperRailH = 0.9;
  const upperRailY = upperLedgeY + upperLedgeH + upperRailH / 2;
  const upperRailW = tankW + 1.4, upperRailD = tankD + 1.4;
  const upperRailSpecs: BlockSpec[] = [
    [upperRailW, 0.06, 0.06, 0, upperRailY + upperRailH * 0.4, -upperRailD / 2 + 0.06],
    [upperRailW, 0.06, 0.06, 0, upperRailY + upperRailH * 0.4, upperRailD / 2 - 0.06],
    [0.06, 0.06, upperRailD, -upperRailW / 2 + 0.06, upperRailY + upperRailH * 0.4, 0],
    [0.06, 0.06, upperRailD, upperRailW / 2 - 0.06, upperRailY + upperRailH * 0.4, 0],
    [upperRailW, 0.05, 0.05, 0, upperRailY - 0.1, -upperRailD / 2 + 0.06],
    [upperRailW, 0.05, 0.05, 0, upperRailY - 0.1, upperRailD / 2 - 0.06],
    [0.05, 0.05, upperRailD, -upperRailW / 2 + 0.06, upperRailY - 0.1, 0],
    [0.05, 0.05, upperRailD, upperRailW / 2 - 0.06, upperRailY - 0.1, 0],
  ];
  for (let p = -5; p <= 5; p++) {
    const rx = p * (upperRailW / 10.5);
    upperRailSpecs.push([0.06, upperRailH, 0.06, rx, upperRailY, -upperRailD / 2 + 0.06]);
    upperRailSpecs.push([0.06, upperRailH, 0.06, rx, upperRailY, upperRailD / 2 - 0.06]);
  }
  for (let p = -4; p <= 4; p++) {
    const rz = p * (upperRailD / 8.5);
    upperRailSpecs.push([0.06, upperRailH, 0.06, -upperRailW / 2 + 0.06, upperRailY, rz]);
    upperRailSpecs.push([0.06, upperRailH, 0.06, upperRailW / 2 - 0.06, upperRailY, rz]);
  }
  tankGroup.add(repeatedBoxes('Tower_Upper_Balcony_Railings', upperRailSpecs, m.metalPainted));

  // 5. UPPER CROWN COLONNADED LOGGIA (Open Colonnaded Top Tier matching photo)
  const loggiaBaseY = upperLedgeY + upperLedgeH; // 50.55 m
  const loggiaH = 3.6;
  const loggiaColumns: BlockSpec[] = [];

  const loggiaXs = [-cageW / 2, -cageW / 4, 0, cageW / 4, cageW / 2];

  for (const cz of [-tankD / 2 + 0.35, tankD / 2 - 0.35]) {
    for (const cx of loggiaXs) {
      loggiaColumns.push([0.8, loggiaH, 0.8, cx, loggiaBaseY + loggiaH / 2, cz]);
    }
  }
  for (const cx of [-tankW / 2 + 0.35, tankW / 2 - 0.35]) {
    for (const cz of [-tankD / 6, tankD / 6]) {
      loggiaColumns.push([0.8, loggiaH, 0.8, cx, loggiaBaseY + loggiaH / 2, cz]);
    }
  }
  tankGroup.add(repeatedBoxes('Tower_Upper_Loggia_Columns', loggiaColumns, m.concreteTower));

  // Recessed Interior Room / Gallery Core (creating the deep open shadows of the loggia)
  const loggiaCoreW = 11.6, loggiaCoreD = 9.2;
  tankGroup.add(box('Tower_Loggia_Interior_Core', loggiaCoreW, loggiaH, loggiaCoreD, m.stuccoDark, 0, loggiaBaseY + loggiaH / 2, 0));

  // Loggia Horizontal Roof Beam & Flat Roof Slab
  const roofSlabH = 0.45;
  const roofSlabY = loggiaBaseY + loggiaH + roofSlabH / 2; // 54.375 m
  tankGroup.add(box('Tower_Loggia_Roof_Slab', tankW + 0.6, roofSlabH, tankD + 0.6, m.trim, 0, roofSlabY, 0));

  // Pillar Battlements / Pylon Posts extending vertically ABOVE the roof slab (matching photo!)
  const pylonH = 1.3;
  const pylonSpecs: BlockSpec[] = [];
  const pylonY = roofSlabY + roofSlabH / 2 + pylonH / 2;
  for (const cz of [-tankD / 2 + 0.35, tankD / 2 - 0.35]) {
    for (const cx of loggiaXs) {
      pylonSpecs.push([0.8, pylonH, 0.8, cx, pylonY, cz]);
      pylonSpecs.push([0.9, 0.15, 0.9, cx, pylonY + pylonH / 2 + 0.075, cz]);
    }
  }
  for (const cx of [-tankW / 2 + 0.35, tankW / 2 - 0.35]) {
    for (const cz of [-tankD / 6, tankD / 6]) {
      pylonSpecs.push([0.8, pylonH, 0.8, cx, pylonY, cz]);
      pylonSpecs.push([0.9, 0.15, 0.9, cx, pylonY + pylonH / 2 + 0.075, cz]);
    }
  }
  tankGroup.add(repeatedBoxes('Tower_Roof_Pillar_Pylons', pylonSpecs, m.concreteDark));

  // Central Stepped Art Deco Crest Pylons (Prominent stepped vertical fins at center of roof in photo!)
  const crestSpecs: BlockSpec[] = [];
  const crestHeights = [1.2, 1.7, 2.2, 1.7, 1.2];
  const crestXs = [-1.4, -0.7, 0, 0.7, 1.4];
  for (let i = 0; i < 5; i++) {
    const ch = crestHeights[i];
    const cy = roofSlabY + roofSlabH / 2 + ch / 2;
    crestSpecs.push([0.38, ch, 0.38, crestXs[i], cy, -tankD / 2 + 0.35]);
    crestSpecs.push([0.38, ch, 0.38, crestXs[i], cy, tankD / 2 - 0.35]);
  }
  tankGroup.add(repeatedBoxes('Tower_Crown_Stepped_Pylons', crestSpecs, m.concreteTower));

  // External Service Ladder Cage on West Flank (visible in reference photo)
  const ladderGroup = new THREE.Group();
  ladderGroup.name = 'Tower_Access_Ladder_Cage';
  const ladderH = (loggiaBaseY + loggiaH) - frameBottom;
  const ladderY = frameBottom + ladderH / 2;
  const ladderX = -tankW / 2 - 0.45;
  ladderGroup.add(cylinder('Ladder_Rail_L', 0.03, 0.03, ladderH, 8, m.metal, ladderX, ladderY, -1.0));
  ladderGroup.add(cylinder('Ladder_Rail_R', 0.03, 0.03, ladderH, 8, m.metal, ladderX, ladderY, -0.4));
  for (let ly = frameBottom; ly <= loggiaBaseY + loggiaH; ly += 1.0) {
    ladderGroup.add(box(`Ladder_Rung_${ly.toFixed(1)}`, 0.04, 0.04, 0.6, m.metal, ladderX, ly, -0.7));
    ladderGroup.add(cylinder(`Ladder_Cage_Hoop_${ly.toFixed(1)}`, 0.45, 0.45, 0.05, 10, m.metal, ladderX - 0.35, ly, -0.7));
  }
  tankGroup.add(ladderGroup);

  // Facade Vertical Drainage Downspout Pipe on Front-Right (matching photo)
  tankGroup.add(cylinder('Tower_Facade_Drainage_Pipe', 0.07, 0.07, tankH + loggiaH, 8, m.metal, 4.2, tankBaseY + (tankH + loggiaH) / 2, -tankD / 2 - 0.15));

  // Corner Antennas on Top Outer Pylons
  for (const cx of [-cageW / 2, cageW / 2]) {
    for (const cz of [-tankD / 2 + 0.35, tankD / 2 - 0.35]) {
      tankGroup.add(cylinder(`Tower_Roof_Antenna_${cx}_${cz}`, 0.04, 0.06, 2.5, 6, m.metal, cx, pylonY + pylonH / 2 + 1.25, cz));
    }
  }

  // Central Slender Lightning Spire extending to exactly 60.0 m height
  const crestApexY = roofSlabY + roofSlabH / 2 + 2.2; // ~56.8 m
  const spireH = 60.0 - crestApexY; // ~3.2 m
  const spireMesh = cylinder('Tower_Apex_Lightning_Spire', 0.06, 0.14, spireH, 12, m.metal, 0, crestApexY + spireH / 2, -tankD / 2 + 0.35);
  tankGroup.add(spireMesh);

  complex.add(tankGroup);

  return complex;
}

/**
 * Creates the historical Palembang waterways, riverbanks, embankments, and bridges:
 * - Sungai Musi (South / Belakang, Z: 45 to 75 m): expansive river water surface, stone revetment embankment,
 *   promenade balustrades, docking stairs, wooden jetty, and traditional Palembang perahu tambang.
 * - Sungai Sekanak (West / Barat, X: -96 to -82 m): historical urban canal running from north to south,
 *   emptying into Sungai Musi at the southwest confluence, flanked by stone canal retaining walls.
 * - Jembatan Sekanak: colonial Dutch stone/concrete arched road bridge crossing the canal at Jalan Merdeka.
 */
function createWaterwaysAndBridges(m: ReturnType<typeof makeMaterials>): THREE.Group {
  const waterways = new THREE.Group();
  waterways.name = 'Waterways_And_River_Network';

  // -------------------------------------------------------------
  // 1. SUNGAI MUSI (Belakang / Selatan, Z: 45 to 75, Width: 200m)
  // -------------------------------------------------------------
  const musiW = 200, musiD = 30, musiZ = 60.0;
  const musiWater = box('Sungai_Musi_Water', musiW, 0.5, musiD, m.riverWater, 0, -0.05, musiZ);
  waterways.add(musiWater);

  // Riverbed Earth Basin underneath
  waterways.add(box('Sungai_Musi_Bed', musiW, 0.8, musiD, m.earth, 0, -0.65, musiZ));

  // Stone Revetment Embankment Wall along Z = 45.0
  const revetmentW = musiW, revetmentH = 0.95;
  waterways.add(box('Sungai_Musi_Embankment_Wall', revetmentW, revetmentH, 0.9, m.riverEmbankment, 0, 0.25, 45.0));
  waterways.add(box('Sungai_Musi_Embankment_Coping', revetmentW, 0.2, 1.2, m.curb, 0, 0.75, 45.0));

  // Riverside Pedestrian Promenade (Walkway overlooking Sungai Musi, Z: 39 to 44.5)
  waterways.add(box('Sungai_Musi_Riverside_Promenade', revetmentW, 0.2, 5.5, m.riverPromenade, 0, 0.16, 41.8));

  // Stone Balustrade & Guardrail along the riverside promenade edge (Z = 44.4)
  const balustradeSpecs: BlockSpec[] = [];
  balustradeSpecs.push([musiW, 0.14, 0.18, 0, 1.05, 44.4]);
  balustradeSpecs.push([musiW, 0.12, 0.14, 0, 0.55, 44.4]);
  for (let bx = -98; bx <= 98; bx += 4) {
    if (Math.abs(bx) < 6) continue; // Opening for grand river docking stairs
    balustradeSpecs.push([0.3, 0.85, 0.3, bx, 0.75, 44.4]);
  }
  waterways.add(repeatedBoxes('Sungai_Musi_Promenade_Balustrade', balustradeSpecs, m.curb));

  // Grand Stone Docking Stairs descending to the Musi water (X: -5 to +5)
  for (let s = 0; s < 5; s++) {
    waterways.add(box(`Sungai_Musi_Dermaga_Step_${s}`, 11 - s * 0.6, 0.18, 0.85, m.riverEmbankment, 0, 0.55 - s * 0.15, 45.4 + s * 0.7));
  }

  // Wooden Floating Jetty / Pier
  const jetty = new THREE.Group();
  jetty.name = 'Sungai_Musi_Wooden_Jetty';
  jetty.position.set(18, 0.0, 52);
  jetty.add(box('Jetty_Deck', 3.8, 0.2, 12, m.timber, 0, 0.1, 0));
  for (let pz = -5; pz <= 5; pz += 2.5) {
    jetty.add(cylinder(`Jetty_Piling_L_${pz}`, 0.12, 0.12, 1.8, 8, m.timber, -1.7, -0.5, pz));
    jetty.add(cylinder(`Jetty_Piling_R_${pz}`, 0.12, 0.12, 1.8, 8, m.timber, 1.7, -0.5, pz));
  }
  waterways.add(jetty);

  // Traditional Palembang Perahu Tambang & Ketek Boats
  const boatConfigs = [
    { name: 'Sungai_Musi_Perahu_Tambang_1', x: -25, z: 56, rot: 0.18, scale: 1.0, canopy: true },
    { name: 'Sungai_Musi_Perahu_Tambang_2', x: 30, z: 60, rot: -0.25, scale: 1.15, canopy: true },
    { name: 'Sungai_Musi_Perahu_Ketek_3', x: -58, z: 59, rot: 0.08, scale: 0.85, canopy: false },
    { name: 'Sungai_Musi_Cargo_Barge', x: 65, z: 62, rot: -0.05, scale: 1.5, canopy: false },
  ];

  boatConfigs.forEach(b => {
    const boat = new THREE.Group();
    boat.name = b.name;
    boat.position.set(b.x, -0.02, b.z);
    boat.rotation.y = b.rot;
    boat.scale.setScalar(b.scale);

    boat.add(box('Hull_Keel', 2.2, 0.8, 7.5, m.boatWood, 0, 0.2, 0));
    boat.add(box('Hull_Bow_Taper', 1.8, 0.7, 2.2, m.boatWood, 0, 0.28, 4.2));
    boat.add(box('Hull_Stern_Taper', 1.8, 0.7, 1.8, m.boatWood, 0, 0.28, -4.0));
    boat.add(box('Boat_Seat_1', 1.9, 0.15, 0.6, m.timber, 0, 0.35, -1.5));
    boat.add(box('Boat_Seat_2', 1.9, 0.15, 0.6, m.timber, 0, 0.35, 1.0));

    if (b.canopy) {
      const canopy = hippedRoof('Boat_Canopy', 2.1, 4.2, 0.6, m.boatCanopy);
      canopy.position.set(0, 1.45, -0.2);
      boat.add(canopy);
      for (const cx of [-0.95, 0.95]) {
        for (const cz of [-2.0, 0, 1.8]) {
          boat.add(cylinder(`Canopy_Pole_${cx}_${cz}`, 0.03, 0.03, 1.0, 6, m.metal, cx, 0.95, cz));
        }
      }
    }

    waterways.add(boat);
  });

  // -------------------------------------------------------------
  // 2. SUNGAI SEKANAK (Barat, X: -96 to -82, Length: Z from -75 to 45)
  // -------------------------------------------------------------
  const sekanakW = 14, sekanakX = -89;
  const sekanakLength = 120; // from Z = -75 to Z = 45
  const sekanakZ = -15.0;

  const sekanakWater = box('Sungai_Sekanak_Canal_Water', sekanakW, 0.45, sekanakLength, m.canalWater, sekanakX, -0.05, sekanakZ);
  waterways.add(sekanakWater);

  // Stone Canal Retaining Walls
  const eastWallX = sekanakX + sekanakW / 2 + 0.4; // -81.6
  const westWallX = sekanakX - sekanakW / 2 - 0.4; // -96.4
  waterways.add(box('Sungai_Sekanak_East_Wall', 0.8, 1.0, sekanakLength, m.riverEmbankment, eastWallX, 0.3, sekanakZ));
  waterways.add(box('Sungai_Sekanak_East_Coping', 1.1, 0.2, sekanakLength, m.curb, eastWallX, 0.85, sekanakZ));

  waterways.add(box('Sungai_Sekanak_West_Wall', 0.8, 1.0, sekanakLength, m.riverEmbankment, westWallX, 0.3, sekanakZ));
  waterways.add(box('Sungai_Sekanak_West_Coping', 1.1, 0.2, sekanakLength, m.curb, westWallX, 0.85, sekanakZ));

  // Canal Safety Railings along East Bank
  const canalRailSpecs: BlockSpec[] = [];
  canalRailSpecs.push([0.1, 0.1, sekanakLength, eastWallX, 1.1, sekanakZ]);
  for (let rz = -72; rz <= 42; rz += 5) {
    if (rz >= -44 && rz <= -32) continue; // Leave opening for Jembatan Sekanak at Z = -38
    canalRailSpecs.push([0.2, 0.8, 0.2, eastWallX, 0.8, rz]);
  }
  waterways.add(repeatedBoxes('Sungai_Sekanak_Canal_Railings', canalRailSpecs, m.curb));

  // Small Sampan Boats in Sekanak Canal
  const sampan1 = new THREE.Group();
  sampan1.name = 'Sekanak_Sampan_1';
  sampan1.position.set(sekanakX, -0.05, 10);
  sampan1.rotation.y = 0.15;
  sampan1.add(box('Sampan_Hull_1', 1.5, 0.45, 5.0, m.boatWood, 0, 0.15, 0));
  sampan1.add(cylinder('Sampan_Oar_1', 0.03, 0.03, 2.8, 6, m.timber, 0.8, 0.35, 0.5));
  waterways.add(sampan1);

  const sampan2 = new THREE.Group();
  sampan2.name = 'Sekanak_Sampan_2';
  sampan2.position.set(sekanakX + 1.5, -0.05, -15);
  sampan2.rotation.y = -0.1;
  sampan2.add(box('Sampan_Hull_2', 1.4, 0.45, 4.6, m.boatWood, 0, 0.15, 0));
  waterways.add(sampan2);

  // Confluence of Sungai Sekanak and Sungai Musi (Southwest corner at Z = 45)
  const confluence = new THREE.Group();
  confluence.name = 'Sungai_Sekanak_Musi_Confluence';
  confluence.position.set(sekanakX, 0, 45);
  confluence.add(cylinder('Confluence_Corner_Bastion_E', 1.2, 1.4, 1.2, 12, m.riverEmbankment, sekanakW / 2 + 0.4, 0.2, 0));
  confluence.add(cylinder('Confluence_Corner_Bastion_W', 1.2, 1.4, 1.2, 12, m.riverEmbankment, -sekanakW / 2 - 0.4, 0.2, 0));
  waterways.add(confluence);

  // -------------------------------------------------------------
  // 3. JEMBATAN SEKANAK (Colonial Dutch Arched Road Bridge across Jalan Merdeka at Z = -38)
  // -------------------------------------------------------------
  const bridge = new THREE.Group();
  bridge.name = 'Jembatan_Sekanak';
  const bridgeZ = -38, bridgeSpan = 18, bridgeRoadW = 10;
  bridge.position.set(sekanakX, 0.1, bridgeZ);

  bridge.add(box('Bridge_Abutment_East', 2.0, 1.6, bridgeRoadW + 1.2, m.riverEmbankment, bridgeSpan / 2 - 1.0, 0.6, 0));
  bridge.add(box('Bridge_Abutment_West', 2.0, 1.6, bridgeRoadW + 1.2, m.riverEmbankment, -bridgeSpan / 2 + 1.0, 0.6, 0));
  bridge.add(box('Bridge_Arch_Span_Deck', bridgeSpan - 2.0, 0.65, bridgeRoadW, m.concreteDark, 0, 0.9, 0));
  bridge.add(cylinder('Bridge_Under_Arch_Barrel', 3.2, 3.2, bridgeRoadW - 0.4, 16, m.riverEmbankment, 0, 0.1, 0));

  bridge.add(box('Jembatan_Sekanak_Roadway', bridgeSpan + 0.8, 0.1, bridgeRoadW, m.asphalt, 0, 1.25, 0));

  for (const side of [-1, 1]) {
    const bz = side * (bridgeRoadW / 2 + 0.35);
    const railName = side > 0 ? 'Jembatan_Sekanak_Balustrade_South' : 'Jembatan_Sekanak_Balustrade_North';
    const bGroup = new THREE.Group();
    bGroup.name = railName;
    bGroup.add(box('Bridge_Rail_Plinth', bridgeSpan + 0.4, 0.25, 0.5, m.curb, 0, 1.35, bz));
    bGroup.add(box('Bridge_Rail_Coping', bridgeSpan + 0.4, 0.18, 0.55, m.curb, 0, 2.05, bz));
    const postSpecs: BlockSpec[] = [];
    for (let px = -bridgeSpan / 2; px <= bridgeSpan / 2; px += 1.8) {
      postSpecs.push([0.3, 0.55, 0.35, px, 1.72, bz]);
    }
    bGroup.add(repeatedBoxes('Bridge_Rail_Posts', postSpecs, m.curb));

    for (const cx of [-bridgeSpan / 2, bridgeSpan / 2]) {
      const lamp = new THREE.Group();
      lamp.name = `Bridge_Lamp_${side}_${cx}`;
      lamp.position.set(cx, 2.1, bz);
      lamp.add(cylinder('Lamp_Post', 0.08, 0.12, 2.2, 8, m.metal, 0, 1.1, 0));
      lamp.add(box('Lamp_Lantern', 0.45, 0.55, 0.45, m.roadMarking, 0, 2.3, 0));
      bGroup.add(lamp);
    }

    bridge.add(bGroup);
  }

  waterways.add(bridge);

  return waterways;
}

/**
 * Creates surrounding urban administrative and commercial city blocks
 * (North blocks facing Jalan Merdeka, East Annex building, and Canal-side structures)
 */
function createCityContextBuildings(m: ReturnType<typeof makeMaterials>): THREE.Group {
  const city = new THREE.Group();
  city.name = 'City_Context_Buildings';

  // 1. Municipal Governmental Annex Building (East Block across the avenue, X: 54 to 84, Z: -26 to 12)
  const annex = new THREE.Group();
  annex.name = 'City_Hall_Government_Annex';
  const ax = 68, az = -8, aw = 28, ad = 32, ah = 16.5;
  annex.add(box('Annex_Main_Body', aw, ah, ad, m.stuccoCream, ax, ah / 2, az));
  annex.add(box('Annex_Roof_Cornice', aw + 1.2, 0.8, ad + 1.2, m.trim, ax, ah + 0.4, az));
  annex.add(box('Annex_Roof_Parapet', aw - 0.4, 1.2, ad - 0.4, m.stuccoDark, ax, ah + 1.4, az));

  annex.add(box('Annex_Front_Portico', 12, ah * 0.9, 4.0, m.stucco, ax - aw / 2 - 2.0, ah * 0.45, az));
  annex.add(box('Annex_Portico_Pediment', 4.2, 2.5, 13, m.trim, ax - aw / 2 - 2.0, ah * 0.9 + 1.25, az));

  const annexWinSpecs: BlockSpec[] = [];
  const annexFrameSpecs: BlockSpec[] = [];
  for (let f = 1; f <= 3; f++) {
    const wy = f * 4.0;
    for (let c = -3; c <= 3; c++) {
      const wz = az + c * 4.2;
      annexWinSpecs.push([0.3, 2.2, 2.2, ax - aw / 2 - 0.1, wy, wz]);
      annexFrameSpecs.push([0.15, 2.4, 2.4, ax - aw / 2 - 0.05, wy, wz]);
    }
  }
  annex.add(repeatedBoxes('Annex_Facade_Frames', annexFrameSpecs, m.trim));
  annex.add(repeatedBoxes('Annex_Facade_Windows', annexWinSpecs, m.glass));
  city.add(annex);

  // 2. North Shophouse & Office Blocks (Z <= -54 across wide Jalan Merdeka boulevard)
  for (let i = 0; i < 4; i++) {
    const nx = -60 + i * 26;
    const nz = -62;
    const nw = 22, nd = 16, nh = 13 + (i % 3) * 2.2;
    const mat = i % 2 === 0 ? m.buildingCommercial1 : m.buildingCommercial2;
    city.add(box(`North_Block_Building_${i}`, nw, nh, nd, mat, nx, nh / 2, nz));
    city.add(box(`North_Block_Cornice_${i}`, nw + 0.8, 0.5, nd + 0.8, m.trim, nx, nh + 0.25, nz));
    city.add(box(`North_Block_Parapet_${i}`, nw - 0.4, 0.8, nd - 0.4, m.roofCommercialFlat, nx, nh + 0.9, nz));
    if (i % 2 === 1) {
      city.add(box(`North_Block_HVAC_Enclosure_${i}`, 5, 2.0, 4.5, m.metal, nx - 3, nh + 1.8, nz - 2));
    }
    const shopWinSpecs: BlockSpec[] = [];
    for (let f = 1; f <= 2; f++) {
      const wy = f * 3.8;
      for (const wx of [nx - 5.5, nx, nx + 5.5]) {
        shopWinSpecs.push([2.0, 2.0, 0.2, wx, wy, nz + nd / 2 + 0.05]);
      }
    }
    city.add(repeatedBoxes(`North_Block_Windows_${i}`, shopWinSpecs, m.glass));
  }

  // 3. West Commercial Blocks (Framing the East Bank of Sungai Sekanak Canal, X: -72)
  for (let i = 0; i < 3; i++) {
    const wx = -72;
    const wz = -16 + i * 18;
    const ww = 14, wd = 14, wh = 11.5 + (i % 2) * 3.5;
    city.add(box(`West_Block_Building_${i}`, ww, wh, wd, i === 1 ? m.buildingBrick : m.buildingCommercial1, wx, wh / 2, wz));
    city.add(box(`West_Block_Cornice_${i}`, ww + 0.6, 0.4, wd + 0.6, m.trim, wx, wh + 0.2, wz));
    city.add(box(`West_Block_Canopy_${i}`, 2.5, 0.2, wd - 2, m.stuccoDark, wx + ww / 2 + 1.25, 3.8, wz));
  }

  // 4. Riverside Heritage Warehouses (Positioned at corners along boulevard, leaving central river view completely open)
  const riverfrontBuildings = [
    { name: 'Riverside_Customs_House', x: -66, z: 34, w: 18, d: 10, h: 10.5, mat: m.stuccoCream, roof: true },
    { name: 'Riverside_Harbour_Office', x: 62, z: 34, w: 18, d: 10, h: 11.2, mat: m.buildingCommercial2, roof: true },
  ];
  riverfrontBuildings.forEach(b => {
    city.add(box(`${b.name}_Body`, b.w, b.h, b.d, b.mat, b.x, b.h / 2, b.z));
    city.add(box(`${b.name}_Cornice`, b.w + 0.6, 0.4, b.d + 0.6, m.trim, b.x, b.h + 0.2, b.z));
    if (b.roof) {
      const roof = hippedRoof(`${b.name}_Roof`, b.w + 1.0, b.d + 1.0, 2.4, m.roofTerracotta);
      roof.position.set(b.x, b.h + 0.4, b.z);
      city.add(roof);
    }
  });

  return city;
}

/**
 * Creates the base terrain plinth, street grid, lane markings and sidewalks
 * (Clean, non-overlapping street layout strictly avoiding Z-fighting)
 */
function createPlinthAndStreetGrid(m: ReturnType<typeof makeMaterials>): THREE.Group {
  const terrain = new THREE.Group();
  terrain.name = 'Plinth_And_Street_Grid';

  const w = 200, d = 150;

  // Underside Earth Base (-1.2 m to 0 m)
  terrain.add(box('Terrain_Underside_Base', w, 1.2, d, m.earth, 0, -0.6, 0));

  // Ground Asphalt Layer
  terrain.add(box('Ground_Asphalt_Surface', w, 0.08, d, m.asphalt, 0, 0.04, 0));

  // Street Markings
  const roadMarkings: BlockSpec[] = [];

  // North Boulevard / Jalan Merdeka Dash Lines (Z = -38)
  for (let x = -78; x <= 82; x += 6) {
    roadMarkings.push([3.5, 0.02, 0.35, x, 0.09, -38]);
  }
  // South Promenade Avenue Dash Lines (Z = 32)
  for (let x = -55; x <= 55; x += 6) {
    roadMarkings.push([3.5, 0.02, 0.35, x, 0.09, 32]);
  }
  // West Avenue Dash Lines (X = -35)
  for (let z = -32; z <= 30; z += 6) {
    roadMarkings.push([0.35, 0.02, 3.5, -35, 0.09, z]);
  }
  // East Avenue Dash Lines (X = 42)
  for (let z = -32; z <= 30; z += 6) {
    roadMarkings.push([0.35, 0.02, 3.5, 42, 0.09, z]);
  }

  // Crosswalks / Zebra Crossings at North Intersections
  for (let z = -42; z <= -34; z += 1.2) {
    roadMarkings.push([6.5, 0.02, 0.65, -30.5, 0.09, z]);
    roadMarkings.push([6.5, 0.02, 0.65, 36.5, 0.09, z]);
  }
  for (let x = -38; x <= -32; x += 1.2) {
    roadMarkings.push([0.65, 0.02, 6.5, x, 0.09, -30.0]);
  }

  terrain.add(repeatedBoxes('Street_Lane_Markings_And_Crosswalks', roadMarkings, m.roadMarking));

  // Non-overlapping Sidewalk Network
  terrain.add(box('Sidewalk_North_Block', 150, 0.16, 12, m.sidewalk, -5, 0.16, -49));
  terrain.add(box('Sidewalk_East_Block', 30, 0.16, 50, m.sidewalk, 68, 0.16, -8));
  terrain.add(box('Sidewalk_West_Canal_Bank', 14, 0.16, 50, m.sidewalk, -72, 0.16, -8));
  terrain.add(box('Sidewalk_South_River_Boulevard', 110, 0.16, 4.0, m.sidewalk, 0, 0.16, 36.5));

  return terrain;
}

/**
 * Creates Streetlight Posts and Street Props
 */
function createStreetProps(m: ReturnType<typeof makeMaterials>): THREE.Group {
  const props = new THREE.Group();
  props.name = 'Street_Props_And_Lighting';

  const lampPositions: [number, number, number][] = [
    // Menara Ledeng perimeter lights
    [-28, -26, 0], [28, -26, 0], [-28, 26, Math.PI], [28, 26, Math.PI],
    [-28, 0, -Math.PI / 2], [28, 0, Math.PI / 2],
    // Jalan Merdeka (North) lights
    [-55, -44, 0], [-10, -44, 0], [35, -44, 0], [70, -44, 0],
    // South Riverside promenade lights
    [-55, 39, Math.PI], [-10, 39, Math.PI], [35, 39, Math.PI], [70, 39, Math.PI],
  ];

  lampPositions.forEach(([lx, lz, rot], i) => {
    const post = new THREE.Group();
    post.name = `Streetlight_Post_${i + 1}`;
    post.position.set(lx, 0.18, lz);
    post.rotation.y = rot;

    post.add(cylinder('Pole', 0.1, 0.16, 6.5, 12, m.metal, 0, 3.25, 0));
    post.add(box('Arm', 1.6, 0.12, 0.12, m.metal, 0.8, 6.4, 0));
    post.add(box('Luminaire', 0.9, 0.2, 0.45, m.metal, 1.4, 6.3, 0));
    post.add(box('Lamp_Lens', 0.75, 0.08, 0.35, m.roadMarking, 1.4, 6.18, 0));
    props.add(post);
  });

  return props;
}

/**
 * Creates parked and passing urban vehicles along the avenues
 */
function createUrbanVehicles(m: ReturnType<typeof makeMaterials>): THREE.Group {
  const vehicles = new THREE.Group();
  vehicles.name = 'Urban_Vehicles';

  const carSpecs: [number, number, number, THREE.Material][] = [
    [-18, -38, 0, m.carBodyRed],
    [12, -38, 0, m.carBodyBlue],
    [48, -38, 0, m.carBodySilver],
    [-89, -38, 0, m.carBodyRed], // Car crossing Jembatan Sekanak
    [-38, 0, Math.PI / 2, m.carBodyRed],
    [38, 0, -Math.PI / 2, m.carBodyBlue],
    [0, 32, 0, m.carBodySilver],
  ];

  carSpecs.forEach(([cx, cz, rot, bodyMat], i) => {
    const car = new THREE.Group();
    car.name = `City_Vehicle_${i + 1}`;
    car.position.set(cx, 0.08, cz);
    car.rotation.y = rot;

    car.add(box('Car_Body_Lower', 4.4, 0.8, 1.9, bodyMat, 0, 0.55, 0));
    car.add(box('Car_Cabin', 2.4, 0.7, 1.6, m.glass, -0.2, 1.3, 0));
    for (const wx of [-1.3, 1.3]) {
      for (const wz of [-0.95, 0.95]) {
        car.add(cylinder(`Wheel_${wx}_${wz}`, 0.35, 0.35, 0.25, 16, m.metal, wx, 0.35, wz));
      }
    }
    vehicles.add(car);
  });

  return vehicles;
}

export function createModel(spec?: MenaraLedengSpec): THREE.Group {
  const root = new THREE.Group();
  root.name = 'Menara_Ledeng_Root';
  root.userData.preferredViewDirection = [1.2, 0.9, -1.4];

  const m = makeMaterials();

  // 1. Plinth and Street Grid
  root.add(createPlinthAndStreetGrid(m));

  // 2. Central Menara Ledeng & Kantor Walikota Complex (Entrance facing North!)
  root.add(createMenaraLedengComplex(m));

  // 3. Historical Waterways, Embankments & Bridges (Sungai Musi at South, Sungai Sekanak at West, Jembatan Sekanak)
  if (spec?.showWaterways !== false) {
    root.add(createWaterwaysAndBridges(m));
  }

  // 4. Surrounding City Context Buildings
  if (spec?.showSurroundingCity !== false) {
    root.add(createCityContextBuildings(m));
  }

  // 5. Street Props & Lighting
  if (spec?.showStreetProps !== false) {
    root.add(createStreetProps(m));
  }

  // 6. Avenue & Promenade Trees
  const vegetation = new THREE.Group();
  vegetation.name = 'Park_And_Street_Vegetation';
  if (spec?.showParkVegetation !== false) {
    const treeLocs: [number, number, number, number][] = [
      // Menara Ledeng Lot Perimeter Trees
      [26, 18, 3.5, 7.2], [26, 0, 3.6, 7.4], [26, -18, 3.4, 7.0],
      [-26, 18, 3.5, 7.2], [-26, 0, 3.6, 7.4], [-26, -18, 3.4, 7.0],
      // Jalan Merdeka North Sidewalk Trees
      [-50, -49, 3.6, 7.2], [-20, -49, 3.5, 7.0], [20, -49, 3.7, 7.4], [50, -49, 3.6, 7.2],
      // South Riverside Promenade Trees
      [-40, 38, 3.5, 7.0], [-10, 38, 3.6, 7.2], [20, 38, 3.4, 6.8], [45, 38, 3.6, 7.2],
      // Canal Promenade Trees
      [-76, 8, 3.6, 7.2], [-76, -8, 3.5, 7.0],
    ];
    treeLocs.forEach(([tx, tz, tr, th], i) => {
      const t = tree(`City_Heritage_Tree_${i + 1}`, tr, th, m);
      t.position.set(tx, 0.18, tz);
      vegetation.add(t);
    });
  }
  root.add(vegetation);

  // 7. Urban Vehicles
  if (spec?.showVehicles !== false) {
    root.add(createUrbanVehicles(m));
  }

  // 8. Interactive & AR ETNO-STEM Educational Anchors (Helpers_And_Anchors)
  const helpers = new THREE.Group();
  helpers.name = 'Helpers_And_Anchors';
  const addAnchor = (name: string, x: number, y: number, z: number) => {
    const a = new THREE.Group();
    a.name = name;
    a.position.set(x, y, z);
    helpers.add(a);
  };

  // AR ETNO-STEM Anchors (Diagram matching)
  // 1. ETNO: Sungai Musi, akses air & perubahan sosial (South at Sungai Musi)
  addAnchor('Anchor_ML_01_Etno_Sungai_Musi', 0, 1.0, 52.0);
  addAnchor('Anchor_ETNO_Sungai_Musi', 0, 1.0, 52.0);

  // 2. SAINS: Gravitasi, tekanan hidrostatis & kesehatan air (Central blue riser pipe)
  addAnchor('Anchor_ML_02_Sains_Tekanan_Hidrostatis', 0, 28.0, -1.2);
  addAnchor('Anchor_SAINS_Tekanan_Hidrostatis', 0, 28.0, -1.2);

  // 3. TEKNOLOGI: Tangki, pipa, katup & distribusi (Water tank distribution manifold)
  addAnchor('Anchor_ML_03_Teknologi_Distribusi_Air', 2.5, 46.5, -5.0);
  addAnchor('Anchor_TEKNOLOGI_Distribusi_Air', 2.5, 46.5, -5.0);

  // 4. REKAYASA: Struktur tangki 1.200 m³ & fondasi (Reinforced concrete columns & corbels)
  addAnchor('Anchor_ML_04_Rekayasa_Struktur_Fondasi', -6.5, 41.5, 5.0);
  addAnchor('Anchor_REKAYASA_Struktur_Fondasi', -6.5, 41.5, 5.0);

  // 5. MATEMATIKA: Tinggi 35 m, volume & geometri (Tower height & volume geometry)
  addAnchor('Anchor_ML_05_Matematika_Geometri_Volume', -7.2, 24.0, -6.0);
  addAnchor('Anchor_MATEMATIKA_Geometri_Volume', -7.2, 24.0, -6.0);

  // Backward-compatible architectural anchors
  addAnchor('Anchor_Menara_Ledeng_Apex_Spire', 0, 60.0, 0);
  addAnchor('Anchor_Menara_Ledeng_Water_Tank_Catwalk', 0, 42.5, -9.0);
  addAnchor('Anchor_Menara_Ledeng_Structural_Framework', 0, 29.0, -7.0);
  addAnchor('Anchor_Kantor_Walikota_Entrance_Portico', 0, 6.0, -15.5);
  addAnchor('Anchor_City_Avenue_Intersection', -35, 0.5, -38);

  root.add(helpers);

  root.scale.setScalar(spec?.scale ?? 1);
  return root;
}

export function createMenaraLedengModel(spec?: MenaraLedengSpec): THREE.Group {
  return createModel(spec);
}

export default createModel;
