/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Gemini 2.5 Flash Image Studio — Apple Design & Liquid Glass Architecture
 * Enhanced with dynamic year auto-updating, spring micro-interactions,
 * and Cupertino Human Interface Guidelines.
 */

import loader from '@monaco-editor/loader';
import markdownit from 'markdown-it';
import {sanitizeHtml} from 'safevalues';
import {setAnchorHref, setElementInnerHtml, windowOpen} from 'safevalues/dom';
import Sortable, {SortableEvent} from 'sortablejs';

interface MarkdownItInstance {
  render: (markdown: string) => string;
}

// Monaco editor instance typing
// tslint:disable-next-line:no-any
let monaco: any | undefined;
// tslint:disable-next-line:no-any
type MonacoEditorInstance = any;

interface AppMetadata {
  name?: string;
  title?: string;
  description?: string;
}

interface CookbookData {
  notebookCode: string;
}

type Output =
  | {type: 'log' | 'error'; data: string}
  | {type: 'image'; data: string; mime: string};

interface Cell {
  id: string;
  type: 'js' | 'md';
  mode?: 'edit' | 'render';
  outputs: Output[];
  isOutputVisible?: boolean;
  isExecuted?: boolean;
  lastExecutedContent?: string;
}

// Global runtime references
const notebook = document.getElementById('notebook') as HTMLDivElement;
let cellCounter = 0;
const cells: Cell[] = [];
const monacoInstances: {[key: string]: MonacoEditorInstance} = {};
let cellClipboard: {cellData: Cell; code: string} | null = null;
let focusedCellId: string | null = null;
const persistentScope: Record<string, unknown> = {};

// Markdown parser
const md: MarkdownItInstance = (
  markdownit as unknown as (
    options?: Record<string, unknown>,
  ) => MarkdownItInstance
)({
  html: true,
  linkify: true,
  typographer: true,
});

/* --------------------------------------------------------------------------
   Apple Toast Notification System
   -------------------------------------------------------------------------- */
function showAppleToast(
  message: string,
  type: 'info' | 'success' | 'error' = 'info',
  icon = 'fa-sparkles',
) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `apple-toast toast-${type}`;
  toast.innerHTML = `<i class="fa-solid ${icon}"></i><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('dismissing');
    setTimeout(() => toast.remove(), 320);
  }, 2600);
}

/* --------------------------------------------------------------------------
   System Status Indicator
   -------------------------------------------------------------------------- */
function updateSystemStatus(
  text: string,
  state: 'ready' | 'busy' | 'error' = 'ready',
) {
  const label = document.getElementById('status-text');
  const indicator = document.getElementById('status-indicator');
  const dot = indicator?.querySelector('.status-dot');
  if (label) label.textContent = text;
  if (dot) {
    dot.className = `status-dot ${state === 'busy' ? 'busy' : state === 'error' ? 'error' : ''}`;
  }
}

/* --------------------------------------------------------------------------
   Dynamic Year Auto-Update System
   Automatically keeps all copyrights, status pills, and badges synchronized
   across current and coming years without manual updates.
   -------------------------------------------------------------------------- */
function initDynamicYear() {
  const currentYear = new Date().getFullYear();
  const yearBadge = document.getElementById('dynamic-year-badge');
  if (yearBadge) yearBadge.textContent = `${currentYear} Live`;

  const footerDynamicYear = document.getElementById('footer-dynamic-year');
  if (footerDynamicYear) footerDynamicYear.textContent = `${currentYear}`;

  const copyrightYear = document.getElementById('copyright-year');
  if (copyrightYear) copyrightYear.textContent = `${currentYear}`;

  console.log(`[Auto-Update Logic] Engine year auto-synchronized for ${currentYear} and future releases.`);
}

/* --------------------------------------------------------------------------
   Apple Theme Controller (Liquid Dark / Cupertino Light)
   -------------------------------------------------------------------------- */
function initThemeController() {
  const savedTheme =
    localStorage.getItem('apple_theme') ||
    (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');

  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);

  const themeBtn = document.getElementById('theme-toggle-btn');
  themeBtn?.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('apple_theme', next);
    updateThemeIcon(next);

    if (monaco) {
      monaco.editor.setTheme(next === 'dark' ? 'custom-dark' : 'custom-light');
    }

    showAppleToast(
      `Switched to ${next === 'dark' ? 'Liquid Dark' : 'Cupertino Light'}`,
      'info',
      next === 'dark' ? 'fa-moon' : 'fa-sun',
    );
  });
}

function updateThemeIcon(theme: string) {
  const icon = document.getElementById('theme-icon');
  if (icon) {
    icon.className = theme === 'dark' ? 'fa-regular fa-sun' : 'fa-regular fa-moon';
  }
}

/* --------------------------------------------------------------------------
   macOS Window Controls (Traffic Lights)
   -------------------------------------------------------------------------- */
function initWindowControls() {
  document.getElementById('traffic-close-btn')?.addEventListener('click', () => {
    showAppleToast('Session active in memory • 2.5 Flash Ready', 'info', 'fa-sparkles');
  });

  document.getElementById('traffic-minimize-btn')?.addEventListener('click', () => {
    if (notebook) {
      if (notebook.style.opacity === '0.1') {
        notebook.style.opacity = '1';
        notebook.style.transform = 'scale(1)';
        showAppleToast('Studio Window Restored', 'info', 'fa-window-maximize');
      } else {
        notebook.style.opacity = '0.1';
        notebook.style.transform = 'scale(0.98)';
        showAppleToast('Studio Minimized (Click yellow dot to restore)', 'info', 'fa-window-minimize');
      }
    }
  });

  document.getElementById('traffic-zoom-btn')?.addEventListener('click', () => {
    toggleFullscreen();
  });
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
    showAppleToast('Fullscreen Mode (Press Esc to exit)', 'info', 'fa-expand');
  } else {
    document.exitFullscreen().catch(() => {});
    showAppleToast('Exited Fullscreen', 'info', 'fa-compress');
  }
}

/* --------------------------------------------------------------------------
   Helper & Output Utilities
   -------------------------------------------------------------------------- */
function blobToRaw(blobUrl: string) {
  const pattern =
    /^https?:\/\/github\.com\/([^/]+\/[^/]+)\/blob\/([^/]+)\/(.+)$/;
  const match = blobUrl.match(pattern);
  if (!match) return blobUrl;
  const [, repo, branch, filePath] = match;
  return `https://raw.githubusercontent.com/${repo}/${branch}/${filePath}`;
}

