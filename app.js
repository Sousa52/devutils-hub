/* ============================================================
   DevUtils Hub — app.js
   All tool logic, routing, and state management
   ============================================================ */

'use strict';

// ── State ──────────────────────────────────────────────────
const State = {
  theme: localStorage.getItem('duh-theme') || 'dark',
  activeTool: localStorage.getItem('duh-tool') || 'json',
  sidebarOpen: false,
};

// ── Theme ──────────────────────────────────────────────────
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = theme === 'dark' ? '☀' : '🌙';
  State.theme = theme;
  localStorage.setItem('duh-theme', theme);
}

function toggleTheme() {
  applyTheme(State.theme === 'dark' ? 'light' : 'dark');
}

// ── Toast ──────────────────────────────────────────────────
let toastTimer;
function toast(msg, duration = 2000) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), duration);
}

// ── Copy utility ──────────────────────────────────────────
async function copyText(text, label = 'Copied!') {
  try {
    await navigator.clipboard.writeText(text);
    toast('✓ ' + label);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    toast('✓ ' + label);
  }
}

// ── Download utility ──────────────────────────────────────
function downloadFile(content, filename, mime = 'text/plain') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: mime }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Sidebar / Routing ─────────────────────────────────────
function navigate(toolId) {
  // Deactivate all
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tool-panel').forEach(el => el.classList.remove('active'));

  // Activate selected
  const navEl = document.querySelector(`[data-tool="${toolId}"]`);
  const panelEl = document.getElementById(`tool-${toolId}`);
  if (navEl) navEl.classList.add('active');
  if (panelEl) panelEl.classList.add('active');

  State.activeTool = toolId;
  localStorage.setItem('duh-tool', toolId);

  // Close sidebar on mobile
  closeSidebar();

  // Run tool init if needed
  if (toolInits[toolId]) toolInits[toolId]();
}

function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebar-overlay').classList.add('show');
  State.sidebarOpen = true;
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('show');
  State.sidebarOpen = false;
}

function toggleSidebar() {
  State.sidebarOpen ? closeSidebar() : openSidebar();
}

// ── Tool Inits (run on first navigation) ──────────────────
const toolInits = {};
const toolInitDone = {};
function registerInit(toolId, fn) {
  toolInits[toolId] = () => {
    if (!toolInitDone[toolId]) {
      fn();
      toolInitDone[toolId] = true;
    }
  };
}

// ════════════════════════════════════════════════════════════
// TOOL: JSON Formatter
// ════════════════════════════════════════════════════════════
function initJson() {
  const input = document.getElementById('json-input');
  const output = document.getElementById('json-output');
  const status = document.getElementById('json-status');
  let currentData = null;
  let viewMode = 'pretty';

  function setStatus(type, msg) {
    status.className = 'status-bar ' + type;
    status.textContent = msg;
  }

  function parseInput() {
    try {
      currentData = JSON.parse(input.value.trim());
      return true;
    } catch (e) {
      setStatus('error', '✗ Invalid JSON — ' + e.message);
      currentData = null;
      return false;
    }
  }

  function formatPretty() {
    if (!parseInput()) return;
    viewMode = 'pretty';
    output.textContent = JSON.stringify(currentData, null, 2);
    setStatus('success', '✓ Valid JSON • ' + countStats(currentData));
  }

  function formatMinify() {
    if (!parseInput()) return;
    viewMode = 'minify';
    output.textContent = JSON.stringify(currentData);
    setStatus('success', '✓ Minified');
  }

  function countStats(data) {
    const str = JSON.stringify(data);
    return `${str.length} chars`;
  }

  function toTree() {
    if (!parseInput()) return;
    viewMode = 'tree';
    output.innerHTML = buildTree(currentData);
    setStatus('success', '✓ Tree view');
  }

  function buildTree(data, depth = 0) {
    if (data === null) return `<span class="json-null">null</span>`;
    if (typeof data === 'boolean') return `<span class="json-bool">${data}</span>`;
    if (typeof data === 'number') return `<span class="json-number">${data}</span>`;
    if (typeof data === 'string') return `<span class="json-string">"${escHtml(data)}"</span>`;
    if (Array.isArray(data)) {
      if (data.length === 0) return `<span style="color:var(--text-muted)">[]</span>`;
      const items = data.map((v, i) =>
        `<div style="margin-left:${(depth + 1) * 16}px"><span class="json-key">${i}</span>: ${buildTree(v, depth + 1)}</div>`
      ).join('');
      return `<details open><summary style="color:var(--text-muted);cursor:pointer">Array[${data.length}]</summary>${items}</details>`;
    }
    if (typeof data === 'object') {
      const keys = Object.keys(data);
      if (keys.length === 0) return `<span style="color:var(--text-muted)">{}</span>`;
      const items = keys.map(k =>
        `<div style="margin-left:${(depth + 1) * 16}px"><span class="json-key">"${escHtml(k)}"</span>: ${buildTree(data[k], depth + 1)}</div>`
      ).join('');
      return `<details open><summary style="color:var(--text-muted);cursor:pointer">Object{${keys.length}}</summary>${items}</details>`;
    }
    return String(data);
  }

  function toYaml() {
    if (!parseInput()) return;
    output.textContent = jsonToYaml(currentData, 0);
    setStatus('success', '✓ Converted to YAML');
  }

  function jsonToYaml(data, indent) {
    const pad = '  '.repeat(indent);
    if (data === null) return 'null';
    if (typeof data === 'boolean' || typeof data === 'number') return String(data);
    if (typeof data === 'string') return data.includes('\n') ? `|\n${data.split('\n').map(l => pad + '  ' + l).join('\n')}` : data;
    if (Array.isArray(data)) {
      return data.map(v => `${pad}- ${jsonToYaml(v, indent + 1)}`).join('\n');
    }
    return Object.entries(data).map(([k, v]) => {
      const val = jsonToYaml(v, indent + 1);
      return typeof v === 'object' && v !== null
        ? `${pad}${k}:\n${val}`
        : `${pad}${k}: ${val}`;
    }).join('\n');
  }

  function validate() {
    if (!input.value.trim()) { setStatus('info', 'Enter JSON to validate'); return; }
    parseInput();
    if (currentData !== null) setStatus('success', '✓ Valid JSON');
  }

  document.getElementById('json-pretty').addEventListener('click', formatPretty);
  document.getElementById('json-minify').addEventListener('click', formatMinify);
  document.getElementById('json-validate').addEventListener('click', validate);
  document.getElementById('json-tree').addEventListener('click', toTree);
  document.getElementById('json-yaml').addEventListener('click', toYaml);
  document.getElementById('json-copy').addEventListener('click', () => copyText(output.textContent || output.innerText));
  document.getElementById('json-download').addEventListener('click', () => {
    const content = output.textContent || output.innerText;
    if (content) downloadFile(content, viewMode === 'yaml' ? 'output.yaml' : 'output.json', 'application/json');
  });
  document.getElementById('json-clear').addEventListener('click', () => {
    input.value = '';
    output.textContent = '';
    status.className = 'status-bar';
    status.textContent = '';
  });

  input.addEventListener('input', () => {
    if (input.value.trim()) validate();
  });
}
registerInit('json', initJson);

