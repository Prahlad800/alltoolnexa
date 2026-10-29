import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {parseMarkdown,safeLink,safeFileName,markdownRTF,markdownEdit,rtfEscape,standaloneHTML,MAX_MARKDOWN} from '../shared/markdown-workspace.mjs';
import {markdownDOCX,pdfPageBreaks} from '../src/lib/markdown-converters.mjs';
const source='# Project notes\n\n**Bold**, *italic* and [a link](https://example.com).\n\n## Details\n\n1. First\n2. Second\n\n- [x] Ready\n- [ ] Next\n\n| Name | Value |\n| --- | --- |\n| Item | 42 |\n\n> A quote\n\n```js\nconsole.log("hello");\n```\n\nनमस्ते दुनिया';
test('Markdown parser preserves GFM structures, outline, code and readable Unicode text',()=>{
 const doc=parseMarkdown(source);for(const tag of ['<h1','<h2','<strong>','<em>','<ol>','<table>','<blockquote>','<pre>'])assert.ok(doc.html.includes(tag),tag);
 assert.equal(doc.headings[0].id,'md-project-notes');assert.ok(doc.words>20);assert.ok(doc.text.includes('नमस्ते'));assert.ok(doc.text.includes('Name\tValue'));assert.ok(doc.text.includes('1. First'));assert.ok(doc.text.includes('[x] Ready'));assert.equal(parseMarkdown('`&amp;` stays literal').text,'&amp; stays literal');
 const duplicates=parseMarkdown('# Same\n\n# Same');assert.deepEqual(duplicates.headings.map(h=>h.id),['md-same','md-same-2']);
});
test('raw HTML, image fetches and active link protocols stay inert',()=>{
 const doc=parseMarkdown('<script>alert(1)</script>\n\n![photo](https://tracker.invalid/pixel)\n\n[bad](javascript:alert%281%29)\n\n[good](https://example.com)');
 assert.ok(!doc.html.includes('<script>'));assert.ok(!doc.html.includes('<img'));assert.ok(!doc.html.includes('href="javascript:'));assert.ok(doc.html.includes('[Image: photo]'));
 for(const url of ['javascript:alert(1)','java&#x73;cript:alert(1)','data:text/html,hello','file:///etc/passwd','//evil.invalid','/api/private'])assert.equal(safeLink(url),null,url);
 assert.equal(safeLink('https://example.com'),'https://example.com/');assert.equal(safeLink('mailto:user@example.com'),'mailto:user@example.com');
});
test('source bounds, filenames and editor actions preserve text and selection',()=>{
 assert.throws(()=>parseMarkdown('x'.repeat(MAX_MARKDOWN+1)));
 const edit=markdownEdit('hello world',6,11,'bold');assert.equal(edit.value,'hello **world**');assert.equal(edit.value.slice(edit.start,edit.end),'world');
 assert.equal(markdownEdit('one\ntwo',0,7,'list').value,'- one\n- two');assert.ok(markdownEdit('',0,0,'table').value.includes('| --- |'));
 assert.equal(safeFileName('../notes.md'),'..-notes');assert.equal(safeFileName(''), 'document');
});
test('HTML and RTF exports escape document titles and preserve Unicode as signed UTF-16',()=>{
 const doc=parseMarkdown(source),html=standaloneHTML(doc.html,'<script>bad</script>');assert.ok(html.includes('&lt;script&gt;bad&lt;/script&gt;'));assert.ok(html.includes("script-src 'none'"));
 const rtf=markdownRTF(doc);assert.ok(rtf.startsWith('{\\rtf1'));assert.ok(rtf.includes('\\b '));assert.ok(rtf.includes('\\u'));assert.ok(rtf.includes('console.log'));
 assert.equal(rtfEscape('{x}\\'), '\\{x\\}\\\\');assert.ok(rtfEscape('😀').includes('\\u-10179?\\u-8704?'));
});
test('Word export has real editable headings, numbering, table, hyperlink, code and Unicode',async()=>{
 const blob=await markdownDOCX(parseMarkdown(source),'Project notes'),zip=await JSZip.loadAsync(await blob.arrayBuffer()),xml=await zip.file('word/document.xml').async('string'),relationships=await zip.file('word/_rels/document.xml.rels').async('string');
 for(const text of ['Heading1','Heading2','<w:tbl>','<w:numPr>','<w:b','Consolas','नमस्ते','console.log'])assert.ok(xml.includes(text),text);
 assert.ok(relationships.includes('https://example.com/'));assert.equal((xml.match(/A quote/g)||[]).length,1);assert.equal((xml.match(/<w:tblHeader/g)||[]).length,1);
});
test('PDF pagination advances, avoids splitting short blocks and enforces page limits',()=>{
 assert.deepEqual(pdfPageBreaks(2000,[{top:900,bottom:1100}]),[0,900,1920,2000]);
 assert.deepEqual(pdfPageBreaks(10,[]),[0,10]);assert.throws(()=>pdfPageBreaks(50000,[]),/40 pages/);
});
