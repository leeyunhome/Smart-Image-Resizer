'use strict';

const state = {
  images: [],
  settings: {
    ratio: '1:1',
    customW: 1,
    customH: 1,
    mode: 'padding',
    padColor: '#ffffff',
    resMode: 'original',
    resW: null,
    resH: null
  },
  isProcessing: false
};

// ── DOM References ──
const uploadArea    = document.getElementById('upload-area');
const uploadBtn     = document.getElementById('upload-btn');
const fileInput     = document.getElementById('file-input');
const imageListEl   = document.getElementById('image-list');
const processBtn    = document.getElementById('process-btn');
const downloadAllBtn= document.getElementById('download-all-btn');
const countBadgeEl  = document.getElementById('count-badge');
const emptyStateEl  = document.getElementById('empty-state');
const ratioBtns     = document.querySelectorAll('.ratio-btn');
const modeBtns      = document.querySelectorAll('.mode-btn');
const customRatioEl = document.getElementById('custom-ratio');
const customWEl     = document.getElementById('custom-w');
const customHEl     = document.getElementById('custom-h');
const colorRowEl    = document.getElementById('color-row');
const padColorEl    = document.getElementById('pad-color');
const resBtns       = document.querySelectorAll('.res-btn');
const resCustomPanel= document.getElementById('res-custom-panel');
const resPresetEl   = document.getElementById('res-preset');
const resWEl        = document.getElementById('res-w');
const resHEl        = document.getElementById('res-h');

// ── Upload Events ──
uploadBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  fileInput.click();
});
uploadArea.addEventListener('click', () => fileInput.click());

uploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadArea.classList.add('drag-over');
});
uploadArea.addEventListener('dragleave', (e) => {
  if (!uploadArea.contains(e.relatedTarget)) {
    uploadArea.classList.remove('drag-over');
  }
});
uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.classList.remove('drag-over');
  addFiles(e.dataTransfer.files);
});
fileInput.addEventListener('change', (e) => {
  addFiles(e.target.files);
  fileInput.value = '';
});

// ── Settings Events ──
ratioBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    ratioBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.settings.ratio = btn.dataset.ratio;
    customRatioEl.classList.toggle('visible', btn.dataset.ratio === 'custom');
  });
});

modeBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    modeBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.settings.mode = btn.dataset.mode;
    colorRowEl.classList.toggle('visible', btn.dataset.mode === 'padding');
  });
});

customWEl.addEventListener('input', () => {
  state.settings.customW = parseInt(customWEl.value) || 1;
});
customHEl.addEventListener('input', () => {
  state.settings.customH = parseInt(customHEl.value) || 1;
});
padColorEl.addEventListener('input', () => {
  state.settings.padColor = padColorEl.value;
});

// ── Resolution Events ──
resBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    resBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.settings.resMode = btn.dataset.res;
    resCustomPanel.classList.toggle('visible', btn.dataset.res === 'custom');
  });
});

resPresetEl.addEventListener('change', () => {
  const val = resPresetEl.value;
  if (!val) return;
  const [w, h] = val.split(',').map(Number);
  resWEl.value = w;
  resHEl.value = h;
  state.settings.resW = w;
  state.settings.resH = h;
  syncRatioToResolution(w, h);
});

resWEl.addEventListener('input', () => {
  state.settings.resW = parseInt(resWEl.value) || null;
  resPresetEl.value = '';
});
resHEl.addEventListener('input', () => {
  state.settings.resH = parseInt(resHEl.value) || null;
  resPresetEl.value = '';
});

processBtn.addEventListener('click', processAll);
downloadAllBtn.addEventListener('click', downloadAll);

// ── File Handling ──
function addFiles(fileList) {
  const images = Array.from(fileList).filter(f => f.type.startsWith('image/'));
  images.forEach(file => {
    state.images.push({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'pending',
      progress: 0,
      result: null,
      errorMsg: ''
    });
  });
  renderList();
  updateControls();
}

// ── Rendering ──
function renderList() {
  if (state.images.length === 0) {
    imageListEl.innerHTML = '';
    emptyStateEl.style.display = 'block';
    return;
  }
  emptyStateEl.style.display = 'none';
  imageListEl.innerHTML = state.images.map(itemHTML).join('');
}

