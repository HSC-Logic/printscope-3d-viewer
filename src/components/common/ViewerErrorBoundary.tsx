import { Component, type ErrorInfo, type ReactNode } from "react";
interface Props {
  children: ReactNode;
}
interface State {
  failed: boolean;
}
export class ViewerErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV)
      console.error("PrintScope viewer failed", error, info);
  }
  render() {
    return this.state.failed ? (
      <div className="empty" role="alert">
        <b>The 3D viewer could not start.</b>
        <span>Check that WebGL is enabled, then reload the page.</span>
      </div>
    ) : (
      this.props.children
    );
  }
}
