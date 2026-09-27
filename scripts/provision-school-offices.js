import 'dotenv/config';
import {initStore,all,insert,update,closeStore} from '../lib/store.js';
import {passwordHash} from '../lib/auth.js';
import {randomBytes} from 'node:crypto';
import fs from 'node:fs/promises';
// Explicit provisioning for the two school offices requested by the owner.
await initStore();
try{
 await fs.mkdir('data',{recursive:true,mode:0o700});
 for(const spec of [
  {email:'blessedvinesschoolteachers@gmail.com',name:'Blessed Vines Teachers',role:'admin',file:'data/teachers-access.txt',page:'/staff-portal'},
  {email:'headteacher@gmail.com',name:'Headteacher',role:'superadmin',file:'data/headteacher-access.txt',page:'/director-portal'}
 ]){
  const existing=(await all('users')).find(u=>u.email.toLowerCase()===spec.email);
  if(existing){if(existing.role!==spec.role){if(spec.role!=='superadmin')throw Error('Existing staff account has a different role; left unchanged.');await update('users',existing.id,{role:spec.role});}console.log(JSON.stringify({email:spec.email,role:spec.role,created:false,passwordUnchanged:true}));continue;}
  const password=randomBytes(20).toString('base64url');
  await fs.writeFile(spec.file,`Private school account\nPage: http://localhost:3000${spec.page}\nEmail: ${spec.email}\nTemporary password: ${password}\nChange the password in Settings after signing in.\nDo not share headteacher credentials with teaching staff.\n`,{flag:'wx',mode:0o600});
  await insert('users',{email:spec.email,name:spec.name,role:spec.role,passwordHash:passwordHash(password)});
  console.log(JSON.stringify({email:spec.email,role:spec.role,created:true,credentialsFile:spec.file}));
 }
}finally{await closeStore();}
