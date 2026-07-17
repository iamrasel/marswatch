let children = [];
const TAKA_PER_MS = 250 / (60 * 60 * 1000);
let otMode = false;
let otFrozenMs = 0;
let otStartParentMs = 0;

const DEFAULT_LABELS = [
    "US Look Back", "US Look Forward", "EU Look Back", "EU Look Forward",
    "Break", "Custom One", "Custom Two", "Other",
    "US Look Back", "US Look Forward", "EU Look Back", "EU Look Forward"
];
const GROUP_BADGES = ["L1", "L1", "L1", "L1", "", "", "", "", "L2", "L2", "L2", "L2"];
const CARD_COUNT = 12;
const CUSTOM_INDICES = [5, 6];

// ── STORAGE ──
function loadSavedData() {
    const saved = localStorage.getItem('marsStopwatches');
    if (!saved) return false;
    try {
        const data = JSON.parse(saved);
        const now = Date.now();
        children = data.map((item, i) => {
            let frozenElapsed = item.frozenElapsed || 0;
            const wasRunning = item.isRunning === true;
            if (wasRunning && item.startTimestamp) frozenElapsed += now - item.startTimestamp;
            return {
                frozenElapsed: Math.max(0, Math.floor(frozenElapsed)),
                startTimestamp: wasRunning ? now : null,
                isRunning: wasRunning,
                customLabel: CUSTOM_INDICES.includes(i) ? (item.customLabel || DEFAULT_LABELS[i]) : undefined
            };
        });
        while (children.length < CARD_COUNT) {
            const i = children.length;
            children.push({ 
                frozenElapsed: 0, 
                startTimestamp: null, 
                isRunning: false,
                customLabel: CUSTOM_INDICES.includes(i) ? DEFAULT_LABELS[i] : undefined
            });
        }
        if (data[0]?._ot !== undefined) {
            otFrozenMs = data[0]._ot.frozenMs || 0;
            otStartParentMs = data[0]._ot.startParentMs || 0;
            otMode = data[0]._ot.mode === true;
        }
        return true;
    } catch (e) {
        return false;
    }
}

function saveData() {
    const saved = children.map((c, i) => {
        const e = {
            frozenElapsed: c.frozenElapsed || 0,
            startTimestamp: c.isRunning ? c.startTimestamp : null,
            isRunning: c.isRunning
        };
        if (CUSTOM_INDICES.includes(i) && c.customLabel && c.customLabel !== DEFAULT_LABELS[i]) {
            e.customLabel = c.customLabel;
        }
        if (i === 0) e._ot = { frozenMs: otFrozenMs, startParentMs: otStartParentMs, mode: otMode };
        return e;
    });
    localStorage.setItem('marsStopwatches', JSON.stringify(saved));
}

// ── FORMAT ──
function formatTime(ms) {
    const totalCs = Math.floor(ms / 10);
    const cs = totalCs % 100;
    const totalSec = Math.floor(totalCs / 100);
    const sec = totalSec % 60;
    const min = Math.floor(totalSec / 60) % 60;
    const hr = Math.floor(totalSec / 3600);
    return `${hr < 10 ? '0' : ''}${hr}:${min < 10 ? '0' : ''}${min}:${sec < 10 ? '0' : ''}${sec}.${cs < 10 ? '0' : ''}${cs}`;
}

function getCurrentElapsed(i) {
    const c = children[i];
    if (!c.isRunning || !c.startTimestamp) return c.frozenElapsed || 0;
    return (c.frozenElapsed || 0) + (Date.now() - c.startTimestamp);
}

