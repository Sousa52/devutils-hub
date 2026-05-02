/* ============================================================
   DevUtils Hub — app.js  v2.0
   All tools, routing, command palette, keyboard shortcuts
   ============================================================ */
'use strict';

// ── State ──────────────────────────────────────────────────
const S = {
  theme:  localStorage.getItem('duh-theme')  || 'dark',
  tool:   localStorage.getItem('duh-tool')   || 'json',
};

// ── Theme ──────────────────────────────────────────────────
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = t === 'dark' ? '☀' : '🌙';
  S.theme = t;
  localStorage.setItem('duh-theme', t);
}
function toggleTheme() { applyTheme(S.theme === 'dark' ? 'light' : 'dark'); }

// ── Toast ──────────────────────────────────────────────────
let _toastT;
function toast(msg, ms = 1800) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastT);
  _toastT = setTimeout(() => el.classList.remove('show'), ms);
}

// ── Copy ───────────────────────────────────────────────────
async function copyText(text, label = 'Copied!') {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(String(text));
  } catch {
    const ta = document.createElement('textarea');
    ta.value = String(text);
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
  }
  toast('✓ ' + label);
}

// ── Download ───────────────────────────────────────────────
function downloadFile(content, name, mime = 'text/plain') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: mime }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ── Escape HTML ────────────────────────────────────────────
function escH(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Routing ────────────────────────────────────────────────
function navigate(id) {
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tool-panel').forEach(el => el.classList.remove('active'));
  const nav = document.querySelector(`[data-tool="${id}"]`);
  const panel = document.getElementById(`tool-${id}`);
  if (nav) nav.classList.add('active');
  if (panel) panel.classList.add('active');
  S.tool = id;
  localStorage.setItem('duh-tool', id);
  closeSidebar();
  if (inits[id] && !done[id]) { inits[id](); done[id] = true; }
}

const inits = {}, done = {};
function reg(id, fn) { inits[id] = fn; }

// ── Sidebar ────────────────────────────────────────────────
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('show');
}
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('show');
}

// ══════════════════════════════════════════════════════════
//  COMMAND PALETTE
// ══════════════════════════════════════════════════════════
const TOOLS_META = [
  { id:'json',      label:'JSON Formatter',    section:'Data',     icon:'{ }' },
  { id:'jwt',       label:'JWT Decoder',       section:'Data',     icon:'JWT' },
  { id:'hash',      label:'Hash Generator',    section:'Data',     icon:'#'   },
  { id:'encode',    label:'Encode / Decode',   section:'Data',     icon:'⇄'   },
  { id:'timestamp', label:'Timestamp',         section:'Data',     icon:'⏱'  },
  { id:'color',     label:'Color Tools',       section:'Visual',   icon:'◉'   },
  { id:'qr',        label:'QR Generator',      section:'Visual',   icon:'▦'   },
  { id:'password',  label:'Password Generator',section:'Security', icon:'🔑'  },
  { id:'regex',     label:'Regex Tester',      section:'Security', icon:'.*'  },
  { id:'units',     label:'Unit Converter',    section:'Utilities',icon:'⇌'   },
  { id:'uuid',      label:'UUID Generator',    section:'Utilities',icon:'◈'   },
  { id:'lorem',     label:'Lorem Ipsum',       section:'Utilities',icon:'¶'   },
  { id:'wordcount', label:'Word Counter',      section:'Utilities',icon:'Σ'   },
  { id:'case',      label:'Case Converter',    section:'Utilities',icon:'Aa'  },
];

let cmdIdx = 0;
function openCmd() {
  const ov = document.getElementById('cmd-overlay');
  ov.classList.add('open');
  document.getElementById('cmd-input').value = '';
  document.getElementById('cmd-input').focus();
  renderCmd('');
}
function closeCmd() { document.getElementById('cmd-overlay').classList.remove('open'); }

function renderCmd(q) {
  const items = q
    ? TOOLS_META.filter(t => t.label.toLowerCase().includes(q.toLowerCase()) || t.section.toLowerCase().includes(q.toLowerCase()))
    : TOOLS_META;
  cmdIdx = 0;
  const el = document.getElementById('cmd-results');
  if (!items.length) {
    el.innerHTML = '<div style="padding:14px 16px;font-size:0.78rem;color:var(--text-3);font-family:var(--font-mono)">No results</div>';
    return;
  }
  el.innerHTML = items.map((t, i) => `
    <div class="cmd-item${i===0?' selected':''}" data-id="${t.id}" role="option">
      <span class="cmd-icon">${t.icon}</span>
      <span class="cmd-label">${t.label}</span>
      <span class="cmd-section">${t.section}</span>
    </div>
  `).join('');
  el.querySelectorAll('.cmd-item').forEach(el => {
    el.addEventListener('click', () => { navigate(el.dataset.id); closeCmd(); });
    el.addEventListener('mouseover', function() {
      document.querySelectorAll('.cmd-item').forEach(x => x.classList.remove('selected'));
      this.classList.add('selected');
      cmdIdx = [...this.parentElement.children].indexOf(this);
    });
  });
}

