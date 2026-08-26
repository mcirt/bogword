"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ScanBonus } from "./BoardScanner";

type PlayConfig={size:number;board:string[];bonuses:ScanBonus[];savedAt:number};
type PlayedWord={word:string;score:number;path:number[]};
type Phase="ready"|"playing"|"ended";

const POINTS:Record<string,number>={A:1,B:4,C:4,D:2,E:1,F:4,G:3,H:3,I:1,J:10,K:5,L:2,M:4,N:2,O:1,P:4,Q:10,R:1,S:1,T:1,U:2,V:5,W:4,X:10,Y:3,Z:10};
const TWO_LETTER_WORDS="AA AB AD AE AG AH AI AL AM AN AR AS AT AW AX AY BA BE BI BO BY DA DE DO ED EF EH EL EM EN ER ES ET EW EX FA FE GI GO GU HA HE HI HM HO ID IF IN IO IS IT JA JO KA KI KO KY LA LI LO MA ME MI MM MO MU MY NA NE NG NI NO NU OD OE OF OH OI OK OM ON OP OR OS OU OW OX OY PA PE PI PO QI RE SH SI SO TA TE TI TO UH UM UN UP US UT WE WO XI XU YA YE YO ZA".split(" ");

function loadConfig():PlayConfig|null{
  try{
    const value=JSON.parse(localStorage.getItem("boggle-play-board")||"null");
    if(!value||![3,4,5].includes(value.size)||!Array.isArray(value.board)||value.board.length!==value.size*value.size||!value.board.every((letter:unknown)=>typeof letter==="string"&&/^[A-Z]$/.test(letter)))return null;
    return{size:value.size,board:value.board,bonuses:Array.from({length:value.board.length},(_,i)=>["NONE","DL","DW","TL","TW"].includes(value.bonuses?.[i])?value.bonuses[i]:"NONE"),savedAt:value.savedAt||Date.now()};
  }catch{return null;}
}

function adjacent(a:number,b:number,size:number){const ar=Math.floor(a/size),ac=a%size,br=Math.floor(b/size),bc=b%size;return a!==b&&Math.abs(ar-br)<=1&&Math.abs(ac-bc)<=1;}
function wordFromPath(path:number[],board:string[]){return path.map(index=>board[index]==="Q"?"QU":board[index]).join("");}
function scorePath(path:number[],board:string[],bonuses:ScanBonus[]){let letters=0,multiplier=1;for(const index of path){const bonus=bonuses[index],value=POINTS[board[index]]||0;letters+=value*(bonus==="DL"?2:bonus==="TL"?3:1);if(bonus==="DW")multiplier*=2;if(bonus==="TW")multiplier*=3;}return letters*multiplier;}

