const map = L.map('map').setView([-24.7, -53.7], 7);
const layers = {};
const allFeatures = {};
let selectedCodMan = new Set();

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

const filtros = {
  regiao: '',
  municipio: '',
  manancial: ''
};

// Arquivos a carregar
const arquivos = [
  { nome: 'baciasselecionadas.geojson_part-001.gz', chave: 'bacias', cor: '#2b8a3e' },
  { nome: 'uso_solo_usodosolo_otto.geojson_part-001.gz', chave: 'solo', cor: '#6a4c93' },
  { nome: 'curvasdenivel_curvas_otto.geojson_part-001.gz', chave: 'curvas', cor: '#ff6f61' }
];

// Carrega e descompacta
async function carregarGeoJSON(nome) {
  const res = await fetch(`./data/${nome}`);
  const bin = await res.arrayBuffer();
  const texto = pako.inflate(new Uint8Array(bin), { to: 'string' });
  return JSON.parse(texto);
}

// Preenche filtros
function preencherFiltros(features) {
  const regioes = new Set();
  const municipios = new Set();
  const mananciais = new Set();

  features.forEach(f => {
    regioes.add(f.properties['Página1_R']);
    municipios.add(f.properties['Página1_N']);
    mananciais.add(f.properties['Página1_M']);
  });

  const preencherSelect = (id, valores) => {
    const el = document.getElementById(id);
    valores.forEach(val => {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = val;
      el.appendChild(opt);
    });
  };

  preencherSelect('filtroRegiao', [...regioes].sort());
  preencherSelect('filtroMunicipio', [...municipios].sort());
  preencherSelect('filtroManancial', [...mananciais].sort());
}

// Aplica filtros com base em baciasselecionadas
function aplicarFiltro() {
  const bacias = allFeatures['bacias'] || [];
  selectedCodMan = new Set();

  bacias.forEach(f => {
    const prop = f.properties;
    const condRegiao = !filtros.regiao || prop['Página1_R'] === filtros.regiao;
    const condMun = !filtros.municipio || prop['Página1_N'] === filtros.municipio;
    const condMan = !filtros.manancial || prop['Página1_M'] === filtros.manancial;
    if (condRegiao && condMun && condMan) {
      selectedCodMan.add(prop['Cod_man']);
    }
  });

  for (const chave in layers) {
    const camada = layers[chave];
    const todos = allFeatures[chave] || [];
    camada.clearLayers();
    if (chave === 'bacias') {
      camada.addData(todos.filter(f => selectedCodMan.has(f.properties['Cod_man'])));
    } else {
      camada.addData(todos.filter(f => selectedCodMan.has(f.properties?.Cod_man)));
    }
  }
}

// Lógica de UI
['filtroRegiao', 'filtroMunicipio', 'filtroManancial'].forEach(id => {
  document.getElementById(id).addEventListener('change', e => {
    filtros[id.replace('filtro', '').toLowerCase()] = e.target.value;
    aplicarFiltro();
  });
});

document.getElementById('limparFiltros').addEventListener('click', () => {
  filtros.regiao = '';
  filtros.municipio = '';
  filtros.manancial = '';
  ['filtroRegiao', 'filtroMunicipio', 'filtroManancial'].forEach(id => {
    document.getElementById(id).value = '';
  });
  aplicarFiltro();
});

document.getElementById('opacity').addEventListener('input', e => {
  const op = parseInt(e.target.value) / 100;
  document.getElementById('opacityVal').textContent = `${e.target.value}%`;
  Object.values(layers).forEach(layer => layer.setStyle?.({ opacity: op }));
});

document.getElementById('fitAll').addEventListener('click', () => {
  const grupo = L.featureGroup(Object.values(layers));
  if (grupo.getLayers().length > 0) map.fitBounds(grupo.getBounds());
});

// Carrega todas as camadas
(async () => {
  for (const arq of arquivos) {
    const geo = await carregarGeoJSON(arq.nome);
    allFeatures[arq.chave] = geo.features;

    const camada = L.geoJSON(null, {
      style: { color: arq.cor, weight: 2, opacity: 0.7 },
      onEachFeature: (f, l) => {
        l.bindPopup(`${arq.chave.toUpperCase()}<br>Cod_man: ${f.properties?.Cod_man ?? 'N/A'}`);
      }
    });

    camada.addData(geo.features);
    camada.addTo(map);
    layers[arq.chave] = camada;

    if (arq.chave === 'bacias') preencherFiltros(geo.features);
  }

  aplicarFiltro();
})();