// ══════════════════════════════════════════════════════════
//  TOOL: JSON
// ══════════════════════════════════════════════════════════
reg('json', () => {
  const input  = document.getElementById('json-input');
  const output = document.getElementById('json-output');
  const status = document.getElementById('json-status');
  let data = null, mode = 'pretty';

  function setStatus(type, msg) {
    status.className = 'status-bar section ' + type;
    status.textContent = msg;
  }

  function parse() {
    try {
      data = JSON.parse(input.value.trim());
      return true;
    } catch(e) {
      setStatus('error', '✗ ' + e.message);
      data = null; return false;
    }
  }

  function pretty() {
    if (!parse()) return; mode = 'pretty';
    output.textContent = JSON.stringify(data, null, 2);
    setStatus('success', `✓ Valid JSON · ${JSON.stringify(data).length} chars`);
  }

  function minify() {
    if (!parse()) return; mode = 'minify';
    output.textContent = JSON.stringify(data);
    setStatus('success', '✓ Minified · ' + output.textContent.length + ' chars');
  }

  function tree() {
    if (!parse()) return; mode = 'tree';
    output.innerHTML = buildTree(data);
    setStatus('success', '✓ Tree view');
  }

  function buildTree(v, depth=0) {
    if (v === null) return `<span class="jl">null</span>`;
    if (typeof v === 'boolean') return `<span class="jb">${v}</span>`;
    if (typeof v === 'number') return `<span class="jn">${v}</span>`;
    if (typeof v === 'string') return `<span class="js">"${escH(v)}"</span>`;
    if (Array.isArray(v)) {
      if (!v.length) return `<span class="jl">[]</span>`;
      const pad = '  '.repeat(depth+1);
      const items = v.map((x,i) => `<div style="padding-left:${(depth+1)*14}px"><span class="jn">${i}</span>: ${buildTree(x,depth+1)}</div>`).join('');
      return `<details open><summary><span class="jl">Array[${v.length}]</span></summary>${items}</details>`;
    }
    if (typeof v === 'object') {
      const keys = Object.keys(v);
      if (!keys.length) return `<span class="jl">{}</span>`;
      const items = keys.map(k => `<div style="padding-left:${(depth+1)*14}px"><span class="jk">"${escH(k)}"</span>: ${buildTree(v[k],depth+1)}</div>`).join('');
      return `<details open><summary><span class="jl">Object{${keys.length}}</span></summary>${items}</details>`;
    }
    return escH(String(v));
  }

  function toYaml(v, depth=0) {
    const pad = '  '.repeat(depth);
    if (v === null) return 'null';
    if (typeof v === 'boolean' || typeof v === 'number') return String(v);
    if (typeof v === 'string') return v.includes('\n') ? `|\n${v.split('\n').map(l=>pad+'  '+l).join('\n')}` : JSON.stringify(v);
    if (Array.isArray(v)) return v.map(x => `${pad}- ${toYaml(x,depth+1)}`).join('\n');
    return Object.entries(v).map(([k,x]) => {
      const val = toYaml(x, depth+1);
      return (typeof x==='object'&&x!==null) ? `${pad}${k}:\n${val}` : `${pad}${k}: ${val}`;
    }).join('\n');
  }

  function sortKeys(v) {
    if (Array.isArray(v)) return v.map(sortKeys);
    if (v && typeof v === 'object') {
      return Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,sortKeys(x)]));
    }
    return v;
  }

  document.getElementById('json-pretty').onclick   = pretty;
  document.getElementById('json-minify').onclick   = minify;
  document.getElementById('json-validate').onclick = () => { if(parse()) setStatus('success','✓ Valid JSON'); };
  document.getElementById('json-tree').onclick     = tree;
  document.getElementById('json-yaml').onclick     = () => {
    if (!parse()) return; mode='yaml';
    output.textContent = toYaml(data);
    setStatus('success','✓ Converted to YAML');
  };
  document.getElementById('json-sort').onclick     = () => {
    if (!parse()) return;
    data = sortKeys(data);
    input.value = JSON.stringify(data, null, 2);
    output.textContent = JSON.stringify(data, null, 2);
    setStatus('success','✓ Keys sorted');
  };
  document.getElementById('json-copy').onclick     = () => copyText(output.textContent||output.innerText);
  document.getElementById('json-download').onclick = () => {
    const c = output.textContent||output.innerText;
    if (c) downloadFile(c, mode==='yaml'?'output.yaml':'output.json');
  };
  document.getElementById('json-clear').onclick    = () => {
    input.value=''; output.textContent=''; data=null;
    status.className='status-bar section'; status.textContent='';
  };
  input.addEventListener('input', () => { if (input.value.trim().length > 2) pretty(); });
});

// ══════════════════════════════════════════════════════════
//  TOOL: JWT
// ══════════════════════════════════════════════════════════
reg('jwt', () => {
  function b64urlDecode(s) {
    s = s.replace(/-/g,'+').replace(/_/g,'/');
    while (s.length % 4) s += '=';
    try { return JSON.parse(decodeURIComponent(atob(s).split('').map(c=>'%'+('00'+c.charCodeAt(0).toString(16)).slice(-2)).join(''))); }
    catch { return null; }
  }

  function decode() {
    const raw = document.getElementById('jwt-input').value.trim();
    const tokenDisplay = document.getElementById('jwt-token-display');
    const statusEl = document.getElementById('jwt-status');
    const partsEl = document.getElementById('jwt-parts');

    if (!raw) { toast('⚠ Paste a JWT token first'); return; }

    const parts = raw.split('.');
    if (parts.length !== 3) {
      statusEl.className = 'status-bar error section';
      statusEl.textContent = '✗ Invalid JWT — expected 3 parts (header.payload.signature)';
      statusEl.classList.remove('hidden');
      tokenDisplay.classList.add('hidden');
      partsEl.innerHTML = '';
      return;
    }

    const header  = b64urlDecode(parts[0]);
    const payload = b64urlDecode(parts[1]);

    if (!header || !payload) {
      statusEl.className = 'status-bar error section';
      statusEl.textContent = '✗ Failed to decode — malformed token';
      statusEl.classList.remove('hidden');
      return;
    }

    // Token with coloured parts
    tokenDisplay.innerHTML = `<span class="jwt-h">${escH(parts[0])}</span>.<span class="jwt-p">${escH(parts[1])}</span>.<span class="jwt-s">${escH(parts[2])}</span>`;
    tokenDisplay.classList.remove('hidden');

    // Expiry check
    let statusMsg = '✓ Token decoded successfully';
    let statusType = 'success';
    if (payload.exp) {
      const exp = new Date(payload.exp * 1000);
      const now = new Date();
      if (exp < now) {
        statusMsg = `✗ Token EXPIRED on ${exp.toLocaleString()}`;
        statusType = 'error';
      } else {
        statusMsg = `✓ Valid · Expires ${exp.toLocaleString()}`;
      }
    }
    statusEl.className = `status-bar ${statusType} section`;
    statusEl.textContent = statusMsg;
    statusEl.classList.remove('hidden');

    // Parts
    partsEl.innerHTML = `
      <div class="jwt-part jwt-hdr">
        <div class="jwt-part-header">
          <span style="color:var(--red)">HEADER</span>
          <button class="btn btn-ghost" style="padding:2px 8px;font-size:0.65rem" onclick="copyText('${escH(JSON.stringify(header,null,2))}')">Copy</button>
        </div>
        <pre class="code-block" style="border:none;background:none;padding:0;color:var(--text-1)">${escH(JSON.stringify(header,null,2))}</pre>
      </div>
      <div class="jwt-part jwt-pay">
        <div class="jwt-part-header">
          <span style="color:var(--purple)">PAYLOAD</span>
          <button class="btn btn-ghost" style="padding:2px 8px;font-size:0.65rem" onclick="copyText('${escH(JSON.stringify(payload,null,2))}')">Copy</button>
        </div>
        <pre class="code-block" style="border:none;background:none;padding:0;color:var(--text-1)">${escH(JSON.stringify(payload,null,2))}</pre>
      </div>
      <div class="jwt-part jwt-sig">
        <div class="jwt-part-header"><span style="color:var(--blue)">SIGNATURE</span></div>
        <div class="hash-output" style="color:var(--blue)">${escH(parts[2])}</div>
      </div>
    `;
  }

  document.getElementById('jwt-decode').onclick = decode;
  document.getElementById('jwt-clear').onclick = () => {
    document.getElementById('jwt-input').value = '';
    document.getElementById('jwt-token-display').classList.add('hidden');
    document.getElementById('jwt-status').classList.add('hidden');
    document.getElementById('jwt-parts').innerHTML = '';
  };
  document.getElementById('jwt-input').addEventListener('input', () => {
    const v = document.getElementById('jwt-input').value.trim();
    if (v.split('.').length === 3 && v.length > 20) decode();
  });
});

