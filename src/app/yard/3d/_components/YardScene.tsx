"use client";
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { WholeYard, YardStackBox } from '@/lib/api/yard-map';

/**
 * THE YARD, IN THREE DIMENSIONS.
 *
 * The 2D map answers "where is there room"; this answers "what does the yard
 * actually look like" — which is the question a supervisor asks when a customer
 * says their box is at the back of a stack, and the question a new planner
 * needs answered before the yard means anything to them.
 *
 * WHAT IS DRAWN, and in what units. One grid cell of the 2D map is one ground
 * slot, and that stays true here: a block sits at its `layoutX`/`layoutY`
 * divided by the grid, is as many cells wide as it has bays and as many deep as
 * it has rows, and turns by `layoutRotationDeg`. A box is one cell of footprint
 * per 20 feet — a 40-footer spans two — and `TIER_HEIGHT` tall. The cells are
 * squares, as they are on the 2D map, which is a simplification both views
 * share rather than two different lies.
 *
 * WHY IT IS FAST. A yard of five thousand boxes is five thousand meshes if you
 * draw it naively, and that is a slideshow. Boxes are grouped by COLOUR and
 * each group is one `InstancedMesh`: one geometry, one material, one draw call,
 * a matrix per box. Hover and click come back through `instanceId`, which is
 * why each group keeps its own array of what it drew.
 *
 * WHY IT IS LOADED SEPARATELY. three.js is around 600 KB of JavaScript. The
 * page imports this component with `next/dynamic` and `ssr: false`, so a clerk
 * who never opens the 3D view never downloads it — and nothing here runs on the
 * server, where there is no WebGL and no window.
 */

/** One grid cell = one ground slot, as on the 2D map (20 px there). */
const GRID = 20;
/** A tier, in cell units. A container is taller than half its length is long. */
const TIER_HEIGHT = 0.55;
/** A hair of space, so boxes read as boxes rather than one long wall. */
const GAP = 0.08;

export type Lens = 'line' | 'fullEmpty' | 'dwell' | 'held';

/** Ten hues, picked to stay apart for colour-blind readers as well. */
const LINE_COLOURS = [
  '#2563eb', '#059669', '#d97706', '#7c3aed', '#0891b2',
  '#dc2626', '#4d7c0f', '#be185d', '#0f766e', '#a16207',
];

/** The same dwell bands Yard at a Glance colours a block by. */
function dwellColour(days: number): string {
  if (days >= 14) return '#dc2626';
  if (days >= 7) return '#d97706';
  if (days >= 4) return '#059669';
  return '#0284c7';
}

function lineColour(code: string): string {
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) >>> 0;
  return LINE_COLOURS[h % LINE_COLOURS.length];
}

function colourOf(box: YardStackBox, lens: Lens): string {
  switch (lens) {
    case 'line': return lineColour(box.lineCode || '—');
    case 'fullEmpty': return box.fullEmpty === 'FULL' ? '#2563eb' : '#9ca3af';
    case 'dwell': return dwellColour(box.daysInYard);
    case 'held': return box.isHeld ? '#d97706' : '#cbd5e1';
  }
}

/** What the pointer is over: enough for a tooltip and a click. */
export interface HoveredBox {
  containerNo: string;
  equipmentTypeCode: string | null;
  lineCode: string;
  fullEmpty: string;
  daysInYard: number;
  isHeld: boolean;
  label: string;
  /** Where the pointer was, in client pixels, so the tooltip can follow it. */
  x: number;
  y: number;
}

/** One drawn box, kept so a raycast hit can be turned back into a container. */
interface Drawn {
  box: YardStackBox;
  label: string;
  centre: THREE.Vector3;
}

