export interface Meeting {
  id: string;
  creatorId: string;
  status: 'active' | 'ended';
  createdAt: Date;
}

export interface MeetingCreate {
  creatorId: string;
}