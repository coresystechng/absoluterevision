export const assignmentTypeValues = [
  "Design",
  "Copywriting",
  "Dissertation",
  "Assignment",
  "Presentation",
] as const

export type AssignmentType = (typeof assignmentTypeValues)[number]
export type WorkflowTone = "success" | "warning" | "danger" | "info" | "neutral"

export type WorkflowStageDefinition = {
  value: string
  label: string
  publicLabel: string
  description: string
  progress: number
  tone: WorkflowTone
}

const editorialWorkflow = [
  { value: "ai-draft", label: "AI Draft", publicLabel: "Initial draft", description: "Your work has been received and is being prepared.", progress: 15, tone: "danger" },
  { value: "humaned", label: "Humaned", publicLabel: "Expert editing", description: "An editor is reviewing your manuscript.", progress: 30, tone: "warning" },
  { value: "grammar-check", label: "Grammar Check", publicLabel: "Grammar check", description: "Grammar, language, and clarity are being checked.", progress: 45, tone: "warning" },
  { value: "plagiarism-check", label: "Plagiarism Check", publicLabel: "Plagiarism check", description: "Plagiarism and originality checks are in progress.", progress: 60, tone: "info" },
  { value: "text-format", label: "Text Format", publicLabel: "Formatting", description: "Formatting is being refined.", progress: 75, tone: "info" },
  { value: "final-review", label: "Final Review", publicLabel: "Final quality check", description: "A final quality check is underway.", progress: 90, tone: "success" },
] as const satisfies readonly WorkflowStageDefinition[]

const designWorkflow = [
  { value: "concept", label: "Concept", publicLabel: "Concept", description: "The initial concept and creative direction are being developed.", progress: 15, tone: "danger" },
  { value: "drafts", label: "Drafts", publicLabel: "Drafts", description: "Early design drafts are being prepared for review.", progress: 30, tone: "warning" },
  { value: "main-design", label: "Main Design", publicLabel: "Main design", description: "The main design is being developed from the selected direction.", progress: 45, tone: "warning" },
  { value: "feedback", label: "Feedback", publicLabel: "Feedback", description: "Feedback is being reviewed and incorporated into the design.", progress: 60, tone: "info" },
  { value: "clean-up", label: "Clean Up", publicLabel: "Clean up", description: "Final refinements and design clean-up are underway.", progress: 75, tone: "info" },
  { value: "final-review", label: "Final Review", publicLabel: "Final review", description: "The completed design is undergoing its final quality review.", progress: 90, tone: "success" },
] as const satisfies readonly WorkflowStageDefinition[]

export type AssignmentProgressStage =
  | (typeof editorialWorkflow)[number]["value"]
  | (typeof designWorkflow)[number]["value"]

export const assignmentWorkflows = {
  Design: designWorkflow,
  Copywriting: editorialWorkflow,
  Dissertation: editorialWorkflow,
  Assignment: editorialWorkflow,
  Presentation: editorialWorkflow,
} as const satisfies Record<AssignmentType, readonly WorkflowStageDefinition[]>

const legacyEditorialStages: Record<string, (typeof editorialWorkflow)[number]["value"]> = {
  "not-started": "ai-draft",
  "in-progress": "ai-draft",
  "ai-draft": "ai-draft",
  humaned: "humaned",
  "grammar-check": "grammar-check",
  "ai-plagiarism-check": "plagiarism-check",
  "plagiarism-check": "plagiarism-check",
  "text-format": "text-format",
  review: "final-review",
  "final-review": "final-review",
  done: "final-review",
  completed: "final-review",
}

export function isAssignmentType(value: unknown): value is AssignmentType {
  return typeof value === "string" && assignmentTypeValues.some((type) => type === value)
}

export function getAssignmentWorkflow(type: AssignmentType): readonly WorkflowStageDefinition[] {
  return assignmentWorkflows[type]
}

export function isWorkflowStageForType(
  type: AssignmentType,
  value: unknown,
): value is AssignmentProgressStage {
  return typeof value === "string" && getAssignmentWorkflow(type).some((stage) => stage.value === value)
}

export function normalizeWorkflowStage(
  type: AssignmentType,
  value: string | null | undefined,
): AssignmentProgressStage {
  if (isWorkflowStageForType(type, value)) {
    return value
  }

  const legacyStage = value ? legacyEditorialStages[value] : undefined
  const legacyIndex = legacyStage
    ? editorialWorkflow.findIndex((stage) => stage.value === legacyStage)
    : 0

  return getAssignmentWorkflow(type)[Math.max(legacyIndex, 0)].value as AssignmentProgressStage
}

export function getWorkflowStage(
  type: AssignmentType,
  value: string | null | undefined,
): WorkflowStageDefinition {
  const normalized = normalizeWorkflowStage(type, value)
  return getAssignmentWorkflow(type).find((stage) => stage.value === normalized) ?? getAssignmentWorkflow(type)[0]
}

export function getInitialWorkflowStage(type: AssignmentType): AssignmentProgressStage {
  return getAssignmentWorkflow(type)[0].value as AssignmentProgressStage
}

export function getFinalWorkflowStage(type: AssignmentType): AssignmentProgressStage {
  return getAssignmentWorkflow(type).at(-1)!.value as AssignmentProgressStage
}

export function mapWorkflowStageByPosition(
  fromType: AssignmentType,
  toType: AssignmentType,
  value: string | null | undefined,
): AssignmentProgressStage {
  const normalized = normalizeWorkflowStage(fromType, value)
  const currentIndex = getAssignmentWorkflow(fromType).findIndex((stage) => stage.value === normalized)
  return getAssignmentWorkflow(toType)[Math.max(currentIndex, 0)].value as AssignmentProgressStage
}
