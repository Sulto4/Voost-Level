import { CustomFieldDefinition } from '../../types/database'

interface CustomFieldInputProps {
  field: CustomFieldDefinition
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function CustomFieldInput({ field, value, onChange, disabled }: CustomFieldInputProps) {
  const inputId = `custom-field-${field.id}`

  switch (field.type) {
    case 'text':
      return (
        <div>
          <label htmlFor={inputId} className="label">
            {field.name} {field.required && <span className="text-red-500">*</span>}
          </label>
          <input
            id={inputId}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="input"
            placeholder={`Enter ${field.name.toLowerCase()}...`}
            disabled={disabled}
          />
        </div>
      )

    case 'number':
      return (
        <div>
          <label htmlFor={inputId} className="label">
            {field.name} {field.required && <span className="text-red-500">*</span>}
          </label>
          <input
            id={inputId}
            type="number"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="input"
            placeholder={`Enter ${field.name.toLowerCase()}...`}
            disabled={disabled}
          />
        </div>
      )

    case 'dropdown':
      return (
        <div>
          <label htmlFor={inputId} className="label">
            {field.name} {field.required && <span className="text-red-500">*</span>}
          </label>
          <select
            id={inputId}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="input"
            disabled={disabled}
          >
            <option value="">Select {field.name.toLowerCase()}...</option>
            {field.options?.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      )

    case 'date':
      return (
        <div>
          <label htmlFor={inputId} className="label">
            {field.name} {field.required && <span className="text-red-500">*</span>}
          </label>
          <input
            id={inputId}
            type="date"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="input"
            disabled={disabled}
          />
        </div>
      )

    default:
      return null
  }
}
