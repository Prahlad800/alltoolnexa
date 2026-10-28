import {T} from '@/components/LanguageProvider';
export default function ToolFlowSteps({step=1,upload=false}){
 const labels=[upload?'Upload & configure':'Input & configure','Processing','Preview & export'];
 return <div className="tool-flow-heading"><p className="flow-caption" role="status"><T>Step</T> {step} / 3 <span>/</span> <T>{labels[step-1]}</T></p><ol className="workspace-steps flow-steps" aria-label="Tool workflow">{labels.map((label,i)=><li key={label} aria-current={step===i+1?'step':undefined} className={i+1<step?'flow-complete':''}><b>{i+1}</b> {<T>{label}</T>}</li>)}</ol></div>;
}
