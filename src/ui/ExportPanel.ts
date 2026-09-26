import * as THREE from 'three';
import { ExportFormat, validateExport, ValidationReport } from '../export/validation';
import { cloneForExport } from '../model/cloneForExport';
import { normalizeTransforms, UnitScale, UpAxis } from '../model/normalizeTransforms';
import { exportGlb } from '../export/exportGlb';
import { exportGltf } from '../export/exportGltf';
import { exportUsdz } from '../export/exportUsdz';
import { exportObjWithMtl } from '../export/exportObj';
import { exportStl } from '../export/exportStl';
import { exportPly } from '../export/exportPly';
import { downloadFile } from '../export/download';
import { downloadModelAsProjectFile } from '../model/projectSaveLoad';

export interface ExportSettings {
  format: ExportFormat;
  scope: 'full' | 'subtree' | 'selectedOnly';
  centerModel: boolean;
  groundBase: boolean;
  unitScale: UnitScale;
  upAxis: UpAxis;
  excludeHidden: boolean;
}

export class ExportPanel {
  private container: HTMLElement;
  private getRootObject: () => THREE.Object3D;
  private getSelectedObject: () => THREE.Object3D | null;

  private settings: ExportSettings = {
    format: 'glb',
    scope: 'full',
    centerModel: true,
    groundBase: true,
    unitScale: 'meters',
    upAxis: 'Y_UP',
    excludeHidden: true,
  };

  private currentReport: ValidationReport | null = null;
  private isExporting = false;

  constructor(
    container: HTMLElement,
    getRootObject: () => THREE.Object3D,
    getSelectedObject: () => THREE.Object3D | null
  ) {
    this.container = container;
    this.getRootObject = getRootObject;
    this.getSelectedObject = getSelectedObject;
    this.render();
  }

  public updateValidation() {
    const root = this.getRootObject();
    const selected = this.getSelectedObject();
    const targetNode = (this.settings.scope !== 'full' && selected) ? selected : root;

    // Build temporary cloned tree for accurate validation
    const cloned = cloneForExport({
      targetNode,
      scope: this.settings.scope,
      excludeHidden: this.settings.excludeHidden,
    });

    const normalized = normalizeTransforms(cloned, {
      centerModel: this.settings.centerModel,
      groundBase: this.settings.groundBase,
      unitScale: this.settings.unitScale,
      upAxis: this.settings.upAxis,
    });

    this.currentReport = validateExport(normalized, this.settings.format, this.settings.scope);
    this.renderValidationCard();
  }

