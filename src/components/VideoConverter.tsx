import React, { useState, useEffect } from 'react';
import { downloadVideo, type DownloadProgress } from '@/api/youtube';

interface VideoConverterProps {
  videoId: string;
}

const VideoConverter: React.FC<VideoConverterProps> = ({ videoId: propVideoId }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [url, setUrl] = useState('');
  const [videoId, setVideoId] = useState(propVideoId);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  const extractVideoId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
      /youtube\.com\/embed\/([^&\n?#]+)/,
      /youtube\.com\/v\/([^&\n?#]+)/,
      /youtube\.com\/shorts\/([^&\n?#]+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  };

  useEffect(() => {
    const newVideoId = extractVideoId(url);
    if (newVideoId) {
      setVideoId(newVideoId);
      setError(null);
    } else if (url) {
      setError('請輸入有效的 YouTube 網址');
    }
  }, [url]);

  useEffect(() => {
    if (videoId) {
      setThumbnailUrl(`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`);
    } else {
      setThumbnailUrl(null);
    }
  }, [videoId]);

  const handleDownload = async () => {
    try {
      setLoading(true);
      setError(null);
      setProgress(null);

      console.log('Starting download for video:', videoId);
      
      const blob = await downloadVideo(
        { videoId },
        (progressData) => {
          setProgress(progressData);
        }
      );

      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${videoId}.mp4`;
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setProgress(null);
    } catch (err) {
      console.error('Download error:', err);
      setError(err instanceof Error ? err.message : 'Failed to download video');
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatSpeed = (bytesPerSecond: number) => {
    return `${formatBytes(bytesPerSecond)}/s`;
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <div className="min-h-screen bg-[#0f1115] text-gray-100 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-center text-[#8B5CF6] mb-8">
          YouTube 影片下載器
        </h1>

        <div className="mb-6">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="請輸入 YouTube 網址"
            className="w-full px-4 py-2 bg-[#1a1d24] border border-[#2a2d34] rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-[#8B5CF6]"
          />
        </div>

        <div className="bg-[#1a1d24] rounded-lg overflow-hidden">
          <div className="relative">
            <div className="aspect-w-16 aspect-h-9 bg-[#0f1115]">
              {videoId ? (
                <>
                  {thumbnailUrl && (
                    <div 
                      className="absolute inset-0 bg-cover bg-center bg-no-repeat blur-sm opacity-30"
                      style={{ backgroundImage: `url(${thumbnailUrl})` }}
                    />
                  )}
                  <iframe
                    src={`https://www.youtube.com/embed/${videoId}`}
                    className="absolute inset-0 w-full h-full"
                    allowFullScreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  />
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-gray-500 flex flex-col items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>影片預覽區</span>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="p-4">
            {progress && (
              <div className="mb-4">
                <div className="mb-2 flex justify-between text-sm text-gray-400">
                  <span>
                    {formatBytes(progress.downloaded)} / {formatBytes(progress.total)}
                  </span>
                  <span>{formatSpeed(progress.speed)}</span>
                </div>
                <div className="w-full bg-[#2a2d34] rounded-full h-2">
                  <div
                    className="bg-[#8B5CF6] h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress.progress}%` }}
                  ></div>
                </div>
                <div className="mt-2 text-sm text-gray-400">
                  {progress.status === 'downloading' ? (
                    <span>預計剩餘時間: {formatTime(progress.eta)}</span>
                  ) : (
                    <span>處理影片中...</span>
                  )}
                </div>
              </div>
            )}

            <button
              onClick={handleDownload}
              disabled={loading || !videoId}
              className={`w-full py-3 bg-[#4338ca] text-white rounded-lg hover:bg-[#3730a3] disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>下載中...</span>
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>下載 MP4</span>
                </>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200">
            <p>{error}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoConverter;
