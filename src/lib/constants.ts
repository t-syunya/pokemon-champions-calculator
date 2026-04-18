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

export const TYPE_COLORS: Record<string, string> = {
  normal: 'bg-[#A8A77A] text-white',
  fighting: 'bg-[#C22E28] text-white',
  flying: 'bg-[#A98FF3] text-white',
  poison: 'bg-[#A33EA1] text-white',
  ground: 'bg-[#E2BF65] text-white',
  rock: 'bg-[#B6A136] text-white',
  bug: 'bg-[#A6B91A] text-white',
  ghost: 'bg-[#735797] text-white',
  steel: 'bg-[#B7B7CE] text-white',
  fire: 'bg-[#EE8130] text-white',
  water: 'bg-[#6390F0] text-white',
  grass: 'bg-[#7AC74C] text-white',
  electric: 'bg-[#F7D02C] text-neutral-800',
  psychic: 'bg-[#F95587] text-white',
  ice: 'bg-[#96D9D6] text-neutral-800',
  dragon: 'bg-[#6F35FC] text-white',
  dark: 'bg-[#705746] text-white',
  fairy: 'bg-[#D685AD] text-white',
};

// タイプ名のTailwind色クラス変換ヘルパー
export function getTypeColor(typeEn: string | null | undefined): string {
  if (!typeEn) return 'bg-gray-200 text-gray-700';
  return TYPE_COLORS[typeEn.toLowerCase()] || 'bg-gray-200 text-gray-700';
}