export default function Game(){
  const [config]=useState(loadConfig),[dictionaryReady,setDictionaryReady]=useState(false),[phase,setPhase]=useState<Phase>("ready"),[seconds,setSeconds]=useState(60),[path,setPath]=useState<number[]>([]),[words,setWords]=useState<PlayedWord[]>([]),[score,setScore]=useState(0),[message,setMessage]=useState("Loading dictionary…");
  const dictionaryRef=useRef<Set<string>>(new Set()),foundRef=useRef<Set<string>>(new Set()),pathRef=useRef<number[]>([]),drawingRef=useRef(false),phaseRef=useRef<Phase>("ready");
  const currentWord=useMemo(()=>config?wordFromPath(path,config.board):"",[config,path]);

  useEffect(()=>{phaseRef.current=phase;},[phase]);
  useEffect(()=>{fetch("./words.txt").then(response=>{if(!response.ok)throw new Error();return response.text();}).then(text=>{dictionaryRef.current=new Set([...text.trim().split(/\s+/).map(word=>word.toUpperCase()),...TWO_LETTER_WORDS]);setDictionaryReady(true);setMessage("Press Start round when you are ready.");}).catch(()=>setMessage("The dictionary could not be loaded. Return to the solver and refresh."));},[]);
  useEffect(()=>{if(phase!=="playing")return;const timer=window.setInterval(()=>setSeconds(value=>{if(value<=1){window.clearInterval(timer);drawingRef.current=false;pathRef.current=[];setPath([]);setPhase("ended");setMessage("Time! Round complete.");return 0;}return value-1;}),1000);return()=>window.clearInterval(timer);},[phase]);

  function setCurrentPath(next:number[]){pathRef.current=next;setPath(next);}
  function beginTile(index:number,event:React.PointerEvent){if(phaseRef.current!=="playing")return;event.preventDefault();drawingRef.current=true;setCurrentPath([index]);}
  function addTile(index:number){if(!drawingRef.current||phaseRef.current!=="playing"||!config)return;const current=pathRef.current,last=current.at(-1);if(last===index)return;if(current.length>1&&current[current.length-2]===index){setCurrentPath(current.slice(0,-1));return;}if(last!==undefined&&adjacent(last,index,config.size)&&!current.includes(index))setCurrentPath([...current,index]);}
  function finishWord(){
    if(!drawingRef.current||!config)return;drawingRef.current=false;const completed=pathRef.current,word=wordFromPath(completed,config.board);setCurrentPath([]);
    if(phaseRef.current!=="playing"||!word)return;
    if(word.length<2){setMessage("Words need at least 2 letters.");return;}
    if(foundRef.current.has(word)){setMessage(`${word} was already found.`);return;}
    if(!dictionaryRef.current.has(word)){setMessage(`${word} is not in the dictionary.`);return;}
    const points=scorePath(completed,config.board,config.bonuses);foundRef.current.add(word);setWords(current=>[{word,score:points,path:completed},...current]);setScore(value=>value+points);setMessage(`${word}  +${points}`);
  }
  useEffect(()=>{
    const move=(event:PointerEvent)=>{if(!drawingRef.current)return;event.preventDefault();const element=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>("[data-game-tile]");if(element)addTile(Number(element.dataset.gameTile));};
    const end=()=>finishWord();window.addEventListener("pointermove",move,{passive:false});window.addEventListener("pointerup",end);window.addEventListener("pointercancel",end);return()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",end);window.removeEventListener("pointercancel",end);};
  });
  function startRound(){if(!dictionaryReady)return;foundRef.current.clear();setWords([]);setScore(0);setSeconds(60);setCurrentPath([]);setPhase("playing");setMessage("Trace adjacent letters to make words.");}

  if(!config)return <main className="missing-board"><h1>No board was received</h1><p>Return to the solver, fill every tile, and press <strong>Play entered board</strong>.</p><a href="./index.html">Return to solver</a></main>;
  const selected=new Map(path.map((tile,index)=>[tile,index+1]));
  return <main className="game-shell">
    <header className="game-top"><a href="./index.html">‹ Solver</a><div className={`game-clock ${seconds<=10&&phase==="playing"?"urgent":""}`}><span>TIME</span><strong>{seconds}</strong></div><div className="game-total"><span>SCORE</span><strong>{score}</strong></div><div className="game-build">v7.0</div></header>
    <section className="game-layout">
      <div className="game-main">
        <div className="round-label">60-SECOND ROUND</div>
        <div className={`word-display ${message.includes("not in")||message.includes("already")||message.includes("at least")?"rejected":""}`}>{currentWord||message}</div>
        <div className={`play-board phase-${phase}`} style={{gridTemplateColumns:`repeat(${config.size},1fr)`}} onContextMenu={event=>event.preventDefault()}>
          <svg className="trace-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{path.slice(1).map((tile,index)=>{const from=path[index],x1=((from%config.size)+.5)/config.size*100,y1=(Math.floor(from/config.size)+.5)/config.size*100,x2=((tile%config.size)+.5)/config.size*100,y2=(Math.floor(tile/config.size)+.5)/config.size*100;return <line key={`${from}-${tile}-${index}`} x1={x1} y1={y1} x2={x2} y2={y2}/>;})}</svg>
          {config.board.map((letter,index)=>{const bonus=config.bonuses[index],step=selected.get(index);return <button type="button" data-game-tile={index} onPointerDown={event=>beginTile(index,event)} onPointerEnter={()=>addTile(index)} className={`game-tile bonus-${bonus.toLowerCase()} ${step?"selected":""}`} key={index}><span className="game-letter">{letter==="Q"?"Qu":letter}</span><small>{POINTS[letter]}</small>{bonus!=="NONE"&&<b>{bonus}</b>}{step&&<i>{step}</i>}</button>;})}
          {phase!=="playing"&&<div className="round-overlay"><strong>{phase==="ended"?`${score} points`:"Your board is ready"}</strong><span>{phase==="ended"?`${words.length} words found`:"Trace through touching letters. A tile can be used only once per word."}</span><button onClick={startRound} disabled={!dictionaryReady}>{phase==="ended"?"Play again":"Start round"}</button></div>}
        </div>
        <p className="play-help">Drag across touching letters, including diagonals. Release to submit the word. Drag backward one tile to undo.</p>
      </div>
      <aside className="found-panel"><div className="found-heading"><div><span>WORDS FOUND</span><strong>{words.length}</strong></div><div><span>TOTAL</span><strong>{score}</strong></div></div><div className="found-list">{words.map((item,index)=><div className="found-word" key={item.word}><span>{words.length-index}</span><b>{item.word}</b><strong>+{item.score}</strong></div>)}{!words.length&&<p>Your discovered words will appear here.</p>}</div></aside>
    </section>
  </main>;
}
