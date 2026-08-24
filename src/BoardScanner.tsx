"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";

export type ScanBonus = "NONE" | "DL" | "DW" | "TL" | "TW";
type ScanCell = { letter: string; bonus: ScanBonus; confidence: number };

declare global { interface Window { cv?: any; } }

let openCvPromise: Promise<any> | null = null;

function cvIsReady() {
  const cv = window.cv;
  return !!(cv && typeof cv.Mat === "function" && typeof cv.imread === "function" && typeof cv.findContours === "function");
}

function loadOpenCv() {
  if (cvIsReady()) return Promise.resolve(window.cv);
  if (openCvPromise) return openCvPromise;
  openCvPromise = new Promise((resolve, reject) => {
    const started = Date.now();
    const finish = () => {
      if (cvIsReady()) { resolve(window.cv); return true; }
      const candidate = window.cv;
      if (candidate && typeof candidate.then === "function") {
        try { candidate.then((ready: any) => { if (ready) window.cv = ready; if (cvIsReady()) resolve(window.cv); }); } catch { /* polling remains active */ }
      }
      return false;
    };
    const poll = window.setInterval(() => {
      if (finish()) window.clearInterval(poll);
      else if (Date.now() - started > 120000) { window.clearInterval(poll); openCvPromise = null; reject(new Error("OpenCV took too long to load.")); }
    }, 100);
    let script = document.querySelector<HTMLScriptElement>('script[data-boggle-opencv="true"]');
    if (!script) {
      script = document.createElement("script");
      script.src = "./opencv.js";
      script.async = true;
      script.dataset.boggleOpencv = "true";
      script.onerror = () => { window.clearInterval(poll); openCvPromise = null; reject(new Error("OpenCV could not be loaded.")); };
      script.onload = finish;
      document.head.appendChild(script);
    } else finish();
  });
  return openCvPromise;
}

function centerSquare(canvas: HTMLCanvasElement) {
  const side = Math.round(Math.min(canvas.width, canvas.height) * .9);
  return { x: Math.round((canvas.width-side)/2), y: Math.round((canvas.height-side)/2), width: side, height: side };
}

function detectBoard(canvas: HTMLCanvasElement, cv: any) {
  let src:any, gray:any, blur:any, edges:any, contours:any, hierarchy:any;
  try {
    src=cv.imread(canvas); gray=new cv.Mat(); blur=new cv.Mat(); edges=new cv.Mat(); contours=new cv.MatVector(); hierarchy=new cv.Mat();
    cv.cvtColor(src,gray,cv.COLOR_RGBA2GRAY); cv.GaussianBlur(gray,blur,new cv.Size(7,7),0); cv.Canny(blur,edges,45,130);
    cv.findContours(edges,contours,hierarchy,cv.RETR_LIST,cv.CHAIN_APPROX_SIMPLE);
    const imageArea=canvas.width*canvas.height, cx=canvas.width/2, cy=canvas.height/2;
    let best:null|{x:number;y:number;width:number;height:number;score:number}=null;
    for(let i=0;i<contours.size();i++){
      const contour=contours.get(i), perimeter=cv.arcLength(contour,true), approx=new cv.Mat();
      cv.approxPolyDP(contour,approx,.025*perimeter,true);
      const rect=cv.boundingRect(approx), area=rect.width*rect.height, ratio=rect.width/Math.max(1,rect.height);
      approx.delete(); contour.delete();
      if(area<imageArea*.12||area>imageArea*.93||ratio<.72||ratio>1.38)continue;
      const dx=(rect.x+rect.width/2-cx)/canvas.width,dy=(rect.y+rect.height/2-cy)/canvas.height;
      const centered=Math.max(.15,1-Math.sqrt(dx*dx+dy*dy)*1.7), square=1-Math.min(.8,Math.abs(Math.log(ratio))), score=area*centered*square;
      if(!best||score>best.score)best={...rect,score};
    }
    if(!best)return centerSquare(canvas);
    const pad=Math.round(Math.min(best.width,best.height)*.015);
    return {x:Math.max(0,best.x-pad),y:Math.max(0,best.y-pad),width:Math.min(canvas.width-best.x+pad,best.width+pad*2),height:Math.min(canvas.height-best.y+pad,best.height+pad*2)};
  } finally { if(hierarchy)hierarchy.delete();if(contours)contours.delete();if(edges)edges.delete();if(blur)blur.delete();if(gray)gray.delete();if(src)src.delete(); }
}

