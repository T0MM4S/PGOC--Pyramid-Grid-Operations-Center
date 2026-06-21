// PGOC · AI Explainer
// Gemini API · NTL anomaly analysis in Albanian
// Requires: VITE_GEMINI_API_KEY in .env

const MODEL   = "gemini-3.5-flash";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

// ── Ethical guardrails (non-negotiable) ───────────────────────────────────
// Every prompt carries this context + output contract, and every response is
// guaranteed to end with the disclaimer — flagged for inspection, never theft.
const DISCLAIMER = "Ky është prioritizim për inspektim, jo konstatim i vjedhjes.";

const KONTEKSTI =
  "KONTEKSTI: Ky sistem identifikon konsumatorë për inspektim bazuar në devijime " +
  "statistikore nga grupi i ngjashëm (peer cohort, e njëjta zonë/m²/kati) dhe nga " +
  "krahasimi vit-pas-viti (YoY). Nuk konfirmon vjedhje — vetëm prioritizon hetimin.";

const RREGULLAT =
  "RREGULLAT E DETYRUESHME PËR OUTPUTIN:\n" +
  '- Përdor gjithmonë "i dyshuar" / "për inspektim" — kurrë "vjedhje e konfirmuar".\n' +
  "- Listo mundësi alternative (banesë boshe, panele diellore, ndryshim familjeje, defekt matësi).\n" +
  "- Jep një hap konkret për inspektorin.\n" +
  `- Përfundo me: "${DISCLAIMER}"`;

function ensureDisclaimer(text) {
  if (!text) return text;
  return text.includes(DISCLAIMER) ? text : `${text.trim()}\n${DISCLAIMER}`;
}

function fmt(n) {
  return Math.round(n).toLocaleString();
}

async function callGemini(prompt, maxOutputTokens = 800) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) return { success: false, error: "VITE_GEMINI_API_KEY not set in .env" };

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type":   "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens,
          temperature: 0.3,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    const candidate  = data.candidates?.[0];
    const text       = candidate?.content?.parts?.map(p => p.text || "").join("").trim() || "";
    const truncated  = candidate?.finishReason === "MAX_TOKENS";

    return { success: true, text, truncated };
  } catch (err) {
    console.error("[AI] Gemini:", err);
    return { success: false, error: err.message };
  }
}
// ── Single node anomaly explanation ──────────────────────
export async function explainAnomaly(nodeData, nodeTitle) {
  const dir     = nodeData.deviationPct > 0 ? "nën baseline" : "mbi baseline";
  const pct     = Math.abs(Math.round(nodeData.deviationPct));
  const factors = nodeData.riskFactors?.join(" · ") || "N/A";
  const yoy     = typeof nodeData.yoyPct === "number"
    ? `${nodeData.yoyPct > 0 ? "+" : ""}${Math.round(nodeData.yoyPct)}% YoY` : "n/a";
  const persist = typeof nodeData.persistence === "number"
    ? `${nodeData.persistence} muaj radhazi nën baseline` : "n/a";
  const loss    = typeof nodeData.estLossLek === "number" ? `${fmt(nodeData.estLossLek)} LEK/vit` : "n/a";

  const prompt = `Jeni analist NTL i OSHEE Albania. Shkruani në SHQIP.

${KONTEKSTI}

ZONA: ${nodeTitle}${nodeData.worstCustomerName ? ` | Matësi kryesor: ${nodeData.worstCustomerName}` : ""}
RISK SCORE: ${nodeData.riskScore}/100 | NIVEL: ${nodeData.riskLevel} (urgjenca e inspektimit)
ANOMALI: ${nodeData.anomalyType.replace(/_/g, " ")}
KONSUM RAPORTUAR: ${nodeData.consumptionKwh} kWh | PRITUR (peer): ${nodeData.expectedKwh} kWh
DEVIJIM: ${pct}% ${dir} | KRAHASIM VITI I KALUAR: ${yoy} | PERSISTENCA: ${persist}
HUMBJE E VLERËSUAR: ${loss} | INSPEKTIM: ${nodeData.inspectionStatus.replace(/_/g, " ")}
FAKTORË: ${factors}

Rregulla:
- Çdo pikë: maksimumi 2 fjali (≈40 fjalë totale për pikë).
- Mos përsërit të dhënat e tabelës; interpreto vetëm.

Jepni analizën si 4 pika të numëruara (pa tituj, vetëm numrin dhe tekstin):
1. Çfarë po ndodh konkretisht me këtë konsumator (përfshi devijimin nga fqinjët dhe ndryshimin YoY)
2. Mundësi alternative jo-vjedhje që duhen përjashtuar gjatë inspektimit
3. Humbja financiare e vlerësuar (përdor figurën e dhënë) dhe pse ka rëndësi
4. Hapi konkret i radhës për inspektorin

${RREGULLAT}`;

  const res = await callGemini(prompt, 1200);
  return res.success ? { ...res, text: ensureDisclaimer(res.text) } : res;
}

