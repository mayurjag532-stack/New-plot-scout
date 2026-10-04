import { createRazorpayOrder, verifyRazorpayPayment } from './backend';
import { runtimeConfig } from './config';
declare global{interface Window{Razorpay?:new(opts:any)=>{open():void}}}
let loading:Promise<void>|null=null;
function loadCheckout(){if(window.Razorpay)return Promise.resolve();if(loading)return loading;loading=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://checkout.razorpay.com/v1/checkout.js';s.async=true;s.onload=()=>resolve();s.onerror=()=>reject(new Error('Payment checkout could not load.'));document.head.appendChild(s)});return loading;}
export async function purchase(sku:'REPORT_399'|'INVESTOR_1499',email?:string){
  const order=await createRazorpayOrder(sku);await loadCheckout();
  return new Promise<{product_code:string;ends_at:string|null}>((resolve,reject)=>{if(!window.Razorpay)return reject(new Error('Payment checkout unavailable.'));const rz=new window.Razorpay({key:order.key_id,amount:order.amount,currency:order.currency,name:'Plot Scout',description:sku==='REPORT_399'?'Before-Token Decision Report':'Investor Pass',order_id:order.order_id,prefill:{email:email||''},theme:{color:'#C9A96E'},handler:async(resp:any)=>{try{resolve(await verifyRazorpayPayment(resp))}catch(e){reject(e)}},modal:{ondismiss:()=>reject(new Error('Payment cancelled.'))}});rz.open();});
}
export const paymentsConfigured=Boolean(runtimeConfig.supabaseUrl&&runtimeConfig.supabaseAnonKey);
