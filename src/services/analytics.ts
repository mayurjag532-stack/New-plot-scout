import { runtimeConfig } from "./config";
type EventName="app_opened"|"gps_captured"|"property_completed"|"decision_viewed"|"report_offer_viewed"|"payment_started"|"payment_succeeded"|"second_property_used";
function anonymousId(){const k="plot-scout:anon-id:v1";let v=localStorage.getItem(k);if(!v){v=crypto.randomUUID();localStorage.setItem(k,v)}return v}
export function track(event:EventName,properties:Record<string,string|number|boolean|null>={}){if(!runtimeConfig.posthogKey)return;const safe={...properties,app_env:runtimeConfig.appEnv};fetch(`${runtimeConfig.posthogHost}/capture/`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({api_key:runtimeConfig.posthogKey,event,properties:{distinct_id:anonymousId(),...safe}}),keepalive:true}).catch(()=>{});}
// Privacy rule: never send coordinates, owner/broker/contact, notes, survey/gat numbers, prices or photo/document contents.
