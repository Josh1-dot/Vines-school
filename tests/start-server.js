import 'dotenv/config';
import {initStore,insert} from '../lib/store.js';
import {seedDemo} from '../lib/seed.js';
import {passwordHash} from '../lib/auth.js';
if(process.env.NODE_ENV!=='test'||process.env.MONGODB_URI)throw Error('Test fixtures require an isolated local test database.');
await initStore();await seedDemo();
await insert('users',{name:'Test administrator',email:'admin@example.test',role:'admin',passwordHash:passwordHash('local-test-admin-password')});
await insert('users',{name:'Headteacher test',email:'headteacher@example.test',role:'superadmin',passwordHash:passwordHash('local-test-director-password')});
await import('../server.js');
