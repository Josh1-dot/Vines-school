import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
let client, db, state={}, queue=Promise.resolve();
const file=path.resolve(process.env.DATA_FILE || 'data/school.json');
export async function initStore(){
  if(process.env.MONGODB_URI){
    const {MongoClient}=await import('mongodb');
    client=new MongoClient(process.env.MONGODB_URI,{serverSelectionTimeoutMS:8000});
    await client.connect(); db=client.db(process.env.MONGODB_DB || 'vines_school');
    await db.collection('users').createIndex({email:1},{unique:true});
    await db.collection('payroll').createIndex({employeeId:1,month:1},{unique:true});
  }else{
    if(process.env.NODE_ENV==='production') throw new Error('Production requires MONGODB_URI.');
    await fs.mkdir(path.dirname(file),{recursive:true,mode:0o700});
    try{state=JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  }
}
async function persist(){const snapshot=JSON.stringify(state,null,2);queue=queue.then(async()=>{await fs.writeFile(file+'.tmp',snapshot,{mode:0o600});await fs.rename(file+'.tmp',file);});await queue;}
export async function all(name){return db?db.collection(name).find({},{projection:{_id:0}}).toArray():structuredClone(state[name]||[]);}
export async function insert(name,data){const row={...data,id:randomUUID(),createdAt:new Date().toISOString()};if(db)await db.collection(name).insertOne({...row});else{(state[name]??=[]).push(row);await persist();}return row;}
export async function update(name,id,patch){if(db){await db.collection(name).updateOne({id},{$set:patch});}else{const row=(state[name]||[]).find(r=>r.id===id);if(!row)return;Object.assign(row,patch);await persist();}}
export async function remove(name,id){if(db)await db.collection(name).deleteOne({id});else{state[name]=(state[name]||[]).filter(r=>r.id!==id);await persist();}}
export async function closeStore(){await queue;if(client)await client.close();}
export function storageMode(){return db?'mongodb':'local';}

// Media bytes are private: GridFS in MongoDB, files outside public/ in local tests.
const mediaDirectory=path.join(path.dirname(file),'media');
export async function saveMediaBytes(id,bytes,filename){
 if(db){
  const {GridFSBucket}=await import('mongodb');
  const stream=new GridFSBucket(db,{bucketName:'schoolMedia'}).openUploadStreamWithId(id,filename);
  await new Promise((resolve,reject)=>{stream.on('finish',resolve);stream.on('error',reject);stream.end(bytes);});
 }else{await fs.mkdir(mediaDirectory,{recursive:true,mode:0o700});await fs.writeFile(path.join(mediaDirectory,id),bytes,{mode:0o600,flag:'wx'});}
}
export async function mediaStream(id,start,end){
 if(db){const {GridFSBucket}=await import('mongodb');return new GridFSBucket(db,{bucketName:'schoolMedia'}).openDownloadStream(id,{start,end:end+1});}
 const {createReadStream}=await import('node:fs');return createReadStream(path.join(mediaDirectory,id),{start,end});
}
export async function deleteMediaBytes(id){
 if(db){const {GridFSBucket}=await import('mongodb');await new GridFSBucket(db,{bucketName:'schoolMedia'}).delete(id);}
 else await fs.unlink(path.join(mediaDirectory,id));
}

// Optimistic locking protects payroll updates against concurrent submissions.
export async function compareUpdate(name,id,revision,patch){
 if(db){const result=await db.collection(name).updateOne({id,revision},{$set:{...patch,revision:revision+1}});return result.modifiedCount===1;}
 const row=(state[name]||[]).find(r=>r.id===id&&r.revision===revision);if(!row)return false;Object.assign(row,patch,{revision:revision+1});await persist();return true;
}
