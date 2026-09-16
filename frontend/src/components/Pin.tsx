/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { useMapEvents } from 'react-leaflet'

export function Pin({ setPos }: { setPos: (p: [number, number]) => void }) {
  useMapEvents({
    click(e) {
      setPos([e.latlng.lat, e.latlng.lng])
    },
  })
  return null
}
