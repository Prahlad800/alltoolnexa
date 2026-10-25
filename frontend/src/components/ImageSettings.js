'use client';
import {useEffect,useRef,useState} from 'react';

const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export default function ImageSettings({file,info,tool,values,onChange,locked,onLock,disabled}){
 const[url,setURL]=useState(''),drag=useRef(null);
 // Object URLs are browser resources and are released by this effect.
 // eslint-disable-next-line react-hooks/set-state-in-effect
 useEffect(()=>{const next=URL.createObjectURL(file);setURL(next);return()=>URL.revokeObjectURL(next);},[file]);
 const crop=tool.mode==='crop',picker=tool.mode==='pixel-color',w=info.width,h=info.height;
 const box={x:clamp(Number(values.a)||0,0,w-1),y:clamp(Number(values.b)||0,0,h-1),width:clamp(Number(values.c)||1,1,w),height:clamp(Number(values.d)||1,1,h)};
 function point(e){const r=e.currentTarget.getBoundingClientRect();return {x:clamp(Math.floor((e.clientX-r.left)*w/r.width),0,w-1),y:clamp(Math.floor((e.clientY-r.top)*h/r.height),0,h-1)};}
 function select(e){if(disabled||(!crop&&!picker))return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);const p=point(e);if(picker){onChange({a:String(p.x),b:String(p.y)});return;}const mode=e.target.dataset.handle||'draw';drag.current={...p,mode,box};if(mode==='draw')onChange({a:String(p.x),b:String(p.y),c:'1',d:'1'});}
 function move(e){if(!drag.current||disabled)return;const p=point(e),start=drag.current,b=start.box,dx=p.x-start.x,dy=p.y-start.y;let x,y,width,height;
  if(start.mode==='move'){x=clamp(b.x+dx,0,w-b.width);y=clamp(b.y+dy,0,h-b.height);width=b.width;height=b.height;}
  else if(start.mode==='resize'){x=b.x;y=b.y;width=clamp(b.width+dx,1,w-x);height=clamp(b.height+dy,1,h-y);}
  else{x=Math.min(start.x,p.x);y=Math.min(start.y,p.y);width=Math.abs(p.x-start.x)+1;height=Math.abs(p.y-start.y)+1;}
  onChange({a:String(x),b:String(y),c:String(width),d:String(height)});
 }
 function keys(e){if(disabled||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const dx=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0,dy=e.key==='ArrowDown'?1:e.key==='ArrowUp'?-1:0;
  if(crop&&e.shiftKey)onChange({c:String(clamp(box.width+dx,1,w-box.x)),d:String(clamp(box.height+dy,1,h-box.y))});
  else onChange({a:String(clamp((Number(values.a)||0)+dx,0,w-(crop?box.width:1))),b:String(clamp((Number(values.b)||0)+dy,0,h-(crop?box.height:1)))});
 }
 return <section className="input-preview" aria-label="Original image"><p>Original: {w} × {h} px</p><div className={`image-stage ${crop||picker?'interactive':''}`} tabIndex={crop||picker?0:undefined} role={crop||picker?'group':undefined} aria-label={crop?'Crop selection. Drag to select; arrows move; Shift and arrows resize.':picker?'Pixel picker. Click or tap a point; arrows move one pixel.':undefined} onPointerDown={select} onPointerMove={move} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} onKeyDown={keys}>
  {url&&<img src={url} alt="Original input" draggable={false}/>}
  {crop&&<div data-handle="move" className="crop-box" style={{left:box.x/w*100+'%',top:box.y/h*100+'%',width:Math.min(box.width,w-box.x)/w*100+'%',height:Math.min(box.height,h-box.y)/h*100+'%'}}><span data-handle="resize" className="crop-handle"/></div>}
  {picker&&<span className="pixel-marker" style={{left:(Number(values.a)||0)/w*100+'%',top:(Number(values.b)||0)/h*100+'%'}}/>}
 </div>{crop&&<><p className="hint">Drag to select. Drag the selection to move, or its corner to resize. Arrow keys move; Shift + arrows resize. Numeric controls below use original pixels.</p><label className="field"><span>Crop preset</span><select disabled={disabled} defaultValue="" onChange={e=>{if(!e.target.value)return;const ratio=Number(e.target.value),width=Math.min(w,Math.floor(h*ratio)),height=Math.min(h,Math.floor(width/ratio));onChange({a:String(Math.floor((w-width)/2)),b:String(Math.floor((h-height)/2)),c:String(width),d:String(height)});}}><option value="">Custom</option><option value="1">Square 1:1</option><option value="1.77777778">Landscape 16:9</option><option value="0.75">Portrait 3:4</option></select></label></>}
 {picker&&<p className="hint">Click or tap a pixel, or use arrow keys. Selected pixel: {values.a}, {values.b}. Numeric controls below remain available.</p>}
 {tool.mode==='resize'&&<label className="check-field"><input type="checkbox" checked={locked} disabled={disabled} onChange={e=>onLock(e.target.checked)}/>Lock aspect ratio{!locked&&<span>Stretch: width and height change independently.</span>}</label>}
 {tool.id==='image-compressor'&&<fieldset disabled={disabled}><legend>Maximum file size</legend><div className="form-actions">{[20,50,100,200].map(kb=><button className="button secondary" type="button" key={kb} aria-pressed={Number(values.targetKB)===kb} onClick={()=>onChange({targetKB:String(kb)})}>{kb} KB</button>)}</div><p className="hint">1 KB = 1,000 bytes. Dimensions stay unchanged; quality may decrease. If the target cannot be reached, resize first. Check your form&apos;s required format and dimensions before submitting.</p></fieldset>}
 {url&&<a href={url} download={file.name} className="inline-link">Download original</a>}
 </section>;
}
