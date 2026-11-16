// Checks every LabCalc calculation against answers worked out by hand (written in each comment).
// Run: node --test test/
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../calc.js");

const close = (got, want, msg) =>
  assert.ok(Math.abs(got - want) <= 1e-12 + 1e-9 * Math.abs(want), `${msg}: got ${got}, want ${want}`);

test("unit tables: equal amounts written in different units agree", () => {
  const mv = L.UNITS.massVol;
  close(L.toBase(1, mv, "g/L"), L.toBase(1, mv, "mg/mL"), "1 g/L = 1 mg/mL");
  close(L.toBase(1, mv, "mg/L"), L.toBase(1, mv, "µg/mL"), "1 mg/L = 1 ug/mL");
  close(L.toBase(1, mv, "µg/L"), L.toBase(1, mv, "ng/mL"), "1 ug/L = 1 ng/mL");
  close(L.toBase(1, mv, "g/mL"), L.toBase(1000, mv, "mg/mL"), "1 g/mL = 1000 mg/mL");
  close(L.toBase(1, mv, "pg/mL"), L.toBase(1e-3, mv, "ng/mL"), "1 pg/mL = 0.001 ng/mL");
  close(L.toBase(1, L.UNITS.molar, "pM"), 1e-12, "1 pM = 1e-12 M");
  close(L.toBase(250, L.UNITS.vol, "µL"), 2.5e-4, "250 uL = 2.5e-4 L");
  close(L.toBase(1, L.UNITS.mass, "kg"), 1000, "1 kg = 1000 g");
  assert.throws(() => L.toBase(1, L.UNITS.vol, "gallon"), /unknown unit/);
});

test("mass from molarity", () => {
  close(L.massFromMolarity("1", "M", "58.44", "1", "L"), 58.44, "1 M NaCl, 1 L = 58.44 g");
  // 0.1 mol/L x 58.44 g/mol x 0.05 L = 0.2922 g
  close(L.massFromMolarity("100", "mM", "58.44", "50", "mL"), 0.2922, "100 mM NaCl, 50 mL");
  assert.equal(L.format(0.2922, L.UNITS.mass), "292.2 mg");
  // 10 uM x 500 g/mol x 1 mL = 1e-5 x 500 x 1e-3 = 5e-6 g
  close(L.massFromMolarity("10", "µM", "500", "1", "mL"), 5e-6, "10 uM, MW 500, 1 mL");
  assert.equal(L.format(5e-6, L.UNITS.mass), "5.000 µg");
});

test("molar dilution", () => {
  // 10 mM -> 10 uM in 10 mL: V1 = 10e-6 x 10e-3 / 10e-3 = 1e-5 L = 10 uL; diluent 9.99 mL
  const r = L.dilution("molar", "10", "mM", "10", "µM", "10", "mL");
  close(r.stock, 1e-5, "stock");
  close(r.diluent, 9.99e-3, "diluent");
  assert.equal(L.format(r.stock, L.UNITS.vol), "10.000 µL");
  assert.equal(L.format(r.diluent, L.UNITS.vol), "9.990 mL");
  // 1 M -> 1 nM in 1 mL: V1 = 1e-9 x 1e-3 / 1 = 1e-12 L = 1e-6 uL (far below a pipette, shown in uL)
  assert.equal(L.format(L.dilution("molar", "1", "M", "1", "nM", "1", "mL").stock, L.UNITS.vol), "1.000e-6 µL");
});

test("dilution where desired equals stock in different units is allowed, not an error", () => {
  for (const [c1, u1, c2, u2] of [["3", "mM", "3000", "µM"], ["0.7", "M", "700", "mM"], ["2.5", "mM", "2500", "µM"]]) {
    const r = L.dilution("molar", c1, u1, c2, u2, "1", "mL");
    assert.ok(!r.error, `${c1} ${u1} vs ${c2} ${u2} flagged as exceeding stock`);
    close(r.stock, 1e-3, "all stock");
    assert.equal(r.diluent, 0);
  }
  assert.equal(L.format(0, L.UNITS.vol), "0 µL");
});