function renderOutputs(outputDiv: HTMLElement, outputs: Output[]) {
  let outputHtml = '';

  outputs.forEach((output) => {
    switch (output.type) {
      case 'log': {
        const sanitizedLogContent = sanitizeHtml(md.render(output.data));
        outputHtml += `<div class="console-log">${sanitizedLogContent.toString()}</div>`;
        break;
      }
      case 'error': {
        const escapedErrorData = String(output.data).replace(
          /[<>&"']/g,
          (match) => {
            const escapeMap: {[key: string]: string} = {
              '<': '&lt;',
              '>': '&gt;',
              '&': '&amp;',
              '"': '&quot;',
              "'": '&#x27;',
            };
            return escapeMap[match] || match;
          },
        );
        outputHtml += `<div class="console-error"><i class="fa-solid fa-triangle-exclamation"></i> ERROR: ${escapedErrorData}</div>`;
        break;
      }
      case 'image': {
        const imageSrc =
          output.data.startsWith('data:') ||
          output.data.startsWith('http') ||
          output.data.startsWith('./')
            ? output.data
            : `data:${output.mime};base64,${output.data}`;

        const escapedSrc = imageSrc.replace(/[<>"']/g, (match) => {
          const escapeMap: {[key: string]: string} = {
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;',
          };
          return escapeMap[match] || match;
        });
        outputHtml += `<div class="image-output-card"><img src="${escapedSrc}" alt="Gemini Output" style="max-width: 100%; display: block; margin: 0.5em 0;" /></div>`;
        break;
      }
      default:
        console.error('Unexpected output type:', output);
        break;
    }
  });

  setElementInnerHtml(outputDiv, sanitizeHtml(outputHtml));
}

function parseNotebookFile(content: string) {
  const lines = content.split('\n');
  const cellsData: Array<{
    type: 'js' | 'md';
    code: string;
    mode?: string;
    outputs?: Output[];
  }> = [];
  let jsCodeLines: string[] = [];
  let mdContent = '';
  let outputContent = '';
  let inCodeBlock = false;
  let inMdBlock = false;
  let inOutputBlock = false;
  let mdMode = 'edit';

  const addJsCell = () => {
    if (jsCodeLines.length > 0) {
      cellsData.push({
        type: 'js',
        code: jsCodeLines.join('\n').trim(),
        outputs: [],
      });
      jsCodeLines = [];
    }
  };

  const addMdCell = () => {
    if (mdContent.trim()) {
      cellsData.push({type: 'md', code: mdContent.trim(), mode: mdMode});
      mdContent = '';
    }
  };

  const addOutput = () => {
    if (outputContent.trim() && cellsData.length > 0) {
      const lastJsCell = [...cellsData].reverse().find((c) => c.type === 'js');
      if (lastJsCell) {
        if (!lastJsCell.outputs) lastJsCell.outputs = [];
        lastJsCell.outputs.push({type: 'log', data: outputContent.trim()});
      }
      outputContent = '';
    }
  };

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (trimmed === '// [CODE STARTS]') {
      addMdCell();
      addOutput();
      inCodeBlock = true;
      inMdBlock = inOutputBlock = false;
      return;
    }

    if (trimmed === '// [CODE ENDS]') {
      addJsCell();
      inCodeBlock = false;
      return;
    }

    if (trimmed.startsWith('/* Markdown')) {
      addJsCell();
      addOutput();
      mdMode = trimmed.includes('(render)') ? 'render' : 'edit';
      inMdBlock = true;
      inCodeBlock = inOutputBlock = false;
      return;
    }

    if (trimmed.startsWith('/* Output')) {
      addJsCell();
      addMdCell();
      inOutputBlock = true;
      inCodeBlock = inMdBlock = false;
      return;
    }

    if (trimmed.endsWith('*/')) {
      const contentLine = line.replace(/\*\/\s*$/, '').trim();
      if (contentLine) {
        if (inMdBlock) mdContent += (mdContent ? '\n' : '') + contentLine;
        else if (inOutputBlock) {
          outputContent += (outputContent ? '\n' : '') + contentLine;
        }
      }
      if (inMdBlock) addMdCell();
      else if (inOutputBlock) addOutput();
      inMdBlock = inOutputBlock = false;
      return;
    }

    if (inCodeBlock) jsCodeLines.push(line);
    else if (inMdBlock) mdContent += (mdContent ? '\n' : '') + line;
    else if (inOutputBlock) outputContent += (outputContent ? '\n' : '') + line;
  });

  addJsCell();
  addMdCell();
  addOutput();

  return cellsData;
}

function updateOutputToggle(
  cellId: string,
  isVisible: boolean,
  hasOutput = true,
) {
  const outputDiv = document.getElementById(`${cellId}_output`);
  const outputToggle = outputDiv?.previousElementSibling as HTMLElement;
  const cell = cells.find((c) => c.id === cellId);

  if (outputDiv && outputToggle && cell) {
    if (cell.type === 'md') {
      outputToggle.style.display = 'none';
      return;
    }

    if (hasOutput) {
      outputDiv.style.display = isVisible ? '' : 'none';
      const icon = outputToggle.querySelector('i');
      if (icon) {
        icon.className = `fa-solid ${isVisible ? 'fa-chevron-down' : 'fa-chevron-up'}`;
      }
      outputToggle.style.display = 'inline-flex';
    } else {
      outputToggle.style.display = 'none';
      outputDiv.style.display = 'none';
    }
  }
}

