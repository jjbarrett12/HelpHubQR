export type OrgMemberRole = "owner" | "manager" | "admin";

export type ShiftType = "open" | "mid" | "close" | "custom";

export type EmployeeShiftStatus = "scheduled" | "sent" | "in_progress" | "completed" | "missed";

export type ShiftChecklistRunStatus = "pending" | "sent" | "opened" | "completed" | "expired";

export type Organization = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export type OrganizationMember = {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgMemberRole;
  is_active: boolean;
  created_at: string;
};

export type Location = {
  id: string;
  organization_id: string;
  name: string;
  address: string | null;
  created_at: string;
  updated_at: string;
};

export type StaffRole = {
  id: string;
  organization_id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export type Employee = {
  id: string;
  organization_id: string;
  location_id: string | null;
  full_name: string;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type EmployeeRoleAssignment = {
  id: string;
  organization_id: string;
  employee_id: string;
  staff_role_id: string;
  is_primary: boolean;
  created_at: string;
};

export type Checklist = {
  id: string;
  organization_id: string;
  location_id: string | null;
  staff_role_id: string;
  shift_type: ShiftType;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ChecklistItem = {
  id: string;
  checklist_id: string;
  task_text: string;
  /** Explicit semantic key; null means derive from task_text when snapshotting runs. */
  task_key?: string | null;
  sort_order: number;
  requires_photo: boolean;
  created_at: string;
  updated_at: string;
};

export type EmployeeShift = {
  id: string;
  organization_id: string;
  location_id: string | null;
  employee_id: string;
  staff_role_id: string;
  shift_date: string;
  shift_type: ShiftType;
  starts_at: string | null;
  ends_at: string | null;
  status: EmployeeShiftStatus;
  created_at: string;
  updated_at: string;
};

export type ShiftChecklistRun = {
  id: string;
  organization_id: string;
  employee_shift_id: string;
  checklist_id: string;
  access_token: string;
  sent_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  status: ShiftChecklistRunStatus;
  created_at: string;
  updated_at: string;
};

export type ShiftChecklistRunItem = {
  id: string;
  shift_checklist_run_id: string;
  checklist_item_id: string;
  completed: boolean;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type PublicChecklistItemKind = "template" | "override";

export type PublicChecklistPayload = {
  runId: string;
  employeeName: string;
  checklistTitle: string;
  runStatus: ShiftChecklistRunStatus;
  items: Array<{
    id: string;
    kind: PublicChecklistItemKind;
    /** When kind === "override", database id of shift_run_override_tasks */
    overrideTaskId?: string;
    taskText: string;
    requiresPhoto: boolean;
    completed: boolean;
    sortOrder: number;
  }>;
};
