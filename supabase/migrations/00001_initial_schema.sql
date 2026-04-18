-- 既存のテーブルがある場合は削除して再作成（クリーンアップ用）
DROP TABLE IF EXISTS public.saved_builds CASCADE;
DROP TABLE IF EXISTS public.master_pokemon CASCADE;
DROP TABLE IF EXISTS public.master_moves CASCADE;
DROP TABLE IF EXISTS public.master_items CASCADE;
DROP TABLE IF EXISTS public.master_natures CASCADE;
DROP TABLE IF EXISTS public.master_abilities CASCADE;

-- Master Data: Natures (性格)
CREATE TABLE public.master_natures (
  id integer PRIMARY KEY,
  name_en text NOT NULL,
  name_ja text NOT NULL,
  increased_stat text, -- atk, def, spa, spd, spe (無補正の場合はnull)
  decreased_stat text  -- atk, def, spa, spd, spe (無補正の場合はnull)
);

-- Master Data: Abilities (特性)
CREATE TABLE public.master_abilities (
  id integer PRIMARY KEY,
  name_en text NOT NULL,
  name_ja text NOT NULL,
  description text
);

-- Master Data: Pokemon (ポケモン)
-- PokeAPIの仕様に合わせ、通常種はID 1〜807、フォルム違いは10001〜 を想定
CREATE TABLE public.master_pokemon (
  id integer PRIMARY KEY, 
  pokedex_id integer NOT NULL, -- 全国図鑑ナンバー
  name_en text NOT NULL,
  name_ja text NOT NULL,
  form_name_en text, -- フォルム違い等の英語名 (例: 'Alola', 'Wash')
  form_name_ja text, -- フォルム名日本語 (例: 'アローラのすがた', 'ウォッシュロトム') ※表示時にカッコで括ります
  type1 text NOT NULL,
  type2 text,
  base_hp integer NOT NULL,
  base_atk integer NOT NULL,
  base_def integer NOT NULL,
  base_spa integer NOT NULL,
  base_spd integer NOT NULL,
  base_spe integer NOT NULL,
  abilities text[] NOT NULL, -- 特性名の配列
  weight_kg numeric NOT NULL
);

-- Master Data: Moves (技)
CREATE TABLE public.master_moves (
  id integer PRIMARY KEY,
  name_en text NOT NULL,
  name_ja text NOT NULL,
  type text NOT NULL,
  category text NOT NULL, -- Physical(物理), Special(特殊), Status(変化)
  power integer,
  accuracy integer,
  pp integer NOT NULL,
  priority integer DEFAULT 0 NOT NULL,
  makes_contact boolean DEFAULT false NOT NULL, -- 接触技フラグ
  is_multihit boolean DEFAULT false NOT NULL,   -- 連続技などのフラグ
  description text
);

-- Master Data: Items (持ち物)
CREATE TABLE public.master_items (
  id integer PRIMARY KEY,
  name_en text NOT NULL,
  name_ja text NOT NULL,
  description text
);

-- Saved Builds (User Parties/Pokemon adjustments)
CREATE TABLE public.saved_builds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  pokemon_id integer REFERENCES public.master_pokemon(id),
  nickname text,
  level integer DEFAULT 50 NOT NULL,
  nature text NOT NULL,
  ability text NOT NULL,
  item text, 
  ev_hp integer DEFAULT 0 NOT NULL,
  ev_atk integer DEFAULT 0 NOT NULL,
  ev_def integer DEFAULT 0 NOT NULL,
  ev_spa integer DEFAULT 0 NOT NULL,
  ev_spd integer DEFAULT 0 NOT NULL,
  ev_spe integer DEFAULT 0 NOT NULL,
  iv_hp integer DEFAULT 31 NOT NULL,
  iv_atk integer DEFAULT 31 NOT NULL,
  iv_def integer DEFAULT 31 NOT NULL,
  iv_spa integer DEFAULT 31 NOT NULL,
  iv_spd integer DEFAULT 31 NOT NULL,
  iv_spe integer DEFAULT 31 NOT NULL,
  move1_id integer REFERENCES public.master_moves(id),
  move2_id integer REFERENCES public.master_moves(id),
  move3_id integer REFERENCES public.master_moves(id),
  move4_id integer REFERENCES public.master_moves(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS for saved_builds
ALTER TABLE public.saved_builds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own saved builds"
ON public.saved_builds FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own saved builds"
ON public.saved_builds FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own saved builds"
ON public.saved_builds FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved builds"
ON public.saved_builds FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Master data is read-only accessible by everyone
ALTER TABLE public.master_pokemon ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access for master_pokemon" ON public.master_pokemon FOR SELECT TO public USING (true);

ALTER TABLE public.master_moves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access for master_moves" ON public.master_moves FOR SELECT TO public USING (true);

ALTER TABLE public.master_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access for master_items" ON public.master_items FOR SELECT TO public USING (true);

ALTER TABLE public.master_natures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access for master_natures" ON public.master_natures FOR SELECT TO public USING (true);

ALTER TABLE public.master_abilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access for master_abilities" ON public.master_abilities FOR SELECT TO public USING (true);
