import {spawnSync} from 'node:child_process';

const result=spawnSync(process.execPath,[process.env.npm_execpath,'run','build'],{
  stdio:'inherit',
  env:{...process.env,NEXT_STATIC_EXPORT:'1',NEXT_PUBLIC_API_PROXY:'1'},
});
if(result.error)throw result.error;
process.exit(result.status??1);
