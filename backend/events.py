"""Tiny in-process pub/sub broker for Server-Sent Events.

Each SSE connection subscribes a Queue; publishers fan a payload out to every
subscriber. In-memory only — when running multiple processes/instances, swap
this for a shared broker (e.g. Redis pub/sub) so events reach all workers.
"""

import queue
import threading


class Broker:
    def __init__(self):
        self._subscribers: set[queue.Queue] = set()
        self._lock = threading.Lock()

    def subscribe(self) -> queue.Queue:
        q: queue.Queue = queue.Queue(maxsize=100)
        with self._lock:
            self._subscribers.add(q)
        return q

    def unsubscribe(self, q: queue.Queue) -> None:
        with self._lock:
            self._subscribers.discard(q)

    def publish(self, payload) -> None:
        with self._lock:
            subscribers = list(self._subscribers)
        for q in subscribers:
            try:
                q.put_nowait(payload)
            except queue.Full:
                # Slow/stuck consumer — drop the event for that subscriber.
                pass


broker = Broker()
