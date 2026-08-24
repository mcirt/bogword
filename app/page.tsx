"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import BoardScanner, { type ScanBonus } from "./BoardScanner";

type FoundWord = { word: string; path: number[]; score: number };
type SortMode = "length" | "score" | "alpha";
type Bonus = ScanBonus;

const POINTS: Record<string, number> = { A:1,B:4,C:4,D:2,E:1,F:4,G:3,H:3,I:1,J:10,K:5,L:2,M:4,N:2,O:1,P:4,Q:10,R:1,S:1,T:1,U:2,V:5,W:4,X:10,Y:3,Z:10 };
const DICE = ["AAEEGN","ABBJOO","ACHOPS","AFFKPS","AOOTTW","CIMOTU","DEILRX","DELRVY","DISTTY","EEGHNW","EEINSU","EHRTVW","EIOSST","ELRTTY","HIMNQU","HLNNRZ","AEANEG","AHSPCO","ASPFFK","OBJOAB","IOTMUC","RYVDEL","LREIXD","WNEGEH","LNHNRZ"];
const SAMPLE = "S T A R E L I N P O G D B E S T".split(" ");
const BONUS_OPTIONS: Bonus[] = ["NONE", "DL", "DW", "TL", "TW"];

function nearby(index: number, size: number) {
  const row = Math.floor(index / size), col = index % size, result: number[] = [];
  for (let dr=-1; dr<=1; dr++) for (let dc=-1; dc<=1; dc++) {
    if (!dr && !dc) continue;
    const r=row+dr, c=col+dc;
    if (r>=0 && r<size && c>=0 && c<size) result.push(r*size+c);
  }
  return result;
}

function findPath(word: string, board: string[], size: number): number[] | null {
  const used = new Set<number>();
  function visit(index: number, at: number, path: number[]): number[] | null {
    const tile = board[index] === "Q" ? "QU" : board[index];
    if (!word.startsWith(tile, at)) return null;
    const nextAt = at + tile.length, nextPath = [...path, index];
    if (nextAt === word.length) return nextPath;
    used.add(index);
    for (const next of nearby(index, size)) if (!used.has(next)) {
      const answer = visit(next, nextAt, nextPath);
      if (answer) { used.delete(index); return answer; }
    }
    used.delete(index);
    return null;
  }
  for (let i=0; i<board.length; i++) { const answer=visit(i,0,[]); if (answer) return answer; }
  return null;
}

function canFit(word: string, counts: Record<string, number>) {
  const needed: Record<string, number> = {};
  for (const letter of word) needed[letter] = (needed[letter] ?? 0) + 1;
  return Object.entries(needed).every(([letter,count]) => count <= (counts[letter] ?? 0));
}

function scorePath(path: number[], board: string[], bonuses: Bonus[]) {
  let letterTotal = 0, wordMultiplier = 1;
  for (const index of path) {
    const bonus = bonuses[index], value = POINTS[board[index]] ?? 0;
    letterTotal += value * (bonus === "DL" ? 2 : bonus === "TL" ? 3 : 1);
    if (bonus === "DW") wordMultiplier *= 2;
    if (bonus === "TW") wordMultiplier *= 3;
  }
  return letterTotal * wordMultiplier;
}

