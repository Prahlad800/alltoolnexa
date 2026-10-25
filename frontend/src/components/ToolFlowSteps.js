export default function ToolFlowSteps({step=1,upload=false}){
 const labels=[upload?'Upload & configure':'Input & configure','Processing','Preview & export'];
 return <div className="tool-flow-heading"><p className="flow-caption" role="status">Step {step} of 3 <span>/</span> {labels[step-1]}</p><ol className="workspace-steps flow-steps" aria-label="Tool workflow">{labels.map((label,i)=><li key={label} aria-current={step===i+1?'step':undefined} className={i+1<step?'flow-complete':''}><b>{i+1}</b> {label}</li>)}</ol></div>;
}
