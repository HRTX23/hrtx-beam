const fs=require('fs'),vm=require('vm'),assert=require('assert');
const file=process.argv[2]||'index.html',html=fs.readFileSync(file,'utf8');
function extract(name){const start=html.indexOf('    function '+name+'(');assert(start>=0,name);const lineEnd=html.indexOf('\n',start);if(html.slice(start,lineEnd).trim().endsWith('}'))return html.slice(start,lineEnd);return html.slice(start,html.indexOf('\n    }',start)+6);}
const names=['validateModel','analysisAccuracy','solveLin','distAt','distW','distM','analyze','integrationBeam','cableReactions','polyValue','polynomialRoots01','computeDeflection','rectangleSection','sectionModel','sectionPoint','designBeam'];
const ctx=vm.createContext({console});vm.runInContext(`const E9=1e-9,clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),detailNumber=String,fmt=String;let UNIT={F:'kN',L:'m'};const defValue=x=>x*1000,isUS=()=>UNIT.L==='in',FORCE_N={kN:1000,N:1,kip:4448.2216152605,lb:4.4482216152605},TFAM=['AUTO','W','S','C','L'];`+names.map(extract).join('\n'),ctx);
let count=0;function close(actual,expected,label,tol=1e-8){assert(Number.isFinite(actual)&&Math.abs(actual-expected)<=tol*Math.max(1e-10,Math.abs(expected)),`${label}: ${actual} != ${expected}`);count++;}
function input(L,sups,points=[],dists=[],moms=[]){return {L,sups,points,dists,moms};}
const simple=L=>[{t:'pin',x:0},{t:'roller',x:L}],fixed=L=>[{t:'fixed',x:0},{t:'fixed',x:L}];
function run(i,EI=1){ctx.i=i;ctx.EI=EI;return vm.runInContext('var r=analyze(i);if(r.unstable)throw Error("unstable");var d=computeDeflection(r,i,{EI,ratio:360});({r,d})',ctx);}
for(const L of [0.01,1,5,1000]){
 const P=10,w=2,EI=20000;
 let {r,d}=run(input(L,simple(L),[{x:L/2,F:P}]),EI);close(r.reactions[0].Rv,P/2,'center reaction');close(r.Mabs.abs,P*L/4,'center moment');close(d.max.abs,P*L**3/(48*EI),'center deflection');
 ({r,d}=run(input(L,simple(L),[],[{s:0,e:L,w1:w,w2:w}]),EI));close(r.reactions[0].Rv,w*L/2,'UDL reaction');close(r.Mabs.abs,w*L**2/8,'UDL moment');close(d.max.abs,5*w*L**4/(384*EI),'UDL deflection');
 ({r,d}=run(input(L,[{t:'fixed',x:0}],[{x:L,F:P}]),EI));close(r.reactions[0].Rv,P,'cantilever reaction');close(r.Mabs.abs,P*L,'cantilever moment');close(d.max.abs,P*L**3/(3*EI),'cantilever deflection');
 ({r,d}=run(input(L,fixed(L),[],[{s:0,e:L,w1:w,w2:w}]),EI));close(r.Mabs.abs,w*L**2/12,'fixed moment');close(d.max.abs,w*L**4/(384*EI),'fixed deflection');
 ({r,d}=run(input(L,[{t:'fixed',x:0},{t:'roller',x:L}],[],[{s:0,e:L,w1:w,w2:w}]),EI));close(r.reactions[0].Rv,5*w*L/8,'propped reaction');close(r.Mabs.abs,w*L**2/8,'propped moment');
 ({r,d}=run(input(L,simple(L),[],[{s:0,e:L,w1:0,w2:w}]),EI));close(r.reactions[0].Rv,w*L/6,'triangle left');close(r.reactions[1].Rv,w*L/3,'triangle right');
}
// A zero load near a support must not turn a stable beam into a mechanism.
for(const x of [1e-3,1e-5,1e-8,2.5+1e-5,2.5+1e-7,2.5+1e-8]){const {r,d}=run(input(5,simple(5),[{x:2.5,F:10},{x,F:0}]),20000);close(r.Mabs.abs,12.5,'near coincident load');close(d.max.abs,10*125/(48*20000),'near coincident deflection');}
// Closed-form continuous beam, applied couple, partial load, and reversed load.
let rr=run(input(10,[{t:'pin',x:0},{t:'roller',x:5},{t:'roller',x:10}],[],[{s:0,e:10,w1:2,w2:2}])).r;
close(rr.reactions[0].Rv,3.75,'continuous outside reaction');close(rr.reactions[1].Rv,12.5,'continuous center reaction');close(rr.M(5,1),-6.25,'continuous support moment');
rr=run(input(5,simple(5),[],[],[{x:2,C:10}])).r;close(rr.reactions[0].Rv,-2,'couple left');close(rr.reactions[1].Rv,2,'couple right');close(rr.M(2,1)-rr.M(2,-1),10,'couple jump');
rr=run(input(5,simple(5),[{x:4,F:50}],[{s:0,e:3,w1:20,w2:20}])).r;close(rr.reactions[0].Rv,52,'partial reaction');close(rr.Mabs.abs,67.6,'partial critical moment');
const down=run(input(5,simple(5),[{x:2,F:10}])),up=run(input(5,simple(5),[{x:2,F:-10}]));close(up.d.displacement(2),-down.d.displacement(2),'load reversal');
// Compare the same physical problem in kN/m and kip/in.
const si=run(input(5,simple(5),[{x:2.5,F:10}]),20000);const l=5/.0254,p=10000/4448.2216152605;
vm.runInContext("UNIT={F:'kip',L:'in'}",ctx);const us=run(input(l,simple(l),[{x:l/2,F:p}]),20000*1000/(4448.2216152605*.0254**2));
close(us.d.max.abs*.0254,si.d.max.abs,'SI US displacement');close(us.r.Mabs.abs*4448.2216152605*.0254/1000,si.r.Mabs.abs,'SI US moment');vm.runInContext("UNIT={F:'kN',L:'m'}",ctx);
// Exact support compatibility and continuity across mixed load boundaries.
const mixed=run(input(8,[{t:'fixed',x:0},{t:'roller',x:5},{t:'roller',x:8}],[{x:3,F:12}],[{s:1,e:7,w1:2,w2:5}],[{x:4,C:6}]),20000);
for(const s of [0,5,8]){assert(Math.abs(mixed.d.displacement(s))<1e-12);count++;}assert(Math.abs(mixed.d.slope(0))<1e-12);count++;
for(let i=0;i<mixed.d.segments.length-1;i++){const a=mixed.d.segments[i],b=mixed.d.segments[i+1];close(vm.runInContext('polyValue',ctx)(a.c,1),b.c[0],'displacement continuity',1e-3);close(vm.runInContext('polyValue',ctx)(a.dc,1)/a.l,b.dc[0]/b.l,'slope continuity',1e-6);}
// Malformed and mechanism inputs must never produce usable results.
for(const bad of [input(0,simple(0)),input(5,simple(5),[{x:6,F:1}]),input(5,simple(5),[],[{s:2,e:2,w1:1,w2:1}]),input(5,[{t:'pin',x:0},{t:'roller',x:0}])]){ctx.i=bad;assert.throws(()=>vm.runInContext('analyze(i)',ctx));count++;}
ctx.i=input(5,[{t:'pin',x:0}],[{x:2,F:10}]);assert(vm.runInContext('analyze(i).unstable',ctx));count++;
for(const shape of [{sec:'rect',b:.2,h:.4},{sec:'circ',D:.3},{sec:'pipe',D:.3,thk:.01},{sec:'rhs',b:.2,h:.4,thk:.01},{sec:'ibeam',b:.2,h:.4,tw:.01,tf:.02}]){ctx.shape=shape;const v=vm.runInContext('sectionModel(shape)',ctx);assert(v.I>0&&v.S>0&&v.A>0&&v.peak>0);count++;}
ctx.parts=[{b:.2,h:.1,y:0},{b:.1,h:.1,y:.02}];assert.throws(()=>vm.runInContext('rectangleSection(parts)',ctx));count++;
// Section stresses are checked against independent elementary formulas.
ctx.i=input(5,simple(5),[{x:2.5,F:10}]);vm.runInContext('r=analyze(i)',ctx);
for(const shape of [{sec:'rect',b:.2,h:.4},{sec:'circ',D:.3},{sec:'pipe',D:.3,thk:.01},{sec:'rhs',b:.2,h:.4,thk:.01},{sec:'ibeam',b:.2,h:.4,tw:.01,tf:.02}]){
 ctx.shape={...shape,sa:1e8,ta:1e8,checkShear:true,useDeflection:false};
 const v=vm.runInContext('({d:designBeam(r,shape),m:sectionModel(shape)})',ctx);close(v.d.sigma,12.5/v.m.S,'section bending');close(v.d.tmax,5*v.m.peak,'section shear');
}
const catalogueStart=html.indexOf('    const RAW ='),catalogueEnd=html.indexOf('    const SRCT =',catalogueStart);
vm.runInContext(html.slice(catalogueStart,catalogueEnd)+"\nconst $=id=>({value:UNIT.L==='in'?'ft':'m'});",ctx);
const catalogue=vm.runInContext('SEC',ctx);assert(catalogue.length>100);count++;
ctx.mat={sec:'W',src:'AISC',axis:'x',count:1,sa:1e8,ta:1e8,checkShear:true,useDeflection:false,selfWeight:false};
const one=vm.runInContext('designBeam(r,mat)',ctx);ctx.mat.count=2;const two=vm.runInContext('designBeam(r,mat)',ctx);
for(let j=0;j<one.rows.length;j++){const a=one.rows[j],b=two.rows.find(v=>v.k===a.k);assert(Number.isFinite(a.sigma)&&Number.isFinite(a.tmax)&&a.IU>0);count++;close(b.sigma,a.sigma/2,'paired bending');close(b.tmax,a.tmax/2,'paired shear');}
ctx.i=input(5,[{t:'pin',x:0},{t:'cable',x:5,angle:45}],[{x:2.5,F:10}]);const cable=vm.runInContext('analyze(i)',ctx);close(cable.reactions[1].tension,5*Math.sqrt(2),'cable tension');close(cable.N(2.5,1),5,'cable axial');
ctx.i=input(5,[{t:'pin',x:0},{t:'cable',x:5,angle:45}],[{x:2.5,F:-10}]);assert.throws(()=>vm.runInContext('analyze(i)',ctx));count++;
const result={assertions:count,status:'passed',cases:['simple','cantilever','fixed','propped','continuous','triangular','partial distributed','couple','load reversal','SI/US','near coincident loads','compatibility','invalid inputs','section properties']};console.log(JSON.stringify(result));
