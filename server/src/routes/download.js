import express from 'express';
import ytdl from 'ytdl-core';
import ffmpeg from 'fluent-ffmpeg';
import { createWriteStream } from 'fs';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();
const tempDir = join(__dirname, '../../temp');

// 設置 FFmpeg 路徑
const ffmpegPath = 'C:\\ffmpeg-master-latest-win64-gpl-shared\\bin\\ffmpeg.exe'; // Windows 路徑
const ffprobePath = 'C:\\ffmpeg-master-latest-win64-gpl-shared\\bin\\ffprobe.exe'; // Windows 路徑

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

// 確保臨時目錄存在
import { mkdirSync } from 'fs';
try {
  mkdirSync(tempDir, { recursive: true });
} catch (err) {
  console.error('無法創建臨時目錄:', err);
}

// 獲取視頻信息的輔助函數
async function getVideoInfo(videoId) {
  try {
    // 首先嘗試使用 ytdl-core
    const info = await ytdl.getInfo(videoId, {
      requestOptions: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        }
      }
    });
    return info;
  } catch (error) {
    console.error('使用 ytdl-core 獲取信息失敗:', error);
    
    // 如果 ytdl-core 失敗，嘗試使用 YouTube API
    try {
      const response = await axios.get(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        }
      });
      
      // 從 HTML 中提取必要的信息
      const html = response.data;
      const playerResponse = html.match(/"playerResponse":({.*?});/)?.[1];
      if (!playerResponse) {
        throw new Error('無法從 HTML 中提取視頻信息');
      }
      
      const videoData = JSON.parse(playerResponse);
      return {
        formats: videoData.streamingData?.formats || [],
        videoDetails: videoData.videoDetails || {}
      };
    } catch (apiError) {
      console.error('使用 YouTube API 獲取信息失敗:', apiError);
      throw error; // 拋出原始錯誤
    }
  }
}

router.post('/download', async (req, res) => {
  console.log('收到下載請求:', req.body);
  
  const { videoId, startTime, endTime } = req.body;
  
  if (!videoId) {
    return res.status(400).json({ error: '缺少影片 ID' });
  }

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const tempFilePath = join(tempDir, `${videoId}.mp4`);
  const outputFilePath = join(tempDir, `${videoId}-clip.mp4`);

  try {
    console.log('開始獲取影片信息...');
    const videoInfo = await getVideoInfo(videoId);
    console.log('影片標題:', videoInfo.videoDetails.title);

    // 選擇最佳格式
    const formats = videoInfo.formats
      .filter(format => format.hasVideo && format.hasAudio)
      .sort((a, b) => {
        const aQuality = parseInt(a.qualityLabel) || 0;
        const bQuality = parseInt(b.qualityLabel) || 0;
        return bQuality - aQuality;
      });
      
    console.log('可用格式數量:', formats.length);
    console.log('所有可用格式:', formats.map(f => ({
      qualityLabel: f.qualityLabel,
      container: f.container,
      codecs: f.codecs,
      hasVideo: f.hasVideo,
      hasAudio: f.hasAudio,
      url: f.url ? '有' : '無'
    })));
    
    if (formats.length === 0) {
      throw new Error('找不到合適的影片格式');
    }

    const format = formats[0]; // 使用最高品質格式
    console.log('選擇的格式:', {
      qualityLabel: format.qualityLabel,
      container: format.container,
      codecs: format.codecs,
      hasVideo: format.hasVideo,
      hasAudio: format.hasAudio,
      url: format.url ? '有' : '無'
    });

    // 下載影片
    console.log('開始下載影片...');
    if (format.url) {
      // 如果有直接 URL，使用它下載
      await new Promise((resolve, reject) => {
        axios({
          method: 'get',
          url: format.url,
          responseType: 'stream',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        })
          .then(response => {
            const writer = createWriteStream(tempFilePath);
            response.data.pipe(writer);
            writer.on('finish', resolve);
            writer.on('error', reject);
          })
          .catch(reject);
      });
    } else {
      // 否則使用 ytdl-core 下載
      await new Promise((resolve, reject) => {
        const video = ytdl(videoUrl, { 
          format,
          requestOptions: {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.5'
            }
          }
        })
          .on('progress', (_, downloaded, total) => {
            if (total) {
              const percent = (downloaded / total * 100).toFixed(2);
              console.log(`下載進度: ${percent}%`);
            }
          })
          .on('error', (error) => {
            console.error('下載過程中出錯:', error);
            reject(error);
          });

        video.pipe(createWriteStream(tempFilePath))
          .on('finish', () => {
            console.log('影片下載完成');
            resolve();
          })
          .on('error', (error) => {
            console.error('寫入文件時出錯:', error);
            reject(error);
          });
      });
    }

    // 剪輯影片
    console.log('開始剪輯影片...', {
      inputPath: tempFilePath,
      outputPath: outputFilePath,
      startTime,
      duration: endTime - startTime
    });

    await new Promise((resolve, reject) => {
      ffmpeg(tempFilePath)
        .setStartTime(startTime)
        .setDuration(endTime - startTime)
        .output(outputFilePath)
        .on('start', (commandLine) => {
          console.log('FFmpeg 命令:', commandLine);
        })
        .on('progress', (progress) => {
          console.log('剪輯進度:', progress);
        })
        .on('end', () => {
          console.log('影片剪輯完成');
          resolve();
        })
        .on('error', (error) => {
          console.error('剪輯過程中出錯:', error);
          reject(error);
        })
        .run();
    });

    // 發送文件
    console.log('開始發送文件...');
    res.sendFile(outputFilePath, async (err) => {
      if (err) {
        console.error('發送文件時出錯:', err);
      }
      
      // 清理臨時文件
      try {
        await unlink(tempFilePath);
        await unlink(outputFilePath);
        console.log('臨時文件清理完成');
      } catch (cleanupErr) {
        console.error('清理臨時文件時出錯:', cleanupErr);
      }
    });

  } catch (error) {
    console.error('處理影片時出錯:', error);
    
    // 清理臨時文件
    try {
      await unlink(tempFilePath).catch(() => {});
      await unlink(outputFilePath).catch(() => {});
    } catch (cleanupErr) {
      console.error('清理臨時文件時出錯:', cleanupErr);
    }

    // 返回詳細的錯誤信息
    const errorResponse = {
      error: '下載或處理影片時發生錯誤',
      message: error.message,
      details: error.stack,
      ffmpegPath,
      ffprobePath,
      videoId,
      startTime,
      endTime
    };
    
    console.error('錯誤詳情:', JSON.stringify(errorResponse, null, 2));
    
    res.status(500).json(errorResponse);
  }
});

// 添加錯誤處理中間件
router.use((err, req, res, next) => {
  console.error('路由錯誤處理:', err);
  res.status(500).json({
    error: '服務器錯誤',
    message: err.message,
    details: err.stack
  });
});

export const downloadRouter = router; 