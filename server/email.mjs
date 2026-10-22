// Credentials stay on the account server, never in the launcher bundle.
export function resendMailer({apiKey=process.env.RESEND_API_KEY,from=process.env.EMBER_EMAIL_FROM,request=fetch}={}){
 if(!apiKey||!from)return undefined;
 return async({to,url})=>{
  const response=await request('https://api.resend.com/emails',{
   method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},
   body:JSON.stringify({from,to:[to],subject:'Reset your Ember password',text:`A password reset was requested for your Ember account.\n\nChoose a new password: ${url}\n\nThis link expires in 30 minutes and can be used once. If you did not request this, ignore this email. Your password will remain unchanged.`}),
   signal:AbortSignal.timeout(10000),redirect:'error',
  });
  if(!response.ok)throw Error('Email provider rejected the request.');
 };
}
