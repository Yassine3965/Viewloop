
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

function getYoutubeVideoId(url: string): string | null {
  if (!url) return null;
  let videoId = null;
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname === 'youtu.be') {
      videoId = urlObj.pathname.slice(1);
    } else if (urlObj.hostname.includes('youtube.com') && urlObj.searchParams.has('v')) {
      videoId = urlObj.searchParams.get('v');
    } else {
      // Handle URLs like /embed/VIDEO_ID
      const match = urlObj.pathname.match(/\/embed\/([^/]+)/);
      if (match) {
        videoId = match[1];
      }
    }
  } catch (error) {
    // Handle cases where the URL is not valid, e.g. just a video ID
    const match = url.match(/^([a-zA-Z0-9_-]{11})$/);
    if (match) {
      videoId = match[1];
    }
  }

  // Final check for valid video ID format
  if (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return videoId;
  }
  
  return null;
}


export function getYoutubeEmbedUrl(url: string): string | null {
  const videoId = getYoutubeVideoId(url);
  if (!videoId) return null;

  // Parameters to ensure autoplay, hide controls, and enable looping
  return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&modestbranding=1&showinfo=0&loop=1&playlist=${videoId}`;
}

export function getYoutubeThumbnailUrl(url: string): string | null {
    const videoId = getYoutubeVideoId(url);
    if (!videoId) return 'https://placehold.co/400x225?text=Invalid+URL';
    // hqdefault provides a high-quality 480x360 image
    return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

    