// ── Customer data per city node ───────────────────────────
// Each node = a neighborhood zone with 3-4 real customers.
// Suspicious customers are seeded with abnormally low consumption
// relative to identical neighbors (same building, same sqm, same floor).

export const EXPECTED_KWH_PER_SQM = {
  RESIDENTIAL: 2.1,
  COMMERCIAL:  4.2,
  OFFICE:      3.5,
  PUBLIC:      3.0,
};

export const customerData = {

  "skanderbeg": [
    { id:"sk-001", name:"Erjon Shehu",    address:"Rruga 4 Shkurtit, Nr.12, Ap.5", sqMeters:82,  floor:3, type:"RESIDENTIAL", monthlyKwh:174,  contractedKw:6,   meterAge:5 },
    { id:"sk-002", name:"Blerim Koci",    address:"Rruga 4 Shkurtit, Nr.12, Ap.6", sqMeters:84,  floor:3, type:"RESIDENTIAL", monthlyKwh:41,   contractedKw:6,   meterAge:3 },
    { id:"sk-003", name:"Anila Marku",    address:"Rruga 4 Shkurtit, Nr.12, Ap.7", sqMeters:80,  floor:4, type:"RESIDENTIAL", monthlyKwh:168,  contractedKw:6,   meterAge:6 },
    { id:"sk-004", name:"Fatmir Hoxha",   address:"Sheshi Skënderbej, Nr.4, Dyqan",sqMeters:90,  floor:1, type:"COMMERCIAL",  monthlyKwh:312,  contractedKw:10,  meterAge:2 },
  ],

  "national-library": [
    { id:"nl-001", name:"Mirela Doci",     address:"Rruga Naim Frashëri, Nr.8, Ap.3", sqMeters:95,  floor:2, type:"RESIDENTIAL", monthlyKwh:198, contractedKw:6,  meterAge:7 },
    { id:"nl-002", name:"Sokol Rama",      address:"Rruga Naim Frashëri, Nr.8, Ap.4", sqMeters:96,  floor:2, type:"RESIDENTIAL", monthlyKwh:52,  contractedKw:6,  meterAge:4 },
    { id:"nl-003", name:"Klaudia Berisha", address:"Rruga Naim Frashëri, Nr.8, Ap.5", sqMeters:92,  floor:3, type:"RESIDENTIAL", monthlyKwh:193, contractedKw:6,  meterAge:5 },
    { id:"nl-004", name:"Altin Muça",      address:"Rruga Naim Frashëri, Nr.10, Zyrë",sqMeters:110, floor:1, type:"OFFICE",      monthlyKwh:378, contractedKw:10, meterAge:3 },
  ],

  "tirana-tower": [
    { id:"tt-001", name:"TiranaCity SH.A.", address:"Rr. Dëshmorët e Kombit, Kati 8", sqMeters:240, floor:8, type:"OFFICE",     monthlyKwh:820,  contractedKw:40, meterAge:3 },
    { id:"tt-002", name:"Alban Gjoka",      address:"Rr. Dëshmorët e Kombit, Kati 7", sqMeters:235, floor:7, type:"OFFICE",     monthlyKwh:188,  contractedKw:40, meterAge:2 },
    { id:"tt-003", name:"Adriana SH.P.K.", address:"Rr. Dëshmorët e Kombit, Kati 5", sqMeters:250, floor:5, type:"COMMERCIAL", monthlyKwh:1085, contractedKw:50, meterAge:4 },
    { id:"tt-004", name:"Besnik Zeka",      address:"Rr. Dëshmorët e Kombit, Kati 6", sqMeters:228, floor:6, type:"OFFICE",     monthlyKwh:795,  contractedKw:40, meterAge:5 },
  ],

  "blloku": [
    { id:"bl-001", name:"Lindita Vora",       address:"Rruga Pjetër Bogdani, Nr.5, Ap.8",  sqMeters:110, floor:4, type:"RESIDENTIAL", monthlyKwh:228, contractedKw:9,  meterAge:4 },
    { id:"bl-002", name:"Gentiana Lika",      address:"Rruga Pjetër Bogdani, Nr.5, Ap.9",  sqMeters:112, floor:4, type:"RESIDENTIAL", monthlyKwh:59,  contractedKw:9,  meterAge:2 },
    { id:"bl-003", name:"Endrit Myftiu",      address:"Rruga Pjetër Bogdani, Nr.5, Ap.10", sqMeters:105, floor:5, type:"RESIDENTIAL", monthlyKwh:220, contractedKw:9,  meterAge:6 },
    { id:"bl-004", name:"Blloku Bar SH.P.K.", address:"Rruga Ismail Qemali, Nr.12",         sqMeters:180, floor:1, type:"COMMERCIAL",  monthlyKwh:738, contractedKw:25, meterAge:3 },
  ],

  "rinia-park": [
    { id:"rp-001", name:"Agron Topi",    address:"Rruga Abdyl Frashëri, Nr.3, Ap.2", sqMeters:74, floor:2, type:"RESIDENTIAL", monthlyKwh:154, contractedKw:6, meterAge:8 },
    { id:"rp-002", name:"Donika Haxhiu", address:"Rruga Abdyl Frashëri, Nr.3, Ap.3", sqMeters:76, floor:2, type:"RESIDENTIAL", monthlyKwh:159, contractedKw:6, meterAge:5 },
    { id:"rp-003", name:"Ilir Sefa",     address:"Rruga Abdyl Frashëri, Nr.3, Ap.4", sqMeters:72, floor:3, type:"RESIDENTIAL", monthlyKwh:38,  contractedKw:6, meterAge:4 },
  ],

  "air-albania-stadium": [
    { id:"aa-001", name:"Stadium Zone SH.A.", address:"Rruga Sami Frashëri, Kompleks",      sqMeters:320, floor:1, type:"COMMERCIAL",  monthlyKwh:1380, contractedKw:80, meterAge:2 },
    { id:"aa-002", name:"Klejda Marku",       address:"Rruga Sami Frashëri, Nr.6, Ap.3",    sqMeters:78,  floor:2, type:"RESIDENTIAL", monthlyKwh:162,  contractedKw:6,  meterAge:6 },
    { id:"aa-003", name:"Mentor Bici",        address:"Rruga Sami Frashëri, Nr.6, Ap.4",    sqMeters:80,  floor:2, type:"RESIDENTIAL", monthlyKwh:45,   contractedKw:6,  meterAge:3 },
    { id:"aa-004", name:"Sport Shop SH.P.K.", address:"Rruga Sami Frashëri, Nr.8, Dyqan",   sqMeters:145, floor:1, type:"COMMERCIAL",  monthlyKwh:595,  contractedKw:20, meterAge:4 },
  ],

  "artificial-lake": [
    { id:"al-001", name:"Nora Basha",    address:"Rruga Liqeni Artificial, Nr.2, Ap.5", sqMeters:68, floor:3, type:"RESIDENTIAL", monthlyKwh:141, contractedKw:6, meterAge:9 },
    { id:"al-002", name:"Olta Duka",     address:"Rruga Liqeni Artificial, Nr.2, Ap.6", sqMeters:70, floor:3, type:"RESIDENTIAL", monthlyKwh:35,  contractedKw:6, meterAge:4 },
    { id:"al-003", name:"Pranvera Cela", address:"Rruga Liqeni Artificial, Nr.2, Ap.7", sqMeters:66, floor:4, type:"RESIDENTIAL", monthlyKwh:138, contractedKw:6, meterAge:6 },
  ],

  "palace-of-culture": [
    { id:"pc-001", name:"Rezart Gjini",    address:"Sheshi Skënderbej, Pallati Kulturës, Ap.1", sqMeters:88, floor:2, type:"RESIDENTIAL", monthlyKwh:183, contractedKw:6, meterAge:7 },
    { id:"pc-002", name:"Shpresa Kola",    address:"Sheshi Skënderbej, Pallati Kulturës, Ap.2", sqMeters:90, floor:2, type:"RESIDENTIAL", monthlyKwh:47,  contractedKw:6, meterAge:3 },
    { id:"pc-003", name:"Taulant Myftari", address:"Sheshi Skënderbej, Pallati Kulturës, Ap.3", sqMeters:86, floor:3, type:"RESIDENTIAL", monthlyKwh:180, contractedKw:6, meterAge:5 },
  ],

  "tirana-university": [
    { id:"tu-001", name:"Universiteti UT", address:"Sheshi Nënë Tereza, Godina Kryesore", sqMeters:480, floor:1, type:"PUBLIC",      monthlyKwh:1440, contractedKw:100, meterAge:8 },
    { id:"tu-002", name:"Valbona Xhafa",   address:"Rruga Elbasanit, Nr.3, Ap.4",         sqMeters:88,  floor:2, type:"RESIDENTIAL", monthlyKwh:182,  contractedKw:6,   meterAge:5 },
    { id:"tu-003", name:"Xhensila Puka",   address:"Rruga Elbasanit, Nr.3, Ap.5",         sqMeters:90,  floor:2, type:"RESIDENTIAL", monthlyKwh:43,   contractedKw:6,   meterAge:2 },
    { id:"tu-004", name:"Ylli Kopaci",     address:"Rruga Elbasanit, Nr.3, Ap.6",         sqMeters:85,  floor:3, type:"RESIDENTIAL", monthlyKwh:178,  contractedKw:6,   meterAge:4 },
  ],

  "tid-tower": [
    { id:"tid-001", name:"TID Offices SH.A.",  address:"Bulevardi Gjergj Fishta, Kati 12", sqMeters:380, floor:12, type:"OFFICE",     monthlyKwh:1292, contractedKw:80, meterAge:3 },
    { id:"tid-002", name:"Arben Laci",          address:"Bulevardi Gjergj Fishta, Kati 8",  sqMeters:260, floor:8,  type:"OFFICE",     monthlyKwh:874,  contractedKw:50, meterAge:5 },
    { id:"tid-003", name:"Blerina Gjoka",        address:"Bulevardi Gjergj Fishta, Kati 9",  sqMeters:265, floor:9,  type:"OFFICE",     monthlyKwh:201,  contractedKw:50, meterAge:2 },
    { id:"tid-004", name:"Nexus Tech SH.P.K.",  address:"Bulevardi Gjergj Fishta, Kati 6",  sqMeters:290, floor:6,  type:"COMMERCIAL", monthlyKwh:1218, contractedKw:60, meterAge:4 },
  ],

  "grand-park": [
    { id:"gp-001", name:"Elton Hyseni",  address:"Rruga Parkut të Madh, Nr.1, Ap.3", sqMeters:65, floor:2, type:"RESIDENTIAL", monthlyKwh:135, contractedKw:6, meterAge:7 },
    { id:"gp-002", name:"Fatmira Keci",  address:"Rruga Parkut të Madh, Nr.1, Ap.4", sqMeters:67, floor:2, type:"RESIDENTIAL", monthlyKwh:140, contractedKw:6, meterAge:5 },
    { id:"gp-003", name:"Genci Molla",   address:"Rruga Parkut të Madh, Nr.1, Ap.5", sqMeters:64, floor:3, type:"RESIDENTIAL", monthlyKwh:33,  contractedKw:6, meterAge:3 },
  ],

  "tirana-castle": [
    { id:"tc-001", name:"Hamit Kraja",       address:"Rruga Muratit, Nr.5, Ap.2", sqMeters:72,  floor:2, type:"RESIDENTIAL", monthlyKwh:150, contractedKw:6,  meterAge:10 },
    { id:"tc-002", name:"Ismeta Dervishi",   address:"Rruga Muratit, Nr.5, Ap.3", sqMeters:74,  floor:2, type:"RESIDENTIAL", monthlyKwh:38,  contractedKw:6,  meterAge:4  },
    { id:"tc-003", name:"Jola Malaj",        address:"Rruga Muratit, Nr.5, Ap.4", sqMeters:70,  floor:3, type:"RESIDENTIAL", monthlyKwh:147, contractedKw:6,  meterAge:7  },
    { id:"tc-004", name:"Kaltra Restaurant", address:"Rruga e Kalasë, Nr.3",       sqMeters:165, floor:1, type:"COMMERCIAL",  monthlyKwh:680, contractedKw:25, meterAge:5  },
  ],

  "mother-teresa-square": [
    { id:"mt-001", name:"Ledjo Prendi",        address:"Sheshi Nënë Tereza, Nr.2, Ap.5", sqMeters:95,  floor:3, type:"RESIDENTIAL", monthlyKwh:198, contractedKw:6,  meterAge:6 },
    { id:"mt-002", name:"Marsela Qosja",       address:"Sheshi Nënë Tereza, Nr.2, Ap.6", sqMeters:97,  floor:3, type:"RESIDENTIAL", monthlyKwh:49,  contractedKw:6,  meterAge:3 },
    { id:"mt-003", name:"Ndriçim Hysa",        address:"Sheshi Nënë Tereza, Nr.2, Ap.7", sqMeters:92,  floor:4, type:"RESIDENTIAL", monthlyKwh:193, contractedKw:6,  meterAge:8 },
    { id:"mt-004", name:"Teresa Café SH.P.K.", address:"Sheshi Nënë Tereza, Nr.4",        sqMeters:120, floor:1, type:"COMMERCIAL",  monthlyKwh:492, contractedKw:20, meterAge:4 },
  ],
};