  public render() {
    this.container.innerHTML = `
      <!-- LEFT: EXPORT CONFIGURATION CONTROLS -->
      <div class="export-controls">
        <!-- Formats -->
        <div>
          <div class="form-label" style="margin-bottom:6px; font-weight:600;">Export Format</div>
          <div class="format-pills">
            <button class="format-pill ${this.settings.format === 'glb' ? 'active' : ''}" data-fmt="glb">GLB (Binary)</button>
            <button class="format-pill ${this.settings.format === 'gltf' ? 'active' : ''}" data-fmt="gltf">glTF (JSON)</button>
            <button class="format-pill ${this.settings.format === 'json' ? 'active' : ''}" data-fmt="json">JSON (Project)</button>
            <button class="format-pill ${this.settings.format === 'usdz' ? 'active' : ''}" data-fmt="usdz">USDZ (Apple AR)</button>
            <button class="format-pill ${this.settings.format === 'obj' ? 'active' : ''}" data-fmt="obj">OBJ + MTL (ZIP)</button>
            <button class="format-pill ${this.settings.format === 'stl' ? 'active' : ''}" data-fmt="stl">STL</button>
            <button class="format-pill ${this.settings.format === 'ply' ? 'active' : ''}" data-fmt="ply">PLY</button>
          </div>
        </div>

        <!-- Scope & Orientation -->
        <div class="form-row">
          <label class="form-label">Export Scope</label>
          <select class="select-input" id="export-scope-select">
            <option value="full" ${this.settings.scope === 'full' ? 'selected' : ''}>Complete Scene</option>
            <option value="subtree" ${this.settings.scope === 'subtree' ? 'selected' : ''}>Selected Subtree</option>
            <option value="selectedOnly" ${this.settings.scope === 'selectedOnly' ? 'selected' : ''}>Selected Part Only</option>
          </select>
        </div>

        <div class="form-row">
          <label class="form-label">Unit Scale</label>
          <select class="select-input" id="export-unit-select">
            <option value="meters" ${this.settings.unitScale === 'meters' ? 'selected' : ''}>Meters (1.0)</option>
            <option value="centimeters" ${this.settings.unitScale === 'centimeters' ? 'selected' : ''}>Centimeters (100.0)</option>
            <option value="millimeters" ${this.settings.unitScale === 'millimeters' ? 'selected' : ''}>Millimeters (1000.0)</option>
            <option value="inches" ${this.settings.unitScale === 'inches' ? 'selected' : ''}>Inches (39.37)</option>
            <option value="feet" ${this.settings.unitScale === 'feet' ? 'selected' : ''}>Feet (3.28)</option>
          </select>
        </div>

        <div class="form-row">
          <label class="form-label">Coordinate Up-Axis</label>
          <select class="select-input" id="export-axis-select">
            <option value="Y_UP" ${this.settings.upAxis === 'Y_UP' ? 'selected' : ''}>Y-Up (Three.js / glTF standard)</option>
            <option value="Z_UP" ${this.settings.upAxis === 'Z_UP' ? 'selected' : ''}>Z-Up (CAD / BIM standard)</option>
          </select>
        </div>

        <!-- Toggles -->
        <div style="display:flex; gap:12px; flex-wrap:wrap;">
          <label class="checkbox-label">
            <input type="checkbox" id="chk-center" ${this.settings.centerModel ? 'checked' : ''}/>
            Center Origin
          </label>
          <label class="checkbox-label">
            <input type="checkbox" id="chk-ground" ${this.settings.groundBase ? 'checked' : ''}/>
            Ground (Y=0)
          </label>
          <label class="checkbox-label">
            <input type="checkbox" id="chk-exclude-hidden" ${this.settings.excludeHidden ? 'checked' : ''}/>
            Exclude Hidden
          </label>
        </div>
      </div>

      <!-- RIGHT: VALIDATION CARD & EXPORT TRIGGER -->
      <div class="export-validation-card" id="export-validation-card"></div>
    `;

    this.bindEvents();
    this.updateValidation();
  }

