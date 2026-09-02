import { ChevronDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type MultiSelectFilterOption<T extends string> = {
  value: T
  label: string
}

type MultiSelectFilterProps<T extends string> = {
  value: T[]
  options: Array<MultiSelectFilterOption<T>>
  allLabel: string
  pluralLabel: string
  ariaLabel: string
  onValueChange: (value: T[]) => void
}

export function MultiSelectFilter<T extends string>({
  value,
  options,
  allLabel,
  pluralLabel,
  ariaLabel,
  onValueChange,
}: MultiSelectFilterProps<T>) {
  const selected = new Set(value)
  const selectedOption = value.length === 1
    ? options.find((option) => option.value === value[0])
    : null
  const summary = value.length === 0
    ? allLabel
    : selectedOption?.label ?? `${value.length} ${pluralLabel}`

  const toggleOption = (optionValue: T, checked: boolean) => {
    const nextSelected = new Set(value)
    if (checked) {
      nextSelected.add(optionValue)
    } else {
      nextSelected.delete(optionValue)
    }

    const nextValue = options
      .map((option) => option.value)
      .filter((candidate) => nextSelected.has(candidate))

    onValueChange(nextValue.length === options.length ? [] : nextValue)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-between bg-surface-inset px-3 font-normal"
          aria-label={`${ariaLabel}: ${summary}`}
        >
          <span className="min-w-0 flex-1 truncate text-left">{summary}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-48"
      >
        <DropdownMenuCheckboxItem
          checked={value.length === 0}
          onCheckedChange={() => onValueChange([])}
          onSelect={(event) => event.preventDefault()}
        >
          {allLabel}
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={selected.has(option.value)}
            onCheckedChange={(checked) => toggleOption(option.value, checked === true)}
            onSelect={(event) => event.preventDefault()}
          >
            {option.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