// ── Peer comparison ───────────────────────────────────────
export async function compareWithPeers(nodeData, nodeTitle, allNodeStates) {
  const peers = Object.entries(allNodeStates)
    .filter(([id]) => id !== nodeData.id)
    .sort((a, b) => a[1].riskScore - b[1].riskScore)
    .slice(0, 3)
    .map(([, s]) => `${s.consumptionKwh} kWh (Risk ${s.riskScore})`);

  const prompt = `Jeni analist NTL i OSHEE Albania. Shkruani në SHQIP.

${KONTEKSTI}

KLIENTI I DYSHUAR PËR INSPEKTIM: ${nodeTitle} — ${nodeData.consumptionKwh} kWh (devijim ${Math.abs(Math.round(nodeData.deviationPct))}%)
KONSUMATORË REFERENCË: ${peers.join(" | ")}

Jepni 3 pika të numëruara (pa tituj):
1. Ku pozicionohet ky klient brenda grupit
2. Çfarë sugjeron diferenca në shifra konkrete (dhe një mundësi alternative jo-vjedhje)
3. Prioriteti i inspektimit dhe hapi konkret

${RREGULLAT}`;

  const res = await callGemini(prompt, 800);
  return res.success ? { ...res, text: ensureDisclaimer(res.text) } : res;
}

