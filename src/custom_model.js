import * as THREE from 'three';

const SCALE = 0.02;
const WALL_H = 2.5;
const WALL_T = 0.12;

export function buildCustomRoom(points, pillars) {
    const group = new THREE.Group();
    const walls = [];

    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const toVector = (point) =>
        new THREE.Vector2((point.x - cx) * SCALE, (point.y - cy) * SCALE);
    const area = points.reduce((sum, point, index) => {
        const next = points[(index + 1) % points.length];
        return sum + point.x * next.y - next.x * point.y;
    }, 0);
    const outwardDirection = area >= 0 ? 1 : -1;

    const floorShape = new THREE.Shape(points.map(toVector));
    pillars.forEach((pillar) => {
        floorShape.holes.push(new THREE.Path(pillar.map(toVector)));
    });

    const floor = new THREE.Mesh(
        new THREE.ShapeGeometry(floorShape),
        new THREE.MeshStandardMaterial({ color: 0xbfae93, side: THREE.DoubleSide })
    );
    floor.rotation.x = Math.PI / 2;
    floor.receiveShadow = true;
    group.add(floor);

    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xf0f0f0 });
    for (let i = 0; i < points.length; i++) {
        const a = toVector(points[i]);
        const b = toVector(points[(i + 1) % points.length]);
        const dx = b.x - a.x;
        const dz = b.y - a.y;
        const length = Math.hypot(dx, dz);

        const wall = new THREE.Mesh(
            new THREE.BoxGeometry(length + WALL_T, WALL_H, WALL_T),
            wallMaterial
        );
        wall.position.set((a.x + b.x) / 2, WALL_H / 2, (a.y + b.y) / 2);
        wall.rotation.y = -Math.atan2(dz, dx);
        wall.receiveShadow = true;
        group.add(wall);
        walls.push({
            mesh: wall,
            normal: new THREE.Vector3(
                outwardDirection * dz,
                0,
                outwardDirection * -dx
            ).normalize()
        });
    }

    const pillarMaterial = new THREE.MeshStandardMaterial({ color: 0xe08a2e });
    pillars.forEach((pillar) => {
        const mesh = new THREE.Mesh(
            new THREE.ExtrudeGeometry(new THREE.Shape(pillar.map(toVector)), {
                depth: WALL_H,
                bevelEnabled: false
            }),
            pillarMaterial
        );
        mesh.rotation.x = Math.PI / 2;
        mesh.position.y = WALL_H;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
    });

    group.userData.walls = walls;
    return group;
}
