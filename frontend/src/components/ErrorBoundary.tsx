import { RotateCw } from 'lucide-react'
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { translate } from '../i18n'

interface State {
  error: Error | null
}

// มีอะไรพังตอน render → ไม่ปล่อยให้จอขาว โชว์ปุ่มโหลดใหม่แทน
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[app] render crashed', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-page px-6 text-center">
        <img src="/favicon.svg" alt="" className="size-16" />
        <div>
          <p className="font-display text-xl text-stone-900">{translate('อุ๊ย มีบางอย่างผิดพลาด')}</p>
          <p className="mt-1 text-sm text-stone-600">{translate('โหลดหน้าใหม่แล้วลองอีกครั้งนะ')}</p>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="flex items-center gap-2 rounded-full bg-orange-500 px-5 py-2.5 font-medium text-white hover:bg-orange-600"
        >
          <RotateCw size={17} aria-hidden="true" />
          {translate('โหลดหน้าใหม่')}
        </button>
      </div>
    )
  }
}
