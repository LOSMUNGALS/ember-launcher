import React, { useState } from 'react';

export function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
 const [shown,setShown]=useState(false);
 return <span className="password-field"><input {...props} type={shown?'text':'password'}/><button type="button" className="password-eye" aria-label={shown?'Hide password':'Show password'} aria-pressed={shown} onClick={()=>setShown(!shown)}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>{shown&&<path d="m3 3 18 18"/>}</svg></button></span>;
}
