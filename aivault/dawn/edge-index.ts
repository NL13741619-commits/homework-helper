import {createRuntime} from './runtime.mjs';
Deno.serve(createRuntime({env:(name:string)=>Deno.env.get(name)}));
