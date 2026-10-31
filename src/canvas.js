const canvas = document.getElementById('draw');
const ctx = canvas.getContext('2d');

const GRID = 50;
const snap = v => Math.round(v / GRID) * GRID;

let numPillars = 2;       // how many pillars the user wants (temporary, we'll prompt later)

let points = [];          // room outline
let isClosed = false;     // is the outline finished?

let pillars = [];         // FINISHED pillars: a list of lists, e.g. [[p,p,p,p], [p,p,p,p]]
let currentPillar = [];   // the pillar being drawn right now

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    redraw();
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

window.addEventListener('resize', resizeCanvas);
resizeCanvas();