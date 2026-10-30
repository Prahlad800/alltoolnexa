// Framework entries are project presets, not additional programming languages.
const free=new Set(['html','css','javascript','jsx','typescript','tsx','python','c','cpp','java','json','markdown','text']);
const groups={web:'Web development',programming:'Programming',database:'Database & queries',documents:'Documents & data'};
const entries=[
 ['html','HTML','html','web','HTML','preview'],
 ['css','CSS','css','web','CSS','preview'],
 ['javascript','JavaScript','js','web','JavaScript','run'],
 ['jsx','JavaScript JSX','jsx','web','JSX','component'],
 ['typescript','TypeScript','ts','web','TypeScript','run'],
 ['tsx','TypeScript JSX','tsx','web','TSX','component'],
 ['react','React JS','jsx','web','JSX','component',['jsx','js']],
 ['react-ts','React TypeScript','tsx','web','TSX','component'],
 ['next','Next.js','tsx','web','TSX','edit',['jsx','tsx']],
 ['vue','Vue.js','vue','web','Vue','edit'],
 ['angular','Angular','ts','web','TypeScript','edit',['ts','html']],
 ['svelte','Svelte','svelte','web','Svelte','edit'],
 ['astro','Astro','astro','web','HTML','edit'],
 ['scss','SCSS','scss','web','SCSS','edit'],
 ['sass','Sass','sass','web','Sass','edit'],
 ['less','LESS','less','web','LESS','edit'],
 ['php','PHP','php','web','PHP','edit'],
 ['xml','XML','xml','web','XML','validate'],
 ['svg','SVG','svg','web','XML','preview'],
 ['wat','WebAssembly Text','wat','web','WebAssembly','edit'],
 ['python','Python','py','programming','Python','run'],
 ['c','C','c','programming','C','run'],
 ['cpp','C++','cpp','programming','C++','run'],
 ['csharp','C#','cs','programming','C#','edit'],
 ['java','Java','java','programming','Java','edit'],
 ['kotlin','Kotlin','kt','programming','Kotlin','edit'],
 ['swift','Swift','swift','programming','Swift','edit'],
 ['dart','Dart','dart','programming','Dart','edit'],
 ['go','Go (Golang)','go','programming','Go','edit'],
 ['rust','Rust','rs','programming','Rust','edit'],
 ['ruby','Ruby','rb','programming','Ruby','edit'],
 ['r','R','r','programming','R','edit'],
 ['julia','Julia','jl','programming','Julia','edit'],
 ['scala','Scala','scala','programming','Scala','edit'],
 ['perl','Perl','pl','programming','Perl','edit'],
 ['lua','Lua','lua','programming','Lua','edit'],
 ['elixir','Elixir','ex','programming','Elixir','edit'],
 ['erlang','Erlang','erl','programming','Erlang','edit'],
 ['haskell','Haskell','hs','programming','Haskell','edit'],
 ['fsharp','F#','fs','programming','F#','edit'],
 ['vb','Visual Basic','vb','programming','VB.NET','edit'],
 ['objc','Objective-C','m','programming','Objective-C','edit'],
 ['objcpp','Objective-C++','mm','programming','Objective-C++','edit'],
 ['groovy','Groovy','groovy','programming','Groovy','edit'],
 ['zig','Zig','zig','programming','Zig','edit'],
 ['d','D','d','programming','D','edit'],
 ['nim','Nim','nim','programming','Nim','edit'],
 ['ocaml','OCaml','ml','programming','OCaml','edit'],
 ['assembly','Assembly','asm','programming','Gas','edit'],
 ['fortran','Fortran','f90','programming','Fortran','edit'],
 ['cobol','COBOL','cob','programming','COBOL','edit'],
 ['pascal','Pascal','pas','programming','Pascal','edit'],
 ['ada','Ada','adb','programming','Ada','edit'],
 ['lisp','Lisp','lisp','programming','Common Lisp','edit'],
 ['clojure','Clojure','clj','programming','Clojure','edit'],
 ['sql','SQL','sql','database','SQL','edit'],
 ['mysql','MySQL SQL','sql','database','MySQL','edit'],
 ['postgresql','PostgreSQL SQL','sql','database','PostgreSQL','edit'],
 ['sqlite','SQLite SQL','sql','database','SQLite','edit'],
 ['tsql','T-SQL','sql','database','MS SQL','edit'],
 ['plsql','PL/SQL','sql','database','PLSQL','edit'],
 ['graphql','GraphQL','graphql','database','GraphQL','edit'],
 ['prisma','Prisma Schema','prisma','database','Prisma','edit'],
 ['mongodb','MongoDB Queries (JavaScript)','js','database','JavaScript','edit'],
 ['text','Plain Text','txt','documents','text','edit'],
 ['markdown','Markdown','md','documents','Markdown','preview'],
 ['mdx','MDX','mdx','documents','Markdown','edit'],
 ['json','JSON','json','documents','JSON','validate'],
 ['jsonc','JSONC','jsonc','documents','JSON','edit'],
 ['jsonl','JSON Lines','jsonl','documents','JSON','validate'],
 ['csv','CSV','csv','documents','text','edit'],
 ['tsv','TSV','tsv','documents','text','edit'],
 ['latex','LaTeX','tex','documents','LaTeX','edit'],
 ['rst','reStructuredText','rst','documents','reStructuredText','edit'],
 ['notebook','Jupyter Notebook','ipynb','documents','JSON','validate'],
 ['log','Log Files','log','documents','text','edit'],
];
export const STUDIO_LANGUAGES=entries.map(([id,label,extension,group,syntax,capability,extensions])=>({id,label,extension,extensions:extensions||[extension],group,groupLabel:groups[group],syntax,capability,free:free.has(id)}));
export const STUDIO_GROUPS=Object.entries(groups);
export const FREE_STUDIO_LANGUAGES=STUDIO_LANGUAGES.filter(item=>item.free);
export const WEB_WORKSPACE={id:'web',label:'HTML / CSS / JS',extension:'html',free:true,capability:'preview',syntax:'HTML'};
export const studioLanguage=id=>id==='web'?WEB_WORKSPACE:STUDIO_LANGUAGES.find(item=>item.id===id);
export const hasStudioAccess=(id,premium=false)=>Boolean(studioLanguage(id)&&(studioLanguage(id).free||premium));
export const isStudioPremium=access=>Boolean(access?.is_premium===true&&['premium','premium-plus'].includes(access.plan));
export const capabilityLabel=capability=>({run:'Browser runner',component:'React preview',preview:'Live preview',validate:'Validate',edit:'Editing only'}[capability]);
export function languageForPath(path){
 const ext=path.split('.').pop().toLowerCase();
 return STUDIO_LANGUAGES.find(item=>item.extensions.includes(ext))||studioLanguage('text');
}

