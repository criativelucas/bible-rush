// Touch and gamepads, feeding the same actions as the keyboard.
// Touch: a joystick wherever the left thumb lands, drag on the right to turn the camera, buttons for
// jump, slide, E, Q and pause. Gamepad: left stick moves, right stick turns, A jump, B slide, X/LB special,
// Y/RB miracle, Start pause; on menus the d-pad and A/B act as the arrows, Enter and Esc.
// main.js reads `move` and `held` every frame and passes its handlers to initTouch / pollGamepad.
export const move = { x: 0, z: 0 }; // strafe right, forward: -1..1
export const held = new Set(); // 'jump', 'slide' while a button is down
export let touchMode = false;

const clamp1 = (v) => Math.max(-1, Math.min(1, v));

export function initTouch(root, h) {
  const stick = root.querySelector('#stick');
  const knob = stick.querySelector('i');
  let stickId = null;
  let ox = 0;
  let oy = 0;
  let lookId = null;
  let lx = 0;
  let ly = 0;
  const R = 56; // px of thumb travel for a full push
  addEventListener('touchstart', () => { touchMode = true; document.body.classList.add('touch'); }, { passive: true });
  root.querySelector('#touch-zone').addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    e.preventDefault();
    if (e.clientX < innerWidth * 0.45 && stickId === null) {
      stickId = e.pointerId;
      ox = e.clientX;
      oy = e.clientY;
      stick.style.left = `${ox}px`;
      stick.style.top = `${oy}px`;
      stick.classList.add('on');
    } else if (lookId === null) {
      lookId = e.pointerId;
      lx = e.clientX;
      ly = e.clientY;
    }
  });
  addEventListener('pointermove', (e) => {
    if (e.pointerId === stickId) {
      const dx = e.clientX - ox;
      const dy = e.clientY - oy;
      const d = Math.hypot(dx, dy);
      const k = d > R ? R / d : 1;
      knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
      move.x = clamp1(dx / R);
      move.z = clamp1(-dy / R);
    } else if (e.pointerId === lookId) {
      h.turn((e.clientX - lx) * 1.6, (e.clientY - ly) * 1.6);
      lx = e.clientX;
      ly = e.clientY;
    }
  });
  const end = (e) => {
    if (e.pointerId === stickId) {
      stickId = null;
      move.x = move.z = 0;
      knob.style.transform = '';
      stick.classList.remove('on');
    }
    if (e.pointerId === lookId) lookId = null;
  };
  addEventListener('pointerup', end);
  addEventListener('pointercancel', end);
  for (const b of root.querySelectorAll('[data-t]')) {
    const t = b.dataset.t;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (t === 'jump' || t === 'slide') held.add(t);
      if (t === 'jump') h.jump();
      else if (t === 'special') h.special();
      else if (t === 'miracle') h.miracle();
      else if (t === 'pause') h.pause();
    });
    const up = () => held.delete(t);
    b.addEventListener('pointerup', up);
    b.addEventListener('pointerleave', up);
    b.addEventListener('pointercancel', up);
  }
}

// ---------- Gamepad ----------
const prev = [];
let padMoving = false;
let navT = 0;
export function pollGamepad(dt, state, h) {
  const gp = [...(navigator.getGamepads?.() || [])].find((g) => g && g.connected);
  if (!gp) return;
  const b = gp.buttons.map((x) => x.pressed);
  const down = (i) => b[i] && !prev[i];
  const dz = (v) => (Math.abs(v) < 0.2 ? 0 : v);
  const [lx, ly, rx, ry] = [0, 1, 2, 3].map((i) => dz(gp.axes[i] || 0));
  if (state === 'play') {
    if (lx || ly) { move.x = lx; move.z = -ly; padMoving = true; } else if (padMoving) { move.x = move.z = 0; padMoving = false; }
    if (rx || ry) h.turn(rx * 1000 * dt, ry * 700 * dt);
    for (const [i, t] of [[0, 'jump'], [1, 'slide']]) { if (b[i]) held.add(t); else if (prev[i]) held.delete(t); }
    if (down(0)) h.jump();
    if (down(2) || down(4)) h.special();
    if (down(3) || down(5)) h.miracle();
    if (down(9)) h.pause();
  } else {
    if (padMoving) { move.x = move.z = 0; padMoving = false; held.clear(); }
    navT -= dt;
    const hor = b[14] ? -1 : b[15] ? 1 : Math.abs(lx) > 0.5 ? Math.sign(lx) : 0;
    const ver = b[12] ? -1 : b[13] ? 1 : Math.abs(ly) > 0.5 ? Math.sign(ly) : 0;
    if ((hor || ver) && navT <= 0) { navT = 0.22; h.nav(hor, ver); }
    if (!hor && !ver) navT = 0;
    if (down(0)) h.confirm();
    if (down(1)) h.back();
    if (down(9)) h.start();
    if (down(2)) h.key('KeyF'); // renew the cards
    if (down(3)) h.key('KeyX'); // skip them
  }
  b.forEach((v, i) => { prev[i] = v; });
}
