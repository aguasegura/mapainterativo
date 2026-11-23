#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
escoamento.py - caminhos da enxurrada calculados pelo relevo (D8) por manancial.

Uso:
  py -3.12 scripts/escoamento.py               (todos os 46 mananciais)
  py -3.12 scripts/escoamento.py --cod-man 29  (um ou mais)

MDT: ANADEM v1 (30 m, viés de vegetação removido), COG público da OpenTopography
(DOI 10.5069/G9736P4G). Só o recorte da bacia + buffer é lido.

Saídas:
  data/escoamento__fluxo.geojson_part-NNN.gz                linhas (montante -> jusante)
  data/escoamento__cruzamentos_estrada.geojson_part-NNN.gz
  data/escoamento__depressoes.geojson_part-NNN.gz
  saida/<cod>_<slug>/escoamento/  rasters intermediários + checagens.json
  saida/escoamento_checagens.json  resumo do lote
"""
import argparse, gzip, json, math, re, shutil, sys, unicodedata
from pathlib import Path

import geopandas as gpd
import pandas as pd
import numpy as np
import rasterio
import rasterio.features
import rasterio.transform
from rasterio.features import shapes
from rasterio.merge import merge
from rasterio.warp import Resampling, reproject, transform_bounds
from shapely.geometry import LineString, Point, shape
import whitebox

REPO = Path(__file__).resolve().parent.parent
DATA = REPO / "data"
CRS_GEO, CRS_UTM = "EPSG:4674", "EPSG:31982"


def slug(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def read_gz_layer(prefix: str) -> gpd.GeoDataFrame:
    """Lê todas as partes data/<prefix>.geojson_part-NNN.gz (EPSG:4674)."""
    feats = []
    for p in sorted(DATA.glob(f"{prefix}.geojson_part-*.gz")):
        with gzip.open(p, "rt", encoding="utf-8") as f:
            feats += json.load(f).get("features", [])
    if not feats:
        return gpd.GeoDataFrame(geometry=[], crs=CRS_GEO)
    g = gpd.GeoDataFrame.from_features(feats, crs=CRS_GEO)
    return g[g.geometry.notna()]


sys.stdout.reconfigure(encoding="utf-8")
ANADEM = "/vsicurl/https://opentopography.s3.sdsc.edu/raster/ANADEM/ANADEM_be/anadem_v1_compressed_COG.tif"
RES = 30.0                 # m
BUFFER_M = 500
LIMIAR_FINO_HA = 1.0       # linhas finas
LIMIAR_PRINCIPAL_HA = 10.0 # rede principal (checagem com hidrografia)
LIMIAR_CRUZ_HA = 5.0       # cruzamento com estrada
DEPR_MIN_M, DEPR_MIN_HA = 0.3, 0.1
SIMPLIFY_M = 5
DIST_HIDRO_M = 60
MAX_PARTE_MB = 15
ATTRS = ["Nome_bacia", "Cod_otto", "Classe", "Manancial", "Cod_man"]


def fontes_mdt(fonte: str, b) -> list[str]:
    if fonte == "anadem":
        return [ANADEM]
    # Copernicus GLO-30 (DSM), um COG por grau, nome pelo canto sudoeste
    tiles = []
    for lat in range(math.floor(b[1]), math.floor(b[3]) + 1):
        for lon in range(math.floor(b[0]), math.floor(b[2]) + 1):
            n = (f"Copernicus_DSM_COG_10_{'N' if lat >= 0 else 'S'}{abs(lat):02d}_00_"
                 f"{'E' if lon >= 0 else 'W'}{abs(lon):03d}_00_DEM")
            tiles.append(f"/vsicurl/https://copernicus-dem-30m.s3.amazonaws.com/{n}/{n}.tif")
    return tiles


def baixar_mdt(bacia_utm, out: Path, fonte: str) -> Path:
    """Recorta o MDT no bbox da bacia+buffer e reprojeta para UTM 22S a 30 m."""
    minx, miny, maxx, maxy = bacia_utm.buffer(BUFFER_M).total_bounds
    width, height = int(math.ceil((maxx - minx) / RES)), int(math.ceil((maxy - miny) / RES))
    dst_tr = rasterio.transform.from_origin(minx, maxy, RES, RES)
    b = transform_bounds(CRS_UTM, CRS_GEO, minx, miny, maxx, maxy)
    pad = 0.002
    arr, src_tr = merge(fontes_mdt(fonte, b), bounds=(b[0] - pad, b[1] - pad, b[2] + pad, b[3] + pad), nodata=-9999)
    arr, nod = arr[0], -9999
    with rasterio.open(fontes_mdt(fonte, b)[0]) as src:
        src_crs = src.crs
    dst = np.full((height, width), -9999, "float32")
    reproject(arr, dst, src_transform=src_tr, src_crs=src_crs, src_nodata=nod,
              dst_transform=dst_tr, dst_crs=CRS_UTM, dst_nodata=-9999, resampling=Resampling.bilinear)
    if (dst == -9999).mean() > 0.01:
        sys.exit("MDT com mais de 1% de nodata no recorte; conferir acesso à fonte do MDT.")
    p = out / "mdt.tif"
    with rasterio.open(p, "w", driver="GTiff", height=height, width=width, count=1, dtype="float32",
                       crs=CRS_UTM, transform=dst_tr, nodata=-9999) as d:
        d.write(dst, 1)
    return p


def hidrologia(mdt: Path, out: Path, hidro_utm: gpd.GeoDataFrame) -> dict:
    wbt = whitebox.WhiteboxTools(); wbt.set_verbose_mode(False)
    erros: list[str] = []
    wbt.default_callback = lambda m: erros.append(m) if "rror" in m else None

    def run(nome: str, *a, **k) -> None:
        if getattr(wbt, nome)(*a, **k) != 0 or erros:
            sys.exit(f"WhiteboxTools {nome} falhou: {' | '.join(erros) or 'código != 0'}")
    f = {k: str(out / f"{k}.tif") for k in
         ["burn", "breach", "cond", "fill", "d8", "acc", "fino", "strahler", "slope"]}
    # queima a hidrografia mapeada para o fluxo da várzea achar o rio certo
    rios = str(out / "hidro_utm.shp")
    hidro_utm[["geometry"]].explode(index_parts=False).to_file(rios)
    run("fill_burn", str(mdt), rios, f["burn"])
    # breach deforma menos; o fill com fix_flats depois só resolve os planos que sobram
    run("breach_depressions_least_cost", f["burn"], f["breach"], dist=100, fill=True)
    run("fill_depressions", f["breach"], f["cond"], fix_flats=True)
    run("fill_depressions_wang_and_liu", str(mdt), f["fill"])  # só para o mapa de depressões
    run("d8_pointer", f["cond"], f["d8"])
    run("d8_flow_accumulation", f["d8"], f["acc"], out_type="catchment area", pntr=True)
    run("extract_streams", f["acc"], f["fino"], threshold=LIMIAR_FINO_HA * 1e4)
    run("strahler_stream_order", f["d8"], f["fino"], f["strahler"])
    run("slope", str(mdt), f["slope"], units="percent")
    shp = str(out / "fluxo_raw.shp")
    run("raster_streams_to_vector", f["strahler"], f["d8"], shp)
    f["shp"] = shp
    return f


def amostrar(path: str, pts) -> np.ndarray:
    with rasterio.open(path) as r:
        v = np.array([x[0] for x in r.sample([(p.x, p.y) for p in pts])], dtype="float64")
        return np.where(v == r.nodata, np.nan, v) if r.nodata is not None else v


def vertice_montante(ln, p) -> Point:
    """Vértice da própria linha logo a montante do ponto: fica no centro da célula do canal
    (a linha vem da escada D8 e está orientada montante -> jusante)."""
    d, acum, cs = ln.project(p), 0.0, list(ln.coords)
    for a, b in zip(cs, cs[1:]):
        seg = math.dist(a, b)
        if acum + seg >= d:
            return Point(a)
        acum += seg
    return Point(cs[-2] if len(cs) > 1 else cs[0])


def por_otto(g: gpd.GeoDataFrame, ottos: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Recorta pelas ottobacias e herda Nome_bacia/Cod_otto/Classe/Manancial/Cod_man de cada uma."""
    if g.empty:
        return gpd.GeoDataFrame(columns=[*g.columns, *ATTRS], geometry="geometry", crs=CRS_UTM)
    o = gpd.overlay(g, ottos[[*ATTRS, "geometry"]], how="intersection", keep_geom_type=True)
    return o.explode(index_parts=False).reset_index(drop=True)


