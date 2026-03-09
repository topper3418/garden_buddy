import MDEditor, { commands, type ICommand } from '@uiw/react-md-editor'
import '@uiw/react-md-editor/markdown-editor.css'
import '@uiw/react-markdown-preview/markdown.css'

import type { NotesEditorProps } from './NotesEditor'

const underlineCommand: ICommand = {
  name: 'underline',
  keyCommand: 'underline',
  buttonProps: { 'aria-label': 'Add underline' },
  icon: <span style={{ fontWeight: 700 }}>U</span>,
  execute: (state, api) => {
    const text = state.selectedText || 'text'
    api.replaceSelection(`<u>${text}</u>`)
  },
}

const toolbarCommands: ICommand[] = [
  commands.bold,
  commands.italic,
  underlineCommand,
  commands.strikethrough,
  commands.hr,
  commands.title,
  commands.unorderedListCommand,
  commands.orderedListCommand,
  commands.checkedListCommand,
  commands.link,
  commands.quote,
]

export function NotesEditorCore({ value, onChange, height = 280 }: NotesEditorProps) {
  return (
    <div data-color-mode='light'>
      <MDEditor
        value={value ?? ''}
        onChange={(nextValue) => onChange?.(nextValue ?? '')}
        height={height}
        preview='live'
        visibleDragbar={false}
        commands={toolbarCommands}
      />
    </div>
  )
}