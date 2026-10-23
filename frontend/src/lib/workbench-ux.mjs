export function actionLabel(tool){
 if(tool.actionLabel)return tool.actionLabel;
 if(tool.id==='word-counter')return 'Count words';
 if(tool.kind!=='standard')return tool.name;
 if(/validat|checker/i.test(tool.name))return 'Check input';
 if(/format/i.test(tool.name))return 'Format input';
 if(/templates/.test(tool.category))return 'Create draft';
 if(/convert/i.test(tool.name))return 'Convert';
 if(/generator/i.test(tool.name))return 'Generate result';
 if(tool.category==='text')return 'Transform text';
 return 'Calculate';
}
export function fieldErrors(tool,values){
 const errors={};
 for(const f of tool.fields){if(tool.mode==='compress'&&values.strategy!=='rasterize'&&['consent','scale','quality'].includes(f.key))continue;const v=String(values[f.key]??'');if(f.type==='number'&&(v.trim()===''||!Number.isFinite(Number(v))))errors[f.key]=`${f.label}: enter a number.`;else if(f.type==='number'&&((f.min!==undefined&&Number(v)<f.min)||(f.max!==undefined&&Number(v)>f.max)))errors[f.key]=`${f.label}: use ${f.min??'any value'} to ${f.max??'any value'}.`;}
 return errors;
}
export function resultMetrics(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const entries=Object.entries(value);
 return entries.length>0&&entries.length<=20&&entries.every(([,v])=>['number','string','boolean'].includes(typeof v))?entries:null;
}
