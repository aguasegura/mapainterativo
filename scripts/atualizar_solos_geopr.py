#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Refaz data/solos__solos_otto a partir do Mapa de Solos do Paraná publicado no GeoPR (IAT/EMBRAPA).

Uso: py -3.12 scripts/atualizar_solos_geopr.py [--geojson copia_local.geojson]

Fonte: 00_PUBLICACOES/solos_parana_embrapa (SiBCS 2006, 1:250.000; Embrapa Geoinfo parana_solos_20201105).
Recorte: as ottobacias de data/baciasselecionadas.geojson. Uma feição por ottobacia e unidade de mapeamento.
Depois rode: node scripts/generate_bi_summary.js
"""
import argparse
import gzip
import json
import os
import sys
import warnings
from pathlib import Path

import geopandas as gpd
import numpy as np
import requests
import shapely

sys.stdout.reconfigure(encoding="utf-8")
warnings.filterwarnings("ignore", message=".*keep_geom_type.*")

DATA = Path(__file__).resolve().parent.parent / "data"
SAIDA = DATA / "solos__solos_otto.geojson_part-001.gz"
SERVICO = "https://geopr.iat.pr.gov.br/server/rest/services/00_PUBLICACOES/solos_parana_embrapa/FeatureServer/0/query"
CRS_GEO, CRS_UTM = 4674, 31982
PAGINA = 1000
ATRIBUTOS = ["Nome_bacia", "Cod_otto", "Classe", "Manancial", "Cod_man", "Regional IDR", "NomeMunicipio", "CodIBGE"]
COBERTURA_MINIMA = 0.995

# Os valores são as chaves de SOIL_COLORS em script.js. Classe nova deve falhar aqui, não sumir da legenda.
CLASSE_POR_ORDEM = {
    "ARGISSOLO": "ARGISSOLOS", "CAMBISSOLO": "CAMBISSOLOS", "ESPODOSSOLO": "ESPODOSSOLOS",
    "GLEISSOLO": "GLEISSOLOS", "LATOSSOLO": "LATOSSOLOS", "NITOSSOLO": "NITOSSOLOS",
    "ORGANOSSOLO": "ORGANOSSOLOS", "AFLORAMENTO DE ROCHA": "AFLORAMENTOS DE ROCHAS",
    "AFLORAMENTO  ROCHOSOS": "AFLORAMENTOS DE ROCHAS",
}
CLASSE_NEOSSOLO = {"LITOLICO": "NEOSSOLOS LITÓLICOS", "REGOLITICO": "NEOSSOLOS REGOLÍTICOS"}
CLASSE_SEM_ORDEM = {"Area Urbana": "ÁREAS URBANAS", "agua": "ESPELHOS DAGUA", "agua_externa": "ESPELHOS DAGUA"}


def classe_solo(sbcs: str, ordem: str, sub_ordem: str) -> str:
    if sbcs in CLASSE_SEM_ORDEM:
        return CLASSE_SEM_ORDEM[sbcs]
    if ordem == "NEOSSOLO":
        return CLASSE_NEOSSOLO[sub_ordem.strip()]
    return CLASSE_POR_ORDEM[ordem]


def baixar() -> dict:
    sessao = requests.Session()
    base = {"where": "1=1", "f": "json", "returnCountOnly": "true"}
    total = sessao.get(SERVICO, params=base, timeout=120).json()["count"]
    feicoes: list[dict] = []
    while len(feicoes) < total:
        params = {"where": "1=1", "outFields": "*", "outSR": CRS_GEO, "f": "geojson", "orderByFields": "objectid",
                  "resultOffset": len(feicoes), "resultRecordCount": PAGINA, "geometryPrecision": 8}
        resposta = sessao.get(SERVICO, params=params, timeout=300)
        resposta.raise_for_status()
        pagina = resposta.json()["features"]
        if not pagina:
            raise RuntimeError(f"GeoPR parou em {len(feicoes)} de {total} feições")
        feicoes += pagina
    return {"type": "FeatureCollection", "features": feicoes}


def construir(solos: gpd.GeoDataFrame, bacias: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    # Uma Cod_otto aparece em duas linhas de bacias; a chave de recorte é a linha, não o código.
    bacias = bacias[ATRIBUTOS + ["geometry"]].assign(_linha=range(len(bacias)))
    campos = ["sbcs", "ordem_1", "sub_ordem_", "legenda", "geometry"]
    recorte = gpd.overlay(bacias, solos[campos], how="intersection", keep_geom_type=True)
    unidades = recorte.dissolve(by=["_linha", "sbcs"], as_index=False, aggfunc="first")
    unidades["geometry"] = shapely.make_valid(shapely.transform(unidades.geometry.values, lambda c: np.round(c, 8)))
    unidades["area_ha"] = unidades.to_crs(CRS_UTM).area.div(1e4).round(4)
    unidades = unidades[unidades.area_ha > 0].copy()
    unidades["Cl_solos"] = [classe_solo(*t) for t in zip(unidades.sbcs, unidades.ordem_1, unidades.sub_ordem_)]
    unidades = unidades.rename(columns={"sbcs": "SBCS", "legenda": "Legenda"})
    return unidades[["SBCS", "Cl_solos", "Legenda"] + ATRIBUTOS + ["area_ha", "geometry"]]


def gravar(unidades: gpd.GeoDataFrame) -> None:
    colecao = json.loads(unidades.to_json(drop_id=True, na="null"))
    colecao["name"] = "solos_otto_geopr"
    colecao["crs"] = {"type": "name", "properties": {"name": f"urn:ogc:def:crs:EPSG::{CRS_GEO}"}}
    temporario = SAIDA.with_suffix(".tmp")
    with gzip.open(temporario, "wt", encoding="utf-8") as destino:
        json.dump(colecao, destino, ensure_ascii=False, separators=(",", ":"))
    os.replace(temporario, SAIDA)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--geojson", help="cópia local do serviço, em vez de baixar")
    args = parser.parse_args()
    bruto = json.load(open(args.geojson, encoding="utf-8")) if args.geojson else baixar()
    solos = gpd.GeoDataFrame.from_features(bruto["features"], crs=CRS_GEO)
    solos["geometry"] = shapely.make_valid(solos.geometry.values)
    with open(DATA / "baciasselecionadas.geojson", encoding="utf-8") as origem:
        # As bacias estão em graus SIRGAS, apesar do código de CRS gravado no arquivo.
        bacias = gpd.GeoDataFrame.from_features(json.load(origem)["features"], crs=CRS_GEO)
    bacias["geometry"] = shapely.make_valid(bacias.geometry.values)

    unidades = construir(solos, bacias)
    area_bacias = bacias.to_crs(CRS_UTM).area.sum() / 1e4
    cobertura = unidades.area_ha.sum() / area_bacias
    if cobertura < COBERTURA_MINIMA or not unidades.is_valid.all() or unidades.SBCS.isna().any():
        raise RuntimeError(f"Resultado reprovado: cobertura {cobertura:.4f}, inválidas {(~unidades.is_valid).sum()}")
    gravar(unidades)
    print(f"{len(unidades)} feições, {unidades.SBCS.nunique()} unidades, cobertura {cobertura:.2%} -> {SAIDA.name}")


if __name__ == "__main__":
    main()
