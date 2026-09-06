let children = [];
let defaultOtRate = 250;
let otMode = false;
let prevOtAmount = 0;
let otStartParentMs = 0;
let modalItems = [];
let modalFiltered = [];
let cardConfig = [];
let fullCardConfig = [];
let customIndices = [];
let modalData = null;
let settingsState = {};

const latestCount = 2;

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
    localStorage.setItem('marsSettings', JSON.stringify(settingsState));
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

function getParentTotalMs() {
    let totalMs = 0;
    for (let i = 0; i < cardConfig.length; i++) {
        if (settingsState.includeBreak || !cardConfig[i].excludeTotal) totalMs += getCurrentElapsed(i);
    }
    return totalMs;
}

function getOtTotalMs() {
    let totalMs = 0;
    for (let i = 0; i < cardConfig.length; i++) {
        if (cardConfig[i].excludeTotal) continue;
        totalMs += getCurrentElapsed(i);
    }
    return totalMs;
}

// ── RENDER ──
function updateAll() {
    const totalMs = getParentTotalMs();
    let anyRunning = false;

    for (let i = 0; i < cardConfig.length; i++) {
        const elapsed = getCurrentElapsed(i);

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
        const segmentMs = getOtTotalMs() - otStartParentMs;
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

    const totalMs = getOtTotalMs();
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
        },
        _settings: settingsState
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

        if (data._settings && typeof data._settings === 'object') {
            settingsState = data._settings;
            document.querySelectorAll('.settings-items').forEach(btn => {
                btn.classList.toggle('active', settingsState[btn.dataset.id] === true);
            });
        }

        buildCards(settingsState.showL2 ? fullCardConfig : fullCardConfig.filter(card => card.group !== 'b'));

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
            others: ['escalateView', 'settingsView']
        },
        notes: {
            viewId: 'escalateView',
            btnId: 'escalateToggleBtn',
            others: ['marsListsView', 'settingsView']
        },
        settings: {
            viewId: 'settingsView',
            btnId: 'settingsToggleBtn',
            others: ['marsListsView', 'escalateView']
        }
    };

    const config = configs[viewType];
    if (!config) return;

    const normalView = document.getElementById('normalView');
    const targetView = document.getElementById(config.viewId);
    const targetBtn = document.getElementById(config.btnId);

    const isTargetActive = targetView.classList.contains('active');

    config.others.forEach(id => {
        const view = document.getElementById(id);
        if (view && view.classList.contains('active')) view.classList.remove('active');
    });

    const otherActiveBtns = [];
    if (config.viewId !== 'marsListsView') otherActiveBtns.push('marsLists');
    if (config.viewId !== 'escalateView') otherActiveBtns.push('escalateToggleBtn');
    if (config.viewId !== 'settingsView') otherActiveBtns.push('settingsToggleBtn');
    otherActiveBtns.forEach(id => {
        const view = document.getElementById(id);
        if (view && view.classList.contains('active')) view.classList.remove('active');
    });

    if (isTargetActive) {
        normalView.classList.remove('hidden');
        targetView.classList.remove('active');
        targetBtn.classList.remove('active');
    } else {
        normalView.classList.add('hidden');
        targetView.classList.add('active');
        targetBtn.classList.add('active');
    }
}

function openMarsModal(marsList, items) {
    const overlay = document.getElementById('marsModal');
    document.getElementById('modalTitle').textContent = marsList.label;

    modalData = {
        type: marsList.action,
        columnCount: marsList.columns,
        headers: marsList.headers,
        items: Array.isArray(items) ? items : []
    };

    document.getElementById('modalSearchWrap').style.display = modalData.type === "changes" ? "none" : "";
    modalItems = Array.isArray(items) ? items : [];
    modalFiltered = [...modalItems];
    document.getElementById('modalSearch').value = '';
    document.getElementById('modalCount').textContent = modalFiltered.length;
    overlay.classList.add('active');
    setTimeout(() => document.getElementById('modalSearch').focus(), 100);
    renderModalList();
}

