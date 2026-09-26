import * as THREE from 'three';
import { createScene } from './viewer/createScene';
import { createSelectionManager } from './viewer/selection';
import { createTransformGizmo, TransformGizmoManager } from './viewer/transformGizmo';
import { createModel } from './generated/createModel';
import { buildInventory } from './model/inventory';
import { PRESETS } from './model/loadFactory';
import { SceneTree } from './ui/SceneTree';
import { Inspector } from './ui/Inspector';
import { ExportPanel } from './ui/ExportPanel';
import { ViewportOverlay } from './ui/ViewportOverlay';
import { Toolbar } from './ui/Toolbar';
import { CodeModal } from './ui/CodeModal';
import { AiGenerateModal } from './ui/AiGenerateModal';
import {
  HistoryManager,
  TransformSnapshot,
  captureTransform,
  applyTransform,
  transformsEqual,
} from './model/history';
import { showToast } from './ui/Toast';
import {
  createPrimitiveObject,
  generateUniqueName,
  detachObject,
  attachObjectAt,
  PRIMITIVE_DEFINITIONS,
  PrimitiveType,
} from './model/meshOperations';
import { SaveModal } from './ui/SaveModal';
import {
  downloadModelAsGlb,
  downloadModelAsProjectFile,
  saveModelDraftToStorage,
  loadModelDraftFromStorage,
  loadModelFromAnyFile,
} from './model/projectSaveLoad';

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

  const initialPreset = PRESETS[0];
  let currentModel: THREE.Object3D = initialPreset ? initialPreset.factory(initialPreset.defaultSpec) : createModel();
  sceneCtx.modelGroup.add(currentModel);

  // 2. Initialize Undo / Redo History Manager
  const historyManager = new HistoryManager(50);
  let toolbar: Toolbar;
  let inspector: Inspector;
  let viewportOverlay: ViewportOverlay;

  historyManager.addListener((event) => {
    toolbar?.updateHistoryState(event.canUndo, event.canRedo);
    viewportOverlay?.updateHistoryState(event.canUndo, event.canRedo);
    if (event.type === 'undo' && event.actionName) {
      showToast(`Undone: ${event.actionName}`, '↶');
    } else if (event.type === 'redo' && event.actionName) {
      showToast(`Redone: ${event.actionName}`, '↷');
    }
  });

  // 3. Initialize Unity-Style Transform Gizmo Manager
  let dragStartSnapshot: TransformSnapshot | null = null;

  const transformGizmo = createTransformGizmo({
    scene: sceneCtx.scene,
    cameraProvider: () => sceneCtx.activeCamera,
    domElement: sceneCtx.renderer.domElement,
    orbitControls: sceneCtx.controls,
    container: canvasContainer,
    onTransformStart: (obj) => {
      dragStartSnapshot = captureTransform(obj);
    },
    onTransformChange: (obj) => {
      selectionManager.refreshHighlight();
      inspector?.updateTransformFields(obj);
    },
    onTransformEnd: (obj) => {
      selectionManager.refreshHighlight();
      inspector?.updateTransformFields(obj);
      exportPanel.updateValidation();

      if (dragStartSnapshot) {
        const dragEndSnapshot = captureTransform(obj);
        if (!transformsEqual(dragStartSnapshot, dragEndSnapshot)) {
          const target = obj;
          const start = dragStartSnapshot;
          const end = dragEndSnapshot;
          const modeName =
            transformGizmo.mode === 'translate'
              ? 'Move'
              : transformGizmo.mode === 'rotate'
                ? 'Rotate'
                : 'Scale';

          historyManager.push({
            name: `${modeName} "${target.name || 'Object'}"`,
            undo: () => {
              applyTransform(target, start);
              selectionManager.refreshHighlight();
              inspector?.updateTransformFields(target);
              exportPanel.updateValidation();
            },
            redo: () => {
              applyTransform(target, end);
              selectionManager.refreshHighlight();
              inspector?.updateTransformFields(target);
              exportPanel.updateValidation();
            },
          });
        }
        dragStartSnapshot = null;
      }
    },
    onModeChange: (mode) => {
      viewportOverlay?.updateGizmoMode(mode);
      inspector?.updateModeButtons(mode);
    },
    onSpaceChange: (space) => {
      viewportOverlay?.updateGizmoSpace(space);
    },
  });

  sceneCtx.addCameraChangeListener((cam) => {
    transformGizmo.updateCamera(cam);
  });

  // 4. Initialize Selection Manager
  const selectionManager = createSelectionManager(
    canvasContainer,
    () => sceneCtx.activeCamera,
    () => sceneCtx.modelGroup,
    sceneCtx.scene,
    (selected) => {
      if (selected && !selectionManager.isLocked(selected)) {
        transformGizmo.attach(selected);
      } else {
        transformGizmo.detach();
      }
      inspector?.update();
      sceneTree.updateSelection();
      exportPanel.updateValidation();
      updateDeleteButtonState();
    },
    () => transformGizmo.isInteracting()
  );

  // Mesh & Object Manipulation Helpers
  const updateDeleteButtonState = () => {
    const btnTreeDelete = document.getElementById('btn-tree-delete-selected') as HTMLButtonElement | null;
    if (btnTreeDelete) {
      const selected = selectionManager.selectedObject;
      const canDelete = selected !== null && selected !== currentModel && !selectionManager.isLocked(selected);
      btnTreeDelete.disabled = !canDelete;
    }
  };

  const handleCreateMesh = (type: PrimitiveType) => {
    const selected = selectionManager.selectedObject;
    let targetParent: THREE.Object3D = currentModel;
    let spawnPosition: THREE.Vector3 | null = null;

    if (selected && selected !== currentModel) {
      if (selected.type === 'Group') {
        targetParent = selected;
      } else if (selected.parent) {
        targetParent = selected.parent;
        // Position next to the selected object so they don't occupy exact same space
        spawnPosition = selected.position.clone().add(new THREE.Vector3(1.2, 0, 0));
      }
    }

    const typePrefix = type === 'group' ? 'Group' : type.charAt(0).toUpperCase() + type.slice(1);
    const uniqueName = generateUniqueName(typePrefix, currentModel);
    const newObj = createPrimitiveObject(type, uniqueName);

    if (spawnPosition) {
      newObj.position.copy(spawnPosition);
    }

    const parent = targetParent;
    const insertIndex = parent.children.length;
    attachObjectAt(newObj, parent, insertIndex);

    // Auto-select and attach gizmo
    selectionManager.selectObject(newObj);
    transformGizmo.attach(newObj);
    updateModelInfo();
    updateDeleteButtonState();
    showToast(`Created: ${newObj.name}`, '✨');

    // Register undo/redo
    historyManager.push({
      name: `Create "${newObj.name}"`,
      undo: () => {
        detachObject(newObj);
        if (selectionManager.selectedObject === newObj) {
          selectionManager.selectObject(null);
          transformGizmo.detach();
        }
        updateModelInfo();
        updateDeleteButtonState();
      },
      redo: () => {
        attachObjectAt(newObj, parent, insertIndex);
        selectionManager.selectObject(newObj);
        transformGizmo.attach(newObj);
        updateModelInfo();
        updateDeleteButtonState();
      },
    });
  };

  const handleDeleteObject = (target?: THREE.Object3D | null) => {
    const obj = target || selectionManager.selectedObject;
    if (!obj) {
      showToast('Select an object to delete', '⚠️');
      return;
    }

    if (obj === currentModel) {
      showToast('Cannot delete root model container', '⚠️');
      return;
    }

    if (selectionManager.isLocked(obj)) {
      showToast(`"${obj.name}" is locked. Unlock it first.`, '🔒');
      return;
    }

    const location = detachObject(obj);
    if (!location) {
      showToast('Cannot delete: object has no parent', '⚠️');
      return;
    }

    const { parent, index } = location;
    const objName = obj.name || 'Object';

    if (selectionManager.selectedObject === obj) {
      selectionManager.selectObject(null);
      transformGizmo.detach();
    }

    updateModelInfo();
    updateDeleteButtonState();
    showToast(`Deleted: ${objName}`, '🗑️');

    historyManager.push({
      name: `Delete "${objName}"`,
      undo: () => {
        attachObjectAt(obj, parent, index);
        selectionManager.selectObject(obj);
        transformGizmo.attach(obj);
        updateModelInfo();
        updateDeleteButtonState();
      },
      redo: () => {
        detachObject(obj);
        if (selectionManager.selectedObject === obj) {
          selectionManager.selectObject(null);
          transformGizmo.detach();
        }
        updateModelInfo();
        updateDeleteButtonState();
      },
    });
  };

  // 5. Initialize Scene Tree
  const sceneTree = new SceneTree(treeContainer, selectionManager, {
    onSelect: (obj) => {
      if (obj && !selectionManager.isLocked(obj)) {
        transformGizmo.attach(obj);
      } else {
        transformGizmo.detach();
      }
      inspector.update();
      exportPanel.updateValidation();
    },
    onRename: (obj, newName, prevName) => {
      if (prevName && prevName !== newName) {
        historyManager.push({
          name: `Rename "${prevName}" to "${newName}"`,
          undo: () => {
            obj.name = prevName;
            sceneTree.render();
            inspector.update();
            exportPanel.updateValidation();
          },
          redo: () => {
            obj.name = newName;
            sceneTree.render();
            inspector.update();
            exportPanel.updateValidation();
          },
        });
      }
      inspector.update();
      exportPanel.updateValidation();
    },
    onVisibilityChange: (obj, visible) => {
      historyManager.push({
        name: `${visible ? 'Show' : 'Hide'} "${obj.name}"`,
        undo: () => {
          obj.visible = !visible;
          sceneTree.render();
          inspector.update();
          if (selectionManager.selectedObject === obj) {
            if (!visible) transformGizmo.attach(obj);
            else transformGizmo.detach();
          }
          exportPanel.updateValidation();
        },
        redo: () => {
          obj.visible = visible;
          sceneTree.render();
          inspector.update();
          if (selectionManager.selectedObject === obj) {
            if (visible) transformGizmo.attach(obj);
            else transformGizmo.detach();
          }
          exportPanel.updateValidation();
        },
      });
      if (selectionManager.selectedObject === obj) {
        if (visible) transformGizmo.attach(obj);
        else transformGizmo.detach();
      }
      exportPanel.updateValidation();
    },
    onSoloToggle: (obj) => {
      if (selectionManager.selectedObject) {
        if (selectionManager.selectedObject.visible) transformGizmo.attach(selectionManager.selectedObject);
        else transformGizmo.detach();
      }
      exportPanel.updateValidation();
    },
    onLockToggle: (obj) => {
      if (selectionManager.selectedObject === obj) {
        if (selectionManager.isLocked(obj)) transformGizmo.detach();
        else transformGizmo.attach(obj);
      }
      inspector.update();
      updateDeleteButtonState();
    },
    onDelete: (obj) => {
      handleDeleteObject(obj);
    },
  });

  treeSearchInput.addEventListener('input', () => {
    sceneTree.setFilter(treeSearchInput.value);
  });

  // 6. Initialize Inspector
  inspector = new Inspector(inspectorContainer, selectionManager, {
    onFrameObject: (obj) => {
      sceneCtx.frameObject(obj);
    },
    onTransformChange: (obj) => {
      selectionManager.refreshHighlight();
      exportPanel.updateValidation();
    },
    onExportSubtree: (obj) => {
      // Triggered if needed
    },
    onRefreshTree: () => {
      sceneTree.render();
      exportPanel.updateValidation();
    },
    onGizmoModeChange: (mode) => {
      transformGizmo.setMode(mode);
      viewportOverlay.updateGizmoMode(mode);
    },
    onGizmoSpaceToggle: () => {
      const space = transformGizmo.toggleSpace();
      viewportOverlay.updateGizmoSpace(space);
    },
    getGizmoMode: () => transformGizmo.mode,
    getGizmoSpace: () => transformGizmo.space,
    onRecordAction: (action) => {
      historyManager.push(action);
    },
    onDelete: (obj) => {
      handleDeleteObject(obj);
    },
  });

  // 7. Initialize Export Panel
  const exportPanel = new ExportPanel(
    exportDock,
    () => currentModel,
    () => selectionManager.selectedObject
  );

  // 8. Initialize Viewport Floating Controls & Reference Overlay
  viewportOverlay = new ViewportOverlay(
    viewportOverlayContainer,
    sceneCtx,
    transformGizmo,
    historyManager
  );

  // 9. Initialize In-Browser Code Modal for Arbitrary TS/JS
  const codeModal = new CodeModal({
    onModelLoaded: (newModel) => {
      loadNewModel(newModel);
    },
  });

  // 10. Initialize Multimodal img2threejs AI Generator Modal
  const aiModal = new AiGenerateModal({
    onSuccess: (newModel, generatedCode, imagePayload) => {
      loadNewModel(newModel);
      // Auto-mount user's uploaded image to the reference comparison overlay!
      viewportOverlay.setReferenceImage(imagePayload.dataUrl, true);
    },
    onOpenCodeEditor: (code) => {
      codeModal.open(code);
    },
  });

  // 11. Initialize Save Modal Dialog
  const saveModal = new SaveModal({
    onSaved: () => {
      toolbar?.updateDraftState();
    },
  });

  // 12. Initialize Top Toolbar
  toolbar = new Toolbar(appHeader, sceneCtx, {
    onModelLoaded: (newModel, refImg) => {
      historyManager.clear();
      loadNewModel(newModel, refImg);
    },
    onResetView: () => {
      sceneCtx.resetCamera();
    },
    onOpenCodeEditor: () => {
      codeModal.open();
    },
    onOpenAiGenerator: () => {
      aiModal.open();
    },
    onUndo: () => {
      historyManager.undo();
    },
    onRedo: () => {
      historyManager.redo();
    },
    onCreateMesh: (type) => {
      handleCreateMesh(type);
    },
    onQuickSave: () => {
      const baseName = (currentModel.name || 'procedural_model').replace(/\s+/g, '_');
      showToast(`Exporting ${baseName}.glb...`, '⏳');
      downloadModelAsGlb(currentModel, baseName)
        .then(() => {
          showToast(`Saved 3D Model: ${baseName}.glb`, '💾');
        })
        .catch((err) => {
          showToast(`Save failed: ${err instanceof Error ? err.message : String(err)}`, '⚠️');
        });
    },
    onSaveGlb: () => {
      const baseName = (currentModel.name || 'procedural_model').replace(/\s+/g, '_');
      showToast(`Exporting ${baseName}.glb...`, '⏳');
      downloadModelAsGlb(currentModel, baseName)
        .then(() => {
          showToast(`Saved 3D Model: ${baseName}.glb`, '💾');
        })
        .catch((err) => {
          showToast(`Save failed: ${err instanceof Error ? err.message : String(err)}`, '⚠️');
        });
    },
    onSaveProjectJson: () => {
      const baseName = (currentModel.name || 'procedural_model').replace(/\s+/g, '_');
      downloadModelAsProjectFile(currentModel, baseName);
      showToast(`Saved Project: ${baseName}.project.json`, '📁');
    },
    onOpenSaveModal: () => {
      saveModal.open(currentModel);
    },
    onSaveDraft: () => {
      const result = saveModelDraftToStorage(currentModel);
      if (result.success) {
        showToast('Draft saved to browser storage', '📦');
        toolbar?.updateDraftState();
      } else {
        showToast(`Failed to save draft: ${result.error || 'Storage error'}`, '⚠️');
      }
    },
    onRestoreDraft: () => {
      const draft = loadModelDraftFromStorage();
      if (draft) {
        historyManager.clear();
        loadNewModel(draft.model);
        showToast(`Restored draft: "${draft.name}"`, '⟲');
      } else {
        showToast('No saved draft found in storage', '⚠️');
      }
    },
  });

  // 13. Initialize Sidebar Add Mesh Dropdown & Delete Button
  const treeMeshDropdown = document.getElementById('tree-mesh-dropdown') as HTMLElement | null;
  const btnTreeAddMesh = document.getElementById('btn-tree-add-mesh') as HTMLButtonElement | null;
  const btnTreeDelete = document.getElementById('btn-tree-delete-selected') as HTMLButtonElement | null;

  if (treeMeshDropdown) {
    treeMeshDropdown.innerHTML = PRIMITIVE_DEFINITIONS.map(
      (p) => `
      <button class="mesh-dropdown-item" data-type="${p.type}">
        <span class="mesh-item-icon">${p.icon}</span>
        <div class="mesh-item-text">
          <span class="mesh-item-title">${p.label}</span>
          <span class="mesh-item-desc">${p.description}</span>
        </div>
      </button>
    `
    ).join('');

    treeMeshDropdown.querySelectorAll('.mesh-dropdown-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const type = (item as HTMLElement).getAttribute('data-type') as PrimitiveType;
        if (type) {
          handleCreateMesh(type);
        }
        treeMeshDropdown.style.display = 'none';
      });
    });
  }

  if (btnTreeAddMesh && treeMeshDropdown) {
    btnTreeAddMesh.addEventListener('click', (e) => {
      e.stopPropagation();
      const isShown = treeMeshDropdown.style.display === 'flex';
      treeMeshDropdown.style.display = isShown ? 'none' : 'flex';
    });

    window.addEventListener('click', () => {
      treeMeshDropdown.style.display = 'none';
    });
  }

  btnTreeDelete?.addEventListener('click', () => {
    handleDeleteObject();
  });

  // 14. Global Keyboard Shortcuts (Undo, Redo, Delete, Save, Open)
  window.addEventListener('keydown', (e) => {
    const activeEl = document.activeElement;
    const tag = activeEl?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || (activeEl as HTMLElement)?.isContentEditable) {
      return;
    }

    // Delete / Backspace to delete selected object
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectionManager.selectedObject && selectionManager.selectedObject !== currentModel) {
        e.preventDefault();
        handleDeleteObject();
        return;
      }
    }

    const isCtrlOrCmd = e.ctrlKey || e.metaKey;
    if (isCtrlOrCmd && !e.altKey) {
      if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveModal.open(currentModel);
        return;
      } else if (e.key.toLowerCase() === 'o') {
        e.preventDefault();
        const fileInput = document.getElementById('universal-file-input') as HTMLInputElement | null;
        fileInput?.click();
        return;
      } else if (e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          historyManager.redo();
        } else {
          historyManager.undo();
        }
      } else if (e.key.toLowerCase() === 'y') {
        e.preventDefault();
        historyManager.redo();
      }
    }
  });

  // 15. Viewport Drag-and-Drop Loading (.glb, .gltf, .json, .ts, .js)
  const viewportCenter = document.getElementById('viewport-center') as HTMLElement;
  const dropZone = document.createElement('div');
  dropZone.className = 'viewport-drop-zone';
  dropZone.id = 'viewport-drop-zone';
  dropZone.innerHTML = `
    <div class="viewport-drop-icon">📥</div>
    <div class="viewport-drop-title">Drop 3D Model or Project File</div>
    <div class="viewport-drop-subtitle">Supports .glb, .gltf, .json, .ts, .js</div>
  `;
  viewportCenter.appendChild(dropZone);

  let dragCounter = 0;

  viewportCenter.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    dropZone.classList.add('active');
  });

  viewportCenter.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  });

  viewportCenter.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      dropZone.classList.remove('active');
    }
  });

  viewportCenter.addEventListener('drop', async (e) => {
    e.preventDefault();
    dragCounter = 0;
    dropZone.classList.remove('active');

    if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      try {
        showToast(`Loading ${file.name}...`, '⏳');
        const result = await loadModelFromAnyFile(file);
        historyManager.clear();
        loadNewModel(result.model);
        showToast(`Loaded ${result.fileType.toUpperCase()}: ${result.name}`, '📂');
      } catch (err) {
        showToast(`Failed to load file: ${err instanceof Error ? err.message : String(err)}`, '⚠️');
      }
    }
  });

  const loadNewModel = (newModel: THREE.Object3D, referenceImage?: string) => {
    // Clear old model
    selectionManager.selectObject(null);
    transformGizmo.detach();
    while (sceneCtx.modelGroup.children.length > 0) {
      sceneCtx.modelGroup.remove(sceneCtx.modelGroup.children[0]);
    }

    currentModel = newModel;
    sceneCtx.modelGroup.add(currentModel);

    if (referenceImage) {
      viewportOverlay.setReferenceImage(referenceImage, false);
    }

    // Refresh inventory and UI
    updateModelInfo();
    updateDeleteButtonState();
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
  if (initialPreset?.referenceImage) {
    viewportOverlay.setReferenceImage(initialPreset.referenceImage, false);
  }
  updateModelInfo();
  setTimeout(() => {
    sceneCtx.frameObject(currentModel);
  }, 100);
});
