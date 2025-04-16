import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { downloadRouter } from './routes/download.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3001;

// 開發環境下允許所有本地請求
const isDevelopment = process.env.NODE_ENV !== 'production';

// CORS 配置
app.use(cors({
  origin: function(origin, callback) {
    if (isDevelopment) {
      // 在開發環境中，允許所有本地請求
      if (!origin || origin.match(/^http:\/\/localhost:[0-9]+$/) || origin.match(/^http:\/\/127\.0\.0\.1:[0-9]+$/)) {
        callback(null, true);
        return;
      }
    }
    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// 請求日誌中間件
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  console.log('Request headers:', req.headers);
  next();
});

app.use(express.json());

// 路由
app.use('/api', downloadRouter);

// 測試路由
app.get('/api/test', (req, res) => {
  res.json({ message: 'API 伺服器運作正常' });
});

// 錯誤處理中間件
app.use((err, req, res, next) => {
  console.error('錯誤詳情:', err);
  res.status(500).json({
    error: '伺服器發生錯誤',
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

app.listen(port, () => {
  console.log(`伺服器運行在 http://localhost:${port}`);
  console.log('CORS 配置:', isDevelopment ? '允許所有本地請求' : '僅允許特定來源');
}); 