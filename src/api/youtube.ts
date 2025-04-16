import axios from 'axios';

export interface DownloadOptions {
  videoId: string;
}

export interface DownloadProgress {
  status: 'downloading' | 'processing';
  downloaded: number;
  total: number;
  speed: number;
  eta: number;
  progress: number;
}

export interface ErrorResponse {
  error: string;
  details?: any;
}

export const downloadVideo = async (
  options: DownloadOptions,
  onProgress?: (progress: DownloadProgress) => void
): Promise<Blob> => {
  try {
    const response = await axios.post(
      '/api/download',
      options,
      {
        responseType: 'blob',
        onDownloadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const progress: DownloadProgress = {
              status: 'downloading',
              downloaded: progressEvent.loaded,
              total: progressEvent.total,
              speed: progressEvent.rate || 0,
              eta: progressEvent.estimated || 0,
              progress: (progressEvent.loaded / progressEvent.total) * 100
            };
            onProgress(progress);
          }
        }
      }
    );

    // Check if the response is JSON (error message)
    if (response.headers['content-type']?.includes('application/json')) {
      const reader = new FileReader();
      const errorPromise = new Promise<never>((_, reject) => {
        reader.onload = () => {
          try {
            const error = JSON.parse(reader.result as string) as ErrorResponse;
            reject(new Error(error.error));
          } catch {
            reject(new Error('Unknown error occurred'));
          }
        };
      });
      reader.readAsText(response.data);
      await errorPromise;
    }

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data) {
      const reader = new FileReader();
      reader.readAsText(error.response.data);
      const errorPromise = new Promise<never>((_, reject) => {
        reader.onload = () => {
          try {
            const errorData = JSON.parse(reader.result as string) as ErrorResponse;
            reject(new Error(errorData.error));
          } catch {
            reject(error);
          }
        };
      });
      await errorPromise;
    }
    throw error;
  }
}; 