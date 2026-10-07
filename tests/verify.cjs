const fs=require('fs'),vm=require('vm'),assert=require('assert');
const file=process.argv[2]||'index.html',html=fs.readFileSync(file,'utf8');
function extract(name){const start=html.indexOf('    function '+name+'(');assert(start>=0,name);const lineEnd=html.indexOf('\n',start);if(html.slice(start,lineEnd).trim().endsWith('}'))return html.slice(start,lineEnd);return html.slice(start,html.indexOf('\n    }',start)+6);}
const names=['validateModel','analysisAccuracy','solveLin','distAt','distW','distM','analyze','integrationBeam','cableReactions','polyValue','polynomialRoots01','computeDeflection','rectangleSection','sectionModel','sectionPoint','designBeam','fixedSection','capacitySolve','curvatureFromStrain','minimumRectangleWidth'];
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
for(const P of [1e-12,1e12]){const v=run(input(5,simple(5),[{x:2.5,F:P}]),20000);close(v.r.Vmax.abs,P/2,'load magnitude shear',1e-12);close(v.r.Mabs.abs,P*5/4,'load magnitude moment',1e-12);}
ctx.i=input(5,simple(5),[{x:2.5,F:10}]);ctx.mat={sec:'rect',b:.2,h:.4,sa:3000,ta:1000,checkShear:true,useDeflection:false,selfWeight:false};
const capacity=vm.runInContext("capacitySolve(i,mat,['P1'])",ctx);close(capacity.alpha,1.28,'maximum selected point load',1e-8);close(capacity.stress,3000,'capacity bending boundary');
const rect=vm.runInContext('sectionModel(mat)',ctx);ctx.model=rect;
const stressPoint=vm.runInContext('sectionPoint(model,12.5,5,.2,1)',ctx);close(stressPoint.sigma,1/rect.A-12.5*.2/rect.I,'combined point stress');close(vm.runInContext('sectionPoint(model,12.5,5,0).tau',ctx),1.5*5/rect.A,'neutral axis shear');
close(vm.runInContext('minimumRectangleWidth(analyze(i),.4,3000,1000,true)',ctx),6*12.5/(3000*.4**2),'minimum rectangular width');
const strain=vm.runInContext('curvatureFromStrain(.001,.1,1)',ctx);close(strain.kappa,-.01,'strain curvature');close(strain.radius,100,'strain radius');close(strain.sagitta,.25/(100+Math.sqrt(10000-.25)),'strain sagitta');

// References checked against equilibrium and independent closed-form values.
const workspace=fs.readFileSync(require('path').join(require('path').dirname(file),'workspace.js'),'utf8');
for(const name of ['checkProject','loadCases']){const line=workspace.split(/\r?\n/).find(s=>s.startsWith('function '+name+'('));vm.runInContext(line,ctx);}
const rs=workspace.indexOf('const referenceModels='),re=workspace.indexOf('\n];',rs)+3;vm.runInContext(workspace.slice(rs,re),ctx);
const fixtures=vm.runInContext('referenceModels',ctx);const expected=[[52,58,67.6],[73.3333333333333,56.6666666666667,60],[.625,.375,.75],[9,null,19.5],[35,45,40.5],[5,null,11],[13.999999999999998,33.5,32],[48,48,96],[90,50,81]];
for(let j=0;j<fixtures.length;j++){const f=fixtures[j],i=input(f.L,f.s.map(([t,x,angle])=>({t,x,angle})),(f.p||[]).map(([x,F])=>({x,F})),(f.w||[]).map(([s,e,w1,w2])=>({s,e,w1,w2})),(f.m||[]).map(([x,C])=>({x,C})));const v=run(i,24200);close(v.r.reactions[0].Rv,expected[j][0],f.name+' reaction');if(expected[j][1]!==null)close(v.r.reactions[1].Rv,expected[j][1],f.name+' reaction2');close(v.r.Mabs.abs,expected[j][2],f.name+' moment');if(j===0){close(v.d.max.abs,.007477512807,f.name+' exact deflection',1e-8);close(v.d.max.x,2.5456528,f.name+' max location',1e-7);}ctx.fixture=i;ctx.project={schema:'hrtx-beam-project',version:1,meta:{name:f.name},units:{F:'kN',L:'m'},settings:{},model:i};vm.runInContext('checkProject(project)',ctx);count++;if(i.points.length){const c=vm.runInContext('loadCases("base: P1=1",fixture)',ctx);close(c[0].model.points[0].F,i.points[0].F,'case base');}else{assert.throws(()=>vm.runInContext('loadCases("invalid: P1=1",fixture)',ctx));count++;}}
ctx.fixture=input(5,simple(5),[{x:2,F:10}],[{s:0,e:5,w1:2,w2:4}],[{x:3,C:5}]);const scaled=vm.runInContext('loadCases("reverse: P1=-2,W1=0,M1=1.5",fixture)',ctx);close(scaled[0].model.points[0].F,-20,'case reverse');close(scaled[0].model.dists[0].w2,0,'case zero');close(scaled[0].model.moms[0].C,7.5,'case couple');close(ctx.fixture.points[0].F,10,'original unchanged');
for(const text of ['bad: P2=1','bad: P1=1,P1=2','bad: P1=101','bad: P1=NaN','no colon']){ctx.caseText=text;assert.throws(()=>vm.runInContext('loadCases(caseText,fixture)',ctx));count++;}
ctx.project.model.L=-1;assert.throws(()=>vm.runInContext('checkProject(project)',ctx));count++;

// Practice C5-2 5.58 and 5.62: independent Q/Ib checks.
vm.runInContext("UNIT={F:'lb',L:'in'}",ctx);ctx.mat={sec:'rhs',b:8,h:10,thk:1};const hollow=vm.runInContext('sectionModel(mat)',ctx);ctx.shape=hollow;close(vm.runInContext('sectionPoint(shape,0,1800,0).tau',ctx),1800*52/(((8*10**3-6*8**3)/12)*2),'P5.58 neutral shear');close(vm.runInContext('sectionPoint(shape,0,1800,4).tau',ctx),1800*36/(((8*10**3-6*8**3)/12)*2),'P5.58 web flange interface');
vm.runInContext("UNIT={F:'kN',L:'m'}",ctx);ctx.mat={sec:'ibeam',b:.12,h:.2,tw:.02,tf:.02};ctx.shape=vm.runInContext('sectionModel(mat)',ctx);close(vm.runInContext('sectionPoint(shape,0,100,0).tau',ctx),100*(.12*.02*.09+.02*.08**2/2)/((.12*.2**3/12-.1*.16**3/12)*.02),'P5.62 neutral shear',1e-4);
const result={assertions:count,status:'passed',cases:['simple','cantilever','fixed','propped','continuous','triangular','partial distributed','couple','load reversal','SI/US','near coincident loads','compatibility','invalid inputs','section properties','load magnitude','load capacity','point stress','minimum width','strain curvature']};console.log(JSON.stringify(result));


