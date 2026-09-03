"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";

type FieldId =
  | "taxYear"
  | "fullName"
  | "dateOfBirth"
  | "province"
  | "maritalStatus"
  | "dependants"
  | "spouseNetIncome"
  | "employmentIncome"
  | "incomeTaxDeducted"
  | "otherIncome"
  | "rrspDeduction"
  | "unionDues"
  | "medicalExpenses"
  | "charitableDonations"
  | "notes";

type FieldKind =
  | "currency"
  | "integer"
  | "select"
  | "text"
  | "date"
  | "textarea";
type FieldValue = number | string | null;
type UpdateSource = "agent" | "human";

type FieldChange = {
  from: FieldValue;
  to: FieldValue;
};

type AgentUpdateDetails = {
  reason: string | null;
  sourceSnippet: string | null;
  needsConfirmation: boolean;
};

type FieldState = {
  currentValue: FieldValue;
  previousValue: FieldValue;
  latestSource: UpdateSource | null;
  pendingAgentReview: boolean;
  acceptedAgentChange: boolean;
  agentReviewKind: "filled" | "replaced" | null;
  lastAgentChange: FieldChange | null;
  agentReason: string | null;
  agentSourceSnippet: string | null;
  agentNeedsConfirmation: boolean;
};

type ActivityLogEntry = {
  id: number;
  time: string;
  source: UpdateSource | "system";
  title: string;
  detail: string;
  status: string;
};

type ToastState = {
  id: number;
  kind: "agent" | "success";
  eyebrow: string;
  title: string;
  detail: string;
  status: string;
};

type ValidationState = Partial<Record<FieldId, string>>;

type AiAssistState = {
  availability: "ready" | "unavailable";
  isWorking: boolean;
  currentPassTouched: number;
  currentPassChanged: number;
  currentPassNeedsConfirmation: number;
  lastPassTouched: number;
  lastPassChanged: number;
  lastPassNeedsConfirmation: number;
  lastError: string | null;
};

type FieldDefinition = {
  id: FieldId;
  label: string;
  section: "About You" | "Income" | "Deductions" | "Credits" | "Notes";
  kind: FieldKind;
  line?: string;
  source: string;
  toolName: string;
  toolInputName: string;
  toolDescription: string;
  options?: string[];
  required?: boolean;
};

const fieldDefinitions: FieldDefinition[] = [
  {
    id: "taxYear",
    label: "Tax year",
    section: "About You",
    kind: "select",
    source: "filing context",
    toolName: "set_tax_year",
    toolInputName: "taxYear",
    toolDescription:
      "Set the tax year for this simplified T1 intake.",
    options: ["2025", "2024", "2023"],
    required: true,
  },
  {
    id: "fullName",
    label: "Taxpayer full name",
    section: "About You",
    kind: "text",
    source: "taxpayer identification",
    toolName: "set_full_name",
    toolInputName: "fullName",
    toolDescription:
      "Set the taxpayer full legal name for this simplified T1 intake.",
    required: true,
  },
  {
    id: "dateOfBirth",
    label: "Date of birth",
    section: "About You",
    kind: "date",
    source: "taxpayer identification",
    toolName: "set_date_of_birth",
    toolInputName: "dateOfBirth",
    toolDescription:
      "Set the taxpayer date of birth for this simplified T1 intake.",
    required: true,
  },
  {
    id: "province",
    label: "Province or territory of residence",
    section: "About You",
    kind: "select",
    source: "T1 identification",
    toolName: "set_province",
    toolInputName: "province",
    toolDescription:
      "Set the taxpayer province or territory of residence for the simplified T1 intake.",
    options: ["Ontario", "British Columbia", "Alberta", "Quebec", "Other"],
    required: true,
  },
  {
    id: "maritalStatus",
    label: "Marital status",
    section: "About You",
    kind: "select",
    source: "T1 identification",
    toolName: "set_marital_status",
    toolInputName: "status",
    toolDescription: "Set marital status for the simplified T1 intake.",
    options: ["Single", "Married", "Common-law", "Separated", "Widowed"],
    required: true,
  },
  {
    id: "dependants",
    label: "Dependants under 18",
    section: "About You",
    kind: "integer",
    source: "family information",
    toolName: "set_dependants",
    toolInputName: "count",
    toolDescription:
      "Set the number of dependants under 18 for the simplified T1 intake.",
  },
  {
    id: "spouseNetIncome",
    label: "Spouse or common-law net income",
    section: "Income",
    kind: "currency",
    line: "23600",
    source: "spouse tax summary",
    toolName: "set_spouse_net_income",
    toolInputName: "amount",
    toolDescription:
      "Set spouse or common-law partner net income for this simplified T1 intake when applicable.",
  },
  {
    id: "employmentIncome",
    label: "Employment income",
    section: "Income",
    kind: "currency",
    line: "10100",
    source: "T4 Box 14",
    toolName: "set_employment_income",
    toolInputName: "amount",
    toolDescription:
      "Set employment income for T1 line 10100, usually sourced from T4 Box 14.",
    required: true,
  },
  {
    id: "incomeTaxDeducted",
    label: "Income tax deducted",
    section: "Income",
    kind: "currency",
    line: "43700",
    source: "T4 Box 22",
    toolName: "set_income_tax_deducted",
    toolInputName: "amount",
    toolDescription:
      "Set total income tax deducted for T1 line 43700, usually sourced from T4 Box 22.",
    required: true,
  },
  {
    id: "otherIncome",
    label: "Other income",
    section: "Income",
    kind: "currency",
    source: "other slips or notes",
    toolName: "set_other_income",
    toolInputName: "amount",
    toolDescription:
      "Set other income not covered by employment income in this simplified T1 intake.",
  },
  {
    id: "rrspDeduction",
    label: "RRSP deduction",
    section: "Deductions",
    kind: "currency",
    line: "20800",
    source: "RRSP contribution receipt",
    toolName: "set_rrsp_deduction",
    toolInputName: "amount",
    toolDescription: "Set the RRSP deduction claim for T1 line 20800.",
  },
  {
    id: "unionDues",
    label: "Union or professional dues",
    section: "Deductions",
    kind: "currency",
    line: "21200",
    source: "T4 Box 44 or receipt",
    toolName: "set_union_dues",
    toolInputName: "amount",
    toolDescription:
      "Set annual union, professional, or like dues for T1 line 21200.",
  },
  {
    id: "medicalExpenses",
    label: "Medical expenses",
    section: "Credits",
    kind: "currency",
    line: "33099",
    source: "medical receipts",
    toolName: "set_medical_expenses",
    toolInputName: "amount",
    toolDescription:
      "Set eligible medical expenses for T1 line 33099 in this simplified intake.",
  },
  {
    id: "charitableDonations",
    label: "Donations and gifts",
    section: "Credits",
    kind: "currency",
    line: "34900",
    source: "donation receipts",
    toolName: "set_charitable_donations",
    toolInputName: "amount",
    toolDescription: "Set donations and gifts for T1 line 34900.",
  },
  {
    id: "notes",
    label: "Notes or clarifications",
    section: "Notes",
    kind: "textarea",
    source: "taxpayer notes",
    toolName: "set_notes",
    toolInputName: "notes",
    toolDescription:
      "Set additional notes or clarifications for the simplified T1 intake.",
  },
];

const groupedFieldDefinitions = fieldDefinitions.reduce(
  (groups, field) => {
    groups[field.section].push(field);
    return groups;
  },
  {
    "About You": [],
    Income: [],
    Deductions: [],
    Credits: [],
    Notes: [],
  } as Record<FieldDefinition["section"], FieldDefinition[]>,
);

const quickInstruction =
  "Use your AI assistant to update the form through Slip2Form, then review the highlighted changes before submitting.";

const activityLogLimit = 100;
const manualActivityLogDebounceMs = 700;
const toastDismissMs = 4500;
const toastFadeDurationMs = 250;
const slip2FormSessionStorageKey = "slip2form-session-state";
const agentPassIdleMs = 1600;
const ignoredAgentTextValues = new Set([
  "example_string",
  "example text",
  "string",
]);

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

