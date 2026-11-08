const canvas = document.getElementById('draw');
const ctx = canvas.getContext('2d');

const GRID = 25;
const CLOSE_DISTANCE = 12;
const snap = v => Math.round(v / GRID) * GRID;
const pixelsToMetres = pixels => pixels / GRID;

const INK = '#1b2428';
const BRASS = '#c28a2c';
const PINE = '#1e5b4c';

let numPillars = 0;

let points = [];          // room outline
let isClosed = false;     // is the outline finished?

let pillars = [];         // FINISHED pillars: a list of lists, e.g. [[p,p,p,p], [p,p,p,p]]
let currentPillar = [];   // the pillar being drawn right now
let mousePoint = null;

const setup = document.getElementById('pillar-setup');
const pillarForm = document.getElementById('pillar-form');
const hasPillars = document.getElementById('has-pillars');
const pillarCountWrap = document.getElementById('pillar-count-wrap');
const pillarCount = document.getElementById('pillar-count');
const stepTitle = document.getElementById('step-title');
const stepHint = document.getElementById('step-hint');
const undoBtn = document.getElementById('undo-btn');
const resetBtn = document.getElementById('reset-btn');

hasPillars.addEventListener('change', () => {
    pillarCountWrap.hidden = hasPillars.value !== 'yes';
});

pillarForm.addEventListener('submit', event => {
    event.preventDefault();
    numPillars = hasPillars.value === 'yes' ? Number.parseInt(pillarCount.value, 10) : 0;
    sessionStorage.setItem('numPillars', String(numPillars));
    setup.remove();
    redraw();
});

function resizeCanvas() {
    // Draw at device resolution so lines and text stay sharp on high-DPI screens.
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    redraw();
}

function drawMeasurement(start, end, color, preview = false) {
    const distance = pixelsToMetres(Math.hypot(end.x - start.x, end.y - start.y) * 0.5);
    const label = `${distance.toFixed(1)} m`;
    const x = (start.x + end.x) / 2;
    const y = (start.y + end.y) / 2;

    ctx.save();
    if (preview) {
        ctx.setLineDash([6, 5]);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        ctx.setLineDash([]);
    }
    ctx.font = '600 13px Figtree, system-ui, sans-serif';
    const padding = 7;
    const textWidth = ctx.measureText(label).width;
    ctx.fillStyle = 'rgba(248, 247, 244, .95)';
    ctx.strokeStyle = 'rgba(27, 36, 40, .18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x - textWidth / 2 - padding, y - 12, textWidth + padding * 2, 24, 8);
    else ctx.rect(x - textWidth / 2 - padding, y - 12, textWidth + padding * 2, 24);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y + 1);
    ctx.restore();
}

// Draw ONE shape (lines + dots) without clearing the canvas
function drawShape(list, closed, color, fill) {
    if (list.length > 1) {
        ctx.beginPath();
        list.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
        if (closed) {
            ctx.closePath();
            if (fill) {
                ctx.fillStyle = fill;
                ctx.fill();
            }
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.stroke();

        for (let i = 1; i < list.length; i++) {
            drawMeasurement(list[i - 1], list[i], color);
        }
        if (closed) {
            drawMeasurement(list[list.length - 1], list[0], color);
        }
    }
    ctx.fillStyle = color;
    list.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fill();
    });
}

function nearFirstPoint(list, point) {
    return !!point && list.length > 2 &&
        Math.hypot(point.x - list[0].x, point.y - list[0].y) < CLOSE_DISTANCE;
}

// Clear once, then draw everything
function redraw() {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    drawShape(points, isClosed, INK, 'rgba(30, 91, 76, .08)');
    pillars.forEach(pillar => drawShape(pillar, true, BRASS, 'rgba(194, 138, 44, .28)'));   // finished pillars
    drawShape(currentPillar, false, BRASS);                                                  // the one in progress

    const activeList = isClosed ? currentPillar : points;
    const color = isClosed ? BRASS : INK;
    const closing = nearFirstPoint(activeList, mousePoint);

    if (activeList.length > 0 && mousePoint) {
        drawMeasurement(activeList[activeList.length - 1], mousePoint, color, true);
    }
    if (mousePoint) {
        // Snap cursor; turns into a bigger ring on the first corner when a click would close the shape.
        ctx.save();
        ctx.lineWidth = 2;
        ctx.strokeStyle = closing ? PINE : color;
        ctx.beginPath();
        ctx.arc(mousePoint.x, mousePoint.y, closing ? 11 : 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
    canvas.style.cursor = closing ? 'pointer' : 'crosshair';
    updatePanel();
}

function updatePanel() {
    const list = isClosed ? currentPillar : points;
    if (!isClosed) {
        stepTitle.textContent = 'Room outline';
        stepHint.textContent =
            list.length === 0 ? 'Click to place the first corner.' :
            list.length < 3 ? 'Keep clicking to add corners.' :
            'Click the first corner again to close the room.';
    } else {
        stepTitle.textContent = `Pillar ${pillars.length + 1} of ${numPillars}`;
        stepHint.textContent = currentPillar.length < 3
            ? 'Click to outline the pillar.'
            : 'Click its first corner to close it.';
    }
    const hasAnything = points.length > 0 || pillars.length > 0 || currentPillar.length > 0;
    undoBtn.disabled = !hasAnything;
    resetBtn.disabled = !hasAnything;
}

function undo() {
    if (isClosed) {
        if (currentPillar.length > 0) currentPillar.pop();
        else if (pillars.length > 0) currentPillar = pillars.pop();   // reopen the last pillar
        else isClosed = false;                                        // reopen the outline
    } else {
        points.pop();
    }
    redraw();
}

function startOver() {
    points = [];
    pillars = [];
    currentPillar = [];
    isClosed = false;
    redraw();
}

function finishRoom() {
    sessionStorage.removeItem('presetRoom');
    sessionStorage.setItem('customRoom', JSON.stringify({ points, pillars }));
    window.location.href = 'index.html';
}

canvas.addEventListener('click', e => {
    const p = { x: snap(e.clientX), y: snap(e.clientY) };

    // which list are we filling right now?
    const list = isClosed ? currentPillar : points;

    // clicked near the first point of THIS list => close it
    if (nearFirstPoint(list, p)) {
        if (isClosed) {
            pillars.push(currentPillar);   // save the finished pillar
            currentPillar = [];            // start a fresh empty one
        } else {
            isClosed = true;
        }

        if (isClosed && pillars.length >= numPillars) {
            finishRoom();
            return;
        }
        redraw();
        return;
    }

    list.push(p);
    redraw();
});

canvas.addEventListener('mousemove', e => {
    mousePoint = { x: snap(e.clientX), y: snap(e.clientY) };
    redraw();
});

canvas.addEventListener('mouseleave', () => {
    mousePoint = null;
    redraw();
});

undoBtn.addEventListener('click', undo);
resetBtn.addEventListener('click', startOver);
window.addEventListener('keydown', e => {
    if (setup.isConnected) return;
    const isUndoKey = e.key === 'Backspace' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z');
    if (isUndoKey) {
        e.preventDefault();
        undo();
    }
});

window.addEventListener('resize', resizeCanvas);
resizeCanvas();
