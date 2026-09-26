import * as THREE from 'three';
import { SelectionManager } from '../viewer/selection';
import { ICONS } from './icons';

export interface SceneTreeCallbacks {
  onSelect: (object: THREE.Object3D | null) => void;
  onRename: (object: THREE.Object3D, newName: string, prevName?: string) => void;
  onVisibilityChange: (object: THREE.Object3D, visible: boolean) => void;
  onSoloToggle: (object: THREE.Object3D) => void;
  onLockToggle: (object: THREE.Object3D) => void;
  onDelete?: (object: THREE.Object3D) => void;
}

export class SceneTree {
  private container: HTMLElement;
  private selectionManager: SelectionManager;
  private callbacks: SceneTreeCallbacks;
  private rootObject: THREE.Object3D | null = null;
  private filterQuery: string = '';
  private expandedUuids = new Set<string>();

  constructor(
    container: HTMLElement,
    selectionManager: SelectionManager,
    callbacks: SceneTreeCallbacks
  ) {
    this.container = container;
    this.selectionManager = selectionManager;
    this.callbacks = callbacks;
  }

  public setRoot(root: THREE.Object3D) {
    this.rootObject = root;
    // Auto-expand root and first level
    this.expandedUuids.add(root.uuid);
    root.children.forEach((c) => this.expandedUuids.add(c.uuid));
    this.render();
  }

  public setFilter(query: string) {
    this.filterQuery = query.toLowerCase().trim();
    this.render();
  }

  public updateSelection() {
    const selected = this.selectionManager.selectedObject;
    this.container.querySelectorAll('.tree-node-row').forEach((el) => {
      const uuid = el.getAttribute('data-uuid');
      if (uuid === selected?.uuid) {
        el.classList.add('selected');
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else {
        el.classList.remove('selected');
      }
    });
  }

  public render() {
    this.container.innerHTML = '';
    if (!this.rootObject) {
      this.container.innerHTML = '<div style="padding:16px;color:#64748b;text-align:center;">No model loaded</div>';
      return;
    }

    const treeContainer = document.createElement('div');
    treeContainer.className = 'tree-container';

    this.renderNode(this.rootObject, 0, treeContainer);
    this.container.appendChild(treeContainer);
  }

  private renderNode(node: THREE.Object3D, depth: number, parentEl: HTMLElement) {
    // Exclude editor helpers
    if (node.userData?.isEditorHelper || node.name?.startsWith('__helper_')) {
      return;
    }

    const name = node.name || `Object_${node.id}`;
    const matchesFilter =
      !this.filterQuery ||
      name.toLowerCase().includes(this.filterQuery) ||
      node.type.toLowerCase().includes(this.filterQuery);

    const hasChildren = node.children.some(
      (c) => !c.userData?.isEditorHelper && !c.name?.startsWith('__helper_')
    );
    const isExpanded = this.expandedUuids.has(node.uuid);

    if (matchesFilter || this.hasMatchingDescendant(node)) {
      const row = document.createElement('div');
      row.className = 'tree-node-row';
      row.setAttribute('data-uuid', node.uuid);
      row.style.paddingLeft = `${depth * 14 + 6}px`;

      if (this.selectionManager.selectedObject?.uuid === node.uuid) {
        row.classList.add('selected');
      }

      // Expander caret
      const expander = document.createElement('span');
      expander.className = 'tree-expander';
      if (hasChildren) {
        expander.innerHTML = isExpanded ? ICONS.chevronDown(10) : ICONS.chevronRight(10);
        expander.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.expandedUuids.has(node.uuid)) {
            this.expandedUuids.delete(node.uuid);
          } else {
            this.expandedUuids.add(node.uuid);
          }
          this.render();
        });
      }
      row.appendChild(expander);

      // Icon
      const icon = document.createElement('span');
      const isMesh = (node as THREE.Mesh).isMesh;
      icon.className = `tree-node-icon ${isMesh ? 'mesh' : 'group'}`;
      icon.innerHTML = isMesh ? ICONS.mesh(13) : ICONS.group(13);
      row.appendChild(icon);

