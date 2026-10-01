import test from "node:test";
import assert from "node:assert/strict";
import { sealCode, openCode, requireCodeVault } from "../src/lib/pit/code-vault.server.ts";

test("store vault encrypts codes with fresh IVs and binds them to the role", () => {
  const before = process.env.PIT_CODE_VAULT_KEY;
  process.env.PIT_CODE_VAULT_KEY = "ab".repeat(32);
  try {
    const first = sealCode("captain:plano", "619284");
    const second = sealCode("captain:plano", "619284");
    assert.notEqual(first, second);
    assert.ok(!first.includes("619284"));
    assert.equal(openCode("captain:plano", first), "619284");
    assert.throws(() => openCode("bay:plano", first));
    const [iv, tag, value] = first.split(":");
    const changed = value[0] === "0" ? "1" : "0";
    assert.throws(() => openCode("captain:plano", `${iv}:${tag}:${changed}${value.slice(1)}`));
  } finally {
    if (before === undefined) delete process.env.PIT_CODE_VAULT_KEY;
    else process.env.PIT_CODE_VAULT_KEY = before;
  }
});
test("the code panel fails closed without a valid private vault key", () => {
  const before = process.env.PIT_CODE_VAULT_KEY;
  try {
    delete process.env.PIT_CODE_VAULT_KEY;
    assert.throws(requireCodeVault, /private server vault key/);
    assert.equal(sealCode("bay:plano", "438162"), null);
    process.env.PIT_CODE_VAULT_KEY = "invalid";
    assert.throws(requireCodeVault);
    assert.throws(() => sealCode("bay:plano", "438162"));
  } finally {
    if (before === undefined) delete process.env.PIT_CODE_VAULT_KEY;
    else process.env.PIT_CODE_VAULT_KEY = before;
  }
});