// ════════════════════════════════════════════════════════════
// TOOL: Password Generator
// ════════════════════════════════════════════════════════════
function initPassword() {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const nums  = '0123456789';
  const syms  = '!@#$%^&*()_+-=[]{}|;:,.<>?';

  function generate() {
    const len     = parseInt(document.getElementById('pass-length').value) || 16;
    const useUpper = document.getElementById('pass-upper').checked;
    const useLower = document.getElementById('pass-lower').checked;
    const useNums  = document.getElementById('pass-nums').checked;
    const useSyms  = document.getElementById('pass-syms').checked;
    const isPhrase = document.getElementById('pass-phrase').checked;

    document.getElementById('pass-len-val').textContent = len;

    if (isPhrase) {
      const words = ['correct','horse','battery','staple','cloud','river','forest','mountain','ocean','thunder','pixel','matrix','quantum','vector','cipher','nexus','prism','echo','nova','spark'];
      const count = Math.max(3, Math.round(len / 6));
      const pw = Array.from({length: count}, () => words[Math.floor(Math.random() * words.length)]).join('-');
      setPassword(pw);
      return;
    }

    let chars = useLower ? lower : '';
    if (useUpper) chars += upper;
    if (useNums)  chars += nums;
    if (useSyms)  chars += syms;
    if (!chars)   { chars = lower; }

    const arr = new Uint32Array(len);
    crypto.getRandomValues(arr);
    const pw = Array.from(arr).map(n => chars[n % chars.length]).join('');
    setPassword(pw);
  }

  function setPassword(pw) {
    document.getElementById('pass-output').textContent = pw;
    updateStrength(pw);
    updateEntropy(pw);
  }

  function updateStrength(pw) {
    const bar   = document.getElementById('strength-fill');
    const label = document.getElementById('strength-label');
    let score = 0;
    if (pw.length >= 8)  score++;
    if (pw.length >= 12) score++;
    if (pw.length >= 16) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[a-z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;

    const levels = [
      { pct:10,  color:'#ff4757', text:'Very Weak' },
      { pct:25,  color:'#ff6348', text:'Weak'      },
      { pct:45,  color:'#ffd32a', text:'Fair'      },
      { pct:65,  color:'#7bed9f', text:'Good'      },
      { pct:85,  color:'#2ed573', text:'Strong'    },
      { pct:100, color:'#00ff88', text:'Very Strong'},
    ];
    const lv = levels[Math.min(score, 5)];
    bar.style.width = lv.pct + '%';
    bar.style.background = lv.color;
    label.textContent = lv.text;
    label.style.color = lv.color;
  }

  function updateEntropy(pw) {
    const chars = new Set(pw).size;
    const entropy = (Math.log2(chars || 1) * pw.length).toFixed(1);
    document.getElementById('pass-entropy').textContent = entropy + ' bits';
  }

  document.getElementById('pass-generate').addEventListener('click', generate);
  document.getElementById('pass-copy').addEventListener('click', () => {
    const pw = document.getElementById('pass-output').textContent;
    if (pw) copyText(pw);
  });
  document.getElementById('pass-length').addEventListener('input', generate);
  document.getElementById('pass-upper').addEventListener('change', generate);
  document.getElementById('pass-lower').addEventListener('change', generate);
  document.getElementById('pass-nums').addEventListener('change', generate);
  document.getElementById('pass-syms').addEventListener('change', generate);
  document.getElementById('pass-phrase').addEventListener('change', generate);

  generate();
}
registerInit('password', initPassword);

// ════════════════════════════════════════════════════════════
// TOOL: Encode / Decode
// ════════════════════════════════════════════════════════════
function initEncode() {
  function doEncode(mode) {
    const input = document.getElementById('enc-input').value;
    let out = '';
    try {
      switch (mode) {
        case 'b64e': out = btoa(unescape(encodeURIComponent(input))); break;
        case 'b64d': out = decodeURIComponent(escape(atob(input.trim()))); break;
        case 'urle': out = encodeURIComponent(input); break;
        case 'urld': out = decodeURIComponent(input); break;
        case 'htmle': out = input.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); break;
        case 'htmld': {
          const d = document.createElement('div');
          d.innerHTML = input;
          out = d.textContent;
          break;
        }
        case 'hexe': out = Array.from(new TextEncoder().encode(input)).map(b => b.toString(16).padStart(2,'0')).join(' '); break;
        case 'hexd': out = new TextDecoder().decode(new Uint8Array(input.trim().split(/\s+/).map(h => parseInt(h, 16)))); break;
      }
      document.getElementById('enc-output').value = out;
    } catch (e) {
      document.getElementById('enc-output').value = '⚠ Error: ' + e.message;
    }
  }

  document.querySelectorAll('[data-enc]').forEach(btn => {
    btn.addEventListener('click', () => doEncode(btn.dataset.enc));
  });
  document.getElementById('enc-copy').addEventListener('click', () => {
    copyText(document.getElementById('enc-output').value);
  });
  document.getElementById('enc-swap').addEventListener('click', () => {
    const i = document.getElementById('enc-input');
    const o = document.getElementById('enc-output');
    const tmp = i.value;
    i.value = o.value;
    o.value = tmp;
  });
  document.getElementById('enc-clear').addEventListener('click', () => {
    document.getElementById('enc-input').value = '';
    document.getElementById('enc-output').value = '';
  });
}
registerInit('encode', initEncode);