// ══════════════════════════════════════════════════════════
//  TOOL: PASSWORD
// ══════════════════════════════════════════════════════════
reg('password', () => {
  const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const LOWER = 'abcdefghijklmnopqrstuvwxyz';
  const NUMS  = '0123456789';
  const SYMS  = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  const AMBIG = /[0O1lI]/g;
  const hist  = [];

  function gen() {
    const len    = +document.getElementById('pass-length').value || 16;
    const phrase = document.getElementById('pass-phrase').checked;
    const noAmb  = document.getElementById('pass-no-ambig').checked;
    document.getElementById('pass-len-val').textContent = len;

    let pw;
    if (phrase) {
      const words = ['correct','horse','battery','staple','cloud','river','mountain','ocean','thunder','pixel','quantum','vector','cipher','nova','spark','prism','echo','lunar','storm','flare'];
      pw = Array.from({length: Math.max(3, Math.round(len/6))}, () => words[Math.random()*words.length|0]).join('-');
    } else {
      let chars = '';
      if (document.getElementById('pass-upper').checked) chars += UPPER;
      if (document.getElementById('pass-lower').checked) chars += LOWER;
      if (document.getElementById('pass-nums').checked)  chars += NUMS;
      if (document.getElementById('pass-syms').checked)  chars += SYMS;
      if (!chars) chars = LOWER + UPPER + NUMS;
      if (noAmb) chars = chars.replace(AMBIG, '');
      const arr = new Uint32Array(len);
      crypto.getRandomValues(arr);
      pw = Array.from(arr, n => chars[n % chars.length]).join('');
    }

    document.getElementById('pass-output').textContent = pw;
    updateStrength(pw);
    hist.unshift(pw);
    if (hist.length > 10) hist.pop();
  }

  function updateStrength(pw) {
    let s = 0;
    if (pw.length >= 8)  s++;
    if (pw.length >= 12) s++;
    if (pw.length >= 20) s++;
    if (/[A-Z]/.test(pw)) s++;
    if (/[a-z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    const lvl = [
      {p:8,  c:'#ef4444', t:'Very Weak'},
      {p:22, c:'#f97316', t:'Weak'},
      {p:40, c:'#eab308', t:'Fair'},
      {p:62, c:'#84cc16', t:'Good'},
      {p:84, c:'#22c55e', t:'Strong'},
      {p:100,c:'#ffffff', t:'Very Strong'},
    ][Math.min(s, 5)];
    document.getElementById('strength-fill').style.cssText = `width:${lvl.p}%;background:${lvl.c}`;
    const sl = document.getElementById('strength-label');
    sl.textContent = lvl.t; sl.style.color = lvl.c;
    const chars = new Set(pw).size;
    document.getElementById('pass-entropy').textContent = (Math.log2(chars||1)*pw.length).toFixed(1) + ' bits';
  }

  document.getElementById('pass-generate').onclick = gen;
  document.getElementById('pass-copy').onclick = () => copyText(document.getElementById('pass-output').textContent);
  document.getElementById('pass-length').addEventListener('input', gen);
  ['pass-upper','pass-lower','pass-nums','pass-syms','pass-phrase','pass-no-ambig'].forEach(id =>
    document.getElementById(id).addEventListener('change', gen)
  );
  document.getElementById('pass-history').onclick = () => {
    const el = document.getElementById('pass-history-list');
    el.classList.toggle('hidden');
    if (!el.classList.contains('hidden')) {
      el.textContent = hist.length ? hist.join('\n') : 'No history yet';
    }
  };
  gen();
});

// ══════════════════════════════════════════════════════════
//  TOOL: ENCODE/DECODE
// ══════════════════════════════════════════════════════════
reg('encode', () => {
  function run(mode) {
    const v = document.getElementById('enc-input').value;
    let out = '';
    try {
      switch(mode) {
        case 'b64e': out = btoa(unescape(encodeURIComponent(v))); break;
        case 'b64d': out = decodeURIComponent(escape(atob(v.trim()))); break;
        case 'urle': out = encodeURIComponent(v); break;
        case 'urld': out = decodeURIComponent(v); break;
        case 'htmle': out = v.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); break;
        case 'htmld': { const d=document.createElement('div'); d.innerHTML=v; out=d.textContent; break; }
        case 'hexe': out = Array.from(new TextEncoder().encode(v)).map(b=>b.toString(16).padStart(2,'0')).join(' '); break;
        case 'hexd': out = new TextDecoder().decode(new Uint8Array(v.trim().split(/\s+/).map(h=>parseInt(h,16)))); break;
        case 'bine': out = Array.from(new TextEncoder().encode(v)).map(b=>b.toString(2).padStart(8,'0')).join(' '); break;
        case 'bind': out = new TextDecoder().decode(new Uint8Array(v.trim().split(/\s+/).map(b=>parseInt(b,2)))); break;
      }
      document.getElementById('enc-output').value = out;
    } catch(e) {
      document.getElementById('enc-output').value = '⚠ ' + e.message;
    }
  }
  document.querySelectorAll('[data-enc]').forEach(b => b.onclick = () => run(b.dataset.enc));
  document.getElementById('enc-copy').onclick  = () => copyText(document.getElementById('enc-output').value);
  document.getElementById('enc-swap').onclick  = () => {
    const i = document.getElementById('enc-input'), o = document.getElementById('enc-output');
    [i.value, o.value] = [o.value, i.value];
  };
  document.getElementById('enc-clear').onclick = () => {
    document.getElementById('enc-input').value = '';
    document.getElementById('enc-output').value = '';
  };
});

// ══════════════════════════════════════════════════════════
//  TOOL: QR CODE
// ══════════════════════════════════════════════════════════
reg('qr', () => {
  let libLoaded = false;
  function ensureLib(cb) {
    if (libLoaded) { cb(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
    s.onload = () => { libLoaded = true; cb(); };
    s.onerror = () => toast('⚠ Failed to load QR library (check internet)');
    document.head.appendChild(s);
  }
  document.getElementById('qr-generate').onclick = () => {
    const text = document.getElementById('qr-input').value.trim();
    if (!text) { toast('⚠ Enter text or URL'); return; }
    const size = +document.getElementById('qr-size').value || 256;
    ensureLib(() => {
      const c = document.getElementById('qr-output');
      c.innerHTML = '';
      try {
        new window.QRCode(c, {
          text, width: size, height: size,
          colorDark: document.getElementById('qr-fg').value,
          colorLight: document.getElementById('qr-bg').value,
          correctLevel: window.QRCode.CorrectLevel.H,
        });
        document.getElementById('qr-download').disabled = false;
      } catch(e) { c.textContent = '⚠ ' + e.message; }
    });
  };
  document.getElementById('qr-download').onclick = () => {
    const canvas = document.querySelector('#qr-output canvas');
    if (!canvas) return;
    const a = document.createElement('a');
    a.download = 'qrcode.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
  };
  document.getElementById('qr-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('qr-generate').click();
  });
});

// ══════════════════════════════════════════════════════════
//  TOOL: REGEX
// ══════════════════════════════════════════════════════════
reg('regex', () => {
  function test() {
    const pattern = document.getElementById('regex-pattern').value;
    const flags   = document.getElementById('regex-flags').value.replace(/[^gimsuy]/g,'');
    const text    = document.getElementById('regex-text').value;
    const info    = document.getElementById('regex-info');
    const out     = document.getElementById('regex-output');
    const grp     = document.getElementById('regex-groups');

    out.innerHTML = escH(text);
    grp.textContent = '';
    if (!pattern) { info.className='status-bar section'; info.textContent=''; return; }

    try {
      const re = new RegExp(pattern, flags.includes('g') ? flags : flags+'g');
      const matches = [];
      let m;
      while ((m = re.exec(text)) !== null) {
        matches.push({ i: m.index, len: m[0].length, val: m[0], groups: m.slice(1) });
        if (!flags.includes('g')) break;
        if (m[0].length === 0) re.lastIndex++;
      }

      let result = '', last = 0;
      matches.forEach(({i, len, val}) => {
        result += escH(text.slice(last, i));
        result += `<mark class="regex-match">${escH(val)}</mark>`;
        last = i + len;
      });
      result += escH(text.slice(last));
      out.innerHTML = result;

      if (!matches.length) {
        info.className = 'status-bar warning section'; info.textContent = '⚠ No matches';
      } else {
        info.className = 'status-bar success section';
        info.textContent = `✓ ${matches.length} match${matches.length>1?'es':''}`;
        grp.textContent = matches.slice(0,20).map((m,i) => {
          const base = `Match ${i+1}: "${m.val}" at index ${m.i}`;
          return m.groups.length ? base + ` | Groups: ${m.groups.map(g=>`"${g||''}"`).join(', ')}` : base;
        }).join('\n');
      }
    } catch(e) {
      info.className = 'status-bar error section'; info.textContent = '✗ Invalid regex: ' + e.message;
    }
  }

  document.getElementById('regex-pattern').addEventListener('input', test);
  document.getElementById('regex-flags').addEventListener('input', test);
  document.getElementById('regex-text').addEventListener('input', test);
  document.getElementById('regex-quick').addEventListener('change', function() {
    if (this.value) {
      document.getElementById('regex-pattern').value = this.value;
      this.value = '';
      test();
    }
  });
  document.getElementById('regex-clear').onclick = () => {
    ['regex-pattern','regex-text'].forEach(id => document.getElementById(id).value='');
    document.getElementById('regex-output').textContent='';
    document.getElementById('regex-groups').textContent='';
    document.getElementById('regex-info').className='status-bar section';
    document.getElementById('regex-info').textContent='';
  };
});

// ══════════════════════════════════════════════════════════
//  TOOL: COLOR  (completely rewritten)
// ══════════════════════════════════════════════════════════
reg('color', () => {

  /* ── Conversion helpers ── */
  function hexToRgb(hex) {
    hex = hex.replace('#','');
    if (hex.length === 3) hex = hex.split('').map(c=>c+c).join('');
    const n = parseInt(hex, 16);
    return { r:(n>>16)&255, g:(n>>8)&255, b:n&255 };
  }
  function rgbToHex({r,g,b}) {
    return '#' + [r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('').toUpperCase();
  }
  function rgbToHsl({r,g,b}) {
    r/=255; g/=255; b/=255;
    const max=Math.max(r,g,b), min=Math.min(r,g,b);
    let h=0, s=0, l=(max+min)/2;
    if (max!==min) {
      const d=max-min; s=l>0.5?d/(2-max-min):d/(max+min);
      switch(max){ case r:h=((g-b)/d+(g<b?6:0))/6;break; case g:h=((b-r)/d+2)/6;break; case b:h=((r-g)/d+4)/6;break; }
    }
    return { h:Math.round(h*360), s:Math.round(s*100), l:Math.round(l*100) };
  }
  function hslToRgb(h,s,l) {
    s/=100; l/=100;
    const k=n=>(n+h/30)%12, a=s*Math.min(l,1-l);
    const f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));
    return {r:Math.round(f(0)*255), g:Math.round(f(8)*255), b:Math.round(f(4)*255)};
  }
  function getLuminance({r,g,b}) {
    const lin=c=>{c/=255;return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4)};
    return 0.2126*lin(r)+0.7152*lin(g)+0.0722*lin(b);
  }

  /* ── Update picker tab ── */
  function updatePicker(hex) {
    hex = hex.toUpperCase();
    if (!/^#[0-9A-F]{6}$/i.test(hex)) return;
    const rgb = hexToRgb(hex);
    const hsl = rgbToHsl(rgb);

    document.getElementById('color-picker-main').value = hex.toLowerCase();
    document.getElementById('color-hex-input').value   = hex;
    document.getElementById('color-large-preview').style.backgroundColor = hex;

    document.getElementById('cv-hex-val').textContent = hex;
    document.getElementById('cv-rgb-val').textContent = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    document.getElementById('cv-hsl-val').textContent = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
    document.getElementById('cv-css-val').textContent = `--color: ${hex};`;
  }

  /* Picker events */
  document.getElementById('color-picker-main').addEventListener('input', function() {
    updatePicker(this.value);
  });
  document.getElementById('color-hex-input').addEventListener('input', function() {
    const v = this.value.trim();
    if (/^#[0-9a-f]{6}$/i.test(v)) updatePicker(v);
  });

  /* Copy value rows */
  document.getElementById('cv-hex').onclick = () => copyText(document.getElementById('cv-hex-val').textContent, 'HEX copied');
  document.getElementById('cv-rgb').onclick = () => copyText(document.getElementById('cv-rgb-val').textContent, 'RGB copied');
  document.getElementById('cv-hsl').onclick = () => copyText(document.getElementById('cv-hsl-val').textContent, 'HSL copied');
  document.getElementById('cv-css').onclick = () => copyText(document.getElementById('cv-css-val').textContent, 'CSS var copied');

  /* Copy all formats */
  document.getElementById('color-copy-all').onclick = () => {
    const hex = document.getElementById('cv-hex-val').textContent;
    const rgb = document.getElementById('cv-rgb-val').textContent;
    const hsl = document.getElementById('cv-hsl-val').textContent;
    copyText(`${hex}\n${rgb}\n${hsl}`, 'All formats copied');
  };

  /* ── Palette tab ── */
  document.getElementById('color-palette-btn').onclick = () => {
    const hex = document.getElementById('color-picker-palette').value;
    const scheme = document.getElementById('palette-scheme').value;
    const rgb = hexToRgb(hex);
    const {h,s,l} = rgbToHsl(rgb);
    let swatches = [];

    if (scheme === 'shades') {
      const steps = [95,80,65,50,35,20,10];
      swatches = steps.map(lv => ({
        hex: rgbToHex(hslToRgb(h,s,lv)),
        role: lv > l ? 'Tint' : lv < l ? 'Shade' : 'Base'
      }));
    } else if (scheme === 'analogous') {
      swatches = [-30,-15,0,15,30].map(d => ({ hex: rgbToHex(hslToRgb((h+d+360)%360,s,l)), role: d===0?'Base':d<0?'Cool':'Warm' }));
    } else if (scheme === 'complementary') {
      swatches = [0,60,120,180,240,300].map(d => ({ hex: rgbToHex(hslToRgb((h+d)%360,s,l)), role: d===0?'Base':d===180?'Complement':'' }));
    } else if (scheme === 'triadic') {
      swatches = [0,120,240].flatMap(d => [
        { hex: rgbToHex(hslToRgb((h+d)%360,s,l+15>95?l:l+15)), role:'Light' },
        { hex: rgbToHex(hslToRgb((h+d)%360,s,l)),               role: d===0?'Base':'' },
        { hex: rgbToHex(hslToRgb((h+d)%360,s,l-15<5?l:l-15)), role:'Dark' },
      ]);
    } else if (scheme === 'split') {
      swatches = [0,150,210].map(d => ({ hex: rgbToHex(hslToRgb((h+d)%360,s,l)), role: d===0?'Base':'' }));
    }

    document.getElementById('palette-out').innerHTML = swatches.map(sw => `
      <div class="pal-swatch" onclick="copyText('${sw.hex}','${sw.hex} copied')" title="Click to copy ${sw.hex}">
        <div class="pal-color" style="background:${sw.hex}"></div>
        <div class="pal-info">
          <div class="pal-hex">${sw.hex}</div>
          ${sw.role ? `<div class="pal-role">${sw.role}</div>` : ''}
        </div>
      </div>
    `).join('');
  };
  document.getElementById('color-picker-palette').addEventListener('input', () => {
    document.getElementById('color-palette-btn').click();
  });

  /* ── Contrast tab ── */
  function checkContrast() {
    const fg = document.getElementById('contrast-fg').value;
    const bg = document.getElementById('contrast-bg').value;
    document.getElementById('contrast-fg-hex').value = fg.toUpperCase();
    document.getElementById('contrast-bg-hex').value = bg.toUpperCase();

    const Lfg = getLuminance(hexToRgb(fg));
    const Lbg = getLuminance(hexToRgb(bg));
    const ratio = ((Math.max(Lfg,Lbg)+0.05)/(Math.min(Lfg,Lbg)+0.05)).toFixed(2);

    const chips = [
      { label:'AA Normal', pass: ratio>=4.5, req:'4.5:1' },
      { label:'AA Large',  pass: ratio>=3,   req:'3.0:1' },
      { label:'AAA Normal',pass: ratio>=7,   req:'7.0:1' },
      { label:'AAA Large', pass: ratio>=4.5, req:'4.5:1' },
    ];

    document.getElementById('contrast-result').innerHTML = `
      <div class="contrast-demo" style="background:${bg}">
        <div class="contrast-ratio" style="color:${fg}">${ratio}:1</div>
        <p style="color:${fg};font-size:1.1rem;font-weight:600">Large text sample</p>
        <p style="color:${fg};font-size:0.85rem">Normal text sample — The quick brown fox jumps over the lazy dog.</p>
        <div class="wcag-chips">
          ${chips.map(c=>`<span class="wcag-chip ${c.pass?'chip-pass':'chip-fail'}">${c.pass?'✓':'✗'} ${c.label} (${c.req})</span>`).join('')}
        </div>
      </div>
    `;
  }

  ['contrast-fg','contrast-bg'].forEach(id => document.getElementById(id).addEventListener('input', checkContrast));
  ['contrast-fg-hex','contrast-bg-hex'].forEach(id => {
    document.getElementById(id).addEventListener('input', function() {
      const v = this.value.trim();
      if (/^#[0-9a-f]{6}$/i.test(v)) {
        const key = id === 'contrast-fg-hex' ? 'contrast-fg' : 'contrast-bg';
        document.getElementById(key).value = v;
        checkContrast();
      }
    });
  });
  checkContrast();

  /* ── Gradient tab ── */
  function updateGrad() {
    const c1 = document.getElementById('grad-c1').value;
    const c2 = document.getElementById('grad-c2').value;
    const type = document.getElementById('grad-type').value;
    const deg = document.getElementById('grad-deg').value;
    let css;
    if (type === 'radial') css = `radial-gradient(circle, ${c1}, ${c2})`;
    else if (type === 'conic') css = `conic-gradient(from ${deg}deg, ${c1}, ${c2})`;
    else css = `linear-gradient(${deg}deg, ${c1}, ${c2})`;
    const full = `background: ${css};`;
    document.getElementById('grad-preview').style.background = css;
    document.getElementById('grad-css').value = full;
  }
  ['grad-c1','grad-c2','grad-type','grad-deg'].forEach(id =>
    document.getElementById(id).addEventListener('input', updateGrad)
  );
  document.getElementById('grad-copy-css').onclick = () => copyText(document.getElementById('grad-css').value);
  updateGrad();

  /* ── Tabs ── */
  document.querySelectorAll('[data-color-tab]').forEach(btn => {
    btn.onclick = function() {
      document.querySelectorAll('[data-color-tab]').forEach(b=>b.classList.remove('active'));
      document.querySelectorAll('.color-tab-panel').forEach(p=>p.classList.add('hidden'));
      this.classList.add('active');
      document.getElementById('color-tab-'+this.dataset.colorTab).classList.remove('hidden');
    };
  });

  /* Init */
  updatePicker('#3b82f6');
});

// ══════════════════════════════════════════════════════════
//  TOOL: TIMESTAMP
// ══════════════════════════════════════════════════════════
reg('timestamp', () => {
  function relTime(date) {
    const diff = Date.now() - date.getTime();
    const abs = Math.abs(diff);
    const s = Math.floor(abs/1000), m=Math.floor(s/60), h=Math.floor(m/60),
          d=Math.floor(h/24), mo=Math.floor(d/30), y=Math.floor(d/365);
    const fmt = y?`${y}y`:mo?`${mo}mo`:d?`${d}d`:h?`${h}h`:m?`${m}m`:`${s}s`;
    return diff>0 ? `${fmt} ago` : `in ${fmt}`;
  }

  function convert() {
    const v = document.getElementById('ts-input').value.trim();
    const out = document.getElementById('ts-output');
    if (!v) { out.innerHTML=''; return; }

    let date;
    if (/^\d{1,13}$/.test(v)) {
      date = new Date(v.length<=10 ? +v*1000 : +v);
    } else {
      date = new Date(v);
    }
    if (isNaN(date)) {
      out.innerHTML = '<div class="status-bar error">✗ Invalid date or timestamp</div>';
      return;
    }

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const rows = [
      ['Unix (s)',      Math.floor(date.getTime()/1000)],
      ['Unix (ms)',     date.getTime()],
      ['ISO 8601',      date.toISOString()],
      ['UTC',           date.toUTCString()],
      ['Local',         date.toLocaleString()],
      ['Date',          date.toLocaleDateString()],
      ['Time',          date.toLocaleTimeString()],
      ['Day',           date.toLocaleDateString('en-US',{weekday:'long'})],
      ['Timezone',      tz],
      ['Relative',      relTime(date)],
    ];
    out.innerHTML = rows.map(([lbl,val])=>`
      <div class="ts-row">
        <span class="ts-label">${lbl}</span>
        <div class="flex gap-2 items-center">
          <span class="ts-value">${val}</span>
          <button class="btn btn-ghost" style="padding:2px 8px;font-size:0.66rem" onclick="copyText('${String(val).replace(/'/g,"\\'")}')" >copy</button>
        </div>
      </div>
    `).join('');
  }

  document.getElementById('ts-now').onclick     = () => { document.getElementById('ts-input').value=Math.floor(Date.now()/1000); convert(); };
  document.getElementById('ts-convert').onclick = convert;
  document.getElementById('ts-input').addEventListener('keydown', e => { if(e.key==='Enter') convert(); });
  document.getElementById('ts-input').addEventListener('input',   convert);

  document.getElementById('ts-input').value = Math.floor(Date.now()/1000);
  convert();
});

// ══════════════════════════════════════════════════════════
//  TOOL: HASH
// ══════════════════════════════════════════════════════════
reg('hash', () => {
  async function sha(text, algo) {
    const data = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest(algo, data);
    return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }

  /* Pure JS MD5 (minimal) */
  function md5(str) {
    function sl(x,y){const l=(x&0xFFFF)+(y&0xFFFF);return(((x>>16)+(y>>16)+(l>>16))<<16)|(l&0xFFFF)}
    function rl(n,c){return(n<<c)|(n>>>(32-c))}
    function cm(q,a,b,x,s,t){return sl(rl(sl(sl(a,q),sl(x,t)),s),b)}
    function ff(a,b,c,d,x,s,t){return cm((b&c)|((~b)&d),a,b,x,s,t)}
    function gg(a,b,c,d,x,s,t){return cm((b&d)|(c&(~d)),a,b,x,s,t)}
    function hh(a,b,c,d,x,s,t){return cm(b^c^d,a,b,x,s,t)}
    function ii(a,b,c,d,x,s,t){return cm(c^(b|(~d)),a,b,x,s,t)}
    const bs=[];
    for(let i=0;i<str.length;i++){const c=str.charCodeAt(i);if(c<128)bs.push(c);else if(c<2048){bs.push((c>>6)|192);bs.push((c&63)|128)}else{bs.push((c>>12)|224);bs.push(((c>>6)&63)|128);bs.push((c&63)|128)}}
    const ln=bs.length*8;bs.push(0x80);while(bs.length%64!==56)bs.push(0);
    bs.push(ln&0xFF,(ln>>8)&0xFF,(ln>>16)&0xFF,(ln>>24)&0xFF,0,0,0,0);
    const M=[];for(let i=0;i<bs.length;i+=4)M.push(bs[i]|(bs[i+1]<<8)|(bs[i+2]<<16)|(bs[i+3]<<24));
    let a=0x67452301,b=0xEFCDAB89,c=0x98BADCFE,d=0x10325476;
    for(let i=0;i<M.length;i+=16){
      const[aa,bb,cc,dd]=[a,b,c,d];
      a=ff(a,b,c,d,M[i],7,-680876936);d=ff(d,a,b,c,M[i+1],12,-389564586);c=ff(c,d,a,b,M[i+2],17,606105819);b=ff(b,c,d,a,M[i+3],22,-1044525330);
      a=ff(a,b,c,d,M[i+4],7,-176418897);d=ff(d,a,b,c,M[i+5],12,1200080426);c=ff(c,d,a,b,M[i+6],17,-1473231341);b=ff(b,c,d,a,M[i+7],22,-45705983);
      a=ff(a,b,c,d,M[i+8],7,1770035416);d=ff(d,a,b,c,M[i+9],12,-1958414417);c=ff(c,d,a,b,M[i+10],17,-42063);b=ff(b,c,d,a,M[i+11],22,-1990404162);
      a=ff(a,b,c,d,M[i+12],7,1804603682);d=ff(d,a,b,c,M[i+13],12,-40341101);c=ff(c,d,a,b,M[i+14],17,-1502002290);b=ff(b,c,d,a,M[i+15],22,1236535329);
      a=gg(a,b,c,d,M[i+1],5,-165796510);d=gg(d,a,b,c,M[i+6],9,-1069501632);c=gg(c,d,a,b,M[i+11],14,643717713);b=gg(b,c,d,a,M[i],20,-373897302);
      a=gg(a,b,c,d,M[i+5],5,-701558691);d=gg(d,a,b,c,M[i+10],9,38016083);c=gg(c,d,a,b,M[i+15],14,-660478335);b=gg(b,c,d,a,M[i+4],20,-405537848);
      a=gg(a,b,c,d,M[i+9],5,568446438);d=gg(d,a,b,c,M[i+14],9,-1019803690);c=gg(c,d,a,b,M[i+3],14,-187363961);b=gg(b,c,d,a,M[i+8],20,1163531501);
      a=gg(a,b,c,d,M[i+13],5,-1444681467);d=gg(d,a,b,c,M[i+2],9,-51403784);c=gg(c,d,a,b,M[i+7],14,1735328473);b=gg(b,c,d,a,M[i+12],20,-1926607734);
      a=hh(a,b,c,d,M[i+5],4,-378558);d=hh(d,a,b,c,M[i+8],11,-2022574463);c=hh(c,d,a,b,M[i+11],16,1839030562);b=hh(b,c,d,a,M[i+14],23,-35309556);
      a=hh(a,b,c,d,M[i+1],4,-1530992060);d=hh(d,a,b,c,M[i+4],11,1272893353);c=hh(c,d,a,b,M[i+7],16,-155497632);b=hh(b,c,d,a,M[i+10],23,-1094730640);
      a=hh(a,b,c,d,M[i+13],4,681279174);d=hh(d,a,b,c,M[i],11,-358537222);c=hh(c,d,a,b,M[i+3],16,-722521979);b=hh(b,c,d,a,M[i+6],23,76029189);
      a=hh(a,b,c,d,M[i+9],4,-640364487);d=hh(d,a,b,c,M[i+12],11,-421815835);c=hh(c,d,a,b,M[i+15],16,530742520);b=hh(b,c,d,a,M[i+2],23,-995338651);
      a=ii(a,b,c,d,M[i],6,-198630844);d=ii(d,a,b,c,M[i+7],10,1126891415);c=ii(c,d,a,b,M[i+14],15,-1416354905);b=ii(b,c,d,a,M[i+5],21,-57434055);
      a=ii(a,b,c,d,M[i+12],6,1700485571);d=ii(d,a,b,c,M[i+3],10,-1894986606);c=ii(c,d,a,b,M[i+10],15,-1051523);b=ii(b,c,d,a,M[i+1],21,-2054922799);
      a=ii(a,b,c,d,M[i+8],6,1873313359);d=ii(d,a,b,c,M[i+15],10,-30611744);c=ii(c,d,a,b,M[i+6],15,-1560198380);b=ii(b,c,d,a,M[i+13],21,1309151649);
      a=ii(a,b,c,d,M[i+4],6,-145523070);d=ii(d,a,b,c,M[i+11],10,-1120210379);c=ii(c,d,a,b,M[i+2],15,718787259);b=ii(b,c,d,a,M[i+9],21,-343485551);
      a=sl(a,aa);b=sl(b,bb);c=sl(c,cc);d=sl(d,dd);
    }
    return [a,b,c,d].map(n=>(((n&0xFF)<<24)|((n>>8&0xFF)<<16)|((n>>16&0xFF)<<8)|(n>>>24)).toString(16).padStart(8,'0')).join('');
  }

  async function compute() {
    const input = document.getElementById('hash-input').value;
    if (!input) return;
    const [m, s1, s2, s5] = await Promise.all([
      Promise.resolve(md5(input)),
      sha(input,'SHA-1'),
      sha(input,'SHA-256'),
      sha(input,'SHA-512'),
    ]);
    document.getElementById('hash-md5').textContent    = m;
    document.getElementById('hash-sha1').textContent   = s1;
    document.getElementById('hash-sha256').textContent = s2;
    document.getElementById('hash-sha512').textContent = s5;
  }

  document.getElementById('hash-input').addEventListener('input', compute);
  document.getElementById('hash-compute').onclick = compute;
  document.getElementById('hash-clear').onclick = () => {
    document.getElementById('hash-input').value='';
    ['md5','sha1','sha256','sha512'].forEach(h=>document.getElementById('hash-'+h).textContent='—');
  };
  ['md5','sha1','sha256','sha512'].forEach(h =>
    document.getElementById('hash-copy-'+h).onclick = () =>
      copyText(document.getElementById('hash-'+h).textContent)
  );
});

// ══════════════════════════════════════════════════════════
//  TOOL: UNIT CONVERTER
// ══════════════════════════════════════════════════════════
reg('units', () => {
  const UNITS = {
    length: {
      m:  {label:'Meter (m)',       f:1},
      km: {label:'Kilometer (km)',  f:1000},
      cm: {label:'Centimeter (cm)',f:0.01},
      mm: {label:'Millimeter (mm)',f:0.001},
      mi: {label:'Mile (mi)',       f:1609.344},
      yd: {label:'Yard (yd)',       f:0.9144},
      ft: {label:'Foot (ft)',       f:0.3048},
      in: {label:'Inch (in)',       f:0.0254},
      nm: {label:'Nautical mile',   f:1852},
    },
    weight: {
      kg:  {label:'Kilogram (kg)',  f:1},
      g:   {label:'Gram (g)',       f:0.001},
      mg:  {label:'Milligram (mg)', f:0.000001},
      lb:  {label:'Pound (lb)',     f:0.453592},
      oz:  {label:'Ounce (oz)',     f:0.0283495},
      st:  {label:'Stone (st)',     f:6.35029},
      t:   {label:'Metric ton (t)', f:1000},
    },
    temp: {
      c:  {label:'Celsius (°C)'},
      f:  {label:'Fahrenheit (°F)'},
      k:  {label:'Kelvin (K)'},
    },
    data: {
      b:   {label:'Byte (B)',       f:1},
      kb:  {label:'Kilobyte (KB)',  f:1024},
      mb:  {label:'Megabyte (MB)',  f:1048576},
      gb:  {label:'Gigabyte (GB)',  f:1073741824},
      tb:  {label:'Terabyte (TB)',  f:1099511627776},
      bit: {label:'Bit',            f:0.125},
      kib: {label:'Kibibyte (KiB)', f:1024},
    },
    time: {
      ms:  {label:'Millisecond',    f:0.001},
      s:   {label:'Second (s)',     f:1},
      min: {label:'Minute (min)',   f:60},
      hr:  {label:'Hour (hr)',      f:3600},
      day: {label:'Day',            f:86400},
      wk:  {label:'Week',           f:604800},
      mo:  {label:'Month (avg)',    f:2629800},
      yr:  {label:'Year',           f:31557600},
    },
    area: {
      m2:  {label:'Sq. Meter (m²)',  f:1},
      km2: {label:'Sq. Kilometer',   f:1e6},
      cm2: {label:'Sq. Centimeter',  f:0.0001},
      ft2: {label:'Sq. Foot',        f:0.092903},
      in2: {label:'Sq. Inch',        f:0.00064516},
      ac:  {label:'Acre',            f:4046.86},
      ha:  {label:'Hectare (ha)',    f:10000},
    },
    speed: {
      ms:   {label:'m/s',           f:1},
      kph:  {label:'km/h',          f:0.277778},
      mph:  {label:'mph',           f:0.44704},
      kt:   {label:'Knot (kt)',      f:0.514444},
      fps:  {label:'ft/s',          f:0.3048},
    },
  };

  function populateFrom(cat) {
    const sel = document.getElementById('unit-from');
    sel.innerHTML = Object.entries(UNITS[cat]).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('');
  }

  function convertTemp(val, from) {
    let celsius;
    if (from==='c') celsius=val;
    else if (from==='f') celsius=(val-32)*5/9;
    else celsius=val-273.15;
    return {
      c: {val:celsius,           label:'Celsius (°C)'},
      f: {val:celsius*9/5+32,    label:'Fahrenheit (°F)'},
      k: {val:celsius+273.15,    label:'Kelvin (K)'},
    };
  }

  function doConvert() {
    const cat  = document.getElementById('unit-category').value;
    const from = document.getElementById('unit-from').value;
    const val  = parseFloat(document.getElementById('unit-value').value);
    const out  = document.getElementById('unit-results');
    if (isNaN(val)) { out.innerHTML='<span style="color:var(--text-3);font-family:var(--font-mono);font-size:0.78rem">Enter a numeric value</span>'; return; }

    let rows;
    if (cat === 'temp') {
      const res = convertTemp(val, from);
      rows = Object.entries(res).map(([k,v])=>`
        <div class="unit-row">
          <span class="unit-lbl">${v.label}</span>
          <div class="flex gap-2 items-center">
            <span class="unit-val">${+v.val.toFixed(6)}</span>
            <button class="btn btn-ghost" style="padding:2px 7px;font-size:0.65rem" onclick="copyText('${+v.val.toFixed(6)}')">copy</button>
          </div>
        </div>
      `);
    } else {
      const units = UNITS[cat];
      const baseVal = val * units[from].f;
      rows = Object.entries(units).map(([k,u])=>{
        const conv = +(baseVal / u.f).toFixed(8);
        return `
          <div class="unit-row">
            <span class="unit-lbl">${u.label}</span>
            <div class="flex gap-2 items-center">
              <span class="unit-val">${conv.toLocaleString('en-US',{maximumSignificantDigits:8})}</span>
              <button class="btn btn-ghost" style="padding:2px 7px;font-size:0.65rem" onclick="copyText('${conv}')">copy</button>
            </div>
          </div>
        `;
      });
    }
    out.innerHTML = rows.join('');
  }

  document.getElementById('unit-category').addEventListener('change', function() { populateFrom(this.value); doConvert(); });
  document.getElementById('unit-from').addEventListener('change', doConvert);
  document.getElementById('unit-value').addEventListener('input', doConvert);
  document.getElementById('unit-convert').onclick = doConvert;
  document.getElementById('unit-clear').onclick = () => {
    document.getElementById('unit-value').value = '1';
    document.getElementById('unit-results').innerHTML = '';
  };

  populateFrom('length');
  doConvert();
});

// ══════════════════════════════════════════════════════════
//  TOOL: UUID
// ══════════════════════════════════════════════════════════
reg('uuid', () => {
  function uuid4() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{
      const r=Math.random()*16|0; return(c==='x'?r:(r&0x3|0x8)).toString(16);
    });
  }
  function gen() {
    const n = Math.min(100, Math.max(1, +document.getElementById('uuid-count').value||1));
    const fmt = document.getElementById('uuid-format').value;
    const uuids = Array.from({length:n}, () => {
      let u = uuid4();
      if (fmt==='upper')    u = u.toUpperCase();
      if (fmt==='braces')   u = `{${u}}`;
      if (fmt==='no-dashes')u = u.replace(/-/g,'');
      return u;
    });
    document.getElementById('uuid-output').value = uuids.join('\n');
  }
  document.getElementById('uuid-generate').onclick = gen;
  document.getElementById('uuid-copy').onclick  = () => copyText(document.getElementById('uuid-output').value);
  document.getElementById('uuid-clear').onclick = () => { document.getElementById('uuid-output').value=''; };
  gen();
});

