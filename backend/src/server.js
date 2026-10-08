import { createApp } from './app.js';

const port = Number(process.env.PORT || 3001);
const app = createApp();
const server = app.listen(port, '127.0.0.1', () => {
  console.log(`API local disponível em http://127.0.0.1:${port}`);
});

function closeServer() {
  server.close(() => process.exit(0));
}

process.on('SIGINT', closeServer);
process.on('SIGTERM', closeServer);
