import { SlidersHorizontal, X } from "lucide-react"
import { useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { assignmentStatuses } from "@/lib/assignment-status"
import { assignmentTypes } from "@/lib/assignment-types"
import { defaultDashboardFilters } from "@/lib/dashboard-preferences"
import type { DashboardSortDirection, DashboardSortField } from "@/lib/dashboard-view"
import type { DashboardFilterPreferences } from "@/types"

type DashboardFiltersProps = {
  filters: DashboardFilterPreferences
  onFilters: (value: DashboardFilterPreferences) => void
  query: string
  onQuery: (value: string) => void
  sortField: DashboardSortField
  onSortField: (value: DashboardSortField) => void
  sortDirection: DashboardSortDirection
  onSortDirection: (value: DashboardSortDirection) => void
}

type FilterFieldsProps = {
  filters: DashboardFilterPreferences
  onFilters: (value: DashboardFilterPreferences) => void
  sortField: DashboardSortField
  onSortField: (value: DashboardSortField) => void
  sortDirection: DashboardSortDirection
  onSortDirection: (value: DashboardSortDirection) => void
}

function FilterFields({
  filters,
  onFilters,
  sortField,
  onSortField,
  sortDirection,
  onSortDirection,
}: FilterFieldsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-5">
      <Select
        value={filters.type}
        onValueChange={(value) =>
          onFilters({ ...filters, type: value as DashboardFilterPreferences["type"] })
        }
      >
        <SelectTrigger aria-label="Filter by assignment type"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          {assignmentTypes.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select
        value={filters.priority}
        onValueChange={(value) =>
          onFilters({ ...filters, priority: value as DashboardFilterPreferences["priority"] })
        }
      >
        <SelectTrigger aria-label="Filter by priority"><SelectValue /></SelectTrigger>
        <SelectContent>
          {(["all", "high", "medium", "low"] as const).map((value) => (
            <SelectItem key={value} value={value}>
              {value === "all" ? "All Priorities" : `${value[0].toUpperCase()}${value.slice(1)}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={filters.status}
        onValueChange={(value) =>
          onFilters({ ...filters, status: value as DashboardFilterPreferences["status"] })
        }
      >
        <SelectTrigger aria-label="Filter by status"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          {assignmentStatuses.map((status) => <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={sortField} onValueChange={(value) => onSortField(value as DashboardSortField)}>
        <SelectTrigger aria-label="Sort assignments by"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="deadline">Deadline</SelectItem>
          <SelectItem value="name">Assignment name</SelectItem>
        </SelectContent>
      </Select>
      <Select value={sortDirection} onValueChange={(value) => onSortDirection(value as DashboardSortDirection)}>
        <SelectTrigger aria-label="Sort direction"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="asc">Ascending</SelectItem>
          <SelectItem value="desc">Descending</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}

export function DashboardFilters({
  filters,
  onFilters,
  query,
  onQuery,
  sortField,
  onSortField,
  sortDirection,
  onSortDirection,
}: DashboardFiltersProps) {
  const mobile = useMediaQuery("(max-width: 639px)")
  const [open, setOpen] = useState(false)
  const [draftFilters, setDraftFilters] = useState(filters)
  const [draftSortField, setDraftSortField] = useState(sortField)
  const [draftSortDirection, setDraftSortDirection] = useState(sortDirection)
  const trigger = useRef<HTMLButtonElement>(null)
  const activeFilters = Object.entries(filters).filter(([, value]) => value !== "all")

  const openMobileFilters = () => {
    setDraftFilters(filters)
    setDraftSortField(sortField)
    setDraftSortDirection(sortDirection)
    setOpen(true)
  }

  const closeMobileFilters = () => {
    setOpen(false)
    window.setTimeout(() => trigger.current?.focus(), 0)
  }

  const applyMobileFilters = () => {
    onFilters(draftFilters)
    onSortField(draftSortField)
    onSortDirection(draftSortDirection)
    closeMobileFilters()
  }

  const clearFilters = () => onFilters({ ...defaultDashboardFilters })

  return (
    <section className="grid gap-3" aria-label="Dashboard filters">
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Search assignments"
          aria-label="Search assignments by title, type, priority, status, assignee, or notes"
        />
        {mobile ? (
          <Button ref={trigger} variant="outline" onClick={openMobileFilters}>
            <SlidersHorizontal className="h-4 w-4" />
            Filters
          </Button>
        ) : null}
      </div>

      {mobile ? (
        <Dialog open={open} onOpenChange={(nextOpen) => nextOpen ? openMobileFilters() : closeMobileFilters()}>
          <DialogContent className="bottom-0 top-auto max-h-[90vh] translate-y-0">
            <DialogHeader><DialogTitle>Filter assignments</DialogTitle></DialogHeader>
            <FilterFields
              filters={draftFilters}
              onFilters={setDraftFilters}
              sortField={draftSortField}
              onSortField={setDraftSortField}
              sortDirection={draftSortDirection}
              onSortDirection={setDraftSortDirection}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setDraftFilters({ ...defaultDashboardFilters })}>Clear</Button>
              <Button variant="ghost" onClick={closeMobileFilters}>Cancel</Button>
              <Button onClick={applyMobileFilters}>Apply</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : (
        <FilterFields
          filters={filters}
          onFilters={onFilters}
          sortField={sortField}
          onSortField={onSortField}
          sortDirection={sortDirection}
          onSortDirection={onSortDirection}
        />
      )}

      {activeFilters.length > 0 ? (
        <div className="flex flex-wrap gap-2" aria-label="Active assignment filters">
          {activeFilters.map(([key, value]) => (
            <Button
              key={key}
              size="sm"
              variant="secondary"
              aria-label={`Remove ${value} filter`}
              onClick={() => onFilters({ ...filters, [key]: "all" })}
            >
              {value}<X className="h-3 w-3" />
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={clearFilters}>Clear all</Button>
        </div>
      ) : null}
    </section>
  )
}