// ══════════════════════════════════════════════════════════
//  TOOL: LOREM
// ══════════════════════════════════════════════════════════
reg('lorem', () => {
  const W = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt in culpa qui officia deserunt mollit anim id est laborum'.split(' ');
  const sent = () => { const l=6+Math.random()*14|0, s=Math.random()*(W.length-l)|0, ws=W.slice(s,s+l); ws[0]=ws[0][0].toUpperCase()+ws[0].slice(1); return ws.join(' ')+'.'; };
  const para = () => Array.from({length:3+Math.random()*4|0},sent).join(' ');
  function gen() {
    const type=document.getElementById('lorem-type').value, n=+document.getElementById('lorem-count').value||1;
    let out;
    if (type==='words') out=W.slice(0,n).join(' ');
    else if (type==='sentences') out=Array.from({length:n},sent).join(' ');
    else out=Array.from({length:n},para).join('\n\n');
    document.getElementById('lorem-output').value=out;
  }
  document.getElementById('lorem-generate').onclick=gen;
  document.getElementById('lorem-copy').onclick=()=>copyText(document.getElementById('lorem-output').value);
  gen();
});

// ══════════════════════════════════════════════════════════
//  TOOL: WORD COUNT
// ══════════════════════════════════════════════════════════
reg('wordcount', () => {
  function update() {
    const t=document.getElementById('wc-input').value;
    document.getElementById('wc-words').textContent     = (t.trim()? t.trim().split(/\s+/).length:0).toLocaleString();
    document.getElementById('wc-chars').textContent     = t.length.toLocaleString();
    document.getElementById('wc-chars-ns').textContent  = t.replace(/\s/g,'').length.toLocaleString();
    document.getElementById('wc-lines').textContent     = (t?t.split('\n').length:0).toLocaleString();
    document.getElementById('wc-sentences').textContent = (t.match(/[.!?]+/g)||[]).length.toLocaleString();
    const wc = t.trim() ? t.trim().split(/\s+/).length : 0;
    document.getElementById('wc-reading').textContent   = Math.ceil(wc/200)+'m';
  }
  document.getElementById('wc-input').addEventListener('input', update);
  document.getElementById('wc-clear').onclick = () => { document.getElementById('wc-input').value=''; update(); };
  document.getElementById('wc-copy').onclick  = () => copyText(document.getElementById('wc-input').value);
});

