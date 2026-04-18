export type StatName = 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe';

interface CalcStatArgs {
  baseStat: number;
  iv: number;
  ev: number;
  level: number;
  natureMultiplier: 1.1 | 1.0 | 0.9;
  item?: string;
}

export interface DamageCalcParams {
  level: number;
  basePower: number;
  attackStat: number;
  defenseStat: number;
  modifier?: number; // STAB, タイプ相性, 持ち物などの総合補正
  isCritical?: boolean;
}

/**
 * 乱数リスト（0.85 〜 1.0の間を16分割した乱数テーブル）
 */
export function generateRandomMultipliers(): number[] {
  const multipliers = [];
  for (let i = 85; i <= 100; i++) {
    multipliers.push(i / 100);
  }
  return multipliers;
}

/**
 * ダメージ計算 (乱数16パターンのダメージリストを返す)
 * USUM (第7世代) 準拠の計算式
 */
export function calculateDamageRange({
  level,
  basePower,
  attackStat,
  defenseStat,
  modifier = 1.0,
  isCritical = false,
}: DamageCalcParams): number[] {
  // 基本ダメージ計算: ((2 × Level / 5 + 2) × 威力 × 攻撃 ÷ 防御) / 50 + 2
  const levelFactor = Math.floor((2 * level) / 5) + 2;
  // 倍率などは都度切り捨てとするのが公式ゲーム内の挙動に近い
  const baseDamage =
    Math.floor((levelFactor * basePower * (attackStat / defenseStat)) / 50) + 2;

  let finalBaseDamage = baseDamage;
  if (isCritical) {
    // 7世代以降の急所は1.5倍
    finalBaseDamage = Math.floor(finalBaseDamage * 1.5);
  }

  // 16段階の乱数を適用（各乱数適用後に最終補正を掛ける）
  const rolls = generateRandomMultipliers().map((rand) => {
    let dmg = Math.floor(finalBaseDamage * rand);
    dmg = Math.floor(dmg * modifier);
    return dmg;
  });

  // [最小ダメージ, ..., 最大ダメージ] の配列
  return rolls;
}

/**
 * 実数値計算 (HP または それ以外)
 */
export function calculateStat(
  statName: StatName,
  { baseStat, iv, ev, level, natureMultiplier, item }: CalcStatArgs,
): number {
  if (statName === 'hp') {
    if (baseStat === 1) return 1; // ヌケニン特例
    return (
      Math.floor(((baseStat * 2 + iv + Math.floor(ev / 4)) * level) / 100) +
      level +
      10
    );
  }

  const rawStat =
    Math.floor(((baseStat * 2 + iv + Math.floor(ev / 4)) * level) / 100) + 5;
  const natureStat = Math.floor(rawStat * natureMultiplier);

  // アイテムによるステータス実数値の上書き補正
  let itemMultiplier = 1.0;
  if (item === 'こだわりハチマキ' && statName === 'atk') itemMultiplier = 1.5;
  else if (item === 'こだわりメガネ' && statName === 'spa')
    itemMultiplier = 1.5;
  else if (item === 'とつげきチョッキ' && statName === 'spd')
    itemMultiplier = 1.5;
  else if (
    item === 'しんかのきせき' &&
    (statName === 'def' || statName === 'spd')
  )
    itemMultiplier = 1.5;

  // 四捨五入か切り捨ては実機仕様によるが基本は切り捨て
  return Math.floor(natureStat * itemMultiplier);
}
