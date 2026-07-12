import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CATEGORIES } from '../../../lib/categories'
import { todayISO } from '../../../lib/format'
import { Button } from '../../../components/ui/Button'
import { Input, Select, Label, FieldError } from '../../../components/ui/Field'
import type { Expense, ExpenseInput } from '../types'
import { expenseFormSchema, type ExpenseFormValues } from './ExpenseForm.schema'

type FormValues = ExpenseFormValues

interface ExpenseFormProps {
  initial?: Expense | null
  submitting: boolean
  onSubmit: (input: ExpenseInput) => void
  onCancel: () => void
}

export function ExpenseForm({
  initial,
  submitting,
  onSubmit,
  onCancel,
}: ExpenseFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      amount: initial?.amount ?? undefined,
      category: (initial?.category as FormValues['category']) ?? 'food',
      spent_at: initial?.spent_at ?? todayISO(),
      note: initial?.note ?? '',
    },
  })

  const submit = (values: FormValues) => {
    onSubmit({
      amount: values.amount,
      category: values.category,
      spent_at: values.spent_at,
      note: values.note?.trim() ? values.note.trim() : null,
    })
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
      <div>
        <Label htmlFor="amount">Amount</Label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
            $
          </span>
          <Input
            id="amount"
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
        <Label htmlFor="category">Category</Label>
        <Select id="category" invalid={!!errors.category} {...register('category')}>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
        <FieldError>{errors.category?.message}</FieldError>
      </div>

      <div>
        <Label htmlFor="spent_at">Date</Label>
        <Input
          id="spent_at"
          type="date"
          invalid={!!errors.spent_at}
          {...register('spent_at')}
        />
        <FieldError>{errors.spent_at?.message}</FieldError>
      </div>

      <div>
        <Label htmlFor="note">Note (optional)</Label>
        <Input
          id="note"
          type="text"
          placeholder="e.g. Lunch with team"
          invalid={!!errors.note}
          {...register('note')}
        />
        <FieldError>{errors.note?.message}</FieldError>
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
          {initial ? 'Save changes' : 'Add expense'}
        </Button>
      </div>
    </form>
  )
}
