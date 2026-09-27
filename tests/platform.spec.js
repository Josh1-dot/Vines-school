import {test,expect} from '@playwright/test';
const headers={'X-Vines-Request':'1'};
test('Public pages, enquiry persistence, gallery filters and mobile layout',async({page,request})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.locator('.hero').waitFor({state:'visible',timeout:12000});await expect(page.getByRole('heading',{name:'A bright beginning. A brilliant future.'})).toBeVisible();
 await page.screenshot({path:'/tmp/vines-review/home-desktop.png',fullPage:true});
 await page.goto('/gallery');await page.getByRole('button',{name:'Microsoft Excel',exact:true}).click();await expect(page.locator('.work-card')).toHaveCount(1);
 await page.goto('/admissions');await page.getByLabel('Parent / guardian name').fill('Website test');await page.getByLabel('Email address').fill('test@example.test');await page.getByLabel('Phone number').fill('0700000000');await page.getByLabel('Tell us about your enquiry').fill('Please arrange a school visit.');await page.getByRole('button',{name:'Send enquiry'}).click();await expect(page.getByRole('status')).toContainText('Saved successfully');
 await request.post('/api/demo-login',{headers,data:{role:'teacher'}});const data=await (await request.get('/api/dashboard')).json();expect(data.enquiries.some(e=>e.name==='Website test')).toBeTruthy();
 for(const route of ['/about','/academics','/digital-school','/news','/contact','/policies']){await page.goto(route);await expect(page.locator('main h1')).toBeVisible();}
 await page.setViewportSize({width:390,height:844});await page.goto('/');await page.locator('.hero').waitFor({state:'visible',timeout:12000});await page.getByRole('button',{name:'Toggle navigation'}).click();await expect(page.getByRole('link',{name:'Parent login',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await page.getByRole('button',{name:'Toggle navigation'}).click();await page.screenshot({path:'/tmp/vines-review/home-mobile.png',fullPage:true});expect(errors).toEqual([]);
});
test('Teacher publishes a grade and homework; parent sees it, submits work and messages',async({browser})=>{
 const teacher=await browser.newContext(),parent=await browser.newContext();
 await teacher.request.post('http://127.0.0.1:3100/api/demo-login',{headers,data:{role:'teacher'}});
 const t=await teacher.newPage();await t.goto('http://127.0.0.1:3100/staff-portal#academics');await t.getByLabel('Subject',{exact:true}).selectOption('French');await t.getByLabel('Term',{exact:true}).selectOption('3');await t.getByLabel('Score (%)').fill('91');await t.getByLabel('Teacher comment').fill('Excellent speaking practice.');await t.getByRole('button',{name:'Publish result'}).click();await expect(t.getByRole('status')).toContainText('Saved');
 await t.getByRole('button',{name:'Homework',exact:true}).click();await t.getByLabel('Title',{exact:true}).fill('Read a story together');await t.getByLabel('Due date').fill('2026-12-01');await t.getByLabel('Instructions').fill('Write two sentences about the main character.');await t.getByRole('button',{name:'Publish homework'}).click();await expect(t.getByRole('status')).toContainText('Saved');
 const p=await parent.newPage();await p.goto('http://127.0.0.1:3100/parent-portal');await p.getByRole('button',{name:'Explore parent demo'}).click();await expect(p.getByRole('heading',{name:'Parent dashboard',exact:true})).toBeVisible();await p.screenshot({path:'/tmp/vines-review/parent-desktop.png',fullPage:true});
 await p.getByRole('button',{name:'Academics',exact:true}).click();await expect(p.getByText('Excellent speaking practice.')).toBeVisible();await expect(p.getByText('91%',{exact:true}).first()).toBeVisible();
 await p.getByRole('button',{name:/^Assignments/}).click();const card=p.locator('.panel').filter({has:p.getByRole('heading',{name:'Read a story together',exact:true})});await card.getByLabel('Your work / completion note').fill('The character was kind and brave.');await card.getByRole('button',{name:'Submit work'}).click();await expect(card.getByText('Submitted',{exact:true})).toBeVisible();
 await p.getByRole('button',{name:'Messages',exact:true}).click();await p.getByLabel('Your message').fill('Thank you for the reading activity.');await p.getByRole('button',{name:'Send message'}).click();await expect(p.locator('.message-bubble').last()).toContainText('Thank you for the reading activity.');
 await t.getByRole('button',{name:'Parent messages'}).click();await t.reload();await expect(t.locator('.message-bubble').last()).toContainText('Thank you for the reading activity.');
 await p.setViewportSize({width:390,height:844});await p.goto('http://127.0.0.1:3100/parent-portal');await expect(p.getByRole('heading',{name:'Parent dashboard',exact:true})).toBeVisible();expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await p.screenshot({path:'/tmp/vines-review/parent-mobile.png',fullPage:true});await parent.close();await teacher.close();
});
test('Authentication, student isolation and publication permissions are enforced',async({playwright})=>{
 const anonymous=await playwright.request.newContext({baseURL:'http://127.0.0.1:3100'});expect((await anonymous.get('/api/dashboard')).status()).toBe(401);expect((await anonymous.post('/api/demo-login',{data:{role:'parent'}})).status()).toBe(403);
 const teacher=await playwright.request.newContext({baseURL:'http://127.0.0.1:3100'}),parent=await playwright.request.newContext({baseURL:'http://127.0.0.1:3100'}),second=await playwright.request.newContext({baseURL:'http://127.0.0.1:3100'});
 await teacher.post('/api/demo-login',{headers,data:{role:'teacher'}});await parent.post('/api/demo-login',{headers,data:{role:'parent'}});const d=await(await teacher.get('/api/dashboard')).json(),id=d.students[0].id;
 expect((await parent.post('/api/grades',{headers,data:{studentId:id,subject:'Science',score:100,term:3}})).status()).toBe(403);
 expect((await teacher.post('/api/grades',{headers,data:{studentId:id,subject:'Science',score:101,term:3}})).status()).toBe(400);
 expect((await teacher.post('/api/portfolio',{headers,data:{studentId:id,title:'Private art',category:'Art activities',description:'Not approved',published:true,consent:false}})).status()).toBe(400);
 const created=await(await teacher.post('/api/students',{headers,data:{name:'Isolation test student',className:'Primary 4A',admission:'TEST/002',parentName:'Other parent',parentEmail:'other@example.test'}})).json();expect(created.temporaryPassword).toBeTruthy();
 expect((await second.post('/api/login',{headers,data:{email:'other@example.test',password:'wrong'}})).status()).toBe(401);
 await second.post('/api/login',{headers,data:{email:'other@example.test',password:created.temporaryPassword}});const scoped=await(await second.get('/api/dashboard')).json();expect(scoped.students).toHaveLength(1);expect(scoped.students[0].name).toBe('Isolation test student');expect(scoped.grades).toHaveLength(0);expect((await second.post('/api/messages',{headers,data:{studentId:id,body:'Forbidden'}})).status()).toBe(404);
 expect((await teacher.post('/api/resources',{headers,data:{className:'Primary 3A',kind:'Video lesson',title:'Bad link',body:'Test',url:'javascript:alert(1)'}})).status()).toBe(400);
 await second.post('/api/logout',{headers,data:{}});expect((await second.get('/api/dashboard')).status()).toBe(401);
 for(const ctx of [anonymous,teacher,parent,second])await ctx.dispose();
});

test('Practice answers survive reload, are graded by the server and remain private',async({browser})=>{
 const parent=await browser.newContext({baseURL:'http://127.0.0.1:3100'});
 await parent.request.post('/api/demo-login',{headers,data:{role:'parent'}});
 const d=await(await parent.request.get('/api/dashboard')).json();const studentId=d.students[0].id;
 expect((await parent.request.post('/api/exercise-attempts',{headers,data:{studentId,questionId:'unknown',answer:42}})).status()).toBe(400);
 const wrong=await(await parent.request.post('/api/exercise-attempts',{headers,data:{studentId,questionId:'multiply-7-6',answer:3,correct:true}})).json();expect(wrong.correct).toBe(false);
 expect((await parent.request.post('/api/exercise-attempts',{headers,data:{studentId:'another-student',questionId:'multiply-7-6',answer:42}})).status()).toBe(404);
 const page=await parent.newPage();await page.goto('/parent-portal#classroom');await page.getByLabel('Your answer').fill('42');await page.getByRole('button',{name:'Check answer'}).click();await expect(page.getByRole('status')).toContainText('Correct answer saved');await page.reload();await expect(page.getByRole('cell',{name:'Correct',exact:true})).toBeVisible();await expect(page.getByRole('cell',{name:'Keep practising',exact:true})).toBeVisible();
 const teacher=await browser.newContext({baseURL:'http://127.0.0.1:3100'});await teacher.request.post('/api/demo-login',{headers,data:{role:'teacher'}});const view=await(await teacher.request.get('/api/dashboard')).json();expect(view.exerciseAttempts.some(a=>a.studentId===studentId&&a.correct)).toBeTruthy();expect((await teacher.request.post('/api/exercise-attempts',{headers,data:{studentId,questionId:'multiply-7-6',answer:42}})).status()).toBe(403);
 await teacher.close();await parent.close();
});

test('Staff uploads photos and playable videos; family access and publication consent are enforced',async({browser,playwright})=>{
 const teacher=await browser.newContext({baseURL:'http://127.0.0.1:3100'}),parent=await browser.newContext({baseURL:'http://127.0.0.1:3100'}),outsider=await playwright.request.newContext({baseURL:'http://127.0.0.1:3100'});
 await teacher.request.post('/api/demo-login',{headers,data:{role:'teacher'}});await parent.request.post('/api/demo-login',{headers,data:{role:'parent'}});
 const d=await(await parent.request.get('/api/dashboard')).json(),student=d.students[0];
 const t=await teacher.newPage();await t.goto('/staff-portal#classroom');await t.getByLabel('Title',{exact:true}).fill('Class photo upload');await t.getByLabel('Content / instructions').fill('A sample school photo.');await t.getByLabel('Upload photo / video').setInputFiles('public/images/blessed-vines-logo.jpeg');await t.getByRole('button',{name:'Publish resource'}).click();await expect(t.getByRole('status').first()).toContainText('Saved');
 const snapshot=await(await parent.request.get('/api/dashboard')).json(),resource=snapshot.resources.find(r=>r.title==='Class photo upload');expect(resource.mediaType).toBe('image/jpeg');
 expect((await outsider.get(`/api/media/${resource.mediaId}`)).status()).toBe(404);
 const p=await parent.newPage();await p.goto('/parent-portal#classroom');const img=p.getByRole('img',{name:'Class photo upload',exact:true});await expect(img).toBeVisible();await expect.poll(()=>img.evaluate(el=>el.naturalWidth)).toBeGreaterThan(0);
 const created=await(await teacher.request.post('/api/students',{headers,data:{name:'Media privacy test',className:'Primary 5A',admission:'MEDIA/001',parentName:'Private family',parentEmail:'media-private@example.test'}})).json();await outsider.post('/api/login',{headers,data:{email:created.parentEmail,password:created.temporaryPassword}});expect((await outsider.get(`/api/media/${resource.mediaId}`)).status()).toBe(404);
 const rawHeaders={...headers,'Content-Type':'application/octet-stream'};
 expect((await parent.request.post(`/api/media?studentId=${student.id}`,{headers:rawHeaders,data:Buffer.from('not an image')})).status()).toBe(403);
 expect((await teacher.request.post(`/api/media?studentId=${student.id}`,{headers:rawHeaders,data:Buffer.from('<svg onload="alert(1)"></svg>')})).status()).toBe(400);
 const video=Buffer.from(await t.evaluate(async()=>{const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;const ctx=canvas.getContext('2d'),stream=canvas.captureStream(15),rec=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8'}),chunks=[];return await new Promise(resolve=>{rec.ondataavailable=e=>chunks.push(e.data);rec.onstop=async()=>{stream.getTracks().forEach(t=>t.stop());resolve(Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer())));};rec.start();const timer=setInterval(()=>{ctx.fillStyle='#285fc6';ctx.fillRect(0,0,64,64);},40);setTimeout(()=>{clearInterval(timer);rec.stop();},500);});}));
 const upload=await teacher.request.post(`/api/media?studentId=${student.id}`,{headers:rawHeaders,data:video});expect(upload.status()).toBe(201);const media=await upload.json();
 const privatePost={studentId:student.id,title:'Short video',category:'Science',description:'Recorded test video.',mediaId:media.id,published:false,consent:false};
 expect((await teacher.request.post('/api/portfolio',{headers,data:{...privatePost,published:true}})).status()).toBe(400);
 const post=await(await teacher.request.post('/api/portfolio',{headers,data:{...privatePost,consent:true}})).json();
 const part=await parent.request.get(`/api/media/${media.id}`,{headers:{Range:'bytes=0-15'}});expect(part.status()).toBe(206);expect(await part.body()).toEqual(video.subarray(0,16));expect((await parent.request.get(`/api/media/${media.id}`,{headers:{Range:`bytes=${video.length+1}-`}})).status()).toBe(416);
 await p.goto('/parent-portal#portfolio');await p.reload();const player=p.locator('video[aria-label="Short video"]');await expect(player).toBeVisible();await expect.poll(()=>player.evaluate(v=>v.readyState)).toBeGreaterThan(0);await player.evaluate(v=>v.play());await expect.poll(()=>player.evaluate(v=>v.currentTime)).toBeGreaterThan(0);
 await teacher.request.post(`/api/portfolio/${post.id}/visibility`,{headers,data:{published:true}});const anon=await playwright.request.newContext({baseURL:'http://127.0.0.1:3100'});expect((await anon.get(`/api/media/${media.id}`)).status()).toBe(200);await teacher.request.post(`/api/portfolio/${post.id}/visibility`,{headers,data:{published:false}});expect((await anon.get(`/api/media/${media.id}`)).status()).toBe(404);
 await t.screenshot({path:'/tmp/vines-review/media-upload.png',fullPage:true});
 await anon.dispose();await outsider.dispose();await parent.close();await teacher.close();
});

test('Only administrators can publish media to all families',async({browser,playwright})=>{
 const admin=await browser.newContext({baseURL:'http://127.0.0.1:3100'});await admin.request.post('/api/login',{headers,data:{email:'admin@example.test',password:'local-test-admin-password'}});
 const page=await admin.newPage();await page.goto('/staff-portal#classroom');await page.getByLabel('Audience',{exact:true}).selectOption('*');await page.getByLabel('Title',{exact:true}).fill('School celebration');await page.getByLabel('Content / instructions').fill('A photo for all our families.');await page.getByLabel('Upload photo / video').setInputFiles('public/images/blessed-vines-logo.jpeg');await page.getByRole('button',{name:'Publish resource'}).click();await expect(page.getByRole('status').first()).toContainText('Saved');
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await page.screenshot({path:'/tmp/vines-review/admin-upload-mobile.png',fullPage:true});
 const parent=await playwright.request.newContext({baseURL:'http://127.0.0.1:3100'});await parent.post('/api/demo-login',{headers,data:{role:'parent'}});const d=await(await parent.get('/api/dashboard')).json(),item=d.resources.find(r=>r.title==='School celebration');expect(item.className).toBe('*');expect((await parent.get(`/api/media/${item.mediaId}`)).status()).toBe(200);
 const teacher=await playwright.request.newContext({baseURL:'http://127.0.0.1:3100'});await teacher.post('/api/demo-login',{headers,data:{role:'teacher'}});expect((await teacher.post('/api/resources',{headers,data:{className:'*',kind:'Announcement',title:'Not allowed',body:'Test'}})).status()).toBe(400);
 await teacher.dispose();await parent.dispose();await admin.close();
});