test("dilution above stock is an error", () => {
  assert.deepEqual(L.dilution("molar", "1", "mM", "2", "mM", "1", "mL"), { error: "Desired concentration exceeds stock" });
  assert.ok(L.dilution("massVol", "1", "mg/mL", "1001", "µg/mL", "1", "mL").error);
});

test("mass/volume dilution with the defaults (stock mg/mL, desired ug/mL, volume mL)", () => {
  // 1 mg/mL -> 10 ug/mL in 10 mL: V1 = 0.01 x 10 / 1 = 0.1 mL = 100 uL; diluent 9.9 mL
  const r = L.dilution("massVol", "1", "mg/mL", "10", "µg/mL", "10", "mL");
  close(r.stock, 1e-4, "stock");
  close(r.diluent, 9.9e-3, "diluent");
  assert.equal(L.format(r.stock, L.UNITS.vol), "100.0 µL");
  // 2 mg/mL -> 5 ug/mL in 50 mL: V1 = 0.005 x 50 / 2 = 0.125 mL = 125 uL
  close(L.dilution("massVol", "2", "mg/mL", "5", "µg/mL", "50", "mL").stock, 1.25e-4, "125 uL");
  // 1 mg/mL -> 100 ng/mL in 1 mL: V1 = 1e-4 x 1 / 1 = 1e-4 mL = 0.1 uL
  close(L.dilution("massVol", "1", "mg/mL", "100", "ng/mL", "1", "mL").stock, 1e-7, "0.1 uL");
});

test("reconstitution, molar", () => {
  // 5 mg, MW 500 -> 1e-5 mol; to 10 mM: 1e-5 / 1e-2 = 1e-3 L = 1 mL
  close(L.reconstituteMolar("5", "mg", "500", "10", "mM"), 1e-3, "5 mg MW 500 to 10 mM");
  assert.equal(L.format(1e-3, L.UNITS.vol), "1.000 mL");
  // 1 mg, MW 1000 -> 1e-6 mol; to 1 uM: 1 L
  close(L.reconstituteMolar("1", "mg", "1000", "1", "µM"), 1, "1 mg MW 1000 to 1 uM");
});

test("reconstitution, mass/volume", () => {
  close(L.reconstituteMassVol("1", "mg", "0.5", "mg/mL"), 2e-3, "1 mg to 0.5 mg/mL = 2 mL");
  close(L.reconstituteMassVol("100", "µg", "100", "µg/mL"), 1e-3, "100 ug to 100 ug/mL = 1 mL");
  close(L.reconstituteMassVol("10", "µg", "0.1", "mg/mL"), 1e-4, "10 ug to 0.1 mg/mL = 100 uL");
});

test("% w/v", () => {
  close(L.percentWV("2", "50", "mL"), 1, "2% in 50 mL = 1 g");
  close(L.percentWV("0.1", "10", "mL"), 0.01, "0.1% in 10 mL = 10 mg");
  close(L.percentWV("5", "1", "L"), 50, "5% in 1 L = 50 g");
  assert.equal(L.format(0.01, L.UNITS.mass), "10.000 mg");
});

test("result units read the way a bench reads them", () => {
  assert.equal(L.format(0.01, L.UNITS.vol), "10.000 mL"); // was "0.01000 L"
  assert.equal(L.format(5e-4, L.UNITS.vol), "500.0 µL"); // was "0.50000 mL"
  assert.equal(L.format(2, L.UNITS.vol), "2.000 L");
  assert.equal(L.format(5e-7, L.UNITS.vol), "0.50000 µL");
  assert.equal(L.format(1500, L.UNITS.mass), "1.500 kg");
});

test("blank, zero, negative and non-numeric inputs give no result", () => {
  for (const bad of ["", "0", "-1", "abc", "."]) {
    assert.equal(L.massFromMolarity(bad, "M", "1", "1", "L"), null, `conc ${JSON.stringify(bad)}`);
    assert.equal(L.dilution("molar", "1", "M", bad, "M", "1", "L"), null, `c2 ${JSON.stringify(bad)}`);
    assert.equal(L.percentWV("1", bad, "mL"), null, `vol ${JSON.stringify(bad)}`);
  }
  // scientific notation typed on a keyboard is accepted
  close(L.massFromMolarity("1e-3", "M", "100", "1", "L"), 0.1, "1e-3 M");
});
