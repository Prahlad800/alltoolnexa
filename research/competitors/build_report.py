"""Generate the audit ledger from observed captures and explicit analyst annotations."""
import csv, json, re
from pathlib import Path
from urllib.parse import urlsplit
from summarize import main as summarize

ROOT=Path(__file__).parent
DATE='2026-10-24 (Asia/Calcutta)'
IDEAS=[
 'Group PDF actions by organize, optimize, convert and security; preserve a clear next action after download.',
 'Keep formulas, units, worked examples and calculator assumptions beside results.',
 'Use a short choose-settings-result flow; disclose free limits before processing.',
 'Show output format and advanced settings before starting a conversion.',
 'Make image operations consistent and keep original downloads within reach.',
 'Separate API job accounting from interactive local tools; show processing location explicitly.',
 'Preserve local editing and keyboard controls; progressively load complex editor features.',
 'Offer task-specific PDF controls with explicit feature-loss disclosures.',
 'Choose output format early and expose file caps at selection time.',
 'Keep free-first discovery and searchable PDF tasks prominent.',
 'Treat animation as a separate capability; never silently flatten animated images.',
 'Pair calculators with readable explanations and examples rather than inventory counts alone.',
 'Do not infer features behind the observed security challenge. Revisit through normal access only.',
 'Organize converters by input/output family and explain optional parameters.',
 'Show exact original/output sizes and handle larger outputs honestly.',
 'Keep resize dimensions, crop and compression distinct; show batch and size limits.',
 'Group edit, improve and convert tasks with clear capability descriptions.',
 'Keep developer inputs editable and outputs copyable; make sample inputs explicit.',
 'Use a visible conversion sequence and show format support before file selection.',
 'Prioritize useful categories and popular tasks over an undifferentiated wall of tools.',
 'Expose advanced PDF options progressively; avoid crowding the initial selection step.',
 'Offer target-size shortcuts without promising every target can be achieved.',
 'Use target bytes and unit labels; keep photo dimensions independent of compression.',
 'Offer task-oriented discovery but consolidate overlapping canonical implementations.',
 'Treat the suspended service as unavailable; do not make claims about its previous tools.',
 'Make India tasks discoverable while distinguishing implemented tools from idea counts.',
 'State local-processing behavior per tool and verify it with network tests.',
 'Link form/exam tasks together; require authoritative dated specifications before exam presets.',
 'Keep India finance and document tasks together without fabricating live bank/tax data.',
 'Provide photo/signature workflows with explicit dimensions, format and byte limits.',
 'Avoid universal no-limit claims; disclose browser memory limits and encryption caveats.',
 'Group student tasks and explain scoring/planning assumptions alongside outputs.',
]
PRICING={
 1:('https://www.ilovepdf.com/pricing','Basic, Premium and Business are advertised; exact localized amounts not established.'),
 3:('https://smallpdf.com/pricing','Free has limited downloads; Pro adds unrestricted downloads and advanced features. Localized amounts were unresolved placeholders.'),
 4:('https://www.freeconvert.com/pricing','Monthly Basic $12.99, Standard $24.99, Pro $29.99; respective allowances 1,500/2,000/4,000 minutes and 1.5/2/5 GB. Paid plans advertise no ads.'),
 5:('https://www.iloveimg.com/pricing','Basic free access is limited; Premium and Business are advertised. Exact amount not verified.'),
 6:('https://cloudconvert.com/pricing','Free: 10 credits/day, 1 GB maximum, five-minute processing and five concurrent tasks. Packages, subscriptions and enterprise advertised; dynamic paid amount unresolved.'),
 8:('https://www.sejda.com/upgrade','Official upgrade page reviewed; paid amounts and tool-specific free limits remain unverified.'),
 9:('https://convertio.co/pricing/','Lite/Basic/Pro monthly USD 11.99/22.99/44.99; annual-billed equivalents 6.99/13.99/25.99 per month. Caps 1/3/10 GB and 1,000/3,000/10,000 monthly credits.'),
 14:('https://www.online-convert.com/pricing','Free trial, subscription and credit-based purchase options; exact dynamically rendered amount not verified.'),
 15:('https://tinypng.com/pricing/web','Web Free advertises 20 compressions/session, 5 MB/image and three conversions/session. Pro and Ultra raise limits; monetary amounts unresolved.'),
 16:('https://imageresizer.com/pricing','Free: five images/batch, 10 MB/image; Pro $6.99/month, 20/batch and 50 MB; Ultra $9.99/month, 100/batch and 1 GB. Recheck currency/tax at purchase.'),
 17:('https://www.pdf2go.com/pricing','Official plans page reviewed. Exact paid amount and allowances remain unverified.'),
 20:('https://tinywow.com/pricing','Pricing URL reviewed; definitive paid-plan amounts/allowances not established from the returned content.'),
}

