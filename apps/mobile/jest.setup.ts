/**
 * Jest setup for the mobile app.
 *
 * React 19 requires this flag before it will accept state updates wrapped by a test's `act()`;
 * without it, every asynchronous screen update logs "The current testing environment is not
 * configured to support act(...)" and the render is never flushed, so `findByText` times out on a
 * tree that would have rendered fine on a device.
 */
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