function cropBoard(source: HTMLCanvasElement, rect:{x:number;y:number;width:number;height:number}) {
  const output=document.createElement("canvas"); output.width=720; output.height=720;
  output.getContext("2d",{alpha:false})!.drawImage(source,rect.x,rect.y,rect.width,rect.height,0,0,720,720);
  return output;
}

function tileRects(board:HTMLCanvasElement,size:number,cv:any){
  const fixed=()=>{const marginX=board.width*.115,marginY=board.height*.115,pitchX=(board.width-marginX*2)/size,pitchY=(board.height-marginY*2)/size;return Array.from({length:size*size},(_,i)=>({x:marginX+(i%size)*pitchX+pitchX*.07,y:marginY+Math.floor(i/size)*pitchY+pitchY*.07,width:pitchX*.86,height:pitchY*.86}));};
  let src:any,gray:any,edges:any,contours:any,hierarchy:any;
  try{
    src=cv.imread(board);gray=new cv.Mat();edges=new cv.Mat();contours=new cv.MatVector();hierarchy=new cv.Mat();
    cv.cvtColor(src,gray,cv.COLOR_RGBA2GRAY);cv.Canny(gray,edges,35,115);cv.findContours(edges,contours,hierarchy,cv.RETR_LIST,cv.CHAIN_APPROX_SIMPLE);
    const min=board.width/(size*1.75),max=board.width/(size*.72),candidates:Array<{x:number;y:number;width:number;height:number}> = [];
    for(let i=0;i<contours.size();i++){const c=contours.get(i),r=cv.boundingRect(c);c.delete();const ratio=r.width/Math.max(1,r.height);if(r.width>=min&&r.width<=max&&r.height>=min&&r.height<=max&&ratio>.68&&ratio<1.45)candidates.push(r);}
    const expected=fixed(),picked=expected.map(e=>{const ex=e.x+e.width/2,ey=e.y+e.height/2,pitch=board.width/size;let best:any=null,dist=Infinity;for(const c of candidates){const d=Math.hypot(c.x+c.width/2-ex,c.y+c.height/2-ey);if(d<dist){dist=d;best=c;}}return best&&dist<pitch*.48?best:e;});
    return picked;
  }catch{return fixed();}finally{if(hierarchy)hierarchy.delete();if(contours)contours.delete();if(edges)edges.delete();if(gray)gray.delete();if(src)src.delete();}
}

function glyphBitmap(canvas:HTMLCanvasElement){
  const ctx=canvas.getContext("2d",{willReadFrequently:true})!,w=canvas.width,h=canvas.height,data=ctx.getImageData(0,0,w,h).data;
  const pixels:Array<[number,number]>=[];const x0=Math.round(w*.15),x1=Math.round(w*.85),y0=Math.round(h*.1),y1=Math.round(h*.88);
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const p=(y*w+x)*4,lum=data[p]*.299+data[p+1]*.587+data[p+2]*.114;if(lum<105)pixels.push([x,y]);}
  if(pixels.length<8)return new Uint8Array(32*32);
  let minX=w,maxX=0,minY=h,maxY=0;for(const [x,y] of pixels){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
  const bw=maxX-minX+1,bh=maxY-minY+1,scale=Math.min(26/bw,26/bh),ox=(32-bw*scale)/2,oy=(32-bh*scale)/2,out=new Uint8Array(1024);
  for(const [x,y] of pixels){const nx=Math.round(ox+(x-minX)*scale),ny=Math.round(oy+(y-minY)*scale);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const px=nx+dx,py=ny+dy;if(px>=0&&px<32&&py>=0&&py<32)out[py*32+px]=1;}}
  return out;
}

let templates:Record<string,Uint8Array[]>|null=null;
function letterTemplates(){
  if(templates)return templates;templates={};
  for(const letter of "ABCDEFGHIJKLMNOPQRSTUVWXYZ"){
    templates[letter]=[];
    for(const font of ["Arial Black","Arial","Helvetica"]){const c=document.createElement("canvas");c.width=96;c.height=96;const x=c.getContext("2d")!;x.fillStyle="#fff";x.fillRect(0,0,96,96);x.fillStyle="#000";x.font=`900 72px ${font}`;x.textAlign="center";x.textBaseline="middle";x.fillText(letter,48,51);templates[letter].push(glyphBitmap(c));}
  }
  return templates;
}