// ── RENDER ──
function updateAll() {
    let totalMs = 0;
    let anyRunning = false;

    for (let i = 0; i < CARD_COUNT; i++) {
        const elapsed = getCurrentElapsed(i);
        totalMs += elapsed;
        document.getElementById(`time-${i}`).textContent = formatTime(elapsed);
        const card = document.getElementById(`card-${i}`);
        const isRunning = children[i].isRunning;
        card.classList.toggle('running', isRunning);
        if (isRunning) anyRunning = true;

        const labelSpan = document.getElementById(`label-${i}`) || card.querySelector('.card-label');
        if (labelSpan) {
            let displayLabel = DEFAULT_LABELS[i];
            if (CUSTOM_INDICES.includes(i) && children[i].customLabel) {
                displayLabel = children[i].customLabel;
            }
            labelSpan.textContent = displayLabel;
        }

        const badgeSpan = card.querySelector('.group-badge');
        const defaultLabel = DEFAULT_LABELS[i];
        const badgeText = GROUP_BADGES[i];
        if (isRunning && badgeText) {
            labelSpan.textContent = `${defaultLabel} - ${badgeText}`;
            if (badgeSpan) badgeSpan.style.display = 'none';
        } else {
            if (badgeSpan) badgeSpan.style.display = '';
        }
    }

    document.getElementById('parent-time').textContent = formatTime(totalMs);

    const actionBtn = document.getElementById('action-btn');
    const actionText = document.getElementById('action-btn-text');
    const actionIcon = actionBtn.querySelector('svg');
    if (anyRunning) {
        actionText.textContent = 'Pause';
        actionIcon.innerHTML = '<path d="M560-200v-560h160v560H560Zm-320 0v-560h160v560H240Z"/>';
        actionBtn.classList.remove('danger');
    } else {
        actionText.textContent = 'Reset';
        actionIcon.innerHTML = '<path d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z"/>';
        actionBtn.classList.add('danger');
    }

    const otAmt = otMode
        ? (otFrozenMs + (totalMs - otStartParentMs)) * TAKA_PER_MS
        : otFrozenMs * TAKA_PER_MS;

    const otValueDiv = document.getElementById('ot-value');
    const otBlock = document.getElementById('ot-block');
    if (otMode) {
        otValueDiv.textContent = '৳ ' + otAmt.toFixed(2);
        otBlock.classList.add('active');
    } else {
        otValueDiv.textContent = 'OT Mode';
        otBlock.classList.remove('active');
    }
}

// ── CONTROLS ──
function toggleChild(idx) {
    const now = Date.now();
    for (let i = 0; i < CARD_COUNT; i++) {
        if (i === idx) continue;
        const o = children[i];
        if (o.isRunning && o.startTimestamp) {
            o.frozenElapsed += now - o.startTimestamp;
            o.isRunning = false;
            o.startTimestamp = null;
        }
    }
    const c = children[idx];
    if (c.isRunning) {
        c.frozenElapsed += now - c.startTimestamp;
        c.isRunning = false;
        c.startTimestamp = null;
    } else {
        c.startTimestamp = now;
        c.isRunning = true;
    }
    saveData();
    updateAll();
}

function pauseAll() {
    const now = Date.now();
    let any = false;
    for (let i = 0; i < CARD_COUNT; i++) {
        const c = children[i];
        if (c.isRunning && c.startTimestamp) {
            c.frozenElapsed += now - c.startTimestamp;
            c.isRunning = false;
            c.startTimestamp = null;
            any = true;
        }
    }
    if (any) { saveData(); updateAll(); }
}

function resetAll() {
    if (!confirm('Reset all stopwatches?')) return;
    children.forEach(c => { c.frozenElapsed = 0; c.isRunning = false; c.startTimestamp = null; c.customLabel = null; });
    otFrozenMs = 0;
    otStartParentMs = 0;
    localStorage.removeItem('marsStopwatches');
    updateAll();
}

function handleActionButton() {
    const anyRunning = children.some(c => c.isRunning);
    if (anyRunning) {
        pauseAll();
    } else {
        resetAll();
    }
}

// ── RENAME LABELS ──
function renameLabel(i) {
    const current = children[i].customLabel || DEFAULT_LABELS[i];
    const newLabel = prompt(`Rename the label for ${DEFAULT_LABELS[i]}:`, current);
    if (newLabel !== null && newLabel.trim() !== '') {
        children[i].customLabel = newLabel.trim();
        saveData();
        updateAll();
        showToast(`✓ Renamed to "${newLabel.trim()}"`);
    } else if (newLabel !== null) {
        children[i].customLabel = DEFAULT_LABELS[i];
        saveData();
        updateAll();
        showToast('↺ Reverted to default label');
    }
}

// ── THEME TOGGLE ──
function initTheme() {
    const savedTheme = localStorage.getItem('marsWatchTheme');
    if (savedTheme === 'light') {
        document.body.classList.remove('dark');
    } else {
        document.body.classList.add('dark');
        if (!savedTheme) localStorage.setItem('marsWatchTheme', 'dark');
    }

    const btn = document.getElementById('themeToggle');
    btn.addEventListener('click', () => {
        document.body.classList.toggle('dark');
        const isDark = document.body.classList.contains('dark');
        localStorage.setItem('marsWatchTheme', isDark ? 'dark' : 'light');
        const svgs = btn.querySelectorAll('svg');
        svgs.forEach(svg => {
            svg.style.transform = 'scale(0.8)';
            setTimeout(() => { svg.style.transform = ''; }, 150);
        });
    });
}