  private bindEvents() {
    // Format pills
    this.container.querySelectorAll('.format-pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        this.container.querySelectorAll('.format-pill').forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');
        this.settings.format = pill.getAttribute('data-fmt') as ExportFormat;
        this.updateValidation();
      });
    });

    // Scope select
    const scopeSelect = this.container.querySelector('#export-scope-select') as HTMLSelectElement;
    scopeSelect?.addEventListener('change', () => {
      this.settings.scope = scopeSelect.value as 'full' | 'subtree' | 'selectedOnly';
      this.updateValidation();
    });

    // Unit select
    const unitSelect = this.container.querySelector('#export-unit-select') as HTMLSelectElement;
    unitSelect?.addEventListener('change', () => {
      this.settings.unitScale = unitSelect.value as UnitScale;
      this.updateValidation();
    });

    // Up Axis select
    const axisSelect = this.container.querySelector('#export-axis-select') as HTMLSelectElement;
    axisSelect?.addEventListener('change', () => {
      this.settings.upAxis = axisSelect.value as UpAxis;
      this.updateValidation();
    });

    // Checkboxes
    const chkCenter = this.container.querySelector('#chk-center') as HTMLInputElement;
    chkCenter?.addEventListener('change', () => {
      this.settings.centerModel = chkCenter.checked;
      this.updateValidation();
    });

    const chkGround = this.container.querySelector('#chk-ground') as HTMLInputElement;
    chkGround?.addEventListener('change', () => {
      this.settings.groundBase = chkGround.checked;
      this.updateValidation();
    });

    const chkExcludeHidden = this.container.querySelector('#chk-exclude-hidden') as HTMLInputElement;
    chkExcludeHidden?.addEventListener('change', () => {
      this.settings.excludeHidden = chkExcludeHidden.checked;
      this.updateValidation();
    });
  }

  private renderValidationCard() {
    const cardEl = this.container.querySelector('#export-validation-card');
    if (!cardEl || !this.currentReport) return;

    const rep = this.currentReport;
    const sizeStr = rep.stats.boundingBox.size.map((v) => v.toFixed(2)).join(' × ');

    cardEl.innerHTML = `
      <div class="validation-header">
        <div class="validation-title">
          <span>📋 Validation Report</span>
          <span class="badge-tag" style="text-transform:uppercase;">${rep.format}</span>
          <span style="font-size:11px; color:var(--text-muted);">Scope: ${rep.scope}</span>
        </div>
        <button class="btn btn-primary" id="btn-export-download" ${!rep.canExport || this.isExporting ? 'disabled' : ''}>
          ${this.isExporting ? '⏳ Exporting...' : `⬇️ Export .${rep.format}`}
        </button>
      </div>

      <!-- Geometry Metrics -->
      <div style="display:flex; gap:16px; font-size:11px; color:var(--text-secondary); background:var(--bg-input); padding:6px 12px; border-radius:6px; border:1px solid var(--border-color);">
        <div><strong>Meshes:</strong> ${rep.stats.meshCount}</div>
        <div><strong>Groups:</strong> ${rep.stats.groupCount}</div>
        <div><strong>Materials:</strong> ${rep.stats.materialCount}</div>
        <div><strong>Triangles:</strong> ${rep.stats.totalTriangles.toLocaleString()}</div>
        <div><strong>Size (XYZ):</strong> ${sizeStr}</div>
      </div>

      <!-- Validation Warnings / Diagnostics -->
      <div class="issue-list">
        ${rep.issues
          .map(
            (issue) => `
          <div class="issue-item ${issue.severity}">
            <span>${issue.severity === 'error' ? '🚫' : issue.severity === 'warning' ? '⚠️' : 'ℹ️'}</span>
            <div>
              <strong>${issue.title}:</strong> ${issue.detail}
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    const downloadBtn = cardEl.querySelector('#btn-export-download') as HTMLButtonElement;
    downloadBtn?.addEventListener('click', () => {
      this.executeExport();
    });
  }

  private async executeExport() {
    if (this.isExporting) return;
    this.isExporting = true;
    this.renderValidationCard();

    try {
      const root = this.getRootObject();
      const selected = this.getSelectedObject();
      const targetNode = (this.settings.scope !== 'full' && selected) ? selected : root;
      const baseFilename = (targetNode.name || 'procedural_model').toLowerCase().replace(/\s+/g, '_');

      // 1. Prepare export tree
      const cloned = cloneForExport({
        targetNode,
        scope: this.settings.scope,
        excludeHidden: this.settings.excludeHidden,
      });

      const normalized = normalizeTransforms(cloned, {
        centerModel: this.settings.centerModel,
        groundBase: this.settings.groundBase,
        unitScale: this.settings.unitScale,
        upAxis: this.settings.upAxis,
      });

      // 2. Export based on format
      switch (this.settings.format) {
        case 'glb': {
          const blob = await exportGlb(normalized);
          downloadFile(blob, `${baseFilename}.glb`, 'model/gltf-binary');
          break;
        }
        case 'gltf': {
          const blob = await exportGltf(normalized);
          downloadFile(blob, `${baseFilename}.gltf`, 'model/gltf+json');
          break;
        }
        case 'json': {
          downloadModelAsProjectFile(normalized, baseFilename);
          break;
        }
        case 'usdz': {
          const blob = await exportUsdz(normalized);
          downloadFile(blob, `${baseFilename}.usdz`, 'model/vnd.usdz+zip');
          break;
        }
        case 'obj': {
          const zipBlob = await exportObjWithMtl(normalized, baseFilename);
          downloadFile(zipBlob, `${baseFilename}_obj_mtl.zip`, 'application/zip');
          break;
        }
        case 'stl': {
          const blob = exportStl(normalized, { binary: true });
          downloadFile(blob, `${baseFilename}.stl`, 'application/octet-stream');
          break;
        }
        case 'ply': {
          const blob = exportPly(normalized, { binary: true });
          downloadFile(blob, `${baseFilename}.ply`, 'application/octet-stream');
          break;
        }
      }
    } catch (err) {
      console.error('Export failed:', err);
      alert(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      this.isExporting = false;
      this.renderValidationCard();
    }
  }
}
