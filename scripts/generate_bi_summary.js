#!/usr/bin/env node
/**
 * generate_bi_summary.js
 * Pre-aggregates all GeoJSON layers by Cod_man into a compact JSON for the BI dashboard.
 * Usage: node scripts/generate_bi_summary.js
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const DATA_DIR = path.join(__dirname, '..', 'data');
const OUT_FILE = path.join(DATA_DIR, 'bi_summary.json');

// --------------- helpers ---------------
function readGZ(filename) {
  const filepath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filepath)) { console.warn('WARN: file not found:', filepath); return []; }
  const buf = fs.readFileSync(filepath);
  const json = JSON.parse(zlib.gunzipSync(buf).toString());
  return json.features || [];
}

function readMultiGZ(filenames) {
  return filenames.flatMap(f => readGZ(f));
}

function readJSON(filename) {
  const filepath = path.join(DATA_DIR, filename);
  return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

function round2(v) { return Math.round((v || 0) * 100) / 100; }
function safeNum(v) { return typeof v === 'number' && isFinite(v) ? v : 0; }
function getCodMan(props) {
  return String(props.Cod_man || props.cod_man || props.cod_man_1 || '').trim();
}

// --------------- palettes ---------------
const ALTIMETRY_CLASSES = [
  '0 a 100 m','100 a 200 m','200 a 300 m','300a 400 m',
  '400 a 500 m','500 a 600 m','600 a 700 m','700 a 800 m',
  '800 a 900 m','900 a 1000 m','1000 a 1100 m','1100 a 1200 m',
  '1200 a 1300 m','1300 a 1400 m'
];
const ALTIMETRY_COLORS = [
  '#1d4f91','#2763a5','#2f79b3','#3b90b7','#4aa7b3',
  '#66bfa8','#85d090','#a9dd7f','#cde87a','#e8f07c',
  '#f6d776','#f3b555','#ed8a3b','#e85c28'
];

const SLOPE_CLASSES = ['000a003','003a008','008a015','015a025','025a045','045a100','>100'];
const SLOPE_COLORS = ['#f7fcfd','#ccece6','#66c2a4','#41ae76','#238b45','#006d2c','#00441b'];
const SLOPE_LABELS = {
  '000a003':'0% a 3%','003a008':'3% a 8%','008a015':'8% a 15%',
  '015a025':'15% a 25%','025a045':'25% a 45%','045a100':'45% a 100%','>100':'> 100%'
};

const USO_COLORS = {
  'Agricultura Anual':'#f6d55c','Agricultura Perene':'#ed9c44',
  'Área Construída':'#b13f3c','Área Urbanizada':'#e34a33',
  "Corpos d'Água":'#4c78a8','Floresta Nativa':'#1a7f3b',
  'Mangue':'#3b9d5d','Pastagem/Campo':'#a3d47c',
  'Plantios Florestais':'#175c3c','Solo Exposto/Mineração':'#f0b67f',
  'Várzea':'#7fc6bc'
};

const SOIL_COLORS = {
  'AFLORAMENTOS DE ROCHAS':'#593411','ARGISSOLOS':'#bc7434',
  'CAMBISSOLOS':'#d89c63','ESPELHOS DAGUA':'#4f9ed9',
  'ESPODOSSOLOS':'#6db5a6','GLEISSOLOS':'#2b7da0',
  'LATOSSOLOS':'#f4d6a0','NEOSSOLOS LITÓLICOS':'#8d5035',
  'NEOSSOLOS REGOLÍTICOS':'#c1784c','NITOSSOLOS':'#f8b26a',
  'ORGANOSSOLOS':'#1f8b4d','ÁREAS URBANAS':'#9f3a38'
};

const CLASS_COLORS = { 'IDR-Paraná': '#1d4ed8', 'Sanepar': '#059669' };

// --------------- bovinos field keys ---------------
const BOVINO_FIELDS = [
  'Bovino,Macho,0 a 12 meses','Bovino,Femea,0 a 12 meses',
  'Bovino,Macho,13 a 24 meses','Bovino,Femea,13 a 24 meses',
  'Bovino,Macho,25 a 36 meses','Bovino,Femea,25 a 36 meses',
  'Bovino,Macho,Acima de 36 meses','Bovino,Femea,Acima de 36 meses'
];
const SUINO_FIELDS = [
  'Suíno, Macho, Reprodutor (Cachaço)','Suíno, Fêmea, Matriz',
  'Suíno, Macho, Leitão','Suíno, Fêmea, Leitão',
  'Suíno, sexo e idade não relevantes'
];
const AVE_FIELDS = [
  'AVE GALINHAS','AVE PERUS','AVE PATOS','AVE MARRECOS',
  'AVE CODORNAS','AVE RATITAS','Outras aves de não produção'
];
const BUBALINO_FIELDS = [
  'Bubalino,Macho,0 a 12 meses','Bubalino,Femea,0 a 12 meses',
  'Bubalino,Macho,13 a 24 meses','Bubalino,Femea,13 a 24 meses',
  'Bubalino,Macho,25 a 36 meses','Bubalino,Femea,25 a 36 meses',
  'Bubalino,Macho,Acima de 36 meses','Bubalino,Femea,Acima de 36 meses'
];

// ============================================================
// MAIN
// ============================================================
console.log('=== generate_bi_summary.js ===');
console.time('Total');

// 1. Read bacias base
console.log('Reading baciasselecionadas.geojson...');
const bacias = readJSON('baciasselecionadas.geojson');
const manMap = new Map(); // Cod_man -> { metadata, aggregations }

bacias.features.forEach(f => {
  const p = f.properties;
  const cm = String(p.Cod_man || '').trim();
  if (!cm) return;
  if (!manMap.has(cm)) {
    manMap.set(cm, {
      Cod_man: Number(cm),
      Manancial: p.Manancial,
      Nome_bacia: p.Nome_bacia,
      Regional_IDR: p['Regional IDR'],
      NomeMunicipio: p.NomeMunicipio,
      Classe: p.Classe,
      CodIBGE: p.CodIBGE,
      cod_ottos: [],
      altimetria: {},
      declividade: {},
      uso_solo: {},
      solos: {},
      estradas_km: 0,
      estradas_classe: {},
      hidrografia_km: 0,
      hidrografia_regime: {},
      nascentes: 0,
      construcoes: { count: 0, area_m2: 0 },
      bovinos: { total: 0 },
      suinos: { total: 0 },
      aves: { total: 0 },
      bubalinos: 0,
      caf: { count: 0, area_ha: 0 },
      agrotoxicos: { count: 0, ingredientes: new Set() },
      sigarh: { count: 0, por_uso: {} },
      educacao: 0,
      car: { count: 0, area_ha: 0 },
      conflitos: { area_ha: 0, por_classe: {} },
      uso_app: { area_ha: 0, por_classe: {} }
    });
  }
  const entry = manMap.get(cm);
  const otto = String(p.Cod_otto || '');
  if (otto && !entry.cod_ottos.includes(otto)) entry.cod_ottos.push(otto);
});

console.log(`Found ${manMap.size} unique mananciais from ${bacias.features.length} ottobacias`);

// Helper to get or skip manancial entry
function getEntry(props) {
  const cm = getCodMan(props);
  return cm ? manMap.get(cm) : null;
}

// 2. Altimetria
console.log('Processing altimetria...');
readGZ('altimetria__altimetria_otto.geojson_part-001.gz').forEach(f => {
  const e = getEntry(f.properties);
  if (!e) return;
  const cls = f.properties.ClAlt || 'Desconhecido';
  e.altimetria[cls] = round2((e.altimetria[cls] || 0) + safeNum(f.properties.area_ha));
});

// 3. Declividade
console.log('Processing declividade...');
readMultiGZ([
  'declividade__declividade_otto.geojson_part-001.gz',
  'declividade__declividade_otto.geojson_part-002.gz'
]).forEach(f => {
  const e = getEntry(f.properties);
  if (!e) return;
  const cls = f.properties.ClDec || 'Desconhecido';
  e.declividade[cls] = round2((e.declividade[cls] || 0) + safeNum(f.properties.area_ha));
});

// 4. Uso do solo
console.log('Processing uso do solo...');
readMultiGZ([
  'uso_solo__usodosolo_otto.geojson_part-001.gz',
  'uso_solo__usodosolo_otto.geojson_part-002.gz',
  'uso_solo__usodosolo_otto.geojson_part-003.gz',
  'uso_solo__usodosolo_otto.geojson_part-004.gz',
  'uso_solo__usodosolo_otto.geojson_part-005.gz'
]).forEach(f => {
  const e = getEntry(f.properties);
  if (!e) return;
  const cls = f.properties.NIVEL_II || 'Desconhecido';
  e.uso_solo[cls] = round2((e.uso_solo[cls] || 0) + safeNum(f.properties.area_ha));
});

// 5. Solos
console.log('Processing solos...');
readGZ('solos__solos_otto.geojson_part-001.gz').forEach(f => {
  const e = getEntry(f.properties);
  if (!e) return;
  const cls = f.properties.Cl_solos || 'Desconhecido';
  e.solos[cls] = round2((e.solos[cls] || 0) + safeNum(f.properties.area_ha));
});

// 6. Estradas
console.log('Processing estradas...');
readGZ('estradas__estradas_otto.geojson_part-001.gz').forEach(f => {
  const e = getEntry(f.properties);
  if (!e) return;
  const km = safeNum(f.properties.extensao_km);
  e.estradas_km = round2(e.estradas_km + km);
  const cls = f.properties.fclass || 'other';
  e.estradas_classe[cls] = round2((e.estradas_classe[cls] || 0) + km);
});

// 7. Hidrografia
console.log('Processing hidrografia...');
readGZ('hidrografia__hidrografia_otto.geojson_part-001.gz').forEach(f => {
  const e = getEntry(f.properties);
  if (!e) return;
  const km = safeNum(f.properties.extensao_km);
  e.hidrografia_km = round2(e.hidrografia_km + km);
  const regime = f.properties.Regime || 'Desconhecido';
  e.hidrografia_regime[regime] = round2((e.hidrografia_regime[regime] || 0) + km);
});

// 8. Construcoes
console.log('Processing construcoes...');
readMultiGZ([
  'construcoes__construcoes_otto.geojson_part-001.gz',
  'construcoes__construcoes_otto.geojson_part-002.gz',
  'construcoes__construcoes_otto.geojson_part-003.gz'
]).forEach(f => {
  const e = getEntry(f.properties);
  if (!e) return;
  e.construcoes.count++;
  e.construcoes.area_m2 = round2(e.construcoes.area_m2 + safeNum(f.properties.area_in_meters));
});

// 9. Nascentes
console.log('Processing nascentes...');
readGZ('nascentes__nascentes_otto.geojson_part-001.gz').forEach(f => {
  const e = getEntry(f.properties);
  if (e) e.nascentes++;
});

// 10. Bovinos
console.log('Processing bovinos...');
readGZ('bovinos__bovinos.geojson_part-001.gz').forEach(f => {
  const e = getEntry(f.properties);
  if (!e) return;
  let total = 0;
  BOVINO_FIELDS.forEach(k => {
    const v = safeNum(f.properties[k]);
    const shortKey = k.replace('Bovino,', '').replace(/ /g, '_').toLowerCase();
    e.bovinos[shortKey] = (e.bovinos[shortKey] || 0) + v;
    total += v;
  });
  e.bovinos.total += total;
});

// 11. Suinos
console.log('Processing suinos...');
readGZ('suinos__suinos.geojson_part-001.gz').forEach(f => {
  const e = getEntry(f.properties);
  if (!e) return;
  let total = 0;
  SUINO_FIELDS.forEach(k => {
    const v = safeNum(f.properties[k]);
    total += v;
  });
  e.suinos.total += total;
});

// 12. Aves
console.log('Processing aves...');
readGZ('aves__aves.geojson_part-001.gz').forEach(f => {
  const e = getEntry(f.properties);
  if (!e) return;
  let total = 0;
  AVE_FIELDS.forEach(k => {
    const v = safeNum(f.properties[k]);
    const shortKey = k.replace('AVE ', '').replace('Outras aves de não produção', 'outras').toLowerCase();
    e.aves[shortKey] = (e.aves[shortKey] || 0) + v;
    total += v;
  });
  e.aves.total += total;
});

// 13. Bubalinos
console.log('Processing bubalinos...');
readGZ('bubalinos__bubalinos.geojson_part-001.gz').forEach(f => {
  const e = getEntry(f.properties);
  if (!e) return;
  let total = 0;
  BUBALINO_FIELDS.forEach(k => { total += safeNum(f.properties[k]); });
  e.bubalinos += total;
});

// 14. CAF
console.log('Processing CAF...');
readGZ('caf.geojson_part-001.gz').forEach(f => {
  const e = getEntry(f.properties);
  if (!e) return;
  e.caf.count++;
  e.caf.area_ha = round2(e.caf.area_ha + safeNum(f.properties.nr_area));
});

// 15. Agrotoxicos
console.log('Processing agrotoxicos...');
readGZ('agrotoxicos__agrotoxicos.geojson_part-001.gz').forEach(f => {
  const e = getEntry(f.properties);
  if (!e) return;
  e.agrotoxicos.count++;
  if (f.properties.Ingredient) e.agrotoxicos.ingredientes.add(f.properties.Ingredient);
});

// 16. SIGARH
console.log('Processing SIGARH...');
readGZ('sigarh.geojson_part-001.gz').forEach(f => {
  const p = f.properties;
  const cm = String(p.Cod_man || '').trim();
  const e = cm ? manMap.get(cm) : null;
  if (!e) return;
  e.sigarh.count++;
  const uso = p.nm_tipo_us || 'Desconhecido';
  e.sigarh.por_uso[uso] = (e.sigarh.por_uso[uso] || 0) + 1;
});

// 17. Educacao
console.log('Processing educacao...');
readGZ('educacao__educacao_otto.geojson_part-001.gz').forEach(f => {
  const e = getEntry(f.properties);
  if (e) e.educacao++;
});

// 18. CAR
console.log('Processing CAR...');
readGZ('car.geojson_part-001.gz').forEach(f => {
  const p = f.properties;
  const cm = String(p.Cod_man || '').trim();
  const e = cm ? manMap.get(cm) : null;
  if (!e) return;
  e.car.count++;
  e.car.area_ha = round2(e.car.area_ha + safeNum(p.num_area || p.area_ha));
});

// 19. Conflitos de uso (otto)
console.log('Processing conflitos de uso...');
readGZ('conflitosdeuso__conflitodeuso_otto.geojson_part-001.gz').forEach(f => {
  const p = f.properties;
  const cm = String(p.Cod_man || '').trim();
  const e = cm ? manMap.get(cm) : null;
  if (!e) return;
  const area = safeNum(p.Area_ha);
  e.conflitos.area_ha = round2(e.conflitos.area_ha + area);
  const cls = p.NIVEL_II || 'Desconhecido';
  e.conflitos.por_classe[cls] = round2((e.conflitos.por_classe[cls] || 0) + area);
});

// 20. Uso do solo em APP
console.log('Processing uso do solo em APP...');
readGZ('conflitosdeuso__uso_solo_em_app.geojson_part-001.gz').forEach(f => {
  const p = f.properties;
  const cm = String(p.cod_man_1 || p.Cod_man || '').trim();
  const e = cm ? manMap.get(cm) : null;
  if (!e) return;
  const area = safeNum(p.area_ha_final || p.area_ha);
  e.uso_app.area_ha = round2(e.uso_app.area_ha + area);
  const cls = p.nivel_ii || p.NIVEL_II || 'Desconhecido';
  e.uso_app.por_classe[cls] = round2((e.uso_app.por_classe[cls] || 0) + area);
});

// 21. URTs
console.log('Processing URTs...');
const urtsFeatures = readGZ('urs__urs.geojson_part-001.gz');
const urts = urtsFeatures.map(f => {
  const p = f.properties;
  return {
    Cod_man: Number(p.Cod_man || 0),
    Agricultor: p.Agricultor || '--',
    Municipio: p.Municipio || p.NomeMunicipio || '--',
    Programa: p.Programa || '--',
    MIP: p.MIP || null,
    MID: p.MID || null,
    Coletor: p.Coletor || null,
    Regional: p['Regional IDR'] || p['Região'] || '--'
  };
});

// ============================================================
// BUILD OUTPUT
// ============================================================
console.log('Building output...');

// Collect unique classes across all mananciais
const allClasses = {
  altimetria: new Set(),
  declividade: new Set(),
  uso_solo: new Set(),
  solos: new Set(),
  estradas: new Set(),
  conflitos: new Set(),
  uso_app: new Set()
};

const mananciais = [];
let totalNascentes = 0, totalConstrucoes = 0, totalCaf = 0;
let totalBovinos = 0, totalSuinos = 0, totalAves = 0, totalBubalinos = 0;
let totalEstradasKm = 0, totalHidrografiaKm = 0;
let totalEducacao = 0, totalCar = 0, totalAgrotoxicos = 0, totalSigarh = 0;

for (const [cm, e] of manMap) {
  // Convert Set to count for agrotoxicos
  const agro = { count: e.agrotoxicos.count, ingredientes_unicos: e.agrotoxicos.ingredientes.size };

  // Collect classes
  Object.keys(e.altimetria).forEach(k => allClasses.altimetria.add(k));
  Object.keys(e.declividade).forEach(k => allClasses.declividade.add(k));
  Object.keys(e.uso_solo).forEach(k => allClasses.uso_solo.add(k));
  Object.keys(e.solos).forEach(k => allClasses.solos.add(k));
  Object.keys(e.estradas_classe).forEach(k => allClasses.estradas.add(k));
  Object.keys(e.conflitos.por_classe).forEach(k => allClasses.conflitos.add(k));
  Object.keys(e.uso_app.por_classe).forEach(k => allClasses.uso_app.add(k));

  // Accumulate totals
  totalNascentes += e.nascentes;
  totalConstrucoes += e.construcoes.count;
  totalCaf += e.caf.count;
  totalBovinos += e.bovinos.total;
  totalSuinos += e.suinos.total;
  totalAves += e.aves.total;
  totalBubalinos += e.bubalinos;
  totalEstradasKm += e.estradas_km;
  totalHidrografiaKm += e.hidrografia_km;
  totalEducacao += e.educacao;
  totalCar += e.car.count;
  totalAgrotoxicos += e.agrotoxicos.count;
  totalSigarh += e.sigarh.count;

  mananciais.push({
    Cod_man: e.Cod_man,
    Manancial: e.Manancial,
    Nome_bacia: e.Nome_bacia,
    Regional_IDR: e.Regional_IDR,
    NomeMunicipio: e.NomeMunicipio,
    Classe: e.Classe,
    CodIBGE: e.CodIBGE,
    num_ottobacias: e.cod_ottos.length,
    cod_ottos: e.cod_ottos,
    altimetria: e.altimetria,
    declividade: e.declividade,
    uso_solo: e.uso_solo,
    solos: e.solos,
    estradas_km: e.estradas_km,
    estradas_classe: e.estradas_classe,
    hidrografia_km: e.hidrografia_km,
    hidrografia_regime: e.hidrografia_regime,
    nascentes: e.nascentes,
    construcoes: e.construcoes,
    bovinos: e.bovinos,
    suinos: e.suinos,
    aves: e.aves,
    bubalinos: e.bubalinos,
    caf: e.caf,
    agrotoxicos: agro,
    sigarh: e.sigarh,
    educacao: e.educacao,
    car: e.car,
    conflitos: e.conflitos,
    uso_app: e.uso_app
  });
}

mananciais.sort((a, b) => a.Cod_man - b.Cod_man);

const uniqueBacias = new Set(mananciais.map(m => m.Nome_bacia));
const uniqueMunicipios = new Set(mananciais.map(m => m.NomeMunicipio));
const uniqueRegionais = new Set(mananciais.map(m => m.Regional_IDR));

const summary = {
  generated: new Date().toISOString().slice(0, 10),
  totals: {
    mananciais: mananciais.length,
    ottobacias: bacias.features.length,
    bacias: uniqueBacias.size,
    municipios: uniqueMunicipios.size,
    regionais: uniqueRegionais.size,
    urts: urts.length,
    nascentes: totalNascentes,
    construcoes: totalConstrucoes,
    caf: totalCaf,
    bovinos_total: totalBovinos,
    suinos_total: totalSuinos,
    aves_total: totalAves,
    bubalinos_total: totalBubalinos,
    estradas_km: round2(totalEstradasKm),
    hidrografia_km: round2(totalHidrografiaKm),
    educacao: totalEducacao,
    car: totalCar,
    agrotoxicos: totalAgrotoxicos,
    sigarh: totalSigarh
  },
  mananciais,
  urts,
  classes_altimetria: ALTIMETRY_CLASSES.filter(c => allClasses.altimetria.has(c))
    .concat([...allClasses.altimetria].filter(c => !ALTIMETRY_CLASSES.includes(c))),
  classes_declividade: SLOPE_CLASSES.filter(c => allClasses.declividade.has(c))
    .concat([...allClasses.declividade].filter(c => !SLOPE_CLASSES.includes(c))),
  classes_uso_solo: [...allClasses.uso_solo].sort(),
  classes_solos: [...allClasses.solos].sort(),
  classes_estradas: [...allClasses.estradas].sort(),
  classes_conflitos: [...allClasses.conflitos].sort(),
  classes_uso_app: [...allClasses.uso_app].sort(),
  paletas: {
    altimetria: Object.fromEntries(ALTIMETRY_CLASSES.map((c, i) => [c, ALTIMETRY_COLORS[i]])),
    declividade: Object.fromEntries(SLOPE_CLASSES.map((c, i) => [c, SLOPE_COLORS[i]])),
    declividade_labels: SLOPE_LABELS,
    uso_solo: USO_COLORS,
    solos: SOIL_COLORS,
    classe: CLASS_COLORS
  }
};

fs.writeFileSync(OUT_FILE, JSON.stringify(summary));
const sizeMB = (fs.statSync(OUT_FILE).size / 1024 / 1024).toFixed(2);
console.log(`\nOutput: ${OUT_FILE}`);
console.log(`Size: ${sizeMB} MB`);
console.log(`Mananciais: ${mananciais.length}`);
console.log(`URTs: ${urts.length}`);
console.log(`Totals:`, JSON.stringify(summary.totals, null, 2));
console.timeEnd('Total');
