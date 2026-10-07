'use strict';
// F2 is deliberately limited to one doubly symmetric compact I section, major-axis bending.
function aiscF2(p){
  const keys=['E','Fy','Sx','Zx','Iy','Cw','J','h0','A','bf','tf','hw','tw','Lb','Cb'];
  if(keys.some(k=>!Number.isFinite(p[k])||p[k]<=0))throw Error('คุณสมบัติ F2 ทุกค่าต้องเป็นตัวเลขมากกว่า 0');
  if(!Number.isFinite(p.demand)||p.demand<0||!['ASD','LRFD'].includes(p.method))throw Error('โมเมนต์หรือวิธีออกแบบไม่ถูกต้อง');
  if(p.Zx<p.Sx||p.Cb<1||p.Cb>3)throw Error('ต้องมี Zx ≥ Sx และ Cb อยู่ในช่วง 1–3');
  const flange=p.bf/(2*p.tf),web=p.hw/p.tw,flangeLimit=.38*Math.sqrt(p.E/p.Fy),webLimit=3.76*Math.sqrt(p.E/p.Fy);
  if(flange>flangeLimit||web>webLimit)throw Error('หน้าตัดไม่ compact ตาม B4.1b; ต้องตรวจ F3/F4/F5 เพิ่มเติม ระบบยังไม่ตัดสินผ่าน F2');
  const ry=Math.sqrt(p.Iy/p.A),rts=Math.sqrt(Math.sqrt(p.Iy*p.Cw)/p.Sx),Lp=1.76*ry*Math.sqrt(p.E/p.Fy),j=p.J/(p.Sx*p.h0);
  const Lr=1.95*rts*p.E/(.7*p.Fy)*Math.sqrt(j+Math.sqrt(j*j+6.76*(.7*p.Fy/p.E)**2)),Mp=p.Fy*p.Zx;
  let Mn=Mp,branch='Lb ≤ Lp: กำลังพลาสติก';
  if(p.Lb>Lp&&p.Lb<=Lr){Mn=Math.min(Mp,p.Cb*(Mp-(Mp-.7*p.Fy*p.Sx)*(p.Lb-Lp)/(Lr-Lp)));branch='Lp < Lb ≤ Lr: โก่งเดาะช่วงไม่ยืดหยุ่น';}
  if(p.Lb>Lr){const q=(p.Lb/rts)**2,Fcr=p.Cb*Math.PI**2*p.E/q*Math.sqrt(1+.078*j*q);Mn=Math.min(Mp,Fcr*p.Sx);branch='Lb > Lr: โก่งเดาะช่วงยืดหยุ่น';}
  const available=p.method==='ASD'?Mn/1.67:.9*Mn,utilization=p.demand/available;
  if(![Lp,Lr,Mn,available,utilization].every(Number.isFinite)||Lr<=Lp)throw Error('คุณสมบัติให้ผลนอกช่วงที่คำนวณได้');
  return {ry,rts,Lp,Lr,Mp,Mn,available,utilization,ok:utilization<=1+1e-9,branch,flange,web,flangeLimit,webLimit};
}
function braceSegment(res,a,b){
  if(!Number.isFinite(a)||!Number.isFinite(b)||a<0||b>res.L||b<=a)throw Error('ช่วงค้ำยันต้องอยู่ภายในคานและมีความยาวมากกว่า 0');
  const xs=[a,b,...res.crit.filter(x=>x>a&&x<b),...(res.roots||[]).filter(x=>x>a&&x<b)];
  let max=0;xs.forEach(x=>[-1,1].forEach(side=>max=Math.max(max,Math.abs(res.M(x,side)))));
  const values=[.25,.5,.75].map(f=>{const x=a+(b-a)*f;return Math.max(Math.abs(res.M(x,-1)),Math.abs(res.M(x,1)));});
  const denominator=2.5*max+3*values[0]+4*values[1]+3*values[2],Cb=max>0?12.5*max/denominator:1;
  return {max,Cb,values};
}
function repairRequirements(M,V,sa,ta,shape,delta){
  if(!(sa>0)||![M,V].every(Number.isFinite))throw Error('ข้อมูลแรงหรือความเค้นยอมให้ไม่ถูกต้อง');
  const out={Srequired:Math.abs(M)/sa};
  if(shape&&ta>0)out.shearUtilization=Math.abs(V)*shape.peak/ta;
  if(delta)out.Irequired=delta.mat.Im4*Math.max(1,delta.utilization);
  return out;
}
const engineeringPanel=document.createElement('section');engineeringPanel.id='advancedFeatures';engineeringPanel.className='engineering-panel';
engineeringPanel.innerHTML=`<h2>ปรับหน้าตัดและตรวจพฤติกรรม</h2><div id="advancedOutput"><div id="repairAdvice"></div><div id="candidateComparison"></div><div id="stressPicture"></div><div id="ltbResult"></div></div><details id="ltbConfig"><summary>ตรวจการโก่งเดาะด้านข้าง · AISC 360-16 F2</summary><p>รองรับคาน I สมมาตรสองแกน หน้าตัด compact จำนวนหนึ่งตัว ดัดแกนหลัก ไม่มีแรงตามแนวแกน โหลดผ่าน shear center และช่วงที่ปลายทั้งสองมีการค้ำยันต้านการบิด ไม่ตรวจคานยื่นปลายอิสระ ช่องเปิดหน้าตัด จุดต่อ หรือแรงบิดจากโหลดเยื้องศูนย์</p><p>ค่าคุณสมบัติด้านล่างใช้หน่วย SI ตามป้ายกำกับเสมอ ค่า J, Cw และ Zx ต้องมาจากตารางหรือการคำนวณที่ตรวจสอบแล้ว</p><div class="engineering-fields"><label>วิธีออกแบบ<select id="ltbMethod"><option value="ASD">ASD · Ωb = 1.67</option><option value="LRFD">LRFD · φb = 0.90</option></select></label><label>E (MPa)<input id="ltbE" type="number" value="200000"></label><label>Fy (MPa)<input id="ltbFy" type="number" value="250"></label><label>เริ่มช่วงค้ำยัน x <input id="braceStart" type="number" value="0"></label><label>จบช่วงค้ำยัน x <input id="braceEnd" type="number" value="3"></label><label>Cb<select id="ltbCbMode"><option value="one">ใช้ 1.0</option><option value="auto">คำนวณจากโมเมนต์ในช่วงค้ำยัน</option><option value="manual">กำหนดเอง</option></select></label><label>Cb ที่กำหนด<input id="ltbCb" type="number" value="1" min="1" max="3" step="any"></label></div><div id="ltbPropertyFields" class="engineering-fields"></div><p id="braceUnitNote"></p><button id="ltbUseSection" type="button">เติมคุณสมบัติที่มีจากหน้าตัดปัจจุบัน</button><label class="engineering-confirm"><input id="ltbConfirm" type="checkbox"> ยืนยันคุณสมบัติหน้าตัด ค้ำยันที่ปลายทั้งสอง โหลดผ่าน shear center และแรงในโมเดลตรงกับ ASD หรือ LRFD ที่เลือก</label><button id="ltbCalculate" type="button">ตรวจโก่งเดาะด้านข้าง</button><p>F1, F2 และ B4.1b: <a href="https://www.aisc.org/globalassets/aisc/publications/standards/a360-16-spec-and-commentary_june-2018.pdf" target="_blank" rel="noopener">ANSI/AISC 360-16</a> · ผลนี้เป็นการตรวจแรงดัดเฉพาะ F2 แยกจาก FS ที่ใช้ในโจทย์เดิม</p></details></section>`;
$('dans').after(engineeringPanel);
const propertyNames={Sx:'Sx (mm³)',Zx:'Zx (mm³)',Iy:'Iy (mm⁴)',Cw:'Cw (mm⁶)',J:'J (mm⁴)',h0:'ระยะศูนย์กลางปีก h₀ (mm)',A:'พื้นที่ A (mm²)',bf:'ความกว้างปีก bf (mm)',tf:'ความหนาปีก tf (mm)',hw:'ความสูงเอวสำหรับ B4.1b h (mm)',tw:'ความหนาเอว tw (mm)'};
$('ltbPropertyFields').innerHTML=Object.entries(propertyNames).map(([key,label])=>`<label>${label}<input id="ltb${key}" type="number" step="any" min="0"></label>`).join('');
let stressState=null,comparisonState=null;
function activeShape(){if(!last?.design)throw Error('คำนวณออกแบบหน้าตัดก่อน');const {des,mat}=last.design,row=des.table?(des.selected||des.best):null;if(des.table&&!row)throw Error('เลือกหน้าตัดเฉพาะเพื่อดูความเค้นและการโก่งเดาะ');return {des,mat,row,shape:sectionModel(mat,row)};}
function sectionElastic(shape){const elastic=readElastic();if(elastic.errors.length)throw Error(elastic.errors.join(' · '));if(!elastic.mat)return null;const m=isUS()?.0254:1,I=shape.I*m**4;return {...elastic.mat,Im4:I,EI:elastic.mat.Epa*I/(FORCE_N[UNIT.F]*m*m),Iinput:I/INERTIA_M4[elastic.mat.Iu]};}
function shapeDeflection(shape,res=last.res,inp=last.inp){const elastic=sectionElastic(shape);return elastic?computeDeflection(res,inp,elastic):null;}
function renderAdvanced(){
  if(typeof clearWorkspaceResults==='function')clearWorkspaceResults();
  $('advancedFeatures').hidden=!last?.design;if(!last?.design)return;
  $('ltbResult').replaceChildren();if(last)delete last.ltb;$('ltbConfirm').checked=false;$('braceUnitNote').textContent='ตำแหน่งช่วงค้ำยันใช้ '+$('uL').value+' · Lb เป็นระยะระหว่างค้ำยันจริง ไม่ใช่ความยาวคานโดยอัตโนมัติ';
  try{const a=activeShape(),d=shapeDeflection(a.shape);if(d){last.res.deflection=d;renderDeflection(last.res);renderCheckStatus();}const r=a.row||a.des,req=repairRequirements(last.res.Mabs.abs,last.res.Vmax.abs,a.des.sa,a.des.checkShear?a.des.ta:NaN,a.shape,d),n=detailNumber;
    const advice=[];if(!r.okB)advice.push(`เพิ่ม section modulus S จาก ${n(modulusValue(a.shape.S))} เป็นอย่างน้อย ${n(modulusValue(req.Srequired))} ${modulusUnit()} (เพิ่ม ${n((req.Srequired/a.shape.S-1)*100)}%) โดยต้องตรวจแรงและน้ำหนักคานใหม่หลังเปลี่ยนหน้าตัด`);
    if(a.des.checkShear&&!r.okS)advice.push('เพิ่มความหนาหรือพื้นที่เอว แล้วตรวจ VQ/(Ib) ใหม่ การเพิ่ม S เพียงอย่างเดียวไม่รับประกันว่าเฉือนจะผ่าน');
    if(d&&!d.ok)advice.push(`เพิ่ม I เป็นอย่างน้อย ${n(req.Irequired/INERTIA_M4[d.mat.Iu])} ${d.mat.Iu} เมื่อ E และแรงเดิมคงที่ (เพิ่ม ${n((d.utilization-1)*100)}%) หรือเพิ่มการค้ำยัน/ปรับช่วงคานแล้ววิเคราะห์ใหม่`);
    if(!advice.length)advice.push('ผ่านความเค้นที่เลือก'+(d?'และเกณฑ์การโก่งตัว':' · ยังไม่เปิดตรวจการโก่งตัว')+'; การโก่งเดาะด้านข้างตรวจแยกด้านล่าง');
    $('repairAdvice').innerHTML='<h3>คำแนะนำจากผลคำนวณ</h3><ul>'+advice.map(t=>'<li>'+esc(t)+'</li>').join('')+'</ul>'+(d?`<p class="engineering-summary ${d.ok?'pass':'fail'}">การโก่งตัวของหน้าตัดนี้: ${d.ok?'✓ ผ่าน':'✕ ไม่ผ่าน'} · ${n(defValue(d.max.abs))} / ${n(defValue(d.allowed))} ${defUnit()} · ใช้เกณฑ์ ${n(d.utilization*100)}% ${a.mat.useDeflection?'(ใช้คัดเลือกด้วย)':'(ตรวจเพิ่มเติม ยังไม่ได้ใช้คัดเลือกหน้าตัด)'}</p>`:'<p>เปิดตรวจการโก่งตัวในหน้าตั้งค่าคานเพื่อสรุปกำลังและการโก่งตัวร่วมกัน</p>');
    renderCandidates(a,d);stressState={...a,d};renderStressControls();
  }catch(e){$('repairAdvice').textContent=e.message;$('candidateComparison').replaceChildren();$('stressPicture').replaceChildren();}
}
function renderCandidates(active,currentDelta){
  const {mat,des,row}=active;
  // Always evaluate against the original loads and add each candidate's own deadweight once.
  const trialMat={...mat,sec:TFAM.includes(mat.sec)?mat.sec:'AUTO',src:TFAM.includes(mat.sec)?mat.src:'COURSE_W',specific:'',baseInp:last.baseInp||last.inp,useDeflection:!!readElastic().mat,elastic:readElastic().mat};
  let trial;try{trial=designBeam(analyze(trialMat.baseInp),trialMat);}catch(e){$('candidateComparison').textContent='เปรียบเทียบไม่ได้: '+e.message;return;}
  const rows=(trial.allRows||[]).filter(r=>r.ok).filter(r=>!row||r.k!==row.k).slice(0,4);comparisonState={rows,active};
  const unit=stressDisplayUnit(),deltaUnit=defUnit(),mass=massUnit(),n=detailNumber;
  const cell=(name,m,sigma,tau,delta,ok,button='')=>`<tr><td>${esc(name)}</td><td>${m===null?'ไม่ระบุ':n(massValue(m))}</td><td>${n(stressDisplayValue(sigma))}</td><td>${des.checkShear?n(stressDisplayValue(tau)):'ไม่ได้ตรวจ'}</td><td>${delta?n(defValue(delta.max.abs)):'ไม่ได้ตรวจ'}</td><td>${ok?'ผ่านเกณฑ์ที่ตรวจ':'ไม่ผ่าน'}</td><td>${button}</td></tr>`;
  const current=row||des,good=current.okB&&(!des.checkShear||current.okS)&&(!currentDelta||currentDelta.ok);
  $('candidateComparison').innerHTML='<h3>หน้าตัดปัจจุบันเทียบตัวเลือกที่ผ่าน</h3><p>เปรียบเทียบแรงต้นฉบับเดียวกัน'+(mat.selfWeight?' พร้อมน้ำหนักเฉพาะของแต่ละหน้าตัด':' โดยไม่รวมน้ำหนักคาน')+' · หากเปิดการโก่งตัว ตัวเลือกต้องผ่านเกณฑ์นั้นด้วย · ยังไม่รวม LTB ในการคัดเลือกนี้</p><div class="engineering-table"><table><thead><tr><th>หน้าตัด</th><th>'+mass+'</th><th>σ ('+unit+')</th><th>τ ('+unit+')</th><th>δ ('+deltaUnit+')</th><th>ผล</th><th>เลือก</th></tr></thead><tbody>'+cell(row?catalogueName(row):'หน้าตัดกำหนดเอง',row?row.m:null,current.sigma,Number.isFinite(current.tmax)?current.tmax:current.tavg,currentDelta,good)+rows.map((r,i)=>cell(catalogueName(r),r.m,r.sigma,r.tmax,r.trialDeflection,r.ok,`<button type="button" data-candidate="${i}">ใช้หน้าตัดนี้</button>`)).join('')+'</tbody></table></div>'+(rows.length?'':'<p>ไม่พบตัวเลือกที่ผ่านทุกเกณฑ์ในตารางนี้ ลองเปลี่ยนตารางหรือปรับแบบจำลอง</p>');
  $('candidateComparison').querySelectorAll('[data-candidate]').forEach(button=>button.onclick=()=>{const chosen=rows[Number(button.dataset.candidate)];$('sec').value=chosen.fam;$('tsrc').value=chosen.src;syncSec();syncSpecificSection();$('specificSection').value=chosen.k;runDesign();});
}
function renderStressControls(){
  const div=isUS()?12:1;
  $('stressPicture').innerHTML=`<h3>ภาพความเค้นบนหน้าตัด</h3><p>σ = N/A − My/I · บวกดึง / ลบอัด; τ = VQ/(Ib) · รูปหน้าตัดตารางแสดงความกว้างรวมตามระดับ y ไม่รวมรายละเอียด fillet</p><div class="engineering-fields"><label>ตำแหน่งบนคาน x (${$('uL').value})<input id="pictureX" type="number" min="0" max="${last.res.L/div}" step="any" value="${last.res.Mabs.x/div}"></label><label>ด้านของจุดแรง<select id="pictureSide"><option value="1">ขวา x⁺</option><option value="-1">ซ้าย x⁻</option></select></label><label>ระดับ y จากแกนสะเทิน (${UNIT.L})<input id="pictureY" type="number" min="${stressState.shape.bottom}" max="${stressState.shape.top}" step="any" value="0"></label></div><div id="stressDistribution"></div><div id="stressPointSummary" role="status"></div>`;
  ['pictureX','pictureSide','pictureY'].forEach(id=>$(id).oninput=drawStressDistribution);drawStressDistribution();
}
function drawStressDistribution(){
  try{if(!stressState||!last)throw Error('คำนวณหน้าตัดก่อน');const shape=stressState.shape,x=Number($('pictureX').value)*(isUS()?12:1),side=Number($('pictureSide').value),y=Number($('pictureY').value);
    if($('pictureX').value===''||$('pictureY').value===''||!Number.isFinite(x)||x<0||x>last.res.L)throw Error('ตำแหน่ง x ต้องอยู่ในคาน');
    const M=last.res.M(x,side),V=last.res.V(x,side),N=last.res.N?last.res.N(x,side):0,point=sectionPoint(shape,M,V,y,N),height=shape.top-shape.bottom;
    const coords=Array.from({length:121},(_,i)=>shape.bottom+height*(i+.5)/121),widths=coords.map(q=>shape.width?shape.width(q):0),maxWidth=Math.max(...widths),stresses=coords.map(q=>sectionPoint(shape,M,V,q,N)),smax=Math.max(1e-20,...stresses.map(p=>Math.abs(p.sigma))),tmax=Math.max(1e-20,...stresses.map(p=>Math.abs(p.tau))),Y=q=>55+(shape.top-q)/height*260;
    let body='<svg viewBox="0 0 680 360" role="img" aria-label="หน้าตัดและกราฟความเค้นดัดกับเฉือน"><text x="30" y="25">หน้าตัด · สีตามความเค้นปกติ</text><text x="290" y="25">σ · อัด ← 0 → ดึง</text><text x="510" y="25">|τ| ความเค้นเฉือน</text>';
    coords.forEach((q,i)=>{const w=widths[i];if(w>0){const color=stresses[i].sigma<0?'#b4232f':'#32769a',alpha=.15+.75*Math.abs(stresses[i].sigma)/smax,mat=stressState.mat;let spans=[[-w/2,w/2]];if(mat.sec==='rhs'&&Math.abs(q)<mat.h/2-mat.thk)spans=[[-mat.b/2,-mat.b/2+mat.thk],[mat.b/2-mat.thk,mat.b/2]];if(mat.sec==='pipe'){const R=mat.D/2,Ri=R-mat.thk,outer=Math.sqrt(Math.max(0,R*R-q*q)),inner=Math.sqrt(Math.max(0,Ri*Ri-q*q));spans=inner>0?[[-outer,-inner],[inner,outer]]:[[-outer,outer]];}spans.forEach(([left,right])=>{body+=`<rect x="${145+190*left/maxWidth}" y="${Y(q)-1.2}" width="${190*(right-left)/maxWidth}" height="2.6" fill="${color}" opacity="${alpha}"/>`;});}});
    const sp=coords.map((q,i)=>(370+75*stresses[i].sigma/smax)+','+Y(q)).join(' '),tp=coords.map((q,i)=>(520+100*Math.abs(stresses[i].tau)/tmax)+','+Y(q)).join(' ');
    body+=`<path d="M370 55V315 M520 55V315" stroke="#999"/><polyline points="${sp}" fill="none" stroke="#32769a" stroke-width="2"/><polyline points="${tp}" fill="none" stroke="#b4232f" stroke-width="2"/><path d="M25 ${Y(y)}H640" stroke="#222" stroke-dasharray="5 4"/><text x="30" y="345">แดง: อัด · น้ำเงิน: ดึง · เส้นประ: จุดที่เลือก</text></svg>`;
    $('stressDistribution').innerHTML=body;$('stressPointSummary').textContent=`x = ${detailNumber(x/(isUS()?12:1))} ${$('uL').value} · y = ${detailNumber(y)} ${UNIT.L} · σ = ${detailNumber(stressDisplayValue(point.sigma))} ${stressDisplayUnit()} (${point.sigma<0?'อัด':point.sigma>0?'ดึง':'ศูนย์'}) · τ = ${detailNumber(stressDisplayValue(point.tau))} ${stressDisplayUnit()} · กราฟ σ/τ ใช้สเกลแยกกัน`;
  }catch(e){$('stressPointSummary').textContent=e.message;$('stressDistribution').replaceChildren();}
}
$('ltbUseSection').onclick=()=>{
  try{const {mat,row}=activeShape();if(mat.axis!=='x'||mat.count!==1||!(row?.fam==='W'||mat.sec==='ibeam'))throw Error('เลือก W/I หนึ่งตัว ดัดแกนหลัก x');
    const d=row?row.d:mat.h*(isUS()?25.4:1000),b=row?row.bf:mat.b*(isUS()?25.4:1000),tw=row?row.tw:mat.tw*(isUS()?25.4:1000),tf=row?row.tf:mat.tf*(isUS()?25.4:1000);
    const values={Sx:row?row.S*1000:sectionModel(mat).S*(isUS()?25.4:1000)**3,Iy:row?.Iy?row.Iy*1e6:(2*tf*b**3+(d-2*tf)*tw**3)/12,A:row?.Amm2||2*b*tf+(d-2*tf)*tw,h0:d-tf,bf:b,tf,hw:d-2*tf,tw};
    Object.entries(values).forEach(([k,v])=>$('ltb'+k).value=Number(v.toPrecision(12)));['Zx','J','Cw'].forEach(k=>$('ltb'+k).value='');$('ltbResult').textContent='เติมค่าที่มีแล้ว ตรวจค่า h ตามนิยาม B4.1b และกรอก Zx / J / Cw จากแหล่งที่ตรวจสอบได้; ค่า Iy ที่ไม่มีในตารางคำนวณจากสี่เหลี่ยม ไม่รวม fillet';$('ltbConfirm').checked=false;
  }catch(e){$('ltbResult').textContent=e.message;}
};
$('ltbCalculate').onclick=()=>{
  try{const {mat,row}=activeShape();if(mat.axis!=='x'||mat.count!==1||!(row?.fam==='W'||mat.sec==='ibeam'))throw Error('F2 ในระบบนี้รองรับ W/I สมมาตรหนึ่งตัว ดัดแกน x เท่านั้น');if(last.res.Nmax>1e-10)throw Error('มีแรงตามแนวแกน ต้องตรวจปฏิสัมพันธ์แรงตาม Chapter H เพิ่มเติม');if(!$('ltbConfirm').checked)throw Error('ยืนยันคุณสมบัติ ค้ำยัน และฐานแรงก่อนคำนวณ');
    const a=Number($('braceStart').value)*(isUS()?12:1),b=Number($('braceEnd').value)*(isUS()?12:1);if($('braceStart').value===''||$('braceEnd').value==='')throw Error('กรอกตำแหน่งช่วงค้ำยัน');const segment=braceSegment(last.res,a,b),mm=isUS()?25.4:1000,p={E:Number($('ltbE').value),Fy:Number($('ltbFy').value),method:$('ltbMethod').value,Lb:(b-a)*mm,Cb:$('ltbCbMode').value==='auto'?segment.Cb:$('ltbCbMode').value==='one'?1:Number($('ltbCb').value),demand:segment.max*FORCE_N[UNIT.F]*mm};
    Object.keys(propertyNames).forEach(k=>p[k]=Number($('ltb'+k).value));const currentS=activeShape().shape.S*mm**3;if(Math.abs(p.Sx/currentS-1)>.02)throw Error('Sx ต่างจากหน้าตัดปัจจุบันเกิน 2%; ตรวจหน่วยและตารางให้ตรงกัน');const result=aiscF2(p);last.ltb={input:p,result,a,b};renderCheckStatus();
    $('ltbResult').innerHTML=`<h3>ผลการตรวจ F2 · ${p.method}</h3><p class="engineering-summary ${result.ok?'pass':'fail'}">${result.ok?'✓ ผ่าน':'✕ ไม่ผ่าน'} เฉพาะช่วง x = ${detailNumber(a/(isUS()?12:1))}–${detailNumber(b/(isUS()?12:1))} ${$('uL').value} · ใช้กำลัง ${detailNumber(result.utilization*100)}%</p><p>${esc(result.branch)} · Cb = ${detailNumber(p.Cb)}</p><table><tbody>${[['Lb',p.Lb,'mm'],['Lp',result.Lp,'mm'],['Lr',result.Lr,'mm'],['โมเมนต์ที่ต้องรับ',p.demand/1e6,'kN·m'],['Mn',result.Mn/1e6,'kN·m'],[p.method==='ASD'?'Mn / 1.67':'0.90 Mn',result.available/1e6,'kN·m'],['λf / λpf',result.flange/result.flangeLimit,''],['λw / λpw',result.web/result.webLimit,'']].map(([k,v,u])=>`<tr><th>${esc(k)}</th><td>${detailNumber(v)} ${u}</td></tr>`).join('')}</tbody></table><details><summary>ค่าคุณสมบัติที่ใช้คำนวณ · หน่วย MPa / mm</summary><pre>${esc(JSON.stringify(p,null,2))}</pre></details><p>ผลผ่านนี้ไม่ครอบคลุมช่วงอื่นของคาน ความแข็งแรงค้ำยัน จุดต่อ หรือเสถียรภาพโดยรวม ใช้ฐานแรง ${p.method} ที่ยืนยันโดยผู้ใช้</p>`;
  }catch(e){if(last)delete last.ltb;renderCheckStatus();$('ltbResult').textContent='ยังตัดสินไม่ได้: '+e.message;}
};
function clearEngineering(){stressState=null;comparisonState=null;if(last)delete last.ltb;$('advancedFeatures').hidden=true;['repairAdvice','candidateComparison','stressPicture','ltbResult'].forEach(id=>$(id).replaceChildren());}
document.addEventListener('input',e=>{if(e.target.closest('#matCard,#tab-1'))clearEngineering();if(e.target.closest('#ltbConfig')){if(last)delete last.ltb;$('ltbResult').textContent='ข้อมูลเปลี่ยนแล้ว ต้องตรวจใหม่';renderCheckStatus();}});
document.addEventListener('change',e=>{if(e.target.closest('#matCard,#tab-1'))clearEngineering();if(e.target.closest('#ltbConfig')){if(last)delete last.ltb;$('ltbResult').textContent='ข้อมูลเปลี่ยนแล้ว ต้องตรวจใหม่';renderCheckStatus();}});
$('advancedFeatures').hidden=true;
