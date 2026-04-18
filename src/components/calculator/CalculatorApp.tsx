'use client';

import { calculateDamageRange, calculateStat } from '@/lib/calculator';
import { getTranslatedType, getTypeColor } from '@/lib/constants';
import { createClient } from '@/utils/supabase/client';
import { Activity, Save, Shield, Sword, Swords, Zap } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type PokemonData = {
  id: number;
  pokedex_id: number;
  name_ja: string;
  form_name_ja: string | null;
  type1: string;
  type2: string | null;
  base_hp: number;
  base_atk: number;
  base_def: number;
  base_spa: number;
  base_spd: number;
  base_spe: number;
  abilities: string[];
};

type MoveData = {
  id: number;
  name_ja: string;
  type: string;
  category: string;
  power: number;
};

interface CalculatorProps {
  initialPokemons: PokemonData[];
  initialMoves: MoveData[];
  // biome-ignore lint/suspicious/noExplicitAny: generic user map
  user: any;
}

const toHiragana = (str: string) => {
  return str.replace(/[\u30a1-\u30f6]/g, (match) =>
    String.fromCharCode(match.charCodeAt(0) - 0x60),
  );
};

const getPokemonDisplayName = (p: PokemonData) => {
  if (!p.form_name_ja) return p.name_ja;
  if (p.form_name_ja.startsWith('メガ')) return p.form_name_ja;
  return `${p.name_ja} (${p.form_name_ja})`;
};

const ITEM_OPTIONS = [
  'なし',
  'いのちのたま',
  'こだわりハチマキ',
  'こだわりメガネ',
  'とつげきチョッキ',
  'しんかのきせき',
  'たつじんのおび',
  'タイプ強化アイテム(プレート等)',
];

