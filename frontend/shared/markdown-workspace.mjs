import {Marked} from 'marked';
import {decodeHTML} from 'entities';
export const MAX_MARKDOWN=200000,MAX_IMPORT_BYTES=5*1024*1024;
export const EXPORT_FORMATS=[['md','Markdown (.md)'],['docx','Word (.docx)'],['pdf','PDF (.pdf)'],['html','HTML (.html)'],['txt','Plain text (.txt)'],['rtf','Rich Text (.rtf)']];
export const SAMPLE_MARKDOWN='# A little space for big ideas\n\nWrite, edit and convert your **Markdown** — right here in your browser.\n\n## Your document, your way\n\n- Edit with a live preview\n- Export to **Word, PDF, HTML, TXT or RTF**\n- Keep a local copy as `.md`\n\n### A simple plan\n\n| Task | Status |\n| --- | --- |\n| Write something useful | Ready |\n| Make it look great | In progress |\n| Share your document | Next |\n\n> Small steps make great documents.\n\n```javascript\nconst idea = "Something worth sharing";\nconsole.log(idea);\n```\n\n- [x] Start writing\n- [ ] Add your finishing touches\n\nLearn more about [Markdown](https://www.markdownguide.org/).\n';
export const escapeHTML=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
export function safeLink(value){
 const text=decodeHTML(String(value||'')).trim();
 if(/^#[\p{L}\p{N}_-]+$/u.test(text))return text;
 try{const url=new URL(text);return ['https:','http:','mailto:','tel:'].includes(url.protocol)?url.href:null;}catch{return null;}
}
export function inlineText(tokens=[]){return tokens.map(token=>{
 if(token.type==='br')return '\n';
 if(['codespan','code','html'].includes(token.type))return token.text||'';
 if(token.type==='image')return '[Image: '+(token.text||'image')+']';
 if(token.tokens)return inlineText(token.tokens);
 return decodeHTML(token.text??token.raw??'');
}).join('');}
export function plainText(tokens=[]){return tokens.map(token=>{
 if(token.type==='space')return '';
 if(token.type==='list')return token.items.map((item,index)=>`${token.ordered?Number(token.start??1)+index+'.':'•'} ${item.task?(item.checked?'[x] ':'[ ] '):''}${plainText(item.tokens).trim()}`).join('\n');
 if(token.type==='table')return [token.header,...token.rows].map(row=>row.map(cell=>inlineText(cell.tokens)).join('\t')).join('\n');
 if(token.type==='blockquote')return plainText(token.tokens);
 if(token.type==='hr')return '────────────────';
 if(token.type==='code')return token.text;
 return token.tokens?inlineText(token.tokens):decodeHTML(token.text??'');
}).filter(Boolean).join('\n\n');}
export function parseMarkdown(source){
 if(typeof source!=='string'||source.length>MAX_MARKDOWN)throw Error('Use Markdown below 200,000 characters.');
 const headings=[],used=new Map();
 const parser=new Marked({gfm:true,breaks:false,renderer:{
  html:token=>escapeHTML(token.text),
  image:token=>`<span class="md-image">${escapeHTML('[Image: '+(token.text||'image')+']')}</span>`,
  link(token){const url=safeLink(token.href),text=this.parser.parseInline(token.tokens);if(!url)return text;const href=url.startsWith('#')?'#md-'+url.slice(1):url;return `<a href="${escapeHTML(href)}"${url.startsWith('#')?'':' target="_blank" rel="noopener noreferrer"'}>${text}</a>`;},
  heading(token){const text=inlineText(token.tokens),slug=text.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu,'').trim().replace(/\s+/g,'-')||'heading',count=(used.get(slug)||0)+1;used.set(slug,count);const id='md-'+slug+(count>1?'-'+count:'');headings.push({text,depth:token.depth,id});return `<h${token.depth} id="${escapeHTML(id)}">${this.parser.parseInline(token.tokens)}</h${token.depth}>\n`;},
  checkbox:token=>token.checked?'☑ ':'☐ ',
 }});
 const tokens=parser.lexer(source),html=parser.parser(tokens),text=plainText(tokens);
 const words=typeof Intl.Segmenter==='function'?[...new Intl.Segmenter(undefined,{granularity:'word'}).segment(text)].filter(part=>part.isWordLike).length:(text.trim().match(/\S+/g)||[]).length;
 return {html,tokens,text,headings,words,characters:source.length,readingMinutes:Math.ceil(words/200)};
}
export function safeFileName(value){return String(value||'document').replace(/\.(md|markdown|txt|html?|docx|pdf|rtf)$/i,'').replace(/[\\/:*?"<>|\u0000-\u001f]/g,'-').trim().replace(/[. ]+$/,'').slice(0,80)||'document';}
export const DOCUMENT_CSS=`.md-document{font:16px/1.7 Arial,'Nirmala UI',sans-serif;color:#202b43;background:#fff;overflow-wrap:anywhere}.md-document h1,.md-document h2,.md-document h3,.md-document h4,.md-document h5,.md-document h6{line-height:1.3;margin:1.1em 0 .5em;font-weight:700;color:#1b2540}.md-document h1{font-size:32px;letter-spacing:-.7px;border-bottom:1px solid #e5e7ef;padding-bottom:16px;margin-top:0}.md-document h2{font-size:24px}.md-document h3{font-size:20px}.md-document p{margin:0 0 14px}.md-document a{color:#6945d6;text-decoration:underline}.md-document ul,.md-document ol{padding-left:26px;margin:12px 0 18px}.md-document ul{list-style:disc}.md-document ol{list-style:decimal}.md-document li{margin:5px 0}.md-document li>p{margin:0}.md-document blockquote{margin:18px 0;border-left:4px solid #a88ae8;padding:8px 18px;background:#f6f3ff;color:#596380}.md-document blockquote p:last-child{margin:0}.md-document code{font:13px/1.6 ui-monospace,Consolas,monospace;background:#f0edf9;border-radius:4px;padding:2px 5px}.md-document pre{background:#f4f5fa;border:1px solid #e1e4ef;padding:16px;border-radius:10px;white-space:pre-wrap;overflow-wrap:anywhere;tab-size:2;margin:18px 0}.md-document pre code{padding:0;background:none;border-radius:0}.md-document table{border-collapse:collapse;width:100%;margin:18px 0;font-size:14px;table-layout:fixed}.md-document th,.md-document td{border:1px solid #dce1ee;padding:9px 12px;text-align:left;vertical-align:top;overflow-wrap:anywhere}.md-document th{background:#f2effc;font-weight:700}.md-document hr{border:0;border-top:1px solid #dce1ee;margin:24px 0}.md-document .md-image{display:inline-block;padding:4px 8px;border:1px dashed #d5cbea;color:#737b91;font-size:13px}.md-document del{color:#737b91}.md-document :first-child{margin-top:0}@media print{body{margin:0}.md-document h1,.md-document h2,.md-document h3{break-after:avoid}.md-document pre,.md-document blockquote,.md-document tr{break-inside:avoid}.md-document thead{display:table-header-group}@page{size:A4;margin:18mm}}`;
export function standaloneHTML(html,title){return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; script-src 'none'; base-uri 'none'; form-action 'none'"><title>${escapeHTML(title)}</title><style>body{margin:32px auto;padding:0 24px;max-width:840px}${DOCUMENT_CSS}</style></head><body><article class="md-document">${html}</article></body></html>`;}
export function rtfEscape(text){let result='';for(let i=0;i<text.length;i++){const char=text[i],n=text.charCodeAt(i);result+=char==='\\'||char==='{'||char==='}'?'\\'+char:char==='\n'?'\\line ':char==='\t'?'\\tab ':n<32?'':n>126?'\\u'+(n>32767?n-65536:n)+'?':char;}return result;}
export function markdownRTF(parsed){
 const inline=tokens=>(tokens||[]).map(token=>token.type==='strong'?'{\\b '+inline(token.tokens)+'}':token.type==='em'?'{\\i '+inline(token.tokens)+'}':token.type==='del'?'{\\strike '+inline(token.tokens)+'}':token.type==='codespan'?'{\\f1 '+rtfEscape(token.text)+'}':token.tokens?inline(token.tokens):rtfEscape(token.text||'')).join('');
 const blocks=tokens=>tokens.map(token=>{
  if(token.type==='heading')return '{\\pard\\sb240\\sa120\\b\\fs'+Math.max(24,48-token.depth*4)+' '+inline(token.tokens)+'\\par}';
  if(token.type==='list')return token.items.map((item,i)=>'{\\pard\\li360 '+rtfEscape(token.ordered?(Number(token.start??1)+i)+'. ':'• ')+(item.task?rtfEscape(item.checked?'[x] ':'[ ] '):'')+rtfEscape(plainText(item.tokens))+'\\par}').join('\n');
  if(token.type==='code')return '{\\pard\\li160\\f1\\fs20 '+rtfEscape(token.text)+'\\par}';
  if(token.type==='table')return [token.header,...token.rows].map((row,i)=>'{\\pard'+(i===0?'\\b':'')+' '+row.map(cell=>rtfEscape(inlineText(cell.tokens))).join('\\tab ')+'\\par}').join('\n');
  if(token.type==='blockquote')return '{\\pard\\li360\\i '+rtfEscape(plainText(token.tokens))+'\\par}';
  if(token.type==='space')return '';
  return '{\\pard\\sa140 '+(token.tokens?inline(token.tokens):rtfEscape(token.text||''))+'\\par}';
 }).join('\n');
 return '{\\rtf1\\ansi\\ansicpg1252\\uc1{\\fonttbl{\\f0 Arial;}{\\f1 Courier New;}}\\f0\\fs24\n'+blocks(parsed.tokens)+'\n}';
}
export function markdownEdit(source,start,end,action){
 const selected=source.slice(start,end);let insert,before='',after='',placeholder='text';
 const pairs={bold:['**','**','bold text'],italic:['*','*','italic text'],code:['`','`','code'],link:['[','](https://example.com)','link text']};
 if(pairs[action]){[before,after,placeholder]=pairs[action];insert=before+(selected||placeholder)+after;}
 else if(action==='table')insert='\n\n| Column 1 | Column 2 |\n| --- | --- |\n| Value | Value |\n';
 else if(action==='fence')insert='\n```\n'+(selected||'Your code here')+'\n```\n';
 else if(action==='indent')insert='  ';
 else{
  const lineStart=source.lastIndexOf('\n',Math.max(0,start-1))+1;let lineEnd=source.indexOf('\n',end);if(lineEnd<0)lineEnd=source.length;
  const prefixes={heading:'## ',list:'- ',ordered:'1. ',quote:'> ',task:'- [ ] '},prefix=prefixes[action];
  if(!prefix)throw Error('Unsupported editor action');
  start=lineStart;end=lineEnd;insert=(source.slice(start,end)||'Text').split('\n').map(line=>prefix+line).join('\n');
 }
 const value=source.slice(0,start)+insert+source.slice(end);
 if(value.length>MAX_MARKDOWN)throw Error('The document exceeds 200,000 characters.');
 return {value,start:start+before.length,end:start+insert.length-after.length};
}
