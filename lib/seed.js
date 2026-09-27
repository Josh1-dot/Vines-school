import {all,insert} from './store.js';
import {passwordHash} from './auth.js';
import {randomBytes} from 'node:crypto';
export async function seedDemo(){
 if(process.env.NODE_ENV==='production'||process.env.DEMO_MODE==='false'||(await all('users')).length)return;
 const parent=await insert('users',{name:'John Kamau',email:'parent@example.test',role:'parent',passwordHash:passwordHash(randomBytes(24).toString('hex')),demo:true});
 const teacher=await insert('users',{name:'Grace • Class Teacher',email:'teacher@example.test',role:'teacher',passwordHash:passwordHash(randomBytes(24).toString('hex')),demo:true});
 const student=await insert('students',{name:'John Kamau Jr.',className:'Primary 3A',admission:'DEMO/2026/001',parentId:parent.id,teacherId:teacher.id,behaviour:'Excellent',demo:true});
 for(const [subject,score] of [['French',85],['Swahili',92],['Mathematics',80],['Computer Studies',95],['Science',78],['Reading',88]])for(const term of [1,2,3])await insert('grades',{studentId:student.id,subject,term,score:score-(3-term)*4,comment:'Good progress. Keep practising and asking questions.',teacherId:teacher.id});
 for(let i=1;i<=20;i++)await insert('attendance',{studentId:student.id,date:`2026-09-${String(i).padStart(2,'0')}`,status:i===9?'Absent':'Present',teacherId:teacher.id});
 for(const [subject,title,date] of [['French','Write five sentences about your family','2026-10-05'],['Mathematics','Practise multiplication tables','2026-10-06'],['Science','Observe a growing plant','2026-10-09']])await insert('assignments',{className:'Primary 3A',subject,title,dueDate:date,instructions:'Complete the activity in your exercise book. Share a short summary with your teacher.',teacherId:teacher.id});
 for(const [title,date] of [['Parents meeting','2026-10-12'],['End of term assessments','2026-11-02'],['Cultural & talent day','2026-11-20']])await insert('events',{title,date,body:'Sample calendar entry. Confirm the school calendar before planning a visit.',demo:true});
 for(const title of ['Excellent Reader','Punctuality Champion','Best Computer Student','Creative Student','Best Behavior'])await insert('rewards',{studentId:student.id,title,teacherId:teacher.id});
 for(const [title,category,description] of [['My first presentation','PowerPoint','Planning three slides about our environment.'],['A colourful garden','Digital drawing','Exploring shapes, colours and imagination.'],['My reading journal','Microsoft Word','A page about a favourite story.'],['Classroom survey','Microsoft Excel','Using a table to organise our class survey.'],['Computer explorer','Windows','Learning folders and responsible computer use.'],['Our culture, our stories','Cultural activities','Celebrating music and stories together.']])await insert('portfolio',{studentId:student.id,title,category,description,url:'',published:true,consent:true,teacherId:teacher.id,demo:true});
 await insert('resources',{title:'Reading practice',kind:'Class notes',className:'Primary 3A',body:'Read a short story with an adult. Describe the main character and explain your favourite part.',url:'',teacherId:teacher.id});
 await insert('resources',{title:'Welcome to the digital classroom',kind:'Announcement',className:'Primary 3A',body:'Check your homework, practise an exercise and share your learning with your family.',url:'',teacherId:teacher.id});
 await insert('news',{title:'A new chapter in digital learning',body:'This example story shows how school updates will appear. Staff can publish real news from their portal.',category:'Digital learning',demo:true});
 await insert('messages',{studentId:student.id,senderId:teacher.id,senderName:teacher.name,body:'Welcome to the sample parent portal. This fictional student shows how families can follow learning and speak with teachers.'});
}