function closeMarsModal() { 
    document.getElementById('marsModal').classList.remove('active');
    document.getElementById('modalList').style = null;
    modalData = null;
}

function renderModalList() {
    const list = document.getElementById('modalList');
    const emptyInfo = document.getElementById('modalEmptyInfo');
    list.innerHTML = '';

    const showEmptyInfo = modalData.type === 'changes' || modalFiltered.length === 0;
    emptyInfo.classList.toggle('visible', showEmptyInfo);

    if (showEmptyInfo) {
        if (modalFiltered.length === 0) {
            emptyInfo.textContent = "Your search query doesn't match with any item.";
            return;
        } else {
            emptyInfo.innerHTML =
                'Developer: ' +
                '<a class="links" target="_blank" href="https://github.com/iamrasel">Md Rasel Hossain (raselh)</a></br>' +
                'Special Mention: ' +
                '<a class="links" target="_blank" href="https://github.com/dev-ruman">Syfur Rahman Ruman (srruman)</a>, ' +
                '<a class="links" target="_blank" href="https://icons.getbootstrap.com">Bootstrap Icons</a>';
        }
    }

    if (modalData && (modalData.headers !== undefined)) {
        const table = document.createElement('div');
        table.className = 'modal-table';
        table.style.gridTemplateColumns = `repeat(${modalData.columnCount}, 1fr)`;

        const headerRow = document.createElement('div');
        headerRow.className = 'modal-table-header';

        modalData.headers.forEach(headerText => {
            const header = document.createElement('div');
            header.className = 'modal-cell';
            header.textContent = headerText;
            headerRow.appendChild(header);
        });

        table.appendChild(headerRow);

        modalFiltered.forEach(item => {
            const row = document.createElement('div');
            row.className = 'modal-table-row';

            let cellData = [];
            switch (modalData.type) {
                case 'countries': cellData = [item.country || '', item.code || '', item.continent || ''];
                    break;
                case 'extensions': cellData = [item.ext || '', item.extFull || ''];
                    break;
                case 'companies': cellData = [item.company || '', item.availability || ''];
                    break;
            }

            cellData.forEach((data, index) => {
                const cell = document.createElement('div');
                cell.className = 'modal-cell';
                cell.textContent = data;
                row.appendChild(cell);
            });

            table.appendChild(row);
        });

        list.appendChild(table);
    } else {
        list.style.columnCount = modalData.columnCount;
        modalFiltered.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'item';
            if (modalData.type === 'changes') {
                div.classList.add('changes-item');
                div.textContent = `${modalFiltered.length - index}. ${item}`;
                if (modalItems.indexOf(item) >= 0 && modalItems.indexOf(item) < latestCount) {
                    const badge = document.createElement('span');
                    badge.className = 'latest-badge';
                    badge.textContent = 'LATEST';
                    div.appendChild(badge);
                }
            } else div.textContent = item;

            list.appendChild(div);
        });
    }
}

function filterModalList() {
    const searchText = document.getElementById('modalSearch').value.toLowerCase().trim();

    if (!searchText) {
        modalFiltered = [...modalItems];
    } else {
        if (modalData && (modalData.headers !== undefined)) {
            modalFiltered = modalItems.filter(item => {
                let searchableText = '';
                switch (modalData.type) {
                    case 'countries':
                        searchableText = (item.country || '').toLowerCase() + ' ' + (item.code || '').toLowerCase() + ' ' + (item.continent || '').toLowerCase();
                        break;
                    case 'extensions':
                        searchableText = (item.ext || '').toLowerCase() + ' ' + (item.extFull || '').toLowerCase();
                        break;
                    case 'companies':
                        searchableText = (item.company || '').toLowerCase();
                        break;
                }
                return searchableText.includes(searchText);
            });
        } else {
            modalFiltered = modalItems.filter(item => 
                String(item).toLowerCase().includes(searchText)
            );
        }
    }

    document.getElementById('modalCount').textContent = modalFiltered.length;
    renderModalList();
}