// ══════════════════════════════════════════════════════════
//  TOOL: CASE
// ══════════════════════════════════════════════════════════
reg('case', () => {
  function convert(type) {
    const v=document.getElementById('case-input').value;
    let o=v;
    switch(type){
      case 'upper':    o=v.toUpperCase(); break;
      case 'lower':    o=v.toLowerCase(); break;
      case 'title':    o=v.replace(/\b\w/g,c=>c.toUpperCase()); break;
      case 'sentence': o=v.toLowerCase().replace(/(^\s*\w|[.!?]\s+\w)/g,c=>c.toUpperCase()); break;
      case 'camel':    o=v.toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g,(_,c)=>c.toUpperCase()); break;
      case 'pascal':   o=v.toLowerCase().replace(/(^.|[^a-zA-Z0-9]+.)/g,(_,c)=>c.replace(/[^a-zA-Z0-9]/g,'').toUpperCase()); break;
      case 'snake':    o=v.toLowerCase().replace(/[^a-zA-Z0-9]+/g,'_').replace(/^_|_$/g,''); break;
      case 'kebab':    o=v.toLowerCase().replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,''); break;
      case 'dot':      o=v.toLowerCase().replace(/[^a-zA-Z0-9]+/g,'.').replace(/^\.|\.$/g,''); break;
      case 'const':    o=v.toUpperCase().replace(/[^a-zA-Z0-9]+/g,'_').replace(/^_|_$/g,''); break;
      case 'reverse':  o=v.split('').reverse().join(''); break;
      case 'alt':      o=v.split('').map((c,i)=>i%2?c.toLowerCase():c.toUpperCase()).join(''); break;
    }
    document.getElementById('case-output').value=o;
  }
  document.querySelectorAll('[data-case]').forEach(b=>b.onclick=()=>convert(b.dataset.case));
  document.getElementById('case-copy').onclick  = ()=>copyText(document.getElementById('case-output').value);
  document.getElementById('case-swap').onclick  = ()=>{const i=document.getElementById('case-input'),o=document.getElementById('case-output');[i.value,o.value]=[o.value,i.value];};
  document.getElementById('case-clear').onclick = ()=>{document.getElementById('case-input').value='';document.getElementById('case-output').value='';};
});

