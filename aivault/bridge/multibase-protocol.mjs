// Pure protocol validation and route planning only. No network, DB, shell or git.
import {createHash,createHmac,timingSafeEqual} from 'node:crypto';

const fail=error=>({ok:false,error});
export function verifyWebhook(raw,signature,secret) {
  if(!Buffer.isBuffer(raw) || raw.length>262144 || typeof signature!=='string' ||
    !/^sha256=[0-9a-f]{64}$/.test(signature) || typeof secret!=='string' || secret.length<32) return false;
  const expected=createHmac('sha256',secret).update(raw).digest();
  return timingSafeEqual(expected,Buffer.from(signature.slice(7),'hex'));
}

export function inspectInbound({registry,localBase,source,envelope,now=Date.now(),seen}) {
  const own=registry.bases.find(b=>b.base_id===localBase && b.status==='registered');
  if(!own) return fail('LOCAL_BASE_UNKNOWN');
  // Source metadata must be obtained from authenticated GitHub API reads after
  // webhook verification, or through an authenticated inbox poll. Never body data.
  if(String(source?.repository_id)!==own.repository_id || source?.issue_number!==own.inbox_issue) return fail('NOT_LOCAL_INBOX');
  const comment=source?.comment;
  if(!comment || !/^[1-9][0-9]{0,19}$/.test(String(comment.id))) return fail('INVALID_COMMENT_METADATA');
  const peers=registry.bases.filter(b=>b.status==='registered' && b.base_id!==localBase && b.github_user_id===String(comment.user?.id));
  if(String(comment.user?.id)===own.github_user_id) return fail('OWN_MESSAGE');
  if(peers.length!==1) return fail('SENDER_UNKNOWN_OR_AMBIGUOUS');
  const peer=peers[0];
  if(!envelope || typeof envelope!=='object' || Array.isArray(envelope)) return fail('LEGACY_OR_MALFORMED_REVIEW_ONLY');
  const required=['message_id','from_base','to_base','reply_to','sent_at','kind','body'];
  const optional=['task_id','in_reply_to'];
  if(required.some(k=>!Object.hasOwn(envelope,k)) || Object.keys(envelope).some(k=>![...required,...optional].includes(k))) return fail('INVALID_ENVELOPE');
  if(envelope.from_base!==peer.base_id || envelope.to_base!==localBase) return fail('IDENTITY_OR_RECIPIENT_MISMATCH');
  if(envelope.reply_to!==peer.inbox_url) return fail('UNREGISTERED_REPLY_ROUTE');
  if(typeof envelope.message_id!=='string' || !/^[A-Za-z0-9:_-]{8,160}$/.test(envelope.message_id) ||
    !['message','receipt','command'].includes(envelope.kind) || typeof envelope.body!=='string' ||
    Buffer.byteLength(JSON.stringify(envelope),'utf8')>16384 ||
    ['task_id','in_reply_to'].some(k=>Object.hasOwn(envelope,k) && (typeof envelope[k]!=='string' || envelope[k].length>200))) return fail('INVALID_ENVELOPE');
  if(typeof envelope.sent_at!=='string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$/.test(envelope.sent_at) ||
    !Number.isFinite(Date.parse(envelope.sent_at)) || Date.parse(envelope.sent_at)>now+30000) return fail('INVALID_TIMESTAMP');
  const sourceKey=`github:${own.repository_id}:comment:${comment.id}`;
  const messageKey=`message:${peer.base_id}:${envelope.message_id}`;
  const fingerprint=createHash('sha256').update(JSON.stringify(envelope)).digest('hex');
  if(!(seen instanceof Map)) return fail('RECEIPT_STORE_REQUIRED');
  for(const key of [sourceKey,messageKey]) {
    const prior=seen.get(key);
    if(prior) return fail(prior.fingerprint===fingerprint?'DUPLICATE_OR_REPLAY':'EDIT_OR_ID_COLLISION_REVIEW');
  }
  return {ok:true,sourceKey,messageKey,fingerprint,fromBase:peer.base_id,toBase:localBase,
    reply:{repository:peer.repository,issue_number:peer.inbox_issue,inbox_url:peer.inbox_url,
      from_base:localBase,to_base:peer.base_id,reply_to:own.inbox_url,in_reply_to:envelope.message_id},
    handling:envelope.kind==='command'?'COMMAND_REVIEW_REQUIRED':'CORRESPONDENCE_ONLY',
    taskSubmissionEnabled:false};
}

// Test fixture utility only: production receipts require a transactional durable
// store. This Map is deliberately not presented as a deployed replay defense.
export function rememberIsolatedReceipt(seen,plan) {
  if(!plan.ok) throw Error('Cannot record a rejected plan');
  for(const key of [plan.sourceKey,plan.messageKey]) seen.set(key,{fingerprint:plan.fingerprint});
}
