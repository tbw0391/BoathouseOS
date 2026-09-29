import { createLucideIcon } from "lucide-react";

// The race starter's flag: red with a white X corner to corner. The flag
// keeps its own colors; only the pole follows the text color.
const StarterFlag = createLucideIcon("StarterFlag", [
  ["path", { d: "M4 22V2", key: "pole" }],
  ["rect", { x: "5", y: "3", width: "16", height: "11", fill: "#dc2626", stroke: "none", key: "field" }],
  ["path", { d: "M5 3 21 14M21 3 5 14", stroke: "#fff", strokeWidth: "1.75", strokeLinecap: "butt", key: "x" }],
]);

export default StarterFlag;
