import * as THREE from "three";
import { API_URL, ROOM } from "./config.js";

/* ============================================================
   SKY OF LANTERNS — web game lấy cảm hứng từ Sky: Children of the Light
   Frontend: Three.js (chạy tĩnh trên GitHub Pages)
   Backend : Google Apps Script (Code.gs) — lưu tiến trình + nhiều người chơi
   ============================================================ */

/* ---------- 1. Thiết lập scene ---------- */
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
document.getElementById("app").appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color("#8fb6e8");
scene.fog = new THREE.FogExp2("#c8d8f2", 0.0055);

const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 2000);

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// Ánh sáng: hoàng hôn ấm + trời xanh
const sun = new THREE.DirectionalLight("#ffd9a8", 2.1);
sun.position.set(60, 90, 40);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 10;
sun.shadow.camera.far = 320;
const S = 120;
Object.assign(sun.shadow.camera, { left: -S, right: S, top: S, bottom: -S });
sun.shadow.camera.updateProjectionMatrix();
scene.add(sun);
scene.add(new THREE.HemisphereLight("#bfe0ff", "#6a5a86", 1.0));

/* ---------- 2. Thế giới: biển mây + đảo bay ---------- */
const world = new THREE.Group();
scene.add(world);

// Biển mây bên dưới
const seaGeo = new THREE.PlaneGeometry(1600, 1600, 80, 80);
const pos = seaGeo.attributes.position;
for (let i = 0; i < pos.count; i++) {
  const x = pos.getX(i), y = pos.getY(i);
  pos.setZ(i, Math.sin(x * 0.03) * 2.2 + Math.cos(y * 0.025) * 2.6);
}
seaGeo.computeVertexNormals();
const cloudSea = new THREE.Mesh(
  seaGeo,
  new THREE.MeshStandardMaterial({ color: "#eaf1ff", roughness: 1, metalness: 0 })
);
cloudSea.rotation.x = -Math.PI / 2;
cloudSea.position.y = -34;
world.add(cloudSea);

// Định nghĩa các đảo (x, y, z, bán kính)
const ISLANDS = [
  { x: 0, y: 0, z: 0, r: 26 },
  { x: 58, y: 9, z: -34, r: 17 },
  { x: -52, y: 14, z: -46, r: 15 },
  { x: 14, y: 22, z: -92, r: 19 },
  { x: -74, y: 27, z: -110, r: 14 },
  { x: 72, y: 33, z: -122, r: 16 },
  { x: -8, y: 44, z: -170, r: 22 },
];

const groundMat = new THREE.MeshStandardMaterial({ color: "#c9a97d", roughness: 0.95 });
const grassMat = new THREE.MeshStandardMaterial({ color: "#8fae6b", roughness: 0.9 });
const stoneMat = new THREE.MeshStandardMaterial({ color: "#9a9385", roughness: 0.8 });

for (const isl of ISLANDS) {
  // thân đảo hình nón lộn ngược
  const base = new THREE.Mesh(new THREE.ConeGeometry(isl.r, isl.r * 1.8, 9), groundMat);
  base.position.set(isl.x, isl.y - isl.r * 0.9, isl.z);
  base.rotation.y = Math.random() * Math.PI;
  base.castShadow = true;
  world.add(base);

  // mặt trên
  const top = new THREE.Mesh(new THREE.CylinderGeometry(isl.r, isl.r, 1.2, 9), grassMat);
  top.position.set(isl.x, isl.y, isl.z);
  top.rotation.y = base.rotation.y;
  top.receiveShadow = true;
  world.add(top);

  // vài tảng đá trang trí
  for (let i = 0; i < 5; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = Math.random() * isl.r * 0.75;
    const s = 0.9 + Math.random() * 2.2;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), stoneMat);
    rock.position.set(isl.x + Math.cos(a) * d, isl.y + s * 0.4, isl.z + Math.sin(a) * d);
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.castShadow = true;
    rock.receiveShadow = true;
    world.add(rock);
  }
}

// chiều cao mặt đất tại (x,z) — trả về null nếu đang ở ngoài đảo
function groundHeight(x, z) {
  let h = null;
  for (const isl of ISLANDS) {
    const d = Math.hypot(x - isl.x, z - isl.z);
    if (d < isl.r - 0.6) h = Math.max(h ?? -Infinity, isl.y + 0.6);
  }
  return h;
}

