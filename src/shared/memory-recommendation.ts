const STEP_MB = 512;
const MIN_MEMORY_MB = 1024;
const SYSTEM_RESERVE_MB = 3072;
const TIERS: Array<{ maxContent: number; memoryMb: number }> = [
  { maxContent: 0, memoryMb: 3072 },
  { maxContent: 25, memoryMb: 4096 },
  { maxContent: 75, memoryMb: 6144 },
  { maxContent: 150, memoryMb: 8192 }
];
const LARGEST_PACK_MEMORY_MB = 10240;

export function recommendMemoryMb(contentCount: number, totalMemoryMb: number): number {
  const wanted = TIERS.find((tier) => contentCount <= tier.maxContent)?.memoryMb ?? LARGEST_PACK_MEMORY_MB;
  const available = Math.floor((totalMemoryMb - SYSTEM_RESERVE_MB) / STEP_MB) * STEP_MB;
  return Math.max(MIN_MEMORY_MB, Math.min(wanted, available));
}
