// LabCalc arithmetic: plain functions with no UI, shared by index.html and test/calc.test.js.
// Every function takes the numbers and unit labels exactly as typed and returns a value in the
// base unit of its kind (mass in g, volume in L), or null when an input is missing or not positive.
(function (root) {
  "use strict";

  const MU = "µ";
  // factor = how many base units one of this unit is
  const UNITS = {
    molar: [ // base: M (mol/L)
      { label: "M", factor: 1 },
      { label: "mM", factor: 1e-3 },
      { label: MU + "M", factor: 1e-6 },
      { label: "nM", factor: 1e-9 },
      { label: "pM", factor: 1e-12 },
    ],
    vol: [ // base: L
      { label: "L", factor: 1 },
      { label: "mL", factor: 1e-3 },
      { label: MU + "L", factor: 1e-6 },
    ],
    mass: [ // base: g
      { label: "kg", factor: 1e3 },
      { label: "g", factor: 1 },
      { label: "mg", factor: 1e-3 },
      { label: MU + "g", factor: 1e-6 },
      { label: "ng", factor: 1e-9 },
    ],
    massVol: [ // base: mg/mL (= g/L)
      { label: "g/mL", factor: 1e3 },
      { label: "mg/mL", factor: 1 },
      { label: MU + "g/mL", factor: 1e-3 },
      { label: "ng/mL", factor: 1e-6 },
      { label: "pg/mL", factor: 1e-9 },
      { label: "g/L", factor: 1 },
      { label: "mg/L", factor: 1e-3 },
      { label: MU + "g/L", factor: 1e-6 },
    ],
  };

  // Equal concentrations typed in different units (3 mM vs 3000 uM) differ in the last bit of a float.
  const REL_TOL = 1e-9;

  function num(s) {
    const x = typeof s === "number" ? s : parseFloat(s);
    return Number.isFinite(x) && x > 0 ? x : null;
  }

  function toBase(value, units, label) {
    const u = units.find((u) => u.label === label);
    if (!u) throw new Error("unknown unit " + label);
    return value * u.factor;
  }

  // Largest unit that shows the value as >= 1 (10 mL, not 0.01 L; 500 uL, not 0.5 mL);
  // below the smallest unit, the smallest unit. Units listed largest first; duplicates
  // of the same size (g/L after mg/mL) are never reached.
  function format(base, units) {
    if (base === 0) return "0 " + units[units.length - 1].label;
    const byFactor = units.slice().sort((a, b) => b.factor - a.factor);
    let chosen = byFactor[byFactor.length - 1];
    for (const u of byFactor) {
      if (Math.abs(base / u.factor) >= 1) { chosen = u; break; }
    }
    const v = base / chosen.factor, a = Math.abs(v);
    const s = a >= 100 ? v.toFixed(1) : a >= 1 ? v.toFixed(3) : a >= 0.01 ? v.toFixed(5) : v.toExponential(3);
    return s + " " + chosen.label;
  }

  // mass (g) = concentration (mol/L) x MW (g/mol) x volume (L)
  function massFromMolarity(conc, concUnit, mw, vol, volUnit) {
    const c = num(conc), m = num(mw), v = num(vol);
    if (c === null || m === null || v === null) return null;
    return toBase(c, UNITS.molar, concUnit) * m * toBase(v, UNITS.vol, volUnit);
  }

  // C1 V1 = C2 V2, with C1 and C2 in the same kind of unit (both molar or both mass/volume).
  // Returns { stock, diluent } in L, or { error } when the desired concentration is above the stock.
  function dilution(kind, c1, c1Unit, c2, c2Unit, v2, v2Unit) {
    const a = num(c1), b = num(c2), v = num(v2);
    if (a === null || b === null || v === null) return null;
    const c1b = toBase(a, UNITS[kind], c1Unit);
    const c2b = toBase(b, UNITS[kind], c2Unit);
    const v2b = toBase(v, UNITS.vol, v2Unit);
    if (c2b > c1b * (1 + REL_TOL)) return { error: "Desired concentration exceeds stock" };
    if (c2b >= c1b * (1 - REL_TOL)) return { stock: v2b, diluent: 0 }; // equal: use the stock neat
    const v1b = (c2b * v2b) / c1b;
    return { stock: v1b, diluent: v2b - v1b };
  }

  // volume (L) = mass (g) / (concentration (mol/L) x MW (g/mol))
  function reconstituteMolar(mass, massUnit, mw, conc, concUnit) {
    const m = num(mass), w = num(mw), c = num(conc);
    if (m === null || w === null || c === null) return null;
    return toBase(m, UNITS.mass, massUnit) / (toBase(c, UNITS.molar, concUnit) * w);
  }

  // volume (L) = mass (g) / concentration (g/L); mg/mL is numerically g/L
  function reconstituteMassVol(mass, massUnit, conc, concUnit) {
    const m = num(mass), c = num(conc);
    if (m === null || c === null) return null;
    return toBase(m, UNITS.mass, massUnit) / toBase(c, UNITS.massVol, concUnit);
  }

  // % w/v = g per 100 mL, so mass (g) = (% / 100) x volume (mL)
  function percentWV(pct, vol, volUnit) {
    const p = num(pct), v = num(vol);
    if (p === null || v === null) return null;
    return (p / 100) * (toBase(v, UNITS.vol, volUnit) * 1000);
  }

  const api = { UNITS, toBase, format, massFromMolarity, dilution, reconstituteMolar, reconstituteMassVol, percentWV };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.LabCalc = api;
})(this);
