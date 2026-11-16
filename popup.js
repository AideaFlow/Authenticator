let accounts = [];
let editingId = null;
let deleteId = null;
let tickInterval = null;

const THEME_COLORS = ['blue', 'green', 'teal', 'purple', 'pink', 'orange', 'gray'];
let themeColor = 'blue';
let themeMode = 'light';

const $accountList = document.getElementById('account-list');
const $emptyState = document.getElementById('empty-state');
const $addModal = document.getElementById('add-modal');
const $deleteModal = document.getElementById('delete-modal');
const $settingsModal = document.getElementById('settings-modal');
const $modalTitle = document.getElementById('modal-title');
const $inputName = document.getElementById('input-name');
const $inputSecret = document.getElementById('input-secret');
const $secretError = document.getElementById('secret-error');
const $deleteName = document.getElementById('delete-name') || document.createElement('span');
let pendingDigits = 6;
let pendingPeriod = 30;

function loadAccounts() {
  return new Promise(resolve => {
    chrome.storage.local.get({ accounts: [] }, data => {
      accounts = data.accounts;
      resolve();
    });
  });
}

function saveAccounts() {
  return new Promise(resolve => {
    chrome.storage.local.set({ accounts }, resolve);
  });
}

function loadLang() {
  return new Promise(resolve => {
    chrome.storage.local.get({ lang: 'zh-CN' }, data => {
      setLang(data.lang);
      resolve();
    });
  });
}

function saveLang(lang) {
  return new Promise(resolve => {
    chrome.storage.local.set({ lang }, resolve);
  });
}

function applyTheme() {
  const root = document.documentElement;
  root.setAttribute('data-color', themeColor);
  root.setAttribute('data-mode', themeMode);
}

function loadTheme() {
  return new Promise(resolve => {
    chrome.storage.local.get({ themeColor: 'blue', themeMode: 'light' }, data => {
      themeColor = THEME_COLORS.includes(data.themeColor) ? data.themeColor : 'blue';
      themeMode = data.themeMode === 'dark' ? 'dark' : 'light';
      applyTheme();
      resolve();
    });
  });
}

function saveTheme() {
  return new Promise(resolve => {
    chrome.storage.local.set({ themeColor, themeMode }, resolve);
  });
}

async function handleColorChange(color) {
  if (!THEME_COLORS.includes(color) || color === themeColor) return;
  themeColor = color;
  applyTheme();
  updateUI();
  await saveTheme();
}

