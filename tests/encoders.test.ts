import "./setup.js";
import assert from "node:assert/strict";
import test from "node:test";
import {
  decodeBase64,
  decodeBase64Url,
  decodeHTML,
  decodeURL,
  encodeBase64,
  encodeBase64Url,
  encodeHTML,
  encodeURL,
} from "../src/lib/utils/encoders.js";

test("Base64 encode/decode preserves unicode text", () => {
  const input = "Secutil ✅";
  const encoded = encodeBase64(input);
  const decoded = decodeBase64(encoded);
  assert.equal(decoded, input);
});

test("Base64URL encode/decode roundtrip", () => {
  const input = "user@example.com";
  const encoded = encodeBase64Url(input);
  const decoded = decodeBase64Url(encoded);
  assert.equal(decoded, input);
});

test("URL encode/decode roundtrip", () => {
  const input = "https://example.com/search?q=hello world&x=1";
  assert.equal(decodeURL(encodeURL(input)), input);
});

test("HTML encode/decode roundtrip", () => {
  const input = `<script>alert("x")</script> & 'safe'`;
  const encoded = encodeHTML(input);
  assert.equal(
    encoded,
    "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#039;safe&#039;",
  );
  assert.equal(decodeHTML(encoded), input);
});
