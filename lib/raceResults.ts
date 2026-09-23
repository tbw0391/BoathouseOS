export function placeEmoji(place: number): string {
  if (place === 1) return "🥇";
  if (place === 2) return "🥈";
  if (place === 3) return "🥉";
  return "🏁";
}

export function ordinalPlace(place: number): string {
  const suffixes = ["th", "st", "nd", "rd"];
  const v = place % 100;
  return `${place}${suffixes[(v - 20) % 10] ?? suffixes[v] ?? suffixes[0]}`;
}
