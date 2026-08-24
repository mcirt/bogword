import { readFile, writeFile } from "node:fs/promises";
const source=JSON.parse(await readFile(new URL("../node_modules/an-array-of-english-words/index.json",import.meta.url),"utf8"));
const words=source.map((word)=>word.toUpperCase()).filter((word)=>word.length>=3&&word.length<=26&&/^[A-Z]+$/.test(word)).sort();
await writeFile(new URL("../public/words.txt",import.meta.url),`${words.join("\n")}\n`);
console.log(`Wrote ${words.length.toLocaleString()} words.`);
