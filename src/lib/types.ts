

export type Video = {
  id: string;
  title: string;
  url: string;
  duration: number; // Watch duration in seconds
  submitterId: string;
  submissionDate: any;
};

export type Session = {
    sessionToken: string;
    userId: string;
    videoID: string;
    createdAt: number;
    lastHeartbeatAt: number;
    totalWatchedSeconds: number;
    adWatched: boolean;
    status: 'active' | 'completed' | 'suspicious' | 'expired';
    points: number;
    gems: number;
    inactiveHeartbeats: number;
    adHeartbeats: number;
    penaltyReasons: string[];
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
    gems: number;
    level: number;
    reputation: number;
    lastUpdated?: number;
};
