import { describe, expect, it } from "vitest";
import { netByRower, swapBoats, swapResults, type SeatPiece } from "@/lib/seatRacing";

const p1: SeatPiece = { piece_no: 1, boat_a: ["x", "a2"], boat_b: ["y", "b2"], time_a: 400, time_b: 403 };
const p2: SeatPiece = { piece_no: 2, ...swapBoats(p1, "x", "y"), time_a: 401, time_b: 402 };

describe("swapResults", () => {
  it("credits the swing to the rower who moved A to B", () => {
    // A won by 3 with X, by 1 with Y: X was 2 s better.
    expect(swapResults([p1, p2])).toEqual([{ fromPiece: 1, toPiece: 2, x: "x", y: "y", swing: 2 }]);
  });

  it("ignores pieces with no time, or more than one swap", () => {
    expect(swapResults([p1, { ...p2, time_b: null }])).toEqual([]);
    const two: SeatPiece = { piece_no: 2, boat_a: ["y", "b2"], boat_b: ["x", "a2"], time_a: 400, time_b: 400 };
    expect(swapResults([p1, two])).toEqual([]);
  });

  it("chains swaps across a session", () => {
    const p3: SeatPiece = { piece_no: 3, ...swapBoats(p2, "a2", "b2"), time_a: 405, time_b: 402 };
    const results = swapResults([p1, p2, p3]);
    expect(results).toHaveLength(2);
    expect(results[1]).toMatchObject({ x: "a2", y: "b2", swing: 4 });
    const net = netByRower(results);
    expect(net.get("x")).toEqual({ net: 2, swaps: 1 });
    expect(net.get("y")).toEqual({ net: -2, swaps: 1 });
    expect(net.get("b2")).toEqual({ net: -4, swaps: 1 });
  });
});
