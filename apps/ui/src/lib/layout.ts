export interface RectLike {
  top: number;
  right: number;
  bottom: number;
}

export function floatingMenuPosition(
  anchor: RectLike,
  viewportWidth: number,
  viewportHeight: number,
  width = 190,
  desiredHeight = 420,
) {
  const edge = 12;
  const availableBelow = viewportHeight - anchor.bottom - edge;
  const availableAbove = anchor.top - edge;
  const openBelow = availableBelow >= Math.min(360, availableAbove);
  const available = Math.max(0, openBelow ? availableBelow : availableAbove);
  const maxHeight = Math.min(desiredHeight, available);
  return {
    top: openBelow
      ? anchor.bottom + 6
      : Math.max(edge, anchor.top - maxHeight - 6),
    left: Math.min(
      viewportWidth - width - edge,
      Math.max(edge, anchor.right - width),
    ),
    maxHeight,
  };
}
