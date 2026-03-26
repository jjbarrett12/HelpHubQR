import type {
  EmployeeTodayAnnouncement,
  EmployeeTodayBundle,
  EmployeeTodayBundleSuccess,
  EmployeeTodayChecklist,
  EmployeeTodayErrorCode,
  EmployeeTodayFocus,
  EmployeeTodayNextIncomplete,
  EmployeeTodayProgress,
  EmployeeTodayRunItem,
  EmployeeTodayRunSummary,
  EmployeeTodaySection,
  EmployeeTodayShift,
  EmployeeTodayShiftNotes,
  EmployeeTodaySourceMeta,
} from "./types";

/** Raw JSON from `hh_employee_today_bundle` (snake_case keys). */
type RpcSource = {
  bundle_version?: number;
  rpc?: string;
  computed_at?: string;
  organization_id?: string;
  employee_id?: string;
  time_zone?: string;
  calendar_date?: string;
  focus_employee_shift_id?: string | null;
  focus_run_id?: string | null;
};

type RpcItem = {
  id: string;
  item_kind?: string;
  checklist_item_id: string | null;
  sort_order: number;
  section_title: string | null;
  title: string;
  is_completed: boolean;
  completed_at: string | null;
  requires_photo: boolean;
  has_proof: boolean;
  notes: string | null;
  is_suppressed: boolean;
  is_blocked: boolean;
  assignment_status: string;
};

type RpcSection = {
  section_key: string;
  section_title: string;
  section_sort: number;
  items: RpcItem[];
};

type RpcChecklist = {
  run_id: string | null;
  template_name: string | null;
  progress: { completed: number; total: number; ratio: number };
  sections: RpcSection[];
  items_flat: RpcItem[];
  next_incomplete_task_id: string | null;
  next_incomplete_override_task_id?: string | null;
  next_incomplete?: { kind: string; id: string } | null;
  no_run_reason: string | null;
};

type RpcPayload = {
  ok: boolean;
  error?: string | null;
  source?: RpcSource;
  employee?: {
    id: string;
    organization_id: string;
    first_name: string;
    full_name: string;
    location_id: string | null;
  };
  focus?: {
    kind: string;
    is_active_now: boolean;
    shift: Record<string, unknown> | null;
    run: Record<string, unknown> | null;
  };
  checklist?: RpcChecklist;
  announcements?: {
    items: unknown[];
    source: string;
    todo: string | null;
  };
  shift_notes?: {
    items: unknown[];
    source: string;
    todo: string | null;
  };
};

function mapSource(s: RpcSource | undefined, orgIdFallback: string): EmployeeTodaySourceMeta {
  return {
    bundleVersion: s?.bundle_version ?? 1,
    rpc: s?.rpc ?? "hh_employee_today_bundle",
    computedAt: s?.computed_at,
    organizationId: s?.organization_id ?? orgIdFallback,
    employeeId: s?.employee_id,
    timeZone: s?.time_zone ?? "America/Denver",
    calendarDate: String(s?.calendar_date ?? ""),
    focusEmployeeShiftId: s?.focus_employee_shift_id ?? null,
    focusRunId: s?.focus_run_id ?? null,
  };
}

function mapNextIncomplete(raw: unknown): EmployeeTodayNextIncomplete | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const k = o.kind;
  const id = o.id;
  if ((k !== "run_item" && k !== "override") || id == null) return null;
  return { kind: k, id: String(id) };
}

function mapItem(r: RpcItem): EmployeeTodayRunItem {
  const itemKind: EmployeeTodayRunItem["itemKind"] = r.item_kind === "override" ? "override" : "run_item";
  return {
    id: r.id,
    itemKind,
    checklistItemId: r.checklist_item_id != null ? String(r.checklist_item_id) : null,
    sortOrder: r.sort_order,
    sectionTitle: r.section_title,
    title: r.title,
    isCompleted: r.is_completed,
    completedAt: r.completed_at,
    requiresPhoto: r.requires_photo,
    hasProof: r.has_proof,
    notes: r.notes,
    isSuppressed: r.is_suppressed,
    isBlocked: r.is_blocked,
    assignmentStatus: r.assignment_status,
  };
}

