import 'dotenv/config';
import nodemailer from 'nodemailer';
import {initStore,all,update,closeStore} from '../lib/store.js';
if(process.env.EMAIL_DELIVERY!=='true')throw Error('Email delivery is disabled. Configure SMTP and explicitly enable EMAIL_DELIVERY first.');
for(const name of ['SMTP_HOST','SMTP_USER','SMTP_PASS','EMAIL_FROM'])if(!process.env[name])throw Error(`Missing ${name}`);
await initStore();
const transport=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:process.env.SMTP_PORT==='465',auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}});
try{for(const row of await all('outbox')){if(row.status!=='queued')continue;try{await transport.sendMail({from:process.env.EMAIL_FROM,to:row.to,subject:row.subject,text:row.text});await update('outbox',row.id,{status:'sent',sentAt:new Date().toISOString()});}catch{await update('outbox',row.id,{lastError:'Delivery failed; verify SMTP configuration.'});console.error('Delivery failed. Message remains queued.');}}}finally{await closeStore();}