async function handleModeChange(mode) {
  if (mode !== 'light' && mode !== 'dark') return;
  if (mode === themeMode) return;
  themeMode = mode;
  applyTheme();
  updateUI();
  await saveTheme();
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

function getVersion() {
  try {
    return chrome.runtime.getManifest().version;
  } catch (e) {
    return '';
  }
}

function formatOTP(otp, digits) {
  const half = Math.floor(digits / 2);
  return otp.substring(0, half) + ' ' + otp.substring(half);
}

function showToast(msg) {
  const existing = document.querySelector('.copied-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'copied-toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 1600);
}

function updateUI() {
  document.getElementById('app-title').textContent = i18n('appName');
  document.getElementById('btn-add').title = i18n('addAccount');
  document.getElementById('btn-settings').title = i18n('settings');
  document.getElementById('btn-github').title = i18n('githubTooltip');
  document.getElementById('empty-title').textContent = i18n('emptyTitle');
  document.getElementById('empty-hint').textContent = i18n('emptyHint');
  document.getElementById('label-name').textContent = i18n('accountName');
  document.getElementById('label-secret').textContent = i18n('secretKey');
  document.getElementById('label-type').textContent = i18n('secretType');
  document.getElementById('type-badge-text').textContent = i18n('timeBased');
  document.getElementById('btn-cancel').textContent = i18n('cancel');
  document.getElementById('btn-save').textContent = i18n('save');
  document.getElementById('delete-modal-title').textContent = i18n('deleteAccount');
  document.getElementById('btn-delete-cancel').textContent = i18n('cancel');
  document.getElementById('btn-delete-confirm').textContent = i18n('delete');
  document.getElementById('settings-title').textContent = i18n('settings');
  document.getElementById('label-language').textContent = i18n('language');
  document.getElementById('label-color').textContent = i18n('themeColor');
  document.getElementById('label-mode').textContent = i18n('appearance');
  document.getElementById('mode-light-text').textContent = i18n('lightMode');
  document.getElementById('mode-dark-text').textContent = i18n('darkMode');
  document.getElementById('btn-lang-zh').textContent = i18n('chinese');
  document.getElementById('btn-lang-en').textContent = i18n('english');
  document.getElementById('label-export').textContent = i18n('exportData');
  document.getElementById('export-desc').textContent = i18n('exportDesc');
  document.getElementById('export-btn-text').textContent = i18n('exportBtn');
  document.getElementById('label-import').textContent = i18n('importData');
  document.getElementById('import-desc').textContent = i18n('importDesc');
  document.getElementById('import-btn-text').textContent = i18n('importBtn');
  $inputName.placeholder = i18n('accountNamePlaceholder');
  $inputSecret.placeholder = i18n('secretPlaceholder');
  document.getElementById('btn-scan-screen').title = i18n('scanScreen');
  document.getElementById('scan-screen-text').textContent = i18n('scanScreen');
  document.getElementById('scan-file-text').textContent = i18n('scanFile');
  document.getElementById('label-scan-method').textContent = i18n('scanMethod');
  document.getElementById('scan-method-desc').textContent = i18n('scanMethodDesc');
  document.getElementById('btn-auto-scan').title = i18n('autoScan');
  document.getElementById('footer-notice').textContent = i18n('footerNotice');
  document.getElementById('version-label').textContent = i18n('version');
  document.getElementById('version-value').textContent = getVersion();

  const lang = getLang();
  document.getElementById('btn-lang-zh').classList.toggle('active', lang === 'zh-CN');
  document.getElementById('btn-lang-en').classList.toggle('active', lang === 'en');

  const colorNames = {
    blue: 'colorBlue', green: 'colorGreen', teal: 'colorTeal',
    purple: 'colorPurple', pink: 'colorPink', orange: 'colorOrange', gray: 'colorGray'
  };
  document.querySelectorAll('.color-swatch').forEach(btn => {
    const color = btn.dataset.color;
    btn.classList.toggle('active', color === themeColor);
    btn.title = i18n(colorNames[color]);
    btn.setAttribute('aria-label', i18n(colorNames[color]));
  });
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === themeMode);
  });
}

