type WebMcpToolDefinition<TInput extends object = Record<string, unknown>> = {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  execute(input: TInput): Promise<Record<string, unknown>>;
};

interface Document {
  modelContext?: {
    registerTool<TInput extends object>(tool: WebMcpToolDefinition<TInput>): void;
  };
}

type Slip2FormTaxFieldId =
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

interface Window {
  __slip2FormUpdateTaxField?: (
    fieldId: Slip2FormTaxFieldId,
    value: unknown,
    options?: {
      agentReason?: unknown;
      agentSourceSnippet?: unknown;
      needsConfirmation?: unknown;
    },
  ) =>
    | {
        success: boolean;
        value?: number | string | null;
        changed?: boolean;
        error?: string;
      }
    | undefined;
  __slip2FormWebMcpRegistered?: boolean;
}
