import type { Metadata } from "next";
import "./globals.css";
import "./scanner.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://boggle-word-finder.mcirt117.chatgpt.site"),
  title: "Boggle Word Finder",
  description: "Enter a 3×3, 4×4, or 5×5 letter board and find every connected English word with its exact path and score.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: { title: "Boggle Word Finder", description: "Find every word, path, and point on your board.", type: "website", images: [{url:"/og.png",width:1200,height:630,alt:"Boggle Word Finder"}] },
  twitter: { card: "summary_large_image", title: "Boggle Word Finder", description: "Find every word, path, and point on your board.", images:["/og.png"] },
};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body>{children}</body></html>;}
