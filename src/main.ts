import * as THREE from 'three';
import { createScene } from './viewer/createScene';
import { createSelectionManager } from './viewer/selection';
import { createModel } from './generated/createModel';
import { buildInventory } from './model/inventory';
import { SceneTree } from './ui/SceneTree';
import { Inspector } from './ui/Inspector';
import { ExportPanel } from './ui/ExportPanel';
import { ViewportOverlay } from './ui/ViewportOverlay';
import { Toolbar } from './ui/Toolbar';
import { CodeModal } from './ui/CodeModal';

window.addEventListener('DOMContentLoaded', () => {
  const canvasContainer = document.getElementById('canvas-container') as HTMLElement;
  const viewportOverlayContainer = document.getElementById('viewport-overlay') as HTMLElement;
  const treeContainer = document.getElementById('scene-tree-container') as HTMLElement;
  const treeSearchInput = document.getElementById('tree-search-input') as HTMLInputElement;
  const inspectorContainer = document.getElementById('inspector-container') as HTMLElement;
  const exportDock = document.getElementById('export-dock') as HTMLElement;
  const appHeader = document.getElementById('app-header') as HTMLElement;
  const partCountBadge = document.getElementById('scene-part-count') as HTMLElement;

  // 1. Initialize Scene & Renderer
  const sceneCtx = createScene(canvasContainer);

  let currentModel: THREE.Object3D = createModel();
  sceneCtx.modelGroup.add(currentModel);

  // 2. Initialize Selection Manager
  const selectionManager = createSelectionManager(
    canvasContainer,
    () => sceneCtx.activeCamera,
    () => sceneCtx.modelGroup,
    sceneCtx.scene,
    (selected) => {
      inspector.update();
      sceneTree.updateSelection();
      exportPanel.updateValidation();
    }
  );

  // 3. Initialize Scene Tree
  const sceneTree = new SceneTree(treeContainer, selectionManager, {
    onSelect: (obj) => {
      inspector.update();
      exportPanel.updateValidation();
    },
    onRename: (obj, newName) => {
      inspector.update();
      exportPanel.updateValidation();
    },
    onVisibilityChange: (obj, visible) => {
      exportPanel.updateValidation();
    },
    onSoloToggle: (obj) => {
      exportPanel.updateValidation();
    },
    onLockToggle: (obj) => {
      inspector.update();
    },
  });

  treeSearchInput.addEventListener('input', () => {
    sceneTree.setFilter(treeSearchInput.value);
  });

  // 4. Initialize Inspector
  const inspector = new Inspector(inspectorContainer, selectionManager, {
    onFrameObject: (obj) => {
      sceneCtx.frameObject(obj);
    },
    onTransformChange: (obj) => {
      exportPanel.updateValidation();
    },
    onExportSubtree: (obj) => {
      // Triggered if needed
    },
    onRefreshTree: () => {
      sceneTree.render();
      exportPanel.updateValidation();
    },
  });

  // 5. Initialize Export Panel
  const exportPanel = new ExportPanel(
    exportDock,
    () => currentModel,
    () => selectionManager.selectedObject
  );

  // 6. Initialize Viewport Floating Controls & Reference Overlay
  new ViewportOverlay(viewportOverlayContainer, sceneCtx);

  // 7. Initialize In-Browser Code Modal for Arbitrary TS/JS
  const codeModal = new CodeModal({
    onModelLoaded: (newModel) => {
      loadNewModel(newModel);
    },
  });

  // 8. Initialize Top Toolbar
  new Toolbar(appHeader, sceneCtx, {
    onModelLoaded: (newModel) => {
      loadNewModel(newModel);
    },
    onResetView: () => {
      sceneCtx.resetCamera();
    },
    onOpenCodeEditor: () => {
      codeModal.open();
    },
  });

  const loadNewModel = (newModel: THREE.Object3D) => {
    // Clear old model
    selectionManager.selectObject(null);
    while (sceneCtx.modelGroup.children.length > 0) {
      sceneCtx.modelGroup.remove(sceneCtx.modelGroup.children[0]);
    }

    currentModel = newModel;
    sceneCtx.modelGroup.add(currentModel);

    // Refresh inventory and UI
    updateModelInfo();
    sceneCtx.frameObject(currentModel);
  };

  const updateModelInfo = () => {
    const { items, stats } = buildInventory(currentModel);
    partCountBadge.textContent = `${items.size} nodes (${stats.meshCount} meshes)`;
    sceneTree.setRoot(currentModel);
    inspector.update();
    exportPanel.updateValidation();
  };

  // Initial load
  updateModelInfo();
  setTimeout(() => {
    sceneCtx.frameObject(currentModel);
  }, 100);
});
