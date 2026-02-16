/**
 * WCA 标准 3x3x3 魔方打乱公式生成器
 */

const FACES = ['U', 'D', 'L', 'R', 'F', 'B'] as const;
const MODIFIERS = ['', "'", '2'] as const;

// 同轴对面不能相邻出现
const OPPOSITE: Record<string, string> = {
  U: 'D',
  D: 'U',
  L: 'R',
  R: 'L',
  F: 'B',
  B: 'F',
};

export function generateScramble(length = 20): string {
  const moves: string[] = [];
  let lastFace = '';
  let secondLastFace = '';

  for (let i = 0; i < length; i++) {
    let face: string;
    do {
      face = FACES[Math.floor(Math.random() * FACES.length)];
    } while (
      face === lastFace ||
      (face === OPPOSITE[lastFace] && secondLastFace === lastFace)
    );

    const modifier = MODIFIERS[Math.floor(Math.random() * MODIFIERS.length)];
    moves.push(face + modifier);

    secondLastFace = lastFace;
    lastFace = face;
  }

  return moves.join(' ');
}
