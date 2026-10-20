export interface StarAssignment {
  targetForSource: Int32Array;
  nearby: Uint8Array;
}

// Match in screen space: a close star can take a new role without crossing the
// viewport. NaN coordinates denote points outside the visible camera volume.
export function matchNearbyStars(from: Float32Array, to: Float32Array, maxDistance: number): StarAssignment {
  const count = from.length / 2;
  const targetForSource = new Int32Array(count).fill(-1);
  const nearby = new Uint8Array(count);
  const taken = new Uint8Array(count);
  const cells = new Map<string, Set<number>>();
  const exactPoints = new Map<string, number[]>();
  const cellForSource: string[] = [];
  const cellSize = maxDistance;
  for (let source = 0; source < count; source++) {
    const x = from[source * 2]; const y = from[source * 2 + 1];
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const key = `${Math.floor(x / cellSize)},${Math.floor(y / cellSize)}`;
    cellForSource[source] = key;
    const cell = cells.get(key);
    if (cell) cell.add(source); else cells.set(key, new Set([source]));
    const exactKey = `${x},${y}`;
    const duplicates = exactPoints.get(exactKey);
    if (duplicates) duplicates.push(source); else exactPoints.set(exactKey, [source]);
  }

  function nearest(target: number, limit: number, lowerBound = 0) {
    const x = to[target * 2]; const y = to[target * 2 + 1];
    let source = -1; let distance = limit * limit;
    for (let cy = Math.floor((y - limit) / cellSize); cy <= Math.floor((y + limit) / cellSize); cy++) {
      for (let cx = Math.floor((x - limit) / cellSize); cx <= Math.floor((x + limit) / cellSize); cx++) {
        for (const candidate of cells.get(`${cx},${cy}`) ?? []) {
          const dx = x - from[candidate * 2]; const dy = y - from[candidate * 2 + 1];
          const squared = dx * dx + dy * dy;
          if (squared <= distance) { source = candidate; distance = squared; }
          if (squared <= lowerBound) return { source, distance };
        }
      }
    }
    return { source, distance };
  }

  function assign(source: number, target: number) {
    targetForSource[source] = target; nearby[source] = 1; taken[target] = 1;
    cells.get(cellForSource[source])!.delete(source);
  }

  const candidates: { target: number; source: number; distance: number }[] = [];
  // Keep shared background points in place before matching the changing shape.
  for (let target = 0; target < count; target++) {
    if (!Number.isFinite(to[target * 2]) || !Number.isFinite(to[target * 2 + 1])) continue;
    const exact = exactPoints.get(`${to[target * 2]},${to[target * 2 + 1]}`)?.pop();
    if (exact !== undefined) assign(exact, target);
    else candidates.push({ target, source: -1, distance: 0 });
  }
  const priority = new Map<string, { source: number; distance: number }>();
  for (const candidate of candidates) {
    const key = `${to[candidate.target * 2]},${to[candidate.target * 2 + 1]}`;
    let match = priority.get(key);
    if (!match) { match = nearest(candidate.target, maxDistance); priority.set(key, match); }
    candidate.source = match.source; candidate.distance = match.distance;
  }
  candidates.sort((a, b) => a.distance - b.distance || a.target - b.target);
  for (const { target, source, distance } of candidates) {
    const match = source !== -1 && targetForSource[source] === -1 ? { source } : nearest(target, maxDistance, distance);
    if (match.source !== -1) assign(match.source, target);
  }

  // Unmatched points fade at their old/new locations; they never fly across the
  // screen. Pair every slot once so the steady-state field keeps its density.
  for (let source = 0; source < count; source++) {
    if (targetForSource[source] === -1 && !taken[source]) {
      targetForSource[source] = source; taken[source] = 1;
    }
  }
  let next = 0;
  for (let source = 0; source < count; source++) {
    if (targetForSource[source] !== -1) continue;
    while (taken[next]) next++;
    targetForSource[source] = next; taken[next] = 1;
  }
  return { targetForSource, nearby };
}
