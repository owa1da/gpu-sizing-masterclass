const assert = require("node:assert/strict");

global.window = {};
require("../assets/js/data.js");
require("../assets/js/calc.js");

const { DATA, CALC } = window;
const model = DATA.models.find((item) => item.id === "qwen36a3b");
const device = DATA.devices.find((item) => item.id === "rx7900xtx");
const q4 = DATA.precisions.find((item) => item.key === "q4");

const result = CALC.evaluate({
  paramsTotalB: model.paramsB,
  paramsActiveB: model.activeB,
  bytesPerWeight: q4.bpw,
  model: { ...model, kvBytes: 0.5 },
  users: 1,
  ctxTokens: 1024,
  promptTokens: 1024
}, device);

assert.equal(CALC.usableMem(24, "amd"), 24, "discrete VRAM must not receive a second 10% reserve");
assert.equal(CALC.usableMem(24, "nvidia"), 24, "the physical-capacity rule applies to every discrete GPU");
assert.equal(CALC.usableMem(24, "apple"), 18, "Apple unified-memory OS reserve must remain intact");
assert.ok(Math.abs(result.requiredVRAM - 23.105767168) < 1e-9);
assert.equal(result.devicesNeeded, 1);
assert.equal(result.memFit, true);
assert.equal(result.verdict, "tight");
assert.equal(result.tightHeadroom, true);
assert.ok(result.headroomGB > 0 && result.headroomGB < 1);
assert.ok(CALC.selfChecks.length >= 3 && CALC.selfChecks.every((check) => check.pass));

console.log("calc regression: Qwen 35B Q4 fits one RX 7900 XTX");
