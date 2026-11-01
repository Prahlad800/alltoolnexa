import {number, list, round} from './core.mjs';

// SI inputs, explicit domains and bounded datasets keep the mathematical model
// independent of the UI. No material constants or live data are fetched.
const numeric = (key,label,value,min=-1e100,strict=false) => ({key,label,value,type:'number',min,max:1e100,strict});
const series = (key,label,value) => ({key,label,value,type:'textarea'});
function values(input,key) {
 const result=list(input[key],2);
 if(result.length>1000||result.some(x=>Math.abs(x)>1e100))throw Error('Enter 2–1,000 values with magnitude at most 1e100.');
 return result;
}
function paired(input) {
 const x=values(input,'x'),y=values(input,'y');
 if(x.length!==y.length)throw Error('X and Y must have the same number of paired observations.');
 const mean=a=>a.reduce((s,v)=>s+v/a.length,0),mx=mean(x),my=mean(y);
 const xx=x.reduce((s,v)=>s+(v-mx)**2,0),yy=y.reduce((s,v)=>s+(v-my)**2,0),xy=x.reduce((s,v,i)=>s+(v-mx)*(y[i]-my),0);
 return {n:x.length,mx,my,xx,yy,xy};
}
const mass=numeric('mass','Mass (kg)',2,0), velocity=numeric('velocity','Velocity (m/s)',3);
const dataset=[series('text','Positive values (comma or space separated)','1, 4, 16')];
const pairs=[series('x','X observations','1, 2, 3'),series('y','Y observations','2, 4, 6')];
function definition(id,name,fields,formula,output,run,explanation,related=[]) {
 return {id,name,fields,formula,output,run,explanation,related};
}
export const scienceCalculators=[
 definition('geometric-mean-calculator','Geometric Mean Calculator',dataset,'G = exp(Σ ln(xᵢ) / n), where every xᵢ > 0.', 'Geometric mean (same unit as the data)',v=>{const a=values(v,'text');if(a.some(x=>x<=0))throw Error('Every value must be greater than zero.');return Math.exp(a.reduce((s,x)=>s+Math.log(x)/a.length,0));},'Use the geometric mean for positive multiplicative measurements. Logarithms avoid overflow from multiplying the observations. Zero and negative observations are outside this model.',['harmonic-mean-calculator','average-calculator']),
 definition('harmonic-mean-calculator','Harmonic Mean Calculator',dataset,'H = n / Σ(1/xᵢ), where every xᵢ > 0.','Harmonic mean (same unit as the data)',v=>{const a=values(v,'text');if(a.some(x=>x<=0))throw Error('Every value must be greater than zero.');const m=Math.min(...a);return m/(a.reduce((s,x)=>s+m/x,0)/a.length);},'Use the harmonic mean for positive rates with equal numerator quantities, such as speeds over equal distances. It is not the arithmetic mean of arbitrary speeds.',['geometric-mean-calculator','average-calculator']),
 definition('z-score-calculator','Z-Score Calculator',[numeric('value','Observed value',85),numeric('mean','Population mean',70),numeric('sd','Population standard deviation',10,0,true)],'z = (x − μ) / σ; σ > 0.','Standard score (dimensionless)',v=>(v.value-v.mean)/v.sd,'A z-score describes distance from a supplied population mean in standard deviations. This tool does not estimate a p-value or assume a normal distribution.',['standard-deviation']),
 definition('covariance-calculator','Covariance Calculator',[...pairs,{key:'mode',label:'Covariance convention',value:'sample',type:'select',options:['sample','population']}],'Covariance = Σ(xᵢ − x̄)(yᵢ − ȳ) / d; d = n−1 for sample or n for population.','Covariance (X units × Y units)',v=>{const p=paired(v);return p.xy/(v.mode==='sample'?p.n-1:p.n);},'Each X observation must correspond to the Y observation at the same position. Sample covariance uses n−1; population covariance uses n. Constant series give zero covariance.',['correlation-coefficient-calculator','linear-regression-calculator']),
 definition('correlation-coefficient-calculator','Correlation Coefficient Calculator',pairs,'Pearson r = Σ(dx·dy) / √Σ(dx²) / √Σ(dy²). Both series must have nonzero variance.','Pearson correlation r (dimensionless)',v=>{const p=paired(v);if(!p.xx||!p.yy)throw Error('Both series need nonzero variance.');return Math.max(-1,Math.min(1,p.xy/Math.sqrt(p.xx)/Math.sqrt(p.yy)));},'Pearson correlation measures linear association between paired numeric observations. It does not establish causation, and constant series have undefined correlation.',['covariance-calculator','linear-regression-calculator']),
 definition('linear-regression-calculator','Linear Regression Calculator',pairs,'Ordinary least squares: slope b = Σ(dx·dy)/Σ(dx²); intercept a = ȳ−b·x̄; fitted y = a+b·x.','Slope and intercept (units follow the input data)',v=>{const p=paired(v);if(!p.xx)throw Error('X observations need nonzero variance.');const slope=p.xy/p.xx;return {slope,intercept:p.my-slope*p.mx,observations:p.n};},'Fit one explanatory variable with an intercept by unweighted least squares. The result is a line description, not a causal model or a forecast guarantee. A constant Y series is allowed.',['correlation-coefficient-calculator','covariance-calculator']),
 definition('kinetic-energy-calculator','Kinetic Energy Calculator',[mass,velocity],'Eₖ = ½mv²; m is mass in kg and v is velocity in m/s.','Kinetic energy (J)',v=>.5*v.mass*v.velocity**2,'Classical translational kinetic energy assumes speeds much smaller than the speed of light. A signed velocity has the same energy as its opposite.',['momentum-calculator','potential-energy-calculator']),
 definition('potential-energy-calculator','Potential Energy Calculator',[mass,numeric('height','Height above reference (m)',5),numeric('gravity','Gravitational acceleration (m/s²)',9.80665,0)],'U = mgh, relative to a chosen zero-height reference in a uniform gravitational field.','Gravitational potential energy (J)',v=>v.mass*v.gravity*v.height,'Height may be negative relative to your reference. Gravity defaults to standard gravity; change it for the model you need. This is a near-surface uniform-field estimate.',['kinetic-energy-calculator']),
 definition('force-calculator','Force Calculator',[mass,numeric('acceleration','Signed acceleration (m/s²)',3)],'F = ma, for constant mass in one dimension.','Net force (N)',v=>v.mass*v.acceleration,'This computes one signed component of net force from mass and acceleration. It does not sum multiple forces or model a changing mass.',['acceleration-calculator','momentum-calculator']),
 definition('pressure-calculator','Pressure Calculator',[numeric('force','Perpendicular force (N)',100,0),numeric('area','Contact area (m²)',2,0,true)],'p = F/A, with perpendicular force F and area A > 0.','Average pressure (Pa)',v=>v.force/v.area,'Pressure is average normal force per area, in pascals. Enter the area in square metres. This is not a gas equation-of-state or a pressure-vessel design tool.',['force-calculator','density-calculator']),
 definition('density-calculator','Density Calculator',[mass,numeric('volume','Volume (m³)',.001,0,true)],'ρ = m/V, with mass m in kg and volume V > 0 in m³.','Density (kg/m³)',v=>v.mass/v.volume,'Bulk density is mass divided by measured volume. Temperature, porosity and material composition can affect actual measurements; no material density is assumed.',['pressure-calculator']),
 definition('acceleration-calculator','Acceleration Calculator',[numeric('initial','Initial velocity (m/s)',0),numeric('final','Final velocity (m/s)',20),numeric('time','Elapsed time (s)',5,0,true)],'Average acceleration a = (v_final − v_initial)/Δt; Δt > 0.','Average acceleration (m/s²)',v=>(v.final-v.initial)/v.time,'This gives average signed acceleration over an interval. Positive and negative values depend on the direction chosen; it is not instantaneous acceleration.',['force-calculator','momentum-calculator']),
 definition('momentum-calculator','Momentum Calculator',[mass,velocity],'p = mv, for classical linear momentum along one axis.','Linear momentum (kg·m/s)',v=>v.mass*v.velocity,'Velocity and momentum carry a sign along your selected axis. This classical model does not include relativistic corrections.',['kinetic-energy-calculator','force-calculator']),
 definition('wavelength-calculator','Wavelength Calculator',[numeric('speed','Wave speed in the medium (m/s)',343,0,true),numeric('frequency','Frequency (Hz)',1000,0,true)],'λ = v/f, with wave speed v > 0 and frequency f > 0.','Wavelength (m)',v=>v.speed/v.frequency,'Use the propagation speed in the actual medium. The example uses a sound-speed assumption of 343 m/s; this is not a universal constant.',['acceleration-calculator']),
 definition('torque-calculator','Torque Calculator',[numeric('force','Force magnitude (N)',10,0),numeric('radius','Lever-arm length (m)',2,0),{...numeric('angle','Angle between arm and force (degrees)',90,0),max:180}],'Torque magnitude τ = rF sin(θ), with 0° ≤ θ ≤ 180°.','Torque magnitude (N·m)',v=>v.angle===0||v.angle===180?0:v.radius*v.force*Math.sin(v.angle*Math.PI/180),'The angle is between the pivot-to-force arm and the applied force. Output is magnitude only; choose a rotation convention separately for signed torque.',['force-calculator']),
 definition('ohms-law-calculator',"Ohm's Law Calculator",[numeric('current','Current magnitude (A)',2,0),numeric('resistance','Resistance (Ω)',10,0)],'V = IR for an ideal ohmic resistor.','Voltage magnitude (V)',v=>v.current*v.resistance,'Calculate voltage from current and resistance for an ideal resistor. This mode does not solve AC impedance or model non-ohmic components.',['electrical-power-calculator']),
 definition('electrical-power-calculator','Electrical Power Calculator',[numeric('voltage','Voltage magnitude (V)',12,0),numeric('current','Current magnitude (A)',2,0)],'P = VI for DC electrical power.','DC power (W)',v=>v.voltage*v.current,'This is a DC model using voltage and current magnitudes. AC real power additionally requires power factor and phase information and is not calculated here.',['ohms-law-calculator','watt-to-unit-calculator']),
 definition('transformer-calculator','Transformer Calculator',[numeric('primary','Primary voltage (V)',230,0),numeric('primaryTurns','Primary turns',1000,1),numeric('secondaryTurns','Secondary turns',100,1)],'Ideal transformer: Vₛ = Vₚ × Nₛ/Nₚ, where Nₚ and Nₛ are positive whole turns.','Ideal secondary voltage (V)',v=>{if(!Number.isSafeInteger(v.primaryTurns)||!Number.isSafeInteger(v.secondaryTurns))throw Error('Turns must be safe positive whole numbers.');return v.primary*(v.secondaryTurns/v.primaryTurns);},'This is an ideal AC transformer turns-ratio estimate, with no winding losses, saturation, load regulation or current limit. It is not a wiring or equipment-rating recommendation.',['electrical-power-calculator']),
 definition('molarity-calculator','Molarity Calculator',[numeric('moles','Amount of solute (mol)',.5,0),numeric('litres','Final solution volume (L)',2,0,true)],'c = n/V, using solute amount n in mol and final solution volume V in L.','Molarity (mol/L)',v=>v.moles/v.litres,'Use final solution volume, not the starting solvent volume. The calculation assumes the supplied amount and final volume are already known.',['mole-fraction-calculator']),
 definition('mole-fraction-calculator','Mole Fraction Calculator',[numeric('component','Component amount (mol)',1,0),numeric('other','All other components combined (mol)',3,0)],'xᵢ = nᵢ / (nᵢ + n_other); total amount must be greater than zero.','Component mole fraction (dimensionless)',v=>{const total=v.component+v.other;if(!total)throw Error('Total amount must be greater than zero.');return v.component/total;},'Enter one component and the sum of all remaining components in moles. Do not use masses unless you first convert each material using its own molar mass.',['molarity-calculator']),
];

