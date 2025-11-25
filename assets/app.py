"""Aplicativo Streamlit para explorar camadas geoespaciais no diretório data."""
from __future__ import annotations

import gzip
import json
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Sequence

import geopandas as gpd
import pandas as pd
import pydeck as pdk
import streamlit as st
from pyproj import CRS


DATA_DIR = Path(__file__).resolve().parent / "data"
MAX_FEATURES_FOR_MAP = 2000
SAMPLE_SIZE_DEFAULT = 500


@dataclass
class LayerInfo:
    """Informações básicas sobre uma camada."""

    name: str
    files: Sequence[Path]
    display_name: str
    size_bytes: int


@st.cache_data(show_spinner=False)
def discover_layers() -> Dict[str, LayerInfo]:
    """Localiza e agrupa arquivos GeoJSON compactados por camada."""
    groups: Dict[str, List[Path]] = {}

    if not DATA_DIR.exists():
        return {}

    for path in sorted(DATA_DIR.glob("*.geojson")):
        groups.setdefault(path.stem, []).append(path)

    for path in sorted(DATA_DIR.glob("*.geojson_part-*.gz")):
        stem = path.name.split(".geojson_part-")[0]
        groups.setdefault(stem, []).append(path)

    layer_infos: Dict[str, LayerInfo] = {}
    for name, files in groups.items():
        size = sum(p.stat().st_size for p in files)
        display = (
            name.replace("__", " → ")
            .replace("_", " ")
            .strip()
            .title()
        )
        layer_infos[name] = LayerInfo(
            name=name,
            files=tuple(sorted(files)),
            display_name=display,
            size_bytes=size,
        )
    return layer_infos

@st.cache_data(show_spinner=False)
def load_layer(name: str) -> gpd.GeoDataFrame:
    """Carrega todas as feições das partes associadas a uma camada."""
    layer_info = discover_layers().get(name)
    if not layer_info:
        return gpd.GeoDataFrame()

    features: List[dict] = []
    crs_value: str | None = None

    for path in layer_info.files:
        with (gzip.open(path, "rt", encoding="utf-8") if path.suffix == ".gz" else path.open("rt", encoding="utf-8")) as fh:
            data = json.load(fh)
        features.extend(data.get("features", []))
        if not crs_value:
            crs_data = data.get("crs") or {}
            crs_value = crs_data.get("properties", {}).get("name")

    if not features:
        return gpd.GeoDataFrame()

    gdf = gpd.GeoDataFrame.from_features(features)

    if crs_value:
        try:
            gdf.set_crs(CRS.from_user_input(crs_value), inplace=True, allow_override=True)
        except Exception:
            # Caso a projeção não seja reconhecida, mantém sem CRS definido.
            pass

    return gdf


def human_readable_size(num_bytes: int) -> str:
    if num_bytes <= 0:
        return "0 B"
    units = ["B", "KB", "MB", "GB", "TB"]
    idx = 0
    value = float(num_bytes)
    while value >= 1024 and idx < len(units) - 1:
        value /= 1024
        idx += 1
    return f"{value:,.2f} {units[idx]}"


