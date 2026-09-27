import {isStaff as staff,isSchoolAdmin,canTeach as teaches} from './roles.js';
import express from 'express';
import {randomUUID} from 'node:crypto';
import {all,insert,remove,saveMediaBytes,mediaStream,deleteMediaBytes} from './store.js';
import {sessionUser} from './auth.js';
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const router=express.Router();
function detect(b){
 if(b.length<12)return null;
 if(b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return ['image/png','png'];
 if(b[0]===255&&b[1]===216&&b[2]===255)return ['image/jpeg','jpg'];
 if(b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP')return ['image/webp','webp'];
 if(b.toString('ascii',4,8)==='ftyp'&&['isom','iso2','mp41','mp42','avc1','M4V '].includes(b.toString('ascii',8,12)))return ['video/mp4','mp4'];
 if(b.subarray(0,4).equals(Buffer.from([26,69,223,163]))&&b.subarray(0,256).includes(Buffer.from('webm')))return ['video/webm','webm'];
 return null;
}
async function linked(id){return (await all('resources')).some(r=>r.mediaId===id)||(await all('portfolio')).some(r=>r.mediaId===id);}
export async function attachment(user,body,target){
 if(!body.mediaId)return {};
 const media=(await all('media')).find(m=>m.id===body.mediaId);
 if(!media||media.ownerId!==user.id||media.studentId!==(target.studentId||'')||media.className!==(target.className||''))throw fail('Upload a file for this student or class.');
 return {mediaId:media.id,mediaType:media.type};
}
router.get('/:id',wrap(async(req,res)=>{
 const media=(await all('media')).find(m=>m.id===req.params.id);if(!media)throw fail('Media not found.',404);
 const portfolio=(await all('portfolio')).filter(p=>p.mediaId===media.id);
 const publicMedia=portfolio.some(p=>p.published&&p.consent);
 let allowed=publicMedia;
 if(!allowed){const user=await sessionUser(req);if(user){
  allowed=isSchoolAdmin(user)||media.ownerId===user.id;
  if(!allowed){const students=(await all('students')).filter(s=>staff(user)?teaches(user,s):s.parentId===user.id);
   allowed=portfolio.some(p=>students.some(s=>s.id===p.studentId))||(await all('resources')).some(r=>r.mediaId===media.id&&(r.className==='*'||students.some(s=>s.className===r.className)));
  }
 }}
 if(!allowed)throw fail('Media not found.',404);
 let start=0,end=media.size-1;
 const range=req.get('Range');
 if(range){const match=/^bytes=(\d*)-(\d*)$/.exec(range);if(!match||(!match[1]&&!match[2]))return res.status(416).set('Content-Range',`bytes */${media.size}`).end();
  if(!match[1]){const suffix=Number(match[2]);if(suffix<=0)return res.status(416).set('Content-Range',`bytes */${media.size}`).end();start=Math.max(0,media.size-suffix);}else{start=Number(match[1]);if(match[2])end=Math.min(end,Number(match[2]));}
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=media.size)return res.status(416).set('Content-Range',`bytes */${media.size}`).end();
  res.status(206).set('Content-Range',`bytes ${start}-${end}/${media.size}`);
 }
 res.set({'Content-Type':media.type,'Content-Length':String(end-start+1),'Accept-Ranges':'bytes','Content-Disposition':`inline; filename="school-media.${media.extension}"`,'Cache-Control':'private, no-store'});
 if(req.method==='HEAD')return res.end();
 const stream=await mediaStream(media.storageId,start,end);stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
}));
router.use(wrap(async(req,res,next)=>{req.user=await sessionUser(req);if(!staff(req.user))throw fail('Staff access required.',403);next();}));
router.post('/',express.raw({type:'application/octet-stream',limit:'50mb'}),wrap(async(req,res)=>{
 const bytes=req.body;if(!Buffer.isBuffer(bytes)||!bytes.length)throw fail('Choose a photo or video.');
 const format=detect(bytes);if(!format)throw fail('Supported files: JPG, PNG, WebP, MP4 and WebM.');
 if(format[0].startsWith('image/')&&bytes.length>10*1024*1024)throw fail('Photos must be 10 MB or smaller.',413);
 const studentId=typeof req.query.studentId==='string'?req.query.studentId:'',className=typeof req.query.className==='string'?req.query.className:'';
 const students=await all('students');
 if(studentId){if(className||!students.some(s=>s.id===studentId&&teaches(req.user,s)))throw fail('Choose one of your students.',403);}
 else if(!(isSchoolAdmin(req.user)&&className==='*')&&(!className||!students.some(s=>s.className===className&&teaches(req.user,s))))throw fail('Choose one of your classes.',403);
 const storageId=randomUUID();
 await saveMediaBytes(storageId,bytes,`school-media.${format[1]}`);
 let media;
 try{media=await insert('media',{storageId,type:format[0],extension:format[1],size:bytes.length,ownerId:req.user.id,studentId,className});}
 catch(error){await deleteMediaBytes(storageId);throw error;}
 res.status(201).json({id:media.id,type:media.type,size:media.size});
}));
router.post('/:id/discard',wrap(async(req,res)=>{
 const media=(await all('media')).find(m=>m.id===req.params.id&&m.ownerId===req.user.id);
 if(!media)throw fail('Media not found.',404);if(await linked(media.id))throw fail('This file is already published in a record.',409);
 await deleteMediaBytes(media.storageId);await remove('media',media.id);res.json({ok:true});
}));
router.use((err,req,res,next)=>{if(err.type==='entity.too.large')return res.status(413).json({error:'Videos must be 50 MB or smaller; photos 10 MB or smaller.'});next(err);});
export default router;