/* ---------- 3. Nhân vật ---------- */
function makeTraveler(robeColor = "#5f4b8b", capeColor = "#e8734a") {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.42, 0.9, 6, 12),
    new THREE.MeshStandardMaterial({ color: robeColor, roughness: 0.85 })
  );
  body.position.y = 1.0;
  body.castShadow = true;
  g.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 20, 16),
    new THREE.MeshStandardMaterial({ color: "#f0dcc0", roughness: 0.7 })
  );
  head.position.y = 1.85;
  head.castShadow = true;
  g.add(head);

  const mask = new THREE.Mesh(
    new THREE.SphereGeometry(0.345, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.45),
    new THREE.MeshStandardMaterial({ color: "#2a2340", roughness: 0.5 })
  );
  mask.position.y = 1.87;
  g.add(mask);

  // áo choàng — cánh bay
  const cape = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 1.7, 6, 6),
    new THREE.MeshStandardMaterial({ color: capeColor, roughness: 0.9, side: THREE.DoubleSide })
  );
  cape.position.set(0, 1.15, -0.4);
  cape.castShadow = true;
  g.add(cape);

  const glow = new THREE.PointLight("#ffcf8a", 0, 12);
  glow.position.y = 1.4;
  g.add(glow);

  g.userData = { cape, glow, head };
  return g;
}

const player = makeTraveler();
player.position.set(0, 1, 12);
scene.add(player);

/* ---------- 4. Vật phẩm: ánh sáng, nến, cổng ---------- */
const motes = [];
const moteGeo = new THREE.IcosahedronGeometry(0.34, 0);
const moteMat = new THREE.MeshStandardMaterial({
  color: "#fff0c4", emissive: "#ffcf72", emissiveIntensity: 2.2, roughness: 0.3,
});
for (const isl of ISLANDS) {
  for (let i = 0; i < 6; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = Math.random() * isl.r * 0.8;
    const m = new THREE.Mesh(moteGeo, moteMat);
    m.position.set(isl.x + Math.cos(a) * d, isl.y + 1.4 + Math.random() * 3, isl.z + Math.sin(a) * d);
    m.userData.phase = Math.random() * 6.28;
    scene.add(m);
    motes.push(m);
  }
}

// Tượng nến (thắp bằng phím E, tốn 1 ánh sáng, cho 1 nến)
const candleStands = [];
const unlitMat = new THREE.MeshStandardMaterial({ color: "#6d6a7d", roughness: 0.8 });
for (const isl of ISLANDS) {
  const stand = new THREE.Group();
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 2.2, 10), unlitMat.clone());
  pillar.position.y = 1.1;
  pillar.castShadow = true;
  stand.add(pillar);
  const flame = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 12, 10),
    new THREE.MeshStandardMaterial({ color: "#ffd98a", emissive: "#ff9d3c", emissiveIntensity: 0 })
  );
  flame.position.y = 2.4;
  stand.add(flame);
  const light = new THREE.PointLight("#ffb457", 0, 22);
  light.position.y = 2.6;
  stand.add(light);
  stand.position.set(isl.x + isl.r * 0.35, isl.y, isl.z - isl.r * 0.3);
  stand.userData = { lit: false, flame, light, pillar };
  scene.add(stand);
  candleStands.push(stand);
}

// Cổng ánh sáng: cần 2 / 4 / 6 nến
const GATE_COST = [2, 4, 6];
const gates = [];
GATE_COST.forEach((cost, i) => {
  const isl = ISLANDS[[3, 5, 6][i]];
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(3.2, 0.32, 12, 40),
    new THREE.MeshStandardMaterial({ color: "#6f7fae", emissive: "#2b3d6b", emissiveIntensity: 0.4, roughness: 0.4 })
  );
  ring.position.set(isl.x - isl.r * 0.3, isl.y + 3.6, isl.z + isl.r * 0.3);
  ring.userData = { cost, open: false };
  scene.add(ring);
  gates.push(ring);
});

