import { redirect } from 'next/navigation'
import { ManagerPanel } from './ManagerPanel'

// Block in production — this is an internal tool only
export default function ManagerPage() {
  if (process.env.NODE_ENV === 'production') {
    redirect('/')
  }
  return <ManagerPanel />
}
