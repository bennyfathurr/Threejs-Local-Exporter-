# Three.js Procedural Model Exporter — Antigravity Brief

## Goal

Build a local web editor/exporter that accepts an `img2threejs`-style procedural Three.js model factory and exports a **real scene with separated mesh parts**, not a single flattened image or billboard.

The result should feel similar to `img2threejs.io/#/demo`: interactive 3D preview, selectable parts, visibility controls, transform inspection, and export to common 3D formats.

## Important constraint

The input is a TypeScript/JavaScript factory that returns a `THREE.Group`, for example:

```ts
export function createModel(spec?: unknown, options?: unknown): THREE.Group
```

Do not render the reference image onto a plane as the model. Preserve the generated geometry, hierarchy, materials, transforms, pivots, and named components.

A reference image may be shown only as a separate comparison overlay or background.

## Recommended stack

- Vite
- TypeScript
- Three.js
- `@types/three`
- `three/addons/controls/OrbitControls.js`
- `three/addons/exporters/GLTFExporter.js`
- `three/addons/exporters/OBJExporter.js`
- `three/addons/exporters/USDZExporter.js`
- Optional: `three/addons/exporters/PLYExporter.js`, `STLExporter.js`
- Optional UI: lil-gui, Leva, or a small custom React panel

## Core features

### 1. Model loading

Support these inputs:

- Local `.ts` or `.js` factory returning `THREE.Object3D`.
- A project entry file that exposes a known factory function.
- Optional JSON spec/config passed to the factory.
- Optional GLB/glTF import for inspection and re-export.

For TypeScript, use a Vite development environment or compile/bundle the factory before loading. Do not rely on browser execution of arbitrary TypeScript without a build step.

Example adapter:

```ts
import { createModel } from './generated/createModel';

const root = createModel(spec, {
  editable: true,
  includeColliders: false,
});
scene.add(root);
```

### 2. Scene preview

Create a professional Three.js viewer with:

- OrbitControls.
- Perspective and orthographic cameras.
- Grid and world axes toggles.
- Hemisphere/ambient light, directional key light, and optional environment lighting.
- Solid, wireframe, and material preview modes.
- Shadows where supported.
- Reset camera and frame-selected-object buttons.
- Background color and transparent-background options.
- Reference-image comparison mode with opacity slider.
- Correct color management: `SRGBColorSpace`, tone mapping, and normal material handling.

### 3. Separated mesh hierarchy

The exporter must preserve separate parts. Never merge all meshes by default.

Traverse the loaded root and build an inventory containing:

```ts
{
  uuid: string;
  name: string;
  type: string;
  parentUuid?: string;
  visible: boolean;
  isMesh: boolean;
  isSkinnedMesh: boolean;
  geometryUuid?: string;
  materialUuids: string[];
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  vertexCount?: number;
  triangleCount?: number;
}
```

Preserve:

- `Object3D.name`.
- Parent-child hierarchy.
- Individual `Mesh` objects.
- `SkinnedMesh`, bones, and skeletons.
- Groups used as pivots.
- Socket/attachment groups.
- Local transforms.
- Material assignments.
- Morph targets where the selected exporter supports them.

Provide a scene tree panel with:

- Expand/collapse hierarchy.
- Select part.
- Rename part without changing its geometry.
- Hide/show part.
- Lock/unlock part.
- Solo selected part.
- Highlight selected part.
- Optional transform controls for position, rotation, and scale.
- Search/filter by name and object type.

### 4. Part selection

Clicking a visible mesh selects only that mesh or its named logical group.

Selection should use raycasting. Highlight without permanently modifying exported materials; use an outline, bounding box, or temporary overlay.

Add actions:

- Select parent group.
- Select all descendants.
- Hide selected.
- Focus camera on selected.
- Export selected only.
- Export complete hierarchy.

## Export formats

### GLB / glTF — primary export

Use `GLTFExporter`.

Support:

- `.glb` binary export.
- `.gltf` JSON export with external or embedded resources.
- Separate mesh nodes and names.
- Materials and textures.
- Animations when present.
- Skinning and skeletons when present.
- Optional Draco or Meshopt compression, clearly marked as optional.
- Export complete scene or selected subtree.

Example:

```ts
const exporter = new GLTFExporter();
const result = await exporter.parseAsync(exportRoot, {
  binary: true,
  trs: false,
  onlyVisible: false,
  animations: mixerAnimations,
});

const blob = new Blob([result], { type: 'model/gltf-binary' });
download(blob, 'model.glb');
```

### USDZ — Apple / visionOS export

Use `USDZExporter`.

Support:

- Export complete scene or selected subtree.
- Preserve separate named meshes where exporter support allows.
- Bake world transforms when required by exporter.
- Warn about unsupported Three.js materials, procedural shaders, animations, and compressed textures.
- Convert unsupported materials to compatible physically based materials before export.
- Test the resulting file in Quick Look / Reality Converter.