async function loadListsAndNotes() {
    try {
        const [marsRes, escRes, settingsRes] = await Promise.all([
            fetch('lists/mars-lists.json'),
            fetch('lists/esc-notes.json'),
            fetch('lists/settings.json')
        ]);

        if (!marsRes.ok) throw new Error('Failed to load Mars Lists config');
        if (!escRes.ok) throw new Error('Failed to load Escalate Notes config');
        if (!settingsRes.ok) throw new Error('Failed to load Settings config');

        const marsButtons = await marsRes.json();
        const escButtons = await escRes.json();
        const settingsItems = await settingsRes.json();

        const savedSettings = localStorage.getItem('marsSettings');
        const parsed = savedSettings ? JSON.parse(savedSettings) : {};
        settingsItems.forEach(item => {
            settingsState[item.id] = parsed[item.id];
        });

        const marsContainer = document.getElementById('marsListsBtns');
        const escContainer = document.getElementById('escNotesBtns');
        const settingsContainer = document.getElementById('settingsBtns');
        marsContainer.innerHTML = '';
        escContainer.innerHTML = '';
        settingsContainer.innerHTML = '';

        marsButtons.forEach(list => {
            const btn = document.createElement('button');
            btn.className = 'mars-lists';
            btn.textContent = list.label;
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                fetchJSON(list)
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

        settingsItems.forEach(obj => {
            const btn = document.createElement('button');
            btn.className = 'settings-items';
            btn.dataset.id = obj.id;
            btn.textContent = obj.title;
            btn.classList.toggle('active', settingsState[obj.id]);
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                handleSettings(obj, btn);
            });
            settingsContainer.appendChild(btn);
        });
    } catch (err) {
        showToast('✗ Could not load button configurations', true);
        console.error(err);
    }
}

function fetchJSON(modalConfig) {
    fetch(`lists/${modalConfig.action}.json`)
        .then(res => {
            if (!res.ok) throw new Error('File not found');
            return res.json();
        })
        .then(data => {
            if (Array.isArray(data)) openMarsModal(modalConfig, data);
            else showToast('✗ Invalid data format', true);
        })
        .catch(() => {
            showToast(`✗ Failed to load the file for ${modalConfig.label}`, true);
        });
}

function handleSettings(object, btn) {
    settingsState[object.id] = !settingsState[object.id];
    btn.classList.toggle('active', settingsState[object.id]);
    saveData();

    if (object.id === 'showL2') {
        cardConfig = settingsState.showL2 ? fullCardConfig : fullCardConfig.filter(card => card.group !== 'b');
        loadSavedData();
        buildCards(cardConfig);
        updateAll();
    }
}

function buildCards(cards) {
    customIndices = [];
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
        fullCardConfig = cardConfig;
    } catch (_) {
        showToast('✗ Could not load cards.json', true);
        return;
    }

    try {
        const settingsRes = await fetch('lists/settings.json');
        if (settingsRes.ok) {
            const settingsItems = await settingsRes.json();
            const savedSettings = localStorage.getItem('marsSettings');
            const parsed = savedSettings ? JSON.parse(savedSettings) : {};
            settingsItems.forEach(item => {
                settingsState[item.id] = parsed[item.id];
            });
        }
    } catch (_) {
        showToast('✗ Could not load settings.json', true);
    }

    if (settingsState.showL2 === false) {
        cardConfig = cardConfig.filter(card => card.group !== 'b');
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
        const totalMs = getOtTotalMs();
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

    document.getElementById('changesHistoryBtn').onclick = () => fetchJSON({ label: "Changes History", action: "changes", columns: 1 });
    document.getElementById('modalCloseBtn').onclick = closeMarsModal;
    document.getElementById('marsModal').onclick = function(e) {
        if (e.target === e.currentTarget) closeMarsModal();
    };
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