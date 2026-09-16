import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MapFilters } from '../components/MapFilters'

describe('MapFilters', () => {
  const defaultProps = {
    status: '',
    setStatus: vi.fn(),
    severity: '',
    setSeverity: vi.fn(),
    category: '',
    setCategory: vi.fn(),
    ward: '',
    setWard: vi.fn(),
    department: '',
    setDepartment: vi.fn(),
    authority: '',
    setAuthority: vi.fn(),
    onClear: vi.fn(),
    categories: [{ id: 'cat-1', name: 'Roads' }],
    departments: [{ id: 'dep-1', name: 'Public Works' }],
    wards: [{ administrative_ward_name: 'Aundh' }]
  }

  it('renders default "All" state correctly', () => {
    render(<MapFilters {...defaultProps} />)
    
    // Status
    const statusSelect = screen.getByLabelText(/Status/i) as HTMLSelectElement
    expect(statusSelect.value).toBe('')
    
    // Severity
    const severitySelect = screen.getByLabelText(/Severity/i) as HTMLSelectElement
    expect(severitySelect.value).toBe('')
  })

  it('uses canonical values for status and severity', () => {
    render(<MapFilters {...defaultProps} />)
    
    const statusSelect = screen.getByLabelText(/Status/i) as HTMLSelectElement
    fireEvent.change(statusSelect, { target: { value: 'submitted' } })
    expect(defaultProps.setStatus).toHaveBeenCalledWith('submitted')

    const severitySelect = screen.getByLabelText(/Severity/i) as HTMLSelectElement
    fireEvent.change(severitySelect, { target: { value: 'not_assessed' } })
    expect(defaultProps.setSeverity).toHaveBeenCalledWith('not_assessed')
  })

  it('renders categories dynamically', () => {
    render(<MapFilters {...defaultProps} />)
    const categorySelect = screen.getByLabelText(/Category/i) as HTMLSelectElement
    expect(categorySelect.options.length).toBe(2) // All + Roads
    expect(categorySelect.options[1].value).toBe('cat-1')
  })

  it('renders departments dynamically', () => {
    render(<MapFilters {...defaultProps} />)
    const depSelect = screen.getByLabelText(/Department/i) as HTMLSelectElement
    expect(depSelect.options.length).toBe(2)
    expect(depSelect.options[1].value).toBe('dep-1')
  })

  it('renders wards dynamically', () => {
    render(<MapFilters {...defaultProps} />)
    const wardSelect = screen.getByLabelText(/Administrative Ward/i) as HTMLSelectElement
    expect(wardSelect.options.length).toBe(2)
    expect(wardSelect.options[1].value).toBe('Aundh')
  })

  it('calls onClear when clear button is clicked', () => {
    render(<MapFilters {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /Clear Filters/i }))
    expect(defaultProps.onClear).toHaveBeenCalled()
  })
})
