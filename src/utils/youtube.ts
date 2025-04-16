
/**
 * YouTube URL parser and utility functions
 */

// Regular expressions to extract YouTube video IDs from different URL formats
const YOUTUBE_REGEX = {
  STANDARD: /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  SHORT: /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/
};

/**
 * Extract YouTube video ID from various URL formats
 */
export const extractVideoId = (url: string): string | null => {
  if (!url) return null;
  
  // Try standard format
  const standardMatch = url.match(YOUTUBE_REGEX.STANDARD);
  if (standardMatch && standardMatch[1]) {
    return standardMatch[1];
  }
  
  // Try shorts format
  const shortMatch = url.match(YOUTUBE_REGEX.SHORT);
  if (shortMatch && shortMatch[1]) {
    return shortMatch[1];
  }
  
  return null;
};

/**
 * Generate thumbnail URL from video ID
 */
export const getThumbnailUrl = (videoId: string): string => {
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
};

/**
 * Generate embed URL for YouTube player
 */
export const getEmbedUrl = (videoId: string): string => {
  return `https://www.youtube.com/embed/${videoId}`;
};

/**
 * Convert seconds to MM:SS format
 */
export const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

/**
 * Convert MM:SS format to seconds
 */
export const parseTimeToSeconds = (timeStr: string): number => {
  const [minutes, seconds] = timeStr.split(':').map(Number);
  return minutes * 60 + seconds;
};