// ════════════════════════════════════════════════════════════
// TOOL: QR Code Generator
// ════════════════════════════════════════════════════════════
function initQR() {
  // We load the QR library dynamically
  let qrLib = null;

  function ensureLib(cb) {
    if (qrLib) { cb(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
    s.onload = () => { qrLib = window.QRCode; cb(); };
    document.head.appendChild(s);
  }

  function generate() {
    const text = document.getElementById('qr-input').value.trim();
    if (!text) { toast('⚠ Enter text or URL first'); return; }
    const size = parseInt(document.getElementById('qr-size').value) || 256;
    const fgColor = document.getElementById('qr-fg').value;
    const bgColor = document.getElementById('qr-bg').value;

    ensureLib(() => {
      const container = document.getElementById('qr-output');
      container.innerHTML = '';
      try {
        new qrLib(container, {
          text,
          width: size,
          height: size,
          colorDark: fgColor,
          colorLight: bgColor,
          correctLevel: window.QRCode.CorrectLevel.H,
        });
        document.getElementById('qr-download').disabled = false;
      } catch (e) {
        container.textContent = '⚠ Error: ' + e.message;
      }
    });
  }

  document.getElementById('qr-generate').addEventListener('click', generate);
  document.getElementById('qr-input').addEventListener('keydown', e => { if (e.key === 'Enter') generate(); });
  document.getElementById('qr-download').addEventListener('click', () => {
    const canvas = document.querySelector('#qr-output canvas');
    if (!canvas) return;
    const a = document.createElement('a');
    a.download = 'qrcode.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
  });
}
registerInit('qr', initQR);

// ════════════════════════════════════════════════════════════
// TOOL: Regex Tester
// ════════════════════════════════════════════════════════════
function initRegex() {
  function test() {
    const pattern = document.getElementById('regex-pattern').value;
    const flags   = document.getElementById('regex-flags').value;
    const text    = document.getElementById('regex-text').value;
    const output  = document.getElementById('regex-output');
    const info    = document.getElementById('regex-info');

    if (!pattern) {
      output.innerHTML = escHtml(text);
      info.textContent = '';
      return;
    }

    try {
      const re = new RegExp(pattern, flags.replace(/[^gimsuy]/g, ''));
      const matches = [];
      let m;
      const reGlobal = new RegExp(pattern, flags.includes('g') ? flags : flags + 'g');

      while ((m = reGlobal.exec(text)) !== null) {
        matches.push({ index: m.index, length: m[0].length, match: m[0], groups: m.slice(1) });
        if (!flags.includes('g') && !flags.includes('y')) break;
      }

      // Highlight
      let result = '';
      let lastIndex = 0;
      matches.forEach(({ index, length, match }) => {
        result += escHtml(text.slice(lastIndex, index));
        result += `<mark class="regex-match" title="${escHtml(match)}">${escHtml(match)}</mark>`;
        lastIndex = index + length;
      });
      result += escHtml(text.slice(lastIndex));
      output.innerHTML = result;

      if (matches.length === 0) {
        info.className = 'status-bar warning mt-2';
        info.textContent = '⚠ No matches found';
      } else {
        info.className = 'status-bar success mt-2';
        info.textContent = `✓ ${matches.length} match${matches.length > 1 ? 'es' : ''} found`;
        // Show groups if any
        const groupInfo = matches.map((m, i) =>
          m.groups.length ? `Match ${i+1}: "${m.match}" | Groups: ${m.groups.map(g => `"${g||''}"`).join(', ')}` : `Match ${i+1}: "${m.match}"`
        ).join('\n');
        document.getElementById('regex-groups').textContent = groupInfo;
      }
    } catch (e) {
      output.innerHTML = escHtml(text);
      info.className = 'status-bar error mt-2';
      info.textContent = '✗ Invalid regex: ' + e.message;
      document.getElementById('regex-groups').textContent = '';
    }
  }

  document.getElementById('regex-pattern').addEventListener('input', test);
  document.getElementById('regex-flags').addEventListener('input', test);
  document.getElementById('regex-text').addEventListener('input', test);
  document.getElementById('regex-clear').addEventListener('click', () => {
    document.getElementById('regex-pattern').value = '';
    document.getElementById('regex-text').value = '';
    document.getElementById('regex-output').textContent = '';
    document.getElementById('regex-info').textContent = '';
    document.getElementById('regex-groups').textContent = '';
  });
}
registerInit('regex', initRegex);

// ════════════════════════════════════════════════════════════
// TOOL: Color Tools
// ════════════════════════════════════════════════════════════
function initColor() {
  let colorTab = 'picker';

  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return { r, g, b };
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; }
    else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return { h: Math.round(h*360), s: Math.round(s*100), l: Math.round(l*100) };
  }

  function updateColorInfo(hex) {
    const { r, g, b } = hexToRgb(hex);
    const { h, s, l } = rgbToHsl(r, g, b);
    document.getElementById('color-hex-out').value = hex.toUpperCase();
    document.getElementById('color-rgb-out').value = `rgb(${r}, ${g}, ${b})`;
    document.getElementById('color-hsl-out').value = `hsl(${h}, ${s}%, ${l}%)`;
    document.getElementById('color-preview-box').style.background = hex;
  }

  document.getElementById('color-picker').addEventListener('input', function() {
    updateColorInfo(this.value);
  });

  document.getElementById('color-hex-out').addEventListener('input', function() {
    const v = this.value.trim();
    if (/^#[0-9a-f]{6}$/i.test(v)) {
      document.getElementById('color-picker').value = v;
      updateColorInfo(v);
    }
  });

  // Palette generator
  document.getElementById('color-palette-btn').addEventListener('click', () => {
    const hex = document.getElementById('color-picker').value;
    const { h, s, l } = rgbToHsl(...Object.values(hexToRgb(hex)));
    const palette = [
      `hsl(${h}, ${s}%, 90%)`,
      `hsl(${h}, ${s}%, 70%)`,
      `hsl(${h}, ${s}%, 50%)`,
      `hsl(${h}, ${s}%, ${l}%)`,
      `hsl(${h}, ${s}%, 30%)`,
      `hsl(${h}, ${s}%, 15%)`,
    ];
    const container = document.getElementById('color-palette-out');
    container.innerHTML = palette.map(c => `
      <div class="palette-swatch" style="background:${c}" title="${c}" onclick="copyText('${c}')">
        <span>${c}</span>
      </div>
    `).join('');
  });

  // Contrast checker
  function getLuminance(hex) {
    const { r, g, b } = hexToRgb(hex);
    const toLinear = c => { c /= 255; return c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); };
    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  }

  function checkContrast() {
    const fg = document.getElementById('contrast-fg').value;
    const bg = document.getElementById('contrast-bg').value;
    const L1 = getLuminance(fg), L2 = getLuminance(bg);
    const ratio = ((Math.max(L1,L2) + 0.05) / (Math.min(L1,L2) + 0.05)).toFixed(2);
    const el = document.getElementById('contrast-result');

    const aa   = ratio >= 4.5 ? '✓' : '✗';
    const aaLg = ratio >= 3   ? '✓' : '✗';
    const aaa  = ratio >= 7   ? '✓' : '✗';

    el.innerHTML = `
      <div class="contrast-result">
        <div class="contrast-ratio" style="color:${ratio>=4.5?'var(--accent)':'var(--red)'}">${ratio}:1</div>
        <div style="display:flex;gap:12px;font-family:var(--font-mono);font-size:0.75rem;flex-wrap:wrap">
          <span>AA Normal: <b style="color:${ratio>=4.5?'var(--accent)':'var(--red)'}">${aa}</b></span>
          <span>AA Large:  <b style="color:${ratio>=3?'var(--accent)':'var(--red)'}">${aaLg}</b></span>
          <span>AAA: <b style="color:${ratio>=7?'var(--accent)':'var(--red)'}">${aaa}</b></span>
        </div>
        <div style="width:80px;height:40px;border-radius:4px;background:${bg};display:flex;align-items:center;justify-content:center;font-family:var(--font-mono);font-size:0.75rem;font-weight:600;color:${fg};border:1px solid var(--border);flex-shrink:0">Sample</div>
      </div>
    `;
  }

  document.getElementById('contrast-check').addEventListener('click', checkContrast);
  document.getElementById('contrast-fg').addEventListener('input', checkContrast);
  document.getElementById('contrast-bg').addEventListener('input', checkContrast);

  // Gradient maker
  function updateGradient() {
    const c1   = document.getElementById('grad-c1').value;
    const c2   = document.getElementById('grad-c2').value;
    const type = document.getElementById('grad-type').value;
    const deg  = document.getElementById('grad-deg').value;
    let css;
    if (type === 'radial') {
      css = `radial-gradient(circle, ${c1}, ${c2})`;
    } else {
      css = `linear-gradient(${deg}deg, ${c1}, ${c2})`;
    }
    document.getElementById('grad-preview').style.background = css;
    document.getElementById('grad-css').value = `background: ${css};`;
  }

  document.getElementById('grad-c1').addEventListener('input', updateGradient);
  document.getElementById('grad-c2').addEventListener('input', updateGradient);
  document.getElementById('grad-type').addEventListener('change', updateGradient);
  document.getElementById('grad-deg').addEventListener('input', updateGradient);
  document.getElementById('grad-copy-css').addEventListener('click', () => {
    copyText(document.getElementById('grad-css').value);
  });

  // Tab switching for color tool
  document.querySelectorAll('[data-color-tab]').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('[data-color-tab]').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.color-tab-panel').forEach(p => p.classList.add('hidden'));
      this.classList.add('active');
      document.getElementById('color-tab-' + this.dataset.colorTab).classList.remove('hidden');
    });
  });

  // Copy color values
  ['color-hex-out','color-rgb-out','color-hsl-out'].forEach(id => {
    document.getElementById(id).addEventListener('click', function() {
      copyText(this.value);
    });
  });

  updateGradient();
  updateColorInfo('#3498db');
}
registerInit('color', initColor);

