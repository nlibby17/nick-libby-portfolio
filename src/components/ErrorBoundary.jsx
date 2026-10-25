import { Component } from "react";

/*
  ErrorBoundary: a decorative layer (canvas fields, the cup,
  the disc) must never take the page down with it. Added after
  the Oct 25, 2026 About outage: a bad canvas call inside the
  grass field's effect threw, and with no boundary in the app,
  React unmounted the entire tree and left a black page. If a
  wrapped layer fails now, it quietly renders nothing and the
  page around it survives.
*/
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    // Decorative failure: swallow it. The page is the content.
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}
