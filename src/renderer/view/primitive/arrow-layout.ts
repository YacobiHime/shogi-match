export type ArrowSegment = {
  start: { x: number; y: number };
  end: { x: number; y: number };
};

const DIRECTION_TOLERANCE = 0.995;
const LINE_TOLERANCE = 1;

function segmentVector(segment: ArrowSegment) {
  const dx = segment.end.x - segment.start.x;
  const dy = segment.end.y - segment.start.y;
  const distance = Math.hypot(dx, dy);
  return {
    distance,
    unitX: distance > 0 ? dx / distance : 0,
    unitY: distance > 0 ? dy / distance : 0,
  };
}

function sharesOverlappingLine(first: ArrowSegment, second: ArrowSegment) {
  const a = segmentVector(first);
  const b = segmentVector(second);
  if (a.distance === 0 || b.distance === 0) return false;
  if (a.unitX * b.unitX + a.unitY * b.unitY < DIRECTION_TOLERANCE) return false;

  const offsetX = second.start.x - first.start.x;
  const offsetY = second.start.y - first.start.y;
  const lineDistance = Math.abs(offsetX * -a.unitY + offsetY * a.unitX);
  if (lineDistance > LINE_TOLERANCE) return false;

  const firstStart = first.start.x * a.unitX + first.start.y * a.unitY;
  const firstEnd = first.end.x * a.unitX + first.end.y * a.unitY;
  const secondStart = second.start.x * a.unitX + second.start.y * a.unitY;
  const secondEnd = second.end.x * a.unitX + second.end.y * a.unitY;
  return Math.min(firstEnd, secondEnd) >= Math.max(firstStart, secondStart);
}

/** 最善手を中央に残し、同一直線上で重なる後続矢印へ交互に平行レーンを割り当てる。 */
export function parallelArrowLaneOffsets(segments: ArrowSegment[], laneGap: number) {
  const parent = segments.map((_, index) => index);
  const find = (index: number): number => {
    if (parent[index] !== index) parent[index] = find(parent[index]);
    return parent[index];
  };
  const unite = (left: number, right: number) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parent[rightRoot] = leftRoot;
  };

  for (let left = 0; left < segments.length; left += 1) {
    for (let right = left + 1; right < segments.length; right += 1) {
      if (sharesOverlappingLine(segments[left], segments[right])) unite(left, right);
    }
  }

  const groupPositions = new Map<number, number>();
  return segments.map((_, index) => {
    const root = find(index);
    const position = groupPositions.get(root) ?? 0;
    groupPositions.set(root, position + 1);
    if (position === 0) return 0;
    const lane = Math.ceil(position / 2) * (position % 2 === 1 ? -1 : 1);
    return lane * laneGap;
  });
}
