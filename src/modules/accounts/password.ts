import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
const derive=(password:string,salt:string)=>new Promise<Buffer>((resolve,reject)=>{
 scrypt(password,salt,64,{N:16384,r:8,p:1,maxmem:64*1024*1024},(err,key)=>err?reject(err):resolve(key));
});
export async function hashPassword(password:string) {
 const salt=randomBytes(16).toString('hex');return `scrypt$${salt}$${(await derive(password,salt)).toString('hex')}`;
}
export async function verifyPassword(password:string,hash:string) {
 const [kind,salt,key]=hash.split('$');
 if(kind!=='scrypt'||!salt||!key||!/^[a-f0-9]{128}$/.test(key))return false;
 return timingSafeEqual(await derive(password,salt),Buffer.from(key,'hex'));
}
export const tokenHash=(token:string)=>createHash('sha256').update(token).digest('hex');