// ════════════════════════════════════════════════════════════
// TOOL: Timestamp Converter
// ════════════════════════════════════════════════════════════
function initTimestamp() {
  function convert() {
    const val = document.getElementById('ts-input').value.trim();
    const output = document.getElementById('ts-output');

    if (!val) { output.innerHTML = ''; return; }

    let date;
    if (/^\d{1,13}$/.test(val)) {
      const n = parseInt(val);
      date = new Date(val.length <= 10 ? n * 1000 : n);
    } else {
      date = new Date(val);
    }

    if (isNaN(date)) {
      output.innerHTML = '<div class="status-bar error">✗ Invalid date or timestamp</div>';
      return;
    }

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const rows = [
      ['Unix (seconds)',  Math.floor(date.getTime() / 1000)],
      ['Unix (ms)',       date.getTime()],
      ['UTC',            date.toUTCString()],
      ['ISO 8601',       date.toISOString()],
      ['Local',          date.toLocaleString()],
      ['Date only',      date.toLocaleDateString()],
      ['Time only',      date.toLocaleTimeString()],
      ['Timezone',       tz],
      ['Day of week',    date.toLocaleDateString('en-US', {weekday:'long'})],
    ];

    output.innerHTML = rows.map(([label, value]) => `
      <div class="ts-result-row">
        <span class="ts-label">${label}</span>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="ts-value">${value}</span>
          <button class="btn btn-ghost" style="padding:2px 8px;font-size:0.7rem" onclick="copyText('${value}')">copy</button>
        </div>
      </div>
    `).join('');
  }

  document.getElementById('ts-now').addEventListener('click', () => {
    document.getElementById('ts-input').value = Math.floor(Date.now() / 1000);
    convert();
  });

  document.getElementById('ts-input').addEventListener('input', convert);
  document.getElementById('ts-convert').addEventListener('click', convert);

  // Auto-set now
  document.getElementById('ts-input').value = Math.floor(Date.now() / 1000);
  convert();
}
registerInit('timestamp', initTimestamp);

