import OfficeIcon from './OfficeIcon';
import styles from './OfficeRibbon.module.css';
export function RibbonButton({label,icon,onClick,pressed,large=false,iconOnly=false,disabled=false,preserveSelection=false,title}){return <button type="button" aria-label={label} title={title||label} aria-pressed={pressed} disabled={disabled} onMouseDown={e=>{if(preserveSelection)e.preventDefault();}} onClick={onClick} className={`${styles.button} ${large?styles.large:''} ${iconOnly?styles.iconOnly:''}`}>{icon&&<OfficeIcon name={icon} size={large?30:18}/>}<span className={iconOnly?styles.hidden:''}>{label}</span></button>;}
export function RibbonGroup({name,children,className=''}){return <div role="group" className={`${styles.group} ${className}`} aria-label={`${name} controls`}><div className={styles.controls}>{children}</div><small>{name}</small></div>;}
export function RibbonRow({children}){return <div className={styles.row}>{children}</div>;}
export function RibbonColumn({children}){return <div className={styles.column}>{children}</div>;}
export function RibbonColor({label,value,onChange,icon}){return <label className={styles.color} title={label}><OfficeIcon name={icon} size={19}/><input aria-label={label} type="color" value={value} onChange={onChange}/></label>;}
export function DraftAppIcon({type}){return type==='word'?<svg width="44" height="44" viewBox="1150 0 780 500" role="img" aria-label="DraftWord icon"><image href="/images/draft-office-artwork.png" width="1983" height="793"/></svg>:<OfficeIcon name="sheet" size={44}/>;}
