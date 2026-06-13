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

// ── HEIC Helpers ──
const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp|tiff?|heic|heif|avif|svg)$/i;

function isHeic(file) {
  return /\.(heic|heif)$/i.test(file.name) ||
         file.type === 'image/heic' ||
         file.type === 'image/heif';
}

// Strategy 1: native browser (macOS, Windows with HEIC codec)
async function convertViaCanvas(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (!img.naturalWidth) return reject(new Error('zero size'));
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);
      canvas.toBlob(blob => {
        if (!blob) return reject(new Error('blob 생성 실패'));
        const name = file.name.replace(/\.(heic|heif)$/i, '.jpg');
        resolve(new File([blob], name, { type: 'image/jpeg' }));
      }, 'image/jpeg', 0.95);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('브라우저 미지원')); };
    img.src = url;
  });
}

// Strategy 2: libheif-js WASM (supports modern iPhone HEIC/HDR profiles)
let _libheifMod = null;
async function initLibheif() {
  if (_libheifMod) return _libheifMod;
  if (typeof libheif === 'undefined') throw new Error('libheif 로드 안됨');
  // libheif-js uses Emscripten MODULARIZE=1, so libheif is a factory function
  _libheifMod = typeof libheif === 'function' ? await libheif() : libheif;
  if (!_libheifMod?.HeifDecoder) throw new Error('HeifDecoder 없음');
  return _libheifMod;
}