// ════════════════════════════════════════════════════════════
// TOOL: Hash Generator
// ════════════════════════════════════════════════════════════
function initHash() {
  async function sha(text, algo) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hash = await crypto.subtle.digest(algo, data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // MD5 (pure JS implementation - minimal)
  function md5(str) {
    function safeAdd(x, y) { const lsw=(x&0xFFFF)+(y&0xFFFF); return (((x>>16)+(y>>16)+(lsw>>16))<<16)|(lsw&0xFFFF); }
    function bitRotateLeft(num, cnt) { return (num<<cnt)|(num>>>(32-cnt)); }
    function md5cmn(q,a,b,x,s,t){return safeAdd(bitRotateLeft(safeAdd(safeAdd(a,q),safeAdd(x,t)),s),b);}
    function md5ff(a,b,c,d,x,s,t){return md5cmn((b&c)|((~b)&d),a,b,x,s,t);}
    function md5gg(a,b,c,d,x,s,t){return md5cmn((b&d)|(c&(~d)),a,b,x,s,t);}
    function md5hh(a,b,c,d,x,s,t){return md5cmn(b^c^d,a,b,x,s,t);}
    function md5ii(a,b,c,d,x,s,t){return md5cmn(c^(b|(~d)),a,b,x,s,t);}

    const bytes = [];
    for (let i=0; i<str.length; i++) {
      const c = str.charCodeAt(i);
      if (c<128) bytes.push(c);
      else if (c<2048) { bytes.push((c>>6)|192); bytes.push((c&63)|128); }
      else { bytes.push((c>>12)|224); bytes.push(((c>>6)&63)|128); bytes.push((c&63)|128); }
    }
    const len = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    bytes.push(len & 0xFF, (len >> 8) & 0xFF, (len >> 16) & 0xFF, (len >> 24) & 0xFF, 0, 0, 0, 0);

    const M = [];
    for (let i=0; i<bytes.length; i+=4) M.push(bytes[i]|(bytes[i+1]<<8)|(bytes[i+2]<<16)|(bytes[i+3]<<24));

    let a=0x67452301, b=0xEFCDAB89, c=0x98BADCFE, d=0x10325476;
    for (let i=0; i<M.length; i+=16) {
      const [aa,bb,cc,dd]=[a,b,c,d];
      a=md5ff(a,b,c,d,M[i],7,-680876936);d=md5ff(d,a,b,c,M[i+1],12,-389564586);c=md5ff(c,d,a,b,M[i+2],17,606105819);b=md5ff(b,c,d,a,M[i+3],22,-1044525330);
      a=md5ff(a,b,c,d,M[i+4],7,-176418897);d=md5ff(d,a,b,c,M[i+5],12,1200080426);c=md5ff(c,d,a,b,M[i+6],17,-1473231341);b=md5ff(b,c,d,a,M[i+7],22,-45705983);
      a=md5ff(a,b,c,d,M[i+8],7,1770035416);d=md5ff(d,a,b,c,M[i+9],12,-1958414417);c=md5ff(c,d,a,b,M[i+10],17,-42063);b=md5ff(b,c,d,a,M[i+11],22,-1990404162);
      a=md5ff(a,b,c,d,M[i+12],7,1804603682);d=md5ff(d,a,b,c,M[i+13],12,-40341101);c=md5ff(c,d,a,b,M[i+14],17,-1502002290);b=md5ff(b,c,d,a,M[i+15],22,1236535329);
      a=md5gg(a,b,c,d,M[i+1],5,-165796510);d=md5gg(d,a,b,c,M[i+6],9,-1069501632);c=md5gg(c,d,a,b,M[i+11],14,643717713);b=md5gg(b,c,d,a,M[i],20,-373897302);
      a=md5gg(a,b,c,d,M[i+5],5,-701558691);d=md5gg(d,a,b,c,M[i+10],9,38016083);c=md5gg(c,d,a,b,M[i+15],14,-660478335);b=md5gg(b,c,d,a,M[i+4],20,-405537848);
      a=md5gg(a,b,c,d,M[i+9],5,568446438);d=md5gg(d,a,b,c,M[i+14],9,-1019803690);c=md5gg(c,d,a,b,M[i+3],14,-187363961);b=md5gg(b,c,d,a,M[i+8],20,1163531501);
      a=md5gg(a,b,c,d,M[i+13],5,-1444681467);d=md5gg(d,a,b,c,M[i+2],9,-51403784);c=md5gg(c,d,a,b,M[i+7],14,1735328473);b=md5gg(b,c,d,a,M[i+12],20,-1926607734);
      a=md5hh(a,b,c,d,M[i+5],4,-378558);d=md5hh(d,a,b,c,M[i+8],11,-2022574463);c=md5hh(c,d,a,b,M[i+11],16,1839030562);b=md5hh(b,c,d,a,M[i+14],23,-35309556);
      a=md5hh(a,b,c,d,M[i+1],4,-1530992060);d=md5hh(d,a,b,c,M[i+4],11,1272893353);c=md5hh(c,d,a,b,M[i+7],16,-155497632);b=md5hh(b,c,d,a,M[i+10],23,-1094730640);
      a=md5hh(a,b,c,d,M[i+13],4,681279174);d=md5hh(d,a,b,c,M[i],11,-358537222);c=md5hh(c,d,a,b,M[i+3],16,-722521979);b=md5hh(b,c,d,a,M[i+6],23,76029189);
      a=md5hh(a,b,c,d,M[i+9],4,-640364487);d=md5hh(d,a,b,c,M[i+12],11,-421815835);c=md5hh(c,d,a,b,M[i+15],16,530742520);b=md5hh(b,c,d,a,M[i+2],23,-995338651);
      a=md5ii(a,b,c,d,M[i],6,-198630844);d=md5ii(d,a,b,c,M[i+7],10,1126891415);c=md5ii(c,d,a,b,M[i+14],15,-1416354905);b=md5ii(b,c,d,a,M[i+5],21,-57434055);
      a=md5ii(a,b,c,d,M[i+12],6,1700485571);d=md5ii(d,a,b,c,M[i+3],10,-1894986606);c=md5ii(c,d,a,b,M[i+10],15,-1051523);b=md5ii(b,c,d,a,M[i+1],21,-2054922799);
      a=md5ii(a,b,c,d,M[i+8],6,1873313359);d=md5ii(d,a,b,c,M[i+15],10,-30611744);c=md5ii(c,d,a,b,M[i+6],15,-1560198380);b=md5ii(b,c,d,a,M[i+13],21,1309151649);
      a=md5ii(a,b,c,d,M[i+4],6,-145523070);d=md5ii(d,a,b,c,M[i+11],10,-1120210379);c=md5ii(c,d,a,b,M[i+2],15,718787259);b=md5ii(b,c,d,a,M[i+9],21,-343485551);
      a=safeAdd(a,aa);b=safeAdd(b,bb);c=safeAdd(c,cc);d=safeAdd(d,dd);
    }
    return [a,b,c,d].map(n=>(((n&0xFF)<<24)|((n>>8&0xFF)<<16)|((n>>16&0xFF)<<8)|(n>>>24)).toString(16).padStart(8,'0')).join('');
  }

  async function doHash() {
    const input = document.getElementById('hash-input').value;
    if (!input) return;

    const [md5Hash, sha256, sha512] = await Promise.all([
      Promise.resolve(md5(input)),
      sha(input, 'SHA-256'),
      sha(input, 'SHA-512'),
    ]);

    document.getElementById('hash-md5').textContent    = md5Hash;
    document.getElementById('hash-sha256').textContent = sha256;
    document.getElementById('hash-sha512').textContent = sha512;
  }

  document.getElementById('hash-input').addEventListener('input', doHash);
  document.getElementById('hash-compute').addEventListener('click', doHash);

  ['md5','sha256','sha512'].forEach(h => {
    document.getElementById(`hash-copy-${h}`).addEventListener('click', () => {
      copyText(document.getElementById(`hash-${h}`).textContent);
    });
  });
}
registerInit('hash', initHash);

// ════════════════════════════════════════════════════════════
// TOOL: UUID Generator
// ════════════════════════════════════════════════════════════
function initUuid() {
  function uuid4() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random()*16|0;
      return (c==='x' ? r : (r&0x3|0x8)).toString(16);
    });
  }

  function generate() {
    const count = parseInt(document.getElementById('uuid-count').value) || 1;
    const uuids = Array.from({length: count}, uuid4);
    document.getElementById('uuid-output').value = uuids.join('\n');
  }

  document.getElementById('uuid-generate').addEventListener('click', generate);
  document.getElementById('uuid-copy').addEventListener('click', () => {
    copyText(document.getElementById('uuid-output').value);
  });
  document.getElementById('uuid-clear').addEventListener('click', () => {
    document.getElementById('uuid-output').value = '';
  });
  generate();
}
registerInit('uuid', initUuid);

