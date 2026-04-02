// ===== Login System =====
let currentUser = null;
(function() {
  const LOGIN_KEY = 'numberTracker_loggedIn';
  const USER_KEY = 'numberTracker_currentUser';
  const VALID_USERS = {
    'Tana': '27d29d',
    'Zena': '2a8c95',
    'Minn': '24a422'
  };
  function simpleHash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    }
    return (h >>> 0).toString(16);
  }
  const welcomeScreen = document.getElementById('welcomeScreen');
  const loginScreen = document.getElementById('loginScreen');
  const mainApp = document.getElementById('mainApp');
  if (sessionStorage.getItem(LOGIN_KEY) === 'true' && sessionStorage.getItem(USER_KEY)) {
    currentUser = sessionStorage.getItem(USER_KEY);
    welcomeScreen.style.display = 'none';
    loginScreen.style.display = 'none';
    mainApp.style.display = '';
  }
  // Welcome → Login
  document.getElementById('welcomeEnterBtn').addEventListener('click', function() {
    welcomeScreen.classList.add('fade-out');
    setTimeout(function() { welcomeScreen.style.display = 'none'; }, 500);
  });
  document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const user = document.getElementById('loginUser').value.trim();
    const pass = document.getElementById('loginPass').value;
    if (VALID_USERS[user] && simpleHash(pass) === VALID_USERS[user]) {
      currentUser = user;
      sessionStorage.setItem(LOGIN_KEY, 'true');
      sessionStorage.setItem(USER_KEY, user);
      loginScreen.style.display = 'none';
      mainApp.style.display = '';
    } else {
      document.getElementById('loginError').style.display = 'block';
    }
  });
})();

// ===== Number Tracker - App Logic =====

const STORAGE_KEY = 'numberTracker_entries';
const GROUPS_KEY = 'numberTracker_groups';
const THEME_KEY = 'numberTracker_theme';

// Category type mapping
const INCOME_CATEGORIES = ['เงินเข้า'];
const EXPENSE_CATEGORIES = ['เงินออก'];
const WORK_PREFIX = 'ค่างาน:';

// ===== State =====
let entries = [];
let groups = [];

// ===== DOM Elements =====
const $ = (sel) => document.querySelector(sel);
const entryForm = $('#entryForm');
const groupForm = $('#groupForm');
const entriesList = $('#entriesList');
const searchInput = $('#searchInput');
const filterType = $('#filterType');
const filterMonth = $('#filterMonth');
const themeToggle = $('#themeToggle');
const exportBtn = $('#exportBtn');
const clearBtn = $('#clearBtn');
const entryGroup = $('#entryGroup');

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
  loadTheme();
  loadEntries();
  loadGroups();
  setDefaultDate();
  populateMonthFilter();
  populateGroupDropdown();
  renderEntries();
  updateSummary();

  // Sync from cloud then start realtime listener
  loadFromCloud().then(hasData => {
    if (hasData) {
      populateMonthFilter();
      populateGroupDropdown();
      renderEntries();
      updateSummary();
      renderScoreLeaderboard();
      renderScoreHistory();
      updateMemberScores();
      showToast('☁️ ซิงค์ข้อมูลจากคลาวด์แล้ว');
    }
    startRealtimeSync();
  });
});

// ===== Theme =====
function loadTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    themeToggle.textContent = '☀️';
  }
}

themeToggle.addEventListener('click', () => {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  if (isDark) {
    document.documentElement.removeAttribute('data-theme');
    themeToggle.textContent = '🌙';
    localStorage.setItem(THEME_KEY, 'light');
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    themeToggle.textContent = '☀️';
    localStorage.setItem(THEME_KEY, 'dark');
  }
});

// ===== Data Persistence =====
function loadEntries() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    entries = data ? JSON.parse(data) : [];
    if (!Array.isArray(entries)) entries = [];
  } catch {
    entries = [];
  }
}

function saveEntries() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  syncToCloud();
}

function loadGroups() {
  try {
    const data = localStorage.getItem(GROUPS_KEY);
    groups = data ? JSON.parse(data) : [];
    if (!Array.isArray(groups)) groups = [];
  } catch {
    groups = [];
  }
}

function saveGroups() {
  localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
  syncToCloud();
}

