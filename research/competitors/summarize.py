"""Build a reproducible inventory from retained REA captures (no network calls)."""
import json, re
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).parent

class Page(HTMLParser):
    def __init__(self):
        super().__init__(); self.skip=0; self.text=[]; self.links=[]; self.scripts=[]; self.meta=[]; self.inputs=[]; self.tag_counts={}
    def handle_starttag(self, tag, attrs):
        a=dict(attrs); self.tag_counts[tag]=self.tag_counts.get(tag,0)+1
        if tag in ('script','style'): self.skip+=1
        if tag=='a' and a.get('href'): self.links.append(a['href'])
        if tag=='script' and a.get('src'): self.scripts.append(a['src'])
        if tag=='meta': self.meta.append(a)
        if tag=='input': self.inputs.append({k:v for k,v in a.items() if k in ('type','accept','placeholder','aria-label')})
    def handle_endtag(self, tag):
        if tag in ('script','style'): self.skip=max(0,self.skip-1)
    def handle_data(self, data):
        if not self.skip and data.strip(): self.text.append(data.strip())

def unwrap(raw):
    if raw.get('structuredContent'): return raw['structuredContent']
    for c in raw.get('content',[]):
        if c.get('type')=='text':
            try:
                e=json.loads(c['text'])
                if 'error' in e:
                    d=e['error'].get('details',{}); p=d.get('partial_observation',{})
                    if not p: p=d.get('diagnostics',{}).get('primary_error',{}).get('details',{}).get('partial_observation',{})
                    capture=p.get('capture')
                    if capture:
                        steps=capture.get('steps',[])
                        url=steps[0].get('after_url',{}).get('url') if steps else None
                        capture['completeness']={'status':'partial-recovered','equality_eligible':False,'missing_sections':['cleanup-confirmation'],'truncated_sections':[]}
                        return {'normalized_result':capture,'parameters':{'start_url':{'url':url}},'limitations':capture.get('limitations',[]),'capture_error':{'code':e['error'].get('code'),'message':e['error'].get('message'),'resources':d.get('resources')}}
                return e
            except ValueError: pass
    return raw

def main():
    rows=[]
    for path in sorted((ROOT/'evidence').glob('*.json'))+sorted((ROOT/'tool-evidence').glob('*.json')):
        if not re.match(r'^\d\d',path.name): continue
        e=unwrap(json.loads(path.read_text(encoding='utf-8')))
        n=e.get('normalized_result',{}); steps=n.get('steps',[]); html=''; ax=None
        for step in steps:
            a=step.get('artifacts',{})
            if a.get('dom',{}).get('state')=='captured': html=a['dom']['value'].get('text','')
            if a.get('accessibility',{}).get('state')=='captured': ax=a['accessibility'].get('value')
        p=Page(); p.feed(html); text=' '.join(p.text)
        title=re.search(r'<title[^>]*>(.*?)</title>',html,re.S|re.I)
        links=list(dict.fromkeys(p.links))
        row={'file':str(path.relative_to(ROOT)).replace('\\','/'),'index':int(path.name[:2]),'scope':'homepage' if path.parent.name=='evidence' else 'tool','evidence_id':e.get('evidence_id'),'url':e.get('parameters',{}).get('start_url',{}).get('url'),
             'title':title.group(1) if title else None,'completeness':n.get('completeness'),'capture_error':e.get('capture_error') or e.get('error'),
             'step_errors':[s.get('error') for s in steps if s.get('status')!='completed'],
             'text':text,'links':links,'pricing_links':[x for x in links if re.search(r'pric|premium|plans|subscription|upgrade',x,re.I)],
             'api_links':[x for x in links if re.search(r'api|developers',x,re.I)],'scripts':p.scripts,'meta':p.meta,'inputs':p.inputs,'tag_counts':p.tag_counts,
             'events':n.get('events',{}),'limitations':e.get('limitations',[]),'accessibility':ax}
        rows.append(row)
    (ROOT/'observations.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
    for r in rows:
        print(json.dumps({k:r[k] for k in ('file','url','title','step_errors','pricing_links','api_links')},ensure_ascii=True))
        print(r['text'][:700].encode('ascii','backslashreplace').decode())

if __name__=='__main__': main()
