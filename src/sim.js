// Pure game logic (no three.js), so it can be checked in Node: `node check.mjs`.

// Small seeded RNG (mulberry32): same seed, same map.
export function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Square grid over the world [-half, half] on X and Z.
class Grid {
  constructor(half, cell) {
    this.half = half;
    this.cell = cell;
    this.n = Math.ceil((half * 2) / cell);
  }

  index(x, z) {
    const n = this.n;
    const cx = Math.min(n - 1, Math.max(0, Math.floor((x + this.half) / this.cell)));
    const cz = Math.min(n - 1, Math.max(0, Math.floor((z + this.half) / this.cell)));
    return cz * n + cx;
  }
}

// One BFS from the player feeds every enemy: each cell stores the direction to walk.
export class FlowField extends Grid {
  constructor(half, cell) {
    super(half, cell);
    const N = this.n * this.n;
    this.blocked = new Uint8Array(N);
    this.dist = new Int32Array(N);
    this.dirX = new Float32Array(N);
    this.dirZ = new Float32Array(N);
    this.queue = new Int32Array(N);
  }

  // Block every cell whose center lies within r of (x, z).
  blockCircle(x, z, r) {
    const { n, cell, half } = this;
    for (let cz = 0; cz < n; cz++) {
      const pz = -half + (cz + 0.5) * cell;
      if (Math.abs(pz - z) > r) continue;
      for (let cx = 0; cx < n; cx++) {
        const px = -half + (cx + 0.5) * cell;
        if ((px - x) ** 2 + (pz - z) ** 2 <= r * r) this.blocked[cz * n + cx] = 1;
      }
    }
  }

  update(px, pz) {
    const { n, dist, queue, blocked, dirX, dirZ } = this;
    dist.fill(-1);
    const start = this.index(px, pz);
    dist[start] = 0;
    queue[0] = start;
    let head = 0;
    let tail = 1;
    while (head < tail) {
      const c = queue[head++];
      const cx = c % n;
      const d = dist[c] + 1;
      if (cx > 0 && dist[c - 1] < 0 && !blocked[c - 1]) { dist[c - 1] = d; queue[tail++] = c - 1; }
      if (cx < n - 1 && dist[c + 1] < 0 && !blocked[c + 1]) { dist[c + 1] = d; queue[tail++] = c + 1; }
      if (c >= n && dist[c - n] < 0 && !blocked[c - n]) { dist[c - n] = d; queue[tail++] = c - n; }
      if (c < n * (n - 1) && dist[c + n] < 0 && !blocked[c + n]) { dist[c + n] = d; queue[tail++] = c + n; }
    }
    // Each reached cell points at its lowest neighbour (8 directions, no corner cutting).
    for (let c = 0; c < n * n; c++) {
      dirX[c] = 0;
      dirZ[c] = 0;
      if (dist[c] <= 0) continue;
      const cx = c % n;
      const cz = (c / n) | 0;
      let best = dist[c];
      let bx = 0;
      let bz = 0;
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = cx + dx;
          const nz = cz + dz;
          if ((!dx && !dz) || nx < 0 || nz < 0 || nx >= n || nz >= n) continue;
          const d = dist[nz * n + nx];
          if (d < 0 || d >= best) continue;
          if (dx && dz && (dist[cz * n + nx] < 0 || dist[nz * n + cx] < 0)) continue;
          best = d;
          bx = dx;
          bz = dz;
        }
      }
      const len = Math.hypot(bx, bz) || 1;
      dirX[c] = bx / len;
      dirZ[c] = bz / len;
    }
  }
}

// Rebuilt every frame with a counting sort: no allocations, O(items + cells).
export class SpatialHash extends Grid {
  constructor(half, cell, maxItems) {
    super(half, cell);
    const N = this.n * this.n;
    this.start = new Int32Array(N + 1);
    this.cursor = new Int32Array(N);
    this.items = new Int32Array(maxItems);
    this.cellOf = new Int32Array(maxItems);
  }

  build(xs, zs, count) {
    const { start, cursor, items, cellOf } = this;
    start.fill(0);
    for (let i = 0; i < count; i++) {
      const c = this.index(xs[i], zs[i]);
      cellOf[i] = c;
      start[c + 1]++;
    }
    for (let c = 0; c < cursor.length; c++) start[c + 1] += start[c];
    cursor.set(start.subarray(0, cursor.length));
    for (let i = 0; i < count; i++) items[cursor[cellOf[i]]++] = i;
  }

  // Writes candidate indices near (x, z) into `out`; the caller checks real distance.
  query(x, z, r, out) {
    const { n, cell, half, start, items } = this;
    const x0 = Math.max(0, Math.floor((x - r + half) / cell));
    const x1 = Math.min(n - 1, Math.floor((x + r + half) / cell));
    const z0 = Math.max(0, Math.floor((z - r + half) / cell));
    const z1 = Math.min(n - 1, Math.floor((z + r + half) / cell));
    let m = 0;
    for (let cz = z0; cz <= z1; cz++) {
      for (let cx = x0; cx <= x1; cx++) {
        const c = cz * n + cx;
        for (let k = start[c]; k < start[c + 1] && m < out.length; k++) out[m++] = items[k];
      }
    }
    return m;
  }
}