function itemHTML(img) {
  return `
    <div class="image-item" id="item-${img.id}">
      <img class="thumb" src="${img.previewUrl}" alt="${esc(img.file.name)}">
      <div class="item-info">
        <div class="item-name" title="${esc(img.file.name)}">${esc(img.file.name)}</div>
        <div class="progress-wrap">
          <div class="progress-bar ${img.status}" style="width:${img.progress}%"></div>
        </div>
        <div class="item-status ${img.status}">${statusText(img)}</div>
      </div>
      <div class="item-action">${actionHTML(img)}</div>
    </div>`;
}

function actionHTML(img) {
  if (img.status === 'done') {
    return `<button class="btn-icon" title="다운로드" onclick="downloadSingle('${img.id}')">⬇️</button>`;
  }
  if (img.status === 'processing') {
    return `<span class="btn-icon spinning">⟳</span>`;
  }
  return `<button class="btn-icon remove" title="제거" onclick="removeImage('${img.id}')">✕</button>`;
}

function statusText(img) {
  if (img.status === 'pending')    return '대기 중';
  if (img.status === 'processing') return `처리 중... ${img.progress}%`;
  if (img.status === 'done')       return '완료';
  if (img.status === 'error')      return img.errorMsg || '오류 발생';
  return '';
}

function updateItemEl(img) {
  const el = document.getElementById(`item-${img.id}`);
  if (!el) return;
  el.querySelector('.progress-bar').style.width = img.progress + '%';
  el.querySelector('.progress-bar').className = `progress-bar ${img.status}`;
  const statusEl = el.querySelector('.item-status');
  statusEl.textContent = statusText(img);
  statusEl.className = `item-status ${img.status}`;
  el.querySelector('.item-action').innerHTML = actionHTML(img);
}

function updateControls() {
  const total = state.images.length;
  const doneCount = state.images.filter(i => i.status === 'done').length;
  countBadgeEl.textContent = total > 0 ? `(${total}개)` : '';
  processBtn.disabled  = state.isProcessing || total === 0;
  downloadAllBtn.disabled = doneCount === 0;
}

// ── Processing ──
async function processAll() {
  state.isProcessing = true;
  processBtn.textContent = '처리 중...';
  updateControls();

  const queue = state.images.filter(i => i.status !== 'done');
  await Promise.all(queue.map(img => processImage(img)));

  state.isProcessing = false;
  processBtn.textContent = '처리 시작';
  updateControls();
}

function processImage(imgData) {
  imgData.status = 'processing';
  imgData.progress = 5;
  updateItemEl(imgData);

  return new Promise((resolve) => {
    const image = new Image();

    image.onload = () => {
      const interval = setInterval(() => {
        if (imgData.progress < 80) {
          imgData.progress += 12;
          updateItemEl(imgData);
        }
      }, 80);

      try {
        const { canvasW, canvasH } = getOutputDimensions(image.naturalWidth, image.naturalHeight);

        const canvas = document.createElement('canvas');
        canvas.width  = canvasW;
        canvas.height = canvasH;
        const ctx = canvas.getContext('2d');

        if (state.settings.mode === 'padding') {
          // Scale to fit, center with padding
          const scale = Math.min(canvasW / image.naturalWidth, canvasH / image.naturalHeight);
          const dw = Math.round(image.naturalWidth  * scale);
          const dh = Math.round(image.naturalHeight * scale);
          const dx = Math.round((canvasW - dw) / 2);
          const dy = Math.round((canvasH - dh) / 2);
          ctx.fillStyle = state.settings.padColor;
          ctx.fillRect(0, 0, canvasW, canvasH);
          ctx.drawImage(image, dx, dy, dw, dh);
        } else {
          // Scale to fill, center crop (overflow clipped by canvas)
          const scale = Math.max(canvasW / image.naturalWidth, canvasH / image.naturalHeight);
          const dw = Math.round(image.naturalWidth  * scale);
          const dh = Math.round(image.naturalHeight * scale);
          const dx = Math.round((canvasW - dw) / 2);
          const dy = Math.round((canvasH - dh) / 2);
          ctx.drawImage(image, dx, dy, dw, dh);
        }

        clearInterval(interval);
        imgData.result   = canvas.toDataURL(isPng(imgData.file) ? 'image/png' : 'image/jpeg', 0.95);
        imgData.progress = 100;
        imgData.status   = 'done';
      } catch (err) {
        clearInterval(interval);
        imgData.status   = 'error';
        imgData.errorMsg = err.message;
      }

      updateItemEl(imgData);
      updateControls();
      resolve();
    };

    image.onerror = () => {
      imgData.status   = 'error';
      imgData.errorMsg = '이미지 로드 실패';
      updateItemEl(imgData);
      updateControls();
      resolve();
    };

    image.src = imgData.previewUrl;
  });
}

