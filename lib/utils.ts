export { cn } from "cn"

const SQUARE_FEET_PER_ACRE = 43_560;

export function formatLandArea(squareFeet: number): string {
  const formattedArea = (value: number) =>
    value.toLocaleString("en-IN", { maximumFractionDigits: 3 });

  if (squareFeet >= SQUARE_FEET_PER_ACRE) {
    return `${formattedArea(squareFeet / SQUARE_FEET_PER_ACRE)} acres`;
  }

  return `${formattedArea(squareFeet)} sqft`;
}