// ════════════════════════════════════════════════════════════
// TOOL: Lorem Ipsum
// ════════════════════════════════════════════════════════════
function initLorem() {
  const LOREM = 'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua Ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur Excepteur sint occaecat cupidatat non proident sunt in culpa qui officia deserunt mollit anim id est laborum Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium totam rem aperiam eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt neque porro quisquam est qui dolorem ipsum quia dolor sit amet consectetur adipisci velit'.split(' ');

  function sentence() {
    const len = 6 + Math.floor(Math.random() * 15);
    const start = Math.floor(Math.random() * (LOREM.length - len));
    const words = LOREM.slice(start, start + len);
    words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
    return words.join(' ') + '.';
  }

  function paragraph() {
    const count = 3 + Math.floor(Math.random() * 4);
    return Array.from({length: count}, sentence).join(' ');
  }

  function generate() {
    const type  = document.getElementById('lorem-type').value;
    const count = parseInt(document.getElementById('lorem-count').value) || 1;
    let output = '';

    if (type === 'words') {
      output = LOREM.slice(0, count).join(' ');
    } else if (type === 'sentences') {
      output = Array.from({length: count}, sentence).join(' ');
    } else {
      output = Array.from({length: count}, paragraph).join('\n\n');
    }

    document.getElementById('lorem-output').value = output;
  }

  document.getElementById('lorem-generate').addEventListener('click', generate);
  document.getElementById('lorem-copy').addEventListener('click', () => {
    copyText(document.getElementById('lorem-output').value);
  });
  generate();
}
registerInit('lorem', initLorem);

