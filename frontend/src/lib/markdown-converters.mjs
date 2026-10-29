import {parseMarkdown,MAX_MARKDOWN,MAX_IMPORT_BYTES,DOCUMENT_CSS,standaloneHTML,markdownRTF,safeLink,inlineText,plainText} from '../../shared/markdown-workspace.mjs';

export async function cleanMarkdown(source){
 const parsed=parseMarkdown(source),{default:DOMPurify}=await import('dompurify');
 parsed.html=DOMPurify.sanitize(parsed.html,{USE_PROFILES:{html:true},FORBID_TAGS:['script','style','img','svg','math','iframe','object','embed','form','input','button','video','audio','source','link','meta','base'],FORBID_ATTR:['style','name'],ALLOW_DATA_ATTR:false});
 return parsed;
}
export async function importMarkdown(file){
 if(!file||file.size>MAX_IMPORT_BYTES)throw Error('Choose a file up to 5 MB.');
 const extension=file.name.split('.').pop().toLowerCase();let text;
 if(['md','markdown','mdown','txt','html','htm'].includes(extension)){
  try{text=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer()).replace(/^\uFEFF/,'');}catch{throw Error('Use a UTF-8 encoded text file.');}
 }else if(extension==='docx'){
  const bytes=await file.arrayBuffer(),{default:JSZip}=await import('jszip'),zip=await JSZip.loadAsync(bytes);
  const entries=Object.values(zip.files).filter(entry=>!entry.dir);
  if(!zip.file('word/document.xml')||entries.length>2000||entries.reduce((total,entry)=>total+(entry._data?.uncompressedSize??0),0)>20*1024*1024)throw Error('This DOCX is too large after extraction or is not a valid Word document.');
  const imported=await import('mammoth/mammoth.browser'),mammoth=imported.default||imported;
  const result=await mammoth.convertToHtml({arrayBuffer:bytes},{externalFileAccess:false,convertImage:mammoth.images.imgElement(async()=>({src:'',alt:'Image omitted'}))});
  text=result.value;
 }else throw Error('Open MD, Markdown, TXT, HTML or DOCX files. Legacy .doc is not supported.');
 if(['html','htm','docx'].includes(extension)){
  const [{default:DOMPurify},{default:TurndownService},plugin]=await Promise.all([import('dompurify'),import('turndown'),import('turndown-plugin-gfm')]);
  const clean=DOMPurify.sanitize(text,{USE_PROFILES:{html:true},FORBID_TAGS:['script','style','img','iframe','object','embed','svg','math','form','input','button','video','audio','source','link','meta','base'],FORBID_ATTR:['style','src','srcset','name'],ALLOW_DATA_ATTR:false});
  const turndown=new TurndownService({headingStyle:'atx',codeBlockStyle:'fenced',bulletListMarker:'-'});
  turndown.use(plugin.gfm||plugin.default?.gfm);
  // Word cells often contain paragraphs; normalize them to single GFM cell lines.
  turndown.addRule('markdownTables',{filter:'table',replacement:(_content,node)=>{
   const rows=[...node.rows].map(row=>[...row.cells].map(cell=>(cell.querySelector('table')?cell.textContent:turndown.turndown(cell.innerHTML)).trim().replace(/\s*\n+\s*/g,' ').replace(/\|/g,'\\|')));
   if(!rows.length)return '';
   const width=Math.max(...rows.map(row=>row.length));
   const line=row=>'| '+Array.from({length:width},(_,i)=>row[i]||'').join(' | ')+' |';
   return '\n\n'+[line(rows[0]),line(Array(width).fill('---')),...rows.slice(1).map(line)].join('\n')+'\n\n';
  }});
  text=turndown.turndown(clean);
 }
 if(text.length>MAX_MARKDOWN)throw Error('The imported document exceeds 200,000 characters.');
 return text;
}
export async function markdownDOCX(parsed,title){
 const {Document,Packer,Paragraph,TextRun,Table,TableRow,TableCell,WidthType,ExternalHyperlink,LevelFormat,AlignmentType}=await import('docx');
 const numbering=[];let listIndex=0;
 function runs(tokens,style={}){
  return (tokens||[]).flatMap(token=>{
   if(token.type==='strong')return runs(token.tokens,{...style,bold:true});
   if(token.type==='em')return runs(token.tokens,{...style,italics:true});
   if(token.type==='del')return runs(token.tokens,{...style,strike:true});
   if(token.type==='br')return [new TextRun({...style,break:1})];
   if(token.type==='codespan')return [new TextRun({...style,font:'Consolas',size:21,text:token.text})];
   if(token.type==='link'){
    const url=safeLink(token.href),children=runs(token.tokens,{...style,...(url?{color:'6945D6',underline:{}}:{})});
    return url&&!url.startsWith('#')?[new ExternalHyperlink({link:url,children})]:children;
   }
   if(token.type==='image')return [new TextRun({...style,italics:true,text:'[Image: '+(token.text||'image')+']'})];
   if(token.tokens)return runs(token.tokens,style);
   return [new TextRun({...style,text:inlineText([token])})];
  });
 }
 function blocks(tokens,depth=0){
  const result=[];
  for(const token of tokens){
   if(token.type==='space')continue;
   if(token.type==='table'){
    const rows=[token.header,...token.rows].map((row,index)=>new TableRow({...(index===0?{tableHeader:true}:{}),children:row.map(cell=>new TableCell({children:[new Paragraph({children:runs(cell.tokens,index===0?{bold:true}:{})})],...(index===0?{shading:{fill:'F2EFFC'}}:{})}))}));
    result.push(new Table({rows,width:{size:100,type:WidthType.PERCENTAGE}}),new Paragraph(''));continue;
   }
   if(token.type==='list'){
    const reference='md-list-'+listIndex++;
    if(token.ordered)numbering.push({reference,levels:[{level:0,format:LevelFormat.DECIMAL,text:'%1.',start:Number(token.start??1),alignment:AlignmentType.START,style:{paragraph:{indent:{left:720*(depth+1),hanging:360}}}}]});
    for(const item of token.items){let first=true;
     for(const part of item.tokens){
      if(part.type==='space')continue;
      if(part.type==='list'){result.push(...blocks([part],depth+1));continue;}
      const children=[...(first&&item.task?[new TextRun(item.checked?'[x] ':'[ ] ')]:[]),...runs(part.tokens||[{type:'text',text:part.text||''}])];
      result.push(new Paragraph({children,...(first?(token.ordered?{numbering:{reference,level:0}}:{bullet:{level:Math.min(depth,8)}}):{indent:{left:720*(depth+1)}})}));first=false;
     }
    }continue;
   }
   if(token.type==='code'){for(const line of token.text.split('\n'))result.push(new Paragraph({children:[new TextRun({text:line,font:'Consolas',size:20})],shading:{fill:'F4F5FA'},spacing:{after:0}}));result.push(new Paragraph(''));continue;}
   if(token.type==='blockquote'){for(const line of plainText(token.tokens).split('\n'))result.push(new Paragraph({children:[new TextRun({text:line,italics:true,color:'596380'})],indent:{left:360}}));continue;}
   if(token.type==='hr'){result.push(new Paragraph('────────────────'));continue;}
   result.push(new Paragraph({children:runs(token.tokens||[{type:'text',text:token.text||''}]),...(token.type==='heading'?{heading:'Heading'+token.depth}:{})}));
  }
  return result;
 }
 const children=blocks(parsed.tokens);
 const doc=new Document({title,creator:'AllToolNexa',styles:{default:{document:{run:{font:'Arial',size:24},paragraph:{spacing:{after:160}}}}},numbering:{config:numbering},sections:[{properties:{page:{margin:{top:1080,bottom:1080,left:1080,right:1080}}},children:children.length?children:[new Paragraph('')]}]});
 return Packer.toBlob(doc);
}
export function pdfPageBreaks(height,blocks,pageHeight=1020){
 const points=[0];let start=0;
 while(start<height){
  let cut=Math.min(height,start+pageHeight);
  if(cut<height){
   const crossing=blocks.filter(block=>block.top>start+100&&block.top<cut&&block.bottom>cut&&block.bottom-block.top<pageHeight*.9);
   if(crossing.length)cut=Math.min(...crossing.map(block=>block.top));
  }
  cut=Math.min(height,Math.max(start+1,Math.floor(cut)));points.push(cut);start=cut;
  if(points.length>41)throw Error('Direct PDF supports up to 40 pages. Use a shorter document or Print / Save PDF.');
 }
 return points;
}
export async function markdownPDF(parsed,title,{signal,onProgress}={}){
 const [{default:html2canvas},{PDFDocument,StandardFonts}]=await Promise.all([import('html2canvas'),import('pdf-lib')]);
 signal?.throwIfAborted();const host=document.createElement('div'),style=document.createElement('style');
 host.style.cssText='position:absolute;left:-10000px;top:0;width:700px;z-index:-1;pointer-events:none';
 style.textContent=DOCUMENT_CSS;host.append(style);const article=document.createElement('article');article.className='md-document';article.style.cssText='width:700px;padding:0;margin:0';article.innerHTML=parsed.html;host.append(article);document.body.append(host);
 try{
  await document.fonts.ready;signal?.throwIfAborted();
  const bounds=article.getBoundingClientRect(),height=Math.max(1,Math.ceil(bounds.height));
  const elements=[...article.querySelectorAll('p,h1,h2,h3,h4,h5,h6,pre,li,tr')].map(element=>{const rect=element.getBoundingClientRect();return {top:rect.top-bounds.top,bottom:rect.bottom-bounds.top};});
  const points=pdfPageBreaks(height,elements),pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);pdf.setTitle(title);pdf.setCreator('AllToolNexa Markdown Studio');
  for(let i=0;i<points.length-1;i++){
   signal?.throwIfAborted();onProgress?.(`Creating PDF page ${i+1} of ${points.length-1}…`);
   const canvas=await html2canvas(article,{scale:1.5,width:700,height:points[i+1]-points[i],y:points[i],backgroundColor:'#ffffff',logging:false,useCORS:false,allowTaint:false,windowWidth:1000,windowHeight:1200,scrollX:0,scrollY:0});
   signal?.throwIfAborted();const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('Could not render the PDF page.');
   const image=await pdf.embedPng(await blob.arrayBuffer()),page=pdf.addPage([595.28,841.89]),width=523.28,imageHeight=canvas.height/canvas.width*width;
   page.drawImage(image,{x:36,y:841.89-36-imageHeight,width,height:imageHeight});page.drawText(String(i+1),{x:293,y:17,size:9,font,color:undefined});canvas.width=0;canvas.height=0;
  }
  signal?.throwIfAborted();return new Blob([await pdf.save()],{type:'application/pdf'});
 }finally{host.remove();}
}
export async function exportMarkdown(source,title,format,options={}){
 if(!source.trim())throw Error('Write or import a document before exporting.');
 const parsed=await cleanMarkdown(source);options.signal?.throwIfAborted();
 if(format==='docx')return markdownDOCX(parsed,title);
 if(format==='pdf')return markdownPDF(parsed,title,options);
 if(format==='md')return new Blob([source],{type:'text/markdown;charset=utf-8'});
 if(format==='html')return new Blob([standaloneHTML(parsed.html,title)],{type:'text/html;charset=utf-8'});
 if(format==='txt')return new Blob([parsed.text+'\n'],{type:'text/plain;charset=utf-8'});
 if(format==='rtf')return new Blob([markdownRTF(parsed)],{type:'application/rtf'});
 throw Error('Choose a supported export format.');
}
