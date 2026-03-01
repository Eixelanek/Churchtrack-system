export interface RecentScanRecord {
  id?: number | null;
  service_name?: string;
  checkin_datetime?: string | null;
  session_id?: number | null;
  member_contact?: string | null;
  status?: string;
}

export interface AttendanceTotals {
  total_present?: number;
  total_absent?: number;
  dates?: string[];
}

export interface MemberAttendanceSummary {
  member_id?: number | string;
  total_visits?: number;
  attendance_rate?: number;
  last_attended?: string | null;
  month_visits?: number;
  attendance_streak?: number;
  recent_scans?: RecentScanRecord[];
  attendance_records?: RecentScanRecord[];
  attendance_totals?: AttendanceTotals;
  status?: string;
  [key: string]: unknown;
}

const computeApiBaseUrl = (): string => {
  if (typeof window === 'undefined') {
    return '';
  }

  const origin = window.location.origin;
  if (origin.includes('localhost')) {
    return 'http://localhost';
  }

  return origin.replace(/\/$/, '');
};

export async function fetchMemberAttendanceSummary(memberId: string | number): Promise<MemberAttendanceSummary> {
  if (!memberId) {
    throw new Error('memberId is required');
  }

  const params = new URLSearchParams({ id: String(memberId) });
  const apiBaseUrl = computeApiBaseUrl();
  const endpoint = `${apiBaseUrl}/api/members/get_membership_details.php?${params.toString()}`;

  const response = await fetch(endpoint);

  if (!response.ok) {
    const message = `Failed to fetch attendance summary (${response.status})`;
    throw new Error(message);
  }

  const data = (await response.json()) as MemberAttendanceSummary & { error?: boolean; message?: string };

  if ((data as { error?: boolean }).error) {
    throw new Error(data.message || 'Attendance summary API returned an error');
  }

  return data;
}

export interface MonthlyAttendanceData {
  month: string;
  year_month: string;
  count: number;
}

export async function fetchMonthlyAttendance(memberId: string | number): Promise<MonthlyAttendanceData[]> {
  if (!memberId) {
    throw new Error('memberId is required');
  }

  const apiBaseUrl = computeApiBaseUrl();
  const endpoint = `${apiBaseUrl}/api/members/get_monthly_attendance.php?member_id=${memberId}`;

  const response = await fetch(endpoint);

  if (!response.ok) {
    const message = `Failed to fetch monthly attendance (${response.status})`;
    throw new Error(message);
  }

  const result = (await response.json()) as { success: boolean; data: MonthlyAttendanceData[]; error?: boolean; message?: string };

  if (result.error) {
    throw new Error(result.message || 'Monthly attendance API returned an error');
  }

  return result.data || [];
}
