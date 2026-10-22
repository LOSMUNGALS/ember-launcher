import {_electron} from 'playwright';
import {mkdtemp} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {startService} from '../server/index.mjs';
// Test-only real account service; no bypass exists in the launcher.
export const electron={async launch(options){
 const directory=await mkdtemp(path.join(os.tmpdir(),'ember-smoke-accounts-'));
 const service=await startService({directory,port:0,adminEmail:'test@example.com'});
 const password='Fixture-only-password-2026';await service.accounts.bootstrap(password);
 let app;
 try{
  app=await _electron.launch({...options,env:{...options.env,EMBER_ACCOUNT_URL:service.url}});
  const page=await app.firstWindow();await page.waitForFunction(()=>Boolean(window.ember2));
  await page.evaluate(password=>window.ember2.call('accountLogin',{identifier:'test@example.com',password}),password);
  const close=app.close.bind(app);app.close=async()=>{try{await close();}finally{await service.close();}};return app;
 }catch(e){await app?.close();await service.close();throw e;}
}};
