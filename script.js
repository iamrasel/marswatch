let children = [];
let defaultOtRate = 250;
let otMode = false;
let prevOtAmount = 0;
let otStartParentMs = 0;
let modalItems = [];
let modalFiltered = [];
let cardConfig = [];
let customIndices = [];

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
                customLabel: item.customLabel || null
            };
        });

        while (children.length < cardConfig.length) {
            children.push({
                frozenElapsed: 0,
                startTimestamp: null,
                isRunning: false,
                customLabel: null
            });
        }

        if (children.length > cardConfig.length) children = children.slice(0, cardConfig.length);

        if (data[0]?._ot !== undefined) {
            const ot = data[0]._ot;
            otMode = ot.mode === true;
            otStartParentMs = ot.startParentMs || 0;
            if (typeof ot.accrued === 'number') {
                prevOtAmount = ot.accrued;
            } else if (typeof ot.frozenMs === 'number') {
                const rate = (typeof ot.rate === 'number' && ot.rate > 0) ? ot.rate : defaultOtRate;
                prevOtAmount = ot.frozenMs * (rate / (60 * 60 * 1000));
            } else {
                prevOtAmount = 0;
            }
            if (typeof ot.rate === 'number' && ot.rate > 0) {
                defaultOtRate = ot.rate;
            }
        } else {
            const savedRate = localStorage.getItem('marsOtRate');
            if (savedRate !== null) {
                const parsed = parseFloat(savedRate);
                if (!isNaN(parsed) && parsed > 0) defaultOtRate = parsed;
            }
            prevOtAmount = 0;
            otStartParentMs = 0;
            otMode = false;
        }
        return true;
    } catch (_) {
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
        if (c.customLabel) {
            e.customLabel = c.customLabel;
        }
        if (i === 0) e._ot = {
            mode: otMode, startParentMs: otStartParentMs, accrued: prevOtAmount, rate: defaultOtRate
        };
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
    if (!c || !c.isRunning || !c.startTimestamp) return c ? (c.frozenElapsed || 0) : 0;
    return (c.frozenElapsed || 0) + (Date.now() - c.startTimestamp);
}

function getTakaPerMs() { return defaultOtRate / (60 * 60 * 1000); }

