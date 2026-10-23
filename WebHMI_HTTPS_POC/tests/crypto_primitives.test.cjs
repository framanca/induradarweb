'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const folder = path.join(__dirname, '..', 'crypto');
const shaST = fs.readFileSync(path.join(folder, 'FB_WebSHA256.st'), 'utf8');
const aesST = fs.readFileSync(path.join(folder, 'FB_WebAES128.st'), 'utf8');

function constants(source, name, count) {
  const rx = new RegExp('\\b'+name+'\\[(\\d+)\\]\\s*:=\\s*(?:DWORD|BYTE)#16#([0-9a-fA-F]+)', 'g');
  const map = new Map();
  for (const match of source.matchAll(rx)) map.set(Number(match[1]), parseInt(match[2], 16));
  assert.equal(map.size, count, name+' must define every constant exactly once');
  return Array.from({ length: count }, (_, i) => {
    assert.ok(map.has(i), name+' constant missing at '+i);
    return map.get(i);
  });
}
const K = constants(shaST, 'K', 64);
const S = constants(aesST, 'SBox', 256);

const rr = (v, n) => (v >>> n) | (v << (32-n));
function sha256Mirror(input) {
  if (input.length > 2048) throw new RangeError('max2048');
  const len = input.length;
  const totalBlocks = Math.floor((len+72)/64);
  let h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  for(let block=0; block<totalBlocks; block++) {
    const w = Array(64);
    for(let i=0; i<16; i++) {
      let t=0;
      for(let j=0;j<4;j++){
        const idx=block*64+i*4+j;
        let b=0;
        if(idx<len)b=input[idx];
        else if(idx===len)b=0x80;
        else if(idx>=totalBlocks*64-4)b=(((len*8) >>> ((totalBlocks*64-1-idx)*8))&255);
        t=((t<<8)|b)>>>0;
      }
      w[i]=t;
    }
    for(let i=16;i<64;i++) {
      const s0=rr(w[i-15],7)^rr(w[i-15],18)^(w[i-15]>>>3);
      const s1=rr(w[i-2],17)^rr(w[i-2],19)^(w[i-2]>>>10);
      w[i]=(w[i-16]+s0+w[i-7]+s1)>>>0;
    }
    let [a,b,c,d,e,f,g,z]=h;
    for(let i=0;i<64;i++) {
      const s1=rr(e,6)^rr(e,11)^rr(e,25);
      const ch=(e&f)^((~e)&g);
      const t1=(z+s1+ch+K[i]+w[i])>>>0;
      const s0=rr(a,2)^rr(a,13)^rr(a,22);
      const maj=(a&b)^(a&c)^(b&c);
      const t2=(s0+maj)>>>0;
      z=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;
    }
    h=h.map((v,i)=>(v+[a,b,c,d,e,f,g,z][i])>>>0);
  }
  const out=Buffer.alloc(32);h.forEach((v,i)=>out.writeUInt32BE(v,i*4));return out;
}

function aes128Mirror(key, input){
  assert.equal(key.length,16);assert.equal(input.length,16);
  const expanded = Array.from(key).concat(Array(160).fill(0));
  const rcon=[1,2,4,8,16,32,64,128,0x1b,0x36];
  for(let i=16;i<176;i+=4){
    let t=expanded.slice(i-4,i);
    if(i%16===0)t=[S[t[1]]^rcon[i/16-1],S[t[2]],S[t[3]],S[t[0]]];
    for(let j=0;j<4;j++)expanded[i+j]=expanded[i-16+j]^t[j];
  }
  let state=Array.from(input).map((b,i)=>b^expanded[i]);
  const xt=(v)=>((v<<1)&255)^((v&128)?27:0);
  for(let round=1;round<=10;round++){
    const sub=Array.from({length:16});
    for(let col=0;col<4;col++)for(let row=0;row<4;row++)
      sub[col*4+row]=S[state[((col+row)%4)*4+row]];
    state=sub;
    if(round<10)for(let col=0;col<4;col++) {
      const o=col*4,[a,b,c,d]=state.slice(o,o+4),t=a^b^c^d;
      state[o]=a^t^xt(a^b);state[o+1]=b^t^xt(b^c);
      state[o+2]=c^t^xt(c^d);state[o+3]=d^t^xt(d^a);
    }
    state=state.map((v,i)=>v^expanded[round*16+i]);
  }
  return Buffer.from(state);
}
test('SHA-256 mirror matches FIPS and boundary vectors', () => {
  for (const n of [0,1,3,55,56,63,64,65,119,120,512,2048]) {
    const input=Buffer.alloc(n);for(let i=0;i<n;i++)input[i]=i%251;
    assert.equal(sha256Mirror(input).toString('hex'),
      crypto.createHash('sha256').update(input).digest('hex'), 'size '+n);
  }
});
test('SHA-256 abc',()=>assert.equal(sha256Mirror(Buffer.from('abc')).toString('hex'),
  'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'));
