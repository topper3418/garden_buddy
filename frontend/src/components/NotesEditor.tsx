import { Skeleton } from 'antd'
import { Suspense, lazy } from 'react'

export type NotesEditorProps = {
  value?: string
  onChange?: (value: string) => void
  height?: number
}

const NotesEditorCore = lazy(async () => {
  const module = await import('./NotesEditorCore')
  return { default: module.NotesEditorCore }
})

export function NotesEditor({ value, onChange, height = 280 }: NotesEditorProps) {
  return (
    <Suspense fallback={<Skeleton active paragraph={{ rows: 6 }} />}>
      <NotesEditorCore value={value} onChange={onChange} height={height} />
    </Suspense>
  )
}
