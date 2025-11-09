import type { worker } from '../alchemy.run.ts';
import { trace } from 'autolemetry-edge';

export default trace(async function fetch(request: Request, env: typeof worker.Env): Promise<Response> {
  return Response.json({
    message: 'Hello from Alchemy!',
    timestamp: new Date().toISOString(),
  });
});