/* ---------- 5. Điều khiển ---------- */
const keys = Object.create(null);
addEventListener("keydown", (e) => {
  keys[e.code] = true;
  if (e.code === "KeyE") interact();
  if (e.code === "Space") e.preventDefault();
});
addEventListener("keyup", (e) => (keys[e.code] = false));

let yaw = 0, pitch = -0.18;
renderer.domElement.addEventListener("click", () => renderer.domElement.requestPointerLock?.());
addEventListener("mousemove", (e) => {
  if (document.pointerLockElement !== renderer.domElement) return;
  yaw -= e.movementX * 0.0024;
  pitch = THREE.MathUtils.clamp(pitch - e.movementY * 0.0020, -0.9, 0.7);
});

// Cảm ứng (điện thoại)
const touchMove = { x: 0, y: 0 };
let touchFly = false;
(function setupTouch() {
  const stick = document.getElementById("stick"), knob = document.getElementById("knob");
  let id = null, cx = 0, cy = 0;
  stick.addEventListener("pointerdown", (e) => {
    id = e.pointerId; const r = stick.getBoundingClientRect();
    cx = r.left + r.width / 2; cy = r.top + r.height / 2; stick.setPointerCapture(id);
  });
  stick.addEventListener("pointermove", (e) => {
    if (e.pointerId !== id) return;
    const dx = THREE.MathUtils.clamp((e.clientX - cx) / 55, -1, 1);
    const dy = THREE.MathUtils.clamp((e.clientY - cy) / 55, -1, 1);
    touchMove.x = dx; touchMove.y = dy;
    knob.style.transform = `translate(${dx * 40}px, ${dy * 40}px)`;
  });
  const end = () => { id = null; touchMove.x = touchMove.y = 0; knob.style.transform = ""; };
  stick.addEventListener("pointerup", end);
  stick.addEventListener("pointercancel", end);

  const fly = document.getElementById("fly");
  fly.addEventListener("pointerdown", () => (touchFly = true));
  fly.addEventListener("pointerup", () => (touchFly = false));
  fly.addEventListener("pointercancel", () => (touchFly = false));

  // vuốt màn hình để xoay camera
  let lx = 0, ly = 0, dragging = false;
  addEventListener("pointerdown", (e) => {
    if (e.target.closest("#stick,#fly,button,input")) return;
    dragging = true; lx = e.clientX; ly = e.clientY;
  });
  addEventListener("pointermove", (e) => {
    if (!dragging || e.pointerType === "mouse") return;
    yaw -= (e.clientX - lx) * 0.005;
    pitch = THREE.MathUtils.clamp(pitch - (e.clientY - ly) * 0.004, -0.9, 0.7);
    lx = e.clientX; ly = e.clientY;
  });
  addEventListener("pointerup", () => (dragging = false));
})();

/* ---------- 6. Trạng thái người chơi ---------- */
const state = {
  name: "Traveler",
  wax: 0,          // ánh sáng thu thập
  candles: 0,      // nến đã thắp
  gates: 0,
  energy: 1,       // 0..1 năng lượng bay
  litIds: [],
  openGates: [],
};

const vel = new THREE.Vector3();
let flying = false, onGround = false;

function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.style.opacity = 1;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (el.style.opacity = 0), 1800);
}

function interact() {
  // thắp nến
  candleStands.forEach((s, i) => {
    if (s.userData.lit) return;
    if (player.position.distanceTo(s.position) > 4) return;
    if (state.wax < 1) return toast("Cần 1 ✨ ánh sáng để thắp nến");
    s.userData.lit = true;
    s.userData.flame.material.emissiveIntensity = 3;
    s.userData.light.intensity = 3.2;
    s.userData.pillar.material.color.set("#e7d7b8");
    state.wax -= 1; state.candles += 1; state.litIds.push(i);
    toast("🕯️ Bạn đã thắp sáng một tượng đài");
    save();
  });
  // mở cổng
  gates.forEach((g, i) => {
    if (g.userData.open) return;
    if (player.position.distanceTo(g.position) > 6) return;
    if (state.candles < g.userData.cost) return toast(`Cổng này cần ${g.userData.cost} 🕯️ nến`);
    g.userData.open = true;
    g.material.emissive.set("#ffd27a");
    g.material.emissiveIntensity = 2.4;
    state.gates += 1; state.openGates.push(i);
    toast(state.gates === 3 ? "🌅 Bạn đã mở toàn bộ cổng ánh sáng!" : "✨ Một cổng ánh sáng mở ra");
    save();
  });
}