function bitmapDistance(a:Uint8Array,b:Uint8Array){let mismatch=0,union=0;for(let i=0;i<a.length;i++){if(a[i]||b[i])union++;if(a[i]!==b[i])mismatch++;}return union?mismatch/union:1;}
function recognizeLetter(tile:HTMLCanvasElement){
  const sample=glyphBitmap(tile),all=letterTemplates(),ranked=Object.entries(all).map(([letter,variants])=>({letter,score:Math.min(...variants.map(v=>bitmapDistance(sample,v)))})).sort((a,b)=>a.score-b.score);
  const best=ranked[0],second=ranked[1],confidence=Math.max(.05,Math.min(.99,.55+(second.score-best.score)*1.9+(1-best.score)*.25));
  return {letter:best.letter,confidence};
}

function detectBonus(tile:HTMLCanvasElement):ScanBonus{
  const ctx=tile.getContext("2d",{willReadFrequently:true})!,data=ctx.getImageData(0,0,tile.width,tile.height).data;let r=0,g=0,b=0,n=0;
  for(let y=0;y<tile.height;y+=3)for(let x=0;x<tile.width;x+=3){const edge=x<tile.width*.22||x>tile.width*.78||y<tile.height*.22||y>tile.height*.78;if(!edge)continue;const p=(y*tile.width+x)*4;r+=data[p];g+=data[p+1];b+=data[p+2];n++;}
  r/=n;g/=n;b/=n;const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,s=max?d/max:0;if(s<.22||max<75)return "NONE";
  let hue=0;if(d){if(max===r)hue=((g-b)/d)%6;else if(max===g)hue=(b-r)/d+2;else hue=(r-g)/d+4;hue=(hue*60+360)%360;}
  if(hue>=185&&hue<=245)return "DL";if(hue>=300||hue<15)return "DW";if(hue>=85&&hue<185)return "TL";if(hue>=15&&hue<85)return "TW";return "NONE";
}

function analyzeBoard(source:HTMLCanvasElement,size:number,cv:any){
  const rect=detectBoard(source,cv),board=cropBoard(source,rect),rects=tileRects(board,size,cv),cells:ScanCell[]=[];
  for(const r of rects){const tile=document.createElement("canvas");tile.width=120;tile.height=120;tile.getContext("2d",{alpha:false})!.drawImage(board,r.x,r.y,r.width,r.height,0,0,120,120);const guess=recognizeLetter(tile);cells.push({...guess,bonus:detectBonus(tile)});}
  return {board,cells};
}

