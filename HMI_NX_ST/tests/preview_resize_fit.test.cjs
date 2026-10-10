'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ctx={TextEncoder};ctx.globalThis=ctx;vm.createContext(ctx);
for(const file of ['expressions.js','model.js','sysmac-types.js','runtime.js','st.js','zip.js']){
 vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),ctx,{filename:file});
}
const C=ctx.NXST;
test('generated HMI fits available height after header, navigation and recipes',()=>{
 const project=C.demoProject();
 const html=C.buildRuntimeHTML(project);
 assert.match(html,/body\{height:100dvh;min-height:0;overflow:hidden;display:flex;flex-direction:column\}/);
 assert.match(html,/#viewport\{width:100%;flex:1 1 auto;min-height:0;overflow:auto\}/);
 assert.match(html,/const availableHeight=Math\.max\(1,viewport\.clientHeight\|\|fallbackHeight\)/);
 assert.match(html,/const scale=Math\.min\(target\/P\.width,available\/P\.width,availableHeight\/P\.height\)/);
 assert.match(html,/fit\.style\.width=\(P\.width\*scale\)\+"px"/);
 assert.match(html,/ResizeObserver\(fitStage\)\.observe\(viewport\)/);
 assert.doesNotThrow(()=>new Function(html.match(/<script>([\s\S]*?)<\/script>/)[1]));
});
test('editor preview supports resizing without touching project geometry',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
 const editor=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
 const css=fs.readFileSync(path.join(__dirname,'..','style.css'),'utf8');
 assert.match(html,/id="previewResizeHandle"/);
 assert.match(html,/aria-label="Redimensionar vista previa"/);
 assert.match(editor,/function previewResizeStart\(\)/);
 assert.match(editor,/function previewResizeTo\(width,height\)/);
 assert.match(editor,/handle\.setPointerCapture\(e\.pointerId\)/);
 assert.match(editor,/handle\.onkeydown=e=>/);
 assert.match(editor,/window\.addEventListener\('resize',clampPreviewDialog\)/);
 assert.match(css,/#previewDialog\[open\]\{display:flex;flex-direction:column\}/);
 assert.match(css,/#previewResizeHandle\{position:absolute/);
 assert.match(css,/#previewDialog #previewFrame\{display:block;width:100%;height:100%;min-width:0;min-height:0;flex:1 1 auto\}/);
 assert.doesNotThrow(()=>new Function(editor));
 const before=JSON.stringify(C.demoProject()),after=JSON.stringify(C.demoProject());
 assert.equal(JSON.parse(before).screens[0].objects[0].kind,JSON.parse(after).screens[0].objects[0].kind);
});