function mapSection(sec: RpcSection): EmployeeTodaySection {
  return {
    sectionKey: sec.section_key,
    sectionTitle: sec.section_title,
    sectionSort: sec.section_sort,
    items: (sec.items ?? []).map(mapItem),
  };
}

function mapProgress(p: RpcChecklist["progress"]): EmployeeTodayProgress {
  return {
    completed: p.completed,
    total: p.total,
    ratio: typeof p.ratio === "number" ? p.ratio : Number(p.ratio),
  };
}

function mapShift(s: Record<string, unknown> | null | undefined): EmployeeTodayShift | null {
  if (!s || typeof s !== "object" || !s.id) return null;
  return {
    id: String(s.id),
    shiftDate: String(s.shift_date),
    shiftType: String(s.shift_type),
    status: String(s.status),
    startsAt: s.starts_at ? String(s.starts_at) : null,
    endsAt: s.ends_at ? String(s.ends_at) : null,
    locationId: s.location_id ? String(s.location_id) : null,
    staffRoleId: String(s.staff_role_id),
    locationName: s.location_name != null ? String(s.location_name) : null,
    roleName: s.role_name != null ? String(s.role_name) : null,
  };
}

function mapAnnouncement(raw: Record<string, unknown>): EmployeeTodayAnnouncement {
  const effFrom = raw.effectiveFrom ?? raw.effective_from;
  const effTo = raw.effectiveTo ?? raw.effective_to;
  return {
    id: String(raw.id),
    title: String(raw.title),
    body: String(raw.body),
    pinned: Boolean(raw.pinned),
    category: raw.category != null ? String(raw.category) : undefined,
    read: raw.read !== undefined ? Boolean(raw.read) : undefined,
    readAt: raw.read_at != null ? String(raw.read_at) : null,
    effectiveFrom: effFrom != null ? String(effFrom) : null,
    effectiveTo: effTo != null ? String(effTo) : null,
    createdAt: raw.created_at != null ? String(raw.created_at) : null,
  };
}

function defaultShiftNotes(): EmployeeTodayShiftNotes {
  return {
    items: [],
    source: "none",
    todo: null,
  };
}

function mapShiftNotes(raw: RpcPayload["shift_notes"]): EmployeeTodayShiftNotes {
  if (!raw || typeof raw !== "object") return defaultShiftNotes();
  const items = Array.isArray(raw.items)
    ? (raw.items as unknown[]).map((it) => {
        if (!it || typeof it !== "object") return null;
        const o = it as Record<string, unknown>;
        if (o.id == null || o.title == null || o.body == null) return null;
        return {
          id: String(o.id),
          title: String(o.title),
          body: String(o.body),
          authorLabel: o.author_label != null ? String(o.author_label) : o.authorLabel != null ? String(o.authorLabel) : null,
          createdAt:
            o.created_at != null ? String(o.created_at) : o.createdAt != null ? String(o.createdAt) : null,
        };
      })
    : [];
  return {
    items: items.filter(Boolean) as EmployeeTodayShiftNotes["items"],
    source: typeof raw.source === "string" ? raw.source : "none",
    todo: raw.todo != null ? String(raw.todo) : null,
  };
}

function mapRun(r: Record<string, unknown> | null | undefined): EmployeeTodayRunSummary | null {
  if (!r || typeof r !== "object" || !r.id) return null;
  return {
    id: String(r.id),
    status: String(r.status),
    checklistId: String(r.checklist_id),
    templateName: r.template_name != null ? String(r.template_name) : null,
    startedAt: r.started_at ? String(r.started_at) : null,
    completedAt: r.completed_at ? String(r.completed_at) : null,
    sentAt: r.sent_at ? String(r.sent_at) : null,
  };
}

