"""
PGOC pipeline · static configuration
─────────────────────────────────────
Single source of truth for the Python batch pipeline. Mirrors the frontend
roster (src/data/cityNodes.js + src/data/customerData.jsx) so the pre-computed
JSON lines up 1:1 with the React panels.

Nothing here is random — the roster (zones, customers, m², floor, type) is the
demo's fixed structure. The *consumption dynamics* come from the labelled
dataset (see build_dataset.py), and every risk number is computed, not seeded.
"""

from pathlib import Path

# ── Paths ────────────────────────────────────────────────────────────────
ROOT          = Path(__file__).resolve().parent.parent
PIPELINE_DIR  = ROOT / "pipeline"
DATA_IN       = PIPELINE_DIR / "data" / "dataset_130consumers_monthly_2024_2026_with_kWh.csv"
DATA_OUT      = ROOT / "public" / "data"

# How many trailing months drive the animated replay on the map.
REPLAY_MONTHS = 12

# Deterministic donor assignment — same JSON every run.
RANDOM_SEED   = 1453  # Tirana / Kruja, 1453. Reproducible, not meaningful.

# ── Seasonal tariff (LEK / kWh) ──────────────────────────────────────────
# Replaces the old 14.2 LEK/kWh flat rate. Winter peak (heating), summer
# trough — anchored around the OSHEE ~14.2 reference so totals stay realistic.
TARIFF_LEK_PER_KWH = {
    1: 16.5, 2: 16.5, 3: 14.8, 4: 13.2, 5: 12.5, 6: 12.5,
    7: 13.0, 8: 13.0, 9: 13.2, 10: 14.2, 11: 15.4, 12: 16.5,
}

# ── Expected kWh per m² by consumer type (peer-baseline fallback) ─────────
EXPECTED_KWH_PER_SQM = {
    "RESIDENTIAL": 2.1,
    "COMMERCIAL":  4.2,
    "OFFICE":      3.5,
    "PUBLIC":      3.0,
}

# ── Zones (mirror of src/data/cityNodes.js) ──────────────────────────────
ZONES = [
    {"id": "skanderbeg",           "title": "Skanderbeg Square",  "area_type": "MIXED_USE",          "lat": 41.3281, "lon": 19.8187},
    {"id": "national-library",     "title": "National Library",   "area_type": "PUBLIC_INSTITUTION", "lat": 41.3310, "lon": 19.8220},
    {"id": "tirana-tower",         "title": "Tirana Tower",       "area_type": "COMMERCIAL_HIGH",    "lat": 41.3318, "lon": 19.8355},
    {"id": "blloku",               "title": "Blloku District",    "area_type": "MIXED_USE",          "lat": 41.3168, "lon": 19.8165},
    {"id": "rinia-park",           "title": "Rinia Park",         "area_type": "RESIDENTIAL",        "lat": 41.3258, "lon": 19.8178},
    {"id": "air-albania-stadium",  "title": "Air Albania Stadium","area_type": "INFRASTRUCTURE",     "lat": 41.3305, "lon": 19.8318},
    {"id": "artificial-lake",      "title": "Artificial Lake",    "area_type": "RESIDENTIAL",        "lat": 41.3390, "lon": 19.8280},
    {"id": "palace-of-culture",    "title": "Palace of Culture",  "area_type": "PUBLIC_INSTITUTION", "lat": 41.3275, "lon": 19.8195},
    {"id": "tirana-university",    "title": "Tirana University",  "area_type": "PUBLIC_INSTITUTION", "lat": 41.3195, "lon": 19.8175},
    {"id": "tid-tower",            "title": "TID Tower",          "area_type": "COMMERCIAL_HIGH",    "lat": 41.3290, "lon": 19.8240},
    {"id": "grand-park",           "title": "Grand Park",         "area_type": "RESIDENTIAL",        "lat": 41.3135, "lon": 19.8290},
    {"id": "tirana-castle",        "title": "Tirana Castle",      "area_type": "LANDMARK",           "lat": 41.3300, "lon": 19.8180},
    {"id": "mother-teresa-square", "title": "Mother Teresa Sq",   "area_type": "MIXED_USE",          "lat": 41.3262, "lon": 19.8195},
]

