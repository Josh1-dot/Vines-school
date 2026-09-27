import 'dotenv/config';
import {initStore,all,insert,closeStore} from '../lib/store.js';
import {passwordHash} from '../lib/auth.js';
import {randomBytes} from 'node:crypto';
const [email,name,role='teacher']=process.argv.slice(2);
if(!email||!name||!['admin','teacher','parent','superadmin'].includes(role)){console.error('Usage: npm run create-user -- email "Full name" teacher|parent|admin|superadmin');process.exit(1);}
await initStore();
try{if((await all('users')).some(u=>u.email===email.toLowerCase()))throw Error('Account already exists.');const password=randomBytes(16).toString('base64url');await insert('users',{email:email.toLowerCase(),name,role,passwordHash:passwordHash(password)});console.log(`Account created. Temporary password (store securely): ${password}`);}finally{await closeStore();}