function getOutputDimensions(srcW, srcH) {
  if (state.settings.resMode === 'custom' &&
      state.settings.resW > 0 && state.settings.resH > 0) {
    return { canvasW: state.settings.resW, canvasH: state.settings.resH };
  }
  return calcCanvasSize(srcW, srcH, ...getRatioValues());
}

// Preserve original pixel area while applying target aspect ratio
function calcCanvasSize(srcW, srcH, ratioW, ratioH) {
  const area   = srcW * srcH;
  const aspect = ratioW / ratioH;
  return {
    canvasW: Math.round(Math.sqrt(area * aspect)),
    canvasH: Math.round(Math.sqrt(area / aspect))
  };
}

function gcd(a, b) { return b === 0 ? a : gcd(b, a % b); }

function syncRatioToResolution(w, h) {
  const g = gcd(w, h);
  const rw = w / g, rh = h / g;
  const key = `${rw}:${rh}`;
  const standard = ['1:1', '3:4', '4:3', '9:16', '16:9'];

  ratioBtns.forEach(b => b.classList.remove('active'));

  if (standard.includes(key)) {
    const match = [...ratioBtns].find(b => b.dataset.ratio === key);
    if (match) match.classList.add('active');
    state.settings.ratio = key;
    customRatioEl.classList.remove('visible');
  } else {
    const custom = [...ratioBtns].find(b => b.dataset.ratio === 'custom');
    if (custom) custom.classList.add('active');
    state.settings.ratio = 'custom';
    state.settings.customW = rw;
    state.settings.customH = rh;
    customWEl.value = rw;
    customHEl.value = rh;
    customRatioEl.classList.add('visible');
  }
}

function getRatioValues() {
  if (state.settings.ratio === 'custom') {
    return [Math.max(1, state.settings.customW), Math.max(1, state.settings.customH)];
  }
  return state.settings.ratio.split(':').map(Number);
}

function isPng(file) {
  return file.type === 'image/png';
}

// ── Downloads ──
function downloadSingle(id) {
  const img = state.images.find(i => i.id === id);
  if (!img?.result) return;
  const ext  = isPng(img.file) ? 'png' : 'jpg';
  const name = img.file.name.replace(/\.[^.]+$/, '') + '_resized.' + ext;
  triggerDownload(img.result, name);
}

async function downloadAll() {
  const done = state.images.filter(i => i.status === 'done' && i.result);
  if (!done.length) return;

  const origLabel = downloadAllBtn.textContent;
  downloadAllBtn.disabled = true;
  downloadAllBtn.textContent = '압축 중...';

  try {
    const zip = new JSZip();
    done.forEach(img => {
      const ext  = isPng(img.file) ? 'png' : 'jpg';
      const name = img.file.name.replace(/\.[^.]+$/, '') + '_resized.' + ext;
      zip.file(name, img.result.split(',')[1], { base64: true });
    });
    const blob = await zip.generateAsync({ type: 'blob' });
    const url  = URL.createObjectURL(blob);
    triggerDownload(url, 'resized_images.zip');
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } finally {
    downloadAllBtn.textContent = origLabel;
    updateControls();
  }
}

function triggerDownload(href, filename) {
  const a = document.createElement('a');
  a.href     = href;
  a.download = filename;
  a.click();
}

// ── Utilities ──
function esc(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Global handlers for inline onclick
window.downloadSingle = downloadSingle;
window.removeImage = function(id) {
  const idx = state.images.findIndex(i => i.id === id);
  if (idx === -1) return;
  URL.revokeObjectURL(state.images[idx].previewUrl);
  state.images.splice(idx, 1);
  renderList();
  updateControls();
};