// ── Peer group / cohort zone analysis ────────────────────
// `customers` may be the pre-computed enriched cohort (real expected/deviation/
// YoY/loss) or the static roster — we use real fields when present.
export async function analyzePeerGroup(nodeTitle, customers, expectedPerSqm) {
  const rates = expectedPerSqm || {};
  const expectedOf = (c) => typeof c.expectedKwh === "number"
    ? Math.round(c.expectedKwh) : Math.round(c.sqMeters * (rates[c.type] || 2.1));
  const devOf = (c) => typeof c.deviationPct === "number"
    ? Math.round(c.deviationPct) : Math.round(((expectedOf(c) - c.monthlyKwh) / expectedOf(c)) * 100);
  const lossOf = (c) => typeof c.estLossLek === "number"
    ? c.estLossLek : Math.round(Math.max(0, expectedOf(c) - c.monthlyKwh) * 14.2 * 12);

  const rows = customers.map((c, i) => {
    const exp    = expectedOf(c);
    const dev    = devOf(c);
    const devStr = dev > 0 ? `-${dev}%` : `+${Math.abs(dev)}%`;
    const yoy    = typeof c.yoyPct === "number" ? ` | YoY ${c.yoyPct > 0 ? "+" : ""}${Math.round(c.yoyPct)}%` : "";
    const loss   = dev > 25 ? `${fmt(lossOf(c))} LEK/vit` : "normale";
    const cleared = c.inspectionStatus === "FALSE_POSITIVE" ? " | (PASTRUAR nga inspektimi)" : "";
    return `${i + 1}. ${c.name} | ${c.sqMeters}m² ${c.type} Kati ${c.floor} | Raportuar: ${Math.round(c.monthlyKwh)} kWh | Pritur (peer): ${exp} kWh | Devijim: ${devStr}${yoy} | Humbje: ${loss}${cleared}`;
  }).join("\n");

  const suspects = customers
    .filter(c => c.inspectionStatus !== "FALSE_POSITIVE" &&
      (devOf(c) > 30 || c.riskLevel === "HIGH" || c.riskLevel === "CRITICAL"))
    .map(c => c.name)
    .join(", ") || "Asnjë";

  const prompt = `Jeni analist NTL i OSHEE Albania. Shkruani VETËM në SHQIP.

${KONTEKSTI}

ZONA: ${nodeTitle}
KONSUMATORËT (Pritur = mesatarja e fqinjëve me m² të ngjashme):
${rows}
TË DYSHUAR PËR INSPEKTIM (devijim >30% nga grupi): ${suspects}

Jepni analizën si 5 pika të numëruara (shkruani vetëm numrin dhe tekstin, pa tituj, pa rreshta boshe):
1. Norma mesatare e konsumit për këtë grup dhe cilët janë brenda normës
2. Cilët konsumatorë janë të dyshuar dhe pse — krahasim direkt me fqinjë me sipërfaqe të ngjashme, përfshi YoY
3. Humbja financiare totale: mblidh figurat "Humbje" të dhëna më sipër (tarifë sezonale, jo e sheshtë)
4. Prioriteti i inspektimit — URGJENT / MESËM / I ULËT dhe arsyeja konkrete
5. Hapi i parë specifik për inspektorin: adresa, çfarë të kontrollojë dhe kur

${RREGULLAT}`;

  const res = await callGemini(prompt, 2048);
  return res.success ? { ...res, text: ensureDisclaimer(res.text) } : res;
}

// ── Peer-cohort comparison stats for a single consumer ────────────────────
// Compares the consumer against same-type neighbours (falls back to the whole
// zone cohort) and returns a compact summary + a structured object for the UI.
export function buildPeerComparison(c, cohort) {
  const list = Array.isArray(cohort) ? cohort.filter((p) => p && p.id !== c.id) : [];
  if (!list.length) return null;
  let peers = list.filter((p) => p.type === c.type);
  if (peers.length < 2) peers = list; // not enough same-type → use full cohort

  const avg = (arr, sel) => arr.reduce((s, p) => s + (Number(sel(p)) || 0), 0) / arr.length;
  const avgReported = avg(peers, (p) => p.monthlyKwh);
  const avgExpected = avg(peers, (p) => p.expectedKwh);

  // Rank by deviation (1 = largest under-reporting) across the full cohort.
  const devOf = (p) => (typeof p.deviationPct === "number" ? p.deviationPct : -Infinity);
  const ranked = [...list, c].sort((a, b) => devOf(b) - devOf(a));
  const rank = ranked.findIndex((p) => p.id === c.id) + 1;

  const repVsPeer = avgReported > 0 ? Math.round(((c.monthlyKwh - avgReported) / avgReported) * 100) : 0;

  return {
    peerCount: peers.length,
    cohortCount: list.length + 1,
    avgReported: Math.round(avgReported),
    avgExpected: Math.round(avgExpected),
    consumerReported: Math.round(c.monthlyKwh || 0),
    repVsPeerPct: repVsPeer, // negative → consumer reports less than peers
    rank,
  };
}