export default function Home() {
  const [size,setSize]=useState(4), [board,setBoard]=useState<string[]>(SAMPLE);
  const [dictionary,setDictionary]=useState<string[]>([]), [results,setResults]=useState<FoundWord[]>([]);
  const [selected,setSelected]=useState<FoundWord|null>(null), [sortMode,setSortMode]=useState<SortMode>("length"), [query,setQuery]=useState("");
  const [message,setMessage]=useState("Loading word list…"), [solving,setSolving]=useState(false);
  const [bonuses,setBonuses]=useState<Bonus[]>(Array(16).fill("NONE")), [activeTile,setActiveTile]=useState(0);
  const inputs=useRef<Array<HTMLInputElement|null>>([]);
  const activeTileRef=useRef(0);

  useEffect(()=>{ fetch("/words.txt").then(r=>{if(!r.ok) throw new Error(); return r.text();}).then(text=>{setDictionary(text.trim().split("\n"));setMessage("Ready — enter your board or use the sample.");}).catch(()=>setMessage("The word list could not be loaded. Refresh and try again.")); },[]);
  const highlighted=useMemo(()=>new Map((selected?.path??[]).map((tile,step)=>[tile,step+1])),[selected]);
  const visibleResults=useMemo(()=>{
    const filtered=query?results.filter(item=>item.word.includes(query.toUpperCase())):results;
    return [...filtered].sort((a,b)=>sortMode==="alpha"?a.word.localeCompare(b.word):sortMode==="score"?b.score-a.score||b.word.length-a.word.length||a.word.localeCompare(b.word):b.word.length-a.word.length||b.score-a.score||a.word.localeCompare(b.word));
  },[results,query,sortMode]);

  function selectTile(index:number){activeTileRef.current=index;setActiveTile(index);}
  function changeSize(next:number){setSize(next);setBoard(Array(next*next).fill(""));setBonuses(Array(next*next).fill("NONE"));selectTile(0);setResults([]);setSelected(null);setMessage(`Ready for a ${next} × ${next} board.`);setTimeout(()=>inputs.current[0]?.focus(),0);}
  function updateTile(index:number,value:string){const letter=value.replace(/[^a-z]/gi,"").slice(-1).toUpperCase(),next=[...board];next[index]=letter;setBoard(next);setResults([]);setSelected(null);if(letter&&index<board.length-1){selectTile(index+1);inputs.current[index+1]?.focus();}else selectTile(index);}
  function handleKey(index:number,key:string){if(key==="Backspace"&&!board[index]&&index>0){selectTile(index-1);inputs.current[index-1]?.focus();}if(key==="ArrowLeft"&&index>0){selectTile(index-1);inputs.current[index-1]?.focus();}if(key==="ArrowRight"&&index<board.length-1){selectTile(index+1);inputs.current[index+1]?.focus();}if(key==="Enter"&&board.every(Boolean))solve();}
  function setTileBonus(bonus:Bonus){const target=activeTileRef.current,next=[...bonuses];next[target]=bonus;setBonuses(next);setResults(current=>current.map(item=>({...item,score:scorePath(item.path,board,next)})));setSelected(current=>current?{...current,score:scorePath(current.path,board,next)}:null);setMessage(`${bonus==="NONE"?"Bonus removed from":`${bonus} applied to`} tile ${target+1}.`);}
  function clearBoard(){setBoard(Array(size*size).fill(""));setBonuses(Array(size*size).fill("NONE"));selectTile(0);setResults([]);setSelected(null);setQuery("");setMessage("Board cleared. Type the letters left to right.");setTimeout(()=>inputs.current[0]?.focus(),0);}
  function loadSample(){setSize(4);setBoard(SAMPLE);setBonuses(Array(16).fill("NONE"));selectTile(0);setResults([]);setSelected(null);setMessage("Sample board loaded. Press Solve.");}
  function shuffleBoard(){const dice=DICE.slice(0,size*size).sort(()=>Math.random()-.5);setBoard(dice.map(die=>die[Math.floor(Math.random()*die.length)]));setBonuses(Array(size*size).fill("NONE"));selectTile(0);setResults([]);setSelected(null);setMessage("New board shuffled. Press Solve.");}
  function applyScan(letters:string[],scannedBonuses:ScanBonus[]){setBoard(letters);setBonuses(scannedBonuses);selectTile(0);setResults([]);setSelected(null);setQuery("");setMessage(`Scanned ${size} × ${size} board applied. Review it, then press Solve.`);}
  function solve(){
    if(!dictionary.length)return;
    if(!board.every(Boolean)){const missing=board.findIndex(letter=>!letter);setMessage("Fill every tile before solving.");inputs.current[missing]?.focus();return;}
    setSolving(true);setSelected(null);setMessage("Searching every possible path…");
    setTimeout(()=>{
      const counts=board.reduce<Record<string,number>>((acc,letter)=>{acc[letter]=(acc[letter]??0)+1;if(letter==="Q")acc.U=(acc.U??0)+1;return acc;},{}),found:FoundWord[]=[];
      for(const word of dictionary){if(word.length<3||word.length>size*size+board.filter(l=>l==="Q").length||!canFit(word,counts))continue;const path=findPath(word,board,size);if(path)found.push({word,path,score:scorePath(path,board,bonuses)});}
      setResults(found);setSolving(false);setMessage(found.length?`${found.length.toLocaleString()} words found.`:"No words found — check the letters and try again.");
    },30);
  }

  return <main className="app-shell">
    <header className="topbar"><a className="brand" href="#top" aria-label="Boggle Word Finder home"><span className="brand-mark" aria-hidden="true"><i>B</i><i>O</i><i>G</i></span><span>Word Finder</span></a><p>Fast, private, and free</p></header>
    <div className="workspace" id="top">
      <section className="board-panel" aria-labelledby="page-title">
        <div className="eyebrow">BOGGLE SOLVER</div><h1 id="page-title">Find every word<br/>on your board.</h1><p className="intro">Type your letters in order. Each tile touches the eight tiles around it, including diagonals.</p>
        <div className="size-row" aria-label="Board size"><span>Board size</span>{[3,4,5].map(value=><button key={value} className={size===value?"size-button active":"size-button"} onClick={()=>changeSize(value)}>{value}×{value}</button>)}</div>
        <BoardScanner size={size} onApply={applyScan}/>
        <div className="board-wrap"><div className="letter-board" style={{gridTemplateColumns:`repeat(${size},1fr)`}}>{board.map((letter,index)=>{const bonus=bonuses[index];return <label className={`tile ${activeTile===index?"active-tile":""} ${highlighted.has(index)?"highlighted":""} ${bonus!=="NONE"?`bonus-${bonus.toLowerCase()}`:""}`} key={`${size}-${index}`} onPointerDown={()=>selectTile(index)}><span className="sr-only">Tile {index+1}</span><input ref={el=>{inputs.current[index]=el;}} value={letter} onFocus={()=>selectTile(index)} onChange={e=>updateTile(index,e.target.value)} onKeyDown={e=>handleKey(index,e.key)} inputMode="text" autoCapitalize="characters" maxLength={1} aria-label={`Tile ${index+1}${letter?`: ${letter}, ${POINTS[letter]} points`:""}${bonus!=="NONE"?`, ${bonus}`:""}`}/>{letter==="Q"&&<small className="q-u">u</small>}{letter&&<span className="tile-value">{POINTS[letter]}</span>}{bonus!=="NONE"&&<span className="bonus-badge">{bonus}</span>}{highlighted.has(index)&&<b className="path-step">{highlighted.get(index)}</b>}</label>})}</div></div>
        <div className="bonus-toolbar"><div><strong>Bonus square</strong><span>Tile {activeTile+1}{board[activeTile]?` · ${board[activeTile]}`:""}</span></div><div className="bonus-buttons">{BONUS_OPTIONS.map(bonus=><button key={bonus} className={`${bonus===bonuses[activeTile]?"active ":""}bonus-choice bonus-${bonus.toLowerCase()}`} onClick={()=>setTileBonus(bonus)} aria-pressed={bonus===bonuses[activeTile]}>{bonus}</button>)}</div></div>
        <div className="board-actions"><button className="primary-button" onClick={solve} disabled={solving||!dictionary.length}>{solving?"Finding words…":"Solve board"}<span aria-hidden="true">→</span></button><div className="utility-actions"><button onClick={clearBoard}>Clear</button><button onClick={shuffleBoard}>Shuffle</button><button onClick={loadSample}>Sample</button></div></div>
        <p className="status" role="status"><span className={dictionary.length?"status-dot ready":"status-dot"}/>{message}</p>
        <details className="points-reference"><summary>Letter point values</summary><div className="points-grid">{Object.entries(POINTS).map(([letter,value])=><span key={letter}><b>{letter==="Q"?"Qu":letter}</b><em>{value}</em></span>)}</div></details>
      </section>
      <section className="results-panel" aria-labelledby="results-title">
        <div className="results-head"><div><div className="eyebrow">RESULTS</div><h2 id="results-title">{results.length?`${results.length.toLocaleString()} words`:"Your words"}</h2></div>{results.length>0&&<div className="total-score"><strong>{results.reduce((sum,item)=>sum+item.score,0).toLocaleString()}</strong><span>total pts</span></div>}</div>
        {results.length>0?<><div className="result-tools"><label className="search-box"><span aria-hidden="true">⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search results" aria-label="Search results"/></label><div className="sort-tabs" aria-label="Sort results">{(["length","score","alpha"] as SortMode[]).map(mode=><button key={mode} className={sortMode===mode?"active":""} onClick={()=>setSortMode(mode)}>{mode==="alpha"?"A–Z":mode[0].toUpperCase()+mode.slice(1)}</button>)}</div></div>{selected&&<div className="path-card"><span>PATH</span><strong>{selected.word}</strong><em>{selected.path.map(tile=>tile+1).join(" → ")}</em><button onClick={()=>setSelected(null)} aria-label="Close word path">×</button></div>}<div className="word-list">{visibleResults.map(item=><button className={selected?.word===item.word?"word-row selected":"word-row"} key={item.word} onClick={()=>setSelected(item)}><span>{item.word}</span><span>{item.word.length} letters</span><strong>{item.score} pts</strong></button>)}{!visibleResults.length&&<p className="no-match">No results match “{query}”.</p>}</div></>:<div className="empty-state"><div className="empty-grid" aria-hidden="true"><i>W</i><i>O</i><i>R</i><i>D</i></div><h3>Words will appear here</h3><p>Enter all the letters, then press <strong>Solve board</strong>. Tap any result to see its exact path.</p><div className="tips"><span>QUICK TIP</span><p>The letter <strong>Q</strong> counts as <strong>Qu</strong>, just like a real Boggle die.</p></div></div>}
      </section>
    </div><footer><p>Built for fast word-game practice. Your board stays in your browser.</p></footer>
  </main>;
}