async function renderCards() {
  $accountList.innerHTML = '';

  if (accounts.length === 0) {
    $emptyState.style.display = 'flex';
    return;
  }

  $emptyState.style.display = 'none';

  for (const account of accounts) {
    const card = document.createElement('div');
    card.className = 'account-card';
    card.dataset.id = account.id;

    let otpText = '------';
    try {
      const otp = await generateTOTP(account.secret, account.period, account.digits);
      otpText = formatOTP(otp, account.digits);
    } catch (e) {
      otpText = 'ERROR';
    }

    const remaining = getTimeRemaining(account.period);
    const percent = (remaining / account.period) * 100;
    const isWarning = remaining <= 5;
    const timeBasedLabel = i18n('timeBased');

    card.innerHTML = `
      <div class="card-actions">
        <button class="card-action-btn edit" title="${i18n('editAccount')}">
          <svg viewBox="0 0 24 24" width="16" height="16"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="currentColor"/></svg>
        </button>
        <button class="card-action-btn delete" title="${i18n('delete')}">
          <svg viewBox="0 0 24 24" width="16" height="16"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="currentColor"/></svg>
        </button>
      </div>
      <div class="account-name">${escapeHtml(account.name)}<span class="type-tag">${timeBasedLabel}</span></div>
      <div class="account-otp clickable" data-secret="${escapeAttr(account.secret)}" data-digits="${account.digits}" data-period="${account.period}">${otpText}</div>
      <div class="account-bottom">
        <button class="copy-btn" title="${i18n('copied')}">
          <svg viewBox="0 0 24 24" width="16" height="16"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" fill="currentColor"/></svg>
        </button>
        <div class="progress-bar">
          <div class="progress-fill ${isWarning ? 'warning' : ''}" style="width:${percent}%"></div>
        </div>
        <span class="time-remaining ${isWarning ? 'warning' : ''}">${remaining}s</span>
      </div>
    `;

    const otpEl = card.querySelector('.account-otp');
    const copyOtp = async () => {
      try {
        const otp = await generateTOTP(account.secret, account.period, account.digits);
        navigator.clipboard.writeText(otp).then(() => showToast(i18n('copied')));
      } catch (e) { /* ignore */ }
    };
    otpEl.addEventListener('click', copyOtp);
    card.querySelector('.copy-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      copyOtp();
    });

    card.querySelector('.edit').addEventListener('click', (e) => {
      e.stopPropagation();
      openEditModal(account);
    });

    card.querySelector('.delete').addEventListener('click', (e) => {
      e.stopPropagation();
      openDeleteModal(account);
    });

    $accountList.appendChild(card);
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function validateSecret(secret) {
  if (!secret.trim()) return i18n('secretEmpty');
  const cleaned = secret.toUpperCase().replace(/[\s=-]+/g, '');
  if (cleaned.length === 0) return i18n('secretEmpty');
  for (const ch of cleaned) {
    if (!Base32.CHARSET.includes(ch)) return i18n('invalidChar') + ch;
  }
  if (cleaned.length < 8) return i18n('secretTooShort');
  return null;
}

function openAddModal() {
  editingId = null;
  $modalTitle.textContent = i18n('addAccount');
  $inputName.value = '';
  $inputSecret.value = '';
  pendingDigits = 6;
  pendingPeriod = 30;
  $secretError.style.display = 'none';
  document.querySelector('.scan-method-group').style.display = '';
  $addModal.style.display = 'flex';
  $inputName.focus();
}

function openEditModal(account) {
  editingId = account.id;
  $modalTitle.textContent = i18n('editAccount');
  $inputName.value = account.name;
  $inputSecret.value = account.secret;
  pendingDigits = account.digits;
  pendingPeriod = account.period;
  $secretError.style.display = 'none';
  document.querySelector('.scan-method-group').style.display = 'none';
  $addModal.style.display = 'flex';
  $inputName.focus();
}

function closeAddModal() {
  $addModal.style.display = 'none';
  editingId = null;
}

function openDeleteModal(account) {
  deleteId = account.id;
  $deleteName.textContent = account.name;
  document.getElementById('delete-confirm-text').innerHTML =
    i18n('confirmDelete') + ' <strong>' + escapeHtml(account.name) + '</strong>' + i18n('yes');
  $deleteModal.style.display = 'flex';
}

function closeDeleteModal() {
  $deleteModal.style.display = 'none';
  deleteId = null;
}

function openSettingsModal() {
  $settingsModal.style.display = 'flex';
}

function closeSettingsModal() {
  $settingsModal.style.display = 'none';
}

async function handleSave() {
  const name = $inputName.value.trim();
  const secret = $inputSecret.value.trim();
  const digits = pendingDigits;
  const period = pendingPeriod;

  if (!name) {
    $inputName.focus();
    return;
  }

  const secretErr = validateSecret(secret);
  if (secretErr) {
    $secretError.textContent = secretErr;
    $secretError.style.display = 'block';
    $inputSecret.focus();
    return;
  }

  if (editingId) {
    const idx = accounts.findIndex(a => a.id === editingId);
    if (idx !== -1) {
      accounts[idx] = { ...accounts[idx], name, secret, digits, period };
    }
  } else {
    accounts.push({ id: generateId(), name, secret, digits, period });
  }

  await saveAccounts();
  closeAddModal();
  await renderCards();
}

async function handleDelete() {
  if (!deleteId) return;
  accounts = accounts.filter(a => a.id !== deleteId);
  await saveAccounts();
  closeDeleteModal();
  await renderCards();
}

async function handleLangChange(lang) {
  setLang(lang);
  await saveLang(lang);
  updateUI();
  await renderCards();
}

async function tick() {
  const cards = $accountList.querySelectorAll('.account-card');
  for (const card of cards) {
    const id = card.dataset.id;
    const account = accounts.find(a => a.id === id);
    if (!account) continue;

    const remaining = getTimeRemaining(account.period);
    const percent = (remaining / account.period) * 100;
    const isWarning = remaining <= 5;

    const progressFill = card.querySelector('.progress-fill');
    const timeRemaining = card.querySelector('.time-remaining');

    progressFill.style.width = `${percent}%`;
    progressFill.className = `progress-fill ${isWarning ? 'warning' : ''}`;
    timeRemaining.textContent = `${remaining}s`;
    timeRemaining.className = `time-remaining ${isWarning ? 'warning' : ''}`;

    if (remaining === account.period) {
      try {
        const otp = await generateTOTP(account.secret, account.period, account.digits);
        const otpEl = card.querySelector('.account-otp');
        otpEl.textContent = formatOTP(otp, account.digits);
      } catch (e) { /* ignore */ }
    }
  }
}

document.getElementById('btn-add').addEventListener('click', openAddModal);
document.getElementById('btn-settings').addEventListener('click', openSettingsModal);
document.getElementById('btn-github').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://github.com/AideaFlow/Authenticator' });
});
document.getElementById('btn-cancel').addEventListener('click', closeAddModal);
document.getElementById('btn-save').addEventListener('click', handleSave);
document.getElementById('btn-delete-cancel').addEventListener('click', closeDeleteModal);
document.getElementById('btn-delete-confirm').addEventListener('click', handleDelete);

