// Family Tree API helpers

interface FamilyMember {
  id: number;
  name: string;
  relation: string;
  email: string;
}

interface PendingInvite {
  id: number;
  member_id: number;
  member_name: string;
  email: string;
  relationship_type: string;
  initiated_at: string;
  notes?: string;
}

interface FamilyTreeData {
  success: boolean;
  pending_sent: PendingInvite[];
  pending_received: PendingInvite[];
  family: any[];
  tree: {
    parents: FamilyMember[];
    couple: FamilyMember[];
    siblings?: FamilyMember[];
    children: FamilyMember[];
    other?: FamilyMember[];
  };
}

interface SearchResult {
  id: number;
  full_name: string;
  email: string;
  status: string;
  relationship_status?: string | null;
}

import { API_BASE_URL } from '../config/api';

const getApiBaseUrl = (): string => {
  return API_BASE_URL;
};

export const fetchFamilyTree = async (memberId: number): Promise<FamilyTreeData> => {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/family/list.php?member_id=${memberId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch family tree: ${response.statusText}`);
  }

  return response.json();
};

export const searchMembers = async (query: string, currentMemberId: number): Promise<SearchResult[]> => {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(
    `${baseUrl}/api/family/search_members.php?q=${encodeURIComponent(query)}&current_member_id=${currentMemberId}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to search members: ${response.statusText}`);
  }

  const data = await response.json();
  return data.members || [];
};

export const sendFamilyInvite = async (
  inviterId: number,
  relativeId: number,
  relationshipType: string,
  notes?: string
): Promise<any> => {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/family/invite.php`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inviter_id: inviterId,
      relative_id: relativeId,
      relationship_type: relationshipType,
      notes: notes || null,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to send invitation');
  }

  return response.json();
};

export const respondToInvite = async (
  inviteId: number,
  responderId: number,
  action: 'accept' | 'decline'
): Promise<any> => {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/family/respond.php`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      invite_id: inviteId,
      responder_id: responderId,
      action,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to respond to invitation');
  }

  return response.json();
};

export const removeFamilyRelationship = async (memberId: number, relativeId: number): Promise<any> => {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/family/remove.php`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      member_id: memberId,
      relative_id: relativeId,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to remove relationship');
  }

  return response.json();
};