def linhas_fluxo(f: dict, ottos: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    g = gpd.read_file(f["shp"]).set_crs(CRS_UTM, allow_override=True)
    g = g[g.geometry.notna() & ~g.geometry.is_empty].explode(index_parts=False).reset_index(drop=True)
    ini = [Point(l.coords[0]) for l in g.geometry]
    fim = [Point(l.coords[-1]) for l in g.geometry]
    a_ini, a_fim = amostrar(f["acc"], ini), amostrar(f["acc"], fim)
    # orienta montante -> jusante (acumulação cresce no sentido do fluxo)
    g["geometry"] = [LineString(l.coords[::-1]) if ai > af else l
                     for l, ai, af in zip(g.geometry, a_ini, a_fim)]
    # checagem: depois de orientar, a acumulação no fim tem de ser >= à do início
    ini2 = amostrar(f["acc"], [Point(l.coords[0]) for l in g.geometry])
    fim2 = amostrar(f["acc"], [Point(l.coords[-1]) for l in g.geometry])
    ok = ~(fim2 < ini2)  # nan (borda do MDT) não conta como erro
    linhas_fluxo.pct_orientadas = round(100 * float(ok.mean()), 2) if len(ok) else None
    # o último vértice cai na célula que RECEBE a água (o rio de ordem maior), então a área
    # do trecho é a do penúltimo vértice; sem isso afluentes curtos herdam a área do tronco
    penult = [Point(l.coords[-2]) if len(l.coords) > 2 else Point(l.coords[0]) for l in g.geometry]
    g["area_contrib_ha"] = np.round(amostrar(f["acc"], penult) / 1e4, 2)
    g["strahler"] = g["STRM_VAL"].astype(int)
    g = por_otto(g[["area_contrib_ha", "strahler", "geometry"]], ottos)
    g = g[g.geom_type == "LineString"].copy()
    g["geometry"] = g.geometry.simplify(SIMPLIFY_M)
    g = g[g.length > 0]
    return g[["area_contrib_ha", "strahler", *ATTRS, "geometry"]].reset_index(drop=True)


def cruzamentos(fluxo, estradas, f) -> gpd.GeoDataFrame:
    vazio = gpd.GeoDataFrame(columns=["area_montante_ha", "declividade_pct", *ATTRS, "geometry"],
                             geometry="geometry", crs=CRS_UTM)
    if fluxo.empty or estradas.empty:
        return vazio
    rows = []
    i_fl, i_es = estradas.sindex.query(fluxo.geometry, predicate="intersects")
    for a, b in zip(i_fl, i_es):
        ln = fluxo.iloc[a]
        inter = ln.geometry.intersection(estradas.geometry.iloc[b])
        for p in getattr(inter, "geoms", [inter]):
            if p.geom_type == "Point":
                rows.append({**{k: ln[k] for k in ATTRS}, "_v": vertice_montante(ln.geometry, p), "geometry": p})
    if not rows:
        return vazio
    c = gpd.GeoDataFrame(rows, crs=CRS_UTM)
    # área drenada NO ponto do cruzamento, não no fim do trecho (evita falso ponto crítico perto da nascente)
    c["area_montante_ha"] = np.round(amostrar(f["acc"], c["_v"]) / 1e4, 2)
    c = c.drop(columns="_v")
    c = c[c["area_montante_ha"] >= LIMIAR_CRUZ_HA]
    if c.empty:
        return vazio
    # o mesmo cruzamento aparece em linhas contíguas: mantém o de maior área a montante
    c["_k"] = [(round(p.x / RES), round(p.y / RES)) for p in c.geometry]
    c = c.sort_values("area_montante_ha", ascending=False).drop_duplicates("_k").drop(columns="_k")
    c["declividade_pct"] = np.round(amostrar(f["slope"], c.geometry), 1)
    return c[["area_montante_ha", "declividade_pct", *ATTRS, "geometry"]].reset_index(drop=True)


def depressoes(mdt: Path, f: dict, ottos: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    with rasterio.open(mdt) as a, rasterio.open(f["fill"]) as b:
        diff, tr = b.read(1) - a.read(1), a.transform
    mask = (diff > DEPR_MIN_M).astype("uint8")
    geoms = [shape(s) for s, v in shapes(mask, mask=mask.astype(bool), transform=tr) if v == 1]
    d = por_otto(gpd.GeoDataFrame(geometry=geoms, crs=CRS_UTM), ottos)
    if d.empty:
        return d
    d["area_ha"] = np.round(d.area / 1e4, 2)
    d = d[d.area_ha >= DEPR_MIN_HA].copy()
    d = d.reset_index(drop=True)
    rot = rasterio.features.rasterize(((g, i + 1) for i, g in enumerate(d.geometry)),
                                      out_shape=diff.shape, transform=tr, fill=0, dtype="int32")
    prof = np.zeros(len(d) + 1)
    np.maximum.at(prof, rot.ravel(), np.where(diff > 0, diff, 0).ravel())
    # sobra de recorte sem centro de célula fica 0 em vez de quebrar com array vazio
    d["prof_max_m"] = np.round(prof[1:], 2)
    return d[["area_ha", "prof_max_m", *ATTRS, "geometry"]].reset_index(drop=True)


def gravar(gdf: gpd.GeoDataFrame, nome: str) -> list[Path]:
    """Grava data/<nome>.geojson_part-NNN.gz em EPSG:4674, cada parte abaixo de MAX_PARTE_MB."""
    for velho in DATA.glob(f"{nome}.geojson_part-*.gz"):
        velho.unlink()
    obj = json.loads(gdf.to_crs(CRS_GEO).to_json(drop_id=True, ensure_ascii=False, to_wgs84=False))
    # 6 casas (~0,1 m) bastam e reduzem o peso
    def rnd(c):
        return [rnd(x) for x in c] if isinstance(c[0], list) else [round(c[0], 6), round(c[1], 6)]
    feats = []
    for ft in obj["features"]:
        ft["geometry"]["coordinates"] = rnd(ft["geometry"]["coordinates"])
        feats.append(json.dumps(ft, ensure_ascii=False, separators=(",", ":")))
    partes, atual, tam = [], [], 0
    for t in feats:  # corta pelo tamanho bruto; gzip de GeoJSON fica ~4x menor
        if atual and tam + len(t) > MAX_PARTE_MB * 4 * 1e6:
            partes.append(atual); atual, tam = [], 0
        atual.append(t); tam += len(t)
    partes.append(atual)
    arqs = []
    for i, fs in enumerate(partes, 1):
        p = DATA / f"{nome}.geojson_part-{i:03d}.gz"
        with gzip.open(p, "wt", encoding="utf-8") as fh:
            fh.write('{"type":"FeatureCollection","features":[' + ",".join(fs) + "]}")
        assert p.stat().st_size < 20e6, f"{p.name} passou de 20 MB"
        arqs.append(p)
    return arqs


def checagens(bacia_utm, fluxo, hidro_utm, props) -> dict:
    """Checagens do HANDOFF; devolve 'falhas' em vez de abortar o lote inteiro."""
    area = float(bacia_utm.area.sum() / 1e4)
    area_ref = float(bacia_utm["Area_ha"].sum())
    princ = fluxo[fluxo.area_contrib_ha >= LIMIAR_PRINCIPAL_HA]
    perto = princ.geometry.intersection(hidro_utm.buffer(DIST_HIDRO_M).union_all()).length.sum()
    ck = {
        "area_calc_ha": round(area, 1), "area_ref_ha": round(area_ref, 1),
        "area_ok": abs(area - area_ref) / area_ref <= 0.02,
        "todas_linhas_com_cod_man": bool(fluxo["Cod_man"].notna().all()),
        "rede_principal_km": round(princ.length.sum() / 1e3, 1),
        "hidrografia_km": round(hidro_utm.length.sum() / 1e3, 1),
        "pct_rede_principal_ate_60m_da_hidrografia": round(100 * perto / princ.length.sum(), 1) if len(princ) else None,
        "utf8_manancial": props["Manancial"],
    }
    ck["todas_linhas_com_cod_otto"] = bool(fluxo["Cod_otto"].notna().all())
    ck["pct_linhas_orientadas_montante_jusante"] = getattr(linhas_fluxo, "pct_orientadas", None)
    ck["cod_otto_validos"] = bool(set(fluxo["Cod_otto"].astype(str)) <= set(bacia_utm["Cod_otto"].astype(str)))
    # Area_ha da fonte diverge do próprio polígono em ~20 mananciais (polígono menor, válido, sem buracos;
    # igual em baciasselecionadas e microbacias). Processamos o polígono inteiro: é aviso de dado, não falha.
    ck["avisos"] = [] if ck["area_ok"] else [f"Area_ha da fonte ({area_ref:.0f}) difere do polígono ({area:.0f} ha)"]
    ck["falhas"] = [k for k, ok in [("cod_man", ck["todas_linhas_com_cod_man"]),
                                    ("cod_otto", ck["todas_linhas_com_cod_otto"]),
                                    ("utf8", "�" not in props["Manancial"]),
                                    ("cod_otto_invalido", ck["cod_otto_validos"]),
                                    ("orientacao", (ck["pct_linhas_orientadas_montante_jusante"] or 0) >= 99),
                                    ("sem_linhas", len(fluxo) > 0)] if not ok]
    return ck


def processar(cod: str, ottos_geo: gpd.GeoDataFrame, camadas: dict, fonte: str) -> tuple:
    sel = ottos_geo[ottos_geo["Cod_man"].astype(str) == cod]
    ottos = sel.to_crs(CRS_UTM)
    props = {k: sel.iloc[0][k] for k in ATTRS}
    out = REPO / "saida" / f"{cod}_{slug(props['Manancial'])}" / "escoamento"
    shutil.rmtree(out, ignore_errors=True)  # nada de intermediário velho de rodada anterior
    out.mkdir(parents=True)
    do_man = lambda g: g[g["Cod_man"].astype(str) == cod]
    hidro, estradas = do_man(camadas["hidro"]), do_man(camadas["estradas"])
    mdt = baixar_mdt(ottos, out, fonte)
    f = hidrologia(mdt, out, hidro)
    fluxo = linhas_fluxo(f, ottos)
    cruz = cruzamentos(fluxo, estradas, f)
    dep = depressoes(mdt, f, ottos)
    ck = checagens(ottos, fluxo, hidro, props)
    ck.update({"cod_man": cod, "manancial": props["Manancial"], "n_ottos": len(ottos),
               "n_linhas": len(fluxo), "n_cruzamentos": len(cruz), "n_depressoes": len(dep)})
    (out / "checagens.json").write_text(json.dumps(ck, ensure_ascii=False, indent=2), encoding="utf-8")
    return fluxo, cruz, dep, ck


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cod-man", nargs="*", help="um ou mais Cod_man; omitido = todos os mananciais")
    ap.add_argument("--mdt", choices=["anadem", "copernicus"], default="anadem")
    a = ap.parse_args()
    bacias = gpd.read_file(DATA / "baciasselecionadas.geojson").set_crs(CRS_GEO, allow_override=True)
    bacias = bacias.drop_duplicates("Cod_otto")  # Cod_otto 84226511 aparece 2x no arquivo
    cods = a.cod_man or sorted(bacias["Cod_man"].astype(str).unique(), key=int)
    faltando = set(cods) - set(bacias["Cod_man"].astype(str))
    if faltando:
        sys.exit(f"Cod_man não encontrado: {sorted(faltando)}")
    camadas = {"hidro": read_gz_layer("hidrografia__hidrografia_otto").to_crs(CRS_UTM),
               "estradas": read_gz_layer("estradas__estradas_otto").to_crs(CRS_UTM)}

    res, cks, erros = {"fluxo": [], "cruz": [], "dep": []}, [], {}
    for i, cod in enumerate(cods, 1):
        try:
            fluxo, cruz, dep, ck = processar(cod, bacias, camadas, a.mdt)
        except Exception as e:  # um manancial com problema não derruba os outros 45
            erros[cod] = f"{type(e).__name__}: {e}"
            print(f"[{i}/{len(cods)}] Cod_man {cod}: ERRO {erros[cod]}")
            continue
        res["fluxo"].append(fluxo); res["cruz"].append(cruz); res["dep"].append(dep); cks.append(ck)
        print(f"[{i}/{len(cods)}] {cod} {ck['manancial']}: {ck['n_linhas']} linhas, "
              f"{ck['n_cruzamentos']} cruz., {ck['n_depressoes']} depr., "
              f"rede≥{LIMIAR_PRINCIPAL_HA:g}ha a ≤{DIST_HIDRO_M}m da hidro: "
              f"{ck['pct_rede_principal_ate_60m_da_hidrografia']}% {'FALHAS ' + str(ck['falhas']) if ck['falhas'] else ''}")

    junta = lambda l: gpd.GeoDataFrame(pd.concat([x for x in l if not x.empty], ignore_index=True), crs=CRS_UTM)
    arqs = [*gravar(junta(res["fluxo"]), "escoamento__fluxo"),
            *gravar(junta(res["cruz"]), "escoamento__cruzamentos_estrada"),
            *gravar(junta(res["dep"]), "escoamento__depressoes")]
    resumo = {"mdt": a.mdt, "mananciais_ok": len(cks), "erros": erros,
              "com_falhas": {c["cod_man"]: c["falhas"] for c in cks if c["falhas"]},
              "com_avisos": {c["cod_man"]: c["avisos"] for c in cks if c["avisos"]},
              "arquivos_kb": {p.name: round(p.stat().st_size / 1024, 1) for p in arqs},
              "por_manancial": cks}
    (REPO / "saida" / "escoamento_checagens.json").write_text(
        json.dumps(resumo, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    print(json.dumps({k: v for k, v in resumo.items() if k != "por_manancial"}, ensure_ascii=False, indent=2))
    if erros or resumo["com_falhas"]:
        sys.exit(1)


if __name__ == "__main__":
    main()
