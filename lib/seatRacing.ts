// Seat racing: two boats race, one rower from each swaps, they race again.
// Margin = boat B's time − boat A's time (positive: A was ahead). If X moved
// A→B and Y moved B→A, the swing (margin before − margin after) is how much
// better X was than Y over the piece, in seconds; negative means Y was better.

export type SeatPiece = {
  piece_no: number;
  boat_a: string[];
  boat_b: string[];
  time_a: number | null;
  time_b: number | null;
};

export type SwapResult = {
  fromPiece: number;
  toPiece: number;
  // The rower who moved A→B, and the one who moved B→A.
  x: string;
  y: string;
  // Seconds X was better than Y.
  swing: number;
};

const margin = (p: SeatPiece) => (p.time_a != null && p.time_b != null ? Number(p.time_b) - Number(p.time_a) : null);

// Each pair of back-to-back timed pieces where exactly one rower swapped
// each way (everyone else stayed put).
export function swapResults(pieces: SeatPiece[]): SwapResult[] {
  const sorted = [...pieces].sort((a, b) => a.piece_no - b.piece_no);
  const out: SwapResult[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const before = sorted[i - 1];
    const after = sorted[i];
    const m1 = margin(before);
    const m2 = margin(after);
    if (m1 == null || m2 == null) continue;
    const leftA = before.boat_a.filter((r) => !after.boat_a.includes(r));
    const joinedA = after.boat_a.filter((r) => !before.boat_a.includes(r));
    if (leftA.length !== 1 || joinedA.length !== 1) continue;
    const [x] = leftA;
    const [y] = joinedA;
    if (!after.boat_b.includes(x) || !before.boat_b.includes(y)) continue;
    const bSame = before.boat_b.filter((r) => r !== y).every((r) => after.boat_b.includes(r));
    if (!bSame) continue;
    out.push({ fromPiece: before.piece_no, toPiece: after.piece_no, x, y, swing: Math.round((m1 - m2) * 10) / 10 });
  }
  return out;
}

// Net seconds per rower across all swaps: +swing for X, −swing for Y.
export function netByRower(results: SwapResult[]): Map<string, { net: number; swaps: number }> {
  const net = new Map<string, { net: number; swaps: number }>();
  const add = (id: string, v: number) => {
    const cur = net.get(id) ?? { net: 0, swaps: 0 };
    net.set(id, { net: Math.round((cur.net + v) * 10) / 10, swaps: cur.swaps + 1 });
  };
  for (const r of results) {
    add(r.x, r.swing);
    add(r.y, -r.swing);
  }
  return net;
}

// The next piece's boats after swapping x (in A) with y (in B).
export function swapBoats(p: Pick<SeatPiece, "boat_a" | "boat_b">, x: string, y: string) {
  return {
    boat_a: p.boat_a.map((r) => (r === x ? y : r)),
    boat_b: p.boat_b.map((r) => (r === y ? x : r)),
  };
}
