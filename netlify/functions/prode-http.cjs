const serverless = require('serverless-http');
const app = require('../../api/app.cjs');

exports.handler = serverless(app);
