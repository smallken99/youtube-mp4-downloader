# YouTube 影片下載器

一個簡單的 YouTube 影片下載工具，使用 React + TypeScript 作為前端，Python Flask 作為後端。

## Ubuntu 24.04 部署指南

### 系統需求
- Ubuntu 24.04 LTS
- Python 3.12 或更高版本
- Node.js 20 LTS 或更高版本
- FFmpeg

### 1. 安裝基本依賴

```bash
# 更新系統
sudo apt update
sudo apt upgrade -y

# 安裝 Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 安裝 Python 相關工具
sudo apt install -y python3-pip python3-venv

# 安裝 FFmpeg
sudo apt install -y ffmpeg

# 安裝 Git
sudo apt install -y git
```

### 2. 下載專案

```bash
# 克隆專案
git clone https://github.com/your-username/youtube-mp4-downloader.git
cd youtube-mp4-downloader
```

### 3. 設置後端

```bash
# 進入後端目錄
cd server

# 創建虛擬環境
python3 -m venv venv
source venv/bin/activate

# 安裝依賴
pip install -r requirements.txt

# 創建 systemd 服務檔案
sudo nano /etc/systemd/system/youtube-downloader.service
```

將以下內容複製到 youtube-downloader.service：

```ini
[Unit]
Description=YouTube Downloader Backend
After=network.target

[Service]
User=your-username
WorkingDirectory=/path/to/youtube-mp4-downloader/server
Environment="PATH=/path/to/youtube-mp4-downloader/server/venv/bin"
ExecStart=/path/to/youtube-mp4-downloader/server/venv/bin/python app.py
Restart=always

[Install]
WantedBy=multi-user.target
```

記得替換 `your-username` 和路徑為實際值。

```bash
# 啟動服務
sudo systemctl daemon-reload
sudo systemctl enable youtube-downloader
sudo systemctl start youtube-downloader

# 檢查狀態
sudo systemctl status youtube-downloader
```

### 4. 設置前端

```bash
# 回到專案根目錄
cd ..

# 安裝依賴
npm install

# 建置前端
npm run build

# 安裝 Nginx
sudo apt install -y nginx

# 配置 Nginx
sudo nano /etc/nginx/sites-available/youtube-downloader
```

將以下內容複製到 Nginx 配置檔案：

```nginx
server {
    listen 80;
    server_name your-domain.com;  # 替換為您的域名或 IP

    root /path/to/youtube-mp4-downloader/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# 建立符號連結
sudo ln -s /etc/nginx/sites-available/youtube-downloader /etc/nginx/sites-enabled/

# 測試 Nginx 配置
sudo nginx -t

# 重新啟動 Nginx
sudo systemctl restart nginx
```

### 5. 設定防火牆

```bash
# 允許 HTTP 流量
sudo ufw allow 80/tcp

# 允許 HTTPS 流量（如果需要）
sudo ufw allow 443/tcp
```

### 6. SSL 設定（選擇性）

如果需要 HTTPS：

```bash
# 安裝 Certbot
sudo apt install -y certbot python3-certbot-nginx

# 獲取 SSL 證書
sudo certbot --nginx -d your-domain.com
```

### 7. 維護指令

```bash
# 更新後端
cd server
source venv/bin/activate
git pull
pip install -r requirements.txt
sudo systemctl restart youtube-downloader

# 更新前端
cd ..
git pull
npm install
npm run build
```

### 故障排除

1. 檢查後端日誌：
```bash
sudo journalctl -u youtube-downloader -f
```

2. 檢查 Nginx 日誌：
```bash
sudo tail -f /var/log/nginx/error.log
```

3. 檢查權限：
```bash
# 確保資料夾權限正確
sudo chown -R your-username:your-username /path/to/youtube-mp4-downloader
```

### 注意事項

1. 請確保替換所有的路徑和使用者名稱為您的實際值
2. 建議定期更新系統和依賴包
3. 考慮設置監控和自動備份
4. 如果是生產環境，強烈建議啟用 HTTPS

## 開發指南

### 本地開發

1. 啟動後端：
```bash
cd server
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

2. 啟動前端：
```bash
npm install
npm run dev
```

## 授權

MIT License
