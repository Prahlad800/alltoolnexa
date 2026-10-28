'use client';
import {useEffect,useState} from 'react';
import {apiRequest} from '../lib/api-client.mjs';
export default function BillingPanel(){
 const [data,setData]=useState(null),[error,setError]=useState('');
 useEffect(()=>{let active=true;apiRequest('/api/admin/billing').then(d=>{if(active)setData(d);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
 if(error)return <p role="alert">{error}</p>;
 if(!data)return <p>Loading billing…</p>;
 return <section className="table-panel"><h2>Plans & payments</h2><p className="panel-note">Checkout: {data.checkoutEnabled?'Configured':'Not configured — add Razorpay keys to backend environment'}. One calendar month per payment; manual renewal. App sync, processing priority and file recovery are planned.</p><div className="table-scroll"><table><thead><tr><th>Plan</th><th>Monthly price</th><th>Storage</th><th>Maximum file</th></tr></thead><tbody>{data.plans.map(p=><tr key={p.id}><td>{p.name}</td><td>₹{p.price}</td><td>{p.storage}</td><td>{p.file}</td></tr>)}</tbody></table></div><h2>Latest 100 orders</h2><div className="table-scroll"><table><thead><tr><th>Order</th><th>Plan</th><th>Amount</th><th>Status</th><th>Access until</th></tr></thead><tbody>{data.orders.map(o=><tr key={o.id}><td>{o.id}</td><td>{o.plan}</td><td>₹{o.amount/100}</td><td>{o.status}</td><td>{o.paidUntil?new Date(o.paidUntil).toLocaleString():'—'}</td></tr>)}</tbody></table>{!data.orders.length&&<p className="empty">No payments yet.</p>}</div></section>;
}
