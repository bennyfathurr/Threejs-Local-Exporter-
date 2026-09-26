import * as THREE from 'three';
import { cloneForExport } from '../model/cloneForExport';
import { normalizeTransforms } from '../model/normalizeTransforms';
import {
  downloadModelAsGlb,
  downloadModelAsProjectFile,
  saveModelDraftToStorage,
  getModelDraftMetadata,
} from '../model/projectSaveLoad';
import { buildInventory } from '../model/inventory';
import { showToast } from './Toast';

export interface SaveModalCallbacks {
  onSaved?: (format: string, filename: string) => void;
}

export class SaveModal {
  private modalEl: HTMLElement;
  private currentModel: THREE.Object3D | null = null;
  private callbacks: SaveModalCallbacks;

  private selectedFormat: 'glb' | 'json' | 'draft' = 'glb';
  private centerOrigin = true;
  private groundBase = true;
  private excludeHidden = true;

  constructor(callbacks: SaveModalCallbacks = {}) {
    this.callbacks = callbacks;
    this.modalEl = document.createElement('div');
    this.modalEl.id = 'save-model-modal';
    this.modalEl.className = 'modal-backdrop';
    this.modalEl.style.display = 'none';
    document.body.appendChild(this.modalEl);
    this.render();
  }

  public open(model: THREE.Object3D) {
    this.currentModel = model;
    this.updateStats();
    const nameInput = this.modalEl.querySelector('#save-modal-filename') as HTMLInputElement;
    if (nameInput) {
      nameInput.value = (model.name || 'procedural_model').replace(/\s+/g, '_');
    }
    this.modalEl.style.display = 'flex';
  }

  public close() {
    this.modalEl.style.display = 'none';
  }

  private updateStats() {
    if (!this.currentModel) return;
    const { stats } = buildInventory(this.currentModel);
    const statsEl = this.modalEl.querySelector('#save-modal-stats');
    if (statsEl) {
      statsEl.innerHTML = `
        <div class="save-stat-pill"><strong>Nodes:</strong> ${stats.totalObjects}</div>
        <div class="save-stat-pill"><strong>Meshes:</strong> ${stats.meshCount}</div>
        <div class="save-stat-pill"><strong>Triangles:</strong> ${stats.totalTriangles.toLocaleString()}</div>
        <div class="save-stat-pill"><strong>Materials:</strong> ${stats.materialCount}</div>
        <div class="save-stat-pill"><strong>Size:</strong> ${stats.boundingBox.size.map((v) => v.toFixed(2)).join(' × ')}m</div>
      `;
    }

    const draftMeta = getModelDraftMetadata();
    const draftNotice = this.modalEl.querySelector('#save-modal-draft-info') as HTMLElement | null;
    if (draftNotice) {
      if (draftMeta) {
        const timeAgo = Math.round((Date.now() - draftMeta.timestamp) / 60000);
        const timeStr = timeAgo <= 1 ? 'just now' : `${timeAgo} min ago`;
        draftNotice.textContent = `Existing draft in storage: "${draftMeta.name}" (${timeStr})`;
        draftNotice.style.display = 'block';
      } else {
        draftNotice.style.display = 'none';
      }
    }
  }

