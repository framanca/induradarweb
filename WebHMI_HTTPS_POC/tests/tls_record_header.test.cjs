'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

// Reference model for the PHASE-0 five-byte detector.
// This does not execute Sysmac ST, perform a TLS handshake, or prove security.
function classify(chunks) {
  const header = [];
  for (const chunk of chunks) for (const byte of chunk) if (header.length < 5) header.push(byte);
  if (header.length < 5) return 'incomplete';
  const length = header[3] * 256 + header[4];
  if (header[0] === 0x16 && header[1] === 0x03 &&
      header[2] >= 0x01 && header[2] <= 0x03 &&
      length > 0 && length <= 16384) return 'tls-record-candidate';
  return 'reject';
}

test('TLS 1.2 ClientHello record header detected', () => {
  assert.equal(classify([Buffer.from([0x16,0x03,0x03,0x00,0x79])]), 'tls-record-candidate');
});
test('TLS 1.3 legacy record version detected', () => {
  assert.equal(classify([Buffer.from([0x16,0x03,0x01,0x02,0x00])]), 'tls-record-candidate');
});
test('fragmentation across 3 TCP receives', () => {
  assert.equal(classify([Buffer.from([0x16]),Buffer.from([0x03,0x03]),Buffer.from([0,0x70])]), 'tls-record-candidate');
});
test('HTTP plaintext rejected', () => {
  assert.equal(classify([Buffer.from('GET / HTTP/1.1')]), 'reject');
});
test('empty or oversized TLS records rejected', () => {
  assert.equal(classify([Buffer.from([0x16,3,3,0,0])]), 'reject');
  assert.equal(classify([Buffer.from([0x16,3,3,0x41,0])]), 'reject');
});
test('incomplete 5-byte header never accepted', () => {
  assert.equal(classify([Buffer.from([0x16,3,3])]), 'incomplete');
});
test('fail-closed ST does not expose original HMI routes', () => {
  const st = fs.readFileSync(path.join(__dirname,'..','sysmac','WebHMI_TLS_Probe.st'),'utf8');
  const vars = fs.readFileSync(path.join(__dirname,'..','sysmac','WebHMI_TLS_Probe_LocalVariables.tsv'),'utf8');
  assert.match(vars, /SktTCPAccept/);
  assert.match(vars, /SktTCPRcv/);
  assert.match(vars, /SktTCPSend/);
  assert.match(st, /WebTLS_Accept\(Execute:=TRUE/);
  assert.match(st, /WebTLS_Recv\(Execute:=TRUE/);
  assert.match(st, /handshake_failure/);
  assert.doesNotMatch(st, /\/api\/write|\/api\/read|GET \/ |HTTP\/1\.0 200/);
});
