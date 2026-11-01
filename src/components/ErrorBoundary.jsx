import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="app">
        <div className="card">
          <h2>Something went wrong</h2>
          <p className="text-2">Your saved fasts are safe on this device. Reload to continue.</p>
          <p className="hint">{String(this.state.error?.message ?? this.state.error)}</p>
          <button className="btn primary" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      </div>
    )
  }
}