document.getElementById('btn-lang-zh').addEventListener('click', () => handleLangChange('zh-CN'));
document.getElementById('btn-lang-en').addEventListener('click', () => handleLangChange('en'));

document.querySelectorAll('.color-swatch').forEach(btn => {
  btn.addEventListener('click', () => handleColorChange(btn.dataset.color));
});

document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => handleModeChange(btn.dataset.mode));
});

document.getElementById('btn-export').addEventListener('click', () => {
  if (accounts.length === 0) {
    showToast(i18n('noAccountsExport'));
    return;
  }
  exportAccounts(accounts);
  showToast(i18n('exportSuccess'));
});

document.getElementById('btn-import').addEventListener('click', async () => {
  try {
    const imported = await importAccountsFromFile();
    for (const acc of imported) {
      if (!accounts.some(a => a.secret === acc.secret && a.name === acc.name)) {
        accounts.push(acc);
      }
    }
    await saveAccounts();
    await renderCards();
    closeSettingsModal();
    const msg = i18n('importSuccess').replace('{n}', String(imported.length));
    showToast(msg);
  } catch (err) {
    showToast(i18n('importFailed'));
  }
});

$addModal.addEventListener('click', (e) => {
  if (e.target === $addModal) closeAddModal();
});

$deleteModal.addEventListener('click', (e) => {
  if (e.target === $deleteModal) closeDeleteModal();
});

$settingsModal.addEventListener('click', (e) => {
  if (e.target === $settingsModal) closeSettingsModal();
});

$inputSecret.addEventListener('input', () => {
  $secretError.style.display = 'none';
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if ($addModal.style.display !== 'none') closeAddModal();
    if ($deleteModal.style.display !== 'none') closeDeleteModal();
    if ($settingsModal.style.display !== 'none') closeSettingsModal();
  }
});

function parseOtpauth(uri) {
  if (!uri.startsWith('otpauth://')) return null;
  try {
    const url = new URL(uri);
    const type = url.hostname;
    if (type !== 'totp' && type !== 'hotp') return null;
    const secret = url.searchParams.get('secret');
    if (!secret) return null;
    const issuer = url.searchParams.get('issuer') || '';
    const pathname = decodeURIComponent(url.pathname.substring(1));
    let name = pathname;
    if (issuer && pathname.startsWith(issuer + ':')) {
      name = pathname.substring(issuer.length + 1);
    } else if (!issuer) {
      const colonIdx = pathname.indexOf(':');
      if (colonIdx > 0) {
        name = pathname.substring(colonIdx + 1);
      }
    }
    const digits = parseInt(url.searchParams.get('digits') || '6', 10);
    const period = parseInt(url.searchParams.get('period') || '30', 10);
    return { name: name || issuer || 'Unknown', secret, digits, period };
  } catch (e) {
    return null;
  }
}

