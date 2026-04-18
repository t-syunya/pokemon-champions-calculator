import { loadEnvConfig } from '@next/env';
import { createClient } from '@supabase/supabase-js';

const projectDir = process.cwd();
loadEnvConfig(projectDir);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    'Environment variables NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are required.',
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function fetchFromPokeAPI() {
  const query = `
    query GetAllPokemon {
      pokemon_v2_pokemon(limit: 2000) {
        id
        name
        weight
        is_default
        pokemon_v2_pokemonspecy {
          pokedex_id: id
          pokemon_v2_pokemonspeciesnames(where: {language_id: {_in: [1, 11]}}) {
            name
            language_id
          }
        }
        pokemon_v2_pokemonforms {
          form_name
          pokemon_v2_pokemonformnames(where: {language_id: {_in: [1, 11]}}) {
            name
            language_id
          }
        }
        pokemon_v2_pokemontypes {
          pokemon_v2_type {
            name
          }
        }
        pokemon_v2_pokemonstats {
          base_stat
          pokemon_v2_stat {
            name
          }
        }
        pokemon_v2_pokemonabilities {
          pokemon_v2_ability {
            name
            pokemon_v2_abilitynames(where: {language_id: {_in: [1, 11]}}) {
              name
              language_id
            }
          }
        }
      }
    }
  `;

  console.log(
    'Fetching data from PokeAPI (GraphQL)... this might take a few seconds.',
  );
  const response = await fetch('https://beta.pokeapi.co/graphql/v1beta', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });

  const { data, errors } = await response.json();
  if (errors) {
    console.error('GraphQL Errors:', errors);
    throw new Error('Failed to fetch from PokeAPI');
  }
  return data.pokemon_v2_pokemon;
}

function getJapaneseName(namesArray: any[]) {
  // 漢字(11)があれば優先、なければひらがなルビ(1)
  const kanji = namesArray.find((n: any) => n.language_id === 11);
  if (kanji && kanji.name) return kanji.name;
  const kana = namesArray.find((n: any) => n.language_id === 1);
  if (kana && kana.name) return kana.name;
  return null;
}

function getEnglishName(namesArray: any[]) {
  const en = namesArray.find((n: any) => n.language_id === 9);
  return en ? en.name : null;
}

async function seedPokemon() {
  const rawPokemonList = await fetchFromPokeAPI();

  const formattedPokemon = rawPokemonList.map((p: any) => {
    // 種族名・フォルム名
    const speciesNames =
      p.pokemon_v2_pokemonspecy?.pokemon_v2_pokemonspeciesnames || [];
    const baseNameJa = getJapaneseName(speciesNames) || p.name;

    // フォルム
    const forms = p.pokemon_v2_pokemonforms || [];
    const mainForm = forms[0] || {};
    const formNameEn = mainForm.form_name || null;
    const formNamesList = mainForm.pokemon_v2_pokemonformnames || [];
    const formNameJaRaw = getJapaneseName(formNamesList);
    const formNameJa = formNameJaRaw ? formNameJaRaw : null;

    // タイプ
    const types = p.pokemon_v2_pokemontypes.map(
      (t: any) => t.pokemon_v2_type.name,
    );

    // 種族値
    const stats: Record<string, number> = {};
    p.pokemon_v2_pokemonstats.forEach((s: any) => {
      stats[s.pokemon_v2_stat.name] = s.base_stat;
    });

    // 特性
    const abilities = p.pokemon_v2_pokemonabilities.map((a: any) => {
      const dbNames = a.pokemon_v2_ability?.pokemon_v2_abilitynames || [];
      const jaName = getJapaneseName(dbNames);
      return jaName || a.pokemon_v2_ability.name;
    });

    return {
      id: p.id,
      pokedex_id: p.pokemon_v2_pokemonspecy.pokedex_id,
      name_en: p.name,
      name_ja: baseNameJa,
      form_name_en: formNameEn || null,
      form_name_ja: formNameJa || null,
      type1: types[0] || 'unknown',
      type2: types[1] || null,
      base_hp: stats['hp'] || 0,
      base_atk: stats['attack'] || 0,
      base_def: stats['defense'] || 0,
      base_spa: stats['special-attack'] || 0,
      base_spd: stats['special-defense'] || 0,
      base_spe: stats['speed'] || 0,
      abilities: Array.from(new Set(abilities)), // 重複除去
      weight_kg: p.weight / 10, // PokeAPI weight is in hectograms
    };
  });

  console.log(
    `Found ${formattedPokemon.length} Pokémon entries (including all forms).`,
  );

  // Supabaseに一括インサート (1000件以上ある場合、分割して投げる)
  const chunkSize = 200;
  for (let i = 0; i < formattedPokemon.length; i += chunkSize) {
    const chunk = formattedPokemon.slice(i, i + chunkSize);
    const { error } = await supabase.from('master_pokemon').upsert(chunk);
    if (error) {
      console.error(
        `Error inserting chunk ${i} - ${i + chunkSize}:`,
        error.message,
      );
    } else {
      console.log(`Inserted chunk ${i} - ${i + chunkSize} successfully.`);
    }
  }

  console.log('✅ Pokémon database seed is complete!');
}

async function main() {
  console.log('Starting DB seed script...');
  await seedPokemon();
}

main().catch(console.error);
