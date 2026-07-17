import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CATEGORIES } from '../../../lib/categories'
import { Button } from '../../../components/ui/Button'
import { Input, Select, Label, FieldError } from '../../../components/ui/Field'
import type { Budget, BudgetInput } from '../types'
import {
  budgetFormSchema,
  OVERALL_VALUE,
  type BudgetFormValues,
} from './BudgetForm.schema'

type FormValues = BudgetFormValues

interface BudgetFormProps {
  initial?: Budget | null
  submitting: boolean
  onSubmit: (input: BudgetInput) => void
  onCancel: () => void
}

export function BudgetForm({
  initial,
  submitting,
  onSubmit,
  onCancel,
}: BudgetFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: {
      amount: initial?.amount ?? undefined,
      category: (initial?.category as FormValues['category']) ?? OVERALL_VALUE,
    },
  })

  const submit = (values: FormValues) => {
    onSubmit({
      amount: values.amount,
      category: values.category === OVERALL_VALUE ? null : values.category,
    })
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
      <div>
        <Label htmlFor="budget-amount">Amount</Label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
            $
          </span>
          <Input
            id="budget-amount"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            placeholder="0.00"
            className="pl-7"
            invalid={!!errors.amount}
            {...register('amount', { valueAsNumber: true })}
          />
        </div>
        <FieldError>{errors.amount?.message}</FieldError>
      </div>

      <div>
        <Label htmlFor="budget-category">Category</Label>
        <Select
          id="budget-category"
          invalid={!!errors.category}
          {...register('category')}
        >
          <option value={OVERALL_VALUE}>Overall (all spending)</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
        <FieldError>{errors.category?.message}</FieldError>
      </div>

      <div className="flex gap-3 pt-1">
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button type="submit" loading={submitting} className="flex-1">
          {initial ? 'Save changes' : 'Add budget'}
        </Button>
      </div>
    </form>
  )
}
