

export type Video = {
  id: string;
  title: string;
  url: string;
  duration: number; // Watch duration in seconds
  submitterId: string;
  submissionDate: any;
};

export type Session = {
    id: string;
    userId: string;
    videoId: string;
    videoDuration: number;
    startTime: any;
    lastHeartbeat: any;
    totalWatchedTime: number;
    status: 'active' | 'completed' | 'aborted';
};

export type UserProfile = {
    id: string;
    name: string;
    email: string;
    avatar: string;
    role: 'user' | 'admin';
    gender: 'male' | 'female' | 'other';
    country: string;
    country_code: string;
    city: string;
    createdAt: any;
    lastLogin: any;
    points: number;
    lastUpdated?: number;
};
