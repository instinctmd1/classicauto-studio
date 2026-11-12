/* =========================================================================
   Rule N4: the illustrative Ferrari must show no Ferrari badge.
   The model carries its badges in three places:
     - mesh `yellow_trim`            the yellow shields on the fenders (hidden)
     - meshes `centre*`, `steering_centre`   the yellow shield on every wheel hub and the wheel (recoloured graphite)
     - a few triangles inside the shared `chrome` mesh: the prancing horse on the nose
       and on the tail, and the "Ferrari" lettering on the rear deck (removed)
   Boxes are in the glTF scene's own coordinate space (before any scale or move),
   found by raycasting the badges on screen and reading them back with worldToLocal.
   Call once, right after the GLB loads, for every page that shows the model.
   ========================================================================= */
import * as THREE from "three";

var HIDE = ["yellow_trim"];
var RECOLOR = ["centre", "centre_1", "centre_2", "centre_3", "steering_centre"];
var HUB_COLOR = 0x2b2c31;

/* [cx, cy, cz, halfX, halfY, halfZ] in scene space. */
var BOXES = [
  [0.000, 0.292, -2.199, 0.14, 0.13, 0.14],    // horse on the nose
  [-0.013, 0.843, 2.188, 0.11, 0.10, 0.12],    // horse on the tail
  [0.000, 0.950, 1.918, 0.20, 0.05, 0.10]      // "Ferrari" lettering on the rear deck
];
var CLEAN_MESHES = ["chrome"];   // the badges are chrome-material triangles; the dark plate behind the nose horse must stay

export function sanitizeCarModel(root) {
  root.updateMatrixWorld(true);
  var inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  var removed = 0;
  root.traverse(function (node) {
    if (!node.isMesh) return;
    if (HIDE.indexOf(node.name) !== -1) { node.visible = false; return; }
    if (RECOLOR.indexOf(node.name) !== -1) {
      node.material = node.material.clone();
      node.material.color.setHex(HUB_COLOR);
      node.material.metalness = 0.7; node.material.roughness = 0.35;
      if (node.material.emissive) node.material.emissive.setHex(0x000000);
      return;
    }
    if (CLEAN_MESHES.indexOf(node.name) === -1) return;
    var g = node.geometry, idx = g.index, pos = g.attributes.position;
    if (!idx) return;
    // mesh-local -> scene space
    var toScene = new THREE.Matrix4().multiplyMatrices(inv, node.matrixWorld);
    var keep = [], a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), m = new THREE.Vector3();
    for (var i = 0; i < idx.count; i += 3) {
      var i0 = idx.getX(i), i1 = idx.getX(i + 1), i2 = idx.getX(i + 2);
      a.fromBufferAttribute(pos, i0).applyMatrix4(toScene);
      b.fromBufferAttribute(pos, i1).applyMatrix4(toScene);
      c.fromBufferAttribute(pos, i2).applyMatrix4(toScene);
      m.copy(a).add(b).add(c).multiplyScalar(1 / 3);
      var drop = false;
      for (var k = 0; k < BOXES.length && !drop; k++) {
        var bx = BOXES[k];
        if (Math.abs(m.x - bx[0]) < bx[3] && Math.abs(m.y - bx[1]) < bx[4] && Math.abs(m.z - bx[2]) < bx[5]) drop = true;
      }
      if (drop) removed++; else keep.push(i0, i1, i2);
    }
    if (keep.length !== idx.count) g.setIndex(new THREE.BufferAttribute(new Uint32Array(keep), 1));
  });
  return removed;
}
