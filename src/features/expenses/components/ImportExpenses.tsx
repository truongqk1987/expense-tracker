import { useRef, useState, type ChangeEvent } from 'react'
import { Modal } from '../../../components/ui/Modal'
import { Button } from '../../../components/ui/Button'
import { parseExpensesCsv, type ParseExpensesCsvResult } from '../csv'
import { useImportExpenses } from '../hooks'

/** Upload a CSV, preview how many rows are valid vs skipped, then confirm to
 *  bulk-insert the valid rows. Invalid rows are skipped, never reject the
 *  whole file. */
export function ImportExpenses() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState<ParseExpensesCsvResult | null>(null)
  const importExpenses = useImportExpenses()

  const openFilePicker = () => inputRef.current?.click()

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const text = await file.text()
    setPreview(parseExpensesCsv(text))
    setOpen(true)
  }

  const close = () => {
    setOpen(false)
    setPreview(null)
  }

  const confirm = () => {
    if (!preview || preview.rows.length === 0) return
    importExpenses.mutate(preview.rows, { onSuccess: close })
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        aria-label="Import CSV file"
        onChange={handleFile}
      />
      <Button variant="secondary" size="sm" onClick={openFilePicker}>
        Import CSV
      </Button>

      <Modal open={open} onClose={close} title="Import expenses">
        {preview && (
          <>
            <p className="text-sm text-muted">
              {preview.rows.length} valid / {preview.errors.length} skipped
            </p>
            {preview.errors.length > 0 && (
              <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-xs text-danger">
                {preview.errors.map((err) => (
                  <li key={err.line}>
                    Line {err.line}: {err.message}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-5 flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={close}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                loading={importExpenses.isPending}
                disabled={preview.rows.length === 0}
                onClick={confirm}
              >
                Import {preview.rows.length}
              </Button>
            </div>
          </>
        )}
      </Modal>
    </>
  )
}