Do not claim perfect parity for custom GLSL materials. Display an export warning when flattening or material conversion is required.

### OBJ

Use `OBJExporter`.

Export:

- `.obj` geometry.
- `.mtl` material file when supported by the implementation.
- Texture files if available and practical.
- Separate object/group names based on the Three.js hierarchy.

Important limitations:

- OBJ does not preserve bones, animations, morph targets, node hierarchy, or advanced PBR materials.
- Keep part names using `o`/`g` records.
- If `.mtl` and textures are generated, download them as a ZIP together with the OBJ.

### Optional formats

Add only after GLB, USDZ, and OBJ work:

- STL for manufacturing; geometry only, no materials/hierarchy.
- PLY for point/mesh interchange.
- FBX only through an external conversion service or desktop tool; do not implement an unreliable browser exporter.

## Export preparation

Before exporting:

1. Clone or reference the selected subtree without mutating the preview scene.
2. Update world matrices recursively.
3. Remove editor-only helpers, grids, lights, cameras, gizmos, and selection outlines.
4. Keep only model objects, materials, textures, bones, and animations.
5. Apply optional transforms:
   - Y-up or Z-up conversion.
   - Unit scale: meters, centimeters, or custom.
   - Center at origin.
   - Ground feet/base at Y = 0.
   - Apply world transform.
6. Choose whether invisible objects are excluded.
7. Preserve names and hierarchy by default.
8. Generate a validation report before download.

## Validation report

Show:

- Number of groups.
- Number of meshes.
- Number of skinned meshes.
- Number of materials.
- Number of textures.
- Vertex and triangle counts.
- Bounding-box dimensions.
- Animation clip names and durations.
- Unsupported features for the selected format.
- Whether the export is selected-only or full-scene.

Block export only for fatal problems. Warnings should be visible but actionable.

## Editor layout

Use a layout similar to a lightweight 3D asset inspector:

- Left: scene hierarchy and object list.
- Center: Three.js viewport.
- Right: selected object properties and material information.
- Bottom: export panel and validation log.

Export panel controls:

- Format: GLB, glTF, USDZ, OBJ, STL, PLY.
- Scope: entire scene / selected object / selected subtree.
- Include hidden objects: yes/no.
- Include lights and cameras: normally no.
- Apply transforms: yes/no.
- Center model: yes/no.
- Unit scale.
- Download button.

## Material strategy

Prefer standard materials that export reliably:

- `MeshStandardMaterial`.
- `MeshPhysicalMaterial` only where the target exporter supports it.

For procedural/custom shaders:

- Keep the original shader in the live preview.
- On export, either convert to an approximate PBR material or bake a texture.
- Clearly report the conversion.
- Never silently export a blank or untextured material.

## Suggested project structure

```text
src/
  main.ts
  viewer/
    createScene.ts
    selection.ts
    hierarchy.ts
    controls.ts
  model/
    loadFactory.ts
    inventory.ts
    cloneForExport.ts
    normalizeTransforms.ts
  export/
    exportGlb.ts
    exportGltf.ts
    exportUsdz.ts
    exportObj.ts
    exportStl.ts
    exportPly.ts
    validation.ts
    download.ts
  ui/
    SceneTree.ts
    Inspector.ts
    ExportPanel.ts
  generated/
    createModel.ts
public/
  reference/
```

## Acceptance criteria

- Loading a generated factory displays actual 3D geometry.
- The scene tree shows multiple named parts instead of one image plane.
- Selecting or hiding one part affects only that part.
- Exported GLB opens in Blender and preserves separate objects and names.
- Exported USDZ opens in Apple Quick Look or Reality Converter with a usable appearance.
- Exported OBJ contains separate object/group records and does not flatten every part into one object.
- The reference image is never used as the only model geometry.
- Exporting selected subtree works.
- Preview-only helpers are absent from exported files.
- The UI reports unsupported materials/features instead of silently losing them.
- A sample generated model and the attached aerial reference image can be used for testing the viewer/reference overlay; the image itself must not be treated as mesh geometry.

## Deliverables

1. Working Vite + TypeScript application.
2. Example generated Three.js factory returning at least 5 separately named meshes/groups.
3. Scene hierarchy panel.
4. GLB/glTF exporter.
5. USDZ exporter.
6. OBJ exporter with ZIP packaging for OBJ/MTL/textures when needed.
7. Validation and warning system.
8. README with setup, development, and export instructions.
9. Automated smoke test that loads the sample factory and verifies mesh count, hierarchy, and export invocation.

## Priority order

Implement in this order:

1. Load factory and render real geometry.
2. Preserve hierarchy and create scene tree.
3. GLB export.
4. USDZ export and compatibility warnings.
5. OBJ + MTL/ZIP export.
6. Selection, transforms, and export scopes.
7. Optional STL/PLY and advanced material baking.