function decodeQrFromImageData(imageData) {
  const code = jsQR(imageData.data, imageData.width, imageData.height);
  return code ? code.data : null;
}

function loadImageToCanvas(src) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      resolve(ctx.getImageData(0, 0, img.width, img.height));
    };
    img.onerror = reject;
    img.src = src;
  });
}

function applyOtpauthResult(parsed) {
  editingId = null;
  $modalTitle.textContent = i18n('addAccount');
  $inputName.value = parsed.name;
  $inputSecret.value = parsed.secret;
  pendingDigits = parsed.digits;
  pendingPeriod = parsed.period;
  $secretError.style.display = 'none';
  document.querySelector('.scan-method-group').style.display = '';
  $addModal.style.display = 'flex';
  showToast(i18n('scanSuccess'));
}

function handleQrData(data) {
  if (!data) {
    showToast(i18n('noQrFound'));
    return;
  }
  const parsed = parseOtpauth(data);
  if (parsed) {
    applyOtpauthResult(parsed);
    return;
  }
  if (/^[A-Z2-7+=/]+$/i.test(data.replace(/\s/g, '')) && data.replace(/[\s=-]/g, '').length >= 8) {
    editingId = null;
    $modalTitle.textContent = i18n('addAccount');
    $inputName.value = '';
    $inputSecret.value = data.toUpperCase().replace(/[\s=-]+/g, '');
    pendingDigits = 6;
    pendingPeriod = 30;
    $secretError.style.display = 'none';
    document.querySelector('.scan-method-group').style.display = '';
    $addModal.style.display = 'flex';
    showToast(i18n('scanSuccess'));
    return;
  }
  showToast(i18n('invalidOtpauth'));
}

async function captureAndScan() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error('No active tab');
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
    const imageData = await loadImageToCanvas(dataUrl);
    const data = decodeQrFromImageData(imageData);
    handleQrData(data);
  } catch (err) {
    showToast(i18n('captureFailed'));
  }
}

function scanFromImageFile(file) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const imageData = await loadImageToCanvas(e.target.result);
      const data = decodeQrFromImageData(imageData);
      handleQrData(data);
    } catch (err) {
      showToast(i18n('noQrFound'));
    }
  };
  reader.readAsDataURL(file);
}

document.getElementById('btn-scan-screen').addEventListener('click', captureAndScan);

document.getElementById('btn-scan-file').addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (file) scanFromImageFile(file);
  };
  input.click();
});

document.getElementById('btn-auto-scan').addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error('No active tab');
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
    const imageData = await loadImageToCanvas(dataUrl);
    const data = decodeQrFromImageData(imageData);
    if (!data) {
      showToast(i18n('noQrFoundAuto'));
      return;
    }
    const parsed = parseOtpauth(data);
    if (parsed) {
      accounts.push({
        id: generateId(),
        name: parsed.name,
        secret: parsed.secret,
        digits: parsed.digits,
        period: parsed.period
      });
      await saveAccounts();
      await renderCards();
      showToast(i18n('autoBindSuccess'));
      return;
    }
    if (/^[A-Z2-7+=/]+$/i.test(data.replace(/\s/g, '')) && data.replace(/[\s=-]/g, '').length >= 8) {
      accounts.push({
        id: generateId(),
        name: 'Unknown',
        secret: data.toUpperCase().replace(/[\s=-]+/g, ''),
        digits: 6,
        period: 30
      });
      await saveAccounts();
      await renderCards();
      showToast(i18n('autoBindSuccess'));
      return;
    }
    showToast(i18n('invalidOtpauth'));
  } catch (err) {
    showToast(i18n('captureFailed'));
  }
});

async function init() {
  await loadLang();
  await loadTheme();
  await loadAccounts();
  updateUI();
  await renderCards();
  tickInterval = setInterval(tick, 1000);
}

init();
