import alchemy from 'alchemy';
import { Worker } from 'alchemy/cloudflare';

const app = await alchemy('cloudflare-example');


export const worker = await Worker('hello-worker', {
  entrypoint: './src/worker.ts',
  compatibilityFlags: ['nodejs_compat'],
});


console.log(`Worker deployed at: ${worker.url}`);
await app.finalize();