      // Name Label (with inline rename support)
      const nameLabel = document.createElement('span');
      nameLabel.className = 'tree-node-name';
      nameLabel.textContent = name;
      nameLabel.title = `Double-click to rename: ${name} (${node.type})`;

      nameLabel.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        this.startInlineRename(node, nameLabel);
      });
      row.appendChild(nameLabel);

      // Node Quick Actions (Hide/Show, Solo, Lock)
      const actions = document.createElement('div');
      actions.className = 'tree-node-actions';

      // Visibility button
      const visBtn = document.createElement('button');
      visBtn.className = `tree-action-btn ${node.visible ? '' : 'active'}`;
      visBtn.innerHTML = node.visible ? ICONS.eye(12) : ICONS.eyeOff(12);
      visBtn.title = node.visible ? 'Hide part' : 'Show part';
      visBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        node.visible = !node.visible;
        this.callbacks.onVisibilityChange(node, node.visible);
        visBtn.innerHTML = node.visible ? ICONS.eye(12) : ICONS.eyeOff(12);
        visBtn.classList.toggle('active', !node.visible);
      });
      actions.appendChild(visBtn);

      // Solo button
      const soloBtn = document.createElement('button');
      const isSolo = this.selectionManager.isSoloed(node);
      soloBtn.className = `tree-action-btn ${isSolo ? 'soloed' : ''}`;
      soloBtn.innerHTML = 'S';
      soloBtn.title = 'Solo part (hide others)';
      soloBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectionManager.soloObject(node);
        this.callbacks.onSoloToggle(node);
        this.render();
      });
      actions.appendChild(soloBtn);

      // Lock button
      const lockBtn = document.createElement('button');
      const isLocked = this.selectionManager.isLocked(node);
      lockBtn.className = `tree-action-btn ${isLocked ? 'active' : ''}`;
      lockBtn.innerHTML = isLocked ? ICONS.lock(12) : ICONS.unlock(12);
      lockBtn.title = isLocked ? 'Unlock part' : 'Lock part';
      lockBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectionManager.toggleLockSelected();
        this.callbacks.onLockToggle(node);
        this.render();
      });
      actions.appendChild(lockBtn);

      // Delete button (non-root nodes)
      if (node !== this.rootObject && this.callbacks.onDelete) {
        const delBtn = document.createElement('button');
        delBtn.className = 'tree-action-btn delete-btn';
        delBtn.innerHTML = ICONS.trash(12);
        delBtn.title = `Delete "${name}" (Delete / Backspace)`;
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.callbacks.onDelete?.(node);
        });
        actions.appendChild(delBtn);
      }

      row.appendChild(actions);

      // Row click selection
      row.addEventListener('click', () => {
        this.selectionManager.selectObject(node);
        this.callbacks.onSelect(node);
        this.updateSelection();
      });

      parentEl.appendChild(row);
    }

    // Children
    if (hasChildren && (isExpanded || this.filterQuery)) {
      node.children.forEach((child) => {
        this.renderNode(child, depth + 1, parentEl);
      });
    }
  }

  private startInlineRename(node: THREE.Object3D, labelEl: HTMLElement) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'text-input';
    input.value = node.name;
    input.style.padding = '1px 4px';
    input.style.fontSize = '12px';
    input.style.height = '20px';

    const finish = () => {
      const newName = input.value.trim();
      if (newName && newName !== node.name) {
        const prevName = node.name;
        node.name = newName;
        this.callbacks.onRename(node, newName, prevName);
      }
      this.render();
    };

    input.addEventListener('blur', finish);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') finish();
      if (e.key === 'Escape') this.render();
    });

    labelEl.replaceWith(input);
    input.focus();
    input.select();
  }

  private hasMatchingDescendant(node: THREE.Object3D): boolean {
    if (!this.filterQuery) return false;
    for (const child of node.children) {
      const name = child.name || '';
      if (
        name.toLowerCase().includes(this.filterQuery) ||
        child.type.toLowerCase().includes(this.filterQuery) ||
        this.hasMatchingDescendant(child)
      ) {
        return true;
      }
    }
    return false;
  }
}
