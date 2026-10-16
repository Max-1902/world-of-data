"""
Extract the IMF WEO forecast vintages used by scripts/research/imfCompare.ts from the IMF WEO Macroeconomic Forecasts
Panel Dataset (MFPD), Mendeley Data, doi:10.17632/8dt6xpp6x4.9, CC BY 4.0 — a republication of the IMF's Historical WEO
Forecasts Database (imf.org blocks scripted downloads of the original).

  python3 -m venv .venv && .venv/bin/pip install openpyxl
  curl -L -o WEO_MacroForecasts_Oct_2025.xlsx \
    https://data.mendeley.com/public-files/datasets/8dt6xpp6x4/files/7edf8671-723b-4577-a651-dbaeda7da421/file_downloaded
  .venv/bin/python -I scripts/research/mfpd_extract.py WEO_MacroForecasts_Oct_2025.xlsx research/data/imf-weo/mfpd-oct2025.json
  # every economy (195), with the reviewed IMF-code table:
  .venv/bin/python -I scripts/research/mfpd_extract.py WEO_MacroForecasts_Oct_2025.xlsx research/data/imf-weo/mfpd-oct2025-all.json \
    research/data/imf-weo/imf-codes.json

Changes made (CC BY requires saying so): kept only the 52 economies below (or, given a codes file, every economy in it), horizons h = 1..3, and the GDP-growth and
CPI-inflation columns; keyed by ISO2; values unchanged.
"""
import hashlib
import json
import sys

import openpyxl

EXPECTED_SHA256 = '5a666d397e4a941451f613a243009053dedda57eeb59cf213295c01397d59580'
# ISO2 -> IMF country code (the MFPD's CCode column)
IMF_CODE = {
    'DE': 134, 'FR': 132, 'IT': 136, 'ES': 184, 'GB': 112, 'PL': 964, 'NL': 138, 'BE': 124, 'AT': 122, 'CH': 146,
    'SE': 144, 'NO': 142, 'DK': 128, 'FI': 172, 'IE': 178, 'PT': 182, 'GR': 174, 'CZ': 935, 'SK': 936, 'HU': 944,
    'RO': 968, 'BG': 918, 'HR': 960, 'SI': 961, 'LT': 946, 'LV': 941, 'EE': 939, 'LU': 137, 'IS': 176, 'TR': 186,
    'CN': 924, 'IN': 534, 'JP': 158, 'KR': 542, 'ID': 536, 'VN': 582, 'TH': 578, 'MY': 548, 'PH': 566, 'BD': 513,
    'PK': 564, 'SG': 576, 'LK': 524, 'NP': 558, 'MN': 948, 'KH': 522, 'LA': 544, 'IR': 429, 'IL': 436, 'SA': 456,
    'KZ': 916, 'UZ': 927,
}


def main(src: str, out: str, codes: str | None = None) -> None:
    table = {int(k): v for k, v in json.load(open(codes))['imfCodeToIso2'].items()} if codes else {v: k for k, v in IMF_CODE.items()}
    digest = hashlib.sha256(open(src, 'rb').read()).hexdigest()
    if digest != EXPECTED_SHA256:
        sys.exit(f'sha256 mismatch: {digest}')
    by_code = table
    ws = openpyxl.load_workbook(src, read_only=True)['dataset']
    rows = ws.iter_rows(values_only=True)
    col = {name: i for i, name in enumerate(next(rows))}
    data: dict[str, list] = {k: [] for k in by_code.values()}
    for r in rows:
        iso = by_code.get(r[col['CCode']])
        if iso is None or r[col['h']] > 3:
            continue
        data[iso].append([r[col['weo_year']], r[col['exercise']], r[col['year']],
                          r[col['Fngdp_rpc']], r[col['pcpi_pch']], r[col['Rngdp_rpc']], r[col['Rpcpi_pch']]])
    missing = [k for k, v in data.items() if not v]
    if missing:
        sys.exit(f'no rows for {missing}')
    json.dump({
        'source': 'IMF WEO Macroeconomic Forecasts Panel Dataset (MFPD), Mendeley Data, doi:10.17632/8dt6xpp6x4.9',
        'original': 'IMF Historical WEO Forecasts Database',
        'license': 'CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)',
        'file': 'WEO_MacroForecasts_Oct_2025.xlsx', 'sha256': digest,
        'changes': f'subset: {len(data)} economies, h=1..3, GDP growth and CPI inflation only; keyed by ISO2; values unchanged',
        'columns': ['weo_year', 'exercise (1=April, 2=October)', 'target_year', 'forecast_gdp_growth',
                    'forecast_cpi_inflation', 'realised_gdp_growth', 'realised_cpi_inflation'],
        'rows': data,
    }, open(out, 'w'), separators=(',', ':'))
    print(f'{out}: {sum(len(v) for v in data.values())} rows, {len(data)} economies')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