export function calculateScience(def,input) {
 const parsed={...input};
 for(const field of def.fields) {
  if(field.type==='number') {
   parsed[field.key]=number(input[field.key],field.label,field.min,field.max);
   if(field.strict&&parsed[field.key]===0)throw Error(`${field.label} must be greater than zero.`);
  } else if(field.type==='select'&&!field.options.includes(input[field.key]))throw Error(`${field.label}: choose a supported option.`);
 }
 const result=def.run(parsed);
 const clean=value=>{if(!Number.isFinite(value))throw Error('Result is outside the supported numeric range. Use smaller values.');return round(value);};
 return typeof result==='number'?clean(result):Object.fromEntries(Object.entries(result).map(([key,value])=>[key,clean(value)]));
}
export function extendScienceCalculators({register}) {
 for(const def of scienceCalculators)register('math',def.name,def.fields,def.formula,input=>calculateScience(def,input),{
  id:def.id,retainInputs:true,description:`${def.name.replace(' Calculator','')}: ${def.output.toLowerCase()}. Calculate locally with explicit inputs and assumptions.`,
  explanation:def.explanation,outputDescription:def.output,relatedToolIds:def.related,
  faqs:[{q:'What units should I enter?',a:def.fields.map(f=>f.label).join('; ')+'. '+def.output+'.'},{q:'What assumptions apply?',a:def.explanation}],
 });
}
