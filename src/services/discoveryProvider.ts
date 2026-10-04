export interface DiscoveryScope { mode:"near_me"|"selected"; lat?:number; lon?:number; state:string; district:string; taluka:string; locality:string; radiusKm:number; }
export interface RawCandidate { providerId:string; externalId?:string; sourceUrl:string; capturedAt:number; rawTitle?:string; rawText?:string; rawPayload?:unknown; }
export interface DiscoveryProvider { readonly id:string; search(scope:DiscoveryScope):Promise<RawCandidate[]>; }
