/** Fit the entire bounding sphere at every orbit angle, including tall accessories. */
export function garageCameraDistance(radius: number, verticalFov: number, aspect: number): number {
  const vertical = (verticalFov * Math.PI) / 360;
  const horizontal = Math.atan(Math.tan(vertical) * Math.max(0.1, aspect));
  return (Math.max(0.1, radius) / Math.sin(Math.min(vertical, horizontal))) * 1.18;
}