  private render() {
    this.modalEl.innerHTML = `
      <div class="modal-dialog" style="width: 580px;">
        <div class="modal-header">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:16px;">💾</span>
            <span style="font-weight:700; font-size:14px; color:#fff;">Save Model & Project File</span>
          </div>
          <button class="btn btn-sm" id="btn-save-modal-close" style="padding: 2px 7px;">✕</button>
        </div>

        <div class="modal-body" style="gap:16px;">
          <!-- Filename input -->
          <div>
            <label class="form-label" style="margin-bottom:6px; font-weight:600; display:block;">File / Model Name</label>
            <input type="text" id="save-modal-filename" class="text-input" style="width:100%;" placeholder="e.g. Museum_Sultan_Mahmud_Badaruddin_II" />
          </div>

          <!-- Format Choice -->
          <div>
            <label class="form-label" style="margin-bottom:6px; font-weight:600; display:block;">Choose Target Format</label>
            <div style="display:flex; flex-direction:column; gap:8px;">
              <label class="save-format-card active" data-format="glb" style="display:flex; align-items:flex-start; gap:10px; padding:10px 12px; border-radius:8px; border:1px solid var(--border-focus); background:rgba(6, 182, 212, 0.08); cursor:pointer;">
                <input type="radio" name="save-format" value="glb" checked style="margin-top:2px; accent-color:var(--accent-cyan);" />
                <div>
                  <div style="font-weight:600; font-size:13px; color:var(--text-primary); display:flex; align-items:center; gap:6px;">
                    <span>3D Model File (.glb)</span>
                    <span class="badge-tag">Standard 3D</span>
                  </div>
                  <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">
                    Self-contained binary 3D asset with geometry & standard PBR materials. Ideal for AR Palembang Heritage, Web, Unity, Blender, or 3D printing.
                  </div>
                </div>
              </label>

              <label class="save-format-card" data-format="json" style="display:flex; align-items:flex-start; gap:10px; padding:10px 12px; border-radius:8px; border:1px solid var(--border-color); background:var(--bg-card); cursor:pointer;">
                <input type="radio" name="save-format" value="json" style="margin-top:2px; accent-color:var(--accent-blue);" />
                <div>
                  <div style="font-weight:600; font-size:13px; color:var(--text-primary); display:flex; align-items:center; gap:6px;">
                    <span>Project Scene File (.project.json)</span>
                    <span class="badge-tag" style="border-color:rgba(99, 102, 241, 0.4); color:var(--accent-indigo); background:rgba(99, 102, 241, 0.1);">100% Fidelity</span>
                  </div>
                  <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">
                    Native Three.js Scene hierarchy, geometries, materials, custom names, and transforms. Re-open anytime in this editor without loss of structure.
                  </div>
                </div>
              </label>

              <label class="save-format-card" data-format="draft" style="display:flex; align-items:flex-start; gap:10px; padding:10px 12px; border-radius:8px; border:1px solid var(--border-color); background:var(--bg-card); cursor:pointer;">
                <input type="radio" name="save-format" value="draft" style="margin-top:2px; accent-color:var(--accent-emerald);" />
                <div>
                  <div style="font-weight:600; font-size:13px; color:var(--text-primary); display:flex; align-items:center; gap:6px;">
                    <span>Browser Local Draft</span>
                    <span class="badge-tag" style="border-color:rgba(16, 185, 129, 0.4); color:var(--accent-emerald); background:rgba(16, 185, 129, 0.1);">Auto-Cache</span>
                  </div>
                  <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">
                    Saves state to browser storage. Survives accidental tab close or page reload so you can continue editing instantly.
                  </div>
                  <div id="save-modal-draft-info" style="font-size:10px; color:var(--accent-amber); margin-top:3px; display:none;"></div>
                </div>
              </label>
            </div>
          </div>

          <!-- Optimization / Alignment Toggles -->
          <div id="save-modal-options-row" style="display:flex; gap:16px; flex-wrap:wrap; background:var(--bg-input); padding:10px 12px; border-radius:6px; border:1px solid var(--border-color);">
            <label class="checkbox-label" style="font-size:11px;">
              <input type="checkbox" id="chk-save-center" checked />
              Center Origin (0,0,0)
            </label>
            <label class="checkbox-label" style="font-size:11px;">
              <input type="checkbox" id="chk-save-ground" checked />
              Ground Base (Y=0)
            </label>
            <label class="checkbox-label" style="font-size:11px;">
              <input type="checkbox" id="chk-save-hidden" checked />
              Exclude Hidden Parts
            </label>
          </div>

          <!-- Scene Stats -->
          <div id="save-modal-stats" style="display:flex; gap:8px; flex-wrap:wrap;"></div>
        </div>

        <div class="modal-footer">
          <div style="font-size:11px; color:var(--text-muted);">
            💡 Shortcut: <kbd style="background:var(--bg-card); padding:2px 5px; border-radius:3px; border:1px solid var(--border-color); font-family:var(--font-mono); color:var(--text-primary);">Ctrl+S</kbd> / <kbd style="background:var(--bg-card); padding:2px 5px; border-radius:3px; border:1px solid var(--border-color); font-family:var(--font-mono); color:var(--text-primary);">⌘S</kbd> for instant quick save
          </div>
          <div style="display:flex; gap:8px;">
            <button class="btn" id="btn-save-modal-cancel">Cancel</button>
            <button class="btn btn-primary" id="btn-save-modal-execute" style="background: linear-gradient(135deg, #0ea5e9, #6366f1); border:none; font-weight:600;">
              💾 Save & Download
            </button>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents() {
    this.modalEl.querySelector('#btn-save-modal-close')?.addEventListener('click', () => this.close());
    this.modalEl.querySelector('#btn-save-modal-cancel')?.addEventListener('click', () => this.close());

    // Click outside backdrop
    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) this.close();
    });

    // Format selection
    const cards = this.modalEl.querySelectorAll('.save-format-card');
    const executeBtn = this.modalEl.querySelector('#btn-save-modal-execute') as HTMLButtonElement;
    const optionsRow = this.modalEl.querySelector('#save-modal-options-row') as HTMLElement;

    cards.forEach((card) => {
      card.addEventListener('click', () => {
        const radio = card.querySelector('input[type="radio"]') as HTMLInputElement;
        if (radio) radio.checked = true;

        cards.forEach((c) => {
          c.classList.remove('active');
          (c as HTMLElement).style.borderColor = 'var(--border-color)';
          (c as HTMLElement).style.background = 'var(--bg-card)';
        });
        card.classList.add('active');
        (card as HTMLElement).style.borderColor = 'var(--border-focus)';
        (card as HTMLElement).style.background = 'rgba(6, 182, 212, 0.08)';

        this.selectedFormat = card.getAttribute('data-format') as 'glb' | 'json' | 'draft';

        if (this.selectedFormat === 'draft') {
          executeBtn.textContent = '📦 Save to Browser Draft';
          if (optionsRow) optionsRow.style.display = 'none';
        } else {
          executeBtn.textContent = `💾 Save & Download .${this.selectedFormat === 'glb' ? 'glb' : 'json'}`;
          if (optionsRow) optionsRow.style.display = 'flex';
        }
      });
    });

    executeBtn.addEventListener('click', async () => {
      await this.executeSave();
    });
  }

  private async executeSave() {
    if (!this.currentModel) return;

    const nameInput = this.modalEl.querySelector('#save-modal-filename') as HTMLInputElement;
    const rawName = (nameInput.value || this.currentModel.name || 'procedural_model').trim();
    const cleanName = rawName.replace(/[^a-zA-Z0-9_\-\.]/g, '_');

    const chkCenter = this.modalEl.querySelector('#chk-save-center') as HTMLInputElement;
    const chkGround = this.modalEl.querySelector('#chk-save-ground') as HTMLInputElement;
    const chkHidden = this.modalEl.querySelector('#chk-save-hidden') as HTMLInputElement;

    const center = chkCenter ? chkCenter.checked : true;
    const ground = chkGround ? chkGround.checked : true;
    const excludeHidden = chkHidden ? chkHidden.checked : true;

    try {
      if (this.selectedFormat === 'draft') {
        const result = saveModelDraftToStorage(this.currentModel);
        if (result.success) {
          showToast(`Draft saved locally: "${cleanName}"`, '📦');
          this.callbacks.onSaved?.('draft', cleanName);
          this.close();
        } else {
          showToast(`Failed to save draft: ${result.error || 'Storage full'}`, '⚠️');
        }
        return;
      }

      // Clone and apply transforms if requested
      let targetToSave: THREE.Object3D = this.currentModel;
      if (center || ground || excludeHidden) {
        const cloned = cloneForExport({
          targetNode: this.currentModel,
          scope: 'full',
          excludeHidden,
        });
        targetToSave = normalizeTransforms(cloned, {
          centerModel: center,
          groundBase: ground,
          unitScale: 'meters',
          upAxis: 'Y_UP',
        });
      }

      if (this.selectedFormat === 'glb') {
        showToast(`Exporting ${cleanName}.glb...`, '⏳');
        await downloadModelAsGlb(targetToSave, cleanName);
        showToast(`Saved 3D Model: ${cleanName}.glb`, '💾');
        this.callbacks.onSaved?.('glb', cleanName);
      } else if (this.selectedFormat === 'json') {
        downloadModelAsProjectFile(targetToSave, cleanName);
        showToast(`Saved Project: ${cleanName}.project.json`, '📁');
        this.callbacks.onSaved?.('json', cleanName);
      }

      this.close();
    } catch (err) {
      console.error('Save failed:', err);
      showToast(`Save failed: ${err instanceof Error ? err.message : String(err)}`, '⚠️');
    }
  }
}
