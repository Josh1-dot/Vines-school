import {build} from 'esbuild';
await build({entryPoints:['public/js/app.jsx'],outfile:'public/js/app.js',bundle:true,minify:true,jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},target:['es2020']});
console.log('School application built.');