// ════════════════════════════════════════════════════════════
// TOOL: Word Counter
// ════════════════════════════════════════════════════════════
function initWordcount() {
  function update() {
    const text = document.getElementById('wc-input').value;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const chars  = text.length;
    const charsNoSpace = text.replace(/\s/g, '').length;
    const lines  = text ? text.split('\n').length : 0;
    const sentences = (text.match(/[.!?]+/g) || []).length;
    const readingTime = Math.ceil(words / 200);

    document.getElementById('wc-words').textContent = words.toLocaleString();
    document.getElementById('wc-chars').textContent = chars.toLocaleString();
    document.getElementById('wc-chars-ns').textContent = charsNoSpace.toLocaleString();
    document.getElementById('wc-lines').textContent = lines.toLocaleString();
    document.getElementById('wc-sentences').textContent = sentences.toLocaleString();
    document.getElementById('wc-reading').textContent = readingTime + ' min';
  }

  document.getElementById('wc-input').addEventListener('input', update);
  document.getElementById('wc-clear').addEventListener('click', () => {
    document.getElementById('wc-input').value = '';
    update();
  });
  document.getElementById('wc-copy').addEventListener('click', () => {
    copyText(document.getElementById('wc-input').value);
  });
}
registerInit('wordcount', initWordcount);