function mapChecklist(c: RpcChecklist | undefined): EmployeeTodayChecklist {
  if (!c) {
    return {
      runId: null,
      templateName: null,
      progress: { completed: 0, total: 0, ratio: 0 },
      sections: [],
      itemsFlat: [],
      nextIncompleteTaskId: null,
      nextIncompleteOverrideTaskId: null,
      nextIncomplete: null,
      noRunReason: "no_focus_shift",
    };
  }
  const reason = c.no_run_reason;
  const noRunReason: EmployeeTodayChecklist["noRunReason"] =
    reason === "run_not_created" || reason === "no_focus_shift" ? reason : null;
  const nextIncomplete =
    mapNextIncomplete(c.next_incomplete) ??
    (c.next_incomplete_task_id != null
      ? ({ kind: "run_item" as const, id: String(c.next_incomplete_task_id) } satisfies EmployeeTodayNextIncomplete)
      : null);
  return {
    runId: c.run_id,
    templateName: c.template_name,
    progress: mapProgress(c.progress ?? { completed: 0, total: 0, ratio: 0 }),
    sections: (c.sections ?? []).map(mapSection),
    itemsFlat: (c.items_flat ?? []).map(mapItem),
    nextIncompleteTaskId: c.next_incomplete_task_id,
    nextIncompleteOverrideTaskId:
      c.next_incomplete_override_task_id != null ? String(c.next_incomplete_override_task_id) : null,
    nextIncomplete,
    noRunReason,
  };
}

function mapFocus(f: RpcPayload["focus"]): EmployeeTodayFocus {
  if (!f) {
    return { kind: "none", isActiveNow: false, shift: null, run: null };
  }
  const kind = f.kind === "today_shift" || f.kind === "upcoming_shift" || f.kind === "none" ? f.kind : "none";
  return {
    kind,
    isActiveNow: !!f.is_active_now,
    shift: mapShift(f.shift),
    run: mapRun(f.run),
  };
}

/**
 * Maps RPC JSONB to the canonical `EmployeeTodayBundle`.
 * @param raw - `data` from supabase.rpc; pass organizationId for error payloads missing source.org.
 */
export function mapEmployeeTodayRpcToBundle(raw: unknown, organizationId: string): EmployeeTodayBundle {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "INVALID_RESPONSE", message: "Empty RPC payload" };
  }
  const p = raw as RpcPayload;
  if (!p.ok) {
    const err = (p.error as string) || "RPC_ERROR";
    const known: Record<string, true> = {
      NOT_AUTHENTICATED: true,
      NOT_ORG_MEMBER: true,
      EMPLOYEE_NOT_LINKED: true,
      NO_ORGANIZATION: true,
    };
    return {
      ok: false,
      error: known[err] ? (err as EmployeeTodayErrorCode) : "RPC_ERROR",
      source: p.source ? mapSource(p.source, organizationId) : undefined,
    };
  }
  if (!p.employee || !p.focus || !p.checklist) {
    return { ok: false, error: "INVALID_RESPONSE", message: "Missing employee, focus, or checklist" };
  }
  const emp = p.employee;
  const ann = p.announcements;
  const announcements = {
    items: Array.isArray(ann?.items)
      ? (ann!.items as unknown[]).map((it) =>
          typeof it === "object" && it !== null
            ? mapAnnouncement(it as Record<string, unknown>)
            : { id: "", title: "", body: "" }
        )
      : ([] as EmployeeTodayAnnouncement[]),
    source: ann?.source ?? "none",
    todo: ann?.todo ?? null,
  };
  const success: EmployeeTodayBundleSuccess = {
    ok: true,
    source: mapSource(p.source, organizationId),
    employee: {
      id: emp.id,
      organizationId: emp.organization_id,
      firstName: emp.first_name,
      fullName: emp.full_name,
      locationId: emp.location_id,
    },
    focus: mapFocus(p.focus),
    checklist: mapChecklist(p.checklist),
    announcements: {
      items: announcements.items,
      source: announcements.source,
      todo: announcements.todo,
    },
    shiftNotes: mapShiftNotes(p.shift_notes),
  };
  return success;
}
