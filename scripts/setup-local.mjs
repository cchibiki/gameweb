import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const run=(args)=>{const r=spawnSync(process.execPath,args,{stdio:'inherit'});if(r.error)throw r.error;if(r.status!==0)process.exit(r.status??1);};
run(['scripts/run-framework.mjs','build']);
const journal=JSON.parse(readFileSync('drizzle/meta/_journal.json','utf8'));
// Wrangler records which local migrations were applied, making setup repeatable.
const config=JSON.parse(readFileSync('dist/server/wrangler.json','utf8'));
config.d1_databases.forEach(db=>db.migrations_dir='../../drizzle');
const {writeFileSync}=await import('node:fs');
writeFileSync('dist/server/wrangler.local-setup.json',JSON.stringify(config));
if(journal.entries.length)run(['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','d1','migrations','apply','DB','--local','--config','dist/server/wrangler.local-setup.json','--persist-to','.wrangler/state']);