test('AES-128 ECB NIST vector',()=>{
  const key=Buffer.from('000102030405060708090a0b0c0d0e0f','hex');
  const input=Buffer.from('00112233445566778899aabbccddeeff','hex');
  assert.equal(aes128Mirror(key,input).toString('hex'),'69c4e0d86a7b0430d8cdb78070b4c55a');
});
test('AES-128 ECB additional vectors',()=>{
  const values=[
    ['00000000000000000000000000000000','00000000000000000000000000000000'],
    ['2b7e151628aed2a6abf7158809cf4f3c','6bc1bee22e409f96e93d7e117393172a'],
  ];
  for(const [k,b] of values){
    const native=crypto.createCipheriv('aes-128-ecb',Buffer.from(k,'hex'),null);native.setAutoPadding(false);
    const expected=Buffer.concat([native.update(Buffer.from(b,'hex')),native.final()]);
    assert.equal(aes128Mirror(Buffer.from(k,'hex'),Buffer.from(b,'hex')).toString('hex'),expected.toString('hex'));
  }
});
test('ST uses bounded SHA scanning and AES encryption only',()=>{
  assert.match(shaST,/FOR StepIndex := UINT#0 TO UINT#7 DO/);
  assert.match(shaST,/IF RoundIndex < UINT#64 THEN/);
  assert.match(aesST,/Round < UINT#10/);
  assert.match(aesST,/ExpandedKey\[I\+J\]/);
});


function ghash(h, aad, cipher) {
  let y=Buffer.alloc(16);
  const hashBlock=(block)=>{
    for(let i=0;i<16;i++)y[i]^=block[i];
    let z=Buffer.alloc(16),v=Buffer.from(h);
    for(let bit=0;bit<128;bit++){
      if(y[Math.floor(bit/8)] & (0x80 >>> (bit%8)))
        for(let j=0;j<16;j++)z[j]^=v[j];
      const lsb=v[15]&1,old=Buffer.from(v);
      for(let j=0;j<16;j++)v[j]=(old[j]>>>1)|(j>0?((old[j-1]&1)<<7):0);
      if(lsb)v[0]^=0xe1;
    }
    y=z;
  };
  const blocks=(buffer)=>{
    for(let i=0;i<buffer.length;i+=16){
      const block=Buffer.alloc(16);
      buffer.copy(block,0,i,Math.min(i+16,buffer.length));hashBlock(block);
    }
  };
  blocks(aad);blocks(cipher);
  const lengths=Buffer.alloc(16);
  lengths.writeUInt32BE(aad.length*8,4);lengths.writeUInt32BE(cipher.length*8,12);
  hashBlock(lengths);
  return y;
}
function aesgcmMirror(key,iv,aad,input,encrypt,tagIn){
  const h=aes128Mirror(key,Buffer.alloc(16));
  const j0=Buffer.concat([iv,Buffer.from([0,0,0,1])]);
  const mask=aes128Mirror(key,j0);
  const output=Buffer.alloc(input.length);
  for(let pos=0;pos<input.length;pos+=16){
    const ctr=Buffer.from(j0);ctr.writeUInt32BE(2+Math.floor(pos/16),12);
    const stream=aes128Mirror(key,ctr);
    for(let j=0;j<Math.min(16,input.length-pos);j++)output[pos+j]=input[pos+j]^stream[j];
  }
  const ciphertext=encrypt?output:input;
  const auth=ghash(h,aad,ciphertext);
  const tag=Buffer.from(auth.map((x,i)=>x^mask[i]));
  const valid=encrypt||crypto.timingSafeEqual(tag,tagIn);
  return {output:valid?output:Buffer.alloc(output.length),tag,valid};
}
test('AES-128-GCM NIST zero-key known-answer test',()=>{
  const result=aesgcmMirror(Buffer.alloc(16),Buffer.alloc(12),Buffer.alloc(0),Buffer.alloc(16),true);
  assert.equal(result.output.toString('hex'),'0388dace60b6a392f328c2b971b2fe78');
  assert.equal(result.tag.toString('hex'),'ab6e47d42cec13bdf53a67b21257bddf');
});
test('AES-128-GCM native Node compatibility with AAD/partial blocks',()=>{
  for(let n of [0,1,15,16,17,127,2048]){
    const key=crypto.createHash('sha256').update('key'+n).digest().subarray(0,16);
    const nonce=crypto.createHash('sha256').update('iv'+n).digest().subarray(0,12);
    const aad=Buffer.from('webhmi-test-aad');
    const input=Buffer.alloc(n);for(let i=0;i<n;i++)input[i]=(i*17)%256;
    const c=crypto.createCipheriv('aes-128-gcm',key,nonce);
    c.setAAD(aad);
    const expected=Buffer.concat([c.update(input),c.final()]);
    const expectedTag=c.getAuthTag();
    const encrypted=aesgcmMirror(key,nonce,aad,input,true);
    assert.equal(encrypted.output.toString('hex'),expected.toString('hex'));
    assert.equal(encrypted.tag.toString('hex'),expectedTag.toString('hex'));
    const decrypted=aesgcmMirror(key,nonce,aad,expected,false,expectedTag);
    assert.equal(decrypted.valid,true);assert.equal(decrypted.output.toString('hex'),input.toString('hex'));
    const bad=Buffer.from(expectedTag);bad[0]^=1;
    const tampered=aesgcmMirror(key,nonce,aad,expected,false,bad);
    assert.equal(tampered.valid,false);assert.ok(tampered.output.every(x=>x===0));
  }
});
test('ST GCM FB requires authentication tag before plaintext use',()=>{
  const st=fs.readFileSync(path.join(folder,'FB_WebAESGCM.st'),'utf8');
  assert.match(st,/AES\s*:\s*FB_WebAES128/);
  assert.match(st,/Y\[BitIndex \/ UINT#8\] AND Mask/);
  assert.match(st,/Tag\[I\] := TagMask\[I\] XOR Y\[I\]/);
  assert.match(st,/FOR I := UINT#0 TO UINT#2047 DO Result\[I\] := BYTE#0/);
});


test('TLS 1.2 AES-128-GCM application-data record roundtrip under fixed session keys',()=>{
  const key=Buffer.from('000102030405060708090a0b0c0d0e0f','hex');
  const salt=Buffer.from('11223344','hex');
  const seq=Buffer.from('0000000000000001','hex');
  const plaintext=Buffer.from('GET / HTTP/1.0\r\n\r\n');
  const nonce=Buffer.concat([salt,seq]);
  const aad=Buffer.concat([seq,Buffer.from('170303','hex'),Buffer.from([(plaintext.length>>8)&255, plaintext.length&255])]);
  const result=aesgcmMirror(key,nonce,aad,plaintext,true);
  const n=result.output.length+24;
  const record=Buffer.concat([Buffer.from([0x17,0x03,0x03,n>>>8,n&0xff]),seq,result.output,result.tag]);
  assert.equal(record.length,5+8+plaintext.length+16);
  assert.equal(record.readUInt16BE(3),plaintext.length+24);
  const dec=aesgcmMirror(key,nonce,aad,record.subarray(13,-16),false,record.subarray(-16));
  assert.equal(dec.valid,true);
  assert.equal(dec.output.toString(),plaintext.toString());
  const bad=Buffer.from(record);bad[bad.length-1]^=1;
  const tampered=aesgcmMirror(key,nonce,aad,bad.subarray(13,-16),false,bad.subarray(-16));
  assert.equal(tampered.valid,false);
  const st=fs.readFileSync(path.join(folder,'FB_WebTLS12Record.st'),'utf8');
  assert.match(st,/Gcm\s*:\s*FB_WebAESGCM/);
  assert.match(st,/InputLen <> RecordLen\+UINT#5/);
  assert.match(st,/RecordLen := GcmDataLen \+ UINT#24/);
  assert.match(st,/Gcm.Error\) AND Gcm.Valid/);
  assert.match(st,/IF GcmDataLen > UINT#0 THEN/);
});