// ── RENDER ──
function updateAll() {
    let totalMs = 0;
    let anyRunning = false;

    for (let i = 0; i < cardConfig.length; i++) {
        const elapsed = getCurrentElapsed(i);
        totalMs += elapsed;

        const timeEl = document.getElementById(`time-${i}`);
        const newTime = formatTime(elapsed);
        if (timeEl && timeEl.textContent !== newTime) timeEl.textContent = newTime;

        const card = document.getElementById(`card-${i}`);
        if (!card) continue;
        const isRunning = children[i] ? children[i].isRunning : false;
        card.classList.toggle('running', isRunning);
        if (isRunning) anyRunning = true;

        const labelSpan = card.querySelector('.card-label');
        if (labelSpan) {
            let displayLabel = cardConfig[i].label;
            if (customIndices.includes(i) && children[i] && children[i].customLabel) {
                displayLabel = children[i].customLabel;
            }
            labelSpan.textContent = displayLabel;
        }

        const badgeSpan = card.querySelector('.group-badge');
        if (isRunning && cardConfig[i].badge.length > 0) {
            if (labelSpan) labelSpan.textContent = `${cardConfig[i].label} - ${cardConfig[i].badge}`;
            if (badgeSpan) badgeSpan.style.display = 'none';
        } else {
            if (badgeSpan) badgeSpan.style.display = '';
        }

        const tasksEl = document.getElementById(`task-${i}`);
        if (tasksEl) {
            if (cardConfig[i].tasksPerHour !== null && cardConfig[i].tasksPerHour !== undefined && elapsed > 0) {
                tasksEl.style.display = 'inline';
                tasksEl.textContent =
                    `[${Math.floor((elapsed / (60 * 60 * 1000)) * cardConfig[i].tasksPerHour)}]`;
            } else tasksEl.style.display = 'none';
        }
    }

    const totalEl = document.getElementById('parent-time');
    const totalStr = formatTime(totalMs);
    if (totalEl.textContent !== totalStr) totalEl.textContent = totalStr;

    const actionBtn = document.getElementById('action-btn');
    const iconPath = document.getElementById('action-icon-path');
    const otValueDiv = document.getElementById('ot-value');
    const otBlock = document.getElementById('ot-block');
    const rateEl = document.getElementById('ot-rate');
    rateEl.textContent = `${defaultOtRate} ৳/Hr`;

    let otAmount = prevOtAmount;

    if (otMode) {
        const segmentMs = totalMs - otStartParentMs;
        if (segmentMs > 0) otAmount += segmentMs * getTakaPerMs();

        otValueDiv.textContent = '৳ ' + otAmount.toFixed(2);
        otBlock.classList.add('active');
    } else {
        otValueDiv.textContent = 'OT';
        otBlock.classList.remove('active');
    }

    if (anyRunning) {
        iconPath.setAttribute('d', 'M560-200v-560h160v560H560Zm-320 0v-560h160v560H240Z');
        actionBtn.classList.remove('danger');

        rateEl.style.cursor = 'not-allowed';
        rateEl.style.opacity = '0.5';
    } else {
        iconPath.setAttribute('d', 'M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z');
        actionBtn.classList.add('danger');

        rateEl.style.cursor = 'pointer';
        rateEl.removeEventListener('mouseenter', rateEl._mouseenter);
        rateEl.removeEventListener('mouseleave', rateEl._mouseleave);
        rateEl._mouseenter = () => { rateEl.style.opacity = '1'; };
        rateEl._mouseleave = () => { rateEl.style.opacity = '0.5'; };
        rateEl.addEventListener('mouseenter', rateEl._mouseenter);
        rateEl.addEventListener('mouseleave', rateEl._mouseleave);
    }
}

