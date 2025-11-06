// Extend Window interface for custom auth events
interface WindowEventMap {
  "auth:login": Event;
  "auth:logout": Event;
}
