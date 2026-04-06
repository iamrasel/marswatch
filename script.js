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

    for (let i = 0; i < 9; i++) {
        const elapsed = getCurrentElapsed(i);
        totalMs += elapsed;

        const timeEl = document.getElementById(`time-${i}`);
        if (timeEl) timeEl.textContent = formatTime(elapsed);

        const card = document.getElementById(`card-${i}`);
        if (card) card.classList.toggle("running", children[i].isRunning);
    }

    document.getElementById("parent-time").textContent = formatTime(totalMs);
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

function init() {
    const hasSaved = loadSavedData();

    if (!hasSaved) {
        children = Array(9).fill().map(() => ({
            frozenElapsed: 0,
            startTimestamp: null,
            isRunning: false
        }));
    }

    // Attach click listeners
    for (let i = 0; i < 9; i++) {
        const card = document.getElementById(`card-${i}`);
        if (card) card.addEventListener("click", () => toggleChild(i));
    }

    updateAll();
    interval = setInterval(updateAll, 10);

    // Auto-save every 5 seconds
    setInterval(saveData, 5000);

    // Save latest state just before refresh/close
    window.addEventListener("beforeunload", saveData);
}

window.onload = init;