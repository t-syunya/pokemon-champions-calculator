export const POKEMON_TYPES: Record<string, string> = {
  normal: 'ノーマル',
  fighting: 'かくとう',
  flying: 'ひこう',
  poison: 'どく',
  ground: 'じめん',
  rock: 'いわ',
  bug: 'むし',
  ghost: 'ゴースト',
  steel: 'はがね',
  fire: 'ほのお',
  water: 'みず',
  grass: 'くさ',
  electric: 'でんき',
  psychic: 'エスパー',
  ice: 'こおり',
  dragon: 'ドラゴン',
  dark: 'あく',
  fairy: 'フェアリー',
};

// タイプ名の日本語変換ヘルパー
export function getTranslatedType(typeEn: string | null | undefined): string {
  if (!typeEn) return '';
  return POKEMON_TYPES[typeEn.toLowerCase()] || typeEn;
}