def to_wgs84(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    if gdf.empty:
        return gdf
    if gdf.crs is None:
        return gdf
    try:
        return gdf.to_crs(4326)
    except Exception:
        return gdf


def compute_view_state(bounds: Sequence[float]) -> pdk.ViewState:
    minx, miny, maxx, maxy = bounds
    center_lat = (miny + maxy) / 2
    center_lon = (minx + maxx) / 2
    span = max(maxx - minx, maxy - miny)
    if span <= 0:
        zoom = 12
    elif span < 0.05:
        zoom = 13
    elif span < 0.5:
        zoom = 10
    elif span < 1:
        zoom = 9
    elif span < 5:
        zoom = 8
    elif span < 10:
        zoom = 7
    elif span < 25:
        zoom = 6
    elif span < 60:
        zoom = 5
    else:
        zoom = 4
    return pdk.ViewState(latitude=center_lat, longitude=center_lon, zoom=zoom, pitch=0)


def main() -> None:
    st.set_page_config(
        page_title="Explorador de Camadas - Água Segura",
        layout="wide",
        page_icon="💧",
    )

    st.title("Explorador de Camadas Geoespaciais")
    st.caption(
        "Visualize métricas e mapas interativos para as camadas GeoJSON disponíveis no diretório `data`."
    )

    layers = discover_layers()
    if not layers:
        st.error("Nenhum arquivo GeoJSON foi localizado no diretório `data`.")
        return

    layer_names = sorted(layers.keys())

    selected_name = st.sidebar.selectbox(
        "Selecione uma camada",
        options=layer_names,
        format_func=lambda key: layers[key].display_name,
    )

    info = layers[selected_name]
    gdf = load_layer(selected_name)

    st.sidebar.subheader("Informações da camada")
    st.sidebar.write(f"**Arquivos:**")
    for file_path in info.files:
        st.sidebar.write(f"• `{file_path.name}`")
    st.sidebar.write(f"**Tamanho total:** {human_readable_size(info.size_bytes)}")
    st.sidebar.write(f"**Total de feições:** {len(gdf):,}")

    if gdf.empty:
        st.warning("Não foi possível carregar feições para esta camada.")
        return

    geometry_name = gdf.geometry.name if gdf.geometry is not None else "geometry"
    valid_geometries = gdf.geometry.notna()
    non_empty = gdf[valid_geometries & ~gdf.geometry.is_empty]

    col1, col2, col3 = st.columns(3)
    col1.metric("Feições", f"{len(gdf):,}")
    geom_counts = Counter(non_empty.geometry.geom_type)
    if geom_counts:
        geom_text = ", ".join(f"{k}: {v}" for k, v in geom_counts.items())
    else:
        geom_text = "Sem geometria"
    col2.metric("Tipos geométricos", geom_text)

    if not non_empty.empty:
        bounds = non_empty.total_bounds
        bounds_text = (
            f"Long: {bounds[0]:.4f} – {bounds[2]:.4f}\n"
            f"Lat: {bounds[1]:.4f} – {bounds[3]:.4f}"
        )
        col3.metric("Envelope (CRS original)", bounds_text)
    else:
        col3.metric("Envelope (CRS original)", "Não disponível")

    st.subheader("Mapa interativo")
    wgs84 = to_wgs84(non_empty)
    if wgs84.empty:
        st.info("Não há geometrias válidas para exibir no mapa.")
    else:
        max_slider = min(MAX_FEATURES_FOR_MAP, len(wgs84))
        min_slider = max(1, min(100, max_slider))
        step = 1 if max_slider <= 100 else 100
        default_value = min(SAMPLE_SIZE_DEFAULT, max_slider)

        max_features = st.slider(
            "Número máximo de feições no mapa",
            min_value=min_slider,
            max_value=max_slider,
            value=max(min_slider, default_value),
            step=step,
        )

        if len(wgs84) > max_features:
            display_gdf = wgs84.sample(max_features, random_state=42)
            st.caption(
                f"Exibindo uma amostra aleatória de {max_features} feições de um total de {len(wgs84):,}."
            )
        else:
            display_gdf = wgs84

        geojson_data = json.loads(display_gdf.to_json())
        deck = pdk.Deck(
            layers=[
                pdk.Layer(
                    "GeoJsonLayer",
                    data=geojson_data,
                    stroked=True,
                    filled=True,
                    get_fill_color="[30, 144, 255, 80]",
                    get_line_color="[0, 100, 0]",
                    line_width_min_pixels=1,
                    pickable=True,
                    auto_highlight=True,
                )
            ],
            initial_view_state=compute_view_state(display_gdf.total_bounds),
            tooltip={"text": "{properties}"},
        )
        st.pydeck_chart(deck, use_container_width=True)

        st.download_button(
            "Baixar GeoJSON em WGS84",
            data=wgs84.to_json().encode("utf-8"),
            file_name=f"{selected_name}_wgs84.geojson",
            mime="application/geo+json",
        )

    st.subheader("Estrutura dos atributos")
    attribute_columns = [col for col in gdf.columns if col != geometry_name]
    if attribute_columns:
        attr_info = pd.DataFrame(
            {
                "Campo": attribute_columns,
                "Tipo": [str(gdf[col].dtype) for col in attribute_columns],
                "Valores não nulos": [int(gdf[col].notna().sum()) for col in attribute_columns],
                "Valores únicos": [int(gdf[col].nunique(dropna=True)) for col in attribute_columns],
            }
        )
        st.dataframe(attr_info, use_container_width=True)
    else:
        st.info("A camada não possui atributos além da geometria.")

    numeric_cols = gdf.select_dtypes(include=["number"]).columns.tolist()
    if numeric_cols:
        st.subheader("Estatísticas descritivas (atributos numéricos)")
        st.dataframe(gdf[numeric_cols].describe().transpose(), use_container_width=True)

    st.subheader("Prévia dos dados")
    sample_rows = st.slider(
        "Número de linhas na prévia",
        min_value=5,
        max_value=min(100, len(gdf)),
        value=min(10, len(gdf)),
        step=5,
    )
    st.dataframe(gdf.head(sample_rows), use_container_width=True)


if __name__ == "__main__":
    main()
