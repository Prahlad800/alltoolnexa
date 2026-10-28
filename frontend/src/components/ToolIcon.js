import {toolIcon,categoryIcon,iconPaths} from '../lib/tool-icons.mjs';

export default function ToolIcon({tool,category=tool?.category,compact=false,className=''}){
 const {glyph,badge}=tool?toolIcon(tool):categoryIcon(category);
 return <span className={`tool-icon icon-${category} meaningful-tool-icon ${compact?'tool-icon-compact':''} ${className}`} aria-hidden="true" data-tool-icon={glyph}>
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" focusable="false"><path d={iconPaths[glyph]}/></svg>
  {badge&&<small className="tool-icon-badge">{badge}</small>}
 </span>;
}
