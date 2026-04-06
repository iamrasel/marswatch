let children = [];
let interval = null;
let lastSaveTime = Date.now();

// Load saved data
function loadSavedData() {
    const saved = localStorage.getItem('marsStopwatches');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            children = data.map(item => ({
                elapsed: item.elapsed || 0,
                startTime: item.isRunning ? Date.now() : null,   // Start counting from NOW
                isRunning: item.isRunning || false
            }));
            return true;
        } catch (e) {
            console.error("Failed to load saved data");
        }
    }
    return false;
}

// Save current state
function saveData() {
    const dataToSave = children.map(child => {
        let currentElapsed = child.elapsed;
        if (child.isRunning && child.startTime) {
            currentElapsed += (Date.now() - child.startTime);
        }
        return {
            elapsed: currentElapsed,
            isRunning: child.isRunning
        };
    });

    localStorage.setItem('marsStopwatches', JSON.stringify(dataToSave));
    lastSaveTime = Date.now();
}

function formatTime(ms) {
    let totalCs = Math.floor(ms / 10);
    let cs = totalCs % 100;
    let totalSec = Math.floor(totalCs / 100);
    let sec = totalSec % 60;
    let min = Math.floor(totalSec / 60) % 60;
    let hr = Math.floor(totalSec / 3600);

    let hrStr = hr < 10 ? "0" + hr : hr;
    let minStr = min < 10 ? "0" + min : min;
    let secStr = sec < 10 ? "0" + sec : sec;
    let csStr = cs < 10 ? "0" + cs : cs;

    return hrStr + ":" + minStr + ":" + secStr + "." + csStr;
}

function getCurrentElapsed(index) {
    const c = children[index];
    if (!c.isRunning || !c.startTime) return c.elapsed;
    return c.elapsed + (Date.now() - c.startTime);
}

function updateAll() {
    let totalMs = 0;

    for (let i = 0; i < 9; i++) {
        const elapsed = getCurrentElapsed(i);
        totalMs += elapsed;

        const timeEl = document.getElementById("time-" + i);
        if (timeEl) timeEl.textContent = formatTime(elapsed);

        const card = document.getElementById("card-" + i);
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
        if (other.isRunning && other.startTime) {
            other.elapsed += (now - other.startTime);
            other.isRunning = false;
            other.startTime = null;
        }
    }

    // Toggle this child
    if (child.isRunning) {
        child.elapsed += (now - child.startTime);
        child.isRunning = false;
        child.startTime = null;
    } else {
        child.startTime = now;
        child.isRunning = true;
    }

    saveData();
    updateAll();
}

function resetAll() {
    if (!confirm("Are you sure to reset all stopwatches?")) return;

    children.forEach(c => {
        c.elapsed = 0;
        c.isRunning = false;
        c.startTime = null;
    });

    localStorage.removeItem('marsStopwatches');
    updateAll();
}

function init() {
    const hasSavedData = loadSavedData();

    if (!hasSavedData) {
        children = Array(9).fill().map(() => ({
            elapsed: 0,
            startTime: null,
            isRunning: false
        }));
    }

    // Attach click listeners
    for (let i = 0; i < 9; i++) {
        const card = document.getElementById("card-" + i);
        if (card) {
            card.addEventListener("click", () => toggleChild(i));
        }
    }

    updateAll();
    interval = setInterval(updateAll, 10);

    // Auto-save every 3 seconds
    setInterval(saveData, 3000);
}

window.onload = init;