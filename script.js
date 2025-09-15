let map = L.map('map').setView([-25.5, -52.5], 7);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap',
}).addTo(map);

let layerBase = null;
let layerUsoSolo = null;
let layerCAF = null;

function estiloPoligonoDefault(feature) {
  return {
    color: '#3388ff',
    weight: 1,
    fillColor: '#3388ff',
    fillOpacity: 0.35,
  };
}

function onEachFeatureCAF(feature, layer) {
  if (feature.properties && feature.properties.CAF_AREA_C !== undefined) {
    layer.bindPopup('<b>Cód. CAF:</b> ' + feature.properties.CAF_AREA_C);
  }
}

function carregarLayerBase() {
  fetch('data/otto_selec__ottos_selec_lista4.geojson')
    .then(resp => resp.json())
    .then(json => {
      layerBase = L.geoJSON(json, {
        style: estiloPoligonoDefault,
        onEachFeature: (feature, layer) => {
          if (feature.properties && feature.properties.Cod_man !== undefined) {
            layer.bindPopup('Cod_man: ' + feature.properties.Cod_man);
          }
        }
      }).addTo(map);
      map.fitBounds(layerBase.getBounds());
    });
}

function carregarUsoSolo() {
  fetch('data/uso_solo.geojson')
    .then(resp => resp.json())
    .then(json => {
      layerUsoSolo = L.geoJSON(json, {
        style: { color: '#66cc99', fillColor: '#66cc99', fillOpacity: 0.35, weight: 1 },
        filter: feature => {
          if (!layerBase) return false;
          let cod = feature.properties.Cod_man;
          return layerBase.getLayers().some(l => l.feature.properties.Cod_man === cod);
        }
      }).addTo(map);
    });
}

function carregarCAF() {
  fetch('data/caf__caf_otto.geojson')
    .then(resp => resp.json())
    .then(json => {
      layerCAF = L.geoJSON(json, {
        style: { color: '#ff8800', fillColor: '#ff8800', fillOpacity: 0.35, weight: 1 },
        filter: feature => {
          if (!layerBase) return false;
          let cod = feature.properties.Cod_man;
          return layerBase.getLayers().some(l => l.feature.properties.Cod_man === cod);
        },
        onEachFeature: onEachFeatureCAF
      }).addTo(map);
    });
}

carregarLayerBase();
carregarUsoSolo();
carregarCAF();

document.getElementById('btnApplyFilters').addEventListener('click', () => {
  if (layerUsoSolo) map.removeLayer(layerUsoSolo);
  if (layerCAF) map.removeLayer(layerCAF);
  carregarUsoSolo();
  carregarCAF();
});
