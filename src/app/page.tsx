import { getTranslatedType } from '@/lib/constants';
import { createClient } from '@/utils/supabase/server';

export default async function Home() {
  const supabase = await createClient();

  // Supabaseからマスターデータのポケモンを先頭から20件取得
  const { data: pokemons, error } = await supabase
    .from('master_pokemon')
    .select(
      'pokedex_id, name_ja, form_name_ja, type1, type2, base_hp, base_atk, base_def, base_spa, base_spd, base_spe',
    )
    .limit(20);

  return (
    <main className="min-h-screen p-8 bg-gray-50 text-gray-900">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 mb-8">
          ポケモン ダメージ計算機 (Pokemon Champions Calculator)
        </h1>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">
            マスターデータ連携テスト (上位20件)
          </h2>

          {error && (
            <div className="p-4 bg-red-50 text-red-600 rounded-md mb-4">
              Error loading data: {error.message}
            </div>
          )}

          {!pokemons || pokemons.length === 0 ? (
            <p>
              データがありません。Supabaseのシードが実行されているか確認してください。
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {pokemons.map((p) => {
                const displayName = p.form_name_ja
                  ? `${p.name_ja} (${p.form_name_ja})`
                  : p.name_ja;
                return (
                  <div
                    key={`${p.pokedex_id}-${p.form_name_ja}`}
                    className="p-4 rounded-lg bg-gray-50 border border-gray-200"
                  >
                    <div className="text-xs text-gray-500 mb-1">
                      No.{p.pokedex_id}
                    </div>
                    <div className="font-medium text-lg mb-2">
                      {displayName}
                    </div>
                    <div className="flex gap-2 mb-3">
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
                        {getTranslatedType(p.type1)}
                      </span>
                      {p.type2 && (
                        <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-xs rounded-full">
                          {getTranslatedType(p.type2)}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-xs text-gray-600">
                      <div>H: {p.base_hp}</div>
                      <div>A: {p.base_atk}</div>
                      <div>B: {p.base_def}</div>
                      <div>C: {p.base_spa}</div>
                      <div>D: {p.base_spd}</div>
                      <div>S: {p.base_spe}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