/* ---------- 7. Nhiều người chơi + lưu tiến trình (Apps Script) ---------- */
const others = new Map(); // id -> {group, target}
const MY_ID = localStorage.getItem("sky-id") || (crypto.randomUUID?.() ?? String(Math.random()).slice(2));
localStorage.setItem("sky-id", MY_ID);

async function api(action, payload = {}) {
  if (!API_URL) return null;
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      // text/plain => không bị CORS preflight với Apps Script
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, room: ROOM, id: MY_ID, ...payload }),
    });
    return await res.json();
  } catch (err) {
    console.warn("API lỗi:", err);
    return null;
  }
}

function save() {
  localStorage.setItem("sky-save", JSON.stringify(state));
  api("save", { state });
}

async function load() {
  const local = localStorage.getItem("sky-save");
  let data = local ? JSON.parse(local) : null;
  const remote = await api("load");
  if (remote?.state) data = remote.state;
  if (!data) return;
  Object.assign(state, data, { name: state.name });
  (state.litIds || []).forEach((i) => {
    const s = candleStands[i];
    if (!s) return;
    s.userData.lit = true;
    s.userData.flame.material.emissiveIntensity = 3;
    s.userData.light.intensity = 3.2;
    s.userData.pillar.material.color.set("#e7d7b8");
  });
  (state.openGates || []).forEach((i) => {
    const g = gates[i];
    if (!g) return;
    g.userData.open = true;
    g.material.emissive.set("#ffd27a");
    g.material.emissiveIntensity = 2.4;
  });
}

async function syncPresence() {
  const p = player.position;
  const res = await api("sync", {
    name: state.name,
    x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2),
    ry: +player.rotation.y.toFixed(2),
    candles: state.candles,
  });
  if (!res?.players) return;
  const seen = new Set();
  for (const pl of res.players) {
    if (pl.id === MY_ID) continue;
    seen.add(pl.id);
    let o = others.get(pl.id);
    if (!o) {
      const g = makeTraveler("#3f5a8a", "#9ad1e8");
      scene.add(g);
      o = { group: g, target: new THREE.Vector3(pl.x, pl.y, pl.z), ry: pl.ry || 0 };
      others.set(pl.id, o);
    }
    o.target.set(pl.x, pl.y, pl.z);
    o.ry = pl.ry || 0;
  }
  for (const [id, o] of others) {
    if (!seen.has(id)) { scene.remove(o.group); others.delete(id); }
  }
  document.getElementById("online").textContent = res.players.length;
}
setInterval(() => { if (started && API_URL) syncPresence(); }, 1000);

/* ---------- 8. Vòng lặp game ---------- */
const clock = new THREE.Clock();
const camTarget = new THREE.Vector3();
let started = false;

