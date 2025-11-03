// Direction helpers
export type ArrowDirection = 'up' | 'down' | 'left' | 'right';

export const OPP: Record<ArrowDirection, ArrowDirection> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

export const rotateDir = (d: ArrowDirection, rot: 0 | 90 | 180 | 270): ArrowDirection => {
  const order: ArrowDirection[] = ['up', 'right', 'down', 'left']; // 90° CW
  const i = order.indexOf(d);
  return order[(i + rot / 90) % 4];
};

export const rotateDirections = (dirs: ArrowDirection[], rot: 0 | 90 | 180 | 270) =>
  dirs.map((d) => rotateDir(d, rot));