// ===== Firebase Cloud Sync (Realtime Database) =====
let syncTimeout = null;
let lastSyncTime = 0;
let isSyncing = false;

function syncToCloud() {
  if (!window.rtdb) return;
  clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => {
    isSyncing = true;
    lastSyncTime = Date.now();
    localStorage.setItem('numberTracker_syncTime', String(lastSyncTime));
    window.rtdb.ref('shared').set({
      entries: JSON.stringify(entries),
      groups: JSON.stringify(groups),
      scores: JSON.stringify(scores),
      updatedAt: lastSyncTime
    }).then(() => { isSyncing = false; }).catch(() => { isSyncing = false; });
  }, 500);
}

function loadFromCloud() {
  if (!window.rtdb) return Promise.resolve(false);
  return window.rtdb.ref('shared').once('value').then(snapshot => {
    const data = snapshot.val();
    if (data) {
      return applyCloudData(data);
    }
    return false;
  }).catch(() => false);
}

function applyCloudData(data) {
  const cloudEntries = JSON.parse(data.entries || '[]');
  const cloudGroups = JSON.parse(data.groups || '[]');
  const cloudScores = JSON.parse(data.scores || '[]');
  const cloudTime = data.updatedAt || 0;

  if (cloudTime <= lastSyncTime) return false;

  const localTime = Number(localStorage.getItem('numberTracker_syncTime') || '0');

  if (entries.length === 0 && groups.length === 0) {
    // Local is empty — take cloud entirely
    entries = cloudEntries;
    groups = cloudGroups;
    scores = cloudScores;
  } else if (cloudTime > localTime) {
    // Cloud is newer — replace local with cloud
    entries = cloudEntries;
    groups = cloudGroups;
    scores = cloudScores;
  } else {
    return false;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
  localStorage.setItem(SCORES_KEY, JSON.stringify(scores));
  localStorage.setItem('numberTracker_syncTime', String(cloudTime));
  lastSyncTime = cloudTime;
  return true;
}

function startRealtimeSync() {
  if (!window.rtdb) return;
  window.rtdb.ref('shared').on('value', snapshot => {
    const data = snapshot.val();
    if (!data || isSyncing) return;
    if (data.updatedAt <= lastSyncTime) return;

    if (applyCloudData(data)) {
      populateMonthFilter();
      populateGroupDropdown();
      renderEntries();
      updateSummary();
      renderScoreLeaderboard();
      renderScoreHistory();
      updateMemberScores();
      showToast('☁️ ข้อมูลอัปเดตจากอุปกรณ์อื่น');
    }
  });
}

// ===== Helpers =====
function getCategoryType(category) {
  if (INCOME_CATEGORIES.includes(category)) return 'income';
  if (category && category.startsWith(WORK_PREFIX)) return 'work';
  return 'expense';
}

function formatNumber(num) {
  return Number(num).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatDate(dateStr, timeStr) {
  const d = new Date(dateStr + 'T00:00:00');
  let result = d.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
  if (timeStr) result += ` ${timeStr} น.`;
  return result;
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function setDefaultDate() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const hh = String(today.getHours()).padStart(2, '0');
  const mi = String(today.getMinutes()).padStart(2, '0');
  $('#entryDate').value = `${yyyy}-${mm}-${dd}`;
  $('#entryTime').value = `${hh}:${mi}`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ===== Toast =====
function showToast(message) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

// ===== Summary =====
function updateSummary() {
  let income = 0, expense = 0, work = 0;

  entries.forEach(e => {
    const type = getCategoryType(e.category);
    const amount = Number(e.amount);
    if (type === 'income') income += amount;
    else if (type === 'work') work += amount;
    else expense += amount;
  });

  $('#totalIncome').textContent = formatNumber(income);
  $('#totalExpense').textContent = formatNumber(expense);
  $('#totalWork').textContent = formatNumber(work);

  const net = income - expense - work;
  const netEl = $('#totalNet');
  netEl.textContent = (net >= 0 ? '+' : '') + formatNumber(net);
  netEl.style.color = net >= 0 ? 'var(--income)' : 'var(--expense)';
}

// ===== Group Dropdown =====
function populateGroupDropdown() {
  entryGroup.innerHTML = '<option value="">-- ไม่มีกลุ่ม (รายการเดี่ยว) --</option>';
  groups.forEach(g => {
    const opt = document.createElement('option');
    opt.value = g.id;
    opt.textContent = `📁 ${g.name}`;
    entryGroup.appendChild(opt);
  });
}

// ===== Month Filter =====
function populateMonthFilter() {
  const months = new Set();
  entries.forEach(e => {
    if (e.date) {
      const ym = e.date.slice(0, 7); // YYYY-MM
      months.add(ym);
    }
  });

  const sorted = [...months].sort().reverse();

  filterMonth.innerHTML = '<option value="all">ทุกเดือน</option>';
  sorted.forEach(ym => {
    const [y, m] = ym.split('-');
    const d = new Date(Number(y), Number(m) - 1);
    const label = d.toLocaleDateString('th-TH', { year: 'numeric', month: 'long' });
    const opt = document.createElement('option');
    opt.value = ym;
    opt.textContent = label;
    filterMonth.appendChild(opt);
  });
}

// ===== Render Entries =====
function getFilteredEntries() {
  let filtered = [...entries];

  // Type filter
  const type = filterType.value;
  if (type !== 'all') {
    filtered = filtered.filter(e => getCategoryType(e.category) === type);
  }

  // Month filter
  const month = filterMonth.value;
  if (month !== 'all') {
    filtered = filtered.filter(e => e.date && e.date.startsWith(month));
  }

  // Search
  const query = searchInput.value.trim().toLowerCase();
  if (query) {
    filtered = filtered.filter(e =>
      e.name.toLowerCase().includes(query) ||
      e.category.toLowerCase().includes(query) ||
      (e.note && e.note.toLowerCase().includes(query))
    );
  }

  // Sort by date (newest first), then by creation order
  filtered.sort((a, b) => {
    const dateDiff = (b.date || '').localeCompare(a.date || '');
    if (dateDiff !== 0) return dateDiff;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  return filtered;
}

function renderEntries() {
  const filtered = getFilteredEntries();

  if (filtered.length === 0 && groups.length === 0) {
    entriesList.innerHTML = `
      <p class="empty-state">
        ${entries.length > 0 ? '🔍 ไม่พบรายการที่ตรงกับตัวกรอง' : '📭 ยังไม่มีรายการ — เพิ่มรายการแรกเลย!'}
      </p>`;
    return;
  }

  let html = '';

  // Render groups
  groups.forEach(g => {
    const groupEntries = filtered.filter(e => e.groupId === g.id);
    const allGroupEntries = entries.filter(e => e.groupId === g.id);
    const groupTotal = allGroupEntries.reduce((sum, e) => {
      const type = getCategoryType(e.category);
      return type === 'income' ? sum + Number(e.amount) : sum - Number(e.amount);
    }, 0);
    const totalClass = groupTotal >= 0 ? 'income' : 'expense';

    html += `
      <div class="group-card" data-group-id="${escapeHtml(g.id)}">
        <div class="group-header" data-group-id="${escapeHtml(g.id)}">
          <div class="group-header-left">
            <span class="group-toggle">▶</span>
            <span class="group-name">${escapeHtml(g.name)}</span>
            <span class="group-count">${allGroupEntries.length} รายการ</span>
          </div>
          <div class="group-header-right">
            <span class="group-total" style="color: var(--${totalClass})">${groupTotal >= 0 ? '+' : ''}${formatNumber(Math.abs(groupTotal))}</span>
            <button class="btn-delete-group" title="ลบกลุ่ม" data-group-id="${escapeHtml(g.id)}">✕</button>
          </div>
        </div>
        <div class="group-body" data-group-body="${escapeHtml(g.id)}">
          ${groupEntries.length === 0
            ? '<p class="empty-sub">ยังไม่มีรายการย่อยในกลุ่มนี้</p>'
            : groupEntries.map(e => renderEntryItem(e)).join('')
          }
        </div>
      </div>`;
  });

  // Render standalone entries (no group)
  const standalone = filtered.filter(e => !e.groupId);
  if (standalone.length > 0) {
    if (groups.length > 0) {
      html += '<div class="standalone-label">รายการเดี่ยว</div>';
    }
    html += standalone.map(e => renderEntryItem(e)).join('');
  }

  if (!html) {
    html = '<p class="empty-state">🔍 ไม่พบรายการที่ตรงกับตัวกรอง</p>';
  }

  entriesList.innerHTML = html;
}

function renderEntryItem(e) {
  const type = getCategoryType(e.category);
  const noteHtml = e.note ? ` · ${escapeHtml(e.note)}` : '';
  const addedByHtml = e.addedBy ? ` · 👤 ${escapeHtml(e.addedBy)}` : '';
  // Display work category nicely: "ค่างาน:ค่าช่างภาพ" → "💼 ค่าช่างภาพ"
  let displayCategory = e.category;
  if (e.category && e.category.startsWith(WORK_PREFIX)) {
    displayCategory = '💼 ' + e.category.slice(WORK_PREFIX.length);
  }
  return `
    <div class="entry-item" data-id="${escapeHtml(e.id)}">
      <div class="entry-left">
        <div class="entry-name">${escapeHtml(e.name)}</div>
        <div class="entry-meta">${escapeHtml(displayCategory)} · ${formatDate(e.date, e.time)}${addedByHtml}${noteHtml}</div>
      </div>
      <div class="entry-right">
        <span class="entry-amount ${type}">${formatNumber(e.amount)}</span>
        <button class="btn-delete" title="ลบ" data-id="${escapeHtml(e.id)}">✕</button>
      </div>
    </div>`;
}

// ===== Add Group =====
groupForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $('#groupName').value.trim();
  if (!name) {
    showToast('⚠️ กรุณาใส่ชื่อกลุ่ม');
    return;
  }
  const group = { id: generateId(), name, createdAt: Date.now() };
  groups.push(group);
  saveGroups();
  populateGroupDropdown();
  renderEntries();
  groupForm.reset();
  showToast('📁 สร้างกลุ่มเรียบร้อย!');
});

// ===== Add Entry =====
entryForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const name = $('#entryName').value.trim();
  const amount = parseFloat($('#entryAmount').value);
  let category = $('#entryCategory').value;
  const date = $('#entryDate').value;
  const time = $('#entryTime').value || '';
  const note = $('#entryNote').value.trim();
  const customCat = $('#customCategory').value.trim();

  // If custom work category, build the full category string
  if (category === 'ค่างาน' && customCat) {
    category = WORK_PREFIX + customCat;
  }

  if (!name || isNaN(amount) || amount <= 0 || !category || !date) {
    showToast('⚠️ กรุณากรอกข้อมูลให้ครบ');
    return;
  }

  const entry = {
    id: generateId(),
    name,
    amount,
    category,
    date,
    time,
    note,
    groupId: entryGroup.value || null,
    addedBy: currentUser || 'Unknown',
    createdAt: Date.now()
  };

  entries.push(entry);
  saveEntries();
  populateMonthFilter();
  renderEntries();
  updateSummary();

  // Reset form but keep date/time
  const currentDate = date;
  const currentTime = time;
  entryForm.reset();
  $('#entryDate').value = currentDate;
  $('#entryTime').value = currentTime;
  $('#customCategoryGroup').style.display = 'none';

  showToast('✅ บันทึกเรียบร้อย!');
  switchToHome();
});

// ===== Toggle custom category input =====
$('#entryCategory').addEventListener('change', function() {
  const group = $('#customCategoryGroup');
  if (this.value === 'ค่างาน') {
    group.style.display = 'block';
    $('#customCategory').focus();
  } else {
    group.style.display = 'none';
    $('#customCategory').value = '';
  }
});

// ===== Delete Entry =====
entriesList.addEventListener('click', (e) => {
  // Toggle group
  const header = e.target.closest('.group-header');
  if (header && !e.target.closest('.btn-delete-group')) {
    const gId = header.dataset.groupId;
    const body = document.querySelector(`[data-group-body="${gId}"]`);
    const toggle = header.querySelector('.group-toggle');
    if (body && toggle) {
      body.classList.toggle('open');
      toggle.classList.toggle('open');
    }
    return;
  }

  // Delete group
  const delGroup = e.target.closest('.btn-delete-group');
  if (delGroup) {
    const gId = delGroup.dataset.groupId;
    const groupEntries = entries.filter(en => en.groupId === gId);
    const msg = groupEntries.length > 0
      ? `ต้องการลบกลุ่มนี้พร้อมรายการย่อย ${groupEntries.length} รายการ?`
      : 'ต้องการลบกลุ่มนี้?';
    if (!confirm(msg)) return;
    entries = entries.filter(en => en.groupId !== gId);
    groups = groups.filter(g => g.id !== gId);
    saveEntries();
    saveGroups();
    populateGroupDropdown();
    populateMonthFilter();
    renderEntries();
    updateSummary();
    showToast('🗁️ ลบกลุ่มแล้ว');
    return;
  }

  // Delete entry
  const btn = e.target.closest('.btn-delete');
  if (!btn) return;

  const id = btn.dataset.id;
  if (!confirm('ต้องการลบรายการนี้?')) return;

  entries = entries.filter(entry => entry.id !== id);
  saveEntries();
  populateMonthFilter();
  renderEntries();
  updateSummary();
  showToast('🗑️ ลบแล้ว');
});

// ===== Filters =====
searchInput.addEventListener('input', renderEntries);
filterType.addEventListener('change', renderEntries);
filterMonth.addEventListener('change', renderEntries);

// ===== Export CSV =====
exportBtn.addEventListener('click', () => {
  if (entries.length === 0) {
    showToast('📭 ไม่มีข้อมูลให้ส่งออก');
    return;
  }

  const BOM = '\uFEFF';
  const header = 'รายการ,จำนวนเงิน,หมวดหมู่,ประเภท,กลุ่ม,วันที่,เวลา,ผู้เพิ่ม,หมายเหตุ\n';
  const rows = entries.map(e => {
    const type = getCategoryType(e.category);
    const typeName = type === 'income' ? 'เงินเข้า' : type === 'work' ? 'ค่างาน' : 'เงินออก';
    const groupName = e.groupId ? (groups.find(g => g.id === e.groupId)?.name || '') : '';
    return [
      `"${e.name.replace(/"/g, '""')}"`,
      e.amount,
      `"${e.category}"`,
      `"${typeName}"`,
      `"${groupName.replace(/"/g, '""')}"`,
      e.date,
      e.time || '',
      e.addedBy || '',
      `"${(e.note || '').replace(/"/g, '""')}"`
    ].join(',');
  }).join('\n');

  const blob = new Blob([BOM + header + rows], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `number-tracker_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('📥 ส่งออก CSV เรียบร้อย');
});

// ===== Clear All =====
const clearModal = $('#clearModal');
const clearCodeSpan = $('#clearCode');
const clearCodeInput = $('#clearCodeInput');
const clearConfirmBtn = $('#clearConfirmBtn');
const clearCancelBtn = $('#clearCancelBtn');
let generatedCode = '';

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function openClearModal() {
  generatedCode = generateCode();
  clearCodeSpan.textContent = generatedCode;
  clearCodeInput.value = '';
  clearCodeInput.classList.remove('shake');
  clearModal.style.display = 'flex';
  setTimeout(() => clearCodeInput.focus(), 100);
}

function closeClearModal() {
  clearModal.style.display = 'none';
}

clearBtn.addEventListener('click', () => {
  if (entries.length === 0) {
    showToast('📭 ไม่มีข้อมูลให้ล้าง');
    return;
  }
  openClearModal();
});

clearConfirmBtn.addEventListener('click', () => {
  if (clearCodeInput.value.trim() !== generatedCode) {
    clearCodeInput.classList.remove('shake');
    void clearCodeInput.offsetWidth;
    clearCodeInput.classList.add('shake');
    showToast('❌ รหัสไม่ถูกต้อง');
    return;
  }
  entries = [];
  groups = [];
  scores = [];
  saveEntries();
  saveGroups();
  saveScores();
  populateGroupDropdown();
  populateMonthFilter();
  renderEntries();
  updateSummary();
  renderScoreLeaderboard();
  renderScoreHistory();
  updateMemberScores();
  closeClearModal();
  showToast('🗑️ ล้างข้อมูลเรียบร้อย');
});

clearCancelBtn.addEventListener('click', closeClearModal);

clearModal.addEventListener('click', (e) => {
  if (e.target === clearModal) closeClearModal();
});

clearCodeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') clearConfirmBtn.click();
});

// ===== Scores System =====
const SCORES_KEY = 'numberTracker_scores';
let scores = JSON.parse(localStorage.getItem(SCORES_KEY) || '[]');

// Discord → Roblox name mapping
const MEMBER_NAMES = {
  '@onrpexch_05': 'YOUDAz',
  '@yin_war123': 'moominnnnn',
  '@Adrien2545': 'Yangmei',
  '@Moin_Jono': 'Punch_rakfirstone',
  '@Marwin2345_78': 'win349',
  '@l8626ml': 'Min',
  '@twentiesxz': 'nxrynnie',
  '@Natthakar_1': 'ATINatthakar_1',
  '@hudjusjlt': 'Unknown_llUUllSJ',
  '@veerapatinwza01': 'Mawin',
  '@ROTYUIOP_93': 'ROT',
  '@dOqigu': 'Nick001',
  '@Nemoshop705': 'Nemoshop705',
  '@Retro_Tong': 'Tongretro'
};

function displayName(key) {
  const roblox = MEMBER_NAMES[key];
  if (roblox) return `${roblox} <span style="color:var(--text-secondary);font-size:0.8em">(${key})</span>`;
  return key;
}

function displayNamePlain(key) {
  const roblox = MEMBER_NAMES[key];
  return roblox ? `${roblox} (${key})` : key;
}

function renderScoreLeaderboard() {
  const board = document.getElementById('scoreLeaderboard');
  if (!board) return;
  // Tally per member
  const tally = {};
  scores.forEach(s => {
    tally[s.member] = (tally[s.member] || 0) + s.amount;
  });
  const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) {
    board.innerHTML = '<div class="score-empty">ยังไม่มีคะแนน</div>';
    return;
  }
  board.innerHTML = sorted.map((item, i) => `
    <div class="score-rank-item">
      <span class="score-rank-num">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '#' + (i + 1)}</span>
      <span class="score-rank-name">${displayName(item[0])}</span>
      <span class="score-rank-pts">${item[1].toLocaleString()} บาท</span>
    </div>
  `).join('');
}

function renderScoreHistory() {
  const hist = document.getElementById('scoreHistory');
  if (!hist) return;
  if (scores.length === 0) {
    hist.innerHTML = '<div class="score-empty">ยังไม่มีประวัติ</div>';
    return;
  }
  const sorted = [...scores].sort((a, b) => b.timestamp - a.timestamp);
  hist.innerHTML = sorted.map(s => {
    const d = new Date(s.timestamp);
    const dateStr = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
    const timeStr = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    return `
    <div class="score-history-item">
      <div class="score-history-top">
        <span class="score-history-name">${displayName(s.member)}</span>
        <span>
          <span class="score-history-amount">+${s.amount.toLocaleString()}</span>
          <button class="score-history-del" data-id="${s.id}" title="ลบ">🗑️</button>
        </span>
      </div>
      <div class="score-history-meta">📅 ${dateStr} ${timeStr} · 👤 ${s.addedBy || 'Unknown'}</div>
      ${s.note ? `<div class="score-history-note">📝 ${s.note}</div>` : ''}
    </div>`;
  }).join('');
}

function saveScores() {
  localStorage.setItem(SCORES_KEY, JSON.stringify(scores));
  syncToCloud();
}

// Score form submit
document.getElementById('scoreForm')?.addEventListener('submit', function(e) {
  e.preventDefault();
  const member = document.getElementById('scoreMember').value;
  const amount = parseInt(document.getElementById('scoreAmount').value, 10);
  const note = document.getElementById('scoreNote').value.trim();
  if (!member || !amount || amount <= 0) return;

  scores.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    member,
    amount,
    note,
    addedBy: currentUser || 'Unknown',
    timestamp: Date.now()
  });
  saveScores();
  renderScoreLeaderboard();
  renderScoreHistory();
  updateMemberScores();
  showToast('🏆 บันทึกคะแนนแล้ว');
  this.reset();
});

// Delete score entry
document.getElementById('scoreHistory')?.addEventListener('click', function(e) {
  const btn = e.target.closest('.score-history-del');
  if (!btn) return;
  const id = btn.dataset.id;
  scores = scores.filter(s => s.id !== id);
  saveScores();
  renderScoreLeaderboard();
  renderScoreHistory();
  updateMemberScores();
  showToast('🗑️ ลบรายการแล้ว');
});

// Initial render
renderScoreLeaderboard();
renderScoreHistory();
updateMemberScores();

function updateMemberScores() {
  const tally = {};
  scores.forEach(s => {
    tally[s.member] = (tally[s.member] || 0) + s.amount;
  });
  document.querySelectorAll('.member-card[data-member]').forEach(card => {
    const name = card.dataset.member;
    const badge = card.querySelector('.member-score');
    if (!badge) return;
    const pts = tally[name] || 0;
    badge.textContent = pts > 0 ? `🏆 ${pts.toLocaleString()} บาท` : '';
  });
}

// ===== Tab Navigation =====
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    const tabId = btn.dataset.tab;

    // Switch active tab content
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');

    // Switch active nav button
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    btn.classList.add('active');
  });
});

// ===== PWA: Service Worker =====
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}

// ===== PWA: Install Prompt =====
let deferredPrompt;
const installBtn = $('#installBtn');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.style.display = 'flex';
});

installBtn.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === 'accepted') {
    showToast('📲 ติดตั้งแอปเรียบร้อย!');
  }
  deferredPrompt = null;
  installBtn.style.display = 'none';
});

// After adding entry, switch to home tab
function switchToHome() {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.getElementById('tabHome').classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector('[data-tab="tabHome"]').classList.add('active');
}

// ===== Download App (Single HTML offline file) =====
$('#downloadAppBtn').addEventListener('click', async () => {
  showToast('⏳ กำลังสร้างไฟล์...');
  try {
    const [cssRes, jsRes] = await Promise.all([
      fetch('./style.css'),
      fetch('./app.js')
    ]);
    const cssText = await cssRes.text();
    const jsText = await jsRes.text();

    // Get the HTML structure
    const htmlEl = document.documentElement.cloneNode(true);

    // Remove external CSS/JS links
    htmlEl.querySelector('link[href="style.css"]')?.remove();
    htmlEl.querySelector('link[rel="manifest"]')?.remove();
    htmlEl.querySelector('script[src="app.js"]')?.remove();

    // Reset dynamic content
    const entriesEl = htmlEl.querySelector('#entriesList');
    if (entriesEl) entriesEl.innerHTML = '<p class="empty-state">\ud83d\udced \u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23 \u2014 \u0e40\u0e1e\u0e34\u0e48\u0e21\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e41\u0e23\u0e01\u0e40\u0e25\u0e22!</p>';

    // Reset active tab to home
    htmlEl.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    htmlEl.querySelector('#tabHome')?.classList.add('active');
    htmlEl.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    htmlEl.querySelector('[data-tab="tabHome"]')?.classList.add('active');

    // Remove install button and download button from offline version
    htmlEl.querySelector('#installBtn')?.remove();
    htmlEl.querySelector('#downloadAppBtn')?.remove();

    // Inject inline CSS
    const styleTag = document.createElement('style');
    styleTag.textContent = cssText;
    htmlEl.querySelector('head').appendChild(styleTag);

    // Inject inline JS (remove SW registration for offline file)
    const cleanJs = jsText.replace(
      /\/\/ ===== PWA: Service Worker =====.*?register\([^)]+\);/s,
      '// Service Worker disabled in offline version'
    );
    const scriptTag = document.createElement('script');
    scriptTag.textContent = cleanJs;
    htmlEl.querySelector('body').appendChild(scriptTag);

    const fullHtml = '<!DOCTYPE html>\n' + htmlEl.outerHTML;
    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '\u0e08\u0e31\u0e14\u0e40\u0e01\u0e47\u0e1a\u0e15\u0e31\u0e27\u0e40\u0e25\u0e02.html';
    a.click();
    URL.revokeObjectURL(url);
    showToast('\ud83d\udcf2 \u0e14\u0e32\u0e27\u0e19\u0e4c\u0e42\u0e2b\u0e25\u0e14\u0e40\u0e23\u0e35\u0e22\u0e1a\u0e23\u0e49\u0e2d\u0e22! \u0e40\u0e1b\u0e34\u0e14\u0e44\u0e1f\u0e25\u0e4c\u0e44\u0e14\u0e49\u0e40\u0e25\u0e22');
  } catch {
    showToast('\u274c \u0e14\u0e32\u0e27\u0e19\u0e4c\u0e42\u0e2b\u0e25\u0e14\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08');
  }
});
