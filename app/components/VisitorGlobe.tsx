import {useEffect,useRef,useState} from 'react';
import {geoOrthographic,geoPath,geoGraticule10,geoDistance} from 'd3-geo';
import type {GeoPermissibleObjects} from 'd3-geo';
import world from '../lib/world-map.json';

type Country={code:string;visits:number;active?:number};
const centers=world.centers as unknown as Record<string,[number,number]>;
const names=new Intl.DisplayNames(['tr'],{type:'region'});
export default function VisitorGlobe({countries,selected,onSelect}:{countries:Country[];selected:string;onSelect:(code:string)=>void}){
 const canvas=useRef<HTMLCanvasElement>(null),rotation=useRef<[number,number]>([-25,-18]);
 const [reduced,setReduced]=useState(false),[hover,setHover]=useState('');
 const current=useRef({countries,selected,onSelect,reduced});current.current={countries,selected,onSelect,reduced};
 useEffect(()=>{const query=matchMedia('(prefers-reduced-motion: reduce)');const update=()=>setReduced(query.matches);update();query.addEventListener('change',update);return()=>query.removeEventListener('change',update);},[]);
 useEffect(()=>{if(selected&&centers[selected])rotation.current=[-centers[selected][0],-centers[selected][1]];},[selected]);
 useEffect(()=>{
  const node=canvas.current,ctx=node?.getContext('2d');if(!node||!ctx)return;
  let width=0,height=0,frame=0,last=0,over=false,visible=true,drag:{x:number;y:number;startX:number;startY:number;moved:boolean}|null=null;
  let dots:{x:number;y:number;code:string}[]=[];
  const projection=geoOrthographic().clipAngle(90),path=geoPath(projection,ctx),grid=geoGraticule10();
  const size=()=>{width=node.clientWidth;height=node.clientHeight;const dpr=Math.min(devicePixelRatio||1,2);node.width=Math.round(width*dpr);node.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);};
  const resize=new ResizeObserver(size);resize.observe(node);size();
  const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;});observer.observe(node);
  const draw=(time:number)=>{
   frame=requestAnimationFrame(draw);const elapsed=Math.min(time-last,100);if(time-last<32)return;last=time;
   if(!visible||document.hidden||!width)return;
   const state=current.current,animate=!state.reduced&&!over&&!drag&&!state.selected;
   if(animate)rotation.current[0]=(rotation.current[0]+elapsed*.003)%360;
   const radius=Math.min(width*.43,height*.43);projection.translate([width/2,height/2]).scale(radius).rotate([...rotation.current,0]);
   ctx.clearRect(0,0,width,height);
   const halo=ctx.createRadialGradient(width/2,height/2,radius*.92,width/2,height/2,radius*1.15);halo.addColorStop(0,'rgba(56,189,248,.18)');halo.addColorStop(1,'rgba(56,189,248,0)');ctx.fillStyle=halo;ctx.fillRect(0,0,width,height);
   ctx.beginPath();path({type:'Sphere'});ctx.fillStyle='#0e263b';ctx.fill();ctx.strokeStyle='#355975';ctx.lineWidth=1;ctx.stroke();
   ctx.beginPath();path(grid);ctx.strokeStyle='rgba(112,155,180,.15)';ctx.lineWidth=.6;ctx.stroke();
   ctx.beginPath();path(world.land as GeoPermissibleObjects);ctx.fillStyle='#254d63';ctx.fill();ctx.strokeStyle='#477087';ctx.lineWidth=.5;ctx.stroke();
   dots=[];
   for(const country of state.countries){
    const point=centers[country.code];if(!point||geoDistance(point,[-rotation.current[0],-rotation.current[1]])>Math.PI/2)continue;
    const position=projection(point);if(!position)continue;const [x,y]=position;dots.push({x,y,code:country.code});
    const active=Boolean(country.active),r=Math.min(10,4+Math.sqrt(country.visits));
    if(active){const pulse=state.reduced?0.4:(time%2200)/2200;ctx.beginPath();ctx.arc(x,y,r+3+pulse*12,0,Math.PI*2);ctx.strokeStyle=`rgba(110,231,183,${.6*(1-pulse)})`;ctx.lineWidth=1.5;ctx.stroke();}
    ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=state.selected===country.code?'#fff':active?'#6ee7b7':'#7dd3fc';ctx.fill();ctx.strokeStyle='#082438';ctx.lineWidth=2;ctx.stroke();
   }
  };
  frame=requestAnimationFrame(draw);
  const position=(e:PointerEvent)=>{const rect=node.getBoundingClientRect();return {x:e.clientX-rect.left,y:e.clientY-rect.top};};
  const hit=(x:number,y:number)=>dots.find(d=>Math.hypot(d.x-x,d.y-y)<18)?.code||'';
  const down=(e:PointerEvent)=>{const p=position(e);drag={...p,startX:p.x,startY:p.y,moved:false};node.setPointerCapture(e.pointerId);};
  const move=(e:PointerEvent)=>{const p=position(e);if(drag){rotation.current=[rotation.current[0]+(p.x-drag.x)*.4,Math.max(-80,Math.min(80,rotation.current[1]-(p.y-drag.y)*.4))];drag.moved ||=Math.hypot(p.x-drag.startX,p.y-drag.startY)>5;drag.x=p.x;drag.y=p.y;}else setHover(hit(p.x,p.y));};
  const up=(e:PointerEvent)=>{if(drag&&!drag.moved){const p=position(e),code=hit(p.x,p.y);if(code)current.current.onSelect(current.current.selected===code?'':code);}drag=null;if(node.hasPointerCapture(e.pointerId))node.releasePointerCapture(e.pointerId);};
  const enter=()=>{over=true;};const leave=()=>{over=false;setHover('');};const cancel=()=>{drag=null;};
  node.addEventListener('pointerdown',down);node.addEventListener('pointermove',move);node.addEventListener('pointerup',up);node.addEventListener('pointercancel',cancel);node.addEventListener('pointerenter',enter);node.addEventListener('pointerleave',leave);
  return()=>{cancelAnimationFrame(frame);resize.disconnect();observer.disconnect();node.removeEventListener('pointerdown',down);node.removeEventListener('pointermove',move);node.removeEventListener('pointerup',up);node.removeEventListener('pointercancel',cancel);node.removeEventListener('pointerenter',enter);node.removeEventListener('pointerleave',leave);};
 },[]);
 const focused=countries.find(c=>c.code===(hover||selected)),unmapped=countries.filter(c=>!centers[c.code]).reduce((sum,c)=>sum+c.visits,0);
 return <section className="visitor-globe analytics-card">
  <div className="globe-heading"><div><span className="globe-eyebrow">ZİYARET HARİTASI</span><h3>Dünya genelinde</h3><p>Yeşil noktalar · Son 5 dakika</p></div></div>
  <div className="globe-stage"><canvas ref={canvas} role="img" aria-label="Ülkelere göre ziyaretleri gösteren dönen dünya küresi. Aynı ülkeler aşağıdaki düğmelerden seçilebilir."/><div className="globe-caption" aria-live="polite">{focused?<><strong>{names.of(focused.code)||focused.code}</strong><span>{focused.visits} ziyaret · {focused.active||0} son 5 dakika</span></>:<><strong>{countries.filter(c=>c.code!=='ZZ').length} ülke</strong><span>{reduced?'Hareket azaltma tercihi etkin':selected?'Seçili ülke sabitlendi':'Sürükleyerek dünyayı çevirin'}</span></>}</div></div>
  <div className="globe-footer"><span>Yaklaşık ülke konumu</span>{unmapped>0&&<span>{unmapped} ziyaret haritada konumlandırılamadı; ülke listesinde bulunur.</span>}<small>Natural Earth</small></div>
 </section>;
}
