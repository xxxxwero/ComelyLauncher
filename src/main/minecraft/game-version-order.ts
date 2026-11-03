function numericParts(version: string): number[] {
  return version.split(/[.-]/).map((part) => Number.parseInt(part, 10)).map((part) => (Number.isFinite(part) ? part : 0));
}

export function compareNumericVersions(a: string, b: string): number {
  const left = numericParts(a);
  const right = numericParts(b);
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

export function isReleaseVersionId(version: string): boolean {
  return /^\d+(\.\d+)+$/.test(version);
}

export function isAtLeast(version: string, minimum: string): boolean {
  return isReleaseVersionId(version) && compareNumericVersions(version, minimum) >= 0;
}