const sanitizeAgentText = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  return ignoredAgentTextValues.has(normalized.toLowerCase()) ? null : normalized;
};

const getAgentUpdateDetails = (
  options: {
    agentReason?: unknown;
    agentSourceSnippet?: unknown;
    needsConfirmation?: unknown;
  },
  previousFieldState?: FieldState,
): AgentUpdateDetails => ({
  reason:
    sanitizeAgentText(options.agentReason) ?? previousFieldState?.agentReason ?? null,
  sourceSnippet:
    sanitizeAgentText(options.agentSourceSnippet) ??
    previousFieldState?.agentSourceSnippet ??
    null,
  needsConfirmation:
    typeof options.needsConfirmation === "boolean"
      ? options.needsConfirmation
      : previousFieldState?.agentNeedsConfirmation ?? false,
});

const getFieldStatusLabel = (fieldState: FieldState) => {
  if (fieldState.pendingAgentReview) {
    return fieldState.agentNeedsConfirmation
      ? "Needs confirmation"
      : "Pending AI review";
  }

  if (fieldState.acceptedAgentChange) {
    return "Accepted AI change";
  }

  if (fieldState.latestSource === "human") {
    return "Manual change";
  }

  return "Ready";
};

const isFieldRequired = (
  field: FieldDefinition,
  fieldStates: Record<FieldId, FieldState>,
) => {
  if (field.id === "spouseNetIncome") {
    const maritalStatus = fieldStates.maritalStatus.currentValue;
    return maritalStatus === "Married" || maritalStatus === "Common-law";
  }

  return field.required ?? false;
};

const parseStoredSessionState = (value: string | null) => {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as {
      taxFields: Record<FieldId, FieldState>;
      activityLog: ActivityLogEntry[];
      lastUpdate: string;
      activityLogId: number;
      showFlaggedOnly?: boolean;
    };
  } catch {
    return null;
  }
};

const createEmptyFieldState = (): FieldState => ({
  currentValue: null,
  previousValue: null,
  latestSource: null,
  pendingAgentReview: false,
  acceptedAgentChange: false,
  agentReviewKind: null,
  lastAgentChange: null,
  agentReason: null,
  agentSourceSnippet: null,
  agentNeedsConfirmation: false,
});

const createInitialFormState = () =>
  Object.fromEntries(
    fieldDefinitions.map((field) => [field.id, createEmptyFieldState()]),
  ) as Record<FieldId, FieldState>;

const createInitialAiAssistState = (
  availability: AiAssistState["availability"] = "ready",
): AiAssistState => ({
  availability,
  isWorking: false,
  currentPassTouched: 0,
  currentPassChanged: 0,
  currentPassNeedsConfirmation: 0,
  lastPassTouched: 0,
  lastPassChanged: 0,
  lastPassNeedsConfirmation: 0,
  lastError: null,
});

const normalizeValue = (field: FieldDefinition, rawValue: unknown) => {
  if (rawValue === null || rawValue === "") {
    return null;
  }

  if (field.kind === "select") {
    if (typeof rawValue !== "string") {
      return null;
    }

    const normalized = rawValue.trim();
    if (!normalized) {
      return null;
    }

    const match = field.options?.find(
      (option) => option.toLowerCase() === normalized.toLowerCase(),
    );

    return match ?? normalized;
  }

  if (
    field.kind === "text" ||
    field.kind === "date" ||
    field.kind === "textarea"
  ) {
    if (typeof rawValue !== "string") {
      return null;
    }

    const normalized = rawValue.trim();
    return normalized ? normalized : null;
  }

  const numberValue =
    typeof rawValue === "number" ? rawValue : Number(rawValue);

  if (!Number.isFinite(numberValue)) {
    return null;
  }

  if (field.kind === "integer") {
    return Math.max(0, Math.trunc(numberValue));
  }

  return Object.is(numberValue, -0) ? 0 : numberValue;
};

const formatFieldValue = (field: FieldDefinition, value: FieldValue) => {
  if (value === null) {
    return "Not entered";
  }

  if (field.kind === "currency" && typeof value === "number") {
    return formatCurrency(value);
  }

  return String(value);
};

const formatLogTime = () =>
  new Intl.DateTimeFormat("en-CA", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date());

const getTodayDateStamp = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const isValidDateValue = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const parsedDate = new Date(year, month - 1, day);

  return (
    parsedDate.getFullYear() === year &&
    parsedDate.getMonth() === month - 1 &&
    parsedDate.getDate() === day
  );
};

const getFieldValidationMessage = (
  field: FieldDefinition,
  fieldState: FieldState,
  fieldStates: Record<FieldId, FieldState>,
) => {
  const value = fieldState.currentValue;

  if (value === null) {
    return null;
  }

  if (field.kind === "select") {
    if (typeof value !== "string" || !field.options?.includes(value)) {
      return "Select one of the listed options.";
    }

    return null;
  }

  if (field.kind === "date") {
    if (typeof value !== "string" || !isValidDateValue(value)) {
      return "Enter a valid date.";
    }

    if (value > getTodayDateStamp()) {
      return "Date cannot be in the future.";
    }

    return null;
  }

  if (field.kind === "currency" || field.kind === "integer") {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return "Enter a valid number.";
    }

    if (value < 0) {
      return field.kind === "currency"
        ? "Amount must be zero or more."
        : "Value must be zero or more.";
    }
  }

  return null;
};

const isFieldFlagged = (
  field: FieldDefinition,
  fieldState: FieldState,
  fieldStates: Record<FieldId, FieldState>,
  validationMessage: string | null | undefined,
) =>
  fieldState.pendingAgentReview ||
  Boolean(validationMessage) ||
  (isFieldRequired(field, fieldStates) && fieldState.currentValue === null);

const getFieldById = (fieldId: FieldId) =>
  fieldDefinitions.find((field) => field.id === fieldId);