// ── TOAST ──
function showToast(msg, isError = false) {
    const t = document.getElementById('mars-toast');
    t.textContent = msg;
    t.className = 'visible' + (isError ? ' error' : '');
    clearTimeout(t._t);
    t._t = setTimeout(() => { t.className = ''; }, 2200);
}

// ── COPY / PASTE ──
function copyData() {
    pauseAll();
    const payload = children.map((c, i) => ({
        index: i,
        label: DEFAULT_LABELS[i],
        customLabel: CUSTOM_INDICES.includes(i) ? (c.customLabel || null) : null,
        frozenElapsed: c.frozenElapsed || 0,
        isRunning: false,
        startTimestamp: null
    }));
    const json = JSON.stringify(
        { entries: payload, _ot: { frozenMs: otFrozenMs, startParentMs: otStartParentMs, mode: otMode } },
        null, 2
    );
    navigator.clipboard.writeText(json)
        .then(() => showToast('✓ Copied to clipboard'))
        .catch(() => {
            const ta = document.createElement('textarea');
            ta.value = json;
            ta.style.cssText = 'position:fixed;opacity:0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            showToast('✓ Copied to clipboard');
        });
}

function pasteData() {
    navigator.clipboard.readText()
        .then(t => applyPastedJSON(t))
        .catch(() => {
            const t = prompt('Paste your MarsWatch JSON:');
            if (t) applyPastedJSON(t);
        });
}

function applyPastedJSON(text) {
    try {
        const data = JSON.parse(text.trim());
        const entries = Array.isArray(data) ? data : (Array.isArray(data.entries) ? data.entries : []);
        const otData = Array.isArray(data) ? null : data._ot;
        if (entries.length !== CARD_COUNT) { showToast(`✗ Expected ${CARD_COUNT} entries`, true); return; }
        const now = Date.now();
        children = entries.map((item, i) => {
            const fe = typeof item.frozenElapsed === 'number' ? Math.max(0, Math.floor(item.frozenElapsed)) : 0;
            const wr = item.isRunning === true;
            const cl = CUSTOM_INDICES.includes(i) ? (item.customLabel || DEFAULT_LABELS[i]) : undefined;
            return { frozenElapsed: fe, startTimestamp: wr ? now : null, isRunning: wr, customLabel: cl };
        });
        if (otData) {
            otFrozenMs = typeof otData.frozenMs === 'number' ? otData.frozenMs : 0;
            otStartParentMs = typeof otData.startParentMs === 'number' ? otData.startParentMs : 0;
            otMode = otData.mode === true;
        } else {
            otFrozenMs = 0; otStartParentMs = 0; otMode = false;
        }
        document.getElementById('ot-checkbox').checked = otMode;
        saveData();
        updateAll();
        showToast('✓ Data imported');
    } catch (e) {
        showToast('✗ Invalid JSON', true);
    }
}

// ── INIT ──
function init() {
    if (!loadSavedData()) {
        children = Array(CARD_COUNT).fill(null).map((_, i) => ({ 
            frozenElapsed: 0, 
            startTimestamp: null, 
            isRunning: false,
            customLabel: CUSTOM_INDICES.includes(i) ? DEFAULT_LABELS[i] : undefined
        }));
    }

    for (let i = 0; i < CARD_COUNT; i++) {
        document.getElementById(`card-${i}`).addEventListener('click', () => toggleChild(i));
    }

    document.querySelectorAll('.edit-label').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation(); // prevent card toggle
            const idx = parseInt(el.dataset.index, 10);
            renameLabel(idx);
        });
    });

    const cb = document.getElementById('ot-checkbox');
    cb.checked = otMode;
    cb.addEventListener('change', () => {
        const totalMs = children.reduce((s, _, i) => s + getCurrentElapsed(i), 0);
        if (cb.checked) {
            otStartParentMs = totalMs;
            otMode = true;
        } else {
            otFrozenMs += totalMs - otStartParentMs;
            otMode = false;
        }
        saveData();
        updateAll();
    });

    initTheme();

    document.getElementById('date-label').innerHTML = new Date().toLocaleDateString('en-US',
        { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) +
        ' <span class="credit" title="Contact raselh to report bugs and make suggestions.">© raselh</span>';

    updateAll();
    setInterval(updateAll, 10);
    setInterval(saveData, 5000);
    window.addEventListener('beforeunload', saveData);
}

window.onload = init;