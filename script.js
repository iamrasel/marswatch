let children = [];
let interval = null;

// Load saved data
function loadSavedData() {
    const saved = localStorage.getItem('marsStopwatches');
    if (!saved) return false;

    try {
        const data = JSON.parse(saved);
        const now = Date.now();

        children = data.map(item => {
            let frozenElapsed = item.frozenElapsed || 0;
            let startTimestamp = item.startTimestamp || null;
            const wasRunning = item.isRunning === true;

            if (wasRunning && startTimestamp) {
                const realElapsed = now - startTimestamp;
                frozenElapsed += realElapsed;
                startTimestamp = now;
            }

            return {
                frozenElapsed: Math.max(0, Math.floor(frozenElapsed)),
                startTimestamp: wasRunning ? now : null,
                isRunning: wasRunning
            };
        });
        return true;
    } catch (e) {
        console.error("Failed to load saved data:", e);
        return false;
    }
}

// Save current state
function saveData() {
    const now = Date.now();
    const dataToSave = children.map(child => ({
        frozenElapsed: child.frozenElapsed || 0,
        startTimestamp: child.isRunning ? child.startTimestamp : null,
        isRunning: child.isRunning
    }));

    localStorage.setItem('marsStopwatches', JSON.stringify(dataToSave));
}

function formatTime(ms) {
    const totalCs = Math.floor(ms / 10);
    const cs = totalCs % 100;
    const totalSec = Math.floor(totalCs / 100);
    const sec = totalSec % 60;
    const min = Math.floor(totalSec / 60) % 60;
    const hr = Math.floor(totalSec / 3600);

    return `${hr < 10 ? '0' : ''}${hr}:${min < 10 ? '0' : ''}${min}:${sec < 10 ? '0' : ''}${sec}.${cs < 10 ? '0' : ''}${cs}`;
}

function getCurrentElapsed(index) {
    const c = children[index];
    if (!c.isRunning || !c.startTimestamp) {
        return c.frozenElapsed || 0;
    }
    return (c.frozenElapsed || 0) + (Date.now() - c.startTimestamp);
}

function updateAll() {
    let totalMs = 0;
    let anyRunning = false;

    for (let i = 0; i < 9; i++) {
        const elapsed = getCurrentElapsed(i);
        totalMs += elapsed;

        const timeEl = document.getElementById(`time-${i}`);
        if (timeEl) timeEl.textContent = formatTime(elapsed);

        const card = document.getElementById(`card-${i}`);
        if (card) card.classList.toggle("running", children[i].isRunning);

        if (children[i].isRunning) anyRunning = true;
    }

    document.getElementById("parent-time").textContent = formatTime(totalMs);

    const pauseBtn = document.getElementById("pause-button");
    if (pauseBtn) {
        pauseBtn.style.display = anyRunning ? "inline-block" : "none";
    }
}

function toggleChild(idx) {
    const now = Date.now();
    const child = children[idx];

    // Pause all others
    for (let i = 0; i < 9; i++) {
        if (i === idx) continue;
        const other = children[i];
        if (other.isRunning && other.startTimestamp) {
            other.frozenElapsed += (now - other.startTimestamp);
            other.isRunning = false;
            other.startTimestamp = null;
        }
    }

    // Toggle this child
    if (child.isRunning) {
        child.frozenElapsed += (now - child.startTimestamp);
        child.isRunning = false;
        child.startTimestamp = null;
    } else {
        child.startTimestamp = now;
        child.isRunning = true;
    }

    saveData();
    updateAll();
}

function resetAll() {
    if (!confirm("Are you sure to reset all stopwatches?")) return;

    children.forEach(c => {
        c.frozenElapsed = 0;
        c.isRunning = false;
        c.startTimestamp = null;
    });

    localStorage.removeItem('marsStopwatches');
    updateAll();
}

function pauseAll() {
    const now = Date.now();
    let wasRunning = false;

    for (let i = 0; i < 9; i++) {
        const child = children[i];
        if (child.isRunning && child.startTimestamp) {
            child.frozenElapsed += (now - child.startTimestamp);
            child.isRunning = false;
            child.startTimestamp = null;
            wasRunning = true;
        }
    }

    if (wasRunning) {
        saveData();
        updateAll();
    }
}

function toggleTheme() {
    document.body.classList.toggle('dark');
    
    const isDark = document.body.classList.contains('dark');
    const toggleBtn = document.getElementById('theme-toggle');
    
    toggleBtn.textContent = isDark ? '☀️' : '🌙';
    
    localStorage.setItem('marsWatchTheme', isDark ? 'dark' : 'light');
}

function loadTheme() {
    const savedTheme = localStorage.getItem('marsWatchTheme');
    const toggleBtn = document.getElementById('theme-toggle');
    
    if (savedTheme === 'dark') {
        document.body.classList.add('dark');
        if (toggleBtn) toggleBtn.textContent = '☀️';
    } else {
        if (toggleBtn) toggleBtn.textContent = '🌙';
    }
}

function showToast(message, isError = false) {
    let toast = document.getElementById('mars-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'mars-toast';
        document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.className = 'visibility' + (isError ? ' error' : '');

    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => {
        toast.className = '';
    }, 2200);
}

function copyData() {
    pauseAll();

    const labels = [
        "L1 US LB", "L2 EU LF", "L2 EU LB",
        "L1 US LF", "OTHER",    "L2 US LF",
        "L1 EU LB", "L1 EU LF", "L2 US LB"
    ];

    const payload = children.map((c, i) => ({
        index: i,
        label: labels[i],
        frozenElapsed: c.frozenElapsed || 0,
        isRunning: false,
        startTimestamp: null
    }));

    const json = JSON.stringify(payload, null, 2);

    navigator.clipboard.writeText(json)
        .then(() => showToast("✓ Copied to clipboard"))
        .catch(() => {
            // Fallback for browsers that block clipboard API
            const ta = document.createElement('textarea');
            ta.value = json;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            showToast("✓ Copied to clipboard");
        });
}

function pasteData() {
    navigator.clipboard.readText()
        .then(text => applyPastedJSON(text))
        .catch(() => {
            // Fallback: prompt the user to paste manually
            const text = prompt("Paste your MarsWatch JSON data here:");
            if (text) applyPastedJSON(text);
        });
}

function applyPastedJSON(text) {
    try {
        const data = JSON.parse(text.trim());

        if (!Array.isArray(data) || data.length !== 9) {
            showToast("✗ Corrupted data: expected 9 entries", true);
            return;
        }

        const now = Date.now();

        children = data.map(item => {
            const frozenElapsed = typeof item.frozenElapsed === 'number'
                ? Math.max(0, Math.floor(item.frozenElapsed))
                : 0;
            const wasRunning = item.isRunning === true;
            return {
                frozenElapsed,
                startTimestamp: wasRunning ? now : null,
                isRunning: wasRunning
            };
        });

        saveData();
        updateAll();
        showToast("✓ Data imported");
    } catch (e) {
        showToast("✗ Invalid JSON", true);
    }
}

function init() {
    const hasSaved = loadSavedData();

    if (!hasSaved) {
        children = Array(9).fill().map(() => ({
            frozenElapsed: 0,
            startTimestamp: null,
            isRunning: false
        }));
    }

    for (let i = 0; i < 9; i++) {
        const card = document.getElementById(`card-${i}`);
        if (card) card.addEventListener("click", () => toggleChild(i));
    }

    loadTheme();
    updateAll();
    interval = setInterval(updateAll, 10);

    setInterval(saveData, 5000);
    window.addEventListener("beforeunload", saveData);
}

window.onload = init;