export default function BoardScanner({size,onApply}:{size:number;onApply:(letters:string[],bonuses:ScanBonus[])=>void}){
  const [open,setOpen]=useState(false),[stage,setStage]=useState<"camera"|"working"|"review">("camera"),[status,setStatus]=useState("Camera is not running."),[cells,setCells]=useState<ScanCell[]>([]);
  const videoRef=useRef<HTMLVideoElement|null>(null),canvasRef=useRef<HTMLCanvasElement|null>(null),fileRef=useRef<HTMLInputElement|null>(null),streamRef=useRef<MediaStream|null>(null);
  const stopCamera=()=>{streamRef.current?.getTracks().forEach(t=>t.stop());streamRef.current=null;if(videoRef.current)videoRef.current.srcObject=null;};
  useEffect(()=>()=>stopCamera(),[]);

  async function startCamera(){
    setOpen(true);setStage("camera");setStatus("Loading OpenCV and requesting the rear camera…");
    try{await loadOpenCv();if(!navigator.mediaDevices?.getUserMedia)throw new Error("This browser does not provide an in-page camera.");stopCamera();const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:"environment"},width:{ideal:1920},height:{ideal:1080}}});streamRef.current=stream;if(videoRef.current){videoRef.current.srcObject=stream;await videoRef.current.play();}setStatus(`Align the full ${size}×${size} board inside the guide, then capture.`);}catch(error:any){setStatus(error?.name==="NotAllowedError"?"Camera permission was denied. Allow camera access for this site, then try again.":error?.message||"Camera could not start.");}
  }
  function capture(){const video=videoRef.current,canvas=canvasRef.current;if(!video||!canvas||!video.videoWidth)return;const scale=Math.min(1,1400/video.videoWidth);canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);canvas.getContext("2d",{alpha:false})!.drawImage(video,0,0,canvas.width,canvas.height);stopCamera();void process(canvas);}
  async function choosePhoto(event:ChangeEvent<HTMLInputElement>){const file=event.target.files?.[0];if(!file)return;setOpen(true);setStage("working");setStatus("Reading photo…");const url=URL.createObjectURL(file),img=new Image();img.onload=()=>{const canvas=canvasRef.current!;const scale=Math.min(1,1400/img.width);canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);canvas.getContext("2d",{alpha:false})!.drawImage(img,0,0,canvas.width,canvas.height);URL.revokeObjectURL(url);void process(canvas);};img.onerror=()=>setStatus("That photo could not be opened.");img.src=url;event.target.value="";}
  async function process(canvas:HTMLCanvasElement){setStage("working");setStatus("OpenCV is locating the board and reading its tiles…");try{const cv=await loadOpenCv(),result=analyzeBoard(canvas,size,cv);canvas.width=result.board.width;canvas.height=result.board.height;canvas.getContext("2d")!.drawImage(result.board,0,0);setCells(result.cells);setStage("review");const uncertain=result.cells.filter(c=>c.confidence<.68).length;setStatus(uncertain?`${uncertain} letter${uncertain===1?" is":"s are"} uncertain. Check every tile before applying.`:"Board recognized. Check the letters and bonuses, then apply.");}catch(error:any){setStage("camera");setStatus(`Scan failed: ${error?.message||error}`);}}
  function close(){stopCamera();setOpen(false);}
  function updateCell(index:number,patch:Partial<ScanCell>){setCells(current=>current.map((cell,i)=>i===index?{...cell,...patch}:cell));}
  function apply(){if(cells.length!==size*size||cells.some(c=>!/^[A-Z]$/.test(c.letter))){setStatus("Every tile needs one letter before applying.");return;}onApply(cells.map(c=>c.letter),cells.map(c=>c.bonus));close();}

  return <>
    <div className="scanner-launch"><button type="button" onClick={startCamera}>◉ Scan board</button><button type="button" className="photo-button" onClick={()=>fileRef.current?.click()}>Use photo</button><input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={choosePhoto} hidden/><span>Camera + OpenCV</span></div>
    {open&&<div className="scanner-dialog" role="dialog" aria-modal="true" aria-label="Scan Boggle board"><div className="scanner-card">
      <div className="scanner-title"><div><span>BOARD SCANNER</span><h2>Scan {size}×{size} board</h2></div><button onClick={close} aria-label="Close scanner">×</button></div>
      {stage==="camera"&&<><div className="camera-wrap"><video ref={videoRef} playsInline muted/><div className="camera-guide" style={{gridTemplateColumns:`repeat(${size},1fr)`}}>{Array.from({length:size*size},(_,i)=><i key={i}/>)}</div></div><div className="scanner-actions"><button className="capture-button" onClick={capture}>Capture board</button><button onClick={()=>fileRef.current?.click()}>Choose photo</button></div></>}
      {stage==="working"&&<div className="scanner-working"><i/><strong>Reading the board…</strong><p>The first OpenCV load may take a little longer.</p></div>}
      <canvas ref={canvasRef} className={stage==="review"?"scanner-preview":"scanner-canvas-hidden"}/>
      {stage==="review"&&<><div className="scan-review" style={{gridTemplateColumns:`repeat(${size},1fr)`}}>{cells.map((cell,index)=><div className={cell.confidence<.68?"scan-cell uncertain":"scan-cell"} key={index}><label><span>Tile {index+1}</span><input value={cell.letter} maxLength={1} onChange={e=>updateCell(index,{letter:e.target.value.replace(/[^a-z]/gi,"").slice(-1).toUpperCase(),confidence:1})}/></label><select value={cell.bonus} onChange={e=>updateCell(index,{bonus:e.target.value as ScanBonus})} aria-label={`Bonus for tile ${index+1}`}><option>NONE</option><option>DL</option><option>DW</option><option>TL</option><option>TW</option></select></div>)}</div><div className="scanner-actions"><button className="apply-scan" onClick={apply}>Apply board</button><button onClick={startCamera}>Retake</button></div></>}
      <p className="scanner-status" role="status">{status}</p>
    </div></div>}
  </>;
}