def safe(value): return str(value or '').replace('|','/').replace('\n',' ')
def signal(r):
 scripts=' '.join(r.get('scripts',[]))
 return '; '.join(name for pattern,name in [(r'/_next/','Next-style asset paths'),(r'/assets/','bundled asset paths'),(r'jquery','jQuery-named asset')] if re.search(pattern,scripts,re.I)) or 'Framework unknown from selected evidence'
def network(r):
 items=r.get('events',{}).get('items',[])
 requests=[x for x in items if x.get('kind')=='request']
 return {'retained_requests':len(requests),'methods':sorted(set(x.get('method','?') for x in requests)),
         'origins':sorted(set(x.get('url',{}).get('origin') or '' for x in requests)),
         'xhr_fetch':list(dict.fromkeys(x.get('method','')+' '+urlsplit(x.get('url',{}).get('url',''))._replace(query='',fragment='').geturl() for x in requests if x.get('resource_type') in ('xhr','fetch')))[:20],
         'omissions':r.get('events',{}).get('omissions')}

def build():
 summarize()
 rows=json.loads((ROOT/'observations.json').read_text(encoding='utf-8'))
 homes=[r for r in rows if r['scope']=='homepage']; tools={r['index']:r for r in rows if r['scope']=='tool'}
 supplements={r['index']:r for r in json.loads((ROOT/'supplement.json').read_text(encoding='utf-8'))} if (ROOT/'supplement.json').exists() else {}
 ledger=[]; detail=[]; table=[]
 for h in homes:
  i=h['index']; t=tools.get(i); blocked=i in (13,25)
  inline=i in (6,9,21)
  surface='blocked-security-check' if i==13 else 'unavailable-suspended' if i==25 else 'observed'
  toolstate='not-accessible' if blocked else ('capture-failed' if t and (not t['title'] or t['step_errors']) else 'partial-interface-cleanup-error' if t and t.get('capture_error') else 'interface-captured' if t else 'homepage-tool-surface' if inline else 'pending')
  supplement=supplements.get(i)
  if supplement and not t: toolstate=supplement['status']
  if i==7 and not t: toolstate='homepage-only-editor-not-opened'
  price=PRICING.get(i)
  rec={'index':i,'competitor':h['url'],'homepage':surface,'tool_interface':toolstate,
       'pricing':'official-page-reviewed' if price else 'not-verified','upload_processing_download':'pending' if not blocked else 'blocked',
       'mobile_keyboard_accessibility':'pending','private_backend':'unknown','api_contract':'not-runtime-verified',
       'evidence_files':[h['file']]+([t['file']] if t else []),'evidence_ids':[h['evidence_id']]+([t['evidence_id']] if t else []),
       'network_completeness':h['completeness'],'opportunity':IDEAS[i-1]}
  if supplement: rec['web_supplement']=supplement
  if price: rec['pricing_evidence']={'source':price[0],'review_date':DATE,'finding':price[1]}
  if i in (4,15): rec['api_contract']='official-contract-documented; runtime-not-tested'
  ledger.append(rec)
  table.append(f"| {i} | [{safe(urlsplit(h['url']).netloc)}]({h['url']}) | {surface} | {toolstate} | {'Reviewed' if price else 'Unknown'} | {'Blocked' if blocked else 'Pending'} |")
  source=t if t and t['title'] else h; net=network(source)
  forms=source.get('inputs',[]); meta=source.get('meta',[])
  description=next((m.get('content','') for m in meta if m.get('name')=='description'),'Not observed')
  detail += [f"### {i}. {urlsplit(h['url']).netloc}",f"Source: {h['url']} — [{h['file']}]({h['file']}); REA `{h['evidence_id']}`.",
    f"CONFIRMED observed page title: {h['title']}. Homepage status: {surface}."]
  if t: detail += [f"Representative page: {t['url']} — [{t['file']}]({t['file']}); REA evidence identifier: `{t['evidence_id'] or 'not-issued: partial observation only'}`. Title: {t['title']}. Step errors: {json.dumps(t['step_errors'])}. Capture error: {json.dumps(t.get('capture_error'))}."]
  if supplement: detail += [f"Supplemental official-page review: {supplement['url']} — {supplement['status']}. {supplement['finding']} See web-supplement.json; web-reader evidence is distinct from REA runtime evidence."]
  detail += [f"CONFIRMED captured controls: {len(forms)} input elements; input types: {', '.join(sorted(set(f.get('type','text') for f in forms)))}. Declared accepted file types: {', '.join(sorted(set(f.get('accept','') for f in forms if f.get('accept')))) or 'not observed'}. DOM counts include hidden elements and do not prove visibility or usability.",
    f"CONFIRMED network metadata: {net['retained_requests']} retained requests; methods {', '.join(net['methods'])}. Capture status: {source['completeness']}. See observations.json for origins, raw events and omissions. Loading traffic is not evidence of a completed conversion.",
    f"INFERRED frontend clue: {signal(source)}. Private language, database, queue, storage vendor, scaling and server-side processing implementation: UNKNOWN.",
    f"SEO observations: {sum(m.get('name')=='description' for m in meta)} description meta tags; {source['tag_counts'].get('h1',0)} h1 elements; {source['tag_counts'].get('nav',0)} nav elements. Canonical, structured-data correctness, indexing and ranking require separate validation.",
    f"Public API discovery: {', '.join(h['api_links'][:4]) or 'No API documentation link identified by the limited link matcher; absence is not established.'}",
    f"Pricing ({DATE}): {price[1]+' Source: '+price[0] if price else 'UNKNOWN. No paid model or exact limit verified. A free marketing claim is not an unlimited-use guarantee.'}",
    f"AllToolNexa opportunity (analyst proposal): {IDEAS[i-1]}",
    'Remaining: synthetic-file processing, progress/error states, output correctness, download, responsive visual review, keyboard operation, login/cloud history, and runtime API payload contracts. Not completed by these captures.','']
 summary={'homepages_attempted':len(homes),'homepage_content_observed':sum(r['homepage']=='observed' for r in ledger),'restricted_or_unavailable':sum(r['homepage']!='observed' for r in ledger),'additional_rea_tool_attempts':len(tools),'complete_tool_interface_captures':sum(r['tool_interface']=='interface-captured' for r in ledger),'partial_tool_interface_captures':sum(r['tool_interface']=='partial-interface-cleanup-error' for r in ledger),'competitor_upload_download_workflows_tested':0,'official_pricing_pages_reviewed':len(PRICING)}
 (ROOT/'status.json').write_text(json.dumps({'date':DATE,'sites_total':32,'summary':summary,'ledger':ledger},indent=2),encoding='utf-8')
 with (ROOT/'status.csv').open('w',newline='',encoding='utf-8') as f:
  fields=['index','competitor','homepage','tool_interface','pricing','upload_processing_download','mobile_keyboard_accessibility','private_backend','api_contract']; w=csv.DictWriter(f,fieldnames=fields,extrasaction='ignore');w.writeheader();w.writerows(ledger)
 intro=['# AllToolNexa competitor evidence audit',f'Date: {DATE}. Scope: all 32 requested competitors.','',
 'This is a surface/interface audit, not a completed end-to-end certification or private-backend reconstruction. All 32 homepages were attempted with REA. SmallSEOTools presented a security challenge; utilitytools.in presented a suspended-service page. No access restrictions were bypassed.',
 'REA launched temporary headless Edge profiles, navigated the selected public URLs, waited briefly, and retained DOM, accessibility and request metadata. Default viewport was 1280×720; service workers were blocked and the browser environment defaulted to UTC/en-US. These settings can alter behavior. Some event captures report omissions. No accounts, payments or real personal files were used.',
 'CONFIRMED means observed in the selected capture, or an explicitly attributed official-page claim. A site advertising local processing is not independently verified local processing. INFERRED means a reasoned clue, not a private implementation fact. UNKNOWN and PENDING are retained rather than filled with guesses.',
 'The tool-interface captures only loaded pages: they did not exercise file upload/processing/download. Initial public interfaces do not establish authenticated API contracts, processing accuracy, deletion policies, retention, accessibility conformance, performance or uptime.',
 'Evidence is research material only. No competitor assets, scripts or layouts were incorporated into AllToolNexa. The implementation uses the existing project and an original local algorithm.',
 '', '## Completion ledger','', '| # | Competitor | Homepage | Representative interface | Pricing | Full workflow |','|---|---|---|---|---|---|']
 (ROOT/'REPORT.md').write_text('\n\n'.join(intro[:10])+'\n'+'\n'.join(intro[10:]+table)+'\n\n## Site findings\n\n'+'\n\n'.join(detail),encoding='utf-8')
 print(json.dumps({'sites':len(homes),'tool_captures':len(tools),'ledger':'status.json'}))

if __name__=='__main__': build()