/* --------------------------------------------------------------------------
   Add Cell Implementation with Apple Squircle & Spring Interactivity
   -------------------------------------------------------------------------- */
async function addCell(
  code = '',
  type: 'js' | 'md' = 'js',
  preRender = false,
  outputs: Output[] = [],
  index?: number,
) {
  const cellId = `cell${cellCounter++}`;
  const cellDiv = document.createElement('div');

  cellDiv.className = 'cell';
  cellDiv.id = `cell-container-${cellId}`;
  cellDiv.dataset.cellId = cellId;

  const dragHandle = document.createElement('div');
  dragHandle.className = 'drag-handle';
  dragHandle.title = 'Drag to reorder';
  dragHandle.innerHTML = '<i class="fa-solid fa-grip-vertical"></i>';

  const executionStatus = document.createElement('div');
  executionStatus.className = 'execution-status';
  const checkIcon = document.createElement('i');
  checkIcon.className = 'fa-solid fa-check';
  checkIcon.setAttribute('aria-hidden', 'true');
  executionStatus.appendChild(checkIcon);

  if (type === 'md') {
    executionStatus.style.display = 'none';
  }

  const hoverMenu = document.createElement('div');
  hoverMenu.className = 'cell-hover-menu';

  const runButtonTitle = type === 'md' ? 'Render Markdown (Double-click)' : 'Run Cell (⌘↵)';
  const runButtonIconClass = type === 'md' ? 'fa-check-double' : 'fa-play';

  const createHoverButton = (
    title: string,
    iconClass: string,
    clickHandler: (e: MouseEvent) => void,
  ): HTMLButtonElement => {
    const button = document.createElement('button');
    button.title = title;
    button.addEventListener('click', clickHandler);
    const icon = document.createElement('i');
    icon.className = `fa-solid ${iconClass}`;
    button.appendChild(icon);
    return button;
  };

  hoverMenu.appendChild(
    createHoverButton(runButtonTitle, runButtonIconClass, () =>
      runCell(cellId),
    ),
  );
  hoverMenu.appendChild(
    createHoverButton('Move Cell Up (⌥↑)', 'fa-arrow-up', () =>
      moveCell(cellId, 'up'),
    ),
  );
  hoverMenu.appendChild(
    createHoverButton('Move Cell Down (⌥↓)', 'fa-arrow-down', () =>
      moveCell(cellId, 'down'),
    ),
  );
  hoverMenu.appendChild(
    createHoverButton('Delete Cell (⌘⌫)', 'fa-trash-can', () => deleteCell(cellId)),
  );

  const editorContainer = document.createElement('div');
  editorContainer.id = `${cellId}_editor_container`;
  editorContainer.className = 'editor-container';

  const outputToggle = document.createElement('div');
  outputToggle.className = 'output-toggle';
  outputToggle.appendChild(document.createTextNode('Output '));
  const chevronIcon = document.createElement('i');
  chevronIcon.className = 'fa-solid fa-chevron-down';
  outputToggle.appendChild(chevronIcon);
  outputToggle.style.display = 'none';

  const outputDiv = document.createElement('div');
  outputDiv.className = 'output';
  outputDiv.id = `${cellId}_output`;
  if (type === 'md') outputDiv.style.display = 'none';

  cellDiv.appendChild(dragHandle);
  cellDiv.appendChild(executionStatus);
  cellDiv.appendChild(hoverMenu);
  cellDiv.appendChild(editorContainer);
  cellDiv.appendChild(outputToggle);
  cellDiv.appendChild(outputDiv);

  outputToggle.addEventListener('click', () => {
    const cell = cells.find((c) => c.id === cellId);
    if (cell && cell.type === 'js' && cell.outputs.length > 0) {
      cell.isOutputVisible = !cell.isOutputVisible;
      updateOutputToggle(cellId, cell.isOutputVisible, true);
    }
  });

  if (notebook) {
    if (index !== undefined) {
      const cellElements = Array.from(notebook.getElementsByClassName('cell'));
      const anchorElement = cellElements[index] as HTMLElement | undefined;
      notebook.insertBefore(cellDiv, anchorElement || null);
    } else {
      notebook.appendChild(cellDiv);
    }
  }

  const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';

  const editorInstance = monaco.editor.create(editorContainer, {
    value: code,
    language: type === 'md' ? 'markdown' : 'javascript',
    theme: currentTheme === 'dark' ? 'custom-dark' : 'custom-light',
    automaticLayout: true,
    minimap: {enabled: false},
    fontSize: 14,
    fontFamily: '"JetBrains Mono", "SF Mono", Menlo, Monaco, Consolas, monospace',
    lineHeight: 22,
    wordWrap: 'on',
    lineNumbers: 'off',
    roundedSelection: true,
    scrollBeyondLastLine: false,
    contextmenu: true,
    scrollbar: {vertical: 'hidden', handleMouseWheel: false},
    cursorBlinking: 'smooth',
    cursorSmoothCaretAnimation: 'on',
    smoothScrolling: true,
  });

  monacoInstances[cellId] = editorInstance;

  editorInstance.onDidFocusEditorText(() => {
    focusedCellId = cellId;
  });

  editorInstance.onDidChangeModelContent(() => {
    const currentContent = editorInstance.getValue();
    if (checkContentChanged(cellId, currentContent)) {
      markCellAsUnexecuted(cellId);
    }
  });

  // Keyboard shortcut inside Monaco editor: ⌘+Enter to Run Cell
  editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
    runCell(cellId);
  });

  const newCellData: Cell = {
    id: cellId,
    type,
    mode: type === 'md' ? 'edit' : undefined,
    outputs,
    isOutputVisible: type === 'js' ? outputs.length > 0 : preRender,
  };

  if (index !== undefined) {
    cells.splice(index, 0, newCellData);
  } else {
    cells.push(newCellData);
  }

  const hasInitialOutput = type === 'js' && outputs.length > 0;
  updateOutputToggle(
    cellId,
    newCellData.isOutputVisible || false,
    hasInitialOutput,
  );

  editorInstance.onDidContentSizeChange(() => {
    const contentHeight = editorInstance.getContentHeight();
    const lineHeight = editorInstance
      .getOptions()
      .get(monaco.editor.EditorOption.lineHeight) as number;
    const newHeight = Math.max(lineHeight * 4, contentHeight);
    editorContainer.style.height = `${newHeight}px`;
    editorInstance.layout({
      width: editorContainer.clientWidth,
      height: newHeight,
    });
  });

  if (type === 'md') {
    outputDiv.addEventListener('dblclick', () => {
      const cell = cells.find((c) => c.id === cellId);
      if (cell && cell.mode === 'render') {
        runCell(cellId);
      }
    });

    outputDiv.style.cursor = preRender ? 'text' : 'default';
    if (preRender) {
      outputDiv.title = 'Double-click to edit Markdown';
    }
  }

  if (type === 'md' && preRender) {
    setTimeout(() => runCell(cellId), 0);
  }

  if (type === 'js' && outputs.length > 0) {
    renderOutputs(outputDiv, outputs);
  }
}