export function YardScene({ yard, lens, showFree, focusContainerNo, onHover, onPick, onFailed }: {
  yard: WholeYard;
  lens: Lens;
  /** Draw the slots a box could go in as faint outlines. */
  showFree: boolean;
  /** A box to fly to and ring, from the search. */
  focusContainerNo: string | null;
  onHover: (box: HoveredBox | null) => void;
  onPick: (containerNo: string) => void;
  /**
   * WebGL would not start after all. The PAGE decides what to show instead —
   * it already has the 2D fallback for a browser that said no up front — so
   * there is one answer to "no 3D here" rather than two.
   */
  onFailed: (message: string) => void;
}) {
  const mount = useRef<HTMLDivElement | null>(null);
  /** Everything three.js owns, so it can all be disposed on unmount. */
  const world = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    picked: THREE.LineSegments;
    drawn: Map<THREE.InstancedMesh, Drawn[]>;
    frame: number;
  } | null>(null);

  // ── the scene, once ──────────────────────────────────────────────────────
  useEffect(() => {
    const host = mount.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      onFailed('This browser could not start WebGL.');
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.clientWidth, Math.max(360, host.clientHeight));
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#eef2f7');

    const camera = new THREE.PerspectiveCamera(50, host.clientWidth / Math.max(360, host.clientHeight), 0.5, 4000);
    camera.position.set(40, 40, 60);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2.05;   // never under the ground
    controls.screenSpacePanning = false;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 0.8);
    sun.position.set(60, 90, 40);
    scene.add(sun);

    /** The box a search found, ringed until the search is cleared. */
    const picked = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
      new THREE.LineBasicMaterial({ color: 0x0ea5e9 }),
    );
    picked.visible = false;
    scene.add(picked);

    const state = { renderer, scene, camera, controls, picked, drawn: new Map<THREE.InstancedMesh, Drawn[]>(), frame: 0 };
    world.current = state;

    const tick = () => {
      state.frame = requestAnimationFrame(tick);
      controls.update();
      renderer.render(scene, camera);
    };
    tick();

    const resize = () => {
      const w = host.clientWidth;
      const h = Math.max(360, host.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(state.frame);
      controls.dispose();
      // Every geometry and material this scene made, or the GPU keeps them.
      scene.traverse(object => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose?.();
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(material)) material.forEach(m => m.dispose());
        else material?.dispose?.();
      });
      renderer.dispose();
      host.removeChild(renderer.domElement);
      world.current = null;
    };
    // onFailed is stable (useCallback in the page) and the scene is built once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── the yard, whenever it or the lens changes ────────────────────────────
  useEffect(() => {
    const state = world.current;
    if (!state) return;
    const { scene, camera, controls } = state;

    // Out with the last yard: its meshes, and what they were.
    const old = scene.children.filter(c => c.userData.yard === true);
    for (const object of old) {
      scene.remove(object);
      object.traverse(child => {
        const mesh = child as THREE.Mesh;
        mesh.geometry?.dispose?.();
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(material)) material.forEach(m => m.dispose());
        else material?.dispose?.();
      });
    }
    state.drawn.clear();

    const root = new THREE.Group();
    root.userData.yard = true;

    /** Boxes by colour: one InstancedMesh each, one draw call each. */
    const byColour = new Map<string, { box: YardStackBox; label: string; m: THREE.Matrix4; centre: THREE.Vector3 }[]>();
    const blockedTiles: THREE.Matrix4[] = [];
    const freeTiles: THREE.Matrix4[] = [];
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;

    for (const plan of yard.blocks) {
      const block = plan.block;
      const bays = block.maxBays ?? Math.max(1, ...block.rows.flatMap(r => r.bays.map(b => b.bayNumber)));
      const rows = block.maxRows ?? Math.max(1, block.rows.length);
      const w = (plan.layoutWidth ?? bays * GRID) / GRID;
      const d = (plan.layoutHeight ?? rows * GRID) / GRID;
      const x0 = (plan.layoutX ?? 0) / GRID;
      const z0 = (plan.layoutY ?? 0) / GRID;

      const group = new THREE.Group();
      // The block turns about its own middle, exactly as the 2D map draws it.
      group.position.set(x0 + w / 2, 0, z0 + d / 2);
      group.rotation.y = -((plan.layoutRotationDeg ?? 0) * Math.PI) / 180;
      root.add(group);

      minX = Math.min(minX, x0); maxX = Math.max(maxX, x0 + w);
      minZ = Math.min(minZ, z0); maxZ = Math.max(maxZ, z0 + d);

      // The block's own ground, in its colour or its type's.
      const pad = new THREE.Mesh(
        new THREE.BoxGeometry(w, 0.08, d),
        new THREE.MeshLambertMaterial({ color: new THREE.Color(plan.displayColorHex || '#d8dee9') }),
      );
      pad.position.y = 0.04;
      group.add(pad);

      const rowIndex = new Map(block.rows.map((r, i) => [r.rowLabel, i]));
      for (const row of block.rows) {
        const rz = (rowIndex.get(row.rowLabel) ?? 0) + 0.5 - d / 2;
        for (const bay of row.bays) {
          const bx = bay.bayNumber - 0.5 - w / 2;
          for (const slot of bay.slots) {
            const y = (slot.tierNumber - 1) * TIER_HEIGHT + TIER_HEIGHT / 2 + 0.1;
            const local = new THREE.Vector3(bx, y, rz);
            if (slot.box) {
              // A 40-footer covers two bays; anything unknown is treated as one.
              const feet = Number(slot.box.equipmentTypeCode?.slice(0, 2));
              const long = feet === 40 || feet === 45;
              const size = new THREE.Vector3(long ? 2 - GAP : 1 - GAP, TIER_HEIGHT - GAP, 1 - GAP);
              const centre = local.clone();
              if (long) centre.x += 0.5;
              const matrix = new THREE.Matrix4().compose(centre, new THREE.Quaternion(), size);
              const key = colourOf(slot.box, lens);
              const list = byColour.get(key) ?? [];
              list.push({
                box: slot.box, label: slot.label, m: matrix,
                centre: group.localToWorld(centre.clone()),
              });
              byColour.set(key, list);
            } else if (slot.tierNumber === 1 && (slot.isBlocked || !slot.isActive)) {
              blockedTiles.push(new THREE.Matrix4().compose(
                new THREE.Vector3(bx, 0.1, rz), new THREE.Quaternion(), new THREE.Vector3(1 - GAP, 0.02, 1 - GAP)));
            } else if (showFree && slot.canTake) {
              freeTiles.push(new THREE.Matrix4().compose(
                local, new THREE.Quaternion(), new THREE.Vector3(1 - GAP, TIER_HEIGHT - GAP, 1 - GAP)));
            }
          }
        }
      }

      // One mesh per colour IN THIS BLOCK, so the block's rotation applies to
      // its own boxes and the instances stay in block space.
      for (const [colour, boxes] of byColour) {
        if (boxes.length === 0) continue;
        const mesh = new THREE.InstancedMesh(
          new THREE.BoxGeometry(1, 1, 1),
          new THREE.MeshLambertMaterial({ color: new THREE.Color(colour) }),
          boxes.length,
        );
        boxes.forEach((b, i) => mesh.setMatrixAt(i, b.m));
        mesh.instanceMatrix.needsUpdate = true;
        mesh.userData.yard = true;
        group.add(mesh);
        state.drawn.set(mesh, boxes.map(b => ({ box: b.box, label: b.label, centre: b.centre })));
      }
      byColour.clear();

      if (blockedTiles.length > 0) {
        const mesh = new THREE.InstancedMesh(
          new THREE.BoxGeometry(1, 1, 1),
          new THREE.MeshLambertMaterial({ color: new THREE.Color('#fca5a5') }),
          blockedTiles.length,
        );
        blockedTiles.forEach((m, i) => mesh.setMatrixAt(i, m));
        mesh.instanceMatrix.needsUpdate = true;
        group.add(mesh);
        blockedTiles.length = 0;
      }
      if (freeTiles.length > 0) {
        const mesh = new THREE.InstancedMesh(
          new THREE.BoxGeometry(1, 1, 1),
          new THREE.MeshBasicMaterial({ color: new THREE.Color('#94a3b8'), transparent: true, opacity: 0.12 }),
          freeTiles.length,
        );
        freeTiles.forEach((m, i) => mesh.setMatrixAt(i, m));
        mesh.instanceMatrix.needsUpdate = true;
        group.add(mesh);
        freeTiles.length = 0;
      }
    }

    // The ground, a little larger than the yard it carries.
    if (Number.isFinite(minX)) {
      const w = Math.max(10, maxX - minX) + 12;
      const d = Math.max(10, maxZ - minZ) + 12;
      const ground = new THREE.Mesh(
        new THREE.BoxGeometry(w, 0.05, d),
        new THREE.MeshLambertMaterial({ color: new THREE.Color('#f8fafc') }),
      );
      ground.position.set((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
      root.add(ground);

      // Open on the whole yard: the camera backs off as far as the yard is wide.
      const span = Math.max(w, d);
      controls.target.set((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
      camera.position.set(controls.target.x + span * 0.6, span * 0.5, controls.target.z + span * 0.8);
      camera.updateProjectionMatrix();
      controls.update();
    }

    scene.add(root);
  }, [yard, lens, showFree]);

  // ── the pointer ─────────────────────────────────────────────────────────
  useEffect(() => {
    const state = world.current;
    const host = mount.current;
    if (!state || !host) return;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const hit = (event: PointerEvent): Drawn | null => {
      const rect = state.renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, state.camera);
      const meshes = [...state.drawn.keys()];
      for (const found of raycaster.intersectObjects(meshes, false)) {
        const list = state.drawn.get(found.object as THREE.InstancedMesh);
        if (list && found.instanceId !== undefined && list[found.instanceId]) return list[found.instanceId];
      }
      return null;
    };

    const move = (event: PointerEvent) => {
      const found = hit(event);
      onHover(found
        ? { ...found.box, label: found.label, x: event.clientX, y: event.clientY }
        : null);
      state.renderer.domElement.style.cursor = found ? 'pointer' : 'grab';
    };
    const click = (event: PointerEvent) => {
      const found = hit(event);
      if (found) onPick(found.box.containerNo);
    };
    const leave = () => onHover(null);

    const canvas = state.renderer.domElement;
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerdown', click);
    canvas.addEventListener('pointerleave', leave);
    return () => {
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerdown', click);
      canvas.removeEventListener('pointerleave', leave);
    };
  }, [yard, lens, showFree, onHover, onPick]);

  // ── flying to a box the search found ────────────────────────────────────
  useEffect(() => {
    const state = world.current;
    if (!state) return;
    if (!focusContainerNo) { state.picked.visible = false; return; }
    for (const list of state.drawn.values()) {
      const found = list.find(d => d.box.containerNo === focusContainerNo);
      if (!found) continue;
      state.picked.position.copy(found.centre);
      state.picked.scale.set(2.2, TIER_HEIGHT * 2, 1.6);
      state.picked.visible = true;
      // Close enough to see which stack, far enough to see where in the yard.
      state.controls.target.copy(found.centre);
      state.camera.position.set(found.centre.x + 9, found.centre.y + 7, found.centre.z + 11);
      state.controls.update();
      return;
    }
    state.picked.visible = false;
  }, [focusContainerNo, yard, lens]);

  return <div ref={mount} className="gecko-yard3d-canvas" />;
}
