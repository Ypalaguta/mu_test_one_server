import { randomBytes } from 'node:crypto';
import { loadServerNotice } from './server-notice.js';
import { isValidCharacterName } from '../characters/names.js';
import type { Repository, CharacterRecord } from '../../shared/contracts.js';
import type { AccountRecord } from './types.js';
import { hashPassword, verifyPassword, tokenHash } from './password.js';
import { ApiError, found } from '../../http/errors.js';
import { snapshot } from '../progression/service.js';
export function credentials(raw:unknown) {
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new ApiError(400,'INVALID_LOGIN','Expected credentials');
 const b=raw as Record<string,unknown>;
 if(Object.keys(b).some(k=>!['login','password','characterName','classId'].includes(k)))throw new ApiError(400,'INVALID_LOGIN','Unknown field');
 if(typeof b.login!=='string'||typeof b.password!=='string')throw new ApiError(400,'INVALID_LOGIN','Login/password required');
 const login=b.login.trim().toLowerCase();
 if(!/^[a-z0-9_\-.]{3,64}$/.test(login)||b.password.length<8||b.password.length>128)throw new ApiError(400,'INVALID_LOGIN','Login: 3..64 ASCII characters; password: 8..128 characters');
 return {login,password:b.password,body:b};
}
export function isBanned(a:AccountRecord,now=new Date()) {
 return !!a.ban?.startedAt && a.ban.startedAt<=now && !a.ban.revokedAt && (!a.ban.expiresAt||a.ban.expiresAt>now);
}
export function validateRoster(rows:CharacterRecord[],limit=7) {
 if(rows.length>Math.min(limit,7)||rows.filter(c=>c.isActive).length>5||rows.filter(c=>c.isMain).length!==(rows.length?1:0)||rows.some(c=>c.isMain&&!c.isActive))
  throw new ApiError(409,'INVALID_ROSTER','At most 7 characters, 5 active, and exactly one active main character are required');
}
export function safeAccount(a:AccountRecord) {return {id:a.id,login:a.login,role:a.role,characterLimit:a.characterLimit};}
export async function login(repo:Repository,raw:unknown) {
 const c=credentials(raw);
 if(!repo.accountByLogin||!repo.accountCharacters||!repo.createSession)throw new ApiError(503,'UNAVAILABLE','Account repository unavailable');
 const a=await repo.accountByLogin(c.login);
 // Same KDF work for unknown logins; no plaintext or hash is logged/returned.
 const hash=a?.passwordHash??'scrypt$00000000000000000000000000000000$'+'0'.repeat(128);
 const valid=await verifyPassword(c.password,hash);
 if(!a||!valid)throw new ApiError(401,'INVALID_CREDENTIALS','Invalid login or password');
 if(a.status && a.status!=='active')throw new ApiError(409,'ACCOUNT_NOT_READY','Account is being created');
 if(isBanned(a))throw new ApiError(403,'ACCOUNT_BANNED','Account is banned');
 const chars=await repo.accountCharacters(a.id);validateRoster(chars,a.characterLimit);
 const characters=await Promise.all(chars.map(c=>snapshot(repo,c.id)));
 const sessionToken=randomBytes(32).toString('hex');
 const sessionExpiresAt=new Date(Date.now()+12*60*60*1000);
 await repo.createSession({tokenHash:tokenHash(sessionToken),accountId:a.id,expiresAt:sessionExpiresAt});
 return {account:safeAccount(a),characters,sessionToken,sessionExpiresAt:sessionExpiresAt.toISOString(),serverNotice:await loadServerNotice()};
}
export async function authenticate(repo:Repository,token:unknown) {
 if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token)||!repo.sessionByHash||!repo.account)throw new ApiError(401,'SESSION_REQUIRED','Account session required');
 const session=await repo.sessionByHash(tokenHash(token));
 if(!session||session.expiresAt<=new Date())throw new ApiError(401,'SESSION_EXPIRED','Log in again');
 const a=await repo.account(session.accountId);
 if(!a)throw new ApiError(401,'SESSION_EXPIRED','Log in again');
 if(a.status && a.status!=='active')throw new ApiError(409,'ACCOUNT_NOT_READY','Account is being created');
 if(isBanned(a))throw new ApiError(403,'ACCOUNT_BANNED','Account is banned');
 return a;
}
export async function ownCharacter(repo:Repository,token:unknown,id:number) {
 const a=await authenticate(repo,token);const c=found(await repo.character(id));
 if(c.accountId!==a.id)throw new ApiError(403,'CHARACTER_NOT_OWNED','Character belongs to another account');
 return {account:a,character:c};
}
export async function register(repo:Repository,raw:unknown) {
 const c=credentials(raw);
 if(!repo.createAccountWithCharacter)throw new ApiError(503,'UNAVAILABLE','Registration unavailable');
 const name=c.body.characterName??c.login;
 const classId=c.body.classId??1;
 if(!isValidCharacterName(name)||typeof classId!=='number'||!Number.isInteger(classId)||classId<1)throw new ApiError(400,'INVALID_CHARACTER','Character name must be 1..64 characters without whitespace; a valid class is required');
 found(await repo.characterClass(classId));
 try {const a=await repo.createAccountWithCharacter(c.login,await hashPassword(c.password),name.trim(),classId);return {account:safeAccount(a)};}
 catch(e){if((e as {code?:number}).code===11000)throw new ApiError(409,'LOGIN_EXISTS','Login already exists');throw e;}
}
