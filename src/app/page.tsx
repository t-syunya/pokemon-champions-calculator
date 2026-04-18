import AuthButton from '@/components/AuthButton';
import CalculatorApp from '@/components/calculator/CalculatorApp';
import { createClient } from '@/utils/supabase/server';

export const revalidate = 3600; // 1時間キャッシュ（マスターデータなのでキャッシュ）

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // マスターから全ポケモンの基礎データを取得してクライアントへ渡す
  const { data: pokemons } = await supabase
    .from('master_pokemon')
    .select(
      'id, pokedex_id, name_ja, form_name_ja, type1, type2, base_hp, base_atk, base_def, base_spa, base_spd, base_spe, abilities',
    )
    .order('pokedex_id', { ascending: true });

  // 技データも取得
  const { data: moves } = await supabase
    .from('master_moves')
    .select('id, name_ja, type, category, power')
    .order('name_ja', { ascending: true });

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 text-gray-900 selection:bg-blue-200">
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-6 pb-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 tracking-tight">
              Pokémon Champions Calculator
            </h1>
          </div>
          <AuthButton />
        </header>

        {/* クライアント側の計算アプリケーションをマウント */}
        <CalculatorApp
          initialPokemons={pokemons || []}
          initialMoves={moves || []}
          user={user}
        />
      </div>
    </main>
  );
}