function update(dt) {
  /* --- di chuyển --- */
  const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));

  let ix = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + touchMove.x;
  let iz = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0) - touchMove.y;
  const wish = new THREE.Vector3()
    .addScaledVector(right, ix)
    .addScaledVector(fwd, iz);
  if (wish.lengthSq() > 0) wish.normalize();

  const wantFly = (keys.Space || touchFly) && state.energy > 0.001;
  flying = wantFly || (!onGround && vel.y > -14 && state.energy > 0);

  const accel = flying ? 34 : 26;
  vel.x += wish.x * accel * dt;
  vel.z += wish.z * accel * dt;

  // cản (độc lập framerate)
  const damp = Math.exp(-(flying ? 1.6 : 7.5) * dt);
  vel.x *= damp; vel.z *= damp;

  if (wantFly) {
    vel.y += 26 * dt;                 // lực nâng của áo choàng
    state.energy = Math.max(0, state.energy - dt * 0.13);
  } else {
    vel.y -= 19 * dt;                 // trọng lực
  }
  vel.y = THREE.MathUtils.clamp(vel.y, -26, 13);

  player.position.addScaledVector(vel, dt);

  /* --- va chạm với đảo --- */
  const gh = groundHeight(player.position.x, player.position.z);
  onGround = false;
  if (gh !== null && player.position.y <= gh) {
    player.position.y = gh;
    vel.y = 0;
    onGround = true;
    state.energy = Math.min(1, state.energy + dt * 0.5); // hồi năng lượng khi chạm đất
  }
  // rơi khỏi bản đồ => quay về đảo đầu
  if (player.position.y < -40) {
    player.position.set(0, 3, 12); vel.set(0, 0, 0); state.energy = 1;
    toast("Mây đã đưa bạn trở lại bờ");
  }

  /* --- hướng nhìn + hiệu ứng áo choàng --- */
  if (wish.lengthSq() > 0.01) {
    const want = Math.atan2(wish.x, wish.z);
    player.rotation.y += THREE.MathUtils.clamp(
      ((want - player.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI, -6 * dt, 6 * dt
    );
  }
  const cape = player.userData.cape;
  cape.rotation.x = THREE.MathUtils.lerp(cape.rotation.x, flying ? -1.0 : -0.15, 1 - Math.exp(-8 * dt));
  cape.scale.x = THREE.MathUtils.lerp(cape.scale.x, flying ? 1.9 : 1, 1 - Math.exp(-6 * dt));
  player.userData.glow.intensity = 0.4 + state.candles * 0.35;

  /* --- thu thập ánh sáng --- */
  for (const m of motes) {
    if (!m.visible) continue;
    m.rotation.y += dt * 1.6;
    m.position.y += Math.sin(performance.now() * 0.002 + m.userData.phase) * dt * 0.5;
    if (m.position.distanceTo(player.position) < 2.2) {
      m.visible = false;
      state.wax += 1;
      state.energy = Math.min(1, state.energy + 0.25);
      toast("✨ +1 ánh sáng");
      save();
      setTimeout(() => (m.visible = true), 45000); // hồi sinh sau 45s
    }
  }

  /* --- ngọn nến & cổng nhấp nháy --- */
  const t = performance.now() * 0.004;
  candleStands.forEach((s) => {
    if (!s.userData.lit) return;
    s.userData.light.intensity = 2.8 + Math.sin(t * 3 + s.position.x) * 0.5;
  });
  gates.forEach((g) => { g.rotation.z += dt * (g.userData.open ? 0.9 : 0.15); });

  /* --- người chơi khác: nội suy mượt --- */
  for (const [, o] of others) {
    o.group.position.lerp(o.target, 1 - Math.exp(-6 * dt));
    o.group.rotation.y = o.ry;
    o.group.userData.cape.rotation.x = -0.4;
  }

  /* --- camera bám lưng (Sky-style) --- */
  const dist = flying ? 9.5 : 7.5;
  const off = new THREE.Vector3(
    -Math.sin(yaw) * -dist * Math.cos(pitch),
    2.6 + Math.sin(pitch) * dist,
    -Math.cos(yaw) * -dist * Math.cos(pitch)
  );
  camTarget.copy(player.position).add(off);
  camera.position.lerp(camTarget, 1 - Math.exp(-9 * dt));
  camera.lookAt(player.position.x, player.position.y + 1.6, player.position.z);

  sun.position.set(player.position.x + 60, 90, player.position.z + 40);
  sun.target.position.copy(player.position);
  sun.target.updateMatrixWorld();

  /* --- HUD --- */
  document.getElementById("candles").textContent = state.candles;
  document.getElementById("wax").textContent = state.wax;
  document.getElementById("gates").textContent = state.gates;
  document.getElementById("energy").style.width = (state.energy * 100).toFixed(0) + "%";
}

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (started) update(dt);
  renderer.render(scene, camera);
});

/* ---------- 9. Màn hình bắt đầu ---------- */
document.getElementById("startBtn").addEventListener("click", async () => {
  const nm = document.getElementById("nameInput").value.trim();
  state.name = nm || "Traveler";
  document.getElementById("pname").textContent = state.name;
  document.getElementById("start").remove();
  await load();
  started = true;
  renderer.domElement.requestPointerLock?.();
});