const hello='Hello, AllToolNexa!';
const samples={
 jsx:`import React, { useState } from 'react';\n\nexport default function App() {\n  const [count, setCount] = useState(0);\n  return <main className="welcome">\n    <span className="badge">AllToolNexa Code Studio</span>\n    <h1>Your next idea starts here.</h1>\n    <p>Edit this component and press Run.</p>\n    <button onClick={() => setCount(count + 1)}>Clicked {count} times</button>\n  </main>;\n}\n`,
 typescript:`const greeting: string = '${hello}';\nconst numbers: number[] = [20, 22];\nconsole.log(greeting);\nconsole.log('Answer:', numbers.reduce((sum, n) => sum + n, 0));\n`,
 tsx:`import React, { useState } from 'react';\n\ntype Props = { title?: string };\nexport default function App({ title = 'Build something great.' }: Props) {\n  const [count, setCount] = useState<number>(0);\n  return <main className="welcome"><span className="badge">AllToolNexa Code Studio</span>\n    <h1>{title}</h1><p>A little idea. A world of possibilities.</p>\n    <button onClick={() => setCount(count + 1)}>Clicked {count} times</button>\n  </main>;\n}\n`,
 java:`public class Main {\n    public static void main(String[] args) {\n        System.out.println("${hello}");\n    }\n}\n`,
 next:`export default function Page() {\n  return <main><h1>Welcome to your Next.js project</h1></main>;\n}\n`,
 vue:`<script setup>\nimport { ref } from 'vue';\nconst count = ref(0);\n</script>\n\n<template>\n  <button @click="count++">Clicked {{ count }} times</button>\n</template>\n\n<style scoped>\nbutton { color: #7047eb; }\n</style>\n`,
 angular:`import { Component } from '@angular/core';\n\n@Component({\n  selector: 'app-root',\n  standalone: true,\n  template: '<h1>${hello}</h1>'\n})\nexport class AppComponent {}\n`,
 svelte:`<script>\n  let count = 0;\n</script>\n\n<button onclick={() => count++}>Clicked {count} times</button>\n`,
 astro:`---\nconst title = '${hello}';\n---\n<html lang="en"><body><h1>{title}</h1></body></html>\n`,
 scss:'$brand: #7047eb;\n.welcome {\n  color: $brand;\n  button { border-radius: 8px; }\n}\n',
 sass:'$brand: #7047eb\n.welcome\n  color: $brand\n',
 less:'@brand: #7047eb;\n.welcome { color: @brand; }\n',
 php:`<?php\necho "${hello}\\n";\n`,
 xml:'<?xml version="1.0" encoding="UTF-8"?>\n<project><name>AllToolNexa</name></project>\n',
 svg:'<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180">\n  <rect width="320" height="180" rx="24" fill="#7047eb"/>\n  <text x="160" y="96" fill="white" text-anchor="middle" font-family="sans-serif" font-size="24">Create something.</text>\n</svg>\n',
 wat:'(module\n  (func (export "add") (param i32 i32) (result i32)\n    local.get 0\n    local.get 1\n    i32.add))\n',
 csharp:`using System;\nclass Program {\n    static void Main() => Console.WriteLine("${hello}");\n}\n`,
 kotlin:`fun main() {\n    println("${hello}")\n}\n`,swift:`print("${hello}")\n`,dart:`void main() {\n  print('${hello}');\n}\n`,
 go:`package main\nimport "fmt"\nfunc main() { fmt.Println("${hello}") }\n`,rust:`fn main() {\n    println!("${hello}");\n}\n`,ruby:`puts '${hello}'\n`,r:`print("${hello}")\n`,julia:`println("${hello}")\n`,scala:`object Main extends App { println("${hello}") }\n`,perl:`use strict;\nuse warnings;\nprint "${hello}\\n";\n`,lua:`print("${hello}")\n`,elixir:`IO.puts("${hello}")\n`,erlang:`-module(main).\n-export([main/0]).\nmain() -> io:format("${hello}~n").\n`,haskell:`main :: IO ()\nmain = putStrLn "${hello}"\n`,fsharp:`printfn "${hello}"\n`,vb:`Module Main\n    Sub Main()\n        Console.WriteLine("${hello}")\n    End Sub\nEnd Module\n`,
 objc:`#import <Foundation/Foundation.h>\nint main() { @autoreleasepool { NSLog(@"${hello}"); } return 0; }\n`,groovy:`println '${hello}'\n`,zig:'const std = @import("std");\npub fn main() void { std.debug.print("Hello, AllToolNexa!\\n", .{}); }\n',d:`import std.stdio;\nvoid main() { writeln("${hello}"); }\n`,nim:`echo "${hello}"\n`,ocaml:`print_endline "${hello}";;\n`,assembly:'; x86-64 assembly source — export to build with your assembler\nsection .text\nglobal _start\n_start:\n    mov rax, 60\n    xor rdi, rdi\n    syscall\n',fortran:`program hello\n  print *, "${hello}"\nend program hello\n`,cobol:`       IDENTIFICATION DIVISION.\n       PROGRAM-ID. HELLO.\n       PROCEDURE DIVISION.\n           DISPLAY "${hello}"\n           STOP RUN.\n`,pascal:`program Hello;\nbegin\n  writeln('${hello}');\nend.\n`,ada:`with Ada.Text_IO; use Ada.Text_IO;\nprocedure Main is\nbegin\n  Put_Line("${hello}");\nend Main;\n`,lisp:`(format t "${hello}~%")\n`,clojure:`(println "${hello}")\n`,
 sql:'CREATE TABLE tasks (id INTEGER PRIMARY KEY, title VARCHAR(120));\nINSERT INTO tasks VALUES (1, \'Build something great\');\nSELECT * FROM tasks;\n',graphql:'query GetTasks {\n  tasks {\n    id\n    title\n  }\n}\n',prisma:'datasource db {\n  provider = "postgresql"\n  url = env("DATABASE_URL")\n}\n\nmodel Task {\n  id Int @id @default(autoincrement())\n  title String\n}\n',mongodb:'// MongoDB shell query\ndb.tasks.find({ complete: false }).sort({ createdAt: -1 });\n',
 text:'A little space for your next big idea.\n',markdown:'# Your next idea\n\nWrite, create, and keep going.\n\n- [x] Open Code Studio\n- [ ] Make something great\n\n```js\nconsole.log("Hello, AllToolNexa!");\n```\n',mdx:'# Hello, MDX\n\nexport const name = "AllToolNexa";\n\nWelcome to **{name}**.\n',json:'{\n  "name": "My Project",\n  "version": "1.0.0",\n  "ready": true\n}\n',jsonc:'{\n  // Configuration with comments\n  "name": "My Project"\n}\n',jsonl:'{"id":1,"title":"Start creating"}\n{"id":2,"title":"Keep going"}\n',csv:'id,title,complete\n1,Start creating,false\n',tsv:'id\ttitle\tcomplete\n1\tStart creating\tfalse\n',latex:'\\documentclass{article}\n\\begin{document}\n\\section{Hello, AllToolNexa!}\nYour next idea starts here.\n\\end{document}\n',rst:'Your next idea\n==============\n\nWrite, create, and keep going.\n',notebook:JSON.stringify({cells:[{cell_type:'code',execution_count:null,metadata:{},outputs:[],source:['print("Hello, AllToolNexa!")']}],metadata:{kernelspec:{display_name:'Python 3',language:'python',name:'python3'}},nbformat:4,nbformat_minor:5},null,2)+'\n',log:'2026-01-01T00:00:00Z INFO Project started\n',
};
export function starterSource(id){
 const alias={'react':'jsx','react-ts':'tsx',objcpp:'objc',mysql:'sql',postgresql:'sql',sqlite:'sql',tsql:'sql',plsql:'sql'};
 return samples[alias[id]||id]||'';
}
export function defaultPath(id){
 return ({jsx:'src/App.jsx',tsx:'src/App.tsx',react:'src/ReactApp.jsx','react-ts':'src/ReactApp.tsx',next:'app/page.tsx',angular:'src/app.component.ts',java:'Main.java',prisma:'schema.prisma',markdown:'README.md',text:'notes.txt',notebook:'notebook.ipynb',log:'application.log'}[id]||`main.${studioLanguage(id)?.extension||'txt'}`);
}