// ── CONTROLS ──
function toggleChild(idx) {
    const now = Date.now();
    for (let i = 0; i < cardConfig.length; i++) {
        if (i === idx) continue;
        const o = children[i];
        if (o && o.isRunning && o.startTimestamp) {
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
    for (let i = 0; i < cardConfig.length; i++) {
        const c = children[i];
        if (c && c.isRunning && c.startTimestamp) {
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
    children.forEach(c => { if (c) { c.frozenElapsed = 0; c.isRunning = false; c.startTimestamp = null; c.customLabel = null; } });
    prevOtAmount = 0;
    otStartParentMs = 0;
    otMode = false;
    defaultOtRate = 250;
    document.getElementById('ot-checkbox').checked = false;
    localStorage.removeItem('marsStopwatches');
    localStorage.setItem('marsOtRate', String(defaultOtRate));
    updateAll();
    showToast('✓ Reset done');
}

function handleActionButton() {
    const anyRunning = children.some(c => c && c.isRunning);
    if (anyRunning) {
        pauseAll();
    } else {
        resetAll();
    }
}

// ── RENAME LABELS ──
function renameLabel(i) {
    const current = (children[i] && children[i].customLabel) || cardConfig[i].label;
    const newLabel = prompt(`Rename the label for ${cardConfig[i].label}:`, current);
    if (newLabel !== null && newLabel.trim() !== '') {
        if (children[i]) children[i].customLabel = newLabel.trim();
        saveData();
        updateAll();
        showToast(`✓ Renamed to "${newLabel.trim()}"`);
    } else if (newLabel !== null) {
        if (children[i]) children[i].customLabel = null;
        saveData();
        updateAll();
        showToast('↺ Reverted to default label');
    }
}

function editOtRate() {
    if (children.some(c => c && c.isRunning)) return;
    const current = defaultOtRate;
    const input = prompt('Enter new OT rate (৳ per hour):', String(current));
    if (input === null) return;
    const newRate = parseFloat(input.trim());
    if (isNaN(newRate) || newRate <= 0) {
        showToast('✗ Please enter a positive number', true);
        return;
    }

    const totalMs = children.reduce((s, _, i) => s + getCurrentElapsed(i), 0);
    if (otMode) {
        const segmentMs = totalMs - otStartParentMs;
        if (segmentMs > 0) prevOtAmount += segmentMs * getTakaPerMs();
        otStartParentMs = totalMs;
    }

    defaultOtRate = newRate;
    saveData();
    updateAll();
    showToast(`✓ Rate updated to ${defaultOtRate} ৳/Hr`);
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

function copyToClipboard(text) {
    navigator.clipboard.writeText(text)
        .then(() => showToast('✓ Copied to clipboard'))
        .catch(() => {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none;';
            document.body.appendChild(ta);
            ta.select();
            try {
                document.execCommand('copy');
                showToast('✓ Copied to clipboard');
            } catch (_) {
                showToast('✗ Failed to copy', true);
            }
            document.body.removeChild(ta);
        });
}

// ── COPY / PASTE JSON DATA ──
function copyData() {
    pauseAll();
    const payload = children.map((c, i) => ({
        index: i,
        label: cardConfig[i].label,
        customLabel: c ? c.customLabel : null,
        frozenElapsed: c ? (c.frozenElapsed || 0) : 0,
        isRunning: false,
        startTimestamp: null
    }));
    const json = JSON.stringify({
        entries: payload, _ot: {
            mode: otMode, startParentMs: otStartParentMs, accrued: prevOtAmount, rate: defaultOtRate
        }
    }, null, 2);
    copyToClipboard(json);
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
        if (entries.length !== cardConfig.length) { showToast(`✗ Expected ${cardConfig.length} entries`, true); return; }
        const now = Date.now();
        children = entries.map((item, i) => {
            const fe = typeof item.frozenElapsed === 'number' ? Math.max(0, Math.floor(item.frozenElapsed)) : 0;
            const wr = item.isRunning === true;
            const cl = item.customLabel || null;
            return { frozenElapsed: fe, startTimestamp: wr ? now : null, isRunning: wr, customLabel: cl };
        });
        if (otData) {
            otMode = otData.mode === true;
            otStartParentMs = otData.startParentMs || 0;
            prevOtAmount = typeof otData.accrued === 'number' ? otData.accrued : 0;
            if (typeof otData.rate === 'number' && otData.rate > 0) {
                defaultOtRate = otData.rate;
            }
        } else {
            prevOtAmount = 0; otStartParentMs = 0; otMode = false;
        }
        document.getElementById('ot-checkbox').checked = otMode;
        saveData();
        updateAll();
        showToast('✓ Data imported');
    } catch (_) {
        showToast('✗ Invalid JSON data', true);
    }
}

function toggleView(viewType) {
    const configs = {
        lists: {
            viewId: 'marsListsView',
            btnId: 'marsLists',
            otherViewId: 'escalateView',
            otherBtnId: 'escalateToggleBtn'
        },
        notes: {
            viewId: 'escalateView',
            btnId: 'escalateToggleBtn',
            otherViewId: 'marsListsView',
            otherBtnId: 'marsLists'
        }
    };

    const config = configs[viewType];
    if (!config) return;

    const normalView = document.getElementById('normalView');
    const targetView = document.getElementById(config.viewId);
    const otherView = document.getElementById(config.otherViewId);
    const targetBtn = document.getElementById(config.btnId);
    const otherBtn = document.getElementById(config.otherBtnId);

    const isTargetActive = targetView.classList.contains('active');

    if (isTargetActive) {
        normalView.classList.remove('hidden');
        targetView.classList.remove('active');
        targetBtn.classList.remove('active');
    } else {
        if (otherView.classList.contains('active')) {
            otherView.classList.remove('active');
            otherBtn.classList.remove('active');
        }
        normalView.classList.add('hidden');
        targetView.classList.add('active');
        targetBtn.classList.add('active');
    }
}

function openMarsModal(title, items, columns) {
    const overlay = document.getElementById('marsModal');
    document.getElementById('modalTitle').textContent = title;
    modalItems = Array.isArray(items) ? items : [];
    modalFiltered = [...modalItems];
    document.getElementById('modalList').style.columnCount = columns;
    renderModalList();
    document.getElementById('modalSearch').value = '';
    document.getElementById('modalCount').textContent = modalFiltered.length;
    overlay.classList.add('active');
    setTimeout(() => document.getElementById('modalSearch').focus(), 100);
}

function closeMarsModal() { document.getElementById('marsModal').classList.remove('active'); }

function renderModalList() {
    const list = document.getElementById('modalList');
    const empty = document.getElementById('modalEmpty');
    list.innerHTML = '';
    if (modalFiltered.length === 0) {
        empty.classList.add('visible');
        return;
    }
    empty.classList.remove('visible');
    modalFiltered.forEach(item => {
        const div = document.createElement('div');
        div.className = 'item';
        div.textContent = item;
        list.appendChild(div);
    });
}

function filterModalList() {
    const search = document.getElementById('modalSearch').value.toLowerCase().trim();
    if (!search) modalFiltered = [...modalItems];
    else modalFiltered = modalItems.filter(item => item.toLowerCase().includes(search));

    document.getElementById('modalCount').textContent = modalFiltered.length;
    renderModalList();
}

async function loadListsAndNotes() {
    try {
        const [marsRes, escRes] = await Promise.all([
            fetch('lists/mars-lists.json'),
            fetch('lists/esc-notes.json')
        ]);

        if (!marsRes.ok) throw new Error('Failed to load Mars Lists config');
        if (!escRes.ok) throw new Error('Failed to load Escalate Notes config');

        const marsButtons = await marsRes.json();
        const escButtons = await escRes.json();

        const marsContainer = document.getElementById('marsListsBtns');
        const escContainer = document.getElementById('escNotesBtns');
        marsContainer.innerHTML = '';
        escContainer.innerHTML = '';

        marsButtons.forEach(list => {
            const btn = document.createElement('button');
            btn.className = 'mars-lists';
            btn.textContent = list.label;
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                fetch(`lists/${list.action}.json`)
                    .then(res => {
                        if (!res.ok) throw new Error('File not found');
                        return res.json();
                    })
                    .then(data => {
                        if (Array.isArray(data)) openMarsModal(list.label, data, list.columns);
                        else showToast('✗ Invalid data format', true);
                    })
                    .catch(() => {
                        showToast(`✗ Failed to load the file for ${list.label}`, true);
                    });
            });
            marsContainer.appendChild(btn);
        });

        escButtons.forEach(note => {
            const btn = document.createElement('button');
            btn.className = 'esc-notes';
            btn.textContent = note;
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                copyToClipboard(note);
            });
            escContainer.appendChild(btn);
        });
    } catch (err) {
        showToast('✗ Could not load button configurations', true);
        console.error(err);
    }
}

