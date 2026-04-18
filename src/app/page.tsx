import { createClient } from '@/utils/supabase/server';
import CalculatorApp from '@/components/calculator/CalculatorApp';

export const revalidate = 3600; // 1時間キャッシュ（マスターデータなのでキャッシュ）

export default async function Home() {
  const supabase = await createClient();

  // マスターから全ポケモンの基礎データを取得してクライアントへ渡す
  const { data: pokemons } = await supabase
    .from('master_pokemon')
    .select(
      'id, pokedex_id, name_ja, form_name_ja, type1, type2, base_hp, base_atk, base_def, base_spa, base_spd, base_spe',
    )
    .order('pokedex_id', { ascending: true });

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 text-gray-900 selection:bg-blue-200">
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 text-center sm:text-left">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-500">
            ポケモン ダメージ計算機
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            USUMルール準拠・リアルタイム計算 (Pokemon Champions Calculator)
          </p>
        </header>

        {/* クライアント側の計算アプリケーションをマウント */}
        <CalculatorApp initialPokemons={pokemons || []} />
      </div>
    </main>
  );
}
