(function(root){
'use strict';
// Safe expression evaluator: no eval, Function, property traversal or arbitrary calls.
// Grammar: literals, variables, arithmetic, comparison, boolean and ternary.
function evaluate(source, variables){
  const input=String(source||'').trim();
  if(!input)return undefined;
  if(input.length>500)throw Error('Expresión demasiado larga (máx. 500 caracteres)');
  const tokens=[],rx=/\s*(?:([0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?|("(?:\\.|[^"\\])*")|([A-Za-z_][A-Za-z_0-9.]*)|(>=|<=|===|!==|==|!=|&&|\|\||[?:()+*\/!%<>-]))/gy;
  let i=0;
  while(i<input.length){
    if(/^\s+$/.test(input.slice(i)))break;
    rx.lastIndex=i;
    const match=rx.exec(input);
    if(!match||rx.lastIndex===i)throw Error('Símbolo no permitido cerca de: '+input.slice(i,i+18));
    tokens.push(match[1]!==undefined?{t:'number',v:Number(match[0].trim())}:match[2]?{t:'string',v:JSON.parse(match[2])}:match[3]?{t:'name',v:match[3]}:{t:'operator',v:match[4]});
    if(tokens.length>160)throw Error('Expresión demasiado compleja');
    i=rx.lastIndex;
  }
  const priority={'||':1,'&&':2,'==':3,'!=':3,'===':3,'!==':3,'>':4,'<':4,'>=':4,'<=':4,'+':5,'-':5,'*':6,'/':6,'%':6};
  let pos=0;
  const peek=()=>tokens[pos]&&tokens[pos].v;
  const consume=x=>{if(peek()!==x)throw Error('Se esperaba '+x);pos++};
  function prefix(){
    const t=tokens[pos++];if(!t)throw Error('Expresión incompleta');
    if(t.t==='number'||t.t==='string')return()=>t.v;
    if(t.t==='name'){
      if(t.v==='true'||t.v==='TRUE')return()=>true;
      if(t.v==='false'||t.v==='FALSE')return()=>false;
      if(t.v==='null')return()=>null;
      if(['__proto__','constructor','prototype'].some(x=>t.v.split('.').includes(x)))throw Error('Identificador no permitido');
      return()=>{const v=variables||{},key=t.v.startsWith('PLC.')?t.v.slice(4):t.v;return Object.prototype.hasOwnProperty.call(v,key)?v[key]:undefined};
    }
    if(t.v==='('){const f=expression(0);consume(')');return f}
    if(t.v==='!'||t.v==='-'||t.v==='+'){const f=prefix();return()=>t.v==='!'?!f():t.v==='-'?-Number(f()):Number(f())}
    throw Error('Elemento inesperado: '+t.v);
  }
  function expression(min){
    let left=prefix();
    while(pos<tokens.length){
      const op=peek(),prec=priority[op];
      if(op==='?'&&min<=0){pos++;const yes=expression(0);consume(':');const no=expression(0),old=left;left=()=>old()?yes():no();continue}
      if(prec===undefined||prec<min)break;
      pos++;const right=expression(prec+1),old=left;
      left=()=>{
        const a=old();
        if(op==='&&')return Boolean(a)&&Boolean(right());
        if(op==='||')return Boolean(a)||Boolean(right());
        const b=right();
        switch(op){
          case '==':case '===':return a===b;
          case '!=':case '!==':return a!==b;
          case '>':return a>b;case '<':return a<b;
          case '>=':return a>=b;case '<=':return a<=b;
          case '+':return a+b;case '-':return Number(a)-Number(b);
          case '*':return Number(a)*Number(b);case '/':return Number(a)/Number(b);
          case '%':return Number(a)%Number(b);
        }
      };
    }
    return left;
  }
  const result=expression(0);
  if(pos!==tokens.length)throw Error('Expresión incorrecta cerca de '+peek());
  return result();
}
function validate(source){try{evaluate(source,{});return ''}catch(e){return e.message}}
root.NXExpressions={evaluate,validate};
})(globalThis);
