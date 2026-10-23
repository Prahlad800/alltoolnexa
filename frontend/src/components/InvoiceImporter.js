'use client';
import { useEffect, useRef, useState } from 'react';
import { convertReviewedInvoice, extractInvoice, IMPORT_FORMATS, IMPORT_NOTE, validateInvoiceSource } from '../lib/invoice-import.mjs';
import styles from './InvoiceImporter.module.css';

export default function InvoiceImporter() {
  const [file, setFile] = useState(null), [password, setPassword] = useState(''), [useOCR, setUseOCR] = useState(false), [language, setLanguage] = useState('eng');
  const [text, setText] = useState(''), [format, setFormat] = useState('HTML'), [busy, setBusy] = useState(false), [status, setStatus] = useState(''), [error, setError] = useState(''), [warning, setWarning] = useState(''), [output, setOutput] = useState(null);
  const controller = useRef(null), outputURL = useRef(null), generation = useRef(0), fileInput = useRef(null);
  useEffect(() => () => { generation.current++; controller.current?.abort(); if (outputURL.current) URL.revokeObjectURL(outputURL.current); }, []);
  const clearOutput = () => { if (outputURL.current) URL.revokeObjectURL(outputURL.current); outputURL.current = null; setOutput(null); };
  const cancel = () => { generation.current++; controller.current?.abort(); setBusy(false); setStatus('Cancelled. You can try again or edit the text.'); };
  const choose = event => {
    const chosen = event.target.files?.[0]; if (!chosen) return;
    try { validateInvoiceSource(chosen); generation.current++; controller.current?.abort(); clearOutput(); setFile(chosen); setText(''); setPassword(''); setError(''); setWarning(''); setStatus('File selected. Extract text, then review it before exporting.'); }
    catch (failure) { setError(failure.message); event.target.value = ''; }
  };
  const run = async action => {
    const id = ++generation.current; controller.current?.abort(); const task = new AbortController(); controller.current = task;
    setBusy(true); setError(''); clearOutput();
    try {
      if (action === 'extract') {
        const result = await extractInvoice(file, { password, useOCR, language, signal: task.signal, onProgress: value => { if (id === generation.current) setStatus(value); } });
        if (id !== generation.current) return;
        setText(result.text); setWarning(result.warning); setStatus(`${result.method}: ${result.pages} page(s). Review and correct the extracted text below.`);
      } else {
        setStatus('Converting reviewed text…');
        const result = await convertReviewedInvoice(text, format, { signal: task.signal });
        if (id !== generation.current) return;
        const url = URL.createObjectURL(result.blob); outputURL.current = url; setOutput({ ...result, url }); setStatus('Download ready.');
      }
    } catch (failure) { if (id === generation.current && !task.signal.aborted) { setError(failure.message); setStatus(''); } }
    finally { if (id === generation.current) setBusy(false); }
  };
  return <section className={styles.root} aria-label="Convert an existing invoice">
    <div className={styles.intro}><h2>Upload an invoice or photo</h2><p>Extract selectable PDF text, or read a photo with OCR. Review the text, then convert it to HTML, Excel, CSV, PDF or photos.</p><p>{IMPORT_NOTE}</p></div>
    <div className={styles.columns}>
      <div className={styles.panel}>
        <label className={styles.field}>Invoice file · PDF, PNG, JPEG or WebP<input ref={fileInput} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" disabled={busy} onChange={choose}/></label>
        <p className={styles.hint}>One file up to 20 MB. PDF: up to 10 pages. Image: device pixel limits apply. {file ? `Selected: ${file.name}` : ''}</p>
        {file?.type === 'application/pdf' && <><label className={styles.field}>PDF opening password (if required)<input type="password" autoComplete="off" disabled={busy} value={password} onChange={event => setPassword(event.target.value)}/></label><label className={styles.check}><input type="checkbox" disabled={busy} checked={useOCR} onChange={event => setUseOCR(event.target.checked)}/>Use OCR for PDF pages with no selectable text</label></>}
        <label className={styles.field}>OCR language<select value={language} disabled={busy} onChange={event => setLanguage(event.target.value)}><option value="eng">English</option><option value="hin">Hindi</option><option value="eng+hin">English and Hindi</option></select></label>
        <p className={styles.hint}>OCR runs in this browser. First use downloads its engine and language model from public hosts; an internet connection is needed. Your invoice image is not uploaded for recognition. Accuracy depends on print, lighting and resolution.</p>
        <button className="button primary" disabled={busy || !file} onClick={() => run('extract')}>Extract invoice text</button>
        <label className={styles.field}>Review and edit invoice text<textarea rows={18} spellCheck={false} value={text} disabled={busy} placeholder="Extract text from a file, or paste/type invoice text here." onChange={event => { setText(event.target.value); clearOutput(); setStatus('Text changed. Export again to update your download.'); }}/></label>
        {warning && <p className={styles.warning}>{warning}</p>}
      </div>
      <div className={styles.panel}>
        <h2>Export reviewed text</h2><label className={styles.field}>Output format<select value={format} disabled={busy} onChange={event => { setFormat(event.target.value); clearOutput(); }}>{IMPORT_FORMATS.map(value => <option key={value}>{value}</option>)}</select></label>
        <p className={styles.hint}>Excel contains literal text lines with line positions, for manual cleanup. CSV has a line number and text column; formula-like lines receive a protective apostrophe. PDF and photos render the reviewed text using installed fonts. PDF text is image based. Long photos download as a ZIP. Original invoice styling is not preserved.</p>
        <div className={styles.actions}><button className="button primary" disabled={busy || !text.trim()} onClick={() => run('export')}>Convert reviewed text</button>{busy && <button className="button secondary" onClick={cancel}>Cancel</button>}<button className="button secondary" disabled={busy} onClick={() => { generation.current++; clearOutput(); setFile(null); setText(''); setError(''); setWarning(''); setPassword(''); setStatus('Cleared.'); if (fileInput.current) fileInput.current.value = ''; }}>Clear</button></div>
        {error && <p role="alert" className={styles.error}>{error}</p>}<p role="status" aria-live="polite">{status}</p>
        {output && <div className={styles.result}>{output.warning && <p>{output.warning}</p>}{output.preview && <img src={output.url} alt="Reviewed invoice text preview"/>}{output.blob.type === 'application/pdf' && <iframe title="Reviewed invoice PDF" src={output.url}/>}<a className="button primary" href={output.url} download={output.filename}>Download {output.filename}</a></div>}
      </div>
    </div><p className={styles.hint}>No account or saved inputs. Files and reviewed text remain in this tab.</p>
  </section>;
}
