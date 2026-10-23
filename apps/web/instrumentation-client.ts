import { initBotId } from 'botid/client/core';

initBotId({
  protect: [
    { path: '/api/licenses/request', method: 'POST' },
    { path: '/api/beta/apply', method: 'POST' },
    { path: '/api/beta/resume', method: 'POST' },
    { path: '/api/beta/sign', method: 'POST' },
    { path: '/api/feedback', method: 'POST' },
    { path: '/api/feedback/confirm', method: 'POST' },
    { path: '/api/agreements/accept', method: 'POST' },
  ],
});