// ── Single-consumer 2-year report (used by the Analytics "Report" modal) ──
// Summarizes the consumer's 24-month series + a peer-cohort comparison and asks
// for an Albanian verdict (suspect / not) with reasons + an inspector next-step.
export async function explainConsumerReport(c, cohort) {
  const months = Array.isArray(c.history_months) ? c.history_months.slice(-24) : [];
  const rep    = Array.isArray(c.history_kwh) ? c.history_kwh.slice(-24) : [];
  const exp    = Array.isArray(c.expected_kwh_series) ? c.expected_kwh_series.slice(-24) : [];

  const series = months.map((m, i) => {
    const r = Math.round(rep[i] ?? 0);
    const e = Math.round(exp[i] ?? 0);
    const d = e > 0 ? Math.round(((e - r) / e) * 100) : 0;
    const ds = d > 0 ? `-${d}%` : `+${Math.abs(d)}%`;
    return `${m}: rap ${r} / prit ${e} kWh (${ds})`;
  }).join("\n");

  const dev   = typeof c.deviationPct === "number"
    ? (c.deviationPct > 0 ? `-${Math.round(c.deviationPct)}%` : `+${Math.abs(Math.round(c.deviationPct))}%`) : "n/a";
  const yoy   = typeof c.yoyPct === "number"
    ? `${c.yoyPct > 0 ? "+" : ""}${Math.round(c.yoyPct)}%` : "n/a";
  const zscore = typeof c.peerZscore === "number" ? c.peerZscore.toFixed(2) : "n/a";
  const loss   = typeof c.estLossLek === "number" ? `${fmt(c.estLossLek)} LEK/vit` : "n/a";

  const pc = buildPeerComparison(c, cohort);
  const peerBlock = pc
    ? `KRAHASIMI ME GRUPIN (${pc.peerCount} fqinjë ${c.type}): ` +
      `ky konsumator raporton ${pc.consumerReported} kWh kundrejt mesatares së fqinjëve ${pc.avgReported} kWh ` +
      `(${pc.repVsPeerPct > 0 ? "+" : ""}${pc.repVsPeerPct}% ndaj fqinjëve); pritja mesatare e fqinjëve ${pc.avgExpected} kWh. ` +
      `Renditja sipas devijimit: #${pc.rank} nga ${pc.cohortCount} në zonë.`
    : "KRAHASIMI ME GRUPIN: nuk ka të dhëna të mjaftueshme për fqinjët.";

  const prompt = `Jeni analist NTL i OSHEE Albania. Shkruani VETËM në SHQIP.

${KONTEKSTI}

KONSUMATORI: ${c.name} | ${c.zoneTitle || c.zoneId || ""} | ${c.sqMeters}m² ${c.type} Kati ${c.floor ?? "-"} | Matësi: ${c.id}
RISK SCORE: ${c.riskScore}/100 | NIVEL: ${c.riskLevel} (urgjenca e inspektimit)
ANOMALI: ${(c.anomalyType || "NONE").replace(/_/g, " ")} | INSPEKTIM: ${(c.inspectionStatus || "—").replace(/_/g, " ")}
DEVIJIM AKTUAL: ${dev} nga grupi | YoY: ${yoy} | PEER Z-SCORE: ${zscore} | HUMBJE: ${loss}
${peerBlock}

HISTORIKU 24-MUJOR (raportuar vs pritur nga peer me m² të ngjashme):
${series}

Jepni një raport të strukturuar si 5 pika të numëruara (vetëm numri dhe teksti, pa tituj, maksimum 2 fjali për pikë):
1. A është ky konsumator i dyshuar për inspektim apo jo — dhe sa fort, bazuar te historiku 24-mujor.
2. KRAHASIMI ME FQINJËT: si qëndron ndaj mesatares së grupit me shifra konkrete (përdor figurat e dhëna më sipër) dhe çfarë tregon kjo.
3. Arsyet specifike nga modeli i konsumit (sezonaliteti, rëniet e papritura, devijimi, YoY).
4. Mundësi alternative jo-vjedhje që duhen përjashtuar (banesë boshe, panele diellore, ndryshim familjeje, defekt matësi).
5. Hapi konkret i radhës për inspektorin.

${RREGULLAT}`;

  const res = await callGemini(prompt, 1600);
  return res.success ? { ...res, text: ensureDisclaimer(res.text) } : res;
}