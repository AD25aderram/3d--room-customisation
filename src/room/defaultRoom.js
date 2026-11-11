import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Vector3 } from "three";

/** Builds and returns the fallback 10 by 10 room, with dimensions measured in scene units. */
export function buildDefaultRoom() {
  const W=10,D=10,H=4,T=.2,floorMat=new MeshStandardMaterial({color:0x8b5a2b}),backMat=new MeshStandardMaterial({color:0xd9e4f5}),frontMat=new MeshStandardMaterial({color:0xf2d4d4}),leftMat=new MeshStandardMaterial({color:0xf5e6d3}),rightMat=new MeshStandardMaterial({color:0xd4f2d9}),group=new Group(),walls=[];

  function addPart(w,h,d,x,y,z,material){
    const mesh=new Mesh(new BoxGeometry(w,h,d),material);
    mesh.position.set(x,y,z);
    mesh.receiveShadow=true;
    group.add(mesh);
    return mesh;
  }

  function addWall(w,h,d,x,y,z,normal,material){
    const mesh=addPart(w,h,d,x,y,z,material);
    walls.push({mesh,normal:new Vector3(...normal)});
  }

  addPart(W,T,D,0,-T/2,0,floorMat);
  addWall(W,H,T,0,H/2,-D/2,[0,0,-1],backMat);
  addWall(W,H,T,0,H/2,D/2,[0,0,1],frontMat);
  addWall(T,H,D-T,-W/2,H/2,0,[-1,0,0],leftMat);
  addWall(T,H,D-T,W/2,H/2,0,[1,0,0],rightMat);
  
  group.userData.walls=walls;
  group.userData.outline=[{x:-W/2,z:-D/2},{x:W/2,z:-D/2},{x:W/2,z:D/2},{x:-W/2,z:D/2}];
  group.userData.pillars=[];
  group.userData.wallThickness=T;
  
  return group;
}
