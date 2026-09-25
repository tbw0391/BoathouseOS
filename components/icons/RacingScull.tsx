import { createLucideIcon } from "lucide-react";

// Crossed oars over a hull silhouette — a rowing shell (racing scull),
// not a lucide built-in, so hand-drawn to match the lucide icon style.
const RacingScull = createLucideIcon("RacingScull", [
  ["path", { d: "M5 3 19 13", key: "oar-1" }],
  ["path", { d: "M19 3 5 13", key: "oar-2" }],
  ["path", { d: "M3.5 1.5 6.5 4.5", key: "blade-1" }],
  ["path", { d: "M17.5 4.5 20.5 1.5", key: "blade-2" }],
  [
    "path",
    {
      d: "M2 18c3-1.5 6-2 10-2s7 .5 10 2c-3 1.5-6 2-10 2s-7-.5-10-2z",
      key: "hull",
    },
  ],
]);

export default RacingScull;
