

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
  stateSynced: boolean;
  status: 'active' | 'completed' | 'suspicious' | 'expired';
  activityPulse: number;
  systemCapacity: number;
  inactiveHeartbeats: number;
  rewardHeartbeats: number;
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
  activityPulse: number;
  systemCapacity: number;
  level: number;
  reputation: number;
  lastUpdated?: number;
  lastSessionStatus?: {
    type: string;
    activityPulse: number;
    timestamp: any;
  };
};