export default function CalculatorApp({
  initialPokemons,
  initialMoves,
  user,
}: CalculatorProps) {
  const supabase = createClient();
  const [isSaving, setIsSaving] = useState(false);

  // === 攻撃側 (Attacker) State ===
  const [attackerId, setAttackerId] = useState<number>(
    initialPokemons[0]?.id || 25,
  ); // Default Pikachu or first
  const [atkLevel, setAtkLevel] = useState<number>(50);
  const [atkEVs, setAtkEVs] = useState({
    hp: 0,
    atk: 32,
    def: 0,
    spa: 0,
    spd: 0,
    spe: 32,
  });
  const [atkNatureMult, setAtkNatureMult] = useState<{
    atk: number;
    spa: number;
  }>({ atk: 1.1, spa: 0.9 }); // 物理特化のいじっぱりをデフォルト
  const [atkItem, setAtkItem] = useState<string>('なし');
  const [atkAbility, setAtkAbility] = useState<string>('');

  // === 防御側 (Defender) State ===
  const [defenderId, setDefenderId] = useState<number>(
    initialPokemons[0]?.id || 25,
  );
  const [defLevel, setDefLevel] = useState<number>(50);
  const [defEVs, setDefEVs] = useState({
    hp: 32,
    atk: 0,
    def: 32,
    spa: 0,
    spd: 0,
    spe: 0,
  });
  const [defNatureMult, setDefNatureMult] = useState<{
    def: number;
    spd: number;
  }>({ def: 1.1, spd: 0.9 }); // 物理受けずぶといデフォルト
  const [defItem, setDefItem] = useState<string>('なし');
  const [defAbility, setDefAbility] = useState<string>('');

  // === 技 (Move) State ===
  const [selectedMoveId, setSelectedMoveId] = useState<number | null>(null);
  const [basePower, setBasePower] = useState<number>(90);
  const [isSpecial, setIsSpecial] = useState<boolean>(false); // 物理技か特殊技か
  const [modifier, setModifier] = useState<number>(1.5); // タイプ一致などの補正

  // 選択されたポケモンのマスターデータ取得
  const attackerData = useMemo(
    () =>
      initialPokemons.find((p) => p.id === attackerId) || initialPokemons[0],
    [attackerId, initialPokemons],
  );
  const defenderData = useMemo(
    () =>
      initialPokemons.find((p) => p.id === defenderId) || initialPokemons[0],
    [defenderId, initialPokemons],
  );

  // ポケモンが変更されたら、特性1（一番目の特性）をデフォルトで設定する
  useEffect(() => {
    setAtkAbility(attackerData?.abilities?.[0] || '');
  }, [attackerData]);

  useEffect(() => {
    setDefAbility(defenderData?.abilities?.[0] || '');
  }, [defenderData]);

  // 実数値計算
  const attackerActualAtk = useMemo(
    () =>
      calculateStat('atk', {
        baseStat: attackerData.base_atk,
        iv: 31,
        ev: atkEVs.atk,
        level: atkLevel,
        natureMultiplier: atkNatureMult.atk as 1.1 | 1.0 | 0.9,
        item: atkItem,
      }),
    [attackerData, atkEVs, atkLevel, atkNatureMult, atkItem],
  );
  const attackerActualSpa = useMemo(
    () =>
      calculateStat('spa', {
        baseStat: attackerData.base_spa,
        iv: 31,
        ev: atkEVs.spa,
        level: atkLevel,
        natureMultiplier: atkNatureMult.spa as 1.1 | 1.0 | 0.9,
        item: atkItem,
      }),
    [attackerData, atkEVs, atkLevel, atkNatureMult, atkItem],
  );

  const handleSaveBuild = async (role: 'attacker' | 'defender') => {
    if (!user) {
      alert('保存するにはログインが必要です。');
      return;
    }

    setIsSaving(true);
    const pokemonId = role === 'attacker' ? attackerId : defenderId;
    const level = role === 'attacker' ? atkLevel : defLevel;
    const ability = role === 'attacker' ? atkAbility : defAbility;
    const item = role === 'attacker' ? atkItem : defItem;
    // For Nature, pick the highest stat mult conceptually, or just store a custom label.
    // Here we just save "Custom" to satisfy NOT NULL.
    const nature = 'Custom';
    const evs = role === 'attacker' ? atkEVs : defEVs;

    const { error } = await supabase.from('saved_builds').insert({
      user_id: user.id,
      pokemon_id: pokemonId,
      level,
      nature,
      ability: ability || 'なし',
      item: item === 'なし' ? null : item,
      ev_hp: evs.hp,
      ev_atk: evs.atk,
      ev_def: evs.def,
      ev_spa: evs.spa,
      ev_spd: evs.spd,
      ev_spe: evs.spe,
      move1_id: role === 'attacker' ? selectedMoveId : null,
    });

    setIsSaving(false);

    if (error) {
      console.error(error);
      alert(`保存に失敗しました: ${error.message}`);
    } else {
      alert(
        `${role === 'attacker' ? '攻撃側' : '防御側'}の調整を保存しました！`,
      );
    }
  };

  const defenderActualHp = useMemo(
    () =>
      calculateStat('hp', {
        baseStat: defenderData.base_hp,
        iv: 31,
        ev: defEVs.hp,
        level: defLevel,
        natureMultiplier: 1.0,
      }),
    [defenderData, defEVs, defLevel],
  );
  const defenderActualDef = useMemo(
    () =>
      calculateStat('def', {
        baseStat: defenderData.base_def,
        iv: 31,
        ev: defEVs.def,
        level: defLevel,
        natureMultiplier: defNatureMult.def as 1.1 | 1.0 | 0.9,
        item: defItem,
      }),
    [defenderData, defEVs, defLevel, defNatureMult, defItem],
  );
  const defenderActualSpd = useMemo(
    () =>
      calculateStat('spd', {
        baseStat: defenderData.base_spd,
        iv: 31,
        ev: defEVs.spd,
        level: defLevel,
        natureMultiplier: defNatureMult.spd as 1.1 | 1.0 | 0.9,
        item: defItem,
      }),
    [defenderData, defEVs, defLevel, defNatureMult, defItem],
  );

  // ダメージ計算実行
  const damageRolls = useMemo(() => {
    let itemDamageMultiplier = 1.0;
    if (atkItem === 'いのちのたま') itemDamageMultiplier = 1.3;
    if (atkItem === 'たつじんのおび') itemDamageMultiplier = 1.2;
    if (atkItem === 'タイプ強化アイテム(プレート等)')
      itemDamageMultiplier = 1.2;

    const finalModifier = modifier * itemDamageMultiplier;

    return calculateDamageRange({
      level: atkLevel,
      basePower: basePower,
      attackStat: isSpecial ? attackerActualSpa : attackerActualAtk,
      defenseStat: isSpecial ? defenderActualSpd : defenderActualDef,
      modifier: finalModifier,
      isCritical: false,
    });
  }, [
    atkLevel,
    basePower,
    isSpecial,
    attackerActualSpa,
    attackerActualAtk,
    defenderActualSpd,
    defenderActualDef,
    modifier,
    atkItem,
  ]);

  const minDamage = damageRolls[0];
  const maxDamage = damageRolls[damageRolls.length - 1];
  const minPercent = ((minDamage / defenderActualHp) * 100).toFixed(1);
  const maxPercent = ((maxDamage / defenderActualHp) * 100).toFixed(1);

  // 確定数判定
  let ohkoChance = 0;
  if (minDamage >= defenderActualHp) ohkoChance = 100;
  else if (maxDamage >= defenderActualHp) {
    const killRolls = damageRolls.filter((d) => d >= defenderActualHp).length;
    ohkoChance = (killRolls / 16) * 100;
  }

  const SearchableSelect = ({
    value,
    onChange,
    label,
    data,
    options,
    isMove = false,
  }: {
    value: number | null;
    onChange: (val: number) => void;
    label: string;
    // biome-ignore lint/suspicious/noExplicitAny: generic interface
    data: any;
    options: { id: number; label: string; nameJa: string }[];
    isMove?: boolean;
  }) => {
    const [search, setSearch] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    const filteredOptions = useMemo(() => {
      const query = toHiragana(search);
      return options
        .filter((opt) => {
          if (!query) return true;
          return (
            toHiragana(opt.nameJa).startsWith(query) ||
            toHiragana(opt.label).startsWith(query)
          );
        })
        .slice(0, 100); // Limit to top 100 for render perf
    }, [options, search]);

    const selectedOption = options.find((o) => o.id === value);

    return (
      <div className="flex flex-col gap-1.5 mb-4 relative">
        <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
          {label}
          {!isMove && data && (
            <>
              <span
                className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${getTypeColor(data.type1)}`}
              >
                {getTranslatedType(data.type1)}
              </span>
              {data.type2 && (
                <span
                  className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${getTypeColor(data.type2)}`}
                >
                  {getTranslatedType(data.type2)}
                </span>
              )}
            </>
          )}
          {isMove && data && data.type && (
            <span
              className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${getTypeColor(data.type)}`}
            >
              {getTranslatedType(data.type)}
            </span>
          )}
        </label>

        <div className="relative">
          <input
            type="text"
            className="w-full rounded-lg border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 text-sm bg-white"
            placeholder={
              selectedOption ? selectedOption.label : '検索（ひらがな可）'
            }
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          />

          {isOpen && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto top-full left-0">
              {filteredOptions.length === 0 ? (
                <div className="p-3 text-sm text-gray-500 text-center">
                  見つかりません
                </div>
              ) : (
                filteredOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 focus:bg-blue-50 transition-colors border-b border-gray-50 last:border-0"
                    onMouseDown={(e) => {
                      e.preventDefault(); // Prevent input blur
                      onChange(opt.id);
                      setSearch('');
                      setIsOpen(false);
                    }}
                  >
                    {opt.label}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const pokemonOptions = useMemo(
    () =>
      initialPokemons.map((p) => ({
        id: p.id,
        label: getPokemonDisplayName(p),
        nameJa: p.name_ja,
      })),
    [initialPokemons],
  );

  const moveOptions = useMemo(
    () =>
      initialMoves.map((m) => ({
        id: m.id,
        label: m.name_ja,
        nameJa: m.name_ja,
      })),
    [initialMoves],
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* 攻撃側エリア */}
      <div className="lg:col-span-4 space-y-4">
        <div className="bg-white/80 backdrop-blur-xl border border-blue-100 rounded-2xl shadow-lg p-5 transition-all hover:shadow-xl duration-300 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full opacity-50 -z-10 group-hover:scale-110 transition-transform" />

          {/* パネルヘッダー */}
          <div className="flex items-center justify-between mb-4 border-b pb-3">
            <h2 className="text-xl font-bold flex items-center gap-2 text-gray-800">
              <Sword className="w-5 h-5 text-blue-600" />
              攻撃側
            </h2>
            {user && (
              <button
                type="button"
                onClick={() => handleSaveBuild('attacker')}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-md transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                保存
              </button>
            )}
          </div>

          <SearchableSelect
            value={attackerId}
            onChange={setAttackerId}
            label="ポケモンを選択"
            data={attackerData}
            options={pokemonOptions}
          />

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-xs font-semibold text-gray-600">
                レベル
              </label>
              <div className="w-full mt-1 p-1.5 text-sm border rounded bg-gray-100 text-gray-500 cursor-not-allowed font-medium">
                Lv.{atkLevel} (固定)
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">
                努力値 (A/C)
              </label>
              <input
                type="number"
                min="0"
                max="32"
                step="1"
                value={isSpecial ? atkEVs.spa : atkEVs.atk}
                onChange={(e) =>
                  setAtkEVs(
                    isSpecial
                      ? {
                          ...atkEVs,
                          spa: Math.min(
                            32,
                            Math.max(0, Number(e.target.value)),
                          ),
                        }
                      : {
                          ...atkEVs,
                          atk: Math.min(
                            32,
                            Math.max(0, Number(e.target.value)),
                          ),
                        },
                  )
                }
                className="w-full mt-1 p-1.5 text-sm border rounded bg-gray-50 focus:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-xs font-semibold text-gray-600">
                持ち物
              </label>
              <select
                value={atkItem}
                onChange={(e) => setAtkItem(e.target.value)}
                className="w-full mt-1 p-1.5 text-sm border rounded bg-gray-50 focus:bg-white text-gray-700"
              >
                {ITEM_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">
                特性
              </label>
              <select
                value={atkAbility}
                onChange={(e) => setAtkAbility(e.target.value)}
                className="w-full mt-1 p-1.5 text-sm border rounded bg-gray-50 focus:bg-white text-gray-700"
              >
                {attackerData?.abilities?.map((ab: string) => (
                  <option key={ab} value={ab}>
                    {ab}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100/50">
            <div className="flex justify-between items-center text-sm">
              <span className="font-medium text-gray-700">
                最終実数値 ({isSpecial ? '特攻' : '攻撃'}):
              </span>
              <span className="text-lg font-bold text-blue-700">
                {isSpecial ? attackerActualSpa : attackerActualAtk}
              </span>
            </div>
          </div>
        </div>

        {/* 技エリア */}
        <div className="bg-white/80 backdrop-blur-xl border border-gray-200 rounded-2xl shadow-md p-5 relative z-40">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-yellow-500" />
            <h2 className="text-lg font-bold text-gray-800">使用する技</h2>
          </div>

          <SearchableSelect
            value={selectedMoveId}
            onChange={(mId) => {
              setSelectedMoveId(mId);
              const moveData = initialMoves.find((m) => m.id === mId);
              if (moveData) {
                setBasePower(moveData.power || 0);
                setIsSpecial(moveData.category === 'special');
              }
            }}
            label="技を検索して選択"
            data={initialMoves.find((m) => m.id === selectedMoveId)}
            options={moveOptions}
            isMove={true}
          />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-600">
                威力
              </label>
              <input
                type="number"
                value={basePower}
                onChange={(e) => setBasePower(Number(e.target.value))}
                className="w-full mt-1 p-2 text-sm border rounded bg-gray-50 focus:bg-white"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">
                技の種類
              </label>
              <select
                value={isSpecial ? '1' : '0'}
                onChange={(e) => setIsSpecial(e.target.value === '1')}
                className="w-full mt-1 p-2 text-sm border rounded bg-gray-50 focus:bg-white"
              >
                <option value="0">物理</option>
                <option value="1">特殊</option>
              </select>
            </div>
          </div>
          <div className="mt-3">
            <label className="text-xs font-semibold text-gray-600">
              総合補正倍率 (タイプ一致/持ち物など)
            </label>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="range"
                min="0.25"
                max="3"
                step="0.25"
                value={modifier}
                onChange={(e) => setModifier(Number(e.target.value))}
                className="w-full accent-blue-600"
              />
              <span className="text-sm font-bold w-12 text-right">
                x{modifier}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 防御側エリア */}
      <div className="lg:col-span-4 space-y-4">
        <div className="bg-white/80 backdrop-blur-xl border border-indigo-100 rounded-2xl shadow-lg p-5 transition-all hover:shadow-xl duration-300 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full opacity-50 -z-10 group-hover:scale-110 transition-transform" />

          {/* パネルヘッダー */}
          <div className="flex items-center justify-between mb-4 border-b pb-3 text-indigo-800">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Shield className="w-5 h-5" />
              防御側
            </h2>
            {user && (
              <button
                type="button"
                onClick={() => handleSaveBuild('defender')}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-100 hover:bg-indigo-200 rounded-md transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                保存
              </button>
            )}
          </div>

          <SearchableSelect
            value={defenderId}
            onChange={setDefenderId}
            label="ポケモンを選択"
            data={defenderData}
            options={pokemonOptions}
          />

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-xs font-semibold text-gray-600">
                努力値 (HP)
              </label>
              <input
                type="number"
                min="0"
                max="32"
                step="1"
                value={defEVs.hp}
                onChange={(e) =>
                  setDefEVs({
                    ...defEVs,
                    hp: Math.min(32, Math.max(0, Number(e.target.value))),
                  })
                }
                className="w-full mt-1 p-1.5 text-sm border rounded bg-gray-50 focus:bg-white"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">
                努力値 ({isSpecial ? '特防' : '防御'})
              </label>
              <input
                type="number"
                min="0"
                max="32"
                step="1"
                value={isSpecial ? defEVs.spd : defEVs.def}
                onChange={(e) =>
                  setDefEVs(
                    isSpecial
                      ? {
                          ...defEVs,
                          spd: Math.min(
                            32,
                            Math.max(0, Number(e.target.value)),
                          ),
                        }
                      : {
                          ...defEVs,
                          def: Math.min(
                            32,
                            Math.max(0, Number(e.target.value)),
                          ),
                        },
                  )
                }
                className="w-full mt-1 p-1.5 text-sm border rounded bg-gray-50 focus:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-xs font-semibold text-gray-600">
                持ち物
              </label>
              <select
                value={defItem}
                onChange={(e) => setDefItem(e.target.value)}
                className="w-full mt-1 p-1.5 text-sm border rounded bg-gray-50 focus:bg-white text-gray-700"
              >
                {ITEM_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">
                特性
              </label>
              <select
                value={defAbility}
                onChange={(e) => setDefAbility(e.target.value)}
                className="w-full mt-1 p-1.5 text-sm border rounded bg-gray-50 focus:bg-white text-gray-700"
              >
                {defenderData?.abilities?.map((ab: string) => (
                  <option key={ab} value={ab}>
                    {ab}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100/50 space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="font-medium text-gray-700">実数値 (HP):</span>
              <span className="text-lg font-bold text-indigo-700">
                {defenderActualHp}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm border-t border-indigo-100/60 pt-2">
              <span className="font-medium text-gray-700">
                実数値 ({isSpecial ? '特防' : '防御'}):
              </span>
              <span className="text-lg font-bold text-indigo-700">
                {isSpecial ? defenderActualSpd : defenderActualDef}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ダメージ計算結果エリア */}
      <div className="lg:col-span-4">
        <div className="bg-gradient-to-b from-gray-900 to-gray-800 rounded-3xl shadow-2xl p-6 text-white sticky top-8">
          <div className="flex items-center gap-2 mb-6">
            <Activity className="w-6 h-6 text-emerald-400" />
            <h2 className="text-2xl font-black tracking-tight">Result</h2>
          </div>

          {/* 乱数幅のテキスト */}
          <div className="mb-8">
            <p className="text-gray-400 text-sm font-medium mb-1">
              ダメージ幅 (Damage Roll)
            </p>
            <div className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-yellow-400">
              {minDamage}{' '}
              <span className="text-gray-500 text-xl font-normal mx-1">~</span>{' '}
              {maxDamage}
            </div>
            <div className="text-sm font-bold mt-1 text-emerald-400">
              {minPercent}% <span className="text-gray-500 mx-1">~</span>{' '}
              {maxPercent}%
            </div>
          </div>

          {/* HP バーのビジュアライズ */}
          <div className="mb-8">
            <div className="flex justify-between text-xs font-semibold mb-2 text-gray-300">
              <span>HP ゲージ削り幅</span>
              <span>100%</span>
            </div>
            <div className="h-4 w-full bg-gray-700 rounded-full overflow-hidden relative border border-gray-600 shadow-inner">
              <div
                className="absolute top-0 right-0 h-full bg-emerald-500 transition-all duration-500 ease-out"
                style={{ width: `${Math.max(0, 100 - Number(maxPercent))}%` }}
              />
              <div
                className="absolute top-0 right-0 h-full bg-yellow-400 opacity-60 transition-all duration-500 ease-out animate-pulse"
                style={{ width: `${Math.max(0, 100 - Number(minPercent))}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2 text-right">
              ※緑が確実な残りHP、黄色が乱数次第の削り幅
            </p>
          </div>

          {/* 確定数 */}
          <div className="bg-gray-800/80 rounded-2xl p-4 border border-gray-700/50 backdrop-blur">
            <p className="text-gray-400 text-xs font-semibold mb-2 uppercase tracking-widest">
              OHKO Chance
            </p>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-black text-white">
                {ohkoChance.toFixed(0)}
              </span>
              <span className="text-lg font-bold text-gray-400 mb-1">%</span>
            </div>
            {ohkoChance === 100 && (
              <span className="inline-block mt-2 px-2 py-1 bg-red-500/20 text-red-400 text-xs font-bold rounded-md">
                確定1発 (Guaranteed OHKO)
              </span>
            )}
            {ohkoChance > 0 && ohkoChance < 100 && (
              <span className="inline-block mt-2 px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs font-bold rounded-md">
                乱数1発 (Roll depending)
              </span>
            )}
            {ohkoChance === 0 && (
              <span className="inline-block mt-2 px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-md">
                確定耐え (Guaranteed Survival)
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
