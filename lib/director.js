import {documentTypes,documentTypeLabel} from '../public/js/document-types.js';
import express from 'express';
import {randomUUID} from 'node:crypto';
import {all,insert,update,remove,compareUpdate,saveMediaBytes,mediaStream,deleteMediaBytes} from './store.js';
import {sessionUser} from './auth.js';
import {isDirector} from './roles.js';
const router=express.Router();
const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const text=(value,max=1000)=>typeof value==='string'?value.trim().slice(0,max):'';
const required=(value,label,max=1000)=>{const v=text(value,max);if(!v)throw fail(`${label} is required.`);return v;};
const today=()=>new Date().toISOString().slice(0,10);
const thisMonth=()=>today().slice(0,7);
function month(v){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(v||'')||v<'2000-01'||v>'2100-12')throw fail('Invalid month.');return v;}
function date(v){if(!/^\d{4}-\d{2}-\d{2}$/.test(v||'')||Number.isNaN(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)throw fail('Invalid date.');return v;}
export function money(value,currency){
 const decimals=currency==='UGX'?0:2;
 const input=String(value??'');
 if(!(decimals?/^\d{1,12}(\.\d{1,2})?$/:/^\d{1,12}$/).test(input))throw fail(currency==='UGX'?'UGX amounts must be non-negative whole numbers.':'Invalid amount (maximum 2 decimal places).');
 const parts=input.split('.');const amount=Number(parts[0])*(10**decimals)+(decimals?Number((parts[1]||'').padEnd(2,'0')):0);
 if(!Number.isSafeInteger(amount)||amount>1e12)throw fail('Amount is too large.');return amount;
}
export function summarize(row){const paidMinor=row.payments.filter(p=>!p.voidedAt).reduce((sum,p)=>sum+p.amountMinor,0);const balanceMinor=row.dueMinor-paidMinor;return {...row,paidMinor,balanceMinor,status:balanceMinor===0?'Paid':paidMinor>0?'Partial':'Unpaid'};}
function salaryAt(employee,period){return employee.salaryHistory.filter(s=>s.from<=period).sort((a,b)=>b.from.localeCompare(a.from))[0]?.amountMinor||0;}
function projection(employee,period){return {id:null,employeeId:employee.id,month:period,currency:employee.currency,dueMinor:salaryAt(employee,period),payments:[],reviewed:false,reason:'',revision:0};}
function eligible(employee,period){return period>=employee.startMonth&&(!employee.endMonth||period<=employee.endMonth);}
async function employeeById(id,active=false){const employee=(await all('employees')).find(e=>e.id===id);if(!employee)throw fail('Teacher not found.',404);if(active&&employee.deletedAt)throw fail('This record is archived.');return employee;}
router.use(wrap(async(req,res,next)=>{req.user=await sessionUser(req);if(!req.user)throw fail('Please sign in.',401);if(!isDirector(req.user))throw fail('Headteacher access required.',403);next();}));
router.get('/overview',wrap(async(req,res)=>{
 const year=Number(req.query.year||thisMonth().slice(0,4));if(!Number.isInteger(year)||year<2000||year>2100)throw fail('Invalid year.');
 const employees=await all('employees'),stored=await all('payroll'),rows=[];
 for(const employee of employees)for(let m=1;m<=12;m++){const period=`${year}-${String(m).padStart(2,'0')}`;if(period>thisMonth()||!eligible(employee,period))continue;rows.push({...summarize(stored.find(p=>p.employeeId===employee.id&&p.month===period)||projection(employee,period)),employeeName:employee.fullName,archived:!!employee.deletedAt});}
 // Arrears include all earlier months, not just the selected year.
 const arrears=[];
 for(const employee of employees){let period=employee.startMonth;let guard=0;while(period<=thisMonth()&&guard++<1212){if(eligible(employee,period)){const row=summarize(stored.find(p=>p.employeeId===employee.id&&p.month===period)||projection(employee,period));if(row.balanceMinor>0)arrears.push({employeeId:employee.id,employeeName:employee.fullName,month:period,currency:row.currency,balanceMinor:row.balanceMinor});}const [y,m]=period.split('-').map(Number);period=`${m===12?y+1:y}-${String(m===12?1:m+1).padStart(2,'0')}`;}}
 const documents=(await all('employeeDocuments')).map(({storageId,...doc})=>({...doc,kind:documentTypeLabel(doc.kind)}));
 res.json({employees,rows,arrears,documents,year,currentMonth:thisMonth()});
}));
router.post('/employees',wrap(async(req,res)=>{
 const fullName=required(req.body.fullName,'Full name',150),startMonth=month(req.body.startMonth),currency=req.body.currency||'UGX';
 if(!['UGX','KES','USD','EUR'].includes(currency))throw fail('Invalid currency.');
 if(startMonth>thisMonth())throw fail('The start month cannot be in the future.');
 const email=text(req.body.email,200).toLowerCase();if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw fail('Invalid email address.');
 const amountMinor=money(req.body.salary,currency);
 const employee=await insert('employees',{fullName,email,phone:text(req.body.phone,50),address:text(req.body.address,500),position:required(req.body.position,'Position',150),notes:text(req.body.notes,2000),startMonth,currency,salaryHistory:[{from:startMonth,amountMinor}],createdBy:req.user.id});res.status(201).json(employee);
}));
router.post('/employees/:id',wrap(async(req,res)=>{
 const employee=await employeeById(req.params.id,true),email=text(req.body.email,200).toLowerCase();if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw fail('Invalid email address.');
 await update('employees',employee.id,{fullName:required(req.body.fullName,'Full name',150),position:required(req.body.position,'Position',150),email,phone:text(req.body.phone,50),address:text(req.body.address,500),notes:text(req.body.notes,2000),updatedAt:new Date().toISOString()});res.json({ok:true});
}));
router.post('/employees/:id/salary',wrap(async(req,res)=>{
 const employee=await employeeById(req.params.id,true),from=month(req.body.from),amountMinor=money(req.body.salary,employee.currency);
 if(from<thisMonth()||from<employee.startMonth)throw fail('Salary changes must start this month or later.');
 if((await all('payroll')).some(p=>p.employeeId===employee.id&&p.month>=from))throw fail('Payroll records already exist for this period. Choose a later month.');
 const history=[...employee.salaryHistory.filter(s=>s.from!==from),{from,amountMinor}].sort((a,b)=>a.from.localeCompare(b.from));await update('employees',employee.id,{salaryHistory:history});res.json({ok:true});
}));
router.post('/employees/:id/delete',wrap(async(req,res)=>{
 const employee=await employeeById(req.params.id,true);if(req.body.confirm!==employee.fullName)throw fail('Enter the full name to confirm.');
 await update('employees',employee.id,{deletedAt:new Date().toISOString(),endMonth:thisMonth(),deletedBy:req.user.id});res.json({ok:true,archived:true});
}));
// One queue per employee/month, plus database compare-and-swap for multi-process safety.
const queues=new Map();
async function serial(key,fn){const previous=queues.get(key)||Promise.resolve();const current=previous.catch(()=>{}).then(fn);queues.set(key,current);try{return await current;}finally{if(queues.get(key)===current)queues.delete(key);}}
async function changeLedger(employeeId,period,fn){return serial(employeeId+period,async()=>{
 const employee=await employeeById(employeeId);if(!eligible(employee,period)||period>thisMonth())throw fail('This month is outside the employment period.');
 for(let attempt=0;attempt<5;attempt++){
  let row=(await all('payroll')).find(p=>p.employeeId===employeeId&&p.month===period);
  if(!row){const {id,...initial}=projection(employee,period);try{row=await insert('payroll',initial);}catch(e){if(e.code===11000)continue;throw e;}}
  const next=fn(structuredClone(row),employee);if(await compareUpdate('payroll',row.id,row.revision,{...next,updatedAt:new Date().toISOString()}))return summarize({...row,...next,revision:row.revision+1});
 }throw fail('Another update is in progress. Please try again.',409);
});}
router.post('/payroll/:employeeId/:month/payment',wrap(async(req,res)=>{
 const period=month(req.params.month),paymentDate=date(req.body.date),reason=required(req.body.reason,'Reason',500),reference=text(req.body.reference,150),key=required(req.body.requestId,'Submission reference',100);
 if(paymentDate>today())throw fail('A recorded payment cannot have a future date.');
 const row=await changeLedger(req.params.employeeId,period,(row,employee)=>{
  if(row.payments.some(p=>p.requestId===key))return row;
  const amountMinor=money(req.body.amount,employee.currency),balance=summarize(row).balanceMinor;
  if(amountMinor<=0||amountMinor>balance)throw fail('The payment must be positive and cannot exceed the outstanding balance.');
  row.payments.push({id:randomUUID(),requestId:key,amountMinor,date:paymentDate,reason,reference,recordedBy:req.user.id,recordedAt:new Date().toISOString()});row.reviewed=false;return row;
 });res.json(row);
}));
router.post('/payroll/:employeeId/:month/review',wrap(async(req,res)=>{
 if(typeof req.body.reviewed!=='boolean')throw fail('Invalid review status.');const row=await changeLedger(req.params.employeeId,month(req.params.month),row=>({...row,reviewed:req.body.reviewed,reason:text(req.body.reason,1000),reviewedBy:req.user.id,reviewedAt:new Date().toISOString()}));res.json(row);
}));
router.post('/payroll/:employeeId/:month/void',wrap(async(req,res)=>{
 const reason=required(req.body.reason,'Correction reason',500);const row=await changeLedger(req.params.employeeId,month(req.params.month),row=>{const payment=row.payments.find(p=>p.id===req.body.paymentId);if(!payment)throw fail('Payment not found.',404);if(payment.voidedAt)throw fail('This payment has already been voided.');payment.voidedAt=new Date().toISOString();payment.voidReason=reason;payment.voidedBy=req.user.id;row.reviewed=false;return row;});res.json(row);
}));
router.post('/employees/:id/documents',express.raw({type:'application/octet-stream',limit:'10mb'}),wrap(async(req,res)=>{
 const employee=await employeeById(req.params.id,true),bytes=req.body;
 if(!Buffer.isBuffer(bytes)||bytes.length<8)throw fail('Choose a document.');
 let type,ext;
 if(bytes.toString('ascii',0,5)==='%PDF-'){type='application/pdf';ext='pdf';}
 else if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255){type='image/jpeg';ext='jpg';}
 else if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))){type='image/png';ext='png';}
 else throw fail('Supported formats: PDF, JPG and PNG, up to 10 MB.');
 const title=required(req.query.title,'Title',150),kind=documentTypeLabel(req.query.kind);if(!documentTypes.includes(kind))throw fail('Invalid category.');
 const storageId=randomUUID();await saveMediaBytes(storageId,bytes,`staff-document.${ext}`);
 try{const doc=await insert('employeeDocuments',{employeeId:employee.id,storageId,type,ext,size:bytes.length,title,kind,uploadedBy:req.user.id});const {storageId:_,...safe}=doc;res.status(201).json(safe);}catch(e){await deleteMediaBytes(storageId);throw e;}
}));
router.get('/documents/:id',wrap(async(req,res)=>{
 const doc=(await all('employeeDocuments')).find(d=>d.id===req.params.id);if(!doc)throw fail('Document not found.',404);
 res.set({'Content-Type':doc.type,'Content-Length':String(doc.size),'Content-Disposition':`attachment; filename="staff-document.${doc.ext}"`,'Cache-Control':'no-store'});
 const stream=await mediaStream(doc.storageId,0,doc.size-1);stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
}));
router.post('/documents/:id/delete',wrap(async(req,res)=>{
 const doc=(await all('employeeDocuments')).find(d=>d.id===req.params.id);if(!doc)throw fail('Document not found.',404);if(req.body.confirm!==true)throw fail('Confirm deletion.');await deleteMediaBytes(doc.storageId);await remove('employeeDocuments',doc.id);res.json({ok:true});
}));
router.use((err,req,res,next)=>{if(err.type==='entity.too.large')return res.status(413).json({error:'The document must not exceed 10 MB.'});next(err);});
export default router;
