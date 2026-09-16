// @ts-nocheck
/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { Report } from '../pages/Report'
import { BrowserRouter } from 'react-router-dom'
import * as apiService from '../services/api'
import '@testing-library/jest-dom'

const globalAny: any = globalThis;

// Mock react-leaflet
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: any) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => <div />,
  Marker: ({ position, eventHandlers }: any) => (
    <div 
      data-testid="map-marker" 
      data-pos={JSON.stringify(position)} 
      onClick={() => {
        if (eventHandlers && eventHandlers.dragend) {
          eventHandlers.dragend({
            target: {
              getLatLng: () => ({ lat: position[0] + 0.01, lng: position[1] + 0.01 })
            }
          })
        }
      }}
    />
  ),
  useMapEvents: ({ click }: any) => {
    ;(window as any).simulateMapClick = (lat: number, lng: number) => {
      act(() => click({ latlng: { lat, lng } }))
    }
    return null
  },
  useMap: () => ({
    invalidateSize: vi.fn(),
    setView: vi.fn(),
    getZoom: vi.fn().mockReturnValue(13)
  })
}))

// Mock API
vi.mock('../services/api', () => ({
  api: vi.fn()
}))

// Mock AuthContext
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    token: 'mock-token',
    user: { id: '1', role: 'citizen' }
  })
}))

const mockApi = apiService.api as any

const renderWithContext = () => render(
  <BrowserRouter>
    <Report />
  </BrowserRouter>
)