// ══════════════════════════════════════════════════════════
//  BOOT
// ══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  applyTheme(S.theme);

  // Theme toggle
  document.getElementById('theme-toggle').onclick = toggleTheme;

  // Sidebar
  document.getElementById('menu-toggle').onclick   = toggleSidebar;
  document.getElementById('sidebar-overlay').onclick = closeSidebar;

  // Nav items (click + keyboard)
  document.querySelectorAll('[data-tool]').forEach(el => {
    el.addEventListener('click',    () => navigate(el.dataset.tool));
    el.addEventListener('keydown',  e => { if(e.key==='Enter'||e.key===' ') navigate(el.dataset.tool); });
  });

  // Command palette
  document.getElementById('cmd-trigger').onclick = openCmd;
  document.getElementById('cmd-overlay').addEventListener('click', e => { if(e.target===document.getElementById('cmd-overlay')) closeCmd(); });
  document.getElementById('cmd-input').addEventListener('input', function() { renderCmd(this.value); });
  document.getElementById('cmd-input').addEventListener('keydown', e => {
    const items = [...document.querySelectorAll('.cmd-item')];
    if (!items.length) return;
    if (e.key==='ArrowDown') { e.preventDefault(); cmdIdx=(cmdIdx+1)%items.length; }
    if (e.key==='ArrowUp')   { e.preventDefault(); cmdIdx=(cmdIdx-1+items.length)%items.length; }
    if (e.key==='Enter')     { const sel=items[cmdIdx]; if(sel){navigate(sel.dataset.id);closeCmd();} }
    if (e.key==='Escape')    closeCmd();
    items.forEach((x,i)=>x.classList.toggle('selected',i===cmdIdx));
  });

  // Global keyboard shortcuts
  document.addEventListener('keydown', e => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key==='k') { e.preventDefault(); openCmd(); }
    if (e.key==='Escape') { closeCmd(); closeSidebar(); }
  });

  // PWA
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});

  // Navigate
  navigate(S.tool);
});
