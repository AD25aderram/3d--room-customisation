const canvas = document.getElementById('draw');
const ctx = canvas.getContext('2d');

const GRID = 25;
const snap = v => Math.round(v / GRID) * GRID;
const pixelsToMetres = pixels => pixels / GRID;

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
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    redraw();
}

function drawMeasurement(start, end, color, preview = false) {
    const distance = pixelsToMetres(Math.hypot(end.x - start.x, end.y - start.y) * 0.5);
    const label = `${distance.toFixed(1)} m`;
    const x = (start.x + end.x) / 2;
    const y = (start.y + end.y) / 2;

    ctx.save();
    ctx.font = '600 14px Inter, system-ui, sans-serif';
    const padding = 5;
    const textWidth = ctx.measureText(label).width;
    ctx.fillStyle = 'rgba(255, 253, 249, .9)';
    ctx.fillRect(x - textWidth / 2 - padding, y - 18, textWidth + padding * 2, 22);
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y - 7);
    if (preview) {
        ctx.setLineDash([6, 5]);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
    }
    ctx.restore();
}

// Draw ONE shape (lines + dots) without clearing the canvas
function drawShape(list, closed, color) {
    if (list.length > 1) {
        ctx.beginPath();
        list.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
        if (closed) ctx.closePath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
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

// Clear once, then draw everything
function redraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawShape(points, isClosed, 'black');
    pillars.forEach(pillar => drawShape(pillar, true, 'orange'));   // finished pillars
    drawShape(currentPillar, false, 'orange');                      // the one in progress

    const activeList = isClosed ? currentPillar : points;
    if (activeList.length > 0 && mousePoint) {
        drawMeasurement(activeList[activeList.length - 1], mousePoint, isClosed ? 'orange' : 'black', true);
    }
}

function finishRoom() {
    sessionStorage.setItem('customRoom', JSON.stringify({ points, pillars }));
    window.location.href = 'index.html';
}

canvas.addEventListener('click', e => {
    const p = { x: snap(e.clientX), y: snap(e.clientY) };

    // which list are we filling right now?
    const list = isClosed ? currentPillar : points;

    // clicked near the first point of THIS list => close it
    if (list.length > 2 && Math.hypot(p.x - list[0].x, p.y - list[0].y) < 12) {
        if (isClosed) {
            pillars.push(currentPillar);   // save the finished pillar
            currentPillar = [];            // start a fresh empty one
        } else {
            isClosed = true;
        }

        if (isClosed && pillars.length >= numPillars) {
            console.log('outline:', points);
            console.log('pillars:', pillars);
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

window.addEventListener('resize', resizeCanvas);
resizeCanvas();