function buildCards(cards) {
    const grid = document.getElementById('cardGrid');
    grid.innerHTML = '';

    cards.forEach((card, index) => {
        const cardDiv = document.createElement('div');
        cardDiv.id = `card-${index}`;
        cardDiv.className = `card group-${card.group}`;
        cardDiv.dataset.index = index;

        if (card.badge && card.badge.length > 0) {
            const badgeSpan = document.createElement('span');
            badgeSpan.className = 'group-badge';
            badgeSpan.textContent = card.badge;
            cardDiv.appendChild(badgeSpan);
        }

        const dot = document.createElement('div');
        dot.className = 'dot';
        cardDiv.appendChild(dot);

        const labelWrapper = document.createElement('div');
        labelWrapper.className = 'card-label-wrapper';

        const labelSpan = document.createElement('span');
        labelSpan.className = 'card-label';
        labelSpan.textContent = card.label;
        labelWrapper.appendChild(labelSpan);

        if (card.customizable) {
            const editSpan = document.createElement('span');
            editSpan.className = 'edit-label';
            editSpan.dataset.index = index;
            editSpan.title = 'Rename';
            editSpan.textContent = '✎';
            editSpan.addEventListener('click', (e) => {
                e.stopPropagation();
                renameLabel(index);
            });
            labelWrapper.appendChild(editSpan);
            customIndices.push(index);
        }

        cardDiv.appendChild(labelWrapper);

        if (card.tasksPerHour !== null && card.tasksPerHour !== undefined) {
            const taskSpan = document.createElement('span');
            taskSpan.className = 'task-count';
            taskSpan.id = `task-${index}`;
            taskSpan.textContent = '[0]';
            taskSpan.style.display = 'none';
            cardDiv.appendChild(taskSpan);
        }

        const timeDiv = document.createElement('div');
        timeDiv.className = 'card-time';
        timeDiv.id = `time-${index}`;
        timeDiv.textContent = '00:00:00.00';
        cardDiv.appendChild(timeDiv);

        grid.appendChild(cardDiv);

        cardDiv.addEventListener('click', function(e) {
            if (e.target.closest('.edit-label')) return;
            toggleChild(parseInt(this.dataset.index));
        });
    });
}

