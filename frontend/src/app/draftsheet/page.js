import {pageMetadata} from '@/lib/site';
import SpreadsheetEditor from '@/components/SpreadsheetEditor';
import styles from '@/components/OfficeWorkspace.module.css';
export const metadata=pageMetadata('DraftSheet - Free Online Spreadsheet Editor','Edit spreadsheets with formulas, formatting, multiple sheets and range charts. Import XLSX or CSV, save locally and export your workbook.','/draftsheet');
export default function Page(){return <div data-office-workspace="draftsheet" className={`${styles.workspace} ${styles.excel}`}><SpreadsheetEditor officeMode/></div>;}