// ════════════════════════════════════════════════════════════
// TOOL: Case Converter
// ════════════════════════════════════════════════════════════
function initCase() {
  function convert(type) {
    const input = document.getElementById('case-input').value;
    let out = input;
    switch (type) {
      case 'upper':    out = input.toUpperCase(); break;
      case 'lower':    out = input.toLowerCase(); break;
      case 'title':    out = input.replace(/\b\w/g, c => c.toUpperCase()); break;
      case 'sentence': out = input.replace(/(^\s*\w|[.!?]\s+\w)/g, c => c.toUpperCase()); break;
      case 'camel':    out = input.toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase()); break;
      case 'pascal':   out = input.toLowerCase().replace(/(^.|[^a-zA-Z0-9]+.)/g, (_, c) => c.replace(/[^a-zA-Z0-9]/g,'').toUpperCase()); break;
      case 'snake':    out = input.toLowerCase().replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, ''); break;
      case 'kebab':    out = input.toLowerCase().replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, ''); break;
      case 'dot':      out = input.toLowerCase().replace(/[^a-zA-Z0-9]+/g, '.').replace(/^\.|\.$/g, ''); break;
      case 'const':    out = input.toUpperCase().replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, ''); break;
      case 'reverse':  out = input.split('').reverse().join(''); break;
      case 'alt':      out = input.split('').map((c,i) => i%2===0 ? c.toUpperCase() : c.toLowerCase()).join(''); break;
    }
    document.getElementById('case-output').value = out;
  }

  document.querySelectorAll('[data-case]').forEach(btn => {
    btn.addEventListener('click', () => convert(btn.dataset.case));
  });

  document.getElementById('case-copy').addEventListener('click', () => {
    copyText(document.getElementById('case-output').value);
  });
  document.getElementById('case-swap').addEventListener('click', () => {
    const i = document.getElementById('case-input');
    const o = document.getElementById('case-output');
    const tmp = i.value;
    i.value = o.value;
    o.value = tmp;
  });
  document.getElementById('case-clear').addEventListener('click', () => {
    document.getElementById('case-input').value = '';
    document.getElementById('case-output').value = '';
  });
}
registerInit('case', initCase);

// ── Escape HTML helper ─────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

// ── Boot ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Apply saved theme
  applyTheme(State.theme);

  // Theme toggle
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

  // Sidebar toggle (mobile)
  document.getElementById('menu-toggle').addEventListener('click', toggleSidebar);
  document.getElementById('sidebar-overlay').addEventListener('click', closeSidebar);

  // Nav items
  document.querySelectorAll('[data-tool]').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.tool));
  });

  // Keyboard nav
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSidebar();
  });

  // Navigate to saved tool
  navigate(State.activeTool);

  // Register PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
});