describe('Report Location & UX Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    globalAny.URL.createObjectURL = vi.fn(() => 'mock-url')
    globalAny.URL.revokeObjectURL = vi.fn()
    
    // Mock fetch for nominatim
    globalAny.fetch = vi.fn() as any
    
    // Default GPS mock
    const mockGeolocation = {
      getCurrentPosition: vi.fn(),
      watchPosition: vi.fn()
    }
    ;(globalAny.navigator as any).geolocation = mockGeolocation
  })

  afterEach(() => {
    delete (window as any).simulateMapClick
  })

  it('1. GPS success updates coordinates and source', async () => {
    ;(globalAny.navigator.geolocation.getCurrentPosition as any).mockImplementationOnce((success: any) => 
      success({ coords: { latitude: 18.5204, longitude: 73.8567, accuracy: 10 } })
    )
    
    ;(globalAny.fetch as any).mockResolvedValueOnce({
      json: async () => ({ display_name: "Pune City, Maharashtra" })
    })

    renderWithContext()
    
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['dummy'], 'test.png', { type: 'image/png' })
    fireEvent.change(fileInput, { target: { files: [file] } })
    
    mockApi.mockResolvedValueOnce({ category_name: 'Pothole', confidence: 0.95, rationale: 'x', provider: 'fallback', model: 'local' })
    
    fireEvent.click(screen.getByText(/Analyze Image/i))
    await waitFor(() => expect(screen.getByText(/Analysis Complete/i)).toBeInTheDocument())
    fireEvent.click(screen.getByText(/Continue to Location/i))

    act(() => { fireEvent.click(screen.getByText(/Use My Current Location/i)) })
    
    await waitFor(() => {
      expect(screen.getByText('Device GPS')).toBeInTheDocument()
      expect(screen.getByText('18.52040, 73.85670')).toBeInTheDocument()
      expect(screen.getByText('±10 m')).toBeInTheDocument()
      expect(screen.getByText('Good')).toBeInTheDocument()
    })
  })

  it('2. GPS warning accuracy still sets coords', async () => {
    ;(globalAny.navigator.geolocation.getCurrentPosition as any).mockImplementationOnce((success: any) => 
      success({ coords: { latitude: 18.5204, longitude: 73.8567, accuracy: 250 } })
    )
    ;(globalAny.fetch as any).mockResolvedValueOnce({ json: async () => ({ display_name: "Pune" }) })
    renderWithContext()
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [new File([''], 'a.jpg')] } })
    mockApi.mockResolvedValueOnce({ category_name: 'Pothole', confidence: 0.95, rationale: 'x', provider: 'fallback', model: 'local' })
    fireEvent.click(screen.getByText(/Analyze Image/i))
    await waitFor(() => screen.getByText(/Continue to Location/i))
    fireEvent.click(screen.getByText(/Continue to Location/i))

    act(() => { fireEvent.click(screen.getByText(/Use My Current Location/i)) })
    await waitFor(() => {
      expect(screen.getByText('Warning')).toBeInTheDocument()
    })
  })

  it('3. GPS poor accuracy shows error and blocks submission', async () => {
    ;(globalAny.navigator.geolocation.getCurrentPosition as any).mockImplementationOnce((success: any) => 
      success({ coords: { latitude: 19.0176, longitude: 72.8649, accuracy: 5000 } })
    )
    ;(globalAny.fetch as any).mockResolvedValueOnce({ json: async () => ({ display_name: "Titwala" }) })
    renderWithContext()
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [new File([''], 'a.jpg')] } })
    mockApi.mockResolvedValueOnce({ category_name: 'Pothole', confidence: 0.95, rationale: 'x', provider: 'fallback', model: 'local' })
    fireEvent.click(screen.getByText(/Analyze Image/i))
    await waitFor(() => screen.getByText(/Continue to Location/i))
    fireEvent.click(screen.getByText(/Continue to Location/i))

    act(() => { fireEvent.click(screen.getByText(/Use My Current Location/i)) })
    await waitFor(() => {
      expect(screen.getByText('Poor')).toBeInTheDocument()
      expect(screen.getByText(/Location accuracy is too low/i)).toBeInTheDocument()
      expect(screen.getByText(/Try Again/i)).toBeInTheDocument()
    })
    
    // Attempting to submit should block
    const descInput = screen.getByPlaceholderText(/Add any helpful details/i)
    act(() => { fireEvent.change(descInput, { target: { value: 'Bad road' } }) })
    
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {})
    act(() => { fireEvent.click(screen.getByText(/Review Report/i)) })
    
    expect(alertMock).toHaveBeenCalledWith("Location accuracy is too low. Please use Search or map pin to verify.")
    alertMock.mockRestore()
  })

  it('4. Search location overrides GPS completely', async () => {
    renderWithContext()
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [new File([''], 'a.jpg')] } })
    mockApi.mockResolvedValueOnce({ category_name: 'Garbage', confidence: 0.9, rationale: 'x', provider: 'fallback', model: 'local' })
    fireEvent.click(screen.getByText(/Analyze Image/i))
    await waitFor(() => screen.getByText(/Continue to Location/i))
    fireEvent.click(screen.getByText(/Continue to Location/i))

    // Mock fetch robustly based on URL
    ;(globalAny.fetch as any).mockImplementation((url: string) => {
      if (url.includes('reverse') && url.includes('19.2965')) {
        return Promise.resolve({ json: async () => ({ display_name: 'Titwala, Maharashtra' }) })
      }
      if (url.includes('search') && url.includes('Pune')) {
        return Promise.resolve({ json: async () => [{ lat: "18.5204", lon: "73.8567", display_name: "Pune City, Maharashtra" }] })
      }
      return Promise.resolve({ json: async () => ({}) })
    })

    // GPS gives Titwala
    ;(globalAny.navigator.geolocation.getCurrentPosition as any).mockImplementationOnce((success: any) => 
      success({ coords: { latitude: 19.2965, longitude: 73.2750, accuracy: 50 } })
    )
    
    act(() => { fireEvent.click(screen.getByText(/Use My Current Location/i)) })
    await waitFor(() => expect(screen.getByText('19.29650, 73.27500')).toBeInTheDocument())

    // Search Pune
    const searchInput = screen.getByPlaceholderText(/Enter area/i)
    act(() => { fireEvent.change(searchInput, { target: { value: 'Pune' } }) })
    
    // Wait for debounce and autocomplete to show
    await waitFor(() => {
      expect(screen.getByText('Pune City')).toBeInTheDocument()
    })

    // Click result
    act(() => { fireEvent.click(screen.getByText('Pune City')) })
    
    await waitFor(() => {
      expect(screen.getAllByText('Search').length).toBeGreaterThan(0)
      expect(screen.getByText('18.52040, 73.85670')).toBeInTheDocument()
      expect(screen.queryByText('±50 m')).not.toBeInTheDocument() 
    })
  })

  it('5. Manual map pin (and drag) updates coords and reverse geocodes', async () => {
    renderWithContext()
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [new File([''], 'a.jpg')] } })
    mockApi.mockResolvedValueOnce({ category_name: 'Garbage', confidence: 0.9, rationale: 'x', provider: 'fallback', model: 'local' })
    fireEvent.click(screen.getByText(/Analyze Image/i))
    await waitFor(() => screen.getByText(/Continue to Location/i))
    fireEvent.click(screen.getByText(/Continue to Location/i))

    ;(globalAny.fetch as any).mockImplementation((url: string) => {
      if (url.includes('reverse')) {
        return Promise.resolve({ json: async () => ({ display_name: "Aundh, Pune" }) })
      }
      return Promise.resolve({ json: async () => ({}) })
    })

    // Simulate map click
    ;(window as any).simulateMapClick(18.56, 73.80)

    await waitFor(() => {
      expect(screen.getByText('Manual Map Pin')).toBeInTheDocument()
      expect(screen.getByText('18.56000, 73.80000')).toBeInTheDocument()
    })
    
    await waitFor(() => {
      expect(screen.getByText('Aundh, Pune')).toBeInTheDocument()
    }, { timeout: 1000 })
    
    // Simulate dragend via simulated click on marker which triggers the mock dragend
    act(() => { fireEvent.click(screen.getByTestId('map-marker')) })
    
    await waitFor(() => {
      expect(screen.getByText('18.57000, 73.81000')).toBeInTheDocument()
    })
  })

  it('12. Gemini success mock & provider display', async () => {
    renderWithContext()
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [new File([''], 'a.jpg')] } })
    
    mockApi.mockResolvedValueOnce({ 
      category_name: 'Pothole', 
      confidence: 0.95, 
      rationale: 'Looks like a pothole', 
      provider: 'gemini', 
      model: 'gemini-3.6-flash' 
    })
    
    act(() => { fireEvent.click(screen.getByText(/Analyze Image/i)) })
    await waitFor(() => {
      expect(screen.getAllByText(/Gemini/i).length).toBeGreaterThan(0)
      expect(screen.getByText(/gemini-3.6-flash/i)).toBeInTheDocument()
      expect(screen.queryByText(/fallback/i)).not.toBeInTheDocument()
    })
  })

  it('14. Gemini 429 mock shows warning and Local Fallback', async () => {
    renderWithContext()
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [new File([''], 'a.jpg')] } })
    
    mockApi.mockResolvedValueOnce({ 
      category_name: 'Garbage', 
      confidence: 0.88, 
      rationale: 'fallback model result', 
      provider: 'fallback', 
      model: 'resnet50' 
    })
    
    act(() => { fireEvent.click(screen.getByText(/Analyze Image/i)) })
    await waitFor(() => {
      expect(screen.getByText(/Gemini temporarily unavailable/i)).toBeInTheDocument()
      expect(screen.getAllByText(/Local Fallback/i).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/resnet50/i).length).toBeGreaterThan(0)
    })
  })

  it('10. Inside PMC routing vs 11. Outside PMC routing in Review Step', async () => {
    renderWithContext()
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [new File([''], 'a.jpg')] } })
    mockApi.mockResolvedValueOnce({ category_name: 'Pothole', confidence: 0.9, rationale: 'x', provider: 'fallback', model: 'local' })
    act(() => { fireEvent.click(screen.getByText(/Analyze Image/i)) })
    await waitFor(() => screen.getByText(/Continue to Location/i))
    act(() => { fireEvent.click(screen.getByText(/Continue to Location/i)) })

    ;(globalAny.fetch as any).mockResolvedValueOnce({ json: async () => ({ display_name: "Titwala" }) })
    
    mockApi.mockResolvedValueOnce({
      authority: null,
      department_name: null,
      geographic_ward_number: null,
      administrative_ward_name: null,
      administrative_zone: null,
      assignment_status: 'Not handled by PMC'
    })

    ;(window as any).simulateMapClick(19.2965, 73.2750)

    const descInput = screen.getByPlaceholderText(/Add any helpful details/i)
    act(() => { fireEvent.change(descInput, { target: { value: 'Bad road' } }) })
    
    act(() => { fireEvent.click(screen.getByText(/Review Report/i)) })
    
    await waitFor(() => {
      expect(screen.getByText('Outside PMC')).toBeInTheDocument()
      expect(screen.getByText('Not handled by PMC')).toBeInTheDocument()
    })

    act(() => { fireEvent.click(screen.getByText('Back')) })
    
    mockApi.mockResolvedValueOnce({
      authority: 'PMC',
      department_name: 'Road Department',
      geographic_ward_number: 15,
      administrative_ward_name: 'Aundh-Baner',
      administrative_zone: '2',
      assignment_status: 'Ward Office / Manual Triage'
    })

    ;(globalAny.fetch as any).mockResolvedValueOnce({ json: async () => ({ display_name: "Pune" }) })
    ;(window as any).simulateMapClick(18.5204, 73.8567)

    act(() => { fireEvent.click(screen.getByText(/Review Report/i)) })
    
    await waitFor(() => {
      expect(screen.getByText('Pune Municipal Corporation')).toBeInTheDocument()
      expect(screen.getByText('Road Department')).toBeInTheDocument()
      expect(screen.getByText('Aundh-Baner')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
      expect(screen.getByText('Ward Office / Manual Triage')).toBeInTheDocument()
    })
  })
})
