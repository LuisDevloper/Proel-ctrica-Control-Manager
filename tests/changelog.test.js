const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

describe("changelog", () => {
  it("resuelve entradas y compara versiones", async () => {
    const { getChangelogEntry, isVersionNewer, getChangelogSorted } = await import(
      "../src/renderer-react/data/changelog.js"
    );

    assert.ok(getChangelogEntry("1.4.1"));
    assert.ok(getChangelogEntry("1.4.0"));
    assert.equal(getChangelogEntry("9.9.9"), null);
    assert.ok(isVersionNewer("1.4.1", "1.4.0"));
    assert.ok(isVersionNewer("1.4.0", "1.3.0"));
    assert.ok(!isVersionNewer("1.3.0", "1.4.0"));
    assert.ok(getChangelogSorted()[0].version === "1.4.1");
  });
});