// ── INIT ──
async function init() {
    try {
        const response = await fetch('lists/cards.json');
        if (!response.ok) throw new Error('Failed to load cards.json');
        cardConfig = await response.json();
    } catch (_) {
        showToast('✗ Could not load cards.json', true);
        return;
    }

    if (!loadSavedData()) {
        children = Array(cardConfig.length).fill(null).map(() => ({
            frozenElapsed: 0,
            startTimestamp: null,
            isRunning: false,
            customLabel: null
        }));
        defaultOtRate = 250;
        prevOtAmount = 0;
        otStartParentMs = 0;
        otMode = false;
    }

    buildCards(cardConfig);

    const cb = document.getElementById('ot-checkbox');
    cb.checked = otMode;
    cb.addEventListener('change', () => {
        const totalMs = children.reduce((s, _, i) => s + getCurrentElapsed(i), 0);
        if (cb.checked) {
            otStartParentMs = totalMs;
            otMode = true;
        } else {
            if (otMode) {
                const segmentMs = totalMs - otStartParentMs;
                if (segmentMs > 0) prevOtAmount += segmentMs * getTakaPerMs();
                otMode = false;
            }
        }
        saveData();
        updateAll();
    });

    initTheme();
    document.getElementById('ot-rate').addEventListener('click', editOtRate);
    loadListsAndNotes();

    document.getElementById('date-label').innerHTML = new Date().toLocaleDateString('en-US',
        { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) +
        ' ─ <span class="credit" title="Contact raselh to report bugs and make suggestions.">raselh</span>';

    document.getElementById('modalCloseBtn').addEventListener('click', closeMarsModal);
    document.getElementById('marsModal').addEventListener('click', function(e) {
        if (e.target === this) closeMarsModal();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMarsModal(); });
    document.getElementById('modalSearch').addEventListener('input', filterModalList);

    updateAll();

    let lastUpdate = 0;
    function updateLoop(timestamp) {
        if (timestamp - lastUpdate >= 10) {
            updateAll();
            lastUpdate = timestamp;
        }
        requestAnimationFrame(updateLoop);
    }
    requestAnimationFrame(updateLoop);

    setInterval(saveData, 5000);
    window.addEventListener('beforeunload', saveData);
}

window.onload = init;