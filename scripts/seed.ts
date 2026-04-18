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

  const chunkSize = 200;
  let sql = 'INSERT INTO public.master_pokemon (id, pokedex_id, name_en, name_ja, form_name_en, form_name_ja, type1, type2, base_hp, base_atk, base_def, base_spa, base_spd, base_spe, abilities, weight_kg) VALUES\n';
  
  const values = formattedPokemon.map((p: any) => {
    const t2 = p.type2 ? `'${p.type2}'` : 'null';
    const fEn = p.form_name_en ? `'${p.form_name_en.replace(/'/g, "''")}'` : 'null';
    const fJa = p.form_name_ja ? `'${p.form_name_ja.replace(/'/g, "''")}'` : 'null';
    const abs = `'{${p.abilities.map((a:string)=>`"${a.replace(/"/g, '\\"')}"`).join(',')}}'`;
    return `(${p.id}, ${p.pokedex_id}, '${p.name_en.replace(/'/g, "''")}', '${p.name_ja.replace(/'/g, "''")}', ${fEn}, ${fJa}, '${p.type1}', ${t2}, ${p.base_hp}, ${p.base_atk}, ${p.base_def}, ${p.base_spa}, ${p.base_spd}, ${p.base_spe}, ARRAY[${p.abilities.map((a:string)=>`'${a.replace(/'/g, "''")}'`).join(',')}], ${p.weight_kg})`;
  });

  sql += values.join(',\n') + '\nON CONFLICT (id) DO NOTHING;\n';
  
  const fs = require('fs');
  fs.writeFileSync('pokemon_seed.sql', sql);
  console.log('✅ Generated pokemon_seed.sql');

  console.log('✅ Pokémon database seed is complete!');
}

async function seedMoves() {
  const query = `
    query GetAllMoves {
      pokemon_v2_move(where: {pokemon_v2_generation: {id: {_lte: 7}}}) {
        id
        name
        power
        accuracy
        pp
        priority
        pokemon_v2_type {
          name
        }
        pokemon_v2_movedamageclass {
          name
        }
        pokemon_v2_movenames(where: {language_id: {_in: [1, 11]}}) {
          name
          language_id
        }
      }
    }
  `;

  console.log('Fetching Moves from PokeAPI (GraphQL)...');
  const response = await fetch('https://beta.pokeapi.co/graphql/v1beta', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });

  const { data, errors } = await response.json();
  if (errors) {
    console.error('GraphQL Errors:', errors);
    throw new Error('Failed to fetch moves from PokeAPI');
  }

  const rawMoves = data.pokemon_v2_move;
  const formattedMoves = rawMoves.map((m: any) => {
    // 日本語名
    const names = m.pokemon_v2_movenames || [];
    const nameJa = getJapaneseName(names) || m.name;

    // カテゴリー (physical, special, status)
    const category = m.pokemon_v2_movedamageclass?.name || 'status';

    return {
      id: m.id,
      name_en: m.name,
      name_ja: nameJa,
      type: m.pokemon_v2_type?.name || 'unknown',
      category: category,
      power: m.power,            // nullable
      accuracy: m.accuracy,      // nullable
      pp: m.pp || 0,
      priority: m.priority || 0,
      makes_contact: false,      // TODO: map if needed later
      is_multihit: false,        // TODO: map if needed later
      description: null
    };
  });

  console.log(`Found ${formattedMoves.length} Moves.`);

  const values = formattedMoves.map((m: any) => {
    return `(${m.id}, '${m.name_en.replace(/'/g, "''")}', '${m.name_ja.replace(/'/g, "''")}', '${m.type}', '${m.category}', ${m.power || 'null'}, ${m.accuracy || 'null'}, ${m.pp}, ${m.priority}, ${m.makes_contact}, ${m.is_multihit}, null)`;
  });

  const sql = 'INSERT INTO public.master_moves (id, name_en, name_ja, type, category, power, accuracy, pp, priority, makes_contact, is_multihit, description) VALUES\n' + 
      values.join(',\n') + '\nON CONFLICT (id) DO NOTHING;\n';

  const fs = require('fs');
  fs.writeFileSync('moves_seed.sql', sql);
  console.log('✅ Generated moves_seed.sql');

  console.log('✅ Moves database seed is complete!');
}

async function main() {
  console.log('Starting DB seed script...');
  await seedPokemon();
  await seedMoves();
}

main().catch(console.error);