ZONE_TITLE = {z["id"]: z["title"] for z in ZONES}

# ── Customers (mirror of src/data/customerData.jsx) ──────────────────────
# `monthlyKwh` is the hand-authored "typical month" used only as the magnitude
# anchor — the real 27-month series (with seasonality + theft signatures) is
# drawn from the labelled dataset and scaled to this anchor in build_dataset.py.
CUSTOMERS = {
    "skanderbeg": [
        {"id": "sk-001", "name": "Erjon Shehu",  "address": "Rruga 4 Shkurtit, Nr.12, Ap.5", "sqMeters": 82,  "floor": 3, "type": "RESIDENTIAL", "monthlyKwh": 174,  "contractedKw": 6,  "meterAge": 5, "building": "sk-12"},
        {"id": "sk-002", "name": "Blerim Koci",   "address": "Rruga 4 Shkurtit, Nr.12, Ap.6", "sqMeters": 84,  "floor": 3, "type": "RESIDENTIAL", "monthlyKwh": 41,   "contractedKw": 6,  "meterAge": 3, "building": "sk-12"},
        {"id": "sk-003", "name": "Anila Marku",   "address": "Rruga 4 Shkurtit, Nr.12, Ap.7", "sqMeters": 80,  "floor": 4, "type": "RESIDENTIAL", "monthlyKwh": 168,  "contractedKw": 6,  "meterAge": 6, "building": "sk-12"},
        {"id": "sk-004", "name": "Fatmir Hoxha",  "address": "Sheshi Skenderbej, Nr.4, Dyqan","sqMeters": 90,  "floor": 1, "type": "COMMERCIAL",  "monthlyKwh": 312,  "contractedKw": 10, "meterAge": 2, "building": "sk-4"},
    ],
    "national-library": [
        {"id": "nl-001", "name": "Mirela Doci",     "address": "Rruga Naim Frasheri, Nr.8, Ap.3",  "sqMeters": 95,  "floor": 2, "type": "RESIDENTIAL", "monthlyKwh": 198, "contractedKw": 6,  "meterAge": 7, "building": "nl-8"},
        {"id": "nl-002", "name": "Sokol Rama",      "address": "Rruga Naim Frasheri, Nr.8, Ap.4",  "sqMeters": 96,  "floor": 2, "type": "RESIDENTIAL", "monthlyKwh": 52,  "contractedKw": 6,  "meterAge": 4, "building": "nl-8"},
        {"id": "nl-003", "name": "Klaudia Berisha", "address": "Rruga Naim Frasheri, Nr.8, Ap.5",  "sqMeters": 92,  "floor": 3, "type": "RESIDENTIAL", "monthlyKwh": 193, "contractedKw": 6,  "meterAge": 5, "building": "nl-8"},
        {"id": "nl-004", "name": "Altin Muca",      "address": "Rruga Naim Frasheri, Nr.10, Zyre", "sqMeters": 110, "floor": 1, "type": "OFFICE",      "monthlyKwh": 378, "contractedKw": 10, "meterAge": 3, "building": "nl-10"},
    ],
    "tirana-tower": [
        {"id": "tt-001", "name": "TiranaCity SH.A.", "address": "Rr. Deshmoret e Kombit, Kati 8", "sqMeters": 240, "floor": 8, "type": "OFFICE",     "monthlyKwh": 820,  "contractedKw": 40, "meterAge": 3, "building": "tt"},
        {"id": "tt-002", "name": "Alban Gjoka",      "address": "Rr. Deshmoret e Kombit, Kati 7", "sqMeters": 235, "floor": 7, "type": "OFFICE",     "monthlyKwh": 188,  "contractedKw": 40, "meterAge": 2, "building": "tt"},
        {"id": "tt-003", "name": "Adriana SH.P.K.",  "address": "Rr. Deshmoret e Kombit, Kati 5", "sqMeters": 250, "floor": 5, "type": "COMMERCIAL", "monthlyKwh": 1085, "contractedKw": 50, "meterAge": 4, "building": "tt"},
        {"id": "tt-004", "name": "Besnik Zeka",      "address": "Rr. Deshmoret e Kombit, Kati 6", "sqMeters": 228, "floor": 6, "type": "OFFICE",     "monthlyKwh": 795,  "contractedKw": 40, "meterAge": 5, "building": "tt"},
    ],
    "blloku": [
        {"id": "bl-001", "name": "Lindita Vora",       "address": "Rruga Pjeter Bogdani, Nr.5, Ap.8",  "sqMeters": 110, "floor": 4, "type": "RESIDENTIAL", "monthlyKwh": 228, "contractedKw": 9,  "meterAge": 4, "building": "bl-5"},
        {"id": "bl-002", "name": "Gentiana Lika",      "address": "Rruga Pjeter Bogdani, Nr.5, Ap.9",  "sqMeters": 112, "floor": 4, "type": "RESIDENTIAL", "monthlyKwh": 59,  "contractedKw": 9,  "meterAge": 2, "building": "bl-5"},
        {"id": "bl-003", "name": "Endrit Myftiu",      "address": "Rruga Pjeter Bogdani, Nr.5, Ap.10", "sqMeters": 105, "floor": 5, "type": "RESIDENTIAL", "monthlyKwh": 220, "contractedKw": 9,  "meterAge": 6, "building": "bl-5"},
        {"id": "bl-004", "name": "Blloku Bar SH.P.K.", "address": "Rruga Ismail Qemali, Nr.12",        "sqMeters": 180, "floor": 1, "type": "COMMERCIAL",  "monthlyKwh": 738, "contractedKw": 25, "meterAge": 3, "building": "bl-12"},
    ],
    "rinia-park": [
        {"id": "rp-001", "name": "Agron Topi",    "address": "Rruga Abdyl Frasheri, Nr.3, Ap.2", "sqMeters": 74, "floor": 2, "type": "RESIDENTIAL", "monthlyKwh": 154, "contractedKw": 6, "meterAge": 8, "building": "rp-3"},
        {"id": "rp-002", "name": "Donika Haxhiu", "address": "Rruga Abdyl Frasheri, Nr.3, Ap.3", "sqMeters": 76, "floor": 2, "type": "RESIDENTIAL", "monthlyKwh": 159, "contractedKw": 6, "meterAge": 5, "building": "rp-3"},
        {"id": "rp-003", "name": "Ilir Sefa",     "address": "Rruga Abdyl Frasheri, Nr.3, Ap.4", "sqMeters": 72, "floor": 3, "type": "RESIDENTIAL", "monthlyKwh": 38,  "contractedKw": 6, "meterAge": 4, "building": "rp-3"},
    ],
    "air-albania-stadium": [
        {"id": "aa-001", "name": "Stadium Zone SH.A.", "address": "Rruga Sami Frasheri, Kompleks",    "sqMeters": 320, "floor": 1, "type": "COMMERCIAL",  "monthlyKwh": 1380, "contractedKw": 80, "meterAge": 2, "building": "aa-k"},
        {"id": "aa-002", "name": "Klejda Marku",       "address": "Rruga Sami Frasheri, Nr.6, Ap.3",  "sqMeters": 78,  "floor": 2, "type": "RESIDENTIAL", "monthlyKwh": 162,  "contractedKw": 6,  "meterAge": 6, "building": "aa-6"},
        {"id": "aa-003", "name": "Mentor Bici",        "address": "Rruga Sami Frasheri, Nr.6, Ap.4",  "sqMeters": 80,  "floor": 2, "type": "RESIDENTIAL", "monthlyKwh": 45,   "contractedKw": 6,  "meterAge": 3, "building": "aa-6"},
        {"id": "aa-004", "name": "Sport Shop SH.P.K.", "address": "Rruga Sami Frasheri, Nr.8, Dyqan", "sqMeters": 145, "floor": 1, "type": "COMMERCIAL",  "monthlyKwh": 595,  "contractedKw": 20, "meterAge": 4, "building": "aa-8"},
    ],
    "artificial-lake": [
        {"id": "al-001", "name": "Nora Basha",    "address": "Rruga Liqeni Artificial, Nr.2, Ap.5", "sqMeters": 68, "floor": 3, "type": "RESIDENTIAL", "monthlyKwh": 141, "contractedKw": 6, "meterAge": 9, "building": "al-2"},
        {"id": "al-002", "name": "Olta Duka",     "address": "Rruga Liqeni Artificial, Nr.2, Ap.6", "sqMeters": 70, "floor": 3, "type": "RESIDENTIAL", "monthlyKwh": 35,  "contractedKw": 6, "meterAge": 4, "building": "al-2"},
        {"id": "al-003", "name": "Pranvera Cela", "address": "Rruga Liqeni Artificial, Nr.2, Ap.7", "sqMeters": 66, "floor": 4, "type": "RESIDENTIAL", "monthlyKwh": 138, "contractedKw": 6, "meterAge": 6, "building": "al-2"},
    ],
    "palace-of-culture": [
        {"id": "pc-001", "name": "Rezart Gjini",    "address": "Sheshi Skenderbej, Pallati Kultures, Ap.1", "sqMeters": 88, "floor": 2, "type": "RESIDENTIAL", "monthlyKwh": 183, "contractedKw": 6, "meterAge": 7, "building": "pc-1"},
        {"id": "pc-002", "name": "Shpresa Kola",    "address": "Sheshi Skenderbej, Pallati Kultures, Ap.2", "sqMeters": 90, "floor": 2, "type": "RESIDENTIAL", "monthlyKwh": 47,  "contractedKw": 6, "meterAge": 3, "building": "pc-1"},
        {"id": "pc-003", "name": "Taulant Myftari", "address": "Sheshi Skenderbej, Pallati Kultures, Ap.3", "sqMeters": 86, "floor": 3, "type": "RESIDENTIAL", "monthlyKwh": 180, "contractedKw": 6, "meterAge": 5, "building": "pc-1"},
    ],
    "tirana-university": [
        {"id": "tu-001", "name": "Universiteti UT", "address": "Sheshi Nene Tereza, Godina Kryesore", "sqMeters": 480, "floor": 1, "type": "PUBLIC",      "monthlyKwh": 1440, "contractedKw": 100, "meterAge": 8, "building": "tu-g"},
        {"id": "tu-002", "name": "Valbona Xhafa",   "address": "Rruga Elbasanit, Nr.3, Ap.4",         "sqMeters": 88,  "floor": 2, "type": "RESIDENTIAL", "monthlyKwh": 182,  "contractedKw": 6,   "meterAge": 5, "building": "tu-3"},
        {"id": "tu-003", "name": "Xhensila Puka",   "address": "Rruga Elbasanit, Nr.3, Ap.5",         "sqMeters": 90,  "floor": 2, "type": "RESIDENTIAL", "monthlyKwh": 43,   "contractedKw": 6,   "meterAge": 2, "building": "tu-3"},
        {"id": "tu-004", "name": "Ylli Kopaci",     "address": "Rruga Elbasanit, Nr.3, Ap.6",         "sqMeters": 85,  "floor": 3, "type": "RESIDENTIAL", "monthlyKwh": 178,  "contractedKw": 6,   "meterAge": 4, "building": "tu-3"},
    ],
    "tid-tower": [
        {"id": "tid-001", "name": "TID Offices SH.A.", "address": "Bulevardi Gjergj Fishta, Kati 12", "sqMeters": 380, "floor": 12, "type": "OFFICE",     "monthlyKwh": 1292, "contractedKw": 80, "meterAge": 3, "building": "tid"},
        {"id": "tid-002", "name": "Arben Laci",        "address": "Bulevardi Gjergj Fishta, Kati 8",  "sqMeters": 260, "floor": 8,  "type": "OFFICE",     "monthlyKwh": 874,  "contractedKw": 50, "meterAge": 5, "building": "tid"},
        {"id": "tid-003", "name": "Blerina Gjoka",     "address": "Bulevardi Gjergj Fishta, Kati 9",  "sqMeters": 265, "floor": 9,  "type": "OFFICE",     "monthlyKwh": 201,  "contractedKw": 50, "meterAge": 2, "building": "tid"},
        {"id": "tid-004", "name": "Nexus Tech SH.P.K.","address": "Bulevardi Gjergj Fishta, Kati 6",  "sqMeters": 290, "floor": 6,  "type": "COMMERCIAL", "monthlyKwh": 1218, "contractedKw": 60, "meterAge": 4, "building": "tid"},
    ],
    "grand-park": [
        {"id": "gp-001", "name": "Elton Hyseni", "address": "Rruga Parkut te Madh, Nr.1, Ap.3", "sqMeters": 65, "floor": 2, "type": "RESIDENTIAL", "monthlyKwh": 135, "contractedKw": 6, "meterAge": 7, "building": "gp-1"},
        {"id": "gp-002", "name": "Fatmira Keci", "address": "Rruga Parkut te Madh, Nr.1, Ap.4", "sqMeters": 67, "floor": 2, "type": "RESIDENTIAL", "monthlyKwh": 140, "contractedKw": 6, "meterAge": 5, "building": "gp-1"},
        {"id": "gp-003", "name": "Genci Molla",  "address": "Rruga Parkut te Madh, Nr.1, Ap.5", "sqMeters": 64, "floor": 3, "type": "RESIDENTIAL", "monthlyKwh": 33,  "contractedKw": 6, "meterAge": 3, "building": "gp-1"},
    ],
    "tirana-castle": [
        {"id": "tc-001", "name": "Hamit Kraja",       "address": "Rruga Muratit, Nr.5, Ap.2", "sqMeters": 72,  "floor": 2, "type": "RESIDENTIAL", "monthlyKwh": 150, "contractedKw": 6,  "meterAge": 10, "building": "tc-5"},
        {"id": "tc-002", "name": "Ismeta Dervishi",   "address": "Rruga Muratit, Nr.5, Ap.3", "sqMeters": 74,  "floor": 2, "type": "RESIDENTIAL", "monthlyKwh": 38,  "contractedKw": 6,  "meterAge": 4,  "building": "tc-5"},
        {"id": "tc-003", "name": "Jola Malaj",        "address": "Rruga Muratit, Nr.5, Ap.4", "sqMeters": 70,  "floor": 3, "type": "RESIDENTIAL", "monthlyKwh": 147, "contractedKw": 6,  "meterAge": 7,  "building": "tc-5"},
        {"id": "tc-004", "name": "Kaltra Restaurant", "address": "Rruga e Kalase, Nr.3",      "sqMeters": 165, "floor": 1, "type": "COMMERCIAL",  "monthlyKwh": 680, "contractedKw": 25, "meterAge": 5,  "building": "tc-3"},
    ],
    "mother-teresa-square": [
        {"id": "mt-001", "name": "Ledjo Prendi",        "address": "Sheshi Nene Tereza, Nr.2, Ap.5", "sqMeters": 95,  "floor": 3, "type": "RESIDENTIAL", "monthlyKwh": 198, "contractedKw": 6,  "meterAge": 6, "building": "mt-2"},
        {"id": "mt-002", "name": "Marsela Qosja",       "address": "Sheshi Nene Tereza, Nr.2, Ap.6", "sqMeters": 97,  "floor": 3, "type": "RESIDENTIAL", "monthlyKwh": 49,  "contractedKw": 6,  "meterAge": 3, "building": "mt-2"},
        {"id": "mt-003", "name": "Ndricim Hysa",        "address": "Sheshi Nene Tereza, Nr.2, Ap.7", "sqMeters": 92,  "floor": 4, "type": "RESIDENTIAL", "monthlyKwh": 193, "contractedKw": 6,  "meterAge": 8, "building": "mt-2"},
        {"id": "mt-004", "name": "Teresa Cafe SH.P.K.", "address": "Sheshi Nene Tereza, Nr.4",       "sqMeters": 120, "floor": 1, "type": "COMMERCIAL",  "monthlyKwh": 492, "contractedKw": 20, "meterAge": 4, "building": "mt-4"},
    ],
}