function deleteCell(cellId: string) {
  const idx = cells.findIndex((cell) => cell.id === cellId);
  if (idx !== -1) cells.splice(idx, 1);

  const container = document.getElementById(`cell-container-${cellId}`);
  if (container) {
    container.style.opacity = '0';
    container.style.transform = 'scale(0.95)';
    setTimeout(() => container.remove(), 200);
  }

  if (monacoInstances[cellId]) {
    monacoInstances[cellId].dispose();
    delete monacoInstances[cellId];
  }
  showAppleToast('Cell deleted', 'info', 'fa-trash-can');
}

async function downloadNotebook() {
  let content = '';

  cells.forEach((cell) => {
    const editor = monacoInstances[cell.id];
    const code = editor ? editor.getValue() : '';

    if (cell.type === 'md') {
      const marker =
        cell.mode === 'render' ? '/* Markdown (render)' : '/* Markdown';
      content += `${marker}\n${code}\n*/\n\n`;
    } else {
      content += `// [CODE STARTS]\n${code}\n// [CODE ENDS]\n\n`;

      if (cell.outputs?.length > 0) {
        content += '/* Output Sample\n\n';
        cell.outputs.forEach((output) => {
          if (output.type === 'image') {
            const imgSrc = output.data.startsWith('data:')
              ? output.data
              : `data:${output.mime};base64,${output.data}`;
            const sanitizedSrc = imgSrc.replace(/[<>"']/g, '');
            content += `<img src="${sanitizedSrc}" style="height:auto; width:100%;" />\n\n`;
          } else {
            const sanitizedOutput = String(output.data).replace(
              /[<>&"']/g,
              (match) => {
                const escapeMap: {[key: string]: string} = {
                  '<': '&lt;',
                  '>': '&gt;',
                  '&': '&amp;',
                  '"': '&quot;',
                  "'": '&#x27;',
                };
                return escapeMap[match] || match;
              },
            );
            content += `${sanitizedOutput}\n\n`;
          }
        });
        content += '*/\n\n';
      }
    }
  });

  const blob = new Blob([content.trim()], {type: 'text/javascript'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  setAnchorHref(a, url);
  a.download = `gemini-2.5-flash-image-${new Date().getFullYear()}.js`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showAppleToast('Notebook downloaded as JavaScript (.js)', 'success', 'fa-download');
}

async function runAllCells() {
  updateSystemStatus('Running All Cells...', 'busy');
  showAppleToast('Executing all code cells...', 'info', 'fa-forward-step');
  for (const cell of cells) {
    if (cell.type === 'md') continue;
    await runCell(cell.id);
  }
  updateSystemStatus('Kernel Ready', 'ready');
  showAppleToast('All cells executed', 'success', 'fa-circle-check');
}

async function runCell(cellId: string) {
  const cell = cells.find((c) => c.id === cellId);
  const editor = monacoInstances[cellId];
  const outputDiv = document.getElementById(`${cellId}_output`) as HTMLDivElement;
  const editorContainer = document.getElementById(`${cellId}_editor_container`) as HTMLDivElement;
  const cellElement = document.getElementById(`cell-container-${cellId}`);

  if (!cell || !editor || !outputDiv || !editorContainer || !cellElement) {
    console.error(`Could not run cell ${cellId}: missing dependencies`);
    return;
  }

  const code = editor.getValue();

  if (cell.type === 'md') {
    if (cell.mode === 'edit') {
      setElementInnerHtml(outputDiv, sanitizeHtml(md.render(code)));
      outputDiv.style.display = '';
      outputDiv.style.cursor = 'text';
      outputDiv.title = 'Double-click to edit Markdown';
      editorContainer.style.display = 'none';
      cellElement.classList.add('rendered-md');
      cell.mode = 'render';
      cell.isOutputVisible = true;
      updateOutputToggle(cellId, true, true);
    } else {
      outputDiv.style.display = 'none';
      outputDiv.style.cursor = 'default';
      outputDiv.title = '';
      editorContainer.style.display = '';
      cellElement.classList.remove('rendered-md');
      cell.mode = 'edit';
      cell.isOutputVisible = false;
      updateOutputToggle(cellId, false, true);
      editor.layout();
      editor.focus();
    }
    return;
  }

  updateSystemStatus(`Running Cell (${cellId})...`, 'busy');
  setElementInnerHtml(outputDiv, sanitizeHtml(''));
  cell.outputs = [];

  const showOutput = () => {
    cell.isOutputVisible = true;
    updateOutputToggle(cellId, true, true);
    renderOutputs(outputDiv, cell.outputs);
  };

  const sandboxConsole = {
    log: (...args: unknown[]) => {
      const text = args
        .map((a) =>
          typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a),
        )
        .join(' ');
      cell.outputs.push({type: 'log', data: text});
      showOutput();
    },
    error: (...args: unknown[]) => {
      cell.outputs.push({type: 'error', data: args.join(' ')});
      showOutput();
    },
    image: (base64: string, mime = 'image/png') => {
      cell.outputs.push({type: 'image', data: base64, mime});
      showOutput();
    },
  };

  const cellScope: Record<string, unknown> = {};

  const AsyncFunction = (async () => {}).constructor as new (
    ...args: string[]
  ) => (...args: unknown[]) => Promise<unknown>;

  const fn = new AsyncFunction(
    'console',
    'fetch',
    'persistentScope',
    'cellScope',
    `
    try {
      ${code}
    } catch (e) {
      console.error(e);
    }
  `,
  );

  try {
    await fn(
      sandboxConsole,
      window.fetch.bind(window),
      persistentScope,
      cellScope,
    );
    markCellAsExecuted(cellId, code);
    updateSystemStatus('Kernel Ready', 'ready');
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    sandboxConsole.error('Uncaught:', errorMessage);
    markCellAsExecuted(cellId, code);
    updateSystemStatus('Cell Error', 'error');
  }
}

function moveCell(cellId: string, direction: 'up' | 'down') {
  const cellIndex = cells.findIndex((c) => c.id === cellId);
  if (cellIndex === -1) return;

  const newIndex = direction === 'up' ? cellIndex - 1 : cellIndex + 1;
  if (newIndex < 0 || newIndex >= cells.length) return;

  const [movedCell] = cells.splice(cellIndex, 1);
  cells.splice(newIndex, 0, movedCell);

  const cellElement = document.getElementById(`cell-container-${cellId}`);
  const siblingElement = notebook?.children[newIndex] as HTMLElement | undefined;

  if (notebook && cellElement) {
    if (direction === 'up') {
      notebook.insertBefore(cellElement, siblingElement || null);
    } else {
      notebook.insertBefore(cellElement, siblingElement?.nextSibling || null);
    }
  }
}

function restartKernel() {
  if (
    !confirm(
      'Are you sure you want to restart the kernel? All memory variables will be reset.',
    )
  ) {
    return;
  }
  for (const key in persistentScope) {
    if (Object.prototype.hasOwnProperty.call(persistentScope, key)) {
      delete persistentScope[key];
    }
  }
  cells.forEach((cell) => {
    if (cell.type === 'js') {
      cell.outputs = [];
      const outputDiv = document.getElementById(`${cell.id}_output`);
      if (outputDiv) {
        setElementInnerHtml(outputDiv, sanitizeHtml(''));
        updateOutputToggle(cell.id, false, false);
      }
    }
  });
  updateSystemStatus('Kernel Ready', 'ready');
  showAppleToast('Kernel restarted successfully', 'success', 'fa-rotate-right');
}

function closeAllDropdowns() {
  document.querySelectorAll('.menu-item').forEach((item) => {
    item.classList.remove('active');
  });
}

function getFocusedCell(): Cell | null {
  if (focusedCellId) {
    return cells.find((c) => c.id === focusedCellId) || null;
  }
  for (const cellId in monacoInstances) {
    if (Object.prototype.hasOwnProperty.call(monacoInstances, cellId)) {
      const editor = monacoInstances[cellId];
      if (editor && editor.hasTextFocus()) {
        focusedCellId = cellId;
        return cells.find((c) => c.id === cellId) || null;
      }
    }
  }
  if (cells.length > 0) {
    focusedCellId = cells[0].id;
    return cells[0];
  }
  return null;
}

function cutCell() {
  const cell = getFocusedCell();
  if (!cell) {
    showAppleToast('Select a cell to cut', 'info', 'fa-scissors');
    return;
  }
  const editor = monacoInstances[cell.id];
  const code = editor ? editor.getValue() : '';
  cellClipboard = {cellData: {...cell}, code};
  deleteCell(cell.id);
  showAppleToast('Cell cut to clipboard', 'info', 'fa-scissors');
}

function copyCell() {
  const cell = getFocusedCell();
  if (!cell) {
    showAppleToast('Select a cell to copy', 'info', 'fa-copy');
    return;
  }
  const editor = monacoInstances[cell.id];
  const code = editor ? editor.getValue() : '';
  cellClipboard = {cellData: {...cell}, code};
  showAppleToast('Cell copied to clipboard', 'info', 'fa-copy');
}

function pasteCell() {
  if (!cellClipboard) {
    showAppleToast('Clipboard is empty', 'info', 'fa-clipboard');
    return;
  }
  const focusedCell = getFocusedCell();
  let insertIndex = cells.length;
  if (focusedCell) {
    const focusedIndex = cells.findIndex((c) => c.id === focusedCell.id);
    insertIndex = focusedIndex + 1;
  }
  addCell(
    cellClipboard.code,
    cellClipboard.cellData.type,
    cellClipboard.cellData.type === 'md' &&
      cellClipboard.cellData.mode === 'render',
    cellClipboard.cellData.outputs || [],
    insertIndex,
  );
  showAppleToast('Cell pasted from clipboard', 'success', 'fa-clipboard');
}

function insertCellAbove(type: 'js' | 'md' = 'js') {
  const focusedCell = getFocusedCell();
  let insertIndex = 0;
  if (focusedCell) {
    const focusedIndex = cells.findIndex((c) => c.id === focusedCell.id);
    insertIndex = focusedIndex;
  }
  addCell('', type, false, [], insertIndex);
  showAppleToast(`Inserted ${type === 'js' ? 'Code' : 'Markdown'} cell above`, 'info', 'fa-plus');
}

function insertCellBelow(type: 'js' | 'md' = 'js') {
  const focusedCell = getFocusedCell();
  let insertIndex = cells.length;
  if (focusedCell) {
    const focusedIndex = cells.findIndex((c) => c.id === focusedCell.id);
    insertIndex = focusedIndex + 1;
  }
  addCell('', type, false, [], insertIndex);
  showAppleToast(`Inserted ${type === 'js' ? 'Code' : 'Markdown'} cell below`, 'info', 'fa-plus');
}

async function restartAndRunAll() {
  restartKernel();
  await runAllCells();
}

function markCellAsExecuted(cellId: string, content: string) {
  const cell = cells.find((c) => c.id === cellId);
  const cellElement = document.getElementById(`cell-container-${cellId}`);
  if (cell && cellElement) {
    cell.isExecuted = true;
    cell.lastExecutedContent = content;
    cellElement.classList.add('executed');
  }
}

function markCellAsUnexecuted(cellId: string) {
  const cell = cells.find((c) => c.id === cellId);
  const cellElement = document.getElementById(`cell-container-${cellId}`);
  if (cell && cellElement) {
    cell.isExecuted = false;
    cell.lastExecutedContent = undefined;
    cellElement.classList.remove('executed');
  }
}

function checkContentChanged(cellId: string, currentContent: string): boolean {
  const cell = cells.find((c) => c.id === cellId);
  return (
    !cell || !cell.isExecuted || cell.lastExecutedContent !== currentContent
  );
}

// Window global bindings
Object.assign(window, {
  addCell: async (code = '', type: 'js' | 'md' = 'js') => {
    try {
      await addCell(code, type);
    } catch (error) {
      console.error('Failed to add cell:', error);
    }
  },
  deleteCell,
  runAllCells,
  runCell,
  moveCellUp: (cellId: string) => moveCell(cellId, 'up'),
  moveCellDown: (cellId: string) => moveCell(cellId, 'down'),
  restartKernel,
  cutCell,
  copyCell,
  pasteCell,
  insertCellAbove,
  insertCellBelow,
  restartAndRunAll,
  showAppleToast,
});

/* --------------------------------------------------------------------------
   Default Gemini 2.5 Flash Image Notebook Starter Cells
   -------------------------------------------------------------------------- */
function getDefaultNotebookCells() {
  const currentYear = new Date().getFullYear();
  return [
    {
      type: 'md' as const,
      mode: 'render',
      code: `#  Gemini 2.5 Flash Image Studio
### High-Performance Multimodal & Image Generation with Gemini SDK

Welcome to the **interactive playground for Google Gemini 2.5 Flash Image** (formerly codenamed *nano banana*). 
Experiment with image generation, visual reasoning, prompt engineering, and real-time execution directly in your browser.

- **Model Engine:** \`gemini-2.5-flash-image\` & \`imagen-3.0-generate-002\`
- **Design Philosophy:** Apple Human Interface Guidelines & Liquid Glass
- **Dynamic Lifecycle:** Automatically maintained and synchronized for **${currentYear} and future releases**`,
    },
    {
      type: 'js' as const,
      code: `// 1. Initialize Gemini 2.5 Flash Image Configuration
console.log("⚡ Booting Gemini 2.5 Flash Image Engine...");

const engineConfig = {
  model: "gemini-2.5-flash-image",
  fallbackModel: "imagen-3.0-generate-002",
  runtimeYear: new Date().getFullYear(),
  aspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
  safetyRatings: "standard_enterprise",
  status: "ONLINE",
};

console.log("Active Studio Configuration:", engineConfig);
console.log("Tip: Press ⌘ + Enter inside any code cell to run it instantly.");`,
    },
    {
      type: 'md' as const,
      mode: 'render',
      code: `## 🎨 Image Synthesis & Multimodal Reasoning

Gemini 2.5 Flash Image provides ultra-low latency generation. 
Run the cell below to simulate prompt dispatch and render an Apple-aesthetic sample card.`,
    },
    {
      type: 'js' as const,
      code: `// 2. Multimodal Generation & Visual Preview
const prompt = "A photorealistic Cupertino glass pavilion at dawn with holographic data ribbons";
console.log("Prompt Dispatched:", prompt);

// Generate sample SVG representation of Gemini visual output
const sampleSvg = \`<svg width="600" height="340" viewBox="0 0 600 340" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="appleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0a84ff" />
      <stop offset="50%" stop-color="#bf5af2" />
      <stop offset="100%" stop-color="#30d158" />
    </linearGradient>
    <filter id="glassBlur">
      <feGaussianBlur stdDeviation="16" result="blur" />
    </filter>
  </defs>
  <rect width="600" height="340" rx="20" fill="#0d0f15" />
  <circle cx="160" cy="110" r="110" fill="url(#appleGrad)" filter="url(#glassBlur)" opacity="0.65" />
  <circle cx="450" cy="230" r="130" fill="#0a84ff" filter="url(#glassBlur)" opacity="0.45" />
  <rect x="40" y="40" width="520" height="260" rx="18" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.18)" stroke-width="1" />
  <text x="300" y="140" font-family="-apple-system, sans-serif" font-size="24" font-weight="600" fill="#ffffff" text-anchor="middle"> Gemini 2.5 Flash Image</text>
  <text x="300" y="180" font-family="-apple-system, sans-serif" font-size="14" fill="#98989f" text-anchor="middle">Synthesized Studio Preview • High Fidelity</text>
  <rect x="220" y="215" width="160" height="34" rx="17" fill="#0a84ff" />
  <text x="300" y="237" font-family="-apple-system, sans-serif" font-size="12" font-weight="600" fill="#ffffff" text-anchor="middle">Output Rendered</text>
</svg>\`;

const previewUrl = "data:image/svg+xml;utf8," + encodeURIComponent(sampleSvg);
console.image(previewUrl);
console.log("✅ Synthesis complete. Latency: 24ms.");`,
    },
  ];
}

/* --------------------------------------------------------------------------
   App Initialization
   -------------------------------------------------------------------------- */
async function initializeStudio() {
  initDynamicYear();
  initThemeController();
  initWindowControls();

  // Load Metadata
  let appMetadata: AppMetadata = { name: '2.5 Flash Image', title: 'Gemini 2.5 Flash Image Studio' };
  try {
    const metaRes = await fetch('metadata.json');
    if (metaRes.ok) appMetadata = await metaRes.json();
  } catch (e) {
    console.warn('Metadata loaded from local fallback:', e);
  }

  // Load Cookbook
  let cookbookMetadata: CookbookData = {
    notebookCode: 'https://github.com/google-gemini/cookbook/blob/main/quickstarts-js/Image_out.js',
  };
  try {
    const cookRes = await fetch('cookbook.json');
    if (cookRes.ok) cookbookMetadata = await cookRes.json();
  } catch (e) {
    console.warn('Cookbook metadata loaded from local fallback:', e);
  }

  const rawLink = blobToRaw(cookbookMetadata.notebookCode);

  const notebookTitleElement = document.getElementById('notebook-title');
  if (notebookTitleElement && appMetadata.name) {
    notebookTitleElement.textContent = String(appMetadata.name).replace(/<[^>]*>/g, '');
  }
  if (appMetadata.title) {
    document.title = `${String(appMetadata.title).replace(/<[^>]*>/g, '')} — Apple Design`;
  }

  // Keyboard Shortcuts Global Listener
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      downloadNotebook();
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Enter') {
      e.preventDefault();
      runAllCells();
    }
  });

  document.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest('a');
    if (a?.href && !a.href.startsWith('javascript:')) {
      e.preventDefault();
      windowOpen(window, a.href, '_blank', 'noopener');
    }
  });

  // Setup Monaco Editor loader
  loader.config({
    paths: {vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs'},
  });

  monaco = await loader.init();

  // Define Apple Dark and Light Monaco themes
  monaco.editor.defineTheme('custom-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      {token: 'comment', foreground: '686873', fontStyle: 'italic'},
      {token: 'keyword', foreground: 'bf5af2', fontStyle: 'bold'},
      {token: 'string', foreground: '30d158'},
      {token: 'number', foreground: 'ff9f0a'},
    ],
    colors: {
      'editor.background': '#16181f',
      'editor.foreground': '#f5f5f7',
      'editorLineNumber.foreground': '#4a4a55',
      'editor.lineHighlightBackground': '#1e212b',
      'editorCursor.foreground': '#0a84ff',
    },
  });

  monaco.editor.defineTheme('custom-light', {
    base: 'vs',
    inherit: true,
    rules: [
      {token: 'comment', foreground: '86868b', fontStyle: 'italic'},
      {token: 'keyword', foreground: 'af52de', fontStyle: 'bold'},
      {token: 'string', foreground: '34c759'},
      {token: 'number', foreground: 'ff9500'},
    ],
    colors: {
      'editor.background': '#f9f9fb',
      'editor.foreground': '#1d1d1f',
      'editorLineNumber.foreground': '#aeaeb2',
      'editor.lineHighlightBackground': '#f0f0f4',
      'editorCursor.foreground': '#0071e3',
    },
  });

  // Add collapsible Apple copyright notice
  const copyrightCellDiv = document.createElement('div');
  copyrightCellDiv.className = 'cell copyright-cell rendered-md';
  copyrightCellDiv.id = 'copyright-cell';

  const collapseToggle = document.createElement('div');
  collapseToggle.className = 'collapse-toggle';
  const icon = document.createElement('i');
  icon.className = 'fa-solid fa-chevron-down';

  const span = document.createElement('span');
  span.style.fontWeight = '600';
  span.style.fontSize = '0.92rem';
  span.textContent = ` Google LLC & Community • Apache 2.0 License (${new Date().getFullYear()})`;

  collapseToggle.appendChild(icon);
  collapseToggle.appendChild(span);

  const copyrightContentDiv = document.createElement('div');
  copyrightContentDiv.id = 'copyright-content';
  copyrightContentDiv.className = 'output copyright-content';
  copyrightContentDiv.style.display = 'none';

  const copyrightText = `
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at:
https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.`;

  setElementInnerHtml(copyrightContentDiv, sanitizeHtml(md.render(copyrightText)));

  collapseToggle.addEventListener('click', () => {
    const isHidden = copyrightContentDiv.style.display === 'none';
    copyrightContentDiv.style.display = isHidden ? 'block' : 'none';
    icon.className = isHidden ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down';
  });

  copyrightCellDiv.appendChild(collapseToggle);
  copyrightCellDiv.appendChild(copyrightContentDiv);
  notebook?.prepend(copyrightCellDiv);

  // Setup Dynamic Inserter Line
  const inserter = document.createElement('div');
  inserter.id = 'cell-inserter';
  inserter.style.display = 'none';

  const line1 = document.createElement('div');
  line1.className = 'inserter-line';

  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'inserter-buttons';

  const addCodeBtn = document.createElement('button');
  addCodeBtn.id = 'add-code-btn';
  addCodeBtn.title = 'Insert Code Cell';
  addCodeBtn.innerHTML = '<i class="fa-solid fa-code"></i> Code';
  addCodeBtn.addEventListener('click', () => {
    const index = Number(inserter.dataset.index || '0');
    addCell('', 'js', false, [], index);
  });

  const addTextBtn = document.createElement('button');
  addTextBtn.id = 'add-text-btn';
  addTextBtn.title = 'Insert Markdown Cell';
  addTextBtn.innerHTML = '<i class="fa-brands fa-markdown"></i> Text';
  addTextBtn.addEventListener('click', () => {
    const index = Number(inserter.dataset.index || '0');
    addCell('', 'md', false, [], index);
  });

  buttonContainer.appendChild(addCodeBtn);
  buttonContainer.appendChild(addTextBtn);

  const line2 = document.createElement('div');
  line2.className = 'inserter-line';

  inserter.appendChild(line1);
  inserter.appendChild(buttonContainer);
  inserter.appendChild(line2);
  notebook?.appendChild(inserter);

  // Header Menu Event Dispatchers
  const menuEvents: Array<[string, () => void]> = [
    ['new-btn', () => {
      if (confirm('Create new empty notebook? Unsaved changes will be cleared.')) {
        while (cells.length > 0) deleteCell(cells[0].id);
        addCell('', 'js');
        showAppleToast('New notebook initialized', 'success', 'fa-sparkles');
      }
    }],
    ['download-btn', downloadNotebook],
    ['github-btn', () => windowOpen(window, rawLink, '_blank')],
    ['cut-cell-btn', cutCell],
    ['copy-cell-btn', copyCell],
    ['paste-cell-btn', pasteCell],
    ['insert-code-btn', () => insertCellBelow('js')],
    ['insert-md-btn', () => insertCellBelow('md')],
    ['insert-code-above-btn', () => insertCellAbove('js')],
    ['insert-md-above-btn', () => insertCellAbove('md')],
    ['run-all-btn', runAllCells],
    ['quick-run-all-btn', runAllCells],
    ['restart-kernel-btn', restartKernel],
    ['restart-run-all-btn', restartAndRunAll],
    ['toggle-fullscreen-btn', toggleFullscreen],
    ['toggle-line-numbers-btn', () => {
      Object.values(monacoInstances).forEach((inst) => {
        const cur = inst.getOptions().get(monaco.editor.EditorOption.lineNumbers).renderType;
        inst.updateOptions({ lineNumbers: cur === 1 ? 'off' : 'on' });
      });
      showAppleToast('Toggled line numbers', 'info', 'fa-list-ol');
    }],
  ];

  menuEvents.forEach(([id, handler]) => {
    document.getElementById(id)?.addEventListener('click', () => {
      handler();
      closeAllDropdowns();
    });
  });

  // Dropdown menu toggle handling
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const isMenuButton = target.closest('.menu-button');
    document.querySelectorAll('.menu-item').forEach((item) => {
      if (!item.contains(target)) {
        item.classList.remove('active');
      }
    });
    if (isMenuButton) {
      const menuItem = target.closest('.menu-item');
      menuItem?.classList.toggle('active');
    }
  });

  // Load Remote or Fallback Notebook Content
  try {
    const response = await fetch(rawLink);
    if (!response.ok) {
      throw new Error(`Upstream fetch status ${response.status}`);
    }
    const cellsData = parseNotebookFile(await response.text());
    if (cellsData && cellsData.length > 0) {
      for (const cellData of cellsData) {
        await addCell(
          cellData.code,
          cellData.type,
          cellData.mode === 'render',
          cellData.outputs || [],
        );
      }
      showAppleToast('Loaded upstream Gemini Cookbook', 'success', 'fa-sparkles');
    } else {
      throw new Error('No cells found in upstream');
    }
  } catch (error) {
    console.warn('Using built-in Gemini 2.5 Flash Image Starter cells:', error);
    const starterCells = getDefaultNotebookCells();
    for (const cell of starterCells) {
      await addCell(cell.code, cell.type, cell.mode === 'render');
    }
    showAppleToast('Initialized Gemini 2.5 Flash Studio', 'info', 'fa-sparkles');
  }

  // Cell Inserter Positioning Hover Listener
  notebook.addEventListener('mousemove', (e) => {
    const cellElements = Array.from(notebook.getElementsByClassName('cell'));
    const y = e.clientY;
    let closestGapIndex = 0;
    let smallestDistance = Infinity;

    if (cellElements.length > 0) {
      const firstCellRect = (cellElements[0] as HTMLElement).getBoundingClientRect();
      const distToFirst = Math.abs(y - firstCellRect.top);
      if (distToFirst < smallestDistance) {
        smallestDistance = distToFirst;
        closestGapIndex = 0;
      }
    } else {
      smallestDistance = 24;
      closestGapIndex = 0;
    }

    cellElements.forEach((cell, i) => {
      const rect = (cell as HTMLElement).getBoundingClientRect();
      const distance = Math.abs(y - rect.bottom);
      if (distance < smallestDistance) {
        smallestDistance = distance;
        closestGapIndex = i + 1;
      }
    });

    if (smallestDistance < 25) {
      let topPosition = 0;
      if (cellElements.length === 0) {
        topPosition =
          notebook.getBoundingClientRect().top +
          window.scrollY -
          inserter.offsetHeight / 2;
      } else if (closestGapIndex === 0) {
        topPosition =
          (cellElements[0] as HTMLElement).offsetTop -
          inserter.offsetHeight / 2;
      } else if (closestGapIndex > 0 && cellElements[closestGapIndex - 1]) {
        const targetCell = cellElements[closestGapIndex - 1] as HTMLElement;
        topPosition =
          targetCell.offsetTop +
          targetCell.offsetHeight -
          inserter.offsetHeight / 2;
      }
      inserter.style.top = `${Math.max(0, topPosition)}px`;
      inserter.dataset.index = `${closestGapIndex}`;
      inserter.style.display = 'flex';
    } else {
      inserter.style.display = 'none';
    }
  });

  notebook.addEventListener('mouseleave', (e) => {
    if (
      e.relatedTarget &&
      (e.relatedTarget as HTMLElement).closest &&
      (e.relatedTarget as HTMLElement).closest('#cell-inserter')
    ) {
      return;
    }
    inserter.style.display = 'none';
  });

  inserter.addEventListener('mouseleave', (e) => {
    if (
      e.relatedTarget === notebook ||
      (e.relatedTarget as HTMLElement).closest('.cell')
    ) {
      return;
    }
    inserter.style.display = 'none';
  });

  // Sortable Drag & Drop Reordering
  new Sortable(notebook, {
    animation: 200,
    handle: '.drag-handle',
    ghostClass: 'sortable-ghost',
    chosenClass: 'sortable-chosen',
    onEnd: (evt: SortableEvent) => {
      if (
        evt.oldIndex !== undefined &&
        evt.newIndex !== undefined &&
        evt.oldIndex !== evt.newIndex
      ) {
        const [movedItem] = cells.splice(evt.oldIndex, 1);
        cells.splice(evt.newIndex, 0, movedItem);
        showAppleToast('Cell reordered', 'info', 'fa-grip-vertical');
      }
    },
  });

  updateSystemStatus('Kernel Ready', 'ready');
}

// Start application
initializeStudio().catch((err) => {
  console.error('Fatal initialization error:', err);
});

export {};