export default function Home() {
  const [taxFields, setTaxFields] = useState(createInitialFormState);
  const [lastUpdate, setLastUpdate] = useState("Waiting for Slip2Form AI tool call");
  const [liveMessage, setLiveMessage] = useState("");
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [focusedFieldId, setFocusedFieldId] = useState<FieldId | null>(null);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);
  const [manualTextDrafts, setManualTextDrafts] = useState<
    Partial<Record<FieldId, string>>
  >({});
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isToastVisible, setIsToastVisible] = useState(false);
  const [aiAssistState, setAiAssistState] = useState<AiAssistState>(
    createInitialAiAssistState(),
  );
  const taxFieldsRef = useRef(taxFields);
  const activityLogIdRef = useRef(0);
  const manualTextDraftsRef = useRef<Partial<Record<FieldId, string>>>({});
  const manualFocusSnapshotRef = useRef<Partial<Record<FieldId, string>>>({});
  const pendingManualTextUpdateTimeoutsRef = useRef<
    Partial<Record<FieldId, ReturnType<typeof setTimeout>>>
  >({});
  const agentPassIdleTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const storedState = parseStoredSessionState(
      window.sessionStorage.getItem(slip2FormSessionStorageKey) ??
        window.sessionStorage.getItem("formpilot-session-state"),
    );

    if (storedState) {
      taxFieldsRef.current = storedState.taxFields;
      activityLogIdRef.current = storedState.activityLogId;
      setTaxFields(storedState.taxFields);
      setActivityLog(storedState.activityLog);
      setLastUpdate(storedState.lastUpdate);
      setShowFlaggedOnly(storedState.showFlaggedOnly ?? false);
    }

    setIsSessionReady(true);
  }, []);

  useEffect(() => {
    const { body, documentElement } = document;
    const previousBodyOverflow = body.style.overflow;
    const previousHtmlOverflow = documentElement.style.overflow;

    if (isPreviewOpen) {
      body.style.overflow = "hidden";
      documentElement.style.overflow = "hidden";
    }

    return () => {
      body.style.overflow = previousBodyOverflow;
      documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [isPreviewOpen]);

  useEffect(() => {
    return () => {
      Object.values(pendingManualTextUpdateTimeoutsRef.current).forEach(
        (timeoutId) => {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
        },
      );

      if (agentPassIdleTimeoutRef.current !== null) {
        window.clearTimeout(agentPassIdleTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isSessionReady) {
      return;
    }

    window.sessionStorage.setItem(
      slip2FormSessionStorageKey,
      JSON.stringify({
        taxFields,
        activityLog,
        lastUpdate,
        activityLogId: activityLogIdRef.current,
        showFlaggedOnly,
      }),
    );
  }, [activityLog, isSessionReady, lastUpdate, showFlaggedOnly, taxFields]);

  useEffect(() => {
    if (!toast) {
      setIsToastVisible(false);
      return;
    }

    setIsToastVisible(false);

    const showTimeoutId = window.setTimeout(() => {
      setIsToastVisible(true);
    }, 10);

    const hideTimeoutId = window.setTimeout(() => {
      setIsToastVisible(false);
    }, Math.max(toastDismissMs - toastFadeDurationMs, toastFadeDurationMs));

    const removeTimeoutId = window.setTimeout(() => {
      setToast((currentToast) =>
        currentToast?.id === toast.id ? null : currentToast,
      );
    }, toastDismissMs);

    return () => {
      window.clearTimeout(showTimeoutId);
      window.clearTimeout(hideTimeoutId);
      window.clearTimeout(removeTimeoutId);
    };
  }, [toast]);

  const addActivityLogEntry = useCallback(
    (entry: Omit<ActivityLogEntry, "id" | "time">) => {
      activityLogIdRef.current += 1;
      const nextEntry = {
        id: activityLogIdRef.current,
        ...entry,
        time: formatLogTime(),
      };

      setActivityLog((currentLog) =>
        [nextEntry, ...currentLog].slice(0, activityLogLimit),
      );

      if (entry.source === "agent") {
        setToast({
          id: nextEntry.id,
          kind: "agent",
          eyebrow: "Latest AI change",
          title: nextEntry.title,
          detail: nextEntry.detail,
          status: nextEntry.status,
        });
      }
    },
    [],
  );

  const clearPendingManualTextUpdate = useCallback((fieldId: FieldId) => {
    const timeoutId = pendingManualTextUpdateTimeoutsRef.current[fieldId];

    if (timeoutId) {
      clearTimeout(timeoutId);
      delete pendingManualTextUpdateTimeoutsRef.current[fieldId];
    }
  }, []);

  const finalizeAgentPass = useCallback(() => {
    setAiAssistState((currentState) => {
      if (!currentState.isWorking) {
        return currentState;
      }

      return {
        ...currentState,
        isWorking: false,
        lastPassTouched: currentState.currentPassTouched,
        lastPassChanged: currentState.currentPassChanged,
        lastPassNeedsConfirmation: currentState.currentPassNeedsConfirmation,
        currentPassTouched: 0,
        currentPassChanged: 0,
        currentPassNeedsConfirmation: 0,
      };
    });
  }, []);

  const scheduleAgentPassFinalization = useCallback(() => {
    if (agentPassIdleTimeoutRef.current !== null) {
      window.clearTimeout(agentPassIdleTimeoutRef.current);
    }

    agentPassIdleTimeoutRef.current = window.setTimeout(() => {
      agentPassIdleTimeoutRef.current = null;
      finalizeAgentPass();
    }, agentPassIdleMs);
  }, [finalizeAgentPass]);

  const recordAgentActivity = useCallback(
    ({
      changed,
      needsConfirmation,
      error,
    }: {
      changed: boolean;
      needsConfirmation: boolean;
      error?: string | null;
    }) => {
      setAiAssistState((currentState) => ({
        ...currentState,
        availability: "ready",
        isWorking: true,
        currentPassTouched: currentState.isWorking
          ? currentState.currentPassTouched + 1
          : 1,
        currentPassChanged: currentState.isWorking
          ? currentState.currentPassChanged + (changed ? 1 : 0)
          : changed
            ? 1
            : 0,
        currentPassNeedsConfirmation: currentState.isWorking
          ? currentState.currentPassNeedsConfirmation +
            (needsConfirmation ? 1 : 0)
          : needsConfirmation
            ? 1
            : 0,
        lastError: error ?? null,
      }));
      scheduleAgentPassFinalization();
    },
    [scheduleAgentPassFinalization],
  );

  const clearFormState = useCallback(
    ({
      clearToast = true,
      lastUpdateMessage,
      liveMessageText,
    }: {
      clearToast?: boolean;
      lastUpdateMessage: string;
      liveMessageText: string;
    }) => {
      const emptyFormState = createInitialFormState();

      Object.keys(pendingManualTextUpdateTimeoutsRef.current).forEach((fieldId) => {
        clearPendingManualTextUpdate(fieldId as FieldId);
      });

      taxFieldsRef.current = emptyFormState;
      activityLogIdRef.current = 0;
      manualTextDraftsRef.current = {};
      manualFocusSnapshotRef.current = {};
      setTaxFields(emptyFormState);
      setActivityLog([]);
      setIsPreviewOpen(false);
      setShowFlaggedOnly(false);
      setManualTextDrafts({});
      setAiAssistState((currentState) =>
        createInitialAiAssistState(currentState.availability),
      );
      if (clearToast) {
        setToast(null);
      }
      setLastUpdate(lastUpdateMessage);
      setLiveMessage(liveMessageText);
      window.sessionStorage.removeItem(slip2FormSessionStorageKey);
    },
    [clearPendingManualTextUpdate],
  );

  const setManualTextDraft = useCallback((fieldId: FieldId, value: string) => {
    manualTextDraftsRef.current = {
      ...manualTextDraftsRef.current,
      [fieldId]: value,
    };
    setManualTextDrafts((currentDrafts) => ({
      ...currentDrafts,
      [fieldId]: value,
    }));
  }, []);

  const clearManualTextDraft = useCallback((fieldId: FieldId) => {
    const nextDrafts = { ...manualTextDraftsRef.current };
    delete nextDrafts[fieldId];
    manualTextDraftsRef.current = nextDrafts;
    setManualTextDrafts(nextDrafts);
  }, []);

  const commitManualActivityLog = useCallback(
    (fieldId: FieldId) => {
      const field = getFieldById(fieldId);
      const fieldState = taxFieldsRef.current[fieldId];
      const snapshot = manualFocusSnapshotRef.current[fieldId];

      delete manualFocusSnapshotRef.current[fieldId];

      if (
        !field ||
        fieldState.latestSource !== "human" ||
        snapshot === JSON.stringify(fieldState.currentValue)
      ) {
        return;
      }

      addActivityLogEntry({
        source: "human",
        title: `You edited ${field.label}`,
        detail: `New value: ${formatFieldValue(field, fieldState.currentValue)}.`,
        status: "Review cleared",
      });
    },
    [addActivityLogEntry],
  );

  const updateTaxField = useCallback(
    (
      fieldId: FieldId,
      rawValue: unknown,
      source: UpdateSource,
      options: {
        suppressActivity?: boolean;
        agentReason?: unknown;
        agentSourceSnippet?: unknown;
        needsConfirmation?: unknown;
      } = {},
    ) => {
      const field = getFieldById(fieldId);

      if (!field) {
        return {
          success: false,
          error: "Unknown field",
        };
      }

      const previousFormState = taxFieldsRef.current;
      const previousFieldState = previousFormState[fieldId];
      const previousValue = previousFieldState.currentValue;
      const normalizedValue = normalizeValue(field, rawValue);
      const agentDetails =
        source === "agent"
          ? getAgentUpdateDetails(options, previousFieldState)
          : null;

      if (source === "agent") {
        clearPendingManualTextUpdate(fieldId);
        clearManualTextDraft(fieldId);
        delete manualFocusSnapshotRef.current[fieldId];
      }

      if (source === "agent" && normalizedValue === null) {
        const message = `AI could not set ${field.label}: value is invalid.`;
        recordAgentActivity({
          changed: false,
          needsConfirmation: false,
          error: `AI sent an invalid value for ${field.label}.`,
        });
        setLastUpdate(message);
        setLiveMessage(message);
        addActivityLogEntry({
          source: "agent",
          title: `AI could not update ${field.label}`,
          detail: "The value did not match this field.",
          status: "No change",
        });
        return {
          success: false,
          error: "Value is invalid",
        };
      }

      if (source === "agent" && normalizedValue === previousValue) {
        const nextFieldState: FieldState = {
          ...previousFieldState,
          previousValue,
          latestSource: "agent",
          pendingAgentReview: false,
          acceptedAgentChange: previousFieldState.acceptedAgentChange,
          agentReviewKind: null,
          lastAgentChange: null,
          agentReason: agentDetails?.reason ?? previousFieldState.agentReason,
          agentSourceSnippet:
            agentDetails?.sourceSnippet ?? previousFieldState.agentSourceSnippet,
          agentNeedsConfirmation:
            agentDetails?.needsConfirmation ??
            previousFieldState.agentNeedsConfirmation,
        };
        const nextFormState = {
          ...previousFormState,
          [fieldId]: nextFieldState,
        };
        const message = `AI confirmed ${field.label} is ${formatFieldValue(field, normalizedValue)}.`;

        taxFieldsRef.current = nextFormState;
        setTaxFields(nextFormState);
        recordAgentActivity({
          changed: false,
          needsConfirmation: agentDetails?.needsConfirmation ?? false,
        });
        setLastUpdate(message);
        setLiveMessage("");
        addActivityLogEntry({
          source: "agent",
          title: `AI checked ${field.label}`,
          detail: `${formatFieldValue(field, normalizedValue)} already matched the form.`,
          status: agentDetails?.needsConfirmation
            ? "Needs confirmation"
            : "No review needed",
        });

        return {
          success: true,
          value: normalizedValue,
          changed: false,
        };
      }

      const agentChange =
        source === "agent"
          ? {
              from: previousValue,
              to: normalizedValue,
            }
          : null;

      const nextFieldState: FieldState = {
        currentValue: normalizedValue,
        previousValue,
        latestSource: source,
        pendingAgentReview: source === "agent",
        acceptedAgentChange: false,
        agentReviewKind:
          source === "agent"
            ? previousValue === null
              ? "filled"
              : "replaced"
            : null,
        lastAgentChange: agentChange,
        agentReason: source === "agent" ? agentDetails?.reason ?? null : null,
        agentSourceSnippet:
          source === "agent" ? agentDetails?.sourceSnippet ?? null : null,
        agentNeedsConfirmation:
          source === "agent" ? agentDetails?.needsConfirmation ?? false : false,
      };
      const nextFormState = {
        ...previousFormState,
        [fieldId]: nextFieldState,
      };

      taxFieldsRef.current = nextFormState;
      setTaxFields(nextFormState);

      if (source === "agent") {
        recordAgentActivity({
          changed: true,
          needsConfirmation: agentDetails?.needsConfirmation ?? false,
        });
        const message =
          previousValue === null
            ? `AI filled ${field.label} with ${formatFieldValue(field, normalizedValue)}.`
            : `AI changed ${field.label} from ${formatFieldValue(field, previousValue)} to ${formatFieldValue(field, normalizedValue)}.`;

        setLastUpdate(message);
        setLiveMessage(message);
        addActivityLogEntry({
          source: "agent",
          title:
            previousValue === null
              ? `AI filled ${field.label}`
              : `AI changed ${field.label}`,
          detail:
            previousValue === null
              ? `${field.source}: ${formatFieldValue(field, normalizedValue)}`
              : `${formatFieldValue(field, previousValue)} -> ${formatFieldValue(field, normalizedValue)} from ${field.source}`,
          status: agentDetails?.needsConfirmation
            ? "Needs confirmation"
            : "Needs review",
        });

        return {
          success: true,
          value: normalizedValue,
          changed: true,
        };
      }

      setLastUpdate(`Edited by you: ${field.label}.`);
      setLiveMessage("");

      return {
        success: true,
        value: normalizedValue,
        changed: true,
      };
    },
    [
      addActivityLogEntry,
      clearManualTextDraft,
      clearPendingManualTextUpdate,
      recordAgentActivity,
    ],
  );

  const flushManualTextFieldUpdate = useCallback(
    (fieldId: FieldId) => {
      clearPendingManualTextUpdate(fieldId);

      const field = getFieldById(fieldId);
      if (!field || (field.kind !== "text" && field.kind !== "textarea")) {
        return;
      }

      const draftValue = manualTextDraftsRef.current[fieldId];
      if (draftValue === undefined) {
        return;
      }

      updateTaxField(fieldId, draftValue, "human", {
        suppressActivity: true,
      });
      clearManualTextDraft(fieldId);
    },
    [
      clearManualTextDraft,
      clearPendingManualTextUpdate,
      updateTaxField,
    ],
  );

  const scheduleManualTextFieldUpdate = useCallback(
    (fieldId: FieldId) => {
      clearPendingManualTextUpdate(fieldId);

      pendingManualTextUpdateTimeoutsRef.current[fieldId] = setTimeout(() => {
        flushManualTextFieldUpdate(fieldId);
      }, manualActivityLogDebounceMs);
    },
    [clearPendingManualTextUpdate, flushManualTextFieldUpdate],
  );

  const handleFieldFocus = (field: FieldDefinition) => () => {
    if (field.kind === "currency" || field.kind === "integer") {
      setFocusedFieldId(field.id);
    }

    manualFocusSnapshotRef.current[field.id] = JSON.stringify(
      taxFieldsRef.current[field.id].currentValue,
    );
  };

  const handleFieldChange =
    (field: FieldDefinition) =>
    (
      event: ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) => {
      const rawValue =
        field.kind === "currency" || field.kind === "integer"
          ? event.target.value === ""
            ? null
            : Number(event.target.value)
          : event.target.value;

      if (field.kind === "text" || field.kind === "textarea") {
        setManualTextDraft(field.id, String(rawValue ?? ""));
        scheduleManualTextFieldUpdate(field.id);
        return;
      }

      updateTaxField(field.id, rawValue, "human", {
        suppressActivity: true,
      });
    };

  const handleFieldBlur = (field: FieldDefinition) => () => {
    setFocusedFieldId((currentFieldId) =>
      currentFieldId === field.id ? null : currentFieldId,
    );

    if (field.kind === "text" || field.kind === "textarea") {
      flushManualTextFieldUpdate(field.id);
    }

    commitManualActivityLog(field.id);
  };

  const undoAgentChange = (field: FieldDefinition) => {
    const agentChange = taxFields[field.id].lastAgentChange;

    if (!agentChange) {
      return;
    }

    updateTaxField(field.id, agentChange.from, "human", {
      suppressActivity: true,
    });
    setLastUpdate(
      `Undid AI change: ${field.label} restored to ${formatFieldValue(field, agentChange.from)}.`,
    );
    addActivityLogEntry({
      source: "human",
      title: `You undid AI change: ${field.label}`,
      detail: `Restored to ${formatFieldValue(field, agentChange.from)}.`,
      status: "Review cleared",
    });
  };

  const acceptAgentChange = (field: FieldDefinition) => {
    const fieldState = taxFields[field.id];

    if (!fieldState.pendingAgentReview) {
      return;
    }

    const nextFieldState: FieldState = {
      ...fieldState,
      pendingAgentReview: false,
      acceptedAgentChange: true,
      agentReviewKind: null,
    };
    const nextFormState = {
      ...taxFieldsRef.current,
      [field.id]: nextFieldState,
    };
    const message = `Accepted AI change: ${field.label}.`;

    taxFieldsRef.current = nextFormState;
    setTaxFields(nextFormState);
    setLastUpdate(message);
    setLiveMessage(message);
    addActivityLogEntry({
      source: "human",
      title: `You accepted AI change: ${field.label}`,
      detail: `Accepted value: ${formatFieldValue(field, fieldState.currentValue)}.`,
      status: "Accepted AI change",
    });
  };

  const acceptAllAgentChanges = () => {
    const pendingFields = fieldDefinitions.filter(
      (field) => taxFieldsRef.current[field.id].pendingAgentReview,
    );

    if (pendingFields.length === 0) {
      return;
    }

    const nextFormState = { ...taxFieldsRef.current };

    pendingFields.forEach((field) => {
      nextFormState[field.id] = {
        ...nextFormState[field.id],
        pendingAgentReview: false,
        acceptedAgentChange: true,
        agentReviewKind: null,
      };
    });

    taxFieldsRef.current = nextFormState;
    setTaxFields(nextFormState);
    setLastUpdate(`Accepted ${pendingFields.length} AI suggestion${pendingFields.length === 1 ? "" : "s"}.`);
    setLiveMessage(
      `Accepted ${pendingFields.length} AI suggestion${pendingFields.length === 1 ? "" : "s"}.`,
    );
    addActivityLogEntry({
      source: "human",
      title: "You accepted all AI changes",
      detail: `${pendingFields.length} pending AI suggestion${pendingFields.length === 1 ? "" : "s"} moved to accepted.`,
      status: "Accepted AI change",
    });
  };

  const clearPendingAgentChanges = () => {
    const pendingFields = fieldDefinitions.filter(
      (field) => taxFieldsRef.current[field.id].pendingAgentReview,
    );

    if (pendingFields.length === 0) {
      return;
    }

    pendingFields.forEach((field) => {
      const agentChange = taxFieldsRef.current[field.id].lastAgentChange;

      if (!agentChange) {
        return;
      }

      updateTaxField(field.id, agentChange.from, "human", {
        suppressActivity: true,
      });
    });

    setLastUpdate(
      `Cleared ${pendingFields.length} pending AI suggestion${pendingFields.length === 1 ? "" : "s"}.`,
    );
    setLiveMessage(
      `Cleared ${pendingFields.length} pending AI suggestion${pendingFields.length === 1 ? "" : "s"}.`,
    );
    addActivityLogEntry({
      source: "human",
      title: "You undid all AI changes",
      detail: `${pendingFields.length} AI suggestion${pendingFields.length === 1 ? "" : "s"} undone.`,
      status: "Review cleared",
    });
  };

  const openPreview = () => {
    setIsPreviewOpen(true);
  };

  const closePreview = () => {
    setIsPreviewOpen(false);
  };

  const resetForm = () => {
    const shouldReset = window.confirm(
      "Reset the form, review state, and activity log?",
    );

    if (!shouldReset) {
      return;
    }

    clearFormState({
      lastUpdateMessage: "Form reset",
      liveMessageText: "Form reset.",
    });
  };

  const confirmSubmission = () => {
    const pendingReviewFields = fieldDefinitions.filter(
      (field) => taxFieldsRef.current[field.id].pendingAgentReview,
    );
    const missingFields = fieldDefinitions.filter(
      (field) =>
        isFieldRequired(field, taxFieldsRef.current) &&
        taxFieldsRef.current[field.id].currentValue === null,
    );
    const invalidFields = fieldDefinitions.filter((field) =>
      Boolean(
        getFieldValidationMessage(
          field,
          taxFieldsRef.current[field.id],
          taxFieldsRef.current,
        ),
      ),
    );

    if (
      pendingReviewFields.length > 0 ||
      missingFields.length > 0 ||
      invalidFields.length > 0
    ) {
      const blockers: string[] = [];

      if (pendingReviewFields.length > 0) {
        blockers.push(
          `${pendingReviewFields.length} AI change${pendingReviewFields.length === 1 ? "" : "s"} still need review`,
        );
      }

      if (missingFields.length > 0) {
        blockers.push(
          `${missingFields.length} required field${missingFields.length === 1 ? "" : "s"} are missing`,
        );
      }

      if (invalidFields.length > 0) {
        blockers.push(
          `${invalidFields.length} field${invalidFields.length === 1 ? "" : "s"} need correction`,
        );
      }

      const message = `Resolve ${blockers.join(", ")} before submitting.`;
      setShowFlaggedOnly(true);
      setLastUpdate(message);
      setLiveMessage(message);
      return;
    }

    setToast({
      id: Date.now(),
      kind: "success",
      eyebrow: "Submission complete",
      title: "Simplified T1 intake submitted",
      detail: "All required fields were present. The demo form has been cleared for a new session.",
      status: "Success",
    });
    clearFormState({
      clearToast: false,
      lastUpdateMessage: "Submission confirmed for this demo intake.",
      liveMessageText: "Submission confirmed for this demo intake. Form cleared.",
    });
  };

  const renderActionButtons = () => (
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        onClick={openPreview}
        className="border border-emerald-900 bg-emerald-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-800"
      >
        Submit
      </button>
      <button
        type="button"
        onClick={resetForm}
        className="border border-stone-400 bg-white px-4 py-2 text-sm font-semibold text-stone-800 transition-colors hover:bg-stone-100"
      >
        Reset
      </button>
    </div>
  );

  useEffect(() => {
    window.__slip2FormUpdateTaxField = (fieldId, value, options) => {
      return updateTaxField(fieldId, value, "agent", options);
    };

    if (!document.modelContext?.registerTool) {
      setAiAssistState(createInitialAiAssistState("unavailable"));
      setLastUpdate("WebMCP is not available in this browser");
      return;
    }

    if (!window.__slip2FormWebMcpRegistered) {
      fieldDefinitions.forEach((field) => {
        document.modelContext?.registerTool({
          name: field.toolName,
          description: field.toolDescription,
          inputSchema: {
            type: "object",
            properties: {
              [field.toolInputName]: {
                type:
                  field.kind === "currency" || field.kind === "integer"
                    ? "number"
                    : "string",
                description: field.source,
                ...(field.options ? { enum: field.options } : {}),
              },
              reason: {
                type: "string",
                description:
                  "Short explanation for why this value was chosen from the source material.",
              },
              sourceSnippet: {
                type: "string",
                description:
                  "Brief evidence snippet from the source used to support this value.",
              },
              needsConfirmation: {
                type: "boolean",
                description:
                  "Set true when the value is a best guess or the source is ambiguous and needs user confirmation.",
              },
            },
            required: [field.toolInputName],
          },
          async execute(input: Record<string, unknown>) {
            return (
              window.__slip2FormUpdateTaxField?.(
                field.id,
                input[field.toolInputName],
                {
                  agentReason: input.reason,
                  agentSourceSnippet: input.sourceSnippet,
                  needsConfirmation: input.needsConfirmation,
                },
              ) ?? {
                success: false,
                error: "Slip2Form field dispatcher is not available",
              }
            );
          },
        });
      });

      window.__slip2FormWebMcpRegistered = true;
    }

    setAiAssistState((currentState) => ({
      ...currentState,
      availability: "ready",
      lastError: null,
    }));
    setLastUpdate(`${fieldDefinitions.length} WebMCP tools registered`);
  }, [updateTaxField]);

  const reviewCount = fieldDefinitions.filter(
    (field) => taxFields[field.id].pendingAgentReview,
  ).length;
  const needsConfirmationCount = fieldDefinitions.filter(
    (field) =>
      taxFields[field.id].pendingAgentReview &&
      taxFields[field.id].agentNeedsConfirmation,
  ).length;
  const missingRequiredCount = fieldDefinitions.filter(
    (field) =>
      isFieldRequired(field, taxFields) &&
      taxFields[field.id].currentValue === null,
  ).length;
  const hasFormActivity =
    activityLog.length > 0 ||
    aiAssistState.isWorking ||
    aiAssistState.currentPassTouched > 0 ||
    aiAssistState.lastPassTouched > 0 ||
    fieldDefinitions.some((field) => taxFields[field.id].latestSource !== null);
  const validationMessages = fieldDefinitions.reduce((messages, field) => {
    const message = getFieldValidationMessage(field, taxFields[field.id], taxFields);

    if (message) {
      messages[field.id] = message;
    }

    return messages;
  }, {} as ValidationState);
  const invalidFieldCount = Object.values(validationMessages).length;
  const flaggedFieldCount = fieldDefinitions.filter((field) =>
    isFieldFlagged(
      field,
      taxFields[field.id],
      taxFields,
      validationMessages[field.id],
    ),
  ).length;
  const sectionsToRender = (
    Object.entries(groupedFieldDefinitions) as Array<
      [FieldDefinition["section"], FieldDefinition[]]
    >
  )
    .map(([section, fields]) => [
      section,
      showFlaggedOnly
        ? fields.filter((field) =>
            isFieldFlagged(
              field,
              taxFields[field.id],
              taxFields,
              validationMessages[field.id],
            ),
          )
        : fields,
    ] as [FieldDefinition["section"], FieldDefinition[]])
    .filter(([, fields]) => fields.length > 0);
  const canConfirmSubmission =
    missingRequiredCount === 0 && invalidFieldCount === 0 && reviewCount === 0;
  const hasAiPassActivity =
    aiAssistState.isWorking ||
    aiAssistState.currentPassTouched > 0 ||
    aiAssistState.lastPassTouched > 0 ||
    reviewCount > 0;
  const hasAiAttentionState =
    Boolean(aiAssistState.lastError) ||
    reviewCount > 0 ||
    (hasAiPassActivity && invalidFieldCount > 0);
  const aiStatusTone =
    aiAssistState.availability === "unavailable"
      ? "border-stone-300 bg-stone-100 text-stone-700"
      : aiAssistState.isWorking
        ? "border-sky-200 bg-sky-50 text-sky-900"
        : hasAiAttentionState
          ? "border-amber-300 bg-amber-50 text-amber-900"
          : "border-emerald-200 bg-emerald-50 text-emerald-900";
  const aiStatusEyebrow =
    aiAssistState.availability === "unavailable"
      ? "WebMCP status"
      : aiAssistState.isWorking
        ? "Live AI pass"
        : hasAiAttentionState
          ? "Needs attention"
          : "AI ready";
  const aiStatusTitle =
    aiAssistState.availability === "unavailable"
      ? "WebMCP is unavailable in this browser"
      : aiAssistState.isWorking
        ? "AI is updating the form"
        : aiAssistState.lastError
          ? "AI needs attention"
          : reviewCount > 0
            ? "AI completed a pass and needs review"
            : hasAiPassActivity && invalidFieldCount > 0
              ? "AI completed a pass and some fields need correction"
            : aiAssistState.lastPassTouched > 0
              ? "AI completed its last pass"
              : "Form is ready for AI-assisted filling";
  const aiStatusDetail =
    aiAssistState.availability === "unavailable"
      ? "The form can still be filled manually, but WebMCP tool calls are not available here."
      : aiAssistState.isWorking
        ? `${aiAssistState.currentPassChanged} field${aiAssistState.currentPassChanged === 1 ? "" : "s"} changed in this pass.${aiAssistState.currentPassNeedsConfirmation > 0 ? ` ${aiAssistState.currentPassNeedsConfirmation} need confirmation.` : ""}`
        : aiAssistState.lastError
          ? aiAssistState.lastError
          : reviewCount > 0 || (hasAiPassActivity && invalidFieldCount > 0)
            ? `${reviewCount} pending AI review, ${needsConfirmationCount} need confirmation, and ${invalidFieldCount} field${invalidFieldCount === 1 ? "" : "s"} need correction.`
            : aiAssistState.lastPassTouched > 0
              ? `Last pass touched ${aiAssistState.lastPassTouched} field${aiAssistState.lastPassTouched === 1 ? "" : "s"} and changed ${aiAssistState.lastPassChanged}.${aiAssistState.lastPassNeedsConfirmation > 0 ? ` ${aiAssistState.lastPassNeedsConfirmation} need confirmation.` : ""}`
              : missingRequiredCount > 0
                ? `WebMCP tools are registered and ready to fill this intake. ${missingRequiredCount} required field${missingRequiredCount === 1 ? "" : "s"} start blank.`
                : "WebMCP tools are registered and ready to fill this intake.";

  return (
    <main className="min-h-screen px-6 py-10">
	      <div className="mx-auto w-full max-w-6xl">
	        <section className="border border-stone-300 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
	            <div className="lg:basis-[42%] lg:max-w-[34rem]">
	              <img
	                src="/slip2form-logo.png"
	                alt="Slip2Form"
	                className="h-auto w-full max-w-[13rem]"
	              />
	              <h1 className="mt-4 max-w-[18ch] text-2xl font-semibold leading-[1.15] tracking-[-0.025em] text-stone-950 sm:text-[2rem]">
	                Let your AI fill the tax form.
	              </h1>
	              <p className="mt-5 border-l-4 border-emerald-800 bg-[#fbfaf6] px-4 py-3 text-sm font-semibold leading-6 text-stone-800">
	                {quickInstruction}
	              </p>
	              <div className="mt-5">{renderActionButtons()}</div>
	              <div className={`mt-5 border px-4 py-3 ${aiStatusTone}`}>
	                <p className="text-xs font-semibold uppercase tracking-wide">
	                  {aiStatusEyebrow}
	                </p>
	                <p className="mt-1 text-sm font-semibold">{aiStatusTitle}</p>
	                <p className="mt-1 text-xs leading-5">{aiStatusDetail}</p>
	              </div>
	            </div>

	            <div className="border border-stone-300 bg-[#fbfaf6] p-4 lg:min-w-[32rem] lg:basis-[48%]">
	              <div className="flex items-center justify-between gap-4">
	                <h2 className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
	                  Activity log
	                </h2>
	                <span className="text-xs font-medium text-stone-500">
	                  Latest {activityLog.length || 0}
	                </span>
	              </div>

	              <div className="mt-3 h-80 overflow-y-auto border-t border-stone-200">
	                {activityLog.length === 0 ? (
	                  <p className="py-2 text-[11px] leading-4 text-stone-500">
	                    AI updates, manual edits, and undo actions will appear here.
	                  </p>
	                ) : (
	                  <ol className="divide-y divide-stone-200">
	                    {activityLog.map((entry) => (
	                      <li key={entry.id} className="py-2">
	                        <div className="flex items-start justify-between gap-2">
	                          <p className="text-[11px] font-semibold leading-4 text-stone-900">
	                            {entry.title}
	                          </p>
	                          <div className="flex shrink-0 items-center gap-1.5">
	                            <time className="text-[10px] font-medium text-stone-400">
	                              {entry.time}
	                            </time>
	                            <span
	                              className={`text-[10px] font-semibold ${
	                                entry.source === "agent"
	                                  ? "text-sky-700"
	                                  : entry.source === "human"
	                                    ? "text-emerald-800"
	                                    : "text-stone-500"
	                              }`}
	                            >
	                              {entry.source === "agent"
	                                ? "AI"
	                                : entry.source === "human"
	                                  ? "You"
	                                  : "System"}
	                            </span>
	                          </div>
	                        </div>
	                        <p className="mt-0.5 text-[11px] leading-4 text-stone-600">
	                          {entry.detail}
	                        </p>
	                        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-500">
	                          {entry.status}
	                        </p>
	                      </li>
	                    ))}
	                  </ol>
	                )}
	              </div>
	            </div>
	          </div>
	        </section>

	        <section className="mt-4 border border-stone-300 bg-[#fbfaf6] p-6 shadow-sm">
          <div className="flex flex-col gap-2 border-b border-stone-300 pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-stone-950">
                Simplified T1 fields
              </h2>
              <p className="mt-2 text-sm text-stone-600">
                Demo only. No filing, calculation, CRA integration, or tax advice.
              </p>
            </div>
            <div className="text-sm font-semibold text-stone-700">
              <p>{reviewCount} pending AI review</p>
              <p>{missingRequiredCount} required missing</p>
              <p>{invalidFieldCount} need correction</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 border-b border-stone-200 pb-4">
            <button
              type="button"
              onClick={() => setShowFlaggedOnly((currentValue) => !currentValue)}
              className={`border px-4 py-2 text-sm font-semibold transition-colors ${
                showFlaggedOnly
                  ? "border-stone-900 bg-stone-900 text-white hover:bg-stone-800"
                  : "border-stone-400 bg-white text-stone-800 hover:bg-stone-100"
              }`}
            >
              {showFlaggedOnly ? "Show all fields" : "Review flagged items only"}
            </button>
            <p className="text-xs font-medium text-stone-600">
              {showFlaggedOnly
                ? flaggedFieldCount === 0
                  ? "No flagged fields remain."
                  : `Showing ${flaggedFieldCount} flagged field${flaggedFieldCount === 1 ? "" : "s"}.`
                : "Focus mode shows pending AI review, required missing, and invalid fields only."}
            </p>
          </div>
          {reviewCount > 0 ||
          (hasFormActivity && (missingRequiredCount > 0 || invalidFieldCount > 0)) ? (
            <div className="mt-4 border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <p className="font-semibold">Resolve flagged items before final submission.</p>
              <p className="mt-1 text-xs leading-5 text-amber-900">
                {reviewCount} pending AI review, {missingRequiredCount} required missing,
                {" "}
                and {invalidFieldCount} field{invalidFieldCount === 1 ? "" : "s"} need correction.
              </p>
            </div>
          ) : null}
          {reviewCount > 0 ? (
            <div className="mt-4 flex flex-wrap gap-3 border-b border-stone-200 pb-4">
              <button
                type="button"
                onClick={acceptAllAgentChanges}
                className="border border-amber-700 bg-amber-500 px-5 py-2 text-sm font-semibold text-stone-950 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-amber-400 hover:shadow-md"
              >
                Accept all AI changes
              </button>
              <button
                type="button"
                onClick={clearPendingAgentChanges}
                className="border border-stone-400 bg-white px-4 py-2 text-sm font-semibold text-stone-800 transition-colors hover:bg-stone-100"
              >
                Undo all AI changes
              </button>
            </div>
          ) : null}

          {sectionsToRender.length === 0 ? (
            <div className="mt-8 border border-dashed border-stone-300 bg-white px-4 py-8 text-center text-sm text-stone-600">
              No flagged fields remain. Switch back to all fields to review the full intake.
            </div>
          ) : null}

          {sectionsToRender.map(([section, fields]) => (
            <div key={section} className="mt-8">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-emerald-800">
                {section}
              </h3>
              <div className="mt-3 grid gap-4 lg:grid-cols-2">
                {fields.map((field) => {
                  const fieldState = taxFields[field.id];
                  const isRequired = isFieldRequired(field, taxFields);
                  const shouldHighlight =
                    fieldState.pendingAgentReview &&
                    fieldState.agentReviewKind === "replaced";
                  const validationMessage = validationMessages[field.id];
                  const hasAgentContext =
                    fieldState.agentReason ||
                    fieldState.agentSourceSnippet ||
                    fieldState.agentNeedsConfirmation;

                  return (
                    <div
                      key={field.id}
                      className={`border p-4 transition-colors ${
                        validationMessage
                          ? "border-rose-400 bg-rose-50 ring-2 ring-rose-100"
                          : shouldHighlight
                          ? "border-amber-500 bg-amber-50 ring-2 ring-amber-200"
                          : "border-stone-300 bg-white"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <label
                            htmlFor={field.id}
                            className="block text-sm font-semibold text-stone-900"
                          >
                            {field.label}
                          </label>
                          {isRequired ? (
                            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-rose-700">
                              Required
                            </p>
                          ) : null}
                          <p className="mt-1 text-xs font-medium text-stone-500">
                            {field.line ? `T1 line ${field.line}` : field.source}
                          </p>
                        </div>
                        <span className="border border-stone-300 bg-stone-50 px-2 py-1 text-xs font-semibold text-stone-600">
                          Source: {field.source}
                        </span>
                      </div>

                      <div className="mt-4">
                        {field.kind === "select" ? (
                          <select
                            id={field.id}
                            value={
                              typeof fieldState.currentValue === "string"
                                ? fieldState.currentValue
                                : ""
                            }
                            onFocus={handleFieldFocus(field)}
                            onChange={handleFieldChange(field)}
                            onBlur={handleFieldBlur(field)}
                            className="w-full border border-stone-300 bg-white px-3 py-3 text-base font-semibold text-stone-950 outline-none focus:border-emerald-700"
                            aria-describedby={`${field.id}-status`}
                          >
                            <option value="">Select</option>
                            {field.options?.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        ) : field.kind === "textarea" ? (
                          <textarea
                            id={field.id}
                            value={
                              manualTextDrafts[field.id] ??
                              (typeof fieldState.currentValue === "string"
                                ? fieldState.currentValue
                                : "")
                            }
                            onFocus={handleFieldFocus(field)}
                            onChange={handleFieldChange(field)}
                            onBlur={handleFieldBlur(field)}
                            rows={5}
                            className="w-full resize-y border border-stone-300 bg-white px-3 py-3 text-base font-medium text-stone-950 outline-none focus:border-emerald-700"
                            aria-describedby={`${field.id}-status`}
                          />
                        ) : (
                          <div className="flex items-center gap-3 border border-stone-300 bg-white px-3 py-2 focus-within:border-emerald-700">
                            {field.kind === "currency" ? (
                              <span className="text-xl font-semibold text-stone-500">
                                $
                              </span>
                            ) : null}
                            {field.kind === "currency" || field.kind === "integer" ? (
                              <input
                                id={field.id}
                                type="number"
                                min="0"
                                step={field.kind === "integer" ? "1" : "0.01"}
                                value={
                                  typeof fieldState.currentValue === "number"
                                    ? field.kind === "currency" &&
                                      focusedFieldId !== field.id
                                      ? fieldState.currentValue.toFixed(2)
                                      : fieldState.currentValue
                                    : ""
                                }
                                onFocus={handleFieldFocus(field)}
                                onChange={handleFieldChange(field)}
                                onBlur={handleFieldBlur(field)}
                                className="w-full appearance-none border-0 bg-transparent text-2xl font-semibold tabular-nums text-stone-950 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                aria-describedby={`${field.id}-status`}
                              />
                            ) : (
                              <input
                                id={field.id}
                                type={field.kind === "date" ? "date" : "text"}
                                value={
                                  manualTextDrafts[field.id] ??
                                  (typeof fieldState.currentValue === "string"
                                    ? fieldState.currentValue
                                    : "")
                                }
                                onFocus={handleFieldFocus(field)}
                                onChange={handleFieldChange(field)}
                                onBlur={handleFieldBlur(field)}
                                className="w-full border-0 bg-transparent text-base font-semibold text-stone-950 outline-none"
                                aria-describedby={`${field.id}-status`}
                              />
                            )}
                          </div>
                        )}
                      </div>

                      <p
                        id={`${field.id}-status`}
                        className="mt-3 text-sm font-medium text-stone-700"
                      >
                        Current value: {formatFieldValue(field, fieldState.currentValue)}
                      </p>
                      {validationMessage ? (
                        <p className="mt-2 text-sm font-medium text-rose-800">
                          {validationMessage}
                        </p>
                      ) : null}
                      {fieldState.latestSource === "human" ? (
                        <p className="mt-2 text-sm font-medium text-emerald-800">
                          Edited by you.
                        </p>
                      ) : null}
                      {fieldState.acceptedAgentChange ? (
                        <p className="mt-2 text-sm font-medium text-emerald-800">
                          Accepted AI change.
                        </p>
                      ) : null}
                      {fieldState.pendingAgentReview &&
                      fieldState.agentReviewKind === "filled" ? (
                        <p className="mt-2 text-sm font-medium text-sky-800">
                          Filled by AI. Review this value or edit the field to
                          override.
                        </p>
                      ) : null}
                      {fieldState.pendingAgentReview &&
                      fieldState.agentReviewKind === "replaced" ? (
                        <p className="mt-2 text-sm font-medium text-amber-800">
                          AI replaced previous value:{" "}
                          {formatFieldValue(field, fieldState.previousValue)}.
                        </p>
                      ) : null}
                      {hasAgentContext ? (
                        <div
                          className={`mt-3 border px-3 py-3 text-sm ${
                            fieldState.agentNeedsConfirmation
                              ? "border-amber-300 bg-amber-50"
                              : "border-sky-200 bg-sky-50"
                          }`}
                        >
                          <p
                            className={`text-xs font-semibold uppercase tracking-wide ${
                              fieldState.agentNeedsConfirmation
                                ? "text-amber-800"
                                : "text-sky-800"
                            }`}
                          >
                            {fieldState.agentNeedsConfirmation
                              ? "AI flagged this for confirmation"
                              : "AI rationale"}
                          </p>
                          {fieldState.agentReason ? (
                            <p className="mt-2 text-sm leading-6 text-stone-800">
                              {fieldState.agentReason}
                            </p>
                          ) : null}
                          {fieldState.agentSourceSnippet ? (
                            <p className="mt-2 text-xs leading-5 text-stone-600">
                              Evidence: {fieldState.agentSourceSnippet}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                      {fieldState.lastAgentChange ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {fieldState.pendingAgentReview ? (
                            <button
                              type="button"
                              onClick={() => acceptAgentChange(field)}
                              className="border border-emerald-900 bg-emerald-900 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-800"
                            >
                              Accept AI change
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => undoAgentChange(field)}
                            className="border border-stone-400 px-3 py-2 text-sm font-semibold text-stone-800 transition-colors hover:bg-stone-100"
                          >
                            Undo AI change
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="mt-8 flex border-t border-stone-300 pt-4">
            {renderActionButtons()}
          </div>
          <p aria-live="polite" className="sr-only">
            {liveMessage}
          </p>
        </section>
      </div>
      {toast ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[60] flex justify-center px-4">
          <div
            className={`w-full max-w-xl border bg-white/95 px-4 py-3 shadow-xl backdrop-blur-sm transition-all duration-300 ${
              toast.kind === "success"
                ? "border-emerald-200"
                : "border-sky-200"
            } ${
              isToastVisible
                ? "translate-y-0 opacity-100"
                : "translate-y-3 opacity-0"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p
                  className={`text-xs font-semibold uppercase tracking-wide ${
                    toast.kind === "success"
                      ? "text-emerald-800"
                      : "text-sky-800"
                  }`}
                >
                  {toast.eyebrow}
                </p>
                <p className="mt-1 text-sm font-semibold text-stone-950">
                  {toast.title}
                </p>
                <p className="mt-1 text-sm leading-6 text-stone-700">
                  {toast.detail}
                </p>
              </div>
              <p
                className={`shrink-0 text-[11px] font-semibold uppercase tracking-wide ${
                  toast.kind === "success"
                    ? "text-emerald-700"
                    : "text-sky-700"
                }`}
              >
                {toast.status}
              </p>
            </div>
          </div>
        </div>
      ) : null}
      {isPreviewOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/35 px-4 py-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby="preview-title"
          onClick={closePreview}
        >
          <section
            className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden border border-stone-300 bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="shrink-0 flex items-start justify-between gap-4 border-b border-stone-300 pb-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">
                  Preview
                </p>
                <h2
                  id="preview-title"
                  className="mt-2 text-2xl font-semibold text-stone-950"
                >
                  Simplified T1 intake summary
                </h2>
              </div>
            </div>

            <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
              <dl className="divide-y divide-stone-200">
                {fieldDefinitions.map((field) => {
                  const fieldState = taxFields[field.id];
                  const validationMessage = validationMessages[field.id];
                  const isRequiredMissing =
                    isFieldRequired(field, taxFields) &&
                    fieldState.currentValue === null;
                  const hasAgentContext =
                    fieldState.agentReason ||
                    fieldState.agentSourceSnippet ||
                    fieldState.agentNeedsConfirmation;

                  return (
                    <div
                      key={field.id}
                      className="grid gap-x-4 gap-y-2 py-3 md:grid-cols-[minmax(0,1.45fr)_minmax(10rem,1fr)_12rem] md:items-start"
                    >
                      <dt>
                        <p className="text-sm font-semibold text-stone-900">
                          {field.label}
                        </p>
                        {isFieldRequired(field, taxFields) ? (
                          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-rose-700">
                            Required
                          </p>
                        ) : null}
                        <p className="mt-1 text-xs font-medium text-stone-500">
                          {field.line ? `T1 line ${field.line}` : field.source}
                        </p>
                      </dt>
                      <dd
                        className={`text-sm font-semibold text-stone-950 md:text-right ${
                          field.kind === "textarea" ? "whitespace-pre-wrap" : ""
                        }`}
                      >
                        {formatFieldValue(field, fieldState.currentValue)}
                      </dd>
                      <dd
                        className={`text-xs font-semibold md:justify-self-end md:text-right ${
                          validationMessage
                            ? "text-rose-700"
                            : isRequiredMissing
                              ? "text-amber-700"
                            : fieldState.pendingAgentReview
                              ? "text-amber-700"
                            : fieldState.acceptedAgentChange ||
                                fieldState.latestSource === "human"
                              ? "text-emerald-800"
                              : "text-stone-500"
                        }`}
                      >
                        {validationMessage
                          ? "Needs correction"
                          : isRequiredMissing
                            ? "Required missing"
                          : getFieldStatusLabel(fieldState)}
                      </dd>
                      {isRequiredMissing ? (
                        <div className="md:col-span-3">
                          <div className="mt-1 border border-amber-200 bg-amber-50 px-3 py-3 text-xs leading-5 text-amber-900">
                            This required field is missing.
                          </div>
                        </div>
                      ) : null}
                      {validationMessage ? (
                        <div className="md:col-span-3">
                          <div className="mt-1 border border-rose-200 bg-rose-50 px-3 py-3 text-xs leading-5 text-rose-900">
                            {validationMessage}
                          </div>
                        </div>
                      ) : null}
                      {hasAgentContext ? (
                        <div className="md:col-span-3">
                          <div
                            className={`mt-1 border px-3 py-3 text-xs leading-5 ${
                              fieldState.agentNeedsConfirmation
                                ? "border-amber-300 bg-amber-50 text-amber-900"
                                : "border-sky-200 bg-sky-50 text-stone-700"
                            }`}
                          >
                            {fieldState.agentReason ? (
                              <p>{fieldState.agentReason}</p>
                            ) : null}
                            {fieldState.agentSourceSnippet ? (
                              <p className="mt-1">
                                Evidence: {fieldState.agentSourceSnippet}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </dl>
            </div>

            <div className="mt-6 shrink-0 border-t border-stone-300 pt-4">
              {!canConfirmSubmission ? (
                <p className="text-xs font-medium text-stone-500">
                  Review pending AI items and complete required fields before confirming.
                </p>
              ) : null}
              <div className="mt-3 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closePreview}
                  className="min-w-28 border border-stone-400 bg-white px-4 py-2 text-sm font-semibold text-stone-800 transition-colors hover:bg-stone-100"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={confirmSubmission}
                  disabled={!canConfirmSubmission}
                  className="min-w-28 border border-emerald-900 bg-emerald-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:border-stone-300 disabled:bg-stone-200 disabled:text-stone-500"
                >
                  Confirm
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
