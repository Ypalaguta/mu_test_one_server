import type { Repository } from '../../shared/contracts.js';
import { authenticate } from './service.js';
import { ApiError, found } from '../../http/errors.js';
import { saveSnapshot } from '../progression/service.js';
export async function addItem(repo:Repository,token:unknown,id:number,raw:unknown) {
 const caller=await authenticate(repo,token);
 if(caller.role!=='admin'&&caller.role!=='gm')throw new ApiError(403,'ADMIN_REQUIRED','Administrator permission required');
 const target=found(await repo.character(id));
 const owner=repo.account?found(await repo.account(target.accountId)):null;
 if(!owner||(caller.role==='gm'&&caller.id!==owner.id&&owner.role!=='player'))throw new ApiError(403,'TARGET_PROTECTED','This account is protected');
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new ApiError(400,'INVALID_ITEM','Expected item request');
 const b=raw as Record<string,unknown>;
 if(Object.keys(b).some(k=>!['itemId','quantity','expectedRevision'].includes(k)) ||
  typeof b.itemId!=='number'||!Number.isInteger(b.itemId)||b.itemId<1||
  typeof b.quantity!=='number'||!Number.isInteger(b.quantity)||b.quantity<1||b.quantity>1000000||b.expectedRevision!==target.revision)
  throw new ApiError(400,'INVALID_ITEM','Invalid item, quantity, or character revision');
 const def=found(await repo.item(b.itemId));
 const next=structuredClone(target);let left=b.quantity;
 for(const s of next.progress.inventory)if(s.itemId===b.itemId){const n=Math.min(left,Math.max(0,def.maxStack-s.quantity));s.quantity+=n;left-=n;}
 for(let slot=0;slot<next.progress.inventoryCapacity&&left>0;slot++)if(!next.progress.inventory.some(s=>s.slot===slot)){
  const quantity=Math.min(left,def.maxStack);next.progress.inventory.push({slot,itemId:b.itemId,quantity});left-=quantity;
 }
 if(left)throw new ApiError(409,'INVENTORY_FULL','Not enough space; no items added');
 const saved=await saveSnapshot(repo,id,{expectedRevision:target.revision,info:next.info,progress:{...next.progress,equipment:next.progress.equipment??[]},actionBarSlots:next.actionBarSlots});
 console.info('[ADMIN_ITEM]',{accountId:caller.id,characterId:id,itemId:b.itemId,quantity:b.quantity});return saved;
}
