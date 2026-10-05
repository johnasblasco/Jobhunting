// Serves /api/* for the web page.
import { createNetlifyPoller } from '../../src/netlify.js';
import { handleApi } from '../../src/api.js';

export default async (request) => {
  // Netlify stops normal functions after ~10s, so "Check now" uses short timeouts.
  const { poller, setStatus } = await createNetlifyPoller({ timeoutMs: 7000 });
  return handleApi(request, { poller, setStatus, password: process.env.APP_PASSWORD });
};

export const config = { path: '/api/*' };