async function convertViaLibheif(file) {
  const heif = await initLibheif();
  const buf = await file.arrayBuffer();
  const decoder = new heif.HeifDecoder();
  const images = decoder.decode(new Uint8Array(buf));
  if (!images?.length) throw new Error('이미지 없음');
  const src = images[0];
  const w = src.get_width(), h = src.get_height();
  const pixels = await new Promise((res, rej) => {
    src.display({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }, d => {
      d ? res(d) : rej(new Error('픽셀 디코딩 실패'));
    });
  });
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').putImageData(new ImageData(pixels.data, w, h), 0, 0);
  return new Promise((res, rej) => canvas.toBlob(
    b => b
      ? res(new File([b], file.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' }))
      : rej(new Error('blob 실패')),
    'image/jpeg', 0.95
  ));
}

async function convertHeicToJpeg(file) {
  // 1. Native browser HEIC support
  try { return await convertViaCanvas(file); } catch (e1) {
    console.warn('[HEIC] native 실패:', e1.message);
  }
  // 2. libheif-js WASM (supports HDR/tmap, heix, modern profiles)
  try { return await convertViaLibheif(file); } catch (e2) {
    console.warn('[HEIC] libheif-js 실패:', e2.message);
  }
  // 3. heic2any (legacy fallback)
  if (typeof heic2any !== 'undefined') {
    try {
      const r = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.95 });
      const b = Array.isArray(r) ? r[0] : r;
      return new File([b], file.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' });
    } catch (e3) {
      console.warn('[HEIC] heic2any 실패:', e3.message || e3);
    }
  }
  throw new Error('HDR HEIC 변환 실패 — F12 콘솔에서 상세 오류 확인');
}

// ── File Handling ──
async function addFiles(fileList) {
  // Accept image/* types OR any common image extension (covers HEIC with empty MIME type)
  const files = Array.from(fileList).filter(f =>
    f.type.startsWith('image/') || IMAGE_EXT.test(f.name)
  );
  if (!files.length) return;

  // Add all files immediately; HEIC ones start in 'converting' state
  const newItems = files.map(file => ({
    id: crypto.randomUUID(),
    file,
    previewUrl: isHeic(file) ? '' : URL.createObjectURL(file),
    status: isHeic(file) ? 'converting' : 'pending',
    progress: 0,
    result: null,
    errorMsg: '',
    customName: null,
    aiLoading: false
  }));

  state.images.push(...newItems);
  renderList();
  updateControls();

  // Convert HEIC files in background
  for (const item of newItems.filter(i => i.status === 'converting')) {
    try {
      const converted = await convertHeicToJpeg(item.file);
      item.file = converted;
      item.previewUrl = URL.createObjectURL(converted);
      item.status = 'pending';
    } catch (err) {
      item.status = 'error';
      item.errorMsg = 'HEIC 변환 실패: ' + (err.message || err);
    }
    updateItemEl(item);
  }

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

function nameHTML(img) {
  if (img.customName) {
    return `<span class="ai-name-tag">✨</span>${esc(img.customName)}`;
  }
  return esc(img.file.name);
}

function itemHTML(img) {
  const thumb = img.previewUrl
    ? `<img class="thumb" src="${img.previewUrl}" alt="${esc(img.file.name)}">`
    : `<div class="thumb thumb-placeholder">⏳</div>`;
  return `
    <div class="image-item" id="item-${img.id}">
      ${thumb}
      <div class="item-info">
        <div class="item-name" title="${esc(img.customName || img.file.name)}">${nameHTML(img)}</div>
        <div class="progress-wrap">
          <div class="progress-bar ${img.status}" style="width:${img.progress}%"></div>
        </div>
        <div class="item-status ${img.status}">${statusText(img)}</div>
      </div>
      <div class="item-action">${actionHTML(img)}</div>
    </div>`;
}

function actionHTML(img) {
  const hasKey = !!getApiKey();
  const aiBtn = hasKey
    ? `<button class="btn-icon ai-btn${img.aiLoading ? ' spinning' : ''}" title="AI 파일명 분석"
        onclick="analyzeImageName('${img.id}')"
        ${img.aiLoading || img.status === 'processing' ? 'disabled' : ''}>✨</button>`
    : '';

  if (img.status === 'done') {
    return aiBtn + `<button class="btn-icon" title="다운로드" onclick="downloadSingle('${img.id}')">⬇️</button>`;
  }
  if (img.status === 'processing') {
    return aiBtn + `<span class="btn-icon spinning">⟳</span>`;
  }
  return aiBtn + `<button class="btn-icon remove" title="제거" onclick="removeImage('${img.id}')">✕</button>`;
}

function statusText(img) {
  if (img.status === 'converting') return 'HEIC 변환 중...';
  if (img.status === 'pending')    return '대기 중';
  if (img.status === 'processing') return `처리 중... ${img.progress}%`;
  if (img.status === 'done')       return '완료';
  if (img.status === 'error')      return img.errorMsg || '오류 발생';
  return '';
}

function updateItemEl(img) {
  const el = document.getElementById(`item-${img.id}`);
  if (!el) return;

  // Replace placeholder thumb once HEIC conversion is done
  const thumbEl = el.querySelector('.thumb-placeholder');
  if (thumbEl && img.previewUrl) {
    const img2 = document.createElement('img');
    img2.className = 'thumb';
    img2.alt = img.file.name;
    img2.src = img.previewUrl;
    thumbEl.replaceWith(img2);
  }

  el.querySelector('.progress-bar').style.width = img.progress + '%';
  el.querySelector('.progress-bar').className = `progress-bar ${img.status}`;
  const statusEl = el.querySelector('.item-status');
  statusEl.textContent = statusText(img);
  statusEl.className = `item-status ${img.status}`;
  el.querySelector('.item-action').innerHTML = actionHTML(img);
  const nameEl = el.querySelector('.item-name');
  if (nameEl) {
    nameEl.title = img.customName || img.file.name;
    nameEl.innerHTML = nameHTML(img);
  }
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
  const name = img.customName
    ? `${img.customName}.${ext}`
    : img.file.name.replace(/\.[^.]+$/, '') + '_resized.' + ext;
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
      const name = img.customName
        ? `${img.customName}.${ext}`
        : img.file.name.replace(/\.[^.]+$/, '') + '_resized.' + ext;
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

// ── API Key ──
function getApiKey() {
  return localStorage.getItem('gemini_api_key') || '';
}

async function fetchGeminiModels() {
  const apiKey = getApiKey();
  const modelSelect  = document.getElementById('ai-model-select');
  const refreshBtn   = document.getElementById('ai-model-refresh');
  const statusEl     = document.getElementById('api-key-status');
  if (!apiKey || !modelSelect) return;

  modelSelect.disabled = true;
  modelSelect.innerHTML = '<option value="">불러오는 중...</option>';
  if (refreshBtn) refreshBtn.classList.add('spinning');

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=200`
    );

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      const msg = errData.error?.message || `HTTP ${resp.status}`;
      throw new Error(msg);
    }

    const data = await resp.json();
    const models = (data.models || [])
      .filter(m =>
        Array.isArray(m.supportedGenerationMethods) &&
        m.supportedGenerationMethods.includes('generateContent') &&
        m.name.includes('gemini')
      )
      .sort((a, b) => b.name.localeCompare(a.name));

    if (models.length === 0) {
      modelSelect.innerHTML = '<option value="">사용 가능한 모델 없음</option>';
      return;
    }

    const savedModel = localStorage.getItem('gemini_model') || 'models/gemini-2.0-flash';
    modelSelect.innerHTML = models
      .map(m => `<option value="${m.name}"${m.name === savedModel ? ' selected' : ''}>${m.displayName || m.name}</option>`)
      .join('');

    if (!models.find(m => m.name === savedModel)) {
      modelSelect.value = models[0].name;
      localStorage.setItem('gemini_model', models[0].name);
    }

    modelSelect.disabled = false;
    if (statusEl) {
      statusEl.textContent = `✓ API 키 저장됨 (모델 ${models.length}개)`;
      statusEl.className = 'ai-key-status saved';
    }
  } catch (e) {
    modelSelect.innerHTML = '<option value="">로드 실패</option>';
    if (statusEl) {
      statusEl.textContent = '오류: ' + e.message;
      statusEl.className = 'ai-key-status';
      statusEl.style.color = 'var(--error)';
    }
  } finally {
    if (refreshBtn) refreshBtn.classList.remove('spinning');
  }
}

function initApiKeyUI() {
  const input       = document.getElementById('api-key-input');
  const statusEl    = document.getElementById('api-key-status');
  const saveBtn     = document.getElementById('api-key-save-btn');
  const modelSelect = document.getElementById('ai-model-select');
  const refreshBtn  = document.getElementById('ai-model-refresh');

  const saved = getApiKey();
  if (saved) {
    input.value = saved;
    statusEl.textContent = '✓ API 키 저장됨';
    statusEl.className = 'ai-key-status saved';
    fetchGeminiModels();
  }

  saveBtn.addEventListener('click', () => {
    const key = input.value.trim();
    if (key) {
      localStorage.setItem('gemini_api_key', key);
      statusEl.textContent = '저장됨 — 모델 목록 불러오는 중...';
      statusEl.className = 'ai-key-status saved';
      statusEl.style.color = '';
      fetchGeminiModels();
    } else {
      localStorage.removeItem('gemini_api_key');
      localStorage.removeItem('gemini_model');
      statusEl.textContent = '';
      statusEl.className = 'ai-key-status';
      statusEl.style.color = '';
      if (modelSelect) {
        modelSelect.innerHTML = '<option value="">— API 키를 먼저 저장하세요 —</option>';
        modelSelect.disabled = true;
      }
    }
    renderList();
  });

  if (modelSelect) {
    modelSelect.addEventListener('change', () => {
      localStorage.setItem('gemini_model', modelSelect.value);
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      if (getApiKey()) fetchGeminiModels();
    });
  }
}

// ── AI Image Analysis (Gemini) ──
async function imgToBase64(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const maxSize = 768;
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1]);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

async function callGeminiVision(base64Data) {
  const apiKey = getApiKey();
  const modelSelect = document.getElementById('ai-model-select');
  const modelName = modelSelect?.value || localStorage.getItem('gemini_model') || 'models/gemini-2.0-flash';
  if (modelSelect?.value) localStorage.setItem('gemini_model', modelSelect.value);

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: 'image/jpeg', data: base64Data } },
            { text: '이 이미지에 어울리는 파일명을 추천해줘. 규칙: 영소문자와 하이픈(-)만 사용, 2~4단어, 확장자 없이, 파일명만 답해줘. 예: "golden-retriever-puppy"' }
          ]
        }],
        generationConfig: { maxOutputTokens: 60, temperature: 0.2 }
      })
    }
  );

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `API 오류 (${resp.status})`);
  }

  const data = await resp.json();
  return (data.candidates?.[0]?.content?.parts?.[0]?.text || '')
    .trim()
    .toLowerCase()
    .replace(/"/g, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || 'unnamed';
}

async function analyzeImageName(id) {
  const img = state.images.find(i => i.id === id);
  if (!img || !getApiKey()) return;

  img.aiLoading = true;
  updateItemEl(img);

  try {
    const base64 = await imgToBase64(img.file);
    if (!base64) throw new Error('이미지 변환 실패');
    img.customName = await callGeminiVision(base64);
  } catch (err) {
    const el = document.getElementById(`item-${img.id}`);
    if (el) {
      const s = el.querySelector('.item-status');
      if (s) {
        const prev = { text: s.textContent, cls: s.className };
        s.textContent = '분석 실패: ' + (err.message || '오류');
        s.className = 'item-status error';
        setTimeout(() => { s.textContent = prev.text; s.className = prev.cls; }, 3000);
      }
    }
  } finally {
    img.aiLoading = false;
    updateItemEl(img);
  }
}

// Global handlers for inline onclick
window.downloadSingle = downloadSingle;
window.analyzeImageName = analyzeImageName;
window.removeImage = function(id) {
  const idx = state.images.findIndex(i => i.id === id);
  if (idx === -1) return;
  URL.revokeObjectURL(state.images[idx].previewUrl);
  state.images.splice(idx, 1);
  renderList();
  updateControls();
};

initApiKeyUI();
