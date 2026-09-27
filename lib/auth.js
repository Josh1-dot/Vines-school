import {randomBytes,scryptSync,timingSafeEqual,createHash} from 'node:crypto';
import {all,insert,remove} from './store.js';
export function passwordHash(password){const salt=randomBytes(16).toString('hex');return `${salt}:${scryptSync(password,salt,64).toString('hex')}`;}
export function passwordMatches(password,stored){const [salt,hash]=stored.split(':');const expected=Buffer.from(hash,'hex');const actual=scryptSync(password,salt,64);return actual.length===expected.length&&timingSafeEqual(actual,expected);}
const digest=token=>createHash('sha256').update(token).digest('hex');
export function publicUser(u){return {id:u.id,name:u.name,email:u.email,role:u.role};}
export async function sessionUser(req){const token=(req.headers.cookie||'').split(';').map(c=>c.trim()).find(c=>c.startsWith('vines_session='))?.slice(14);if(!token)return null;const sessions=await all('sessions');const session=sessions.find(s=>s.token===digest(token)&&s.expires>Date.now());return session?(await all('users')).find(u=>u.id===session.userId):null;}
export async function createSession(res,user){const token=randomBytes(32).toString('hex');for(const s of await all('sessions'))if(s.expires<Date.now())await remove('sessions',s.id);await insert('sessions',{token:digest(token),userId:user.id,expires:Date.now()+8*60*60*1000});res.cookie('vines_session',token,{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',maxAge:8*60*60*1000,path:'/'});}
export async function logout(req,res){const token=(req.headers.cookie||'').split(';').map(c=>c.trim()).find(c=>c.startsWith('vines_session='))?.slice(14);if(token)for(const s of await all('sessions'))if(s.token===digest(token))await remove('sessions',s.id);res.clearCookie('vines_session',{path:'/'});}
