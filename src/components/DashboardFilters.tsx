import { ArrowDown, ArrowUp } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { assignmentStatuses } from "@/lib/assignment-status"
import { assignmentTypes } from "@/lib/assignment-types"
import type { DashboardSortDirection, DashboardSortField } from "@/lib/dashboard-view"
import type { AssignmentPriority, DashboardFilterPreferences } from "@/types"

const priorityOptions: Array<{ value: AssignmentPriority; label: string }> = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
]

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

export function DashboardFilters({
  filters,
  sortField,
  sortDirection,
  onFiltersChange,
  onSortFieldChange,
  onSortDirectionChange,
  onClear,
  onApply,
  mobile = false,
  disabled = false,
}: {
  filters: DashboardFilterPreferences
  sortField: DashboardSortField
  sortDirection: DashboardSortDirection
  onFiltersChange: (filters: DashboardFilterPreferences) => void
  onSortFieldChange: (field: DashboardSortField) => void
  onSortDirectionChange: (direction: DashboardSortDirection) => void
  onClear: () => void
  onApply?: () => void
  mobile?: boolean
  disabled?: boolean
}) {
  return (
    <div className={mobile ? "grid gap-5" : "grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-2 lg:grid-cols-5"}>
      <Field label="Type">
        <Select
          value={filters.type}
          onValueChange={(value) => onFiltersChange({ ...filters, type: value as DashboardFilterPreferences["type"] })}
          disabled={disabled}
        >
          <SelectTrigger aria-label="Filter by assignment type"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {assignmentTypes.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Priority">
        <Select
          value={filters.priority}
          onValueChange={(value) => onFiltersChange({ ...filters, priority: value as DashboardFilterPreferences["priority"] })}
          disabled={disabled}
        >
          <SelectTrigger aria-label="Filter by priority"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {priorityOptions.map((priority) => <SelectItem key={priority.value} value={priority.value}>{priority.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Status">
        <Select
          value={filters.status}
          onValueChange={(value) => onFiltersChange({ ...filters, status: value as DashboardFilterPreferences["status"] })}
          disabled={disabled}
        >
          <SelectTrigger aria-label="Filter by status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {assignmentStatuses.map((status) => <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Sort by">
        <Select value={sortField} onValueChange={(value) => onSortFieldChange(value as DashboardSortField)} disabled={disabled}>
          <SelectTrigger aria-label="Sort assignments by"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="deadline">Deadline</SelectItem>
            <SelectItem value="name">Assignment name</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field label="Order">
        <Button
          type="button"
          variant="outline"
          className="justify-start"
          disabled={disabled}
          onClick={() => onSortDirectionChange(sortDirection === "asc" ? "desc" : "asc")}
          aria-label={`Sort ${sortDirection === "asc" ? "ascending" : "descending"}. Change direction`}
        >
          {sortDirection === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
          {sortDirection === "asc" ? "Ascending" : "Descending"}
        </Button>
      </Field>

      <div className={mobile ? "sticky bottom-0 grid grid-cols-2 gap-3 border-t bg-background pt-4" : "flex items-end lg:col-span-5 lg:justify-end"}>
        <Button type="button" variant="ghost" onClick={onClear} disabled={disabled}>Clear all</Button>
        {mobile ? <Button type="button" onClick={onApply} disabled={disabled}>Apply filters</Button> : null}
      </div>
    </div>
  )
}
