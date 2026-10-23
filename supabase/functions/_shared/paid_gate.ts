export function paidAllowed(feature: string): boolean {
 if(Deno.env.get("PAID_API_KILL")==="1")return false;
 return (Deno.env.get("PAID_API_ALLOW")||"").split(",").map(s=>s.trim()).includes(feature);
}
export const PAID_DENIED="PAID_PROVIDER_NOT_AUTHORIZED";
