from flask import Flask, request, send_file, jsonify, Response
from flask_cors import CORS
import yt_dlp
import os
from pathlib import Path
import json
import queue
import threading

app = Flask(__name__)
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:5173", "http://localhost:8080"],
        "methods": ["GET", "POST"],
        "allow_headers": ["Content-Type"],
        "supports_credentials": True
    }
})

# 創建臨時目錄
TEMP_DIR = Path(__file__).parent / 'temp'
TEMP_DIR.mkdir(exist_ok=True)

# 用於存儲下載進度的隊列
progress_queues = {}

def progress_hook(d):
    """yt-dlp 的進度回調函數"""
    video_id = d.get('info_dict', {}).get('id')
    if not video_id or video_id not in progress_queues:
        return

    if d['status'] == 'downloading':
        try:
            downloaded = d.get('downloaded_bytes', 0)
            total = d.get('total_bytes') or d.get('total_bytes_estimate', 0)
            
            if total > 0:
                progress = (downloaded / total) * 100
                speed = d.get('speed', 0)
                eta = d.get('eta', 0)
                
                progress_info = {
                    'status': 'downloading',
                    'progress': progress,
                    'speed': speed,
                    'eta': eta,
                    'downloaded': downloaded,
                    'total': total
                }
            else:
                progress_info = {
                    'status': 'downloading',
                    'progress': 0,
                    'speed': 0,
                    'eta': 0
                }
                
            progress_queues[video_id].put(progress_info)
        except Exception as e:
            print(f"處理進度時出錯: {e}")
            
    elif d['status'] == 'finished':
        progress_queues[video_id].put({
            'status': 'processing',
            'progress': 100
        })

@app.route('/api/progress/<video_id>')
def get_progress(video_id):
    """SSE 端點，用於發送進度更新"""
    def generate():
        if video_id not in progress_queues:
            progress_queues[video_id] = queue.Queue()
            
        while True:
            try:
                progress_info = progress_queues[video_id].get(timeout=30)  # 30秒超時
                yield f"data: {json.dumps(progress_info)}\n\n"
                
                if progress_info.get('status') == 'finished':
                    break
            except queue.Empty:
                # 發送心跳以保持連接
                yield f"data: {json.dumps({'status': 'heartbeat'})}\n\n"
            except Exception as e:
                print(f"發送進度時出錯: {e}")
                break
                
        # 清理
        if video_id in progress_queues:
            del progress_queues[video_id]

    return Response(generate(), mimetype='text/event-stream')

@app.route('/api/download', methods=['POST'])
def download_video():
    output_path = None
    try:
        data = request.json
        video_id = data.get('videoId')
        
        if not video_id:
            return jsonify({'error': '缺少影片 ID'}), 400

        video_url = f'https://www.youtube.com/watch?v={video_id}'
        output_path = TEMP_DIR / f'{video_id}.mp4'

        # yt-dlp 配置
        ydl_opts = {
            'format': 'bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            'outtmpl': str(output_path),
            'progress_hooks': [progress_hook],
            'quiet': False,
            'no_warnings': False,
            'merge_output_format': 'mp4',
            'nocheckcertificate': True,
            'http_headers': {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Referer': 'https://www.youtube.com/',
                'Sec-Fetch-Mode': 'navigate'
            }
        }

        video_title = None
        # 下載影片
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            print(f'開始下載影片: {video_url}')
            try:
                # 首先嘗試獲取影片信息
                info = ydl.extract_info(video_url, download=False)
                video_title = info.get("title", "")
                print(f'影片標題: {video_title}')
                
                # 截斷標題至20個字
                if len(video_title) > 20:
                    video_title = video_title[:20]
                
                # 移除檔名中的非法字元
                video_title = "".join(c for c in video_title if c not in r'\/:*?"<>|')
                
                # 然後下載影片
                ydl.download([video_url])
            except yt_dlp.utils.DownloadError as e:
                print(f'下載錯誤: {str(e)}')
                # 如果下載失敗，嘗試使用較低品質
                print('嘗試使用較低品質...')
                ydl_opts['format'] = 'best[height<=720][ext=mp4]/best[height<=720]/best'
                with yt_dlp.YoutubeDL(ydl_opts) as ydl2:
                    ydl2.download([video_url])

        if not output_path.exists():
            raise Exception('下載完成，但找不到輸出文件')

        # 檢查文件大小
        file_size = output_path.stat().st_size
        if file_size == 0:
            raise Exception('下載的文件大小為 0')

        # 發送文件
        print(f'開始發送文件... (大小: {file_size} bytes)')
        response = send_file(
            output_path,
            as_attachment=True,
            download_name=f'{video_title or video_id}.mp4',
            mimetype='video/mp4'
        )

        # 設置回調以在發送後刪除文件
        @response.call_on_close
        def cleanup():
            try:
                if output_path and output_path.exists():
                    output_path.unlink()
                    print('臨時文件清理完成')
            except Exception as e:
                print(f'清理臨時文件時出錯: {e}')

        return response

    except Exception as e:
        print(f'處理影片時出錯: {str(e)}')
        # 清理臨時文件
        try:
            if output_path and output_path.exists():
                output_path.unlink()
        except Exception as cleanup_err:
            print(f'清理臨時文件時出錯: {cleanup_err}')

        return jsonify({
            'error': '下載影片時發生錯誤',
            'details': str(e)
        }), 500

if __name__ == '__main__':
    app.run(port=3001, debug=